
import mongoose from "mongoose";
import Tour from "../models/Tour.js";
import Destination from "../models/Destination.js";
import Category from "../models/Category.js";
import Notification from "../models/Notification.js";
import HttpError from "../utils/httpError.js";
import cloudinary from "../config/cloudinary.js";

// ==================================================
// TOUR NOTIFICATION HELPER
// ==================================================

const createTourNotification = async (
  operatorId,
  type,
  title,
  message
) => {
  try {
    if (!operatorId) {
      console.error(
        "Cannot create tour notification: operator ID missing"
      );
      return;
    }

    await Notification.create({
      userId: operatorId,
      type,
      title,
      message,
    });
  } catch (error) {
    console.error(
      "Tour notification creation failed:",
      error.message
    );
  }
};

// ==================================================
// HELPERS
// ==================================================

const checkOperatorRole = (req, next) => {
  if (!req.user || req.user.role !== "operator") {
    next(new HttpError("Access denied. Operator only.", 403));
    return false;
  }

  return true;
};

const getOperatorId = (req) =>
  req.user?.user_id ||
  req.user?._id ||
  req.user?.id ||
  req.user?.userId;

const isValidId = (id) =>
  typeof id === "string" &&
  mongoose.Types.ObjectId.isValid(id);

const generateSlug = (value) => {
  if (typeof value !== "string") return "";

  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
};

const escapeRegex = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parseJsonField = (value, fieldName) => {
  if (value === undefined || value === null || value === "") {
    return value;
  }

  if (typeof value !== "string") return value;

  try {
    return JSON.parse(value);
  } catch {
    throw new HttpError(
      `Invalid JSON format for ${fieldName}`,
      400
    );
  }
};

// Daily plans: time is optional.
const parseDays = (value) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const parsedDays = parseJsonField(value, "days");

  if (!Array.isArray(parsedDays)) {
    throw new HttpError("days must be an array", 400);
  }

  return parsedDays.map((day, index) => {
    if (!day || typeof day !== "object" || Array.isArray(day)) {
      throw new HttpError(
        `Day ${index + 1} must be an object`,
        400
      );
    }

    const title =
      typeof day.title === "string" ? day.title.trim() : "";

    const description =
      typeof day.description === "string"
        ? day.description.trim()
        : "";

    const time =
      typeof day.time === "string" ? day.time.trim() : "";

    if (!title || !description) {
      throw new HttpError(
        `Day ${index + 1} requires a title and description`,
        400
      );
    }

    return { title, description, time };
  });
};

const parseBoolean = (value, fieldName) => {
  if (value === undefined || value === null || value === "") {
    return value;
  }

  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;

  throw new HttpError(
    `${fieldName} must be true or false`,
    400
  );
};

const parseNumber = (value, fieldName) => {
  if (value === undefined || value === null || value === "") {
    return value;
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    throw new HttpError(
      `${fieldName} must be a valid number`,
      400
    );
  }

  return number;
};

const validateWhatsAppNumber = (value) => {
  if (
    typeof value !== "string" ||
    !/^\+[1-9]\d{7,14}$/.test(value.trim())
  ) {
    throw new HttpError(
      "Enter a valid WhatsApp number with country code, e.g. +919876543210",
      400
    );
  }

  return value.trim();
};

const deleteCloudinaryImages = async (images = []) => {
  const results = await Promise.allSettled(
    images
      .filter((image) => image?.publicId)
      .map((image) =>
        cloudinary.uploader.destroy(image.publicId)
      )
  );

  results.forEach((result) => {
    if (result.status === "rejected") {
      console.error(
        "Cloudinary image deletion failed:",
        result.reason
      );
    }
  });
};

const findTourById = async (id) =>
  Tour.findOne({
    _id: id,
    isDeleted: false,
  });

const checkTourOwner = (tour, req, next) => {
  if (String(tour.operatorId) !== String(getOperatorId(req))) {
    next(
      new HttpError(
        "You are not allowed to manage this tour",
        403
      )
    );

    return false;
  }

  return true;
};

const validateTourReferences = async (
  destinationId,
  categoryId
) => {
  if (!destinationId || !isValidId(String(destinationId))) {
    throw new HttpError(
      "A valid destinationId is required",
      400
    );
  }

  if (!categoryId || !isValidId(String(categoryId))) {
    throw new HttpError(
      "A valid categoryId is required",
      400
    );
  }

  const [destination, category] = await Promise.all([
    Destination.findOne({
      _id: destinationId,
      isDeleted: false,
      status: "active",
    }),

    Category.findOne({
      _id: categoryId,
      isDeleted: false,
      isActive: true,
    }),
  ]);

  if (!destination) {
    throw new HttpError("Active destination not found", 404);
  }

  if (!category) {
    throw new HttpError("Active category not found", 404);
  }
};

const parseTourNumberFields = (body, fields) => {
  const result = {};

  for (const field of fields) {
    if (body[field] !== undefined) {
      result[field] = parseNumber(body[field], field);
    }
  }

  return result;
};

const validateDuration = (durationDays, nights) => {
  if (!Number.isInteger(durationDays) || durationDays < 1) {
    throw new HttpError(
      "durationDays must be a positive whole number",
      400
    );
  }

  if (!Number.isInteger(nights) || nights < 0) {
    throw new HttpError(
      "nights must be a non-negative whole number",
      400
    );
  }

  if (nights > durationDays) {
    throw new HttpError(
      "Nights cannot exceed durationDays",
      400
    );
  }
};

const validateParticipantLimits = (
  minParticipants,
  maxParticipants
) => {
  if (
    !Number.isInteger(minParticipants) ||
    !Number.isInteger(maxParticipants) ||
    minParticipants < 1 ||
    maxParticipants < 1
  ) {
    throw new HttpError(
      "Participant limits must be positive whole numbers",
      400
    );
  }

  if (minParticipants > maxParticipants) {
    throw new HttpError(
      "minParticipants cannot exceed maxParticipants",
      400
    );
  }
};

const parseUploadedImages = (files = []) =>
  files.map((file) => ({
    url: file.path,
    publicId: file.filename,
  }));

const validateDaysCount = (days, durationDays) => {
  if ((days ?? []).length > durationDays) {
    throw new HttpError(
      "Number of daily plans cannot exceed durationDays",
      400
    );
  }
};

// ==================================================
// 1. BROWSE AND SEARCH PUBLISHED TOURS
// GET /api/tours
// ==================================================

export const getAllTours = async (req, res, next) => {
  try {
    const {
      search = "",
      destinationId,
      categoryId,
      minPrice,
      maxPrice,
      minDuration,
      maxDuration,
      difficultyLevel,
      language,
      date,
      participants,
      page = 1,
      limit = 9,
      sort = "newest",
    } = req.query;

    // 1. Validate pagination
    const pageNumber = Math.max(1, parseInt(page, 10) || 1);

    const limitNumber = Math.min(
      100,
      Math.max(1, parseInt(limit, 10) || 9)
    );

    const skip = (pageNumber - 1) * limitNumber;

    // 2. Base filter: only published, non-deleted tours
    const filter = {
      status: "published",
      isDeleted: false,
    };

    // 3. Search by title, description, highlights, or tags
    if (typeof search === "string" && search.trim()) {
      const regex = new RegExp(escapeRegex(search.trim()), "i");

      filter.$or = [
        { title: regex },
        { description: regex },
        { highlights: regex },
        { tags: regex },
      ];
    }

    // 4. Filter by destination
    if (destinationId) {
      if (!isValidId(destinationId)) {
        throw new HttpError("Invalid destinationId", 400);
      }

      filter.destinationId = destinationId;
    }

    // 5. Filter by activity category
    if (categoryId) {
      if (!isValidId(categoryId)) {
        throw new HttpError("Invalid categoryId", 400);
      }

      filter.categoryId = categoryId;
    }

    // 6. Filter by minimum and maximum price
    if (minPrice !== undefined || maxPrice !== undefined) {
      filter.basePrice = {};

      if (minPrice !== undefined) {
        filter.basePrice.$gte = parseNumber(minPrice, "minPrice");
      }

      if (maxPrice !== undefined) {
        filter.basePrice.$lte = parseNumber(maxPrice, "maxPrice");
      }

      if (
        filter.basePrice.$gte !== undefined &&
        filter.basePrice.$lte !== undefined &&
        filter.basePrice.$gte > filter.basePrice.$lte
      ) {
        throw new HttpError(
          "minPrice cannot exceed maxPrice",
          400
        );
      }
    }

    // 7. Filter by duration in days
    if (minDuration !== undefined || maxDuration !== undefined) {
      filter.durationDays = {};

      if (minDuration !== undefined) {
        filter.durationDays.$gte = parseNumber(
          minDuration,
          "minDuration"
        );
      }

      if (maxDuration !== undefined) {
        filter.durationDays.$lte = parseNumber(
          maxDuration,
          "maxDuration"
        );
      }

      if (
        filter.durationDays.$gte !== undefined &&
        filter.durationDays.$lte !== undefined &&
        filter.durationDays.$gte > filter.durationDays.$lte
      )

        if (maxDuration !== undefined) {
          filter.durationMinutes.$lte = parseNumber(
            maxDuration,
            "maxDuration"
          );
        }

      if (
        filter.durationMinutes.$gte !== undefined &&
        filter.durationMinutes.$lte !== undefined &&
        filter.durationMinutes.$gte > filter.durationMinutes.$lte
      ) {
        throw new HttpError(
          "minDuration cannot exceed maxDuration",
          400
        );
      }
    }

    // 8. Filter by difficulty level
    if (difficultyLevel) {
      const allowedDifficulties = [
        "easy",
        "moderate",
        "challenging",
      ];

      if (!allowedDifficulties.includes(difficultyLevel)) {
        throw new HttpError("Invalid difficultyLevel", 400);
      }

      filter.difficultyLevel = difficultyLevel;
    }

    // 9. Filter by language
    if (language) {
      if (typeof language !== "string" || !language.trim()) {
        throw new HttpError("Invalid language", 400);
      }

      filter.languages = {
        $regex: `^${escapeRegex(language.trim())}$`,
        $options: "i",
      };
    }

    // 10. Filter by number of participants
    if (participants !== undefined) {
      const count = parseNumber(participants, "participants");

      if (!Number.isInteger(count) || count < 1) {
        throw new HttpError(
          "participants must be a positive integer",
          400
        );
      }

      filter.minParticipants = { $lte: count };
      filter.maxParticipants = { $gte: count };
    }

    // 11. Validate date
    // Validation only; availability filtering requires schedule data.
    if (date) {
      if (
        typeof date !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(date)
      ) {
        throw new HttpError(
          "Date must use YYYY-MM-DD format",
          400
        );
      }

      const parsedDate = new Date(`${date}T00:00:00.000Z`);

      if (
        Number.isNaN(parsedDate.getTime()) ||
        parsedDate.toISOString().slice(0, 10) !== date
      ) {
        throw new HttpError("Invalid date", 400);
      }
    }

    // 12. Sorting
    const sortOptions = {
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      price_asc: { basePrice: 1 },
      price_desc: { basePrice: -1 },
      rating: { averageRating: -1, reviewCount: -1 },
      duration_asc: { durationMinutes: 1 },
    };

    if (!Object.prototype.hasOwnProperty.call(sortOptions, sort)) {
      throw new HttpError("Invalid sort option", 400);
    }

    const sortOption = sortOptions[sort];

    // 13. Fetch tours and total count
    const [tours, total] = await Promise.all([
      Tour.find(filter)
        .populate("destinationId", "name country slug")
        .populate("categoryId", "name slug")
        .populate("operatorId", "name profileImage")
        .sort(sortOption)
        .skip(skip)
        .limit(limitNumber)
        .lean(),

      Tour.countDocuments(filter),
    ]);

    // 14. Send response
    return res.status(200).json({
      success: true,
      message: "Tours fetched successfully",
      total,
      page: pageNumber,
      limit: limitNumber,
      totalPages: Math.ceil(total / limitNumber),
      tours,
    });
  } catch (error) {
    next(error);
  }
};

// ==================================================
// 2. GET PUBLISHED TOUR BY ID
// GET /api/tours/id/:id
// ==================================================

export const getTourById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      throw new HttpError("Invalid tour ID", 400);
    }

    const tour = await Tour.findOne({
      _id: id,
      status: "published",
      isDeleted: false,
    })
      .populate("destinationId", "name country slug")
      .populate("categoryId", "name slug")
      .populate("operatorId", "name profileImage bio");

    if (!tour) {
      throw new HttpError("Tour not found", 404);
    }

    return res.status(200).json({
      success: true,
      message: "Tour fetched successfully",
      tour,
    });
  } catch (error) {
    next(error);
  }
};

// ==================================================
// 3. GET PUBLISHED TOUR BY SLUG
// GET /api/tours/slug/:slug
// ==================================================

export const getTourBySlug = async (req, res, next) => {
  try {
    const slug = req.params.slug.toLowerCase();

    const tour = await Tour.findOne({
      slug,
      status: "published",
      isDeleted: false,
    })
      .populate("destinationId", "name country slug")
      .populate("categoryId", "name slug")
      .populate("operatorId", "name profileImage bio");

    if (!tour) {
      throw new HttpError("Tour not found", 404);
    }

    return res.status(200).json({
      success: true,
      message: "Tour fetched successfully",
      tour,
    });
  } catch (error) {
    next(error);
  }
};

// ==================================================
// 4. GET OPERATOR'S OWN TOURS
// GET /api/tours/operator/my-tours
// ==================================================

export const getMyTours = async (req, res, next) => {
  try {
    if (!checkOperatorRole(req, next)) return;

    const {
      status,
      page = 1,
      limit = 10,
    } = req.query;

    const pageNumber = Math.max(1, parseInt(page, 10) || 1);
    const limitNumber = Math.min(
      100,
      Math.max(1, parseInt(limit, 10) || 10)
    );

    const operatorId = getOperatorId(req);

    if (!operatorId || !isValidId(String(operatorId))) {
      throw new HttpError(
        "Unable to identify the authenticated operator",
        401
      );
    }

    const filter = {
      operatorId,
      isDeleted: false,
    };

    if (status) {
      if (!["draft", "published", "archived"].includes(status)) {
        throw new HttpError("Invalid tour status", 400);
      }

      filter.status = status;
    }

    const [tours, total] = await Promise.all([
      Tour.find(filter)
        .populate("destinationId", "name country slug")
        .populate("categoryId", "name slug")
        .sort({ createdAt: -1 })
        .skip((pageNumber - 1) * limitNumber)
        .limit(limitNumber),

      Tour.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      message: "Your tours fetched successfully",
      total,
      page: pageNumber,
      limit: limitNumber,
      totalPages: Math.ceil(total / limitNumber),
      tours,
    });
  } catch (error) {
    next(error);
  }
};

// ==================================================
// 5. CREATE TOUR
// POST /api/tours/create
// ==================================================

export const createTour = async (req, res, next) => {
  try {
    if (!checkOperatorRole(req, next)) return;

    const body = req.body || {};

    const {
      destinationId,
      categoryId,
      title,
      description,
      durationDays,
      nights,
      durationMinutes,
      highlights,
      days,
      inclusions,
      exclusions,
      meetingPoint,
      whatsappNumber,
      basePrice,
      currency,
      cancellationPolicy,
      minParticipants,
      maxParticipants,
      ageRestrictions,
      difficultyLevel,
      languages,
      tags,
      instantBooking,
    } = body;

    if (
      typeof title !== "string" ||
      !title.trim() ||
      typeof description !== "string" ||
      !description.trim()
    ) {
      throw new HttpError(
        "Title and description are required",
        400
      );
    }

    if (title.trim().length < 3 || title.trim().length > 150) {
      throw new HttpError(
        "Title must be between 3 and 150 characters",
        400
      );
    }

    if (description.trim().length < 20) {
      throw new HttpError(
        "Description must be at least 20 characters",
        400
      );
    }

    const slug = body.slug
      ? generateSlug(body.slug)
      : generateSlug(title);

    if (!slug) {
      throw new HttpError("A valid tour slug is required", 400);
    }

    const existingTour = await Tour.findOne({ slug });

    if (existingTour) {
      throw new HttpError(
        "A tour with this slug already exists",
        409
      );
    }

    await validateTourReferences(destinationId, categoryId);

    const parsedMeetingPoint = parseJsonField(
      meetingPoint,
      "meetingPoint"
    );

    const parsedHighlights = parseJsonField(
      highlights,
      "highlights"
    );

    const parsedDays = parseDays(days);

    const parsedInclusions = parseJsonField(
      inclusions,
      "inclusions"
    );

    const parsedExclusions = parseJsonField(
      exclusions,
      "exclusions"
    );

    const parsedAgeRestrictions = parseJsonField(
      ageRestrictions,
      "ageRestrictions"
    );

    const parsedLanguages = parseJsonField(
      languages,
      "languages"
    );

    const parsedTags = parseJsonField(tags, "tags");

    const parsedInstantBooking = parseBoolean(
      instantBooking,
      "instantBooking"
    );

    const numbers = parseTourNumberFields(body, [
      "durationDays",
      "nights",
      "durationMinutes",
      "basePrice",
      "minParticipants",
      "maxParticipants",
    ]);

    validateDuration(numbers.durationDays, numbers.nights);

    if (
      !Number.isInteger(numbers.durationMinutes) ||
      numbers.durationMinutes < 1
    ) {
      throw new HttpError(
        "durationMinutes must be a positive whole number",
        400
      );
    }

    if (
      numbers.basePrice === undefined ||
      numbers.basePrice < 0
    ) {
      throw new HttpError(
        "basePrice must be zero or greater",
        400
      );
    }

    validateParticipantLimits(
      numbers.minParticipants ?? 1,
      numbers.maxParticipants ?? 10
    );

    const parsedWhatsApp = validateWhatsAppNumber(whatsappNumber);

    if (
      !parsedMeetingPoint ||
      typeof parsedMeetingPoint !== "object" ||
      Array.isArray(parsedMeetingPoint) ||
      typeof parsedMeetingPoint.name !== "string" ||
      typeof parsedMeetingPoint.address !== "string" ||
      !parsedMeetingPoint.name.trim() ||
      !parsedMeetingPoint.address.trim()
    ) {
      throw new HttpError(
        "Meeting point name and address are required",
        400
      );
    }

    validateDaysCount(parsedDays ?? [], numbers.durationDays);

    const parsedImages = parseUploadedImages(req.files || []);

    if (parsedImages.length > 10) {
      throw new HttpError(
        "A tour can have a maximum of 10 images",
        400
      );
    }

    const tour = await Tour.create({
      operatorId: getOperatorId(req),
      destinationId,
      categoryId,
      title: title.trim(),
      slug,
      description: description.trim(),

      durationDays: numbers.durationDays,
      nights: numbers.nights,
      durationMinutes: numbers.durationMinutes,

      highlights: parsedHighlights ?? [],
      days: parsedDays ?? [],
      inclusions: parsedInclusions ?? [],
      exclusions: parsedExclusions ?? [],

      meetingPoint: parsedMeetingPoint,
      whatsappNumber: parsedWhatsApp,
      images: parsedImages,

      basePrice: numbers.basePrice,
      currency,
      cancellationPolicy,

      minParticipants: numbers.minParticipants ?? 1,
      maxParticipants: numbers.maxParticipants ?? 10,

      ageRestrictions: parsedAgeRestrictions,
      difficultyLevel,
      languages: parsedLanguages ?? ["English"],
      tags: parsedTags ?? [],
      instantBooking: parsedInstantBooking ?? false,

      status: "draft",
    });

    await createTourNotification(
      getOperatorId(req),
      "tour_created",
      "Tour Created Successfully",
      `Your tour "${tour.title}" has been created as a draft.`
    );

    return res.status(201).json({
      success: true,
      message: "Tour created successfully as a draft",
      tour,
    });
  } catch (error) {
    next(error);
  }
};

// ==================================================
// 6. UPDATE TOUR
// PATCH /api/tours/:id
// ==================================================

export const updateTour = async (req, res, next) => {
  try {
    if (!checkOperatorRole(req, next)) return;

    const { id } = req.params;

    if (!isValidId(id)) {
      throw new HttpError("Invalid tour ID", 400);
    }

    const tour = await findTourById(id);

    if (!tour) {
      throw new HttpError("Tour not found", 404);
    }

    if (!checkTourOwner(tour, req, next)) return;

    const body = req.body || {};

    const textFields = [
      "title",
      "description",
      "currency",
      "cancellationPolicy",
      "difficultyLevel",
    ];

    for (const field of textFields) {
      if (body[field] !== undefined) {
        tour[field] = body[field];
      }
    }

    if (body.title !== undefined) {
      if (
        typeof body.title !== "string" ||
        body.title.trim().length < 3 ||
        body.title.trim().length > 150
      ) {
        throw new HttpError(
          "Title must be between 3 and 150 characters",
          400
        );
      }

      tour.title = body.title.trim();
    }

    if (body.description !== undefined) {
      if (
        typeof body.description !== "string" ||
        body.description.trim().length < 20
      ) {
        throw new HttpError(
          "Description must be at least 20 characters",
          400
        );
      }

      tour.description = body.description.trim();
    }

    const numbers = parseTourNumberFields(body, [
      "durationDays",
      "nights",
      "durationMinutes",
      "basePrice",
      "minParticipants",
      "maxParticipants",
    ]);

    for (const [field, value] of Object.entries(numbers)) {
      if (value !== undefined) {
        tour[field] = value;
      }
    }

    if (body.whatsappNumber !== undefined) {
      tour.whatsappNumber = validateWhatsAppNumber(
        body.whatsappNumber
      );
    }

    const jsonFields = [
      "highlights",
      "inclusions",
      "exclusions",
      "meetingPoint",
      "ageRestrictions",
      "languages",
      "tags",
    ];

    for (const field of jsonFields) {
      if (body[field] !== undefined) {
        tour[field] = parseJsonField(body[field], field);
      }
    }

    if (body.days !== undefined) {
      const parsedDays = parseDays(body.days);

      // An empty string means no change; [] clears daily plans.
      if (parsedDays !== undefined) {
        tour.days = parsedDays;
      }
    }

    if (body.instantBooking !== undefined) {
      tour.instantBooking = parseBoolean(
        body.instantBooking,
        "instantBooking"
      );
    }

    validateDuration(tour.durationDays, tour.nights);

    if (
      !Number.isInteger(tour.durationMinutes) ||
      tour.durationMinutes < 1
    ) {
      throw new HttpError(
        "durationMinutes must be a positive whole number",
        400
      );
    }

    if (
      !Number.isFinite(tour.basePrice) ||
      tour.basePrice < 0
    ) {
      throw new HttpError(
        "basePrice must be zero or greater",
        400
      );
    }

    validateDaysCount(tour.days ?? [], tour.durationDays);

    validateParticipantLimits(
      tour.minParticipants,
      tour.maxParticipants
    );

    const nextDestinationId =
      body.destinationId ?? tour.destinationId;

    const nextCategoryId =
      body.categoryId ?? tour.categoryId;

    if (
      body.destinationId !== undefined ||
      body.categoryId !== undefined
    ) {
      await validateTourReferences(
        nextDestinationId,
        nextCategoryId
      );

      tour.destinationId = nextDestinationId;
      tour.categoryId = nextCategoryId;
    }

    if (
      body.slug !== undefined ||
      body.title !== undefined
    ) {
      const newSlug = generateSlug(
        body.slug !== undefined ? body.slug : tour.title
      );

      if (!newSlug) {
        throw new HttpError(
          "A valid tour slug is required",
          400
        );
      }

      const existingTour = await Tour.findOne({
        slug: newSlug,
        _id: { $ne: id },
      });

      if (existingTour) {
        throw new HttpError(
          "A tour with this slug already exists",
          409
        );
      }

      tour.slug = newSlug;
    }

    const currentImages = tour.images ?? [];
    let requestedImages = [...currentImages];

    if (body.existingImages !== undefined) {
      requestedImages = parseJsonField(
        body.existingImages,
        "existingImages"
      );

      if (!Array.isArray(requestedImages)) {
        throw new HttpError(
          "existingImages must be an array",
          400
        );
      }

      const existingPublicIds = new Set(
        currentImages.map((image) => image.publicId)
      );

      const requestedPublicIds = requestedImages.map(
        (image) => image?.publicId
      );

      if (
        requestedPublicIds.some(
          (publicId) =>
            typeof publicId !== "string" ||
            !existingPublicIds.has(publicId)
        )
      ) {
        throw new HttpError(
          "One or more existing images are invalid",
          400
        );
      }

      if (
        new Set(requestedPublicIds).size !==
        requestedPublicIds.length
      ) {
        throw new HttpError(
          "Duplicate existing images are not allowed",
          400
        );
      }

      requestedImages = currentImages.filter((image) =>
        requestedPublicIds.includes(image.publicId)
      );
    }

    const uploadedImages = parseUploadedImages(req.files || []);
    const finalImages = [...requestedImages, ...uploadedImages];

    if (finalImages.length > 10) {
      throw new HttpError(
        "A tour can have a maximum of 10 images",
        400
      );
    }

    const retainedPublicIds = new Set(
      finalImages.map((image) => image.publicId)
    );

    const oldImages = currentImages.filter(
      (image) => !retainedPublicIds.has(image.publicId)
    );

    tour.images = finalImages;

    await tour.save();

    await createTourNotification(
      getOperatorId(req),
      "tour_updated",
      "Tour Updated Successfully",
      `Your tour "${tour.title}" has been updated.`
    );

    if (oldImages.length > 0) {
      await deleteCloudinaryImages(oldImages);
    }

    return res.status(200).json({
      success: true,
      message: "Tour updated successfully",
      tour,
    });
  } catch (error) {
    console.error("UPDATE TOUR ERROR:", error);
    next(error);
  }
};

// ==================================================
// 7. PUBLISH TOUR
// PATCH /api/tours/:id/publish
// ==================================================

export const publishTour = async (req, res, next) => {
  try {
    if (!checkOperatorRole(req, next)) return;

    const { id } = req.params;

    if (!isValidId(id)) {
      throw new HttpError("Invalid tour ID", 400);
    }

    const tour = await findTourById(id);

    if (!tour) {
      throw new HttpError("Tour not found", 404);
    }

    if (!checkTourOwner(tour, req, next)) return;

    if (
      !tour.title ||
      !tour.description ||
      tour.description.length < 20 ||
      !tour.destinationId ||
      !tour.categoryId ||
      !tour.meetingPoint?.name ||
      !tour.meetingPoint?.address ||
      !tour.cancellationPolicy ||
      !tour.whatsappNumber ||
      !Number.isInteger(tour.durationDays) ||
      tour.durationDays < 1 ||
      !Number.isInteger(tour.nights) ||
      tour.nights < 0 ||
      tour.nights > tour.durationDays ||
      !Number.isInteger(tour.durationMinutes) ||
      tour.durationMinutes < 1 ||
      !Number.isFinite(tour.basePrice) ||
      tour.basePrice < 0 ||
      (tour.images ?? []).length === 0
    ) {
      throw new HttpError(
        "Complete all required tour details and upload at least one image before publishing",
        400
      );
    }

    validateWhatsAppNumber(tour.whatsappNumber);
    validateDaysCount(tour.days ?? [], tour.durationDays);

    validateParticipantLimits(
      tour.minParticipants,
      tour.maxParticipants
    );

    await validateTourReferences(
      tour.destinationId,
      tour.categoryId
    );

    tour.status = "published";

    await tour.save();

    await createTourNotification(
      getOperatorId(req),
      "tour_published",
      "Tour Published Successfully",
      `Your tour "${tour.title}" is now published and available to travelers.`
    );

    return res.status(200).json({
      success: true,
      message: "Tour published successfully",
      tour,
    });
  } catch (error) {
    next(error);
  }
};

// ==================================================
// 8. UNPUBLISH TOUR
// PATCH /api/tours/:id/unpublish
// ==================================================

export const unpublishTour = async (req, res, next) => {
  try {
    if (!checkOperatorRole(req, next)) return;

    const { id } = req.params;

    if (!isValidId(id)) {
      throw new HttpError("Invalid tour ID", 400);
    }

    const tour = await findTourById(id);

    if (!tour) {
      throw new HttpError("Tour not found", 404);
    }

    if (!checkTourOwner(tour, req, next)) return;

    tour.status = "draft";

    await tour.save();

    await createTourNotification(
      getOperatorId(req),
      "tour_unpublished",
      "Tour Unpublished",
      `Your tour "${tour.title}" has been moved back to drafts.`
    );

    return res.status(200).json({
      success: true,
      message: "Tour unpublished successfully",
      tour,
    });
  } catch (error) {
    next(error);
  }
};

// ==================================================
// 9. DELETE TOUR (SOFT DELETE)
// DELETE /api/tours/:id
// ==================================================

export const deleteTour = async (req, res, next) => {
  try {
    if (!checkOperatorRole(req, next)) return;

    const { id } = req.params;

    if (!isValidId(id)) {
      throw new HttpError("Invalid tour ID", 400);
    }

    const tour = await findTourById(id);

    if (!tour) {
      throw new HttpError("Tour not found", 404);
    }

    if (!checkTourOwner(tour, req, next)) return;

    tour.isDeleted = true;
    tour.status = "archived";

    await tour.save();

    await createTourNotification(
      getOperatorId(req),
      "tour_deleted",
      "Tour Deleted Successfully",
      `Your tour "${tour.title}" has been removed from your active tours.`
    );

    return res.status(200).json({
      success: true,
      message: "Tour deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};
