import { body } from "express-validator";

// ========================================
// REGISTER VALIDATOR
// ========================================

export const registerValidator = [
  body("firstName")
    .trim()
    .notEmpty()
    .withMessage("First name is required")
    .bail()
    .isLength({ min: 2, max: 50 })
    .withMessage("First name must contain 2 to 50 characters"),

  body("lastName")
    .trim()
    .notEmpty()
    .withMessage("Last name is required")
    .bail()
    .isLength({ min: 1, max: 50 })
    .withMessage("Last name must contain 1 to 50 characters"),

  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email address is required")
    .bail()
    .isEmail()
    .withMessage("Please provide a valid email address")
    .normalizeEmail(),

  body("password")
    .notEmpty()
    .withMessage("Password is required")
    .bail()
    .isLength({ min: 8, max: 128 })
    .withMessage("Password must contain 8 to 128 characters")
    .matches(/[a-z]/)
    .withMessage("Password must contain at least one lowercase letter")
    .matches(/[A-Z]/)
    .withMessage("Password must contain at least one uppercase letter")
    .matches(/[0-9]/)
    .withMessage("Password must contain at least one number"),

  body("phone")
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 20 })
    .withMessage("Phone number cannot exceed 20 characters"),

  body("role")
    .optional()
    .isIn(["user", "operator", "admin"])
    .withMessage("Role must be either user or seller"),
];

// ========================================
// LOGIN VALIDATOR
// ========================================

export const loginValidator = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email address is required")
    .bail()
    .isEmail()
    .withMessage("Please provide a valid email address")
    .normalizeEmail(),

  body("password")
    .notEmpty()
    .withMessage("Password is required"),
];



