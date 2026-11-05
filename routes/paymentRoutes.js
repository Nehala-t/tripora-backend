
import express from "express";

import { createCheckoutSession,verifyCheckoutSession } from "../controllers/paymentController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post(
  "/create-checkout-session",
  authMiddleware,
  createCheckoutSession
);

router.post(
  "/verify-session",
  authMiddleware,
  verifyCheckoutSession
);

export default router;
