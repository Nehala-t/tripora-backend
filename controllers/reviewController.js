
import mongoose from "mongoose";

import Review from "../models/Review.js";
import Booking from "../models/Booking.js";
import Tour from "../models/Tour.js";
import HttpError from "../utils/httpError.js";
import { createNotification } from "../utils/notificationService.js";

// --------------------------------------------------
// HELPERS
// --------------------------------------------------

const getUserId = (req) =>
  req.user?._id ||
  req.user?.id ||
  req.user?.user_id ||
  req.user?.userId;

const isValidId = (id) =>
  typeof id === "string" &&
  mongoose.Types.ObjectId.isValid(id);

const requireRole = (req, next, roles) => {
  if (!req.user) {
    next(new HttpError("Authentication required", 401));
    return false;
  }

  if (!roles.includes(req.user.role)) {
    next(new HttpError("You are not authorized to perform this action", 403));
    return false;
  }

  if (!getUserId(req)) {
    next(new HttpError("User ID not found in authentication token", 401));
    return false;
  }

  return true;
};

// --------------------------------------------------
// SAFE NOTIFICATION HELPER
// Notification failure must not break review actions.
// --------------------------------------------------

const notifySafely = async (notificationData) => {
  try {
    if (!notificationData.userId) {
      console.warn("Review notification skipped: recipient not found");
      return;
    }

    await createNotification(notificationData);
  } catch (error) {
    console.error("Review notification failed:", error.message);
  }
};

// --------------------------------------------------
// RECALCULATE TOUR RATING
// Approved reviews only
// --------------------------------------------------

const updateTourRating = async (tourId) => {
  const result = await Review.aggregate([
    {
      $match: {
        tourId: new mongoose.Types.ObjectId(String(tourId)),
        status: "approved",
      },
    },
    {
      $group: {
        _id: "$tourId",
        averageRating: { $avg: "$rating" },
        reviewCount: { $sum: 1 },
      },
    },
  ]);

  const averageRating = result.length
    ? Math.round(result[0].averageRating * 10) / 10
    : 0;

  const reviewCount = result.length ? result[0].reviewCount : 0;

  await Tour.updateOne(
    { _id: tourId },
    {
      $set: {
        averageRating,
        reviewCount,
      },
    }
  );
};

// --------------------------------------------------
// GET REVIEW FOR MODERATOR
// --------------------------------------------------


// --------------------------------------------------
// 4. GET REVIEWS TO MODERATE
// GET /api/reviews/moderation
// Operator sees reviews for own tours; admin sees all
// Returns ALL review statuses
// --------------------------------------------------


// --------------------------------------------------
// 4. GET REVIEWS TO MODERATE
// GET /api/reviews/moderation
// Operator sees reviews for own tours; admin sees all
// Returns ALL review statuses
// --------------------------------------------------

export const getReviewsForModeration = async (req, res, next) => {
  try {
    if (!requireRole(req, next, ["operator", "admin"])) return;

    const allowedStatuses = ["pending", "approved", "rejected", "hidden"];

    // Build filter
    const filter = {};

    // Apply status filter only when explicitly requested.
    // Without a status query, return ALL reviews.
    if (req.query.status) {
      if (!allowedStatuses.includes(req.query.status)) {
        throw new HttpError("Invalid review status", 400);
      }

      filter.status = req.query.status;
    }

    // Operators can only see reviews for their own tours.
    if (req.user.role === "operator") {
      const tours = await Tour.find({
        operatorId: getUserId(req),
        isDeleted: { $ne: true },
      }).select("_id");

      const tourIds = tours.map((tour) => tour._id);

      filter.tourId = { $in: tourIds };
    }

    // Fetch reviews with complete populated information.
    const reviews = await Review.find(filter)
      .populate({
        path: "userId",
        select: "name firstName email profileImage",
      })
      .populate({
        path: "tourId",
        select: "title slug images",
      })
      .populate({
        path: "bookingId",
        select: "bookingReference status",
      })
      .sort({ createdAt: -1 });

    // Calculate review statistics.
    const totalReviews = reviews.length;

    const pendingReviews = reviews.filter(
      (review) => review.status === "pending"
    ).length;

    const approvedReviews = reviews.filter(
      (review) => review.status === "approved"
    ).length;

    const rejectedReviews = reviews.filter(
      (review) => review.status === "rejected"
    ).length;

    const hiddenReviews = reviews.filter(
      (review) => review.status === "hidden"
    ).length;

    return res.status(200).json({
      success: true,
      count: totalReviews,
      stats: {
        total: totalReviews,
        pending: pendingReviews,
        approved: approvedReviews,
        rejected: rejectedReviews,
        hidden: hiddenReviews,
      },
      reviews,
    });
  } catch (error) {
    next(error);
  }
};



// --------------------------------------------------
// 1. CREATE REVIEW
// POST /api/reviews
// Completed booking owner only
// --------------------------------------------------

export const createReview = async (req, res, next) => {
  try {
    if (!requireRole(req, next, ["user"])) return;

    const userId = getUserId(req);
    const { bookingId, rating, comment } = req.body || {};

    if (!isValidId(bookingId)) {
      throw new HttpError("A valid bookingId is required", 400);
    }

    if (
      rating === undefined ||
      rating === null ||
      rating === "" ||
      typeof rating === "boolean"
    ) {
      throw new HttpError("Rating is required", 400);
    }

    const parsedRating = Number(rating);

    if (
      !Number.isInteger(parsedRating) ||
      parsedRating < 1 ||
      parsedRating > 5
    ) {
      throw new HttpError("Rating must be a whole number from 1 to 5", 400);
    }

    if (typeof comment !== "string" || comment.trim().length < 5) {
      throw new HttpError("Comment must contain at least 5 characters", 400);
    }

    if (comment.trim().length > 2000) {
      throw new HttpError("Comment cannot exceed 2000 characters", 400);
    }

    const booking = await Booking.findOne({
      _id: bookingId,
      userId,
    });

    if (!booking) {
      throw new HttpError(
        "Booking not found or you do not own this booking",
        404
      );
    }

    if (booking.status !== "completed") {
      throw new HttpError(
        "You can review a tour only after the booking is completed",
        400
      );
    }

    const existingReview = await Review.findOne({ bookingId });

    if (existingReview) {
      throw new HttpError("You have already reviewed this booking", 409);
    }

    const tour = await Tour.findById(booking.tourId);

    if (!tour) {
      throw new HttpError("Tour not found", 404);
    }

    const review = await Review.create({
      bookingId: booking._id,
      userId,
      tourId: booking.tourId,
      rating: parsedRating,
      comment: comment.trim(),
      status: "pending",
    });

    // Notify the tour operator about the new review.
    await notifySafely({
      userId: tour.operatorId,
      type: "review_received",
      title: "New Review Received",
      message: `A traveler has submitted a ${parsedRating}-star review for your tour "${tour.title}". The review is awaiting moderation.`,
      relatedBookingId: booking._id,
      relatedTourId: tour._id,
      relatedReviewId: review._id,
    });

    return res.status(201).json({
      success: true,
      message: "Review submitted successfully and is awaiting moderation",
      review,
    });
  } catch (error) {
    // A unique bookingId index also protects against concurrent duplicates.
    if (error.code === 11000) {
      return next(new HttpError("You have already reviewed this booking", 409));
    }

    next(error);
  }
};

// --------------------------------------------------
// 2. LIST PUBLIC REVIEWS FOR A TOUR
// GET /api/reviews/tour/:tourId
// Approved reviews only
// --------------------------------------------------

export const getTourReviews = async (req, res, next) => {
  try {
    const { tourId } = req.params;

    if (!isValidId(tourId)) {
      throw new HttpError("Invalid tour ID", 400);
    }

    const tour = await Tour.findOne({
      _id: tourId,
      status: "published",
      isDeleted: { $ne: true },
    });

    if (!tour) {
      throw new HttpError("Published tour not found", 404);
    }

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));

    const filter = {
      tourId,
      status: "approved",
    };

    const [reviews, total] = await Promise.all([
      Review.find(filter)
        .populate("userId", "name profileImage")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Review.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      averageRating: tour.averageRating,
      reviewCount: tour.reviewCount,
      count: reviews.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      reviews,
    });
  } catch (error) {
    next(error);
  }
};

// --------------------------------------------------
// 3. GET MY REVIEWS
// GET /api/reviews/my-reviews
// Traveler only
// --------------------------------------------------

export const getMyReviews = async (req, res, next) => {
  try {
    if (!requireRole(req, next, ["user"])) return;

    const reviews = await Review.find({
      userId: getUserId(req),
    })
      .populate("tourId", "title slug images")
      .populate("bookingId", "bookingReference status")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: reviews.length,
      reviews,
    });
  } catch (error) {
    next(error);
  }
};

// --------------------------------------------------
// 4. GET REVIEWS TO MODERATE
// GET /api/reviews/moderation?status=pending
// Operator sees own tours; admin sees all
// --------------------------------------------------



// --------------------------------------------------
// 5. MODERATE REVIEW
// PATCH /api/reviews/:id/moderate
// Operator owning tour or admin
// --------------------------------------------------

export const moderateReview = async (req, res, next) => {
  try {
    if (!requireRole(req, next, ["operator", "admin"])) return;

    const review = await getReviewForModerator(req.params.id, req.user);
    const { status, moderationNote = "" } = req.body || {};

    if (!["approved", "rejected", "hidden"].includes(status)) {
      throw new HttpError(
        "Status must be approved, rejected, or hidden",
        400
      );
    }

    if (typeof moderationNote !== "string" || moderationNote.length > 500) {
      throw new HttpError(
        "moderationNote must be text with at most 500 characters",
        400
      );
    }

    review.status = status;
    review.moderatedBy = getUserId(req);
    review.moderatedAt = new Date();
    review.moderationNote = moderationNote.trim();

    await review.save();
    await updateTourRating(review.tourId);

    // Notify the traveler when the review is approved or rejected.
    if (status === "approved" || status === "rejected") {
      const tour = await Tour.findById(review.tourId).select("title");

      const isApproved = status === "approved";

      await notifySafely({
        userId: review.userId,
        type: isApproved ? "review_approved" : "review_rejected",
        title: isApproved ? "Review Approved" : "Review Rejected",
        message: isApproved
          ? `Your review for "${tour?.title || "this tour"}" has been approved and is now visible to other travelers.`
          : `Your review for "${tour?.title || "this tour"}" has been rejected. Please check the moderation details in My Reviews.`,
        relatedBookingId: review.bookingId,
        relatedTourId: review.tourId,
        relatedReviewId: review._id,
      });
    }

    return res.status(200).json({
      success: true,
      message: `Review ${status} successfully`,
      review,
    });
  } catch (error) {
    next(error);
  }
};

// --------------------------------------------------
// 6. DELETE MY REVIEW
// DELETE /api/reviews/:id
// Traveler who owns review; pending/rejected only
// --------------------------------------------------

export const deleteMyReview = async (req, res, next) => {
  try {
    if (!requireRole(req, next, ["user"])) return;

    if (!isValidId(req.params.id)) {
      throw new HttpError("Invalid review ID", 400);
    }

    const review = await Review.findOne({
      _id: req.params.id,
      userId: getUserId(req),
    });

    if (!review) {
      throw new HttpError("Review not found", 404);
    }

    if (!["pending", "rejected"].includes(review.status)) {
      throw new HttpError(
        "Only pending or rejected reviews can be deleted by the traveler",
        400
      );
    }

    const tourId = review.tourId;

    await Review.deleteOne({ _id: review._id });
    await updateTourRating(tourId);

    return res.status(200).json({
      success: true,
      message: "Review deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};
