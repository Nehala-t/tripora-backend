import User from "../models/User.js";
import Notification from "../models/Notification.js";
import HttpError from "../utils/httpError.js";

// ========================================
// HELPER: CHECK AUTHENTICATION
// ========================================

const getAuthenticatedUserId = (req, next) => {
  const userId = req.user?.user_id;

  if (!userId) {
    next(new HttpError("Unauthorized user", 401));
    return null;
  }

  return userId;
};

// ========================================
// HELPER: CREATE NOTIFICATION
// Notification failures must not undo profile updates.
// ========================================

const createProfileNotification = async ({
  userId,
  title,
  message,
  actionUrl = "/profile",
}) => {
  try {
    await Notification.create({
      userId,
      type: "general",
      title,
      message,
      actionUrl,
    });
  } catch (error) {
    console.error(
      "Failed to create profile notification:",
      error.message
    );
  }
};

// ========================================
// HELPER: FIND ACTIVE USER
// ========================================

const findActiveUser = async (userId) => {
  return User.findOne({
    _id: userId,
    status: "active",
    isDeleted: false,
  });
};

// ========================================
// GET MY PROFILE
// GET /api/user-profile/me
// ========================================

export const getMyProfile = async (req, res, next) => {
  try {
    const userId = getAuthenticatedUserId(req, next);
    if (!userId) return;

    const user = await findActiveUser(userId);

    if (!user) {
      return next(new HttpError("User not found", 404));
    }

    res.status(200).json({
      success: true,
      message: "Profile fetched successfully",
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        profileImage: user.profileImage,
        bio: user.bio,
        country: user.country,
        city: user.city,
        preferredLanguage: user.preferredLanguage,
        preferredCurrency: user.preferredCurrency,
        travelInterests: user.travelInterests,
        preferredDestinations: user.preferredDestinations,
        travelStyle: user.travelStyle,
        budget: user.budget,
        notificationPreferences: user.notificationPreferences,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// UPDATE BASIC PROFILE
// PATCH /api/user-profile/me
// ========================================

export const updateMyProfile = async (req, res, next) => {
  try {
    const userId = getAuthenticatedUserId(req, next);
    if (!userId) return;

    const user = await findActiveUser(userId);

    if (!user) {
      return next(new HttpError("User not found", 404));
    }

    const allowedFields = [
      "firstName",
      "lastName",
      "phone",
      "bio",
      "country",
      "city",
      "preferredLanguage",
    ];

    for (const field of allowedFields) {
      if (req.body[field] === undefined) continue;

      if (typeof req.body[field] !== "string") {
        return next(
          new HttpError(`${field} must be a string`, 400)
        );
      }

      user[field] = req.body[field].trim();
    }

    if (
      !user.firstName ||
      user.firstName.trim().length < 2 ||
      !user.lastName ||
      user.lastName.trim().length < 2
    ) {
      return next(
        new HttpError(
          "First name and last name must contain at least 2 characters",
          400
        )
      );
    }

    await user.save();

    await createProfileNotification({
      userId: user._id,
      title: "Profile updated",
      message: "Your profile details were updated successfully.",
      actionUrl: "/profile",
    });

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        profileImage: user.profileImage,
        bio: user.bio,
        country: user.country,
        city: user.city,
        preferredLanguage: user.preferredLanguage,
        preferredCurrency: user.preferredCurrency,
        travelInterests: user.travelInterests,
        preferredDestinations: user.preferredDestinations,
        travelStyle: user.travelStyle,
        budget: user.budget,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// UPDATE TRAVEL PREFERENCES
// PATCH /api/user-profile/preferences
// ========================================

export const updateTravelPreferences = async (req, res, next) => {
  try {
    const userId = getAuthenticatedUserId(req, next);
    if (!userId) return;

    const user = await findActiveUser(userId);

    if (!user) {
      return next(new HttpError("User not found", 404));
    }

    const {
      travelInterests,
      preferredCurrency,
      preferredLanguage,
      preferredDestinations,
      travelStyle,
      budget,
    } = req.body;

    const allowedInterests = [
      "adventure",
      "culture",
      "food",
      "nature",
      "sightseeing",
      "water_sports",
      "wildlife",
      "wellness",
    ];

    const allowedCurrencies = ["INR", "USD", "EUR", "GBP", "AED"];

    const allowedTravelStyles = [
      "adventure",
      "relaxation",
      "luxury",
      "budget",
      "cultural",
      "family",
      "solo",
    ];

    const allowedBudgets = ["Low", "Medium", "High"];

    if (travelInterests !== undefined) {
      if (
        !Array.isArray(travelInterests) ||
        !travelInterests.every((interest) =>
          allowedInterests.includes(interest)
        )
      ) {
        return next(
          new HttpError("Invalid travel interests", 400)
        );
      }

      user.travelInterests = [...new Set(travelInterests)];
    }

    if (preferredCurrency !== undefined) {
      if (!allowedCurrencies.includes(preferredCurrency)) {
        return next(
          new HttpError("Invalid preferred currency", 400)
        );
      }

      user.preferredCurrency = preferredCurrency;
    }

    if (preferredLanguage !== undefined) {
      if (
        typeof preferredLanguage !== "string" ||
        !preferredLanguage.trim()
      ) {
        return next(
          new HttpError("Preferred language is required", 400)
        );
      }

      user.preferredLanguage = preferredLanguage.trim();
    }

    if (preferredDestinations !== undefined) {
      if (
        !Array.isArray(preferredDestinations) ||
        !preferredDestinations.every(
          (destination) =>
            typeof destination === "string" &&
            destination.trim().length > 0
        )
      ) {
        return next(
          new HttpError("Invalid preferred destinations", 400)
        );
      }

      user.preferredDestinations = preferredDestinations.map(
        (destination) => destination.trim()
      );
    }

    if (travelStyle !== undefined) {
      if (!allowedTravelStyles.includes(travelStyle)) {
        return next(new HttpError("Invalid travel style", 400));
      }

      user.travelStyle = travelStyle;
    }

    if (budget !== undefined) {
      if (!allowedBudgets.includes(budget)) {
        return next(new HttpError("Invalid travel budget", 400));
      }

      user.budget = budget;
    }

    await user.save();

    await createProfileNotification({
      userId: user._id,
      title: "Travel preferences updated",
      message: "Your travel preferences were saved successfully.",
      actionUrl: "/profile",
    });

    res.status(200).json({
      success: true,
      message: "Travel preferences updated successfully",
      travelPreferences: {
        travelInterests: user.travelInterests,
        preferredCurrency: user.preferredCurrency,
        preferredLanguage: user.preferredLanguage,
        preferredDestinations: user.preferredDestinations,
        travelStyle: user.travelStyle,
        budget: user.budget,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// UPDATE NOTIFICATION PREFERENCES
// PATCH /api/user-profile/notifications
// ========================================

export const updateNotificationPreferences = async (
  req,
  res,
  next
) => {
  try {
    const userId = getAuthenticatedUserId(req, next);
    if (!userId) return;

    const user = await findActiveUser(userId);

    if (!user) {
      return next(new HttpError("User not found", 404));
    }

    const preferences = req.body.notificationPreferences;

    if (
      !preferences ||
      typeof preferences !== "object" ||
      Array.isArray(preferences)
    ) {
      return next(
        new HttpError("Notification preferences are required", 400)
      );
    }

    const allowedKeys = [
      "email",
      "inApp",
      "bookingReminders",
      "marketingEmails",
    ];

    const preferenceKeys = Object.keys(preferences);

    if (preferenceKeys.length === 0) {
      return next(
        new HttpError(
          "Provide at least one notification preference",
          400
        )
      );
    }

    for (const key of preferenceKeys) {
      if (
        !allowedKeys.includes(key) ||
        typeof preferences[key] !== "boolean"
      ) {
        return next(
          new HttpError(
            `Invalid notification preference: ${key}`,
            400
          )
        );
      }
    }

    const currentPreferences =
      user.notificationPreferences?.toObject?.() ||
      user.notificationPreferences ||
      {};

    user.notificationPreferences = {
      ...currentPreferences,
      ...preferences,
    };

    await user.save();

    await createProfileNotification({
      userId: user._id,
      title: "Notification settings updated",
      message: "Your notification preferences were saved successfully.",
      actionUrl: "/profile",
    });

    res.status(200).json({
      success: true,
      message: "Notification preferences updated successfully",
      notificationPreferences: user.notificationPreferences,
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// UPDATE PROFILE IMAGE
// PATCH /api/user-profile/image
// ========================================

export const updateProfileImage = async (req, res, next) => {
  try {
    const userId = getAuthenticatedUserId(req, next);
    if (!userId) return;

    if (!req.file) {
      return next(
        new HttpError("Please upload a profile image", 400)
      );
    }

    const user = await findActiveUser(userId);

    if (!user) {
      return next(new HttpError("User not found", 404));
    }

    const imageUrl = req.file.path || req.file.secure_url;
    const publicId = req.file.filename || req.file.public_id;

    if (!imageUrl) {
      return next(
        new HttpError(
          "Image upload failed. Please try again",
          400
        )
      );
    }

    user.profileImage = {
      url: imageUrl,
      publicId: publicId || "",
    };

    await user.save();

    await createProfileNotification({
      userId: user._id,
      title: "Profile picture updated",
      message: "Your profile picture was updated successfully.",
      actionUrl: "/profile",
    });

    res.status(200).json({
      success: true,
      message: "Profile image updated successfully",
      profileImage: user.profileImage,
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// DEACTIVATE MY ACCOUNT
// DELETE /api/user-profile/me
// ========================================

export const deactivateMyAccount = async (req, res, next) => {
  try {
    const userId = getAuthenticatedUserId(req, next);
    if (!userId) return;

    const user = await User.findOne({
      _id: userId,
      isDeleted: false,
    });

    if (!user) {
      return next(new HttpError("User not found", 404));
    }

    user.status = "inactive";
    user.isDeleted = true;

    await user.save();

    res.clearCookie("accessToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite:
        process.env.NODE_ENV === "production" ? "none" : "lax",
      path: "/",
    });

    res.clearCookie("role", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite:
        process.env.NODE_ENV === "production" ? "none" : "lax",
      path: "/",
    });

    res.status(200).json({
      success: true,
      message: "Your account has been deactivated successfully",
    });
  } catch (error) {
    next(error);
  }
};