
import express from "express";

import {
  createBooking,
  getMyBookings,
  getBookingById,
  cancelBooking,
  getOperatorBookings,
  manageOperatorBooking,
} from "../controllers/bookingController.js";

import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

// Traveler routes
router.post("/", authMiddleware, createBooking);
router.get("/my-bookings", authMiddleware, getMyBookings);
router.patch("/:id/cancel", authMiddleware, cancelBooking);

// Operator routes
router.get("/operator", authMiddleware, getOperatorBookings);
router.patch("/:id/status", authMiddleware, manageOperatorBooking);

// Get one booking by ID.
// Keep this after specific routes.
router.get("/:id", authMiddleware, getBookingById);

export default router;
