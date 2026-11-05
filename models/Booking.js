
import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
  {
    travelerDetails: {
      fullName: {
        type: String,
        required: true,
        trim: true,
      },
      email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
      },
      phone: {
        type: String,
        required: true,
        trim: true,
      },
    },

    bookingReference: {
      type: String,
      unique: true,
      index: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    operatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    tourId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tour",
      required: true,
      index: true,
    },

    availabilitySlotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AvailabilitySlot",
      required: true,
      index: true,
    },

    // Customer's selected tour date
    travelDate: {
      type: Date,
      required: true,
      index: true,
    },

    // Number of participants
    participants: {
      type: Number,
      required: true,
      min: 1,
    },

    // Customer's special requirements
    specialRequests: {
      type: String,
      trim: true,
      default: "",
      maxlength: 1000,
    },

    pricePerParticipant: {
      type: Number,
      required: true,
      min: 0,
    },

    totalPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    currency: {
      type: String,
      enum: ["INR", "USD", "EUR", "GBP", "AED"],
      default: "INR",
      uppercase: true,
    },

    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
    },

    paymentMethod: {
      type: String,
      enum: ["stripe", "razorpay", "cash", "none"],
      default: "none",
    },

    paymentId: {
      type: String,
      default: null,
    },
    stripeCheckoutSessionId: {
  type: String,
  default: null,
},

    status: {
      type: String,
      enum: [
        "pending",
        "confirmed",
        "cancelled",
        "rejected",
        "completed",
      ],
      default: "pending",
      index: true,
    },

    cancellationReason: {
      type: String,
      trim: true,
      default: "",
    },

    cancelledAt: {
      type: Date,
      default: null,
    },

    confirmedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
bookingSchema.index({ userId: 1, createdAt: -1 });
bookingSchema.index({ operatorId: 1, createdAt: -1 });
bookingSchema.index({ tourId: 1, status: 1 });
bookingSchema.index({
  availabilitySlotId: 1,
  travelDate: 1,
  status: 1,
});

export default mongoose.model("Booking", bookingSchema);
