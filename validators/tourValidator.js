import { body } from "express-validator";

// Validate JSON fields sent as strings through FormData.
const isValidJsonField = (value) => {
  if (typeof value !== "string") return true;

  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
};

// Validate required meeting point data.
const isValidMeetingPoint = (value) => {
  let meetingPoint = value;

  if (typeof meetingPoint === "string") {
    try {
      meetingPoint = JSON.parse(meetingPoint);
    } catch {
      return false;
    }
  }

  return Boolean(
    meetingPoint &&
    typeof meetingPoint === "object" &&
    !Array.isArray(meetingPoint) &&
    typeof meetingPoint.name === "string" &&
    meetingPoint.name.trim() &&
    typeof meetingPoint.address === "string" &&
    meetingPoint.address.trim()
  );
};

// ========================================
// CREATE TOUR VALIDATOR
// ========================================

export const createTourValidator = [
  body("title")
    .trim()
    .notEmpty()
    .withMessage("Tour title is required")
    .bail()
    .isLength({ min: 3, max: 150 })
    .withMessage("Title must be between 3 and 150 characters"),

  body("description")
    .trim()
    .notEmpty()
    .withMessage("Tour description is required")
    .bail()
    .isLength({ min: 20 })
    .withMessage("Description must be at least 20 characters"),

  body("destinationId")
    .notEmpty()
    .withMessage("Destination is required")
    .bail()
    .isMongoId()
    .withMessage("Invalid destination ID"),

  body("categoryId")
    .notEmpty()
    .withMessage("Category is required")
    .bail()
    .isMongoId()
    .withMessage("Invalid category ID"),

  body("durationDays")
    .notEmpty()
    .withMessage("Duration in days is required")
    .bail()
    .isInt({ min: 1 })
    .withMessage("Duration must be a positive whole number"),

  body("nights")
    .notEmpty()
    .withMessage("Number of nights is required")
    .bail()
    .isInt({ min: 0 })
    .withMessage("Nights must be zero or greater"),

  body("durationMinutes")
    .notEmpty()
    .withMessage("Duration in minutes is required")
    .bail()
    .isInt({ min: 1 })
    .withMessage("Duration minutes must be a positive whole number"),

  body("basePrice")
    .notEmpty()
    .withMessage("Tour price is required")
    .bail()
    .isFloat({ min: 0 })
    .withMessage("Price must be zero or greater"),

  body("minParticipants")
    .optional({ values: "falsy" })
    .isInt({ min: 1 })
    .withMessage("Minimum participants must be at least 1"),

  body("maxParticipants")
    .optional({ values: "falsy" })
    .isInt({ min: 1 })
    .withMessage("Maximum participants must be at least 1"),

  body("whatsappNumber")
    .trim()
    .matches(/^\+[1-9]\d{7,14}$/)
    .withMessage(
      "Enter a valid WhatsApp number with country code, e.g. +919876543210"
    ),

  body("meetingPoint")
    .custom(isValidMeetingPoint)
    .withMessage("Meeting point must contain a name and address"),

  body("highlights")
    .optional({ values: "falsy" })
    .custom(isValidJsonField)
    .withMessage("Highlights must contain valid JSON"),

  body("days")
    .optional({ values: "falsy" })
    .custom(isValidJsonField)
    .withMessage("Days must contain valid JSON"),

  body("inclusions")
    .optional({ values: "falsy" })
    .custom(isValidJsonField)
    .withMessage("Inclusions must contain valid JSON"),

  body("exclusions")
    .optional({ values: "falsy" })
    .custom(isValidJsonField)
    .withMessage("Exclusions must contain valid JSON"),

  body("ageRestrictions")
    .optional({ values: "falsy" })
    .custom(isValidJsonField)
    .withMessage("Age restrictions must contain valid JSON"),

  body("languages")
    .optional({ values: "falsy" })
    .custom(isValidJsonField)
    .withMessage("Languages must contain valid JSON"),

  body("tags")
    .optional({ values: "falsy" })
    .custom(isValidJsonField)
    .withMessage("Tags must contain valid JSON"),

  body("instantBooking")
    .optional({ values: "falsy" })
    .isIn(["true", "false"])
    .withMessage("instantBooking must be true or false"),

  body("currency")
    .optional()
    .isIn(["INR", "USD", "EUR", "GBP", "AED"])
    .withMessage("Invalid currency"),
];

// ========================================
// UPDATE TOUR VALIDATOR
// All fields are optional for partial updates.
// ========================================

export const updateTourValidator = [
  body("title")
    .optional()
    .trim()
    .isLength({ min: 3, max: 150 })
    .withMessage("Title must be between 3 and 150 characters"),

  body("description")
    .optional()
    .trim()
    .isLength({ min: 20 })
    .withMessage("Description must be at least 20 characters"),

  body("destinationId")
    .optional()
    .isMongoId()
    .withMessage("Invalid destination ID"),

  body("categoryId")
    .optional()
    .isMongoId()
    .withMessage("Invalid category ID"),

  body("durationDays")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Duration must be a positive whole number"),

  body("nights")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Nights must be zero or greater"),

  body("durationMinutes")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Duration minutes must be a positive whole number"),

  body("basePrice")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Price must be zero or greater"),

  body("minParticipants")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Minimum participants must be at least 1"),

  body("maxParticipants")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Maximum participants must be at least 1"),

  body("whatsappNumber")
    .optional()
    .trim()
    .matches(/^\+[1-9]\d{7,14}$/)
    .withMessage("Enter a valid WhatsApp number with country code"),

  body("meetingPoint")
    .optional()
    .custom(isValidMeetingPoint)
    .withMessage("Meeting point must contain a name and address"),

  ...[
    "highlights",
    "days",
    "inclusions",
    "exclusions",
    "ageRestrictions",
    "languages",
    "tags",
    "existingImages",
  ].map((field) =>
    body(field)
      .optional({ values: "falsy" })
      .custom(isValidJsonField)
      .withMessage(`${field} must contain valid JSON`)
  ),

  body("instantBooking")
    .optional()
    .isIn(["true", "false", true, false])
    .withMessage("instantBooking must be true or false"),

  body("currency")
    .optional()
    .isIn(["INR", "USD", "EUR", "GBP", "AED"])
    .withMessage("Invalid currency"),
];
