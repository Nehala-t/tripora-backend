import mongoose from "mongoose";

const availabilitySlotSchema = new mongoose.Schema(
  {
    tourId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tour",
      required: true,
      index: true,
    },

    startAt: {
      type: Date,
      required: true,
      index: true,
    },

    endAt: {
      type: Date,
      required: true,
    },

    capacity: {
      type: Number,
      required: true,
      min: 1,
    },

    reservedCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    price: {
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

    status: {
      type: String,
      enum: ["available", "full", "blocked", "cancelled"],
      default: "available",
      index: true,
    },

    isBlockedDate: {
      type: Boolean,
      default: false,
    },

    blockedReason: {
      type: String,
      trim: true,
      default: "",
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Validate that the end time is after the start time.
availabilitySlotSchema.pre("validate", function () {
  if (
    this.startAt &&
    this.endAt &&
    this.endAt <= this.startAt
  ) {
    this.invalidate(
      "endAt",
      "End time must be after start time."
    );
  }

  if (this.reservedCount > this.capacity) {
    this.invalidate(
      "reservedCount",
      "Reserved count cannot exceed capacity."
    );
  }

  if (this.isBlockedDate) {
    this.status = "blocked";
  } else if (
    this.status !== "cancelled" &&
    this.status !== "blocked" &&
    this.reservedCount >= this.capacity
  ) {
    this.status = "full";
  } else if (
    this.status === "full" &&
    this.reservedCount < this.capacity
  ) {
    this.status = "available";
  }
});

// Helps search a tour's slots by date and status.
availabilitySlotSchema.index({
  tourId: 1,
  startAt: 1,
  status: 1,
});

export default mongoose.model(
  "AvailabilitySlot",
  availabilitySlotSchema
);