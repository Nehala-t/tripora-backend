
import mongoose from "mongoose";
import { randomBytes } from "node:crypto";

import Booking from "../models/Booking.js";
import Tour from "../models/Tour.js";
import AvailabilitySlot from "../models/AvailabilitySlot.js";
import HttpError from "../utils/httpError.js";
import { createNotification } from "../utils/notificationService.js";

// ==================================================
// HELPERS
// ==================================================

const getUserId = (req) =>
  req.user?._id ||
  req.user?.id ||
  req.user?.user_id ||
  req.user?.userId;

const isValidId = (id) =>
  typeof id === "string" &&
  mongoose.Types.ObjectId.isValid(id);

const requireRole = (req, next, roles) => {
  if (!req.user) {
    next(new HttpError("Authentication required", 401));
    return false;
  }

  if (!roles.includes(req.user.role)) {
    next(
      new HttpError(
        `Only ${roles.join(" or ")} can perform this action`,
        403
      )
    );
    return false;
  }

  if (!getUserId(req)) {
    next(
      new HttpError("User ID not found in authentication token", 401)
    );
    return false;
  }

  return true;
};

const generateBookingReference = () =>
  `TRP-${randomBytes(6).toString("hex").toUpperCase()}`;

const parseParticipants = (value) => {
  if (
    value === undefined ||
    value === null ||
    value === "" ||
    typeof value === "boolean"
  ) {
    throw new HttpError("Participants is required", 400);
  }

  const participants = Number(value);

  if (!Number.isSafeInteger(participants) || participants < 1) {
    throw new HttpError(
      "Participants must be a positive whole number",
      400
    );
  }

  return participants;
};

// Accepts a date-only value such as 2027-01-12.
const parseTravelDate = (value) => {
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpError("Travel date is required", 400);
  }

  const dateValue = value.trim();

  // Prefer strict YYYY-MM-DD input from the frontend date picker.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    throw new HttpError(
      "Travel date must use YYYY-MM-DD format",
      400
    );
  }

  const date = new Date(`${dateValue}T00:00:00.000Z`);

  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== dateValue
  ) {
    throw new HttpError("Invalid travel date", 400);
  }

  return date;
};

const getUtcDayStart = (date) => {
  const result = new Date(date);
  result.setUTCHours(0, 0, 0, 0);
  return result;
};

const getUtcDayEnd = (date) => {
  const result = new Date(date);
  result.setUTCHours(23, 59, 59, 999);
  return result;
};

const isTravelDateInSlot = (travelDate, slot) => {
  const selectedDay = getUtcDayStart(travelDate);
  const slotStartDay = getUtcDayStart(slot.startAt);
  const slotEndDay = getUtcDayStart(slot.endAt);

  return (
    selectedDay >= slotStartDay &&
    selectedDay <= slotEndDay
  );
};

const validateCancellationReason = (value = "") => {
  if (typeof value !== "string") {
    throw new HttpError(
      "Cancellation reason must be text",
      400
    );
  }

  const reason = value.trim();

  if (reason.length > 500) {
    throw new HttpError(
      "Cancellation reason cannot exceed 500 characters",
      400
    );
  }

  return reason;
};

const getBookingForOperator = async (bookingId, operatorId) => {
  if (!isValidId(bookingId)) {
    throw new HttpError("Invalid booking ID", 400);
  }

  const booking = await Booking.findOne({
    _id: bookingId,
    operatorId,
  });

  if (!booking) {
    throw new HttpError("Booking not found", 404);
  }

  return booking;
};

// ==================================================
// NOTIFICATION HELPER
// ==================================================

const notifySafely = async (notificationData) => {
  try {
    await createNotification(notificationData);
  } catch (error) {
    console.error(
      "Failed to create notification:",
      error.message
    );
  }
};

// ==================================================
// RELEASE RESERVED CAPACITY
// ==================================================

const releaseReservedCapacity = async (booking) => {
  const slot = await AvailabilitySlot.findOneAndUpdate(
    {
      _id: booking.availabilitySlotId,
      reservedCount: { $gte: booking.participants },
    },
    {
      $inc: {
        reservedCount: -booking.participants,
      },
    },
    { new: true }
  );

  if (!slot) {
    throw new HttpError(
      "Could not release reserved capacity. Please check the slot reservation count.",
      409
    );
  }

  if (
    slot.status !== "blocked" &&
    slot.status !== "cancelled" &&
    !slot.isBlockedDate
  ) {
    slot.status =
      slot.reservedCount >= slot.capacity
        ? "full"
        : "available";

    await slot.save();
  }
};

// ==================================================
// 1. CREATE BOOKING
// POST /api/bookings
// ==================================================


export const createBooking = async (req, res, next) => {
  let reservedSlotId = null;
  let reservedParticipants = 0;

  try {
    if (!requireRole(req, next, ["user"])) return;

    const userId = getUserId(req);

    const {
      tourId,
      availabilitySlotId,
      travelDate,
      participants,
      travelerDetails,
      specialRequests = "",
    } = req.body || {};

    // Validate tour ID
    if (!isValidId(tourId)) {
      throw new HttpError("A valid tourId is required", 400);
    }

    // Validate availability slot ID
    if (!isValidId(availabilitySlotId)) {
      throw new HttpError(
        "A valid availabilitySlotId is required",
        400
      );
    }

    // Validate selected travel date
    const selectedTravelDate = parseTravelDate(travelDate);
    const selectedDayStart = getUtcDayStart(selectedTravelDate);
    const selectedDayEnd = getUtcDayEnd(selectedTravelDate);

    // Do not allow bookings for past or current dates
    // if (selectedDayStart <= getUtcDayStart(new Date())) {
    //   throw new HttpError(
    //     "Please select a future travel date",
    //     400
    //   );
    // }

    // Validate participants
    const participantCount = parseParticipants(participants);

    // Validate traveler details
    if (
      !travelerDetails ||
      typeof travelerDetails !== "object" ||
      Array.isArray(travelerDetails)
    ) {
      throw new HttpError(
        "Traveler details are required",
        400
      );
    }

    const fullName = String(
      travelerDetails.fullName || ""
    ).trim();

    const email = String(
      travelerDetails.email || ""
    ).trim().toLowerCase();

    const phone = String(
      travelerDetails.phone || ""
    ).trim();

    if (!fullName || !email || !phone) {
      throw new HttpError(
        "Traveler full name, email and phone are required",
        400
      );
    }

    if (fullName.length > 100 || phone.length > 25) {
      throw new HttpError(
        "Traveler name or phone exceeds the allowed length",
        400
      );
    }

    // Validate email
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new HttpError(
        "Enter a valid traveler email",
        400
      );
    }

    // Validate special requests
    if (typeof specialRequests !== "string") {
      throw new HttpError(
        "Special requests must be text",
        400
      );
    }

    if (specialRequests.trim().length > 1000) {
      throw new HttpError(
        "Special requests cannot exceed 1000 characters",
        400
      );
    }

    // Find published tour
    const tour = await Tour.findOne({
      _id: tourId,
      status: "published",
      isDeleted: { $ne: true },
    });

    if (!tour) {
      throw new HttpError("Published tour not found", 404);
    }

    // Validate participant limits
    const minParticipants = tour.minParticipants || 1;
    const maxParticipants = tour.maxParticipants || 10;

    if (
      participantCount < minParticipants ||
      participantCount > maxParticipants
    ) {
      throw new HttpError(
        `Participants must be between ${minParticipants} and ${maxParticipants}`,
        400
      );
    }

    // Check whether selected date is inside the availability range
    const existingSlot = await AvailabilitySlot.findOne({
      _id: availabilitySlotId,
      tourId: tour._id,
      status: "available",
      isBlockedDate: { $ne: true },
      startAt: { $lte: selectedDayEnd },
      endAt: { $gte: selectedDayStart },
    });

    if (!existingSlot) {
      throw new HttpError(
        "The selected date is not available for this tour",
        409
      );
    }

    if (!isTravelDateInSlot(selectedTravelDate, existingSlot)) {
      throw new HttpError(
        "The selected date is outside the availability period",
        400
      );
    }

    // Reserve seats atomically to prevent overbooking.
    // Capacity belongs to the entire availability slot.
    const slot = await AvailabilitySlot.findOneAndUpdate(
      {
        _id: availabilitySlotId,
        tourId: tour._id,
        status: "available",
        isBlockedDate: { $ne: true },
        startAt: { $lte: selectedDayEnd },
        endAt: { $gte: selectedDayStart },
        $expr: {
          $gte: [
            { $subtract: ["$capacity", "$reservedCount"] },
            participantCount,
          ],
        },
      },
      {
        $inc: {
          reservedCount: participantCount,
        },
      },
      { new: true }
    );

    if (!slot) {
      throw new HttpError(
        "This availability period is no longer available or does not have enough capacity",
        409
      );
    }

    reservedSlotId = slot._id;
    reservedParticipants = participantCount;

    // Mark slot as full when capacity is reached
    if (slot.reservedCount >= slot.capacity) {
      await AvailabilitySlot.updateOne(
        { _id: slot._id, status: "available" },
        { $set: { status: "full" } }
      );
    }

    // Calculate price using database values
    const pricePerParticipant = Number(slot.price);
    const totalPrice = pricePerParticipant * participantCount;

    if (
      !Number.isFinite(pricePerParticipant) ||
      pricePerParticipant < 0 ||
      !Number.isFinite(totalPrice)
    ) {
      throw new HttpError(
        "Invalid tour availability price",
        400
      );
    }

    // Create booking with pending status
    const booking = await Booking.create({
      bookingReference: generateBookingReference(),

      userId,
      operatorId: tour.operatorId,
      tourId: tour._id,
      availabilitySlotId: slot._id,

      // Actual date selected by customer
      travelDate: selectedTravelDate,

      travelerDetails: {
        fullName,
        email,
        phone,
      },

      participants: participantCount,
      specialRequests: specialRequests.trim(),

      pricePerParticipant,
      totalPrice,

      currency: slot.currency || tour.currency || "INR",

      // Payment is separate from booking approval
      paymentStatus: "pending",
      paymentMethod: "none",
      paymentId: null,

      // Operator must approve the booking
      status: "pending",
      confirmedAt: null,
    });

    // Booking created successfully; no rollback needed
    reservedSlotId = null;
    reservedParticipants = 0;

    // Notify customer
    await notifySafely({
      userId: booking.userId,
      type: "booking_created",
      title: "Booking request received",
      message: `Your booking ${booking.bookingReference} has been submitted and is awaiting operator approval.`,
      relatedBookingId: booking._id,
    });

    // Notify operator
    await notifySafely({
      userId: booking.operatorId,
      type: "booking_created",
      title: "New booking request",
      message: `You have received a new booking request: ${booking.bookingReference}. Please review it.`,
      relatedBookingId: booking._id,
    });

    return res.status(201).json({
      success: true,
      message:
        "Booking request submitted successfully. Waiting for operator approval.",
      booking,
    });
  } catch (error) {
    // Roll back reserved seats if booking creation fails
    if (reservedSlotId && reservedParticipants > 0) {
      try {
        const slot = await AvailabilitySlot.findByIdAndUpdate(
          reservedSlotId,
          {
            $inc: {
              reservedCount: -reservedParticipants,
            },
          },
          { new: true }
        );

        if (
          slot &&
          slot.status !== "blocked" &&
          slot.status !== "cancelled" &&
          !slot.isBlockedDate
        ) {
          slot.status =
            slot.reservedCount >= slot.capacity
              ? "full"
              : "available";

          await slot.save();
        }
      } catch (rollbackError) {
        console.error(
          "Failed to roll back slot reservation:",
          rollbackError.message
        );
      }
    }

    next(error);
  }
};


// ==================================================
// 2. GET MY BOOKING HISTORY
// GET /api/bookings/my-bookings
// ==================================================

export const getMyBookings = async (req, res, next) => {
  try {
    if (!requireRole(req, next, ["user"])) return;

    const page = Math.max(
      1,
      Number.parseInt(req.query.page, 10) || 1
    );

    const limit = Math.min(
      100,
      Math.max(1, Number.parseInt(req.query.limit, 10) || 10)
    );

    const filter = {
      userId: getUserId(req),
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
        throw new HttpError("Invalid booking status", 400);
      }

      filter.status = req.query.status;
    }

    const [bookings, total] = await Promise.all([
      Booking.find(filter)
        .populate("tourId", "title slug images destinationId")
        .populate(
          "availabilitySlotId",
          "startAt endAt status"
        )
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),

      Booking.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      count: bookings.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      bookings,
    });
  } catch (error) {
    next(error);
  }
};

// ==================================================
// 3. GET ONE BOOKING
// GET /api/bookings/:id
// ==================================================

export const getBookingById = async (req, res, next) => {
  try {
    if (!requireRole(req, next, ["user", "operator", "admin"])) {
      return;
    }

    if (!isValidId(req.params.id)) {
      throw new HttpError("Invalid booking ID", 400);
    }

    const filter = { _id: req.params.id };

    if (req.user.role === "user") {
      filter.userId = getUserId(req);
    } else if (req.user.role === "operator") {
      filter.operatorId = getUserId(req);
    }

    const booking = await Booking.findOne(filter)
      .populate("tourId", "title slug images destinationId")
      .populate(
        "availabilitySlotId",
        "startAt endAt status"
      )
      .populate("userId", "name email");

    if (!booking) {
      throw new HttpError("Booking not found", 404);
    }

    return res.status(200).json({
      success: true,
      booking,
    });
  } catch (error) {
    next(error);
  }
};

// ==================================================
// 4. CANCEL MY BOOKING
// PATCH /api/bookings/:id/cancel
// ==================================================

export const cancelBooking = async (req, res, next) => {
  try {
    if (!requireRole(req, next, ["user"])) return;

    if (!isValidId(req.params.id)) {
      throw new HttpError("Invalid booking ID", 400);
    }

    const reason = validateCancellationReason(
      req.body?.cancellationReason ?? ""
    );

    const booking = await Booking.findOne({
      _id: req.params.id,
      userId: getUserId(req),
    });

    if (!booking) {
      throw new HttpError("Booking not found", 404);
    }

    if (!["pending", "confirmed"].includes(booking.status)) {
      throw new HttpError(
        "Only pending or confirmed bookings can be cancelled",
        400
      );
    }

    // Cancellation is based on the customer's selected travel date.
    const travelDayStart = getUtcDayStart(booking.travelDate);

    if (travelDayStart <= getUtcDayStart(new Date())) {
      throw new HttpError(
        "Bookings cannot be cancelled on or after the travel date",
        400
      );
    }

    // Conditional update prevents duplicate cancellations.
    const updatedBooking = await Booking.findOneAndUpdate(
      {
        _id: booking._id,
        userId: getUserId(req),
        status: { $in: ["pending", "confirmed"] },
      },
      {
        $set: {
          status: "cancelled",
          cancellationReason: reason,
          cancelledAt: new Date(),
        },
      },
      { new: true }
    );

    if (!updatedBooking) {
      throw new HttpError(
        "Booking has already been updated",
        409
      );
    }

    await releaseReservedCapacity(updatedBooking);

    await notifySafely({
      userId: updatedBooking.operatorId,
      type: "booking_cancelled",
      title: "Booking cancelled",
      message:
        `The traveler cancelled booking ${updatedBooking.bookingReference}.`,
      relatedBookingId: updatedBooking._id,
    });

    return res.status(200).json({
      success: true,
      message: "Booking cancelled successfully",
      booking: updatedBooking,
    });
  } catch (error) {
    next(error);
  }
};

// ==================================================
// 5. OPERATOR BOOKING LIST
// GET /api/bookings/operator
// ==================================================

export const getOperatorBookings = async (req, res, next) => {
  try {
    if (!requireRole(req, next, ["operator"])) return;

    const page = Math.max(
      1,
      Number.parseInt(req.query.page, 10) || 1
    );

    const limit = Math.min(
      100,
      Math.max(1, Number.parseInt(req.query.limit, 10) || 10)
    );

    const filter = {
      operatorId: getUserId(req),
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
        throw new HttpError("Invalid booking status", 400);
      }

      filter.status = req.query.status;
    }

    const [bookings, total] = await Promise.all([
      Booking.find(filter)
        .populate("tourId", "title slug")
        .populate(
          "availabilitySlotId",
          "startAt endAt status"
        )
        .populate("userId", "name email")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),

      Booking.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      count: bookings.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      bookings,
    });
  } catch (error) {
    next(error);
  }
};

// ==================================================
// 6. OPERATOR MANAGES BOOKING STATUS
// PATCH /api/bookings/:id/status
// ==================================================

export const manageOperatorBooking = async (req, res, next) => {
  try {
    if (!requireRole(req, next, ["operator"])) return;

    const booking = await getBookingForOperator(
      req.params.id,
      getUserId(req)
    );

    const {
      status,
      cancellationReason = "",
    } = req.body || {};

    if (!["confirmed", "rejected", "completed"].includes(status)) {
      throw new HttpError(
        "Status must be confirmed, rejected, or completed",
        400
      );
    }

    // Confirm a pending booking.
    if (status === "confirmed") {
      if (booking.status !== "pending") {
        throw new HttpError(
          "Only pending bookings can be confirmed",
          400
        );
      }

      const slot = await AvailabilitySlot.findById(
        booking.availabilitySlotId
      );

      if (
        !slot ||
        slot.status === "blocked" ||
        slot.status === "cancelled" ||
        slot.isBlockedDate ||
        !isTravelDateInSlot(booking.travelDate, slot) ||
        getUtcDayStart(booking.travelDate) <= getUtcDayStart(new Date())
      ) {
        throw new HttpError(
          "The selected travel date is no longer available for confirmation",
          409
        );
      }

      booking.status = "confirmed";
      booking.confirmedAt = new Date();
    }

    // Reject a pending booking.
    if (status === "rejected") {
      if (booking.status !== "pending") {
        throw new HttpError(
          "Only pending bookings can be rejected",
          400
        );
      }

      booking.cancellationReason =
        validateCancellationReason(cancellationReason);

      booking.status = "rejected";
    }

    // Complete a confirmed booking after the selected travel date ends.
    if (status === "completed") {
      if (booking.status !== "confirmed") {
        throw new HttpError(
          "Only confirmed bookings can be completed",
          400
        );
      }

      const travelDayEnd = getUtcDayEnd(booking.travelDate);

      if (new Date() <= travelDayEnd) {
        throw new HttpError(
          "A booking can be completed only after its selected travel date has ended",
          400
        );
      }

      booking.status = "completed";
    }

    await booking.save();

    // Rejected bookings release their reserved seats.
    if (status === "rejected") {
      await releaseReservedCapacity(booking);
    }

    const notificationByStatus = {
      confirmed: {
        type: "booking_confirmed",
        title: "Your booking is confirmed!",
        message:
          `The operator confirmed your Tripora booking (${booking.bookingReference}).`,
      },

      rejected: {
        type: "booking_rejected",
        title: "Booking request declined",
        message: booking.cancellationReason
          ? `Your booking (${booking.bookingReference}) was declined. Reason: ${booking.cancellationReason}`
          : `Your booking (${booking.bookingReference}) was declined by the operator.`,
      },

      completed: {
        type: "booking_completed",
        title: "Tour completed",
        message:
          `Your tour booking (${booking.bookingReference}) is marked as completed. You can now share your review.`,
      },
    };

    await notifySafely({
      userId: booking.userId,
      ...notificationByStatus[status],
      relatedBookingId: booking._id,
    });

    return res.status(200).json({
      success: true,
      message: `Booking ${status} successfully`,
      booking,
    });
  } catch (error) {
    next(error);
  }
};
