
import { body } from "express-validator";

// ========================================
// UPDATE PROFILE VALIDATOR
// PATCH /api/user-profile/me
// ========================================

export const updateMyProfileValidator = [
  body("firstName")
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("First name must contain 2 to 50 characters"),

  body("lastName")
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("Last name must contain 2 to 50 characters"),

  body("phone")
    .optional()
    .trim()
    .isLength({ max: 25 })
    .withMessage("Phone number cannot exceed 25 characters"),

  body("bio")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Bio cannot exceed 1000 characters"),

  body("country")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Country cannot exceed 100 characters"),

  body("city")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("City cannot exceed 100 characters"),

  body("preferredLanguage")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Preferred language cannot be empty")
    .bail()
    .isLength({ max: 20 })
    .withMessage("Preferred language cannot exceed 20 characters"),
];

// ========================================
// UPDATE TRAVEL PREFERENCES VALIDATOR
// PATCH /api/user-profile/preferences
// ========================================

export const updateTravelPreferencesValidator = [
  body("travelInterests")
    .optional()
    .isArray()
    .withMessage("Travel interests must be an array"),

  body("travelInterests.*")
    .optional()
    .isIn([
      "adventure",
      "culture",
      "food",
      "nature",
      "sightseeing",
      "water_sports",
      "wildlife",
      "wellness",
    ])
    .withMessage("Invalid travel interest"),

  body("preferredCurrency")
    .optional()
    .isIn(["INR", "USD", "EUR", "GBP", "AED"])
    .withMessage("Invalid preferred currency"),

  body("preferredLanguage")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Preferred language cannot be empty")
    .bail()
    .isLength({ max: 20 })
    .withMessage("Preferred language cannot exceed 20 characters"),

  body("preferredDestinations")
    .optional()
    .isArray()
    .withMessage("Preferred destinations must be an array"),

  body("preferredDestinations.*")
    .optional()
    .isString()
    .withMessage("Each preferred destination must be a string")
    .bail()
    .trim()
    .notEmpty()
    .withMessage("Preferred destination cannot be empty")
    .bail()
    .isLength({ max: 100 })
    .withMessage("Preferred destination cannot exceed 100 characters"),

  body("travelStyle")
    .optional()
    .isIn([
      "adventure",
      "relaxation",
      "luxury",
      "budget",
      "cultural",
      "family",
      "solo",
    ])
    .withMessage("Invalid travel style"),

  body("budget")
    .optional()
    .isIn(["Low", "Medium", "High"])
    .withMessage("Invalid travel budget"),
];

// ========================================
// UPDATE NOTIFICATION PREFERENCES VALIDATOR
// PATCH /api/user-profile/notifications
// ========================================

export const updateNotificationPreferencesValidator = [
  body("notificationPreferences")
    .notEmpty()
    .withMessage("Notification preferences are required")
    .bail()
    .isObject()
    .withMessage("Notification preferences must be an object"),

  body("notificationPreferences.email")
    .optional()
    .isBoolean()
    .withMessage("Email preference must be true or false"),

  body("notificationPreferences.inApp")
    .optional()
    .isBoolean()
    .withMessage("In-app preference must be true or false"),

  body("notificationPreferences.bookingReminders")
    .optional()
    .isBoolean()
    .withMessage("Booking reminders preference must be true or false"),

  body("notificationPreferences.marketingEmails")
    .optional()
    .isBoolean()
    .withMessage("Marketing emails preference must be true or false"),

  body("notificationPreferences")
    .custom((preferences) => {
      if (
        !preferences ||
        typeof preferences !== "object" ||
        Array.isArray(preferences)
      ) {
        return true;
      }

      const allowedKeys = [
        "email",
        "inApp",
        "bookingReminders",
        "marketingEmails",
      ];

      const invalidKey = Object.keys(preferences).find(
        (key) => !allowedKeys.includes(key)
      );

      if (invalidKey) {
        throw new Error(
          `Invalid notification preference: ${invalidKey}`
        );
      }

      if (Object.keys(preferences).length === 0) {
        throw new Error("Provide at least one notification preference");
      }

      return true;
    }),
];
