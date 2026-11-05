
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    // ========================================
    // PERSONAL INFORMATION
    // ========================================

    firstName: {
      type: String,
      required: [true, "First name is required"],
      trim: true,
      minlength: [2, "First name must contain at least 2 characters"],
      maxlength: [50, "First name cannot exceed 50 characters"],
    },

    lastName: {
      type: String,
      required: [true, "Last name is required"],
      trim: true,
      minlength: [1, "Last name must contain at least 1 character"],
      maxlength: [50, "Last name cannot exceed 50 characters"],
    },

    email: {
      type: String,
      required: [true, "Email address is required"],
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: [254, "Email address is too long"],
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        "Please provide a valid email address",
      ],
    },

    phone: {
      type: String,
      trim: true,
      default: null,
      maxlength: [20, "Phone number cannot exceed 20 characters"],
    },

    // ========================================
    // AUTHENTICATION
    // ========================================

    password: {
      type: String,
      required: [true, "Password is required"],
      select: false,
    },

    // ========================================
    // PROFILE INFORMATION
    // ========================================

    profileImage: {
      url: {
        type: String,
        default: null,
      },
      publicId: {
        type: String,
        default: null,
      },
    },

    bio: {
      type: String,
      trim: true,
      maxlength: [500, "Bio cannot exceed 500 characters"],
      default: "",
    },

    country: {
      type: String,
      trim: true,
      maxlength: 100,
      default: "",
    },

    city: {
      type: String,
      trim: true,
      maxlength: 100,
      default: "",
    },

    // ========================================
    // USER PREFERENCES
    // ========================================

    preferredLanguage: {
      type: String,
      trim: true,
      default: "en",
    },

    preferredCurrency: {
      type: String,
      uppercase: true,
      trim: true,
      default: "INR",
      enum: {
        values: ["INR", "USD", "EUR", "GBP", "AED"],
        message: "Unsupported preferred currency",
      },
    },

    preferredDestinations: {
      type: [String],
      default: [],
    },

    travelStyle: {
      type: String,
      enum: [
        "adventure",
        "relaxation",
        "luxury",
        "budget",
        "cultural",
        "family",
        "solo",
      ],
      default: "adventure",
    },

    budget: {
      type: String,
      enum: ["Low", "Medium", "High"],
      default: "Medium",
    },

    travelInterests: {
      type: [
        {
          type: String,
          enum: [
            "adventure",
            "culture",
            "food",
            "nature",
            "sightseeing",
            "water_sports",
            "wildlife",
            "wellness",
          ],
        },
      ],
      default: [],
    },

    // ========================================
    // ROLE AND ACCOUNT STATUS
    // ========================================

    role: {
      type: String,
      enum: {
        values: ["user", "operator", "admin"],
        message: "Invalid user role",
      },
      default: "user",
      required: true,
      immutable: true,
    },

    status: {
      type: String,
      enum: ["active", "inactive", "suspended"],
      default: "active",
      required: true,
    },

    // ========================================
    // EMAIL VERIFICATION
    // ========================================

    emailVerified: {
      type: Boolean,
      default: false,
    },

    emailVerificationTokenHash: {
      type: String,
      select: false,
      default: null,
    },

    emailVerificationExpires: {
      type: Date,
      select: false,
      default: null,
    },

    // ========================================
    // PASSWORD RESET
    // ========================================

    passwordResetTokenHash: {
      type: String,
      select: false,
      default: null,
    },

    passwordResetExpires: {
      type: Date,
      select: false,
      default: null,
    },

    passwordChangedAt: {
      type: Date,
      select: false,
      default: null,
    },

    // ========================================
    // SELLER / TOUR OPERATOR VERIFICATION
    // ========================================

    sellerVerificationStatus: {
      type: String,
      enum: [
        "not_applicable",
        "not_submitted",
        "pending",
        "approved",
        "rejected",
      ],
      default: function () {
        return this.role === "operator"
          ? "not_submitted"
          : "not_applicable";
      },
    },

    sellerRejectionReason: {
      type: String,
      trim: true,
      maxlength: [500, "Rejection reason cannot exceed 500 characters"],
      default: "",
    },

    sellerApplicationSubmittedAt: {
      type: Date,
      default: null,
    },

    sellerApprovedAt: {
      type: Date,
      default: null,
    },

    // ========================================
    // OPERATOR BUSINESS PROFILE
    // ========================================

    operatorProfile: {
      businessName: {
        type: String,
        trim: true,
        maxlength: 150,
        default: "",
      },

      businessDescription: {
        type: String,
        trim: true,
        maxlength: 1000,
        default: "",
      },

      businessEmail: {
        type: String,
        trim: true,
        lowercase: true,
        default: "",
      },

      businessPhone: {
        type: String,
        trim: true,
        default: "",
      },

      website: {
        type: String,
        trim: true,
        default: "",
      },

      businessAddress: {
        type: String,
        trim: true,
        default: "",
      },
    },

    // ========================================
    // ACCOUNT SETTINGS
    // ========================================

    notificationPreferences: {
      email: {
        type: Boolean,
        default: true,
      },

      inApp: {
        type: Boolean,
        default: true,
      },

      bookingReminders: {
        type: Boolean,
        default: true,
      },

      marketingEmails: {
        type: Boolean,
        default: false,
      },
    },

    lastLoginAt: {
      type: Date,
      default: null,
    },

    isDeleted: {
      type: Boolean,
      default: false,
      select: false,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// ========================================
// INDEXES
// ========================================

userSchema.index({ role: 1, status: 1 });
userSchema.index({ sellerVerificationStatus: 1 });
userSchema.index({ isDeleted: 1 });

// ========================================
// VIRTUAL: FULL NAME
// ========================================

userSchema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.lastName}`.trim();
});

// ========================================
// JSON OUTPUT
// ========================================

userSchema.set("toJSON", {
  virtuals: true,

  transform: function (doc, ret) {
    delete ret.password;
    delete ret.emailVerificationTokenHash;
    delete ret.emailVerificationExpires;
    delete ret.passwordResetTokenHash;
    delete ret.passwordResetExpires;
    delete ret.passwordChangedAt;
    delete ret.__v;
    delete ret.isDeleted;

    return ret;
  },
});

// ========================================
// MODEL EXPORT
// ========================================

const User =
  mongoose.models.User ||
  mongoose.model("User", userSchema);

export default User;