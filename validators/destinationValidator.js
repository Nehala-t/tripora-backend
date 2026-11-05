
import { body, param, query } from "express-validator";

// ==================================================
// CREATE DESTINATION VALIDATOR
// ==================================================

export const createDestinationValidator = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Destination name is required")
    .isLength({ max: 150 })
    .withMessage("Destination name cannot exceed 150 characters"),

  body("country")
    .trim()
    .notEmpty()
    .withMessage("Country is required")
    .isLength({ max: 100 })
    .withMessage("Country cannot exceed 100 characters"),

  body("slug")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Slug cannot be empty")
    .matches(/^[a-zA-Z0-9\s-]+$/)
    .withMessage("Slug can contain only letters, numbers, spaces, and hyphens"),

  body("description")
    .trim()
    .notEmpty()
    .withMessage("Description is required")
    .isLength({ max: 3000 })
    .withMessage("Description cannot exceed 3000 characters"),

  body("coordinates")
    .notEmpty()
    .withMessage("Coordinates are required")
    .isObject()
    .withMessage("Coordinates must be an object"),

  body("coordinates.latitude")
    .exists()
    .withMessage("Latitude is required")
    .bail()
    .isFloat({ min: -90, max: 90 })
    .withMessage("Latitude must be between -90 and 90"),

  body("coordinates.longitude")
    .exists()
    .withMessage("Longitude is required")
    .bail()
    .isFloat({ min: -180, max: 180 })
    .withMessage("Longitude must be between -180 and 180"),

  body("image")
    .notEmpty()
    .withMessage("Destination image is required")
    .isObject()
    .withMessage("Image must be an object"),

  body("image.url")
    .trim()
    .notEmpty()
    .withMessage("Image URL is required")
    .isURL({ require_protocol: true })
    .withMessage("Please provide a valid image URL"),

  body("image.publicId")
    .optional()
    .isString()
    .withMessage("Image public ID must be a string"),

  body("region")
    .optional()
    .isString()
    .withMessage("Region must be a string")
    .isLength({ max: 100 })
    .withMessage("Region cannot exceed 100 characters"),

  body("highlights")
    .optional()
    .isArray()
    .withMessage("Highlights must be an array"),

  body("highlights.*")
    .optional()
    .isString()
    .withMessage("Each highlight must be a string")
    .trim()
    .notEmpty()
    .withMessage("Highlights cannot contain empty values"),

  body("bestTimeToVisit")
    .optional()
    .isString()
    .withMessage("Best time to visit must be a string")
    .isLength({ max: 200 })
    .withMessage("Best time to visit cannot exceed 200 characters"),

  body("isFeatured")
    .optional()
    .isBoolean()
    .withMessage("isFeatured must be true or false"),

  body("status")
    .optional()
    .isIn(["active", "inactive"])
    .withMessage("Status must be active or inactive"),
];

// ==================================================
// GET ALL DESTINATIONS VALIDATOR
// ==================================================

export const getAllDestinationsValidator = [
  query("search")
    .optional()
    .isString()
    .withMessage("Search must be a string"),

  query("country")
    .optional()
    .isString()
    .withMessage("Country must be a string"),

  query("region")
    .optional()
    .isString()
    .withMessage("Region must be a string"),

  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),

  query("sort")
    .optional()
    .isIn(["newest", "oldest", "name_asc", "name_desc"])
    .withMessage("Invalid sort option"),
];

// ==================================================
// DESTINATION ID VALIDATOR
// Reuse for get, update, and delete
// ==================================================

export const destinationIdValidator = [
  param("id")
    .isMongoId()
    .withMessage("Please provide a valid destination ID"),
];

// ==================================================
// DESTINATION SLUG VALIDATOR
// ==================================================

export const destinationSlugValidator = [
  param("slug")
    .trim()
    .notEmpty()
    .withMessage("Destination slug is required")
    .matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .withMessage("Invalid destination slug"),
];

// ==================================================
// UPDATE DESTINATION VALIDATOR
// All fields are optional, but supplied values are validated
// ==================================================

export const updateDestinationValidator = [
  ...destinationIdValidator,

  body("name")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Destination name cannot be empty")
    .isLength({ max: 150 })
    .withMessage("Destination name cannot exceed 150 characters"),

  body("country")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Country cannot be empty")
    .isLength({ max: 100 })
    .withMessage("Country cannot exceed 100 characters"),

  body("slug")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Slug cannot be empty")
    .matches(/^[a-zA-Z0-9\s-]+$/)
    .withMessage("Invalid destination slug"),

  body("description")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Description cannot be empty")
    .isLength({ max: 3000 })
    .withMessage("Description cannot exceed 3000 characters"),

  body("coordinates")
    .optional()
    .isObject()
    .withMessage("Coordinates must be an object"),

  body("coordinates.latitude")
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage("Latitude must be between -90 and 90"),

  body("coordinates.longitude")
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage("Longitude must be between -180 and 180"),

  body("image")
    .optional()
    .isObject()
    .withMessage("Image must be an object"),

  body("image.url")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Image URL cannot be empty")
    .isURL({ require_protocol: true })
    .withMessage("Please provide a valid image URL"),

  body("image.publicId")
    .optional()
    .isString()
    .withMessage("Image public ID must be a string"),

  body("region")
    .optional()
    .isString()
    .withMessage("Region must be a string")
    .isLength({ max: 100 })
    .withMessage("Region cannot exceed 100 characters"),

  body("highlights")
    .optional()
    .isArray()
    .withMessage("Highlights must be an array"),

  body("highlights.*")
    .optional()
    .isString()
    .withMessage("Each highlight must be a string")
    .trim()
    .notEmpty()
    .withMessage("Highlights cannot contain empty values"),

  body("bestTimeToVisit")
    .optional()
    .isString()
    .withMessage("Best time to visit must be a string")
    .isLength({ max: 200 })
    .withMessage("Best time to visit cannot exceed 200 characters"),

  body("isFeatured")
    .optional()
    .isBoolean()
    .withMessage("isFeatured must be true or false"),

  body("status")
    .optional()
    .isIn(["active", "inactive"])
    .withMessage("Status must be active or inactive"),
];

// ==================================================
// FEATURED DESTINATIONS VALIDATOR
// ==================================================

export const featuredDestinationsValidator = [
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
];

// ==================================================
// DESTINATIONS BY COUNTRY VALIDATOR
// ==================================================

export const destinationsByCountryValidator = [
  param("country")
    .trim()
    .notEmpty()
    .withMessage("Country is required")
    .isLength({ max: 100 })
    .withMessage("Country cannot exceed 100 characters"),
];