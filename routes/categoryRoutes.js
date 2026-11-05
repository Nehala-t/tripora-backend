import express from "express";

import {
  createCategory,
  getAllCategories,
  getCategoryById,
  getCategoryBySlug,
  updateCategory,
  updateCategoryStatus,
  deleteCategory,
} from "../controllers/categoryController.js";

import { authMiddleware } from "../middleware/authMiddleware.js";
import upload from "../middleware/uploadMiddleware.js";

const router = express.Router();

// ========================================
// PUBLIC ROUTES
// ========================================

// Get all active categories (search, pagination, sorting)
router.get("/", getAllCategories);

// Get active category by slug
router.get("/slug/:slug", getCategoryBySlug);

// Get active category by ID
router.get("/:id", getCategoryById);

// ========================================
// OPERATOR ROUTES
// ========================================

// Create category with optional image
router.post(
  "/create",
  authMiddleware,
  upload.single("image"),
  createCategory
);

// Update category details and optionally replace image
router.patch(
  "/:id",
  authMiddleware,
  upload.single("image"),
  updateCategory
);

// Activate or deactivate category
router.patch(
  "/:id/status",
  authMiddleware,
  updateCategoryStatus
);

// Soft-delete category
router.delete(
  "/:id",
  authMiddleware,
  deleteCategory
);

export default router;
