import mongoose from "mongoose";

import User from "../models/User.js";
import Tour from "../models/Tour.js";
import Booking from "../models/Booking.js";
// import Payment from "../models/Payment.js";
// import OperatorPayout from "../models/OperatorPayout.js";
import Notification from "../models/Notification.js";
import Review from "../models/Review.js";


import { sendEmail } from "../mail/nodemailer.js";
import {
  accountStatusTemplate,
  notificationTemplate,
} from "../mail/emailTemplate.js";

// --------------------------------------------------
// HELPER: PAGINATION
// --------------------------------------------------
const getPagination = (query) => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
};

// --------------------------------------------------
// HELPER: CREATE IN-APP NOTIFICATION
// --------------------------------------------------
const createAdminActionNotification = async ({
  userId,
  type = "general",
  title,
  message,
  relatedTourId = null,
}) => {
  try {
    if (!userId) return;

    await Notification.create({
      userId,
      type,
      title,
      message,
      relatedTourId,
    });

    console.log("Admin notification created successfully");
  } catch (error) {
    console.error(
      "Admin notification creation failed:",
      error.message
    );
  }
};

// --------------------------------------------------
// HELPER: SEND EMAIL SAFELY
// Email failure must not undo a completed admin action.
// --------------------------------------------------
const sendAdminActionEmail = async ({
  to,
  subject,
  text,
  html,
}) => {
  if (!to) {
    console.warn(
      "Admin action email skipped: recipient email is missing."
    );
    return;
  }

  try {
    await sendEmail({
      to,
      subject,
      text,
      html,
    });
  } catch (error) {
    console.error(
      `Failed to send admin action email to ${to}:`,
      error.message
    );
  }
};

// --------------------------------------------------
// HELPER: GET FIRST NAME
// Supports both firstName/lastName and name fields.
// --------------------------------------------------
const getFirstName = (user) => {
  if (user?.firstName?.trim()) {
    return user.firstName.trim();
  }

  if (user?.name?.trim()) {
    return user.name.trim().split(/\s+/)[0];
  }

  return "Traveler";
};

// --------------------------------------------------
// HELPER: ADMIN AUTHORIZATION
// --------------------------------------------------
const isAdmin = (req, res) => {
  if (!req.user || req.user.role !== "admin") {
    res.status(403).json({
      success: false,
      message: "Admin access required",
    });

    return false;
  }

  return true;
};

// --------------------------------------------------
// 1. ADMIN DASHBOARD STATISTICS
// GET /api/admin/dashboard
// --------------------------------------------------
export const getDashboardStats = async (req, res, next) => {
  try {
    if (!isAdmin(req, res)) return;

    const [
      totalUsers,
      totalOperators,
      totalTours,
      publishedTours,
      totalBookings,
      pendingBookings,
      confirmedBookings,
      totalPayments,
      successfulPayments,
      pendingPayments,
      failedPayments,
      refundedPayments,
      revenueResult,
    ] = await Promise.all([
      // Users
      User.countDocuments({ role: "user" }),

      // Operators
      User.countDocuments({ role: "operator" }),

      // Tours
      Tour.countDocuments({}),

      Tour.countDocuments({ status: "published" }),

      // Bookings
      Booking.countDocuments({}),

      Booking.countDocuments({ status: "pending" }),

      Booking.countDocuments({ status: "confirmed" }),

      // Payment statistics from Booking model
      Booking.countDocuments({
        paymentStatus: { $in: ["pending", "paid", "failed", "refunded"] },
      }),

      Booking.countDocuments({ paymentStatus: "paid" }),

      Booking.countDocuments({ paymentStatus: "pending" }),

      Booking.countDocuments({ paymentStatus: "failed" }),

      Booking.countDocuments({ paymentStatus: "refunded" }),

      // Revenue from successful payments only
      Booking.aggregate([
        {
          $match: {
            paymentStatus: "paid",
          },
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$totalPrice" },
            totalParticipants: { $sum: "$participants" },
            totalBookings: { $sum: 1 },
          },
        },
      ]),
    ]);

    const revenue = revenueResult[0]?.totalRevenue || 0;

    // Change this percentage if your platform uses a different commission.
    const commissionPercentage = 10;

    const platformCommission =
      (revenue * commissionPercentage) / 100;

    const operatorEarnings = revenue - platformCommission;

    return res.status(200).json({
      success: true,
      message: "Admin dashboard statistics retrieved",

      data: {
        users: {
          total: totalUsers,
        },

        operators: {
          total: totalOperators,
        },

        tours: {
          total: totalTours,
          published: publishedTours,
        },

        bookings: {
          total: totalBookings,
          pending: pendingBookings,
          confirmed: confirmedBookings,
        },

        payments: {
          total: totalPayments,
          successful: successfulPayments,
          pending: pendingPayments,
          failed: failedPayments,
          refunded: refundedPayments,
        },

        financials: {
          grossPaymentAmount: revenue,
          platformCommission,
          operatorEarnings,
          commissionPercentage,
          totalPaidBookings: revenueResult[0]?.totalBookings || 0,
          totalPaidParticipants:
            revenueResult[0]?.totalParticipants || 0,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};



// --------------------------------------------------
// GET ALL REVIEWS
// GET /api/admin/reviews
// Optional query: page, limit, status, userId, tourId, rating
// --------------------------------------------------
export const getAllReviews = async (req, res, next) => {
  try {
    if (!isAdmin(req, res)) return;

    const { page, limit, skip } = getPagination(req.query);

    const filter = {};

    if (req.query.status) {
      const allowedStatuses = [
        "pending",
        "approved",
        "rejected",
        "hidden",
      ];

      if (!allowedStatuses.includes(req.query.status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid review status",
          allowedStatuses,
        });
      }

      filter.status = req.query.status;
    }

    if (req.query.userId) {
      if (!mongoose.isValidObjectId(req.query.userId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid user ID",
        });
      }

      filter.userId = req.query.userId;
    }

    if (req.query.tourId) {
      if (!mongoose.isValidObjectId(req.query.tourId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid tour ID",
        });
      }

      filter.tourId = req.query.tourId;
    }

    if (req.query.rating !== undefined) {
      const rating = Number(req.query.rating);

      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        return res.status(400).json({
          success: false,
          message: "Rating must be between 1 and 5",
        });
      }

      filter.rating = rating;
    }

    const [reviews, total] = await Promise.all([
      Review.find(filter)
        .populate("userId", "name firstName lastName email")
        .populate("tourId", "title images")
        .populate("bookingId", "bookingReference status")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      Review.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      message: "All reviews retrieved successfully",
      data: reviews,
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

// --------------------------------------------------
// 2. GET ALL USERS
// GET /api/admin/users
// Optional query: page, limit, status, search
// --------------------------------------------------
export const getAllUsers = async (req, res, next) => {
  try {
    if (!isAdmin(req, res)) return;

    const { page, limit, skip } = getPagination(req.query);

    const filter = {
      role: "user",
    };

    if (req.query.status) {
      filter.status = req.query.status;
    }

    if (req.query.search) {
      const search = req.query.search.trim();

      if (search) {
        filter.$or = [
          { firstName: { $regex: search, $options: "i" } },
          { lastName: { $regex: search, $options: "i" } },
          { name: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
        ];
      }
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .select("-password")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      User.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      message: "Users retrieved successfully",
      data: users,
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


// --------------------------------------------------
// 3. UPDATE USER STATUS
// PATCH /api/admin/users/:userId/status
// Body: { "status": "active" | "inactive" | "suspended" }
// Sends an email to the user.
// --------------------------------------------------
export const updateUserStatus = async (req, res, next) => {
  try {
    if (!isAdmin(req, res)) return;

    const { userId } = req.params;
    const { status } = req.body;

    // Validate user ID
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    // Validate status
    const allowedStatuses = ["active", "inactive", "suspended"];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user status",
        allowedStatuses,
      });
    }

    // Update user status
    const user = await User.findOneAndUpdate(
      {
        _id: userId,
        role: "user",
      },
      {
        $set: { status },
      },
      {
        new: true,
        runValidators: true,
      }
    ).select("-password -resetPasswordToken -emailVerificationToken");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const firstName = getFirstName(user);

    // Create in-app notification
    try {
      await createAdminActionNotification({
        userId: user._id,
        type: "account_status_changed",
        title: "Account Status Updated",
        message: `Your Tripora account status has been changed to "${status}" by an administrator.`,
      });

      console.log("User status notification created:", user.email);
    } catch (notificationError) {
      console.error(
        "User status notification failed:",
        notificationError
      );
    }

    // Send account status email
    try {
      if (!user.email) {
        throw new Error("User does not have an email address.");
      }

      const emailHtml = accountStatusTemplate({
        firstName,
        status,
      });

      console.log("Sending account status email to:", user.email);

      await sendAdminActionEmail({
        to: user.email,
        subject: "Tripora Account Status Update",
        text:
          `Hello ${firstName},\n\n` +
          `Your Tripora account status has been changed to "${status}" by an administrator.\n\n` +
          "If you have questions, please contact Tripora support.",
        html: emailHtml,
      });

      console.log("Account status email process completed:", user.email);
    } catch (emailError) {
      console.error("User account status email failed:", emailError);
    }

    return res.status(200).json({
      success: true,
      message: `User account ${status} successfully`,
      data: user,
    });
  } catch (error) {
    console.error("Update user status error:", error);
    next(error);
  }
};

// --------------------------------------------------
// 4. UPDATE OPERATOR ACCOUNT STATUS
// PATCH /api/admin/operators/:operatorId/status
// Body: { "status": "active" | "inactive" }
// Sends an email to the operator.
// --------------------------------------------------
export const updateOperatorStatus = async (req, res, next) => {
  try {
    if (!isAdmin(req, res)) return;

    const { operatorId } = req.params;
    const { status } = req.body;

    // Validate operator ID
    if (!mongoose.isValidObjectId(operatorId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid operator ID",
      });
    }

    // Validate status
    const allowedStatuses = ["active", "inactive"];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid operator account status",
        allowedStatuses,
      });
    }

    // Update operator status
    const operator = await User.findOneAndUpdate(
      {
        _id: operatorId,
        role: "operator",
      },
      {
        $set: { status },
      },
      {
        new: true,
        runValidators: true,
      }
    ).select("-password -resetPasswordToken -emailVerificationToken");

    if (!operator) {
      return res.status(404).json({
        success: false,
        message: "Operator not found",
      });
    }

    const firstName = getFirstName(operator);

    // Create in-app notification
    try {
      await createAdminActionNotification({
        userId: operator._id,
        type: "account_status_changed",
        title: "Operator Account Status Updated",
        message: `Your Tripora operator account status has been changed to "${status}" by an administrator.`,
      });

      console.log("Operator status notification created:", operator.email);
    } catch (notificationError) {
      console.error(
        "Operator status notification failed:",
        notificationError
      );
    }

    // Send account status email
    try {
      if (!operator.email) {
        throw new Error("Operator does not have an email address.");
      }

      const emailHtml = accountStatusTemplate({
        firstName,
        status,
      });

      console.log("Sending operator status email to:", operator.email);

      await sendAdminActionEmail({
        to: operator.email,
        subject: "Tripora Operator Account Status Update",
        text:
          `Hello ${firstName},\n\n` +
          `Your Tripora operator account status has been changed to "${status}" by an administrator.\n\n` +
          "If you have questions, please contact Tripora support.",
        html: emailHtml,
      });

      console.log(
        "Operator status email process completed:",
        operator.email
      );
    } catch (emailError) {
      console.error("Operator status email failed:", emailError);
    }

    return res.status(200).json({
      success: true,
      message: `Operator account ${status} successfully`,
      data: operator,
    });
  } catch (error) {
    console.error("Update operator status error:", error);
    next(error);
  }
};

// --------------------------------------------------
// 5. GET ALL OPERATORS
// GET /api/admin/operators
// Optional query: page, limit, status, verificationStatus, search
// --------------------------------------------------
export const getAllOperators = async (req, res, next) => {
  try {
    if (!isAdmin(req, res)) return;

    const { page, limit, skip } = getPagination(req.query);

    const filter = {
      role: "operator",
    };

    if (req.query.status) {
      filter.status = req.query.status;
    }

    if (req.query.verificationStatus) {
      filter.sellerVerificationStatus =
        req.query.verificationStatus;
    }

    if (req.query.search) {
      const search = req.query.search.trim();

      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: "i" } },
          { firstName: { $regex: search, $options: "i" } },
          { lastName: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
          {
            "operatorProfile.businessName": {
              $regex: search,
              $options: "i",
            },
          },
        ];
      }
    }

    const [operators, total] = await Promise.all([
      User.find(filter)
        .select(
          "-password -resetPasswordToken -emailVerificationToken"
        )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      User.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: operators,
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

// --------------------------------------------------
// 6. UPDATE OPERATOR VERIFICATION
// PATCH /api/admin/operators/:operatorId/verification
// Body: { "verificationStatus": "verified" | "rejected" | "pending" }
// --------------------------------------------------
export const updateOperatorVerification = async (
  req,
  res,
  next
) => {
  try {
    if (!isAdmin(req, res)) return;

    const { operatorId } = req.params;
    const { verificationStatus } = req.body;

    if (!mongoose.isValidObjectId(operatorId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid operator ID",
      });
    }

    const allowedStatuses = [
      "pending",
      "verified",
      "rejected",
    ];

    if (!allowedStatuses.includes(verificationStatus)) {
      return res.status(400).json({
        success: false,
        message: "Invalid verification status",
        allowedStatuses,
      });
    }

    const operator = await User.findOneAndUpdate(
      {
        _id: operatorId,
        role: "operator",
      },
      {
        $set: {
          sellerVerificationStatus: verificationStatus,
        },
      },
      {
        new: true,
        runValidators: true,
      }
    ).select(
      "-password -resetPasswordToken -emailVerificationToken"
    );

    if (!operator) {
      return res.status(404).json({
        success: false,
        message: "Operator not found",
      });
    }

    const details = {
      verified: {
        title: "Operator Verification Approved",
        message:
          "Congratulations! Your Tripora operator account has been verified.",
      },
      rejected: {
        title: "Operator Verification Rejected",
        message:
          "Your Tripora operator verification was rejected. Please review your submitted details.",
      },
      pending: {
        title: "Operator Verification Updated",
        message:
          "Your Tripora operator verification status has been changed to pending.",
      },
    }[verificationStatus];

    await createAdminActionNotification({
      userId: operator._id,
      type:
        verificationStatus === "verified"
          ? "operator_approved"
          : verificationStatus === "rejected"
            ? "operator_rejected"
            : "general",
      ...details,
    });

    return res.status(200).json({
      success: true,
      message: "Operator verification updated",
      data: operator,
    });
  } catch (error) {
    next(error);
  }
};

// --------------------------------------------------
// 7. GET ALL TOURS
// GET /api/admin/tours
// Optional query: page, limit, status, destinationId, search
// --------------------------------------------------
export const getAllTours = async (req, res, next) => {
  try {
    if (!isAdmin(req, res)) return;

    const { page, limit, skip } = getPagination(req.query);

    const filter = {};

    if (req.query.status) {
      filter.status = req.query.status;
    }

    if (req.query.destinationId) {
      if (!mongoose.isValidObjectId(req.query.destinationId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid destination ID",
        });
      }

      filter.destinationId = req.query.destinationId;
    }

    if (req.query.search) {
      const search = req.query.search.trim();

      if (search) {
        filter.title = {
          $regex: search,
          $options: "i",
        };
      }
    }

    const [tours, total] = await Promise.all([
      Tour.find(filter)
        .populate("operatorId", "name email")
        .populate("destinationId", "name country")
        .populate("categoryId", "name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      Tour.countDocuments(filter),
    ]);

    return res.status(200).json({
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

// --------------------------------------------------
// 8. UPDATE TOUR STATUS
// PATCH /api/admin/tours/:tourId/status
// Body: { "status": "published" }
// --------------------------------------------------
export const updateTourStatus = async (req, res, next) => {
  try {
    if (!isAdmin(req, res)) return;

    const { tourId } = req.params;
    const { status } = req.body;

    if (!mongoose.isValidObjectId(tourId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid tour ID",
      });
    }

    const allowedStatuses = [
      "draft",
      "pending",
      "published",
      "rejected",
      "archived",
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid tour status",
        allowedStatuses,
      });
    }

    const tour = await Tour.findById(tourId).select(
      "_id title operatorId"
    );

    if (!tour) {
      return res.status(404).json({
        success: false,
        message: "Tour not found",
      });
    }

    tour.status = status;
    await tour.save();

    await createAdminActionNotification({
      userId: tour.operatorId,
      type:
        status === "published"
          ? "tour_published"
          : status === "rejected"
            ? "tour_rejected"
            : "general",
      title: "Tour Status Updated",
      message: `The status of your tour "${tour.title}" has been changed to "${status}" by a Tripora administrator.`,
    });

    return res.status(200).json({
      success: true,
      message: "Tour status updated successfully",
      data: tour,
    });
  } catch (error) {
    next(error);
  }
};

// --------------------------------------------------
// 9. GET ALL BOOKINGS
// GET /api/admin/bookings
// Optional query: page, limit, status, userId
// --------------------------------------------------
export const getAllBookings = async (req, res, next) => {
  try {
    if (!isAdmin(req, res)) return;

    const { page, limit, skip } = getPagination(req.query);

    const filter = {};

    if (req.query.status) {
      filter.status = req.query.status;
    }

    if (req.query.userId) {
      if (!mongoose.isValidObjectId(req.query.userId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid user ID",
        });
      }

      filter.userId = req.query.userId;
    }

    const [bookings, total] = await Promise.all([
      Booking.find(filter)
        .populate("userId", "name email")
        .populate("operatorId", "name email")
        .populate("tourId", "title basePrice")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      Booking.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: bookings,
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

// --------------------------------------------------
// 10. GET ALL PAYMENTS
// GET /api/admin/payments
// Optional query: page, limit, status, bookingId
// --------------------------------------------------
export const getAllPayments = async (req, res, next) => {
  try {
    if (!isAdmin(req, res)) return;

    const { page, limit, skip } = getPagination(req.query);

    const filter = {};

    if (req.query.status) {
      filter.status = req.query.status;
    }
    if (req.query.status) {
      filter.status = req.query.status;
    }

    if (req.query.bookingId) {
      if (!mongoose.isValidObjectId(req.query.bookingId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid booking ID",
        });
      }

      filter.bookingId = req.query.bookingId;
    }

    const [payments, total] = await Promise.all([
      Payment.find(filter)
        .populate("bookingId")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      Payment.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: payments,
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

// --------------------------------------------------
// 11. GET OPERATOR PAYOUTS
// GET /api/admin/payouts
// Optional query: page, limit, status, operatorId
// --------------------------------------------------
export const getAllPayouts = async (req, res, next) => {
  try {
    if (!isAdmin(req, res)) return;

    const { page, limit, skip } = getPagination(req.query);

    const filter = {};

    if (req.query.status) {
      filter.status = req.query.status;
    }

    if (req.query.operatorId) {
      if (!mongoose.isValidObjectId(req.query.operatorId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid operator ID",
        });
      }

      filter.operatorId = req.query.operatorId;
    }

    const [payouts, total] = await Promise.all([
      OperatorPayout.find(filter)
        .populate("operatorId", "name email")
        .populate("bookingId")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      OperatorPayout.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: payouts,
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

// --------------------------------------------------
// 12. ADMIN REPORTS
// GET /api/admin/reports?from=2026-10-01&to=2026-10-31
// --------------------------------------------------
export const getAdminReports = async (req, res, next) => {
  try {
    if (!isAdmin(req, res)) return;

    const { from, to } = req.query;

    const dateFilter = {};

    if (from) {
      const startDate = new Date(from);

      if (Number.isNaN(startDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid from date",
        });
      }

      startDate.setHours(0, 0, 0, 0);
      dateFilter.$gte = startDate;
    }

    if (to) {
      const endDate = new Date(to);

      if (Number.isNaN(endDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid to date",
        });
      }

      endDate.setHours(23, 59, 59, 999);
      dateFilter.$lte = endDate;
    }

    if (
      from &&
      to &&
      dateFilter.$gte &&
      dateFilter.$lte &&
      dateFilter.$gte > dateFilter.$lte
    ) {
      return res.status(400).json({
        success: false,
        message: "The from date must be before the to date",
      });
    }

    const bookingFilter = {};
    const paymentFilter = {};

    if (Object.keys(dateFilter).length) {
      bookingFilter.createdAt = dateFilter;
      paymentFilter.createdAt = dateFilter;
    }

    const [
      bookingsByStatus,
      paymentsByStatus,
      bookingRevenue,
      payoutTotals,
      topTours,
    ] = await Promise.all([
      Booking.aggregate([
        {
          $match: bookingFilter,
        },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ]),

      Payment.aggregate([
        {
          $match: paymentFilter,
        },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
            amount: { $sum: "$amount" },
          },
        },
      ]),

      Payment.aggregate([
        {
          $match: {
            ...paymentFilter,
            status: "paid",
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$amount" },
            transactions: { $sum: 1 },
          },
        },
      ]),

      OperatorPayout.aggregate([
        {
          $match: {
            ...(Object.keys(dateFilter).length
              ? { createdAt: dateFilter }
              : {}),
            status: "paid",
          },
        },
        {
          $group: {
            _id: null,
            totalPaid: { $sum: "$netAmount" },
            commission: { $sum: "$commission" },
          },
        },
      ]),

      Booking.aggregate([
        {
          $match: bookingFilter,
        },
        {
          $group: {
            _id: "$tourId",
            bookings: { $sum: 1 },
          },
        },
        {
          $sort: { bookings: -1 },
        },
        {
          $limit: 5,
        },
        {
          $lookup: {
            from: Tour.collection.name,
            localField: "_id",
            foreignField: "_id",
            as: "tour",
          },
        },
        {
          $unwind: {
            path: "$tour",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $project: {
            _id: 1,
            bookings: 1,
            title: "$tour.title",
          },
        },
      ]),
    ]);

    return res.status(200).json({
      success: true,
      message: "Admin reports generated successfully",
      filters: {
        from: from || null,
        to: to || null,
      },
      data: {
        bookingsByStatus,
        paymentsByStatus,
        revenue: {
          grossPaymentAmount: bookingRevenue[0]?.total || 0,
          successfulTransactions:
            bookingRevenue[0]?.transactions || 0,
        },
        payouts: {
          totalPaid: payoutTotals[0]?.totalPaid || 0,
          commission: payoutTotals[0]?.commission || 0,
        },
        topTours,
      },
    });
  } catch (error) {
    next(error);
  }
};

// --------------------------------------------------
// 13. DELETE TOUR BY ADMIN
// DELETE /api/admin/tours/:tourId
// Sends an email to the tour's operator.
// --------------------------------------------------
export const deleteAdminTour = async (req, res, next) => {
  try {
    if (!isAdmin(req, res)) return;

    const { tourId } = req.params;

    if (!mongoose.isValidObjectId(tourId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid tour ID",
      });
    }

    // Fetch the operator's details before deleting the tour.
    const tour = await Tour.findById(tourId)
      .select("_id title operatorId")
      .populate("operatorId", "name firstName email");

    if (!tour) {
      return res.status(404).json({
        success: false,
        message: "Tour not found",
      });
    }

    const operator = tour.operatorId;
    const tourTitle = tour.title;
    const deletedTourId = String(tour._id);

    // Delete the tour.
    await Tour.deleteOne({
      _id: tour._id,
    });

    // Create in-app notification for the operator.
    if (operator?._id) {
      await createAdminActionNotification({
        userId: operator._id,
        type: "general",
        title: "Tour Removed by Tripora Admin",
        message: `Your tour "${tourTitle}" was removed by a Tripora administrator.`,
        relatedTourId: tour._id,
      });
    }

    // Send email to the operator.
    if (operator?.email) {
      const firstName = getFirstName(operator);

      const emailMessage =
        `Your tour "${tourTitle}" has been removed by a Tripora administrator. ` +
        "Please contact Tripora support if you need further information.";

      const emailHtml = notificationTemplate({
        firstName,
        title: "Tour Removed by Tripora Admin",
        message: emailMessage,
      });

      await sendAdminActionEmail({
        to: operator.email,
        subject: `Tripora Tour Removed: ${tourTitle}`,
        text: `Hello ${firstName},\n\n${emailMessage}`,
        html: emailHtml,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Tour deleted successfully",
      data: {
        tourId: deletedTourId,
      },
    });
  } catch (error) {
    next(error);
  }
};