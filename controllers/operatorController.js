import mongoose from "mongoose";

import Tour from "../models/Tour.js";
import Booking from "../models/Booking.js";
import TourSchedule from "../models/Tour.js";
import Review from "../models/Review.js";
// import OperatorPayout from "../models/OperatorPayout.js";

// --------------------------------------------------
// HELPER: Check operator role
// --------------------------------------------------
const checkOperator = (req, res) => {
  if (!req.user || req.user.role !== "operator") {
    res.status(403).json({
      success: false,
      message: "Operator access required",
    });

    return false;
  }

  return true;
};

// --------------------------------------------------
// HELPER: Get operator ID
// --------------------------------------------------
const getOperatorId = (req) => {
  return req.user.user_id || req.user._id;
};

// --------------------------------------------------
// HELPER: Validate MongoDB ID
// --------------------------------------------------
const isValidId = (id) => {
  return mongoose.isValidObjectId(id);
};

// --------------------------------------------------
// HELPER: Pagination
// --------------------------------------------------
const getPagination = (query) => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(
    100,
    Math.max(1, Number(query.limit) || 10)
  );

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
};

// ==================================================
// 1. OPERATOR DASHBOARD OVERVIEW
// GET /api/operator/dashboard
// ==================================================

export const getOperatorDashboard = async (req, res, next) => {
  try {
    if (!checkOperator(req, res)) return;

    const operatorId = getOperatorId(req);
    const now = new Date();

    const [
      totalTours,
      publishedTours,
      totalBookings,
      pendingBookings,
      upcomingBookings,
      totalGuests,
      earningsSummary,
      recentBookings,
    ] = await Promise.all([
      // Total tours
      Tour.countDocuments({ operatorId }),

      // Published tours
      Tour.countDocuments({
        operatorId,
        status: "published",
      }),

      // Total bookings
      Booking.countDocuments({ operatorId }),

      // Pending bookings
      Booking.countDocuments({
        operatorId,
        status: "pending",
      }),

      // Upcoming confirmed bookings
      Booking.countDocuments({
        operatorId,
        status: "confirmed",
        startAt: { $gte: now },
      }),

      // Total guests
      Booking.aggregate([
        {
          $match: {
            operatorId: new mongoose.Types.ObjectId(
              operatorId.toString()
            ),
            status: { $in: ["confirmed", "completed"] },
          },
        },
        {
          $group: {
            _id: null,
            guests: { $sum: "$participants" },
          },
        },
      ]),

      // Earnings calculated from paid bookings
      Booking.aggregate([
        {
          $match: {
            operatorId: new mongoose.Types.ObjectId(
              operatorId.toString()
            ),
            paymentStatus: "paid",
          },
        },
        {
          $group: {
            _id: "$currency",
            grossAmount: { $sum: "$totalPrice" },
            paidBookings: { $sum: 1 },
          },
        },
      ]),

      // Recent bookings
      Booking.find({ operatorId })
        .populate("tourId", "title images")
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
    ]);

    // Calculate total earnings
    const grossAmount = earningsSummary.reduce(
      (total, item) => total + item.grossAmount,
      0
    );

    res.status(200).json({
      success: true,
      message: "Operator dashboard retrieved successfully",

      data: {
        tours: {
          total: totalTours,
          published: publishedTours,
        },

        bookings: {
          total: totalBookings,
          pending: pendingBookings,
          upcoming: upcomingBookings,
        },

        guests: {
          total: totalGuests[0]?.guests || 0,
        },

        earnings: {
          grossAmount,
          paidAmount: grossAmount,
          netAmount: grossAmount,
          commission: 0,
          pendingAmount: 0,
          paidBookings: earningsSummary.reduce(
            (total, item) => total + item.paidBookings,
            0
          ),
          byCurrency: earningsSummary,
        },

        recentBookings,
      },
    });
  } catch (error) {
    next(error);
  }
};


// ==================================================
// 2. CREATE TOUR
// POST /api/operator/tours
// ==================================================
export const createOperatorTour = async (req, res, next) => {
  try {
    if (!checkOperator(req, res)) return;

    const operatorId = getOperatorId(req);

    const {
      destinationId,
      categoryId,
      title,
      slug,
      description,
      durationMinutes,
      highlights,
      itinerary,
      inclusions,
      exclusions,
      meetingPoint,
      images,
      basePrice,
      currency,
      cancellationPolicy,
    } = req.body;

    if (
      !destinationId ||
      !categoryId ||
      !title ||
      !description ||
      durationMinutes == null ||
      basePrice == null
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Destination, category, title, description, duration, and base price are required",
      });
    }

    if (
      !isValidId(destinationId) ||
      !isValidId(categoryId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid destination or category ID",
      });
    }

    if (
      !Number.isFinite(Number(durationMinutes)) ||
      Number(durationMinutes) <= 0 ||
      !Number.isFinite(Number(basePrice)) ||
      Number(basePrice) < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid duration or base price",
      });
    }

    const tour = await Tour.create({
      operatorId,
      destinationId,
      categoryId,
      title,
      slug,
      description,
      durationMinutes,
      highlights,
      itinerary,
      inclusions,
      exclusions,
      meetingPoint,
      images,
      basePrice,
      currency: currency || "INR",
      cancellationPolicy,
      status: "draft",
    });

    res.status(201).json({
      success: true,
      message: "Tour created successfully",
      data: tour,
    });
  } catch (error) {
    next(error);
  }
};

// ==================================================
// 3. GET OPERATOR'S TOURS
// GET /api/operator/tours
// ==================================================
export const getOperatorTours = async (req, res, next) => {
  try {
    if (!checkOperator(req, res)) return;

    const operatorId = getOperatorId(req);
    const { page, limit, skip } = getPagination(req.query);

    const filter = { operatorId };

    if (req.query.status) {
      filter.status = req.query.status;
    }

    if (req.query.search) {
      filter.title = {
        $regex: req.query.search.trim(),
        $options: "i",
      };
    }

    const [tours, total] = await Promise.all([
      Tour.find(filter)
        .populate("destinationId", "name country")
        .populate("categoryId", "name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      Tour.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: tours,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// ==================================================
// 4. UPDATE OPERATOR'S TOUR
// PATCH /api/operator/tours/:tourId
// ==================================================
export const updateOperatorTour = async (req, res, next) => {
  try {
    if (!checkOperator(req, res)) return;

    const operatorId = getOperatorId(req);
    const { tourId } = req.params;

    if (!isValidId(tourId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid tour ID",
      });
    }

    const allowedFields = [
      "destinationId",
      "categoryId",
      "title",
      "slug",
      "description",
      "durationMinutes",
      "highlights",
      "itinerary",
      "inclusions",
      "exclusions",
      "meetingPoint",
      "images",
      "basePrice",
      "currency",
      "cancellationPolicy",
    ];

    const updates = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid tour fields provided",
      });
    }

    for (const field of ["destinationId", "categoryId"]) {
      if (
        updates[field] !== undefined &&
        !isValidId(updates[field])
      ) {
        return res.status(400).json({
          success: false,
          message: `Invalid ${field}`,
        });
      }
    }

    if (
      updates.durationMinutes !== undefined &&
      (!Number.isFinite(Number(updates.durationMinutes)) ||
        Number(updates.durationMinutes) <= 0)
    ) {
      return res.status(400).json({
        success: false,
        message: "Duration must be greater than zero",
      });
    }

    if (
      updates.basePrice !== undefined &&
      (!Number.isFinite(Number(updates.basePrice)) ||
        Number(updates.basePrice) < 0)
    ) {
      return res.status(400).json({
        success: false,
        message: "Base price must be zero or greater",
      });
    }

    const tour = await Tour.findOneAndUpdate(
      { _id: tourId, operatorId },
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!tour) {
      return res.status(404).json({
        success: false,
        message: "Tour not found or you do not own this tour",
      });
    }

    res.status(200).json({
      success: true,
      message: "Tour updated successfully",
      data: tour,
    });
  } catch (error) {
    next(error);
  }
};

// ==================================================
// 5. PUBLISH TOUR
// PATCH /api/operator/tours/:tourId/publish
// ==================================================
export const publishOperatorTour = async (req, res, next) => {
  try {
    if (!checkOperator(req, res)) return;

    const operatorId = getOperatorId(req);
    const { tourId } = req.params;

    if (!isValidId(tourId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid tour ID",
      });
    }

    const tour = await Tour.findOne({
      _id: tourId,
      operatorId,
    });

    if (!tour) {
      return res.status(404).json({
        success: false,
        message: "Tour not found or access denied",
      });
    }

    // Submit for review rather than allowing an operator
    // to bypass admin moderation.
    tour.status = "pending";
    await tour.save();

    res.status(200).json({
      success: true,
      message: "Tour submitted for admin approval",
      data: tour,
    });
  } catch (error) {
    next(error);
  }
};

// ==================================================
// 6. DELETE / ARCHIVE TOUR
// DELETE /api/operator/tours/:tourId
// ==================================================
export const deleteOperatorTour = async (req, res, next) => {
  try {
    if (!checkOperator(req, res)) return;

    const operatorId = getOperatorId(req);
    const { tourId } = req.params;

    if (!isValidId(tourId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid tour ID",
      });
    }

    const tour = await Tour.findOne({
      _id: tourId,
      operatorId,
    });

    if (!tour) {
      return res.status(404).json({
        success: false,
        message: "Tour not found or access denied",
      });
    }

    const activeBookings = await Booking.countDocuments({
      tourId,
      operatorId,
      status: { $in: ["pending", "confirmed"] },
    });

    if (activeBookings > 0) {
      return res.status(409).json({
        success: false,
        message:
          "This tour has active bookings. Resolve them before archiving the tour.",
      });
    }

    // Archive instead of permanently deleting booking history.
    tour.status = "archived";
    await tour.save();

    res.status(200).json({
      success: true,
      message: "Tour archived successfully",
      data: tour,
    });
  } catch (error) {
    next(error);
  }
};

// ==================================================
// 7. GET OPERATOR'S SCHEDULES
// GET /api/operator/schedules
// ==================================================
export const getOperatorSchedules = async (req, res, next) => {
  try {
    if (!checkOperator(req, res)) return;

    const operatorId = getOperatorId(req);
    const { page, limit, skip } = getPagination(req.query);

    const filter = { operatorId };

    if (req.query.tourId) {
      if (!isValidId(req.query.tourId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid tour ID",
        });
      }

      filter.tourId = req.query.tourId;
    }

    const [schedules, total] = await Promise.all([
      TourSchedule.find(filter)
        .populate("tourId", "title")
        .sort({ startDate: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      TourSchedule.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: schedules,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// ==================================================
// 8. CREATE TOUR SCHEDULE
// POST /api/operator/schedules
// ==================================================
export const createOperatorSchedule = async (req, res, next) => {
  try {
    if (!checkOperator(req, res)) return;

    const operatorId = getOperatorId(req);
    const {
      tourId,
      startDate,
      endDate,
      availableSlots,
      price,
    } = req.body;

    if (
      !tourId ||
      !startDate ||
      !endDate ||
      availableSlots == null ||
      price == null
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Tour, start date, end date, available slots, and price are required",
      });
    }

    if (!isValidId(tourId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid tour ID",
      });
    }

    const tour = await Tour.findOne({
      _id: tourId,
      operatorId,
      status: "published",
    });

    if (!tour) {
      return res.status(404).json({
        success: false,
        message: "Published tour not found for this operator",
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      start <= new Date() ||
      end < start
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid schedule dates",
      });
    }

    if (
      !Number.isInteger(Number(availableSlots)) ||
      Number(availableSlots) < 1 ||
      !Number.isFinite(Number(price)) ||
      Number(price) < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid available slots or price",
      });
    }

    const schedule = await TourSchedule.create({
      operatorId,
      tourId,
      startDate: start,
      endDate: end,
      availableSlots: Number(availableSlots),
      bookedSlots: 0,
      price: Number(price),
      status: "available",
    });

    res.status(201).json({
      success: true,
      message: "Tour schedule created successfully",
      data: schedule,
    });
  } catch (error) {
    next(error);
  }
};

/// ==================================================
// 9. GET OPERATOR BOOKINGS
// GET /api/operator/bookings
// ==================================================

export const getOperatorBookings = async (req, res, next) => {
  try {
    if (!checkOperator(req, res)) return;

    const operatorId = getOperatorId(req);

    if (!operatorId || !mongoose.isValidObjectId(operatorId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid operator ID",
      });
    }

    const { page, limit, skip } = getPagination(req.query);

    const filter = {
      operatorId,
    };

    if (req.query.status) {
      const allowedStatuses = [
        "pending",
        "confirmed",
        "cancelled",
        "rejected",
        "completed",
      ];

      if (!allowedStatuses.includes(req.query.status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid booking status",
        });
      }

      filter.status = req.query.status;
    }

    const [bookings, total] = await Promise.all([
      Booking.find(filter)
        .populate("tourId", "title images")
        .populate("userId", "name email phone")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      Booking.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      message: "Operator bookings retrieved successfully",
      data: bookings,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("GET OPERATOR BOOKINGS ERROR:", error);
    next(error);
  }
};
// ==================================================
// 10. UPDATE BOOKING STATUS
// PATCH /api/operator/bookings/:bookingId/status
// Body: { "status": "confirmed" }
// ==================================================

export const updateOperatorBookingStatus = async (req, res, next) => {
  try {
    if (!checkOperator(req, res)) return;

    const operatorId = getOperatorId(req);
    const { bookingId } = req.params;
    const { status } = req.body || {};
    console.log("========== BOOKING STATUS DEBUG ==========");
    console.log("Request body:", req.body);
    console.log("Received status:", status);
    console.log("Status type:", typeof status);
    console.log("==========================================");

    if (!isValidId(bookingId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking ID",
      });
    }

    // Allowed operator actions
    const allowedStatuses = ["confirmed", "cancelled", "completed"];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking status",
        allowedStatuses,
      });
    }

    const booking = await Booking.findOne({
      _id: bookingId,
      operatorId,
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found or access denied",
      });
    }

    // Pending -> Confirmed
    if (status === "confirmed") {
      if (booking.status !== "pending") {
        return res.status(400).json({
          success: false,
          message: "Only pending bookings can be confirmed",
        });
      }
    }

    // Pending -> Cancelled
    if (status === "cancelled") {
      if (booking.status !== "pending") {
        return res.status(400).json({
          success: false,
          message: "Only pending bookings can be cancelled here",
        });
      }
    }

    // Confirmed -> Completed
    if (status === "completed") {
      if (booking.status !== "confirmed") {
        return res.status(400).json({
          success: false,
          message: "Only confirmed bookings can be completed",
        });
      }

      // Complete only after the travel date has ended
      const travelDate = new Date(booking.travelDate);

      if (Number.isNaN(travelDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid booking travel date",
        });
      }

      const travelDayEnd = new Date(travelDate);
      travelDayEnd.setHours(23, 59, 59, 999);

      if (new Date() <= travelDayEnd) {
        return res.status(400).json({
          success: false,
          message: "Booking can be completed only after the travel date has ended",
        });
      }
    }

    booking.status = status;
    await booking.save();

    return res.status(200).json({
      success: true,
      message: `Booking ${status} successfully`,
      data: booking,
    });
  } catch (error) {
    next(error);
  }
};


// ==================================================
// 11. GUEST LIST
// GET /api/operator/guests
// ==================================================
export const getOperatorGuests = async (req, res, next) => {
  try {
    if (!checkOperator(req, res)) return;

    const operatorId = getOperatorId(req);
    const { page, limit, skip } = getPagination(req.query);

    const filter = {
      operatorId,
      status: { $in: ["confirmed", "completed"] },
    };

    if (req.query.tourId) {
      if (!isValidId(req.query.tourId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid tour ID",
        });
      }

      filter.tourId = req.query.tourId;
    }

    const [guests, total] = await Promise.all([
      Booking.find(filter)
        .populate("userId", "name email phone")
        .populate("tourId", "title")
        .populate("scheduleId")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      Booking.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      message: "Guest bookings retrieved successfully",
      data: guests,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// ==================================================
// 12. GET REVIEWS FOR OPERATOR'S TOURS
// GET /api/operator/reviews
// ==================================================
export const getOperatorReviews = async (req, res, next) => {
  try {
    if (!checkOperator(req, res)) return;

    const operatorId = getOperatorId(req);
    const { page, limit, skip } = getPagination(req.query);

    const operatorTours = await Tour.find({ operatorId })
      .select("_id");

    const tourIds = operatorTours.map((tour) => tour._id);

    const filter = { tourId: { $in: tourIds } };

    const [reviews, total, ratingSummary] = await Promise.all([
      Review.find(filter)
        .populate("userId", "name profileImage")
        .populate("tourId", "title")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      Review.countDocuments(filter),

      Review.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            averageRating: { $avg: "$rating" },
            totalReviews: { $sum: 1 },
          },
        },
      ]),
    ]);

    res.status(200).json({
      success: true,
      data: {
        reviews,
        summary: {
          averageRating: ratingSummary[0]?.averageRating || 0,
          totalReviews: ratingSummary[0]?.totalReviews || 0,
        },
      },
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// ==================================================
// 13. OPERATOR EARNINGS
// GET /api/operator/earnings
// ==================================================
export const getOperatorEarnings = async (req, res, next) => {
  try {
    if (!checkOperator(req, res)) return;

    const operatorId = getOperatorId(req);

    const payouts = await OperatorPayout.aggregate([
      {
        $match: {
          operatorId: new mongoose.Types.ObjectId(
            operatorId.toString()
          ),
        },
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          grossAmount: { $sum: "$grossAmount" },
          commission: { $sum: "$commission" },
          netAmount: { $sum: "$netAmount" },
        },
      },
    ]);

    const summary = {
      totalPayouts: 0,
      grossAmount: 0,
      commission: 0,
      netAmount: 0,
      paidAmount: 0,
      pendingAmount: 0,
      processingAmount: 0,
    };

    for (const payout of payouts) {
      summary.totalPayouts += payout.count;

      summary.grossAmount += payout.grossAmount || 0;
      summary.commission += payout.commission || 0;

      if (["pending", "processing", "paid"].includes(payout._id)) {
        summary.netAmount += payout.netAmount || 0;
      }

      if (payout._id === "paid") {
        summary.paidAmount += payout.netAmount || 0;
      }

      if (payout._id === "pending") {
        summary.pendingAmount += payout.netAmount || 0;
      }

      if (payout._id === "processing") {
        summary.processingAmount += payout.netAmount || 0;
      }
    }

    const { page, limit, skip } = getPagination(req.query);

    const history = await OperatorPayout.find({ operatorId })
      .populate("bookingId")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    res.status(200).json({
      success: true,
      message: "Operator earnings retrieved successfully",
      data: {
        summary,
        payouts: history,
      },
      pagination: {
        page,
        limit,
      },
    });
  } catch (error) {
    next(error);
  }
};
