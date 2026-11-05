import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    // User who receives the notification
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Notification category
    type: {
      type: String,
      required: true,
      enum: [
        // Authentication and account
        "account_created",
"login_success",
        "email_verification",
        "password_changed",
        "profile_updated",
        "account_status_changed",

        // Operator verification
        "operator_verification_submitted",
        "operator_approved",
        "operator_rejected",

        // Tour management
        "tour_submitted",
        "tour_approved",
        "tour_rejected",
        "tour_published",
        "tour_unpublished",
        "tour_schedule_changed",
        "tour_availability_changed",

        // Bookings
        "booking_created",
        "booking_confirmed",
        "booking_cancelled",
        "booking_rejected",
        "booking_completed",
        "booking_reminder",
        "booking_updated",

        // Payments and refunds
        "payment_success",
        "payment_failed",
        "refund_initiated",
        "refund_completed",
        "refund_failed",
        "operator_payout_processed",

        // Reviews and ratings
        "review_submitted",
        "review_approved",
        "review_rejected",
        "review_received",
        "review_reply",

        "availability_created",
"availability_updated",
"availability_deleted",
"availability_blocked",
"availability_unblocked",

        // Support and general
        "support_ticket_created",
        "support_reply",
        "announcement",
        "general",
      ],
      index: true,
    },

    // Notification heading
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    // Notification content
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },

    // Optional reference to related records
    relatedBookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      default: null,
      index: true,
    },

    relatedTourId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tour",
      default: null,
      index: true,
    },

    relatedReviewId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Review",
      default: null,
      index: true,
    },

    // Read/unread tracking
    readAt: {
      type: Date,
      default: null,
    },

    // Email delivery tracking
    emailSent: {
      type: Boolean,
      default: false,
    },

    emailSentAt: {
      type: Date,
      default: null,
    },

    // Optional email error information
    emailError: {
      type: String,
      default: null,
      maxlength: 1000,
    },

    // Optional additional information for frontend navigation
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Efficient queries for notification lists and unread counts
notificationSchema.index({
  userId: 1,
  readAt: 1,
  createdAt: -1,
});

export default mongoose.model("Notification", notificationSchema);
