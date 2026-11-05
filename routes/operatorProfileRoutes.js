
import express from "express";

import {
  getOperatorProfile,
  updateOperatorProfile,
  updateOperatorProfileImage,
  updateOperatorBusinessDetails,
  getOperatorVerificationStatus,
} from "../controllers/operatorProfileController.js";

import { authMiddleware } from "../middleware/authMiddleware.js";
import upload from "../middleware/uploadMiddleware.js";

const router = express.Router();

// All routes require authentication.
router.use(authMiddleware);

// Operator profile
router.get("/me", getOperatorProfile);
router.patch("/me", updateOperatorProfile);

// Profile image
router.patch(
  "/image",
  upload.single("profileImage"),
  updateOperatorProfileImage
);

// Business details
router.patch("/business", updateOperatorBusinessDetails);

// Verification status
router.get("/verification", getOperatorVerificationStatus);

export default router;