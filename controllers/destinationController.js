
import mongoose from "mongoose";
import Destination from "../models/Destination.js";
import cloudinary from "../config/cloudinary.js";

// ========================================
// HELPER FUNCTIONS
// ========================================

// Create errors compatible with Express error middleware.
const createError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

// Admin-only access.
const checkAdminRole = (req) => {
  if (!req.user) {
    throw createError(401, "Authentication required");
  }

  if (req.user.role !== "admin") {
    throw createError(
      403,
      "Access denied. Only admins can perform this action."
    );
  }
};

// Generate a URL-friendly slug.
const generateSlug = (value = "") => {
  return value
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

// Validate MongoDB ObjectId.
const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

// Escape special characters in search strings.
const escapeRegex = (value = "") => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

// Parse JSON values sent through multipart/form-data.
// Normal JSON request objects and arrays are also supported.
const parseJsonField = (value, fieldName) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value === "object") {
    return value;
  }

  if (typeof value !== "string") {
    throw createError(400, `Invalid ${fieldName} format`);
  }

  try {
    return JSON.parse(value);
  } catch {
    throw createError(
      400,
      `${fieldName} must contain valid JSON`
    );
  }
};

// Parse boolean values from JSON or multipart/form-data.
const parseBooleanField = (value, fieldName) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalizedValue = value.trim().toLowerCase();

    if (normalizedValue === "true") return true;
    if (normalizedValue === "false") return false;
  }

  throw createError(
    400,
    `${fieldName} must be true or false`
  );
};

// Delete Cloudinary images safely.
const deleteCloudinaryImages = async (images = []) => {
  const validImages = images.filter(
    (image) => image?.publicId
  );

  const results = await Promise.allSettled(
    validImages.map((image) =>
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

// Check whether a slug is already used by another destination.
const checkSlugExists = async (slug, excludeId = null) => {
  const query = {
    slug,
    isDeleted: false,
  };

  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  return Destination.findOne(query);
};

// ========================================
// CREATE DESTINATION
// POST /api/destinations
// Admin only
// ========================================

export const createDestination = async (req, res, next) => {
  let uploadedImage = null;

  try {
    checkAdminRole(req);

    const body = req.body || {};

    const {
      name,
      country,
      description,
      region,
      bestTimeToVisit,
      status,
    } = body;

    // Basic required-field validation.
    if (!name?.trim()) {
      throw createError(400, "Destination name is required");
    }

    if (!country?.trim()) {
      throw createError(400, "Country is required");
    }

    if (!description?.trim()) {
      throw createError(400, "Destination description is required");
    }

    // Generate slug from the destination name unless supplied.
    const slug = generateSlug(body.slug || name);

    if (!slug) {
      throw createError(400, "A valid destination slug is required");
    }

    const existingDestination = await checkSlugExists(slug);

    if (existingDestination) {
      throw createError(
        409,
        "A destination with this slug already exists"
      );
    }

    // Parse coordinates and highlights.
    const parsedCoordinates = parseJsonField(
      body.coordinates,
      "coordinates"
    );

    const parsedHighlights = parseJsonField(
      body.highlights,
      "highlights"
    );

    const parsedIsFeatured = parseBooleanField(
      body.isFeatured,
      "isFeatured"
    );

    // Image upload through upload.single("image").
    if (req.file) {
      uploadedImage = {
        url: req.file.path,
        publicId: req.file.filename,
      };
    } else {
      // Alternatively, accept an image object in a JSON request.
      uploadedImage = parseJsonField(body.image, "image");
    }

    if (
      !uploadedImage ||
      typeof uploadedImage !== "object" ||
      Array.isArray(uploadedImage) ||
      !uploadedImage.url
    ) {
      throw createError(
        400,
        "Destination image is required and must contain a URL"
      );
    }

    // Validate image fields.
    uploadedImage = {
      url: String(uploadedImage.url).trim(),
      publicId: uploadedImage.publicId
        ? String(uploadedImage.publicId).trim()
        : "",
    };

    if (!uploadedImage.url) {
      throw createError(400, "Destination image URL is required");
    }

    if (
      !parsedCoordinates ||
      parsedCoordinates.latitude === undefined ||
      parsedCoordinates.longitude === undefined
    ) {
      throw createError(
        400,
        "Coordinates must contain latitude and longitude"
      );
    }

    if (
      parsedHighlights !== undefined &&
      !Array.isArray(parsedHighlights)
    ) {
      throw createError(400, "Highlights must be an array");
    }

    const destinationData = {
      name: name.trim(),
      country: country.trim(),
      slug,
      description: description.trim(),
      coordinates: parsedCoordinates,
      image: uploadedImage,
      region,
      highlights: parsedHighlights || [],
      bestTimeToVisit,
      isFeatured: parsedIsFeatured ?? false,
      status: status || "active",
    };

    const destination = await Destination.create(destinationData);

    return res.status(201).json({
      success: true,
      message: "Destination created successfully",
      data: destination,
    });
  } catch (error) {
    // Clean up a newly uploaded Cloudinary image if creation fails.
    if (uploadedImage?.publicId) {
      await deleteCloudinaryImages([uploadedImage]);
    }

    if (error.code === 11000) {
      return next(
        createError(409, "A destination with this slug already exists")
      );
    }

    return next(error);
  }
};

// ========================================
// GET ALL DESTINATIONS
// GET /api/destinations
// Public
// ========================================

export const getAllDestinations = async (req, res, next) => {
  try {
    const {
      search = "",
      country,
      region,
      page = 1,
      limit = 10,
      sort = "-createdAt",
    } = req.query;

    const parsedPage = Math.max(Number.parseInt(page, 10) || 1, 1);
    const parsedLimit = Math.min(
      Math.max(Number.parseInt(limit, 10) || 10, 1),
      100
    );

    const filter = {
      isDeleted: false,
      status: "active",
    };

    if (search.trim()) {
      const searchRegex = new RegExp(escapeRegex(search.trim()), "i");

      filter.$or = [
        { name: searchRegex },
        { country: searchRegex },
        { region: searchRegex },
        { description: searchRegex },
      ];
    }

    if (country) {
      filter.country = new RegExp(
        `^${escapeRegex(country.trim())}$`,
        "i"
      );
    }

    if (region) {
      filter.region = new RegExp(
        `^${escapeRegex(region.trim())}$`,
        "i"
      );
    }

    // Allow only known sortable fields.
    const allowedSortFields = [
      "name",
      "country",
      "createdAt",
      "updatedAt",
    ];

    const sortField = sort.startsWith("-")
      ? sort.slice(1)
      : sort;

    const sortDirection = sort.startsWith("-") ? -1 : 1;

    const sortOptions = allowedSortFields.includes(sortField)
      ? { [sortField]: sortDirection }
      : { createdAt: -1 };

    const skip = (parsedPage - 1) * parsedLimit;

    const [destinations, total] = await Promise.all([
      Destination.find(filter)
        .sort(sortOptions)
        .skip(skip)
        .limit(parsedLimit)
        .lean(),

      Destination.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      results: destinations.length,
      pagination: {
        total,
        page: parsedPage,
        limit: parsedLimit,
        totalPages: Math.ceil(total / parsedLimit),
      },
      data: destinations,
    });
  } catch (error) {
    return next(error);
  }
};

// ========================================
// GET DESTINATION BY ID
// GET /api/destinations/:id
// Public
// ========================================

export const getDestinationById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      throw createError(400, "Invalid destination ID");
    }

    const destination = await Destination.findOne({
      _id: id,
      isDeleted: false,
      status: "active",
    });

    if (!destination) {
      throw createError(404, "Destination not found");
    }

    return res.status(200).json({
      success: true,
      data: destination,
    });
  } catch (error) {
    return next(error);
  }
};

// ========================================
// GET DESTINATION BY SLUG
// GET /api/destinations/slug/:slug
// Public
// ========================================

export const getDestinationBySlug = async (req, res, next) => {
  try {
    const { slug } = req.params;

    const destination = await Destination.findOne({
      slug: slug.toLowerCase(),
      isDeleted: false,
      status: "active",
    });

    if (!destination) {
      throw createError(404, "Destination not found");
    }

    return res.status(200).json({
      success: true,
      data: destination,
    });
  } catch (error) {
    return next(error);
  }
};

// ========================================
// UPDATE DESTINATION
// PATCH /api/destinations/:id
// Admin only
// ========================================

export const updateDestination = async (req, res, next) => {
  let uploadedImage = null;

  try {
    checkAdminRole(req);

    const { id } = req.params;
    const body = req.body || {};

    if (!isValidId(id)) {
      throw createError(400, "Invalid destination ID");
    }

    const destination = await Destination.findOne({
      _id: id,
      isDeleted: false,
    });

    if (!destination) {
      throw createError(404, "Destination not found");
    }

    const oldImage = req.file
      ? destination.image
      : null;

    // Update text fields only when provided.
    const stringFields = [
      "name",
      "country",
      "description",
      "region",
      "bestTimeToVisit",
      "status",
    ];

    for (const field of stringFields) {
      if (body[field] !== undefined) {
        destination[field] =
          typeof body[field] === "string"
            ? body[field].trim()
            : body[field];
      }
    }

    // Update slug if supplied or if the name changed.
    if (body.slug !== undefined || body.name !== undefined) {
      const newSlug = generateSlug(
        body.slug !== undefined ? body.slug : destination.name
      );

      if (!newSlug) {
        throw createError(400, "A valid destination slug is required");
      }

      const existingDestination = await checkSlugExists(
        newSlug,
        destination._id
      );

      if (existingDestination) {
        throw createError(
          409,
          "A destination with this slug already exists"
        );
      }

      destination.slug = newSlug;
    }

    // Parse and update coordinates.
    if (body.coordinates !== undefined) {
      const parsedCoordinates = parseJsonField(
        body.coordinates,
        "coordinates"
      );

      if (
        !parsedCoordinates ||
        parsedCoordinates.latitude === undefined ||
        parsedCoordinates.longitude === undefined
      ) {
        throw createError(
          400,
          "Coordinates must contain latitude and longitude"
        );
      }

      destination.coordinates = parsedCoordinates;
    }

    // Parse and update highlights.
    if (body.highlights !== undefined) {
      const parsedHighlights = parseJsonField(
        body.highlights,
        "highlights"
      );

      if (!Array.isArray(parsedHighlights)) {
        throw createError(400, "Highlights must be an array");
      }

      destination.highlights = parsedHighlights;
    }

    // Update featured status.
    if (body.isFeatured !== undefined) {
      destination.isFeatured = parseBooleanField(
        body.isFeatured,
        "isFeatured"
      );
    }

    // Replace the single image if a new file was uploaded.
    if (req.file) {
      uploadedImage = {
        url: req.file.path,
        publicId: req.file.filename,
      };

      destination.image = uploadedImage;
    } else if (body.image !== undefined) {
      const parsedImage = parseJsonField(body.image, "image");

      if (
        !parsedImage ||
        typeof parsedImage !== "object" ||
        Array.isArray(parsedImage) ||
        !parsedImage.url
      ) {
        throw createError(
          400,
          "Image must be an object containing a URL"
        );
      }

      destination.image = {
        url: String(parsedImage.url).trim(),
        publicId: parsedImage.publicId
          ? String(parsedImage.publicId).trim()
          : "",
      };
    }

    const updatedDestination = await destination.save();

    // Delete the previous Cloudinary image only after a successful save.
    if (oldImage?.publicId) {
      await deleteCloudinaryImages([oldImage]);
    }

    return res.status(200).json({
      success: true,
      message: "Destination updated successfully",
      data: updatedDestination,
    });
  } catch (error) {
    // Remove a newly uploaded image if the update fails.
    if (uploadedImage?.publicId) {
      await deleteCloudinaryImages([uploadedImage]);
    }

    if (error.code === 11000) {
      return next(
        createError(409, "A destination with this slug already exists")
      );
    }

    return next(error);
  }
};

// ========================================
// DELETE DESTINATION (SOFT DELETE)
// DELETE /api/destinations/:id
// Admin only
// ========================================

export const deleteDestination = async (req, res, next) => {
  try {
    checkAdminRole(req);

    const { id } = req.params;

    if (!isValidId(id)) {
      throw createError(400, "Invalid destination ID");
    }

    const destination = await Destination.findOne({
      _id: id,
      isDeleted: false,
    });

    if (!destination) {
      throw createError(404, "Destination not found");
    }

    destination.isDeleted = true;
    destination.status = "inactive";

    await destination.save();

    return res.status(200).json({
      success: true,
      message: "Destination deleted successfully",
    });
  } catch (error) {
    return next(error);
  }
};

// ========================================
// GET FEATURED DESTINATIONS
// GET /api/destinations/featured
// Public
// ========================================

export const getFeaturedDestinations = async (req, res, next) => {
  try {
    const limit = Math.min(
      Math.max(Number.parseInt(req.query.limit, 10) || 6, 1),
      100
    );

    const destinations = await Destination.find({
      isFeatured: true,
      status: "active",
      isDeleted: false,
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return res.status(200).json({
      success: true,
      results: destinations.length,
      data: destinations,
    });
  } catch (error) {
    return next(error);
  }
};

// ========================================
// GET DESTINATIONS BY COUNTRY
// GET /api/destinations/country/:country
// Public
// ========================================

export const getDestinationsByCountry = async (req, res, next) => {
  try {
    const { country } = req.params;

    const destinations = await Destination.find({
      country: new RegExp(`^${escapeRegex(country.trim())}$`, "i"),
      status: "active",
      isDeleted: false,
    })
      .sort({ name: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      results: destinations.length,
      data: destinations,
    });
  } catch (error) {
    return next(error);
  }
};
