
import express from "express";

import {
  getMyProfile,
  updateMyProfile,
  updateTravelPreferences,
  updateNotificationPreferences,
  updateProfileImage,
  deactivateMyAccount,
} from "../controllers/userProfileController.js";

import { authMiddleware } from "../middleware/authMiddleware.js";
import upload from "../middleware/uploadMiddleware.js";
import { validatorMiddleware } from "../middleware/validatorMiddleware.js";
import { updateMyProfileValidator } from "../validators/userProfileValidator.js";

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

router.get("/me", getMyProfile);

router.patch(
  "/me",
  updateMyProfileValidator,
  validatorMiddleware,
  updateMyProfile
);

router.patch(
  "/preferences",
  updateMyProfileValidator,
  validatorMiddleware,
  updateTravelPreferences
);

router.patch(
  "/notifications",
  updateMyProfileValidator,
  validatorMiddleware,
  updateNotificationPreferences
);

router.patch(
  "/image",
  upload.single("profileImage"),
  updateProfileImage
);

router.delete("/me", deactivateMyAccount);

export default router;