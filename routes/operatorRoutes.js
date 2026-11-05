import express from "express";

import {
  getOperatorDashboard,
  createOperatorTour,
  getOperatorTours,
  updateOperatorTour,
  publishOperatorTour,
  deleteOperatorTour,
  getOperatorSchedules,
  createOperatorSchedule,
  getOperatorBookings,
  updateOperatorBookingStatus,
  getOperatorGuests,
  getOperatorReviews,
  getOperatorEarnings,
} from "../controllers/operatorController.js";

import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

// All operator endpoints require authentication.
router.use(authMiddleware);

// Dashboard
router.get("/dashboard", getOperatorDashboard);

// Tour management
router.route("/tours")
  .get(getOperatorTours)
  .post(createOperatorTour);

router.patch("/tours/:tourId", updateOperatorTour);
router.patch("/tours/:tourId/publish", publishOperatorTour);
router.delete("/tours/:tourId", deleteOperatorTour);

// Schedules
router.get("/schedules", getOperatorSchedules);
router.post("/schedules", createOperatorSchedule);

// Bookings
router.get("/bookings", getOperatorBookings);

router.patch(
  "/bookings/:bookingId/status",
  updateOperatorBookingStatus
);

// Guests, reviews, and earnings
router.get("/guests", getOperatorGuests);
router.get("/reviews", getOperatorReviews);
router.get("/earnings", getOperatorEarnings);

export default router;
