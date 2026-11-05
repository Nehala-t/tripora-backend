import express from "express";

import {
  createDestination,
  getAllDestinations,
  getDestinationById,
  getDestinationBySlug,
  updateDestination,
  deleteDestination,
  getFeaturedDestinations,
  getDestinationsByCountry,
  
} from "../controllers/destinationController.js";

import { authMiddleware } from "../middleware/authMiddleware.js";
import { validatorMiddleware } from "../middleware/validatorMiddleware.js";

import upload from "../middleware/uploadMiddleware.js";

import {
  createDestinationValidator,
  destinationsByCountryValidator,
  destinationSlugValidator,
  destinationIdValidator,
  featuredDestinationsValidator,
  updateDestinationValidator,
} from "../validators/destinationValidator.js";

const router = express.Router();

// Public routes
router.get("/", getAllDestinations);

router.get(
  "/featured",
  featuredDestinationsValidator,
  validatorMiddleware,
  getFeaturedDestinations
);

router.get(
  "/country/:country",
  destinationsByCountryValidator,
  validatorMiddleware,
  getDestinationsByCountry
);

router.get(
  "/slug/:slug",
  destinationSlugValidator,
  validatorMiddleware,
  getDestinationBySlug
);

router.get(
  "/:id",
  destinationIdValidator,
  validatorMiddleware,
  getDestinationById
);

// Protected routes — admin only
router.post(
  "/create",
  authMiddleware,
  upload.single("image"),
  createDestinationValidator,
  validatorMiddleware,
  createDestination
);

router.patch(
  "/:id",
  authMiddleware,
  upload.single("image"),
  updateDestinationValidator,
  validatorMiddleware,
  updateDestination
);

router.delete(
  "/:id",
  authMiddleware,
  destinationIdValidator,
  validatorMiddleware,
  deleteDestination
);

export default router;
