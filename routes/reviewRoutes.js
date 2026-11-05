
import express from "express";

import {
  createReview,
  getTourReviews,
  getMyReviews,
  getReviewsForModeration,
  moderateReview,
  deleteMyReview,
} from "../controllers/reviewController.js";

import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

// Public route
router.get("/tour/:tourId", getTourReviews);

// Traveler routes
router.post("/", authMiddleware, createReview);
router.get("/my-reviews", authMiddleware, getMyReviews);
router.delete("/:id", authMiddleware, deleteMyReview);


// Operator/admin moderation routes
router.get("/moderation", authMiddleware, getReviewsForModeration);
router.patch("/:id/moderate", authMiddleware, moderateReview);

export default router;
