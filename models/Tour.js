
import mongoose from "mongoose";

const imageSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: true,
    },
    publicId: {
      type: String,
      required: true,
    },
  },
  { _id: false }
);

// Daily tour plan
const dayPlanSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    time: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { _id: false }
);

const meetingPointSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      required: true,
    },
    address: {
      type: String,
      trim: true,
      required: true,
    },
    instructions: {
      type: String,
      trim: true,
      default: "",
    },
    coordinates: {
      lat: {
        type: Number,
        min: -90,
        max: 90,
      },
      lng: {
        type: Number,
        min: -180,
        max: 180,
      },
    },
  },
  { _id: false }
);

const tourSchema = new mongoose.Schema(
  {
    operatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    destinationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Destination",
      required: true,
      index: true,
    },

    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
      index: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 150,
    },

    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
      minlength: 20,
    },

    // Total tour duration in days
    durationDays: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isInteger,
        message: "Tour duration must be a whole number of days",
      },
    },

    // Number of overnight stays
    nights: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: "Nights must be a whole number",
      },
    },

    // Retained for compatibility with existing API code
    durationMinutes: {
      type: Number,
      required: true,
      min: 1,
    },

    highlights: {
      type: [String],
      default: [],
    },

    // Day 1, Day 2, Day 3...
    days: {
      type: [dayPlanSchema],
      default: [],
    },

    inclusions: {
      type: [String],
      default: [],
    },

    exclusions: {
      type: [String],
      default: [],
    },

    meetingPoint: {
      type: meetingPointSchema,
      required: true,
    },

    // Operator's WhatsApp contact number
   whatsappNumber: {
  type: String,
  trim: true,
  required: true,
  match: [
    /^\+[1-9]\d{7,14}$/,
    "Enter a valid WhatsApp number with country code, e.g. +919876543210",
  ],
},

    images: {
      type: [imageSchema],
      default: [],
      validate: {
        validator: (images) => images.length <= 5,
        message: "A tour can have a maximum of 5 images",
      },
    },

    basePrice: {
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

    cancellationPolicy: {
      type: String,
      required: true,
      trim: true,
    },

    minParticipants: {
      type: Number,
      default: 1,
      min: 1,
    },

    maxParticipants: {
      type: Number,
      default: 10,
      min: 1,
    },

    ageRestrictions: {
      minAge: {
        type: Number,
        default: 0,
        min: 0,
      },
      maxAge: {
        type: Number,
        default: null,
        min: 0,
      },
    },

    difficultyLevel: {
      type: String,
      enum: ["easy", "moderate", "challenging"],
      default: "easy",
    },

    languages: {
      type: [String],
      default: ["English"],
    },

    tags: {
      type: [String],
      default: [],
    },

    instantBooking: {
      type: Boolean,
      default: false,
    },

    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
      index: true,
    },

    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },

    reviewCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Helpful indexes for public browsing
tourSchema.index({
  status: 1,
  isDeleted: 1,
  destinationId: 1,
});

tourSchema.index({
  status: 1,
  isDeleted: 1,
  basePrice: 1,
});

export default mongoose.model("Tour", tourSchema);
