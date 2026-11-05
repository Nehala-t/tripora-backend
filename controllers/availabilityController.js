import mongoose from "mongoose";
import AvailabilitySlot from "../models/AvailabilitySlot.js";
import Tour from "../models/Tour.js";
import Notification from "../models/Notification.js";
import HttpError from "../utils/httpError.js";

// --------------------------------------------------
// HELPERS
// --------------------------------------------------

const getUserId = (req) =>
  req.user?._id ||
  req.user?.id ||
  req.user?.user_id ||
  req.user?.userId;

const checkOperatorRole = (req, next) => {
  if (req.user?.role !== "operator") {
    next(new HttpError("Only operators can manage availability", 403));
    return false;
  }

  if (!getUserId(req)) {
    next(new HttpError("User ID not found in authentication token", 401));
    return false;
  }

  return true;
};

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

const parseDate = (value, fieldName) => {
  const date = new Date(value);

  if (!value || Number.isNaN(date.getTime())) {
    throw new HttpError(`A valid ${fieldName} is required`, 400);
  }

  return date;
};

const parsePositiveNumber = (value, fieldName, allowZero = false) => {
  if (
    value === undefined ||
    value === null ||
    value === "" ||
    typeof value === "boolean"
  ) {
    throw new HttpError(`${fieldName} is required`, 400);
  }

  const number = Number(value);

  if (
    !Number.isFinite(number) ||
    (allowZero ? number < 0 : number < 1)
  ) {
    throw new HttpError(
      `${fieldName} must be a valid ${
        allowZero ? "non-negative" : "positive"
      } number`,
      400
    );
  }

  return number;
};

// --------------------------------------------------
// CREATE NOTIFICATION
// --------------------------------------------------

const createAvailabilityNotification = async ({
  userId,
  type,
  title,
  message,
}) => {
  try {
    await Notification.create({
      userId,
      type,
      title,
      message,
    });
  } catch (error) {
    // Do not make a successful slot operation fail
    // just because notification creation failed.
    console.error("Availability notification failed:", error);
  }
};

// --------------------------------------------------
// GET OPERATOR'S TOUR
// --------------------------------------------------

const getOwnedTour = async (tourId, operatorId) => {
  if (!isValidId(tourId)) {
    throw new HttpError("Invalid tour ID", 400);
  }

  const tour = await Tour.findOne({
    _id: tourId,
    operatorId,
    isDeleted: { $ne: true },
  });

  if (!tour) {
    throw new HttpError(
      "Tour not found or you do not own this tour",
      404
    );
  }

  return tour;
};

// --------------------------------------------------
// GET OWNED, NON-DELETED SLOT
// --------------------------------------------------

const getOwnedSlot = async (slotId, operatorId) => {
  if (!isValidId(slotId)) {
    throw new HttpError("Invalid availability slot ID", 400);
  }

  const slot = await AvailabilitySlot.findOne({
    _id: slotId,
    isDeleted: { $ne: true },
  });

  if (!slot) {
    throw new HttpError("Availability slot not found", 404);
  }

  await getOwnedTour(slot.tourId, operatorId);

  return slot;
};

// --------------------------------------------------
// 1. CREATE AVAILABILITY SLOT
// POST /api/availability
// --------------------------------------------------

export const createAvailabilitySlot = async (req, res, next) => {
  try {
    if (!checkOperatorRole(req, next)) return;

    const {
      tourId,
      startAt,
      endAt,
      capacity,
      price,
      currency,
    } = req.body || {};

    const operatorId = getUserId(req);

    await getOwnedTour(tourId, operatorId);

    const startDate = parseDate(startAt, "startAt");
    const endDate = parseDate(endAt, "endAt");

    const parsedCapacity = parsePositiveNumber(capacity, "capacity");
    const parsedPrice = parsePositiveNumber(price, "price", true);

    if (endDate <= startDate) {
      throw new HttpError("endAt must be after startAt", 400);
    }

    if (startDate <= new Date()) {
      throw new HttpError("The slot must start in the future", 400);
    }

    const parsedCurrency = currency
      ? String(currency).toUpperCase()
      : "INR";

    if (!["INR", "USD", "EUR", "GBP", "AED"].includes(parsedCurrency)) {
      throw new HttpError("Unsupported currency", 400);
    }

    // Prevent overlapping non-deleted slots for the same tour.
    const overlappingSlot = await AvailabilitySlot.findOne({
      tourId,
      isDeleted: { $ne: true },
      status: { $nin: ["cancelled"] },
      startAt: { $lt: endDate },
      endAt: { $gt: startDate },
    });

    if (overlappingSlot) {
      throw new HttpError(
        "This time overlaps an existing availability slot",
        409
      );
    }

    const slot = await AvailabilitySlot.create({
      tourId,
      startAt: startDate,
      endAt: endDate,
      capacity: parsedCapacity,
      reservedCount: 0,
      price: parsedPrice,
      currency: parsedCurrency,
      status: "available",
      isBlockedDate: false,
      isDeleted: false,
      createdBy: operatorId,
    });

    // Notify the operator after the slot is created.
    await createAvailabilityNotification({
      userId: operatorId,
      type: "availability_created",
      title: "Availability Slot Created",
      message: `Your availability slot has been created for ${startDate.toLocaleString()}.`,
    });

    return res.status(201).json({
      success: true,
      message: "Availability slot created successfully",
      slot,
    });
  } catch (error) {
    next(error);
  }
};

// --------------------------------------------------
// 2. GET AVAILABLE SLOTS FOR A TOUR
// GET /api/availability/tour/:tourId
// --------------------------------------------------


export const getTourAvailability = async (req, res, next) => {
  try {
    const { tourId } = req.params;

    if (!isValidId(tourId)) {
      throw new HttpError("Invalid tour ID", 400);
    }

    const tour = await Tour.findOne({
      _id: tourId,
      status: "published",
      isDeleted: { $ne: true },
    });

    if (!tour) {
      throw new HttpError("Published tour not found", 404);
    }

    const now = new Date();

    const filter = {
      tourId,
      status: "available",
      isDeleted: { $ne: true },
      isBlockedDate: { $ne: true },
      $expr: {
        $lt: ["$reservedCount", "$capacity"],
      },
      // The slot must not have ended yet.
      endAt: { $gt: now },
    };

    // Find slots that overlap the selected date range.
    if (req.query.from || req.query.to) {
      const from = req.query.from
        ? parseDate(req.query.from, "from")
        : now;

      const to = req.query.to
        ? parseDate(req.query.to, "to")
        : null;

      if (to && to <= from) {
        throw new HttpError(
          "The end date must be after the start date",
          400
        );
      }

      filter.startAt = {
        $lte: to || new Date("9999-12-31T23:59:59.999Z"),
      };

      filter.endAt = {
        $gte: from,
        $gt: now,
      };
    }

    const slots = await AvailabilitySlot.find(filter).sort({
      startAt: 1,
    });

    return res.status(200).json({
      success: true,
      count: slots.length,
      slots,
    });
  } catch (error) {
    next(error);
  }
};


// --------------------------------------------------
// 3. GET OPERATOR'S SLOTS
// GET /api/availability/operator/my-slots
// --------------------------------------------------

export const getOperatorAvailability = async (req, res, next) => {
  try {
    if (!checkOperatorRole(req, next)) return;

    const operatorId = getUserId(req);
    const {
      tourId,
      status,
      from,
      to,
      page = 1,
      limit = 10,
    } = req.query;

    const pageNumber = Math.max(1, Number(page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(limit) || 10));

    const tourFilter = {
      operatorId,
      isDeleted: { $ne: true },
    };

    if (tourId) {
      if (!isValidId(tourId)) {
        throw new HttpError("Invalid tour ID", 400);
      }

      tourFilter._id = tourId;
    }

    const tours = await Tour.find(tourFilter).select("_id");
    const tourIds = tours.map((tour) => tour._id);

    const filter = {
      tourId: { $in: tourIds },
      isDeleted: { $ne: true },
    };

    if (status) {
      if (
        !["available", "full", "blocked", "cancelled"].includes(status)
      ) {
        throw new HttpError("Invalid availability status", 400);
      }

      filter.status = status;
    }

    if (from || to) {
      filter.startAt = {};

      if (from) {
        filter.startAt.$gte = parseDate(from, "from");
      }

      if (to) {
        filter.startAt.$lte = parseDate(to, "to");
      }
    }

    const [slots, total] = await Promise.all([
      AvailabilitySlot.find(filter)
        .sort({ startAt: 1 })
        .skip((pageNumber - 1) * pageSize)
        .limit(pageSize),

      AvailabilitySlot.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      count: slots.length,
      total,
      page: pageNumber,
      pages: Math.ceil(total / pageSize),
      slots,
    });
  } catch (error) {
    next(error);
  }
};

// --------------------------------------------------
// 4. GET SLOT BY ID
// GET /api/availability/:id
// --------------------------------------------------

export const getAvailabilitySlotById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      throw new HttpError("Invalid availability slot ID", 400);
    }

    const slot = await AvailabilitySlot.findOne({
      _id: id,
      isDeleted: { $ne: true },
    });

    if (!slot) {
      throw new HttpError("Availability slot not found", 404);
    }

    const tour = await Tour.findOne({
      _id: slot.tourId,
      isDeleted: { $ne: true },
    });

    if (!tour) {
      throw new HttpError("Tour not found", 404);
    }

    const isOwner =
      req.user?.role === "operator" &&
      String(tour.operatorId) === String(getUserId(req));

    if (!isOwner && tour.status !== "published") {
      throw new HttpError("Availability slot not found", 404);
    }

    return res.status(200).json({
      success: true,
      slot,
    });
  } catch (error) {
    next(error);
  }
};

// --------------------------------------------------
// 5. CHECK REMAINING CAPACITY
// GET /api/availability/check/:id?participants=2
// --------------------------------------------------

export const checkAvailability = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      throw new HttpError("Invalid availability slot ID", 400);
    }

    const participants = parsePositiveNumber(
      req.query.participants ?? 1,
      "participants"
    );

    const slot = await AvailabilitySlot.findOne({
      _id: id,
      isDeleted: { $ne: true },
    });

    if (!slot) {
      throw new HttpError("Availability slot not found", 404);
    }

    const tour = await Tour.findOne({
      _id: slot.tourId,
      status: "published",
      isDeleted: { $ne: true },
    });

    if (!tour) {
      throw new HttpError("Published tour not found", 404);
    }

    const remainingCapacity = Math.max(
      0,
      slot.capacity - slot.reservedCount
    );

    const available =
      slot.status === "available" &&
      !slot.isBlockedDate &&
      slot.startAt > new Date() &&
      remainingCapacity >= participants;

    return res.status(200).json({
      success: true,
      available,
      requestedParticipants: participants,
      remainingCapacity,
      slot,
    });
  } catch (error) {
    next(error);
  }
};

// --------------------------------------------------
// 6. UPDATE SLOT
// PATCH /api/availability/:id
// --------------------------------------------------

export const updateAvailabilitySlot = async (req, res, next) => {
  try {
    if (!checkOperatorRole(req, next)) return;

    const slot = await getOwnedSlot(req.params.id, getUserId(req));
    const body = req.body || {};

    if (slot.status === "cancelled") {
      throw new HttpError("Cancelled slots cannot be updated", 400);
    }

    if (body.startAt !== undefined) {
      slot.startAt = parseDate(body.startAt, "startAt");
    }

    if (body.endAt !== undefined) {
      slot.endAt = parseDate(body.endAt, "endAt");
    }

    if (slot.endAt <= slot.startAt) {
      throw new HttpError("endAt must be after startAt", 400);
    }

    if (body.capacity !== undefined) {
      const capacity = parsePositiveNumber(body.capacity, "capacity");

      if (capacity < slot.reservedCount) {
        throw new HttpError(
          "Capacity cannot be lower than the number of existing reservations",
          400
        );
      }

      slot.capacity = capacity;
    }

    if (body.price !== undefined) {
      slot.price = parsePositiveNumber(body.price, "price", true);
    }

    if (body.currency !== undefined) {
      const currency = String(body.currency).toUpperCase();

      if (!["INR", "USD", "EUR", "GBP", "AED"].includes(currency)) {
        throw new HttpError("Unsupported currency", 400);
      }

      slot.currency = currency;
    }

    if (body.status !== undefined) {
      if (!["available", "blocked"].includes(body.status)) {
        throw new HttpError(
          "Use the block/unblock endpoints to change slot status",
          400
        );
      }

      slot.status = body.status;
      slot.isBlockedDate = body.status === "blocked";
    }

    if (body.blockedReason !== undefined) {
      slot.blockedReason = String(body.blockedReason).trim();
    }

    if (slot.startAt <= new Date()) {
      throw new HttpError("The slot must start in the future", 400);
    }

    // Prevent the updated slot from overlapping another active slot.
    const overlappingSlot = await AvailabilitySlot.findOne({
      _id: { $ne: slot._id },
      tourId: slot.tourId,
      isDeleted: { $ne: true },
      status: { $nin: ["cancelled"] },
      startAt: { $lt: slot.endAt },
      endAt: { $gt: slot.startAt },
    });

    if (overlappingSlot) {
      throw new HttpError(
        "This time overlaps an existing availability slot",
        409
      );
    }

    if (slot.isBlockedDate) {
      slot.status = "blocked";
    } else if (slot.reservedCount >= slot.capacity) {
      slot.status = "full";
    } else {
      slot.status = "available";
    }

    await slot.save();

    // Notify the operator after a successful update.
    await createAvailabilityNotification({
      userId: getUserId(req),
      type: "availability_updated",
      title: "Availability Slot Updated",
      message: `Your availability slot has been updated. New start time: ${slot.startAt.toLocaleString()}.`,
    });

    return res.status(200).json({
      success: true,
      message: "Availability slot updated successfully",
      slot,
    });
  } catch (error) {
    next(error);
  }
};

// --------------------------------------------------
// 7. BLOCK SLOT
// PATCH /api/availability/:id/block
// --------------------------------------------------

// --------------------------------------------------
// 7. BLOCK SLOT
// PATCH /api/availability/:id/block
// --------------------------------------------------

export const blockAvailabilitySlot = async (req, res, next) => {
  try {
    if (!checkOperatorRole(req, next)) return;

    const operatorId = getUserId(req);
    const slot = await getOwnedSlot(req.params.id, operatorId);

    if (slot.status === "cancelled") {
      throw new HttpError(
        "Cancelled slots cannot be blocked",
        400
      );
    }

    slot.status = "blocked";
    slot.isBlockedDate = true;
    slot.blockedReason = String(
      req.body?.blockedReason || ""
    ).trim();

    // Save the slot first.
    await slot.save();

    // Create notification after successfully blocking the slot.
    await createAvailabilityNotification({
      userId: operatorId,
      type: "availability_blocked",
      title: "Availability Slot Blocked",
      message: `Your availability slot scheduled for ${new Date(
        slot.startAt
      ).toLocaleString()} has been blocked.`,
    });

    return res.status(200).json({
      success: true,
      message: "Availability slot blocked successfully",
      slot,
    });
  } catch (error) {
    next(error);
  }
};

// --------------------------------------------------
// 8. UNBLOCK SLOT
// PATCH /api/availability/:id/unblock
// --------------------------------------------------

export const unblockAvailabilitySlot = async (req, res, next) => {
  try {
    if (!checkOperatorRole(req, next)) return;

    const operatorId = getUserId(req);
    const slot = await getOwnedSlot(req.params.id, operatorId);

    if (slot.status === "cancelled") {
      throw new HttpError(
        "Cancelled slots cannot be unblocked",
        400
      );
    }

    // Remove the block.
    slot.isBlockedDate = false;
    slot.blockedReason = "";

    // Restore the correct availability status.
    slot.status =
      slot.reservedCount >= slot.capacity
        ? "full"
        : "available";

    // Save the slot first.
    await slot.save();

    // Create notification after successfully unblocking the slot.
    await createAvailabilityNotification({
      userId: operatorId,
      type: "availability_unblocked",
      title: "Availability Slot Unblocked",
      message: `Your availability slot scheduled for ${new Date(
        slot.startAt
      ).toLocaleString()} is available again.`,
    });

    return res.status(200).json({
      success: true,
      message: "Availability slot unblocked successfully",
      slot,
    });
  } catch (error) {
    next(error);
  }
};

// --------------------------------------------------
// 9. SOFT DELETE SLOT
// DELETE /api/availability/:id
// --------------------------------------------------

export const deleteAvailabilitySlot = async (req, res, next) => {
  try {
    if (!checkOperatorRole(req, next)) return;

    const slot = await getOwnedSlot(req.params.id, getUserId(req));

    if (slot.reservedCount > 0) {
      throw new HttpError(
        "Cannot delete a slot with existing reservations. Block it instead.",
        400
      );
    }

    // Preserve the document in MongoDB.
    slot.isDeleted = true;
    await slot.save();

    // Notify the operator after the soft delete succeeds.
    await createAvailabilityNotification({
      userId: getUserId(req),
      type: "availability_deleted",
      title: "Availability Slot Deleted",
      message: `Your availability slot scheduled for ${slot.startAt.toLocaleString()} has been deleted.`,
    });

    return res.status(200).json({
      success: true,
      message: "Availability slot deleted successfully",
      data: {
        id: slot._id,
        isDeleted: slot.isDeleted,
      },
    });
  } catch (error) {
    next(error);
  }
};