import express from "express";

import {
  getMyWishlist,
  addToWishlist,
  removeFromWishlist,
  checkWishlist,
  clearWishlist,
} from "../controllers/wishlistController.js";

import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", getMyWishlist);
router.get("/check/:tourId", checkWishlist);
router.post("/add", addToWishlist);
router.delete("/clear", clearWishlist);
router.delete("/:tourId", removeFromWishlist);

export default router;
