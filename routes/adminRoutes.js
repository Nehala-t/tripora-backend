import express from "express";

import {
  getDashboardStats,
  getAllUsers,
  updateUserStatus,
  updateOperatorStatus,
  getAllOperators,
  updateOperatorVerification,
  getAllTours,
  updateTourStatus,
  getAllBookings,
  getAllPayments,
  getAllPayouts,
  getAdminReports,
  getAllReviews,
  deleteAdminTour,
} from "../controllers/adminController.js";


import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/dashboard", getDashboardStats);

router.get("/users", getAllUsers);
router.patch("/users/:userId/status", updateUserStatus);

router.patch(
  "/operators/:operatorId/status",
  updateOperatorStatus
);
router.get("/operators", getAllOperators);
router.patch(
  "/operators/:operatorId/verification",
  updateOperatorVerification
);

router.get("/tours", getAllTours);
router.patch("/tours/:tourId/status", updateTourStatus);
router.delete("/tours/:tourId", deleteAdminTour);

router.get("/bookings", getAllBookings);
router.get("/payments", getAllPayments);
router.get("/payouts", getAllPayouts);



router.get(
  "/reviews",
  getAllReviews
);

router.get("/reports", getAdminReports);

export default router;
