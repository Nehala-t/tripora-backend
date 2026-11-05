
import express from "express";

import {
  getAllTours,
  getTourById,
  getTourBySlug,
  getMyTours,
  createTour,
  updateTour,
  publishTour,
  unpublishTour,
  deleteTour,
} from "../controllers/tourController.js";

import { authMiddleware } from "../middleware/authMiddleware.js";
import upload from "../middleware/uploadMiddleware.js";

import {
  createTourValidator,
  updateTourValidator,
} from "../validators/tourValidator.js";
import { validatorMiddleware } from "../middleware/validatorMiddleware.js";

const router = express.Router();

// PUBLIC ROUTES
router.get("/", getAllTours);
router.get("/slug/:slug", getTourBySlug);
router.get("/id/:id", getTourById);

// OPERATOR ROUTES
router.get("/operator/my-tours", authMiddleware, getMyTours);

// Create a tour
router.post(
  "/create",
  authMiddleware,
  upload.array("images", 10),
  createTourValidator,
  validatorMiddleware,
  createTour
);

// Publish a tour
router.patch("/:id/publish", authMiddleware, publishTour);

// Unpublish a tour
router.patch("/:id/unpublish", authMiddleware, unpublishTour);

// Update a tour
router.patch(
  "/:id",
  authMiddleware,
  upload.array("images", 10),
  updateTourValidator,
  validatorMiddleware,
  updateTour
);

// Soft-delete a tour
router.delete("/:id", authMiddleware, deleteTour);

export default router;
