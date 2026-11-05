import mongoose from "mongoose";
import Wishlist from "../models/Wishlist.js";
import Tour from "../models/Tour.js";
import HttpError from "../utils/httpError.js";

// 1. Get the logged-in user's wishlist
export const getMyWishlist = async (req, res, next) => {
  try {
    const userId = req.user.user_id || req.user._id;

    const wishlist = await Wishlist.findOne({ userId })
      .populate({
        path: "tourIds",
        match: { status: "published" },
      })
      .lean();

    res.status(200).json({
      success: true,
      message: "Wishlist retrieved successfully",
      data: wishlist ? wishlist.tourIds.filter(Boolean) : [],
    });
  } catch (error) {
    next(error);
  }
};

// 2. Add a tour to the wishlist
export const addToWishlist = async (req, res, next) => {
  try {
    const userId = req.user.user_id || req.user._id;
    const { tourId } = req.body;

    if (!mongoose.isValidObjectId(tourId)) {
      return next(new HttpError(400, "Invalid tour ID"));
    }

    const tour = await Tour.findOne({
      _id: tourId,
      status: "published",
    });

    if (!tour) {
      return next(
        new HttpError(404, "Published tour not found")
      );
    }

    const wishlist = await Wishlist.findOneAndUpdate(
      { userId },
      { $addToSet: { tourIds: tourId } },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    );

    res.status(200).json({
      success: true,
      message: "Tour added to wishlist successfully",
      data: wishlist,
    });
  } catch (error) {
    next(error);
  }
};

// 3. Remove a specific tour from the wishlist
export const removeFromWishlist = async (req, res, next) => {
  try {
    const userId = req.user.user_id || req.user._id;
    const { tourId } = req.params;

    if (!mongoose.isValidObjectId(tourId)) {
      return next(new HttpError(400, "Invalid tour ID"));
    }

    const wishlist = await Wishlist.findOneAndUpdate(
      { userId },
      { $pull: { tourIds: tourId } },
      { new: true }
    );

    if (!wishlist) {
      return next(new HttpError(404, "Wishlist not found"));
    }

    res.status(200).json({
      success: true,
      message: "Tour removed from wishlist successfully",
      data: wishlist,
    });
  } catch (error) {
    next(error);
  }
};

// 4. Check whether a tour is in the wishlist
export const checkWishlist = async (req, res, next) => {
  try {
    const userId = req.user.user_id || req.user._id;
    const { tourId } = req.params;

    if (!mongoose.isValidObjectId(tourId)) {
      return next(new HttpError(400, "Invalid tour ID"));
    }

    const wishlist = await Wishlist.exists({
      userId,
      tourIds: tourId,
    });

    res.status(200).json({
      success: true,
      data: {
        isWishlisted: Boolean(wishlist),
      },
    });
  } catch (error) {
    next(error);
  }
};

// 5. Clear the entire wishlist
export const clearWishlist = async (req, res, next) => {
  try {
    const userId = req.user.user_id || req.user._id;

    const wishlist = await Wishlist.findOneAndUpdate(
      { userId },
      { $set: { tourIds: [] } },
      { new: true }
    );

    if (!wishlist) {
      return next(new HttpError(404, "Wishlist not found"));
    }

    res.status(200).json({
      success: true,
      message: "Wishlist cleared successfully",
      data: wishlist,
    });
  } catch (error) {
    next(error);
  }
};
