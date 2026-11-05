import mongoose from "mongoose";

const destinationSchema = new mongoose.Schema(
{
// Destination name
name: {
type: String,
required: [true, "Destination name is required"],
trim: true,
maxlength: [150, "Destination name cannot exceed 150 characters"],
},

// Country where the destination is located
country: {
  type: String,
  required: [true, "Country is required"],
  trim: true,
  maxlength: [100, "Country cannot exceed 100 characters"],
},

// Unique URL-friendly name
slug: {
  type: String,
  required: [true, "Destination slug is required"],
  unique: true,
  trim: true,
  lowercase: true,
  match: [
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Slug must contain lowercase letters, numbers, and hyphens only",
  ],
},

// Destination description
description: {
  type: String,
  required: [true, "Destination description is required"],
  trim: true,
  maxlength: [3000, "Description cannot exceed 3000 characters"],
},

// Geographic coordinates
coordinates: {
  latitude: {
    type: Number,
    required: [true, "Latitude is required"],
    min: [-90, "Latitude must be at least -90"],
    max: [90, "Latitude cannot exceed 90"],
  },

  longitude: {
    type: Number,
    required: [true, "Longitude is required"],
    min: [-180, "Longitude must be at least -180"],
    max: [180, "Longitude cannot exceed 180"],
  },
},

// Destination image
image: {
  url: {
    type: String,
    required: [true, "Destination image URL is required"],
    trim: true,
  },

  publicId: {
    type: String,
    default: "",
    trim: true,
  },
},

// Additional useful fields
region: {
  type: String,
  trim: true,
  default: "",
  maxlength: [100, "Region cannot exceed 100 characters"],
},

highlights: {
  type: [String],
  default: [],
},

bestTimeToVisit: {
  type: String,
  trim: true,
  default: "",
  maxlength: [200, "Best time to visit cannot exceed 200 characters"],
},

isFeatured: {
  type: Boolean,
  default: false,
},

status: {
  type: String,
  enum: ["active", "inactive"],
  default: "active",
},

isDeleted: {
  type: Boolean,
  default: false,
},

},
{
timestamps: true,
versionKey: false,
}
);

// Indexes
destinationSchema.index({ country: 1, status: 1 });
destinationSchema.index({ isFeatured: 1, status: 1 });
destinationSchema.index({ isDeleted: 1 });

const Destination =
mongoose.models.Destination ||
mongoose.model("Destination", destinationSchema);

export default Destination;
