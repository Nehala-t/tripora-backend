
import express from "express";

import {
  createAvailabilitySlot,
  getTourAvailability,
  getOperatorAvailability,
  getAvailabilitySlotById,
  checkAvailability,
  updateAvailabilitySlot,
  blockAvailabilitySlot,
  unblockAvailabilitySlot,
  deleteAvailabilitySlot,
} from "../controllers/availabilityController.js";

import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

// Public routes
router.get("/tour/:tourId", getTourAvailability);
router.get("/check/:id", checkAvailability);

// Operator routes
router.get(
  "/operator/my-slots",
  authMiddleware,
  getOperatorAvailability
);

router.post(
  "/",
  authMiddleware,
  createAvailabilitySlot
);

router.patch(
  "/:id/block",
  authMiddleware,
  blockAvailabilitySlot
);

router.patch(
  "/:id/unblock",
  authMiddleware,
  unblockAvailabilitySlot
);

router.patch(
  "/:id",
  authMiddleware,
  updateAvailabilitySlot
);

router.delete(
  "/:id",
  authMiddleware,
  deleteAvailabilitySlot
);

// Keep this after the more specific GET routes.
router.get("/:id", getAvailabilitySlotById);

export default router;
