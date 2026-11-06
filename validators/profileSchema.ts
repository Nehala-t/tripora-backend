
import { body } from "express-validator";



// ========================================
// PERSONAL PROFILE VALIDATION
// ========================================

export const profileValidator = [
  body("firstName")
    .trim()
    .notEmpty()
    .withMessage("Please enter your first name")
    .bail()
    .isLength({ min: 2, max: 50 })
    .withMessage("First name must contain 2 to 50 characters")
    .bail()
    .matches(/^[A-Za-z]+(?:[ '-][A-Za-z]+)*$/)
    .withMessage("First name should contain only letters"),

  body("lastName")
    .trim()
    .notEmpty()
    .withMessage("Please enter your last name")
    .bail()
    .isLength({ min: 2, max: 50 })
    .withMessage("Last name must contain 2 to 50 characters")
    .bail()
    .matches(/^[A-Za-z]+(?:[ '-][A-Za-z]+)*$/)
    .withMessage("Last name should contain only letters"),

  body("phone")
    .optional({ values: "null" })
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

 
];

// ========================================
// TRAVEL PREFERENCES VALIDATION
// ========================================

export const travelPreferencesValidator = [
  body("preferredLanguage")
    .trim()
    .notEmpty()
    .withMessage("Please select your preferred language")
    .bail()
    .isLength({ max: 20 })
    .withMessage("Language cannot exceed 20 characters"),

  body("preferredCurrency")
    .isIn(["INR", "USD", "EUR", "GBP", "AED"])
    .withMessage("Please select a valid currency"),

  body("preferredDestinations")
    .isArray({ max: 20 })
    .withMessage("You can add up to 20 destinations"),

  body("preferredDestinations.*")
    .trim()
    .notEmpty()
    .withMessage("Destination cannot be empty")
    .bail()
    .isLength({ max: 100 })
    .withMessage("Destination cannot exceed 100 characters"),

  body("travelStyle")
    .isIn([
      "adventure",
      "relaxation",
      "luxury",
      "budget",
      "cultural",
      "family",
      "solo",
    ])
    .withMessage("Please select a valid travel style"),

  body("budget")
    .isIn(["Low", "Medium", "High"])
    .withMessage("Please select a valid budget"),

  body("travelInterests")
    .isArray()
    .withMessage("Travel interests must be an array"),

  body("travelInterests.*")
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
    .withMessage("Please select valid travel interests"),

  
];

// ========================================
// OPERATOR BUSINESS DETAILS VALIDATION
// ========================================

export const operatorValidator = [
  body("businessName")
    .trim()
    .notEmpty()
    .withMessage("Please enter your business name")
    .bail()
    .isLength({ max: 150 })
    .withMessage("Business name cannot exceed 150 characters"),

  body("businessEmail")
    .trim()
    .notEmpty()
    .withMessage("Please enter your business email")
    .bail()
    .isEmail()
    .withMessage("Please enter a valid business email")
    .normalizeEmail(),

  body("businessPhone")
    .trim()
    .notEmpty()
    .withMessage("Please enter your business phone number")
    .bail()
    .isLength({ max: 25 })
    .withMessage("Phone number cannot exceed 25 characters"),

  body("website")
    .optional()
    .trim()
    .custom((value) => {
      if (!value) return true;

      try {
        const url = new URL(value);

        if (!["http:", "https:"].includes(url.protocol)) {
          throw new Error("Invalid protocol");
        }

        if (!url.hostname.includes(".")) {
          throw new Error("Invalid hostname");
        }

        return true;
      } catch {
        throw new Error("Please enter a valid website URL");
      }
    }),

  body("businessAddress")
    .trim()
    .notEmpty()
    .withMessage("Please enter your business address")
    .bail()
    .isLength({ max: 250 })
    .withMessage("Business address cannot exceed 250 characters"),

  body("businessDescription")
    .trim()
    .notEmpty()
    .withMessage("Please enter your business description")
    .bail()
    .isLength({ max: 2000 })
    .withMessage("Description cannot exceed 2000 characters"),

  
];
