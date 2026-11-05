import mongoose from "mongoose";
import Notification from "../models/Notification.js";
import HttpError from "../utils/httpError.js";

// Get the authenticated user's ID.
const getAuthenticatedUserId = (req) => {
  return req.user?.user_id || req.user?._id;
};

// 1. Get all notifications for the logged-in user
export const getMyNotifications = async (req, res, next) => {
  try {
    const userId = getAuthenticatedUserId(req);

    if (!mongoose.isValidObjectId(userId)) {
      return next(new HttpError(401, "Invalid authenticated user"));
    }

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(
      50,
      Math.max(1, Number(req.query.limit) || 10)
    );

    const filter = { userId };

    // Optional filter: ?isRead=true or ?isRead=false
    // The schema stores read status using readAt.
    if (req.query.isRead !== undefined) {
      if (!["true", "false"].includes(req.query.isRead)) {
        return next(new HttpError(400, "Invalid isRead value"));
      }

      filter.readAt =
        req.query.isRead === "true"
          ? { $ne: null }
          : null;
    }

    const [notifications, total] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),

      Notification.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      message: "Notifications retrieved successfully",
      data: notifications,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// 2. Get unread notification count
export const getUnreadNotificationCount = async (
  req,
  res,
  next
) => {
  try {
    const userId = getAuthenticatedUserId(req);

    if (!mongoose.isValidObjectId(userId)) {
      return next(new HttpError(401, "Invalid authenticated user"));
    }

    const count = await Notification.countDocuments({
      userId,
      readAt: null,
    });

    res.status(200).json({
      success: true,
      message: "Unread notification count retrieved successfully",
      data: {
        unreadCount: count,
      },
    });
  } catch (error) {
    next(error);
  }
};

// 3. Mark a single notification as read
export const markNotificationAsRead = async (
  req,
  res,
  next
) => {
  try {
    const { notificationId } = req.params;
    const userId = getAuthenticatedUserId(req);

    if (!mongoose.isValidObjectId(userId)) {
      return next(new HttpError(401, "Invalid authenticated user"));
    }

    if (!mongoose.isValidObjectId(notificationId)) {
      return next(new HttpError(400, "Invalid notification ID"));
    }

    const notification = await Notification.findOneAndUpdate(
      {
        _id: notificationId,
        userId,
        readAt: null,
      },
      {
        $set: { readAt: new Date() },
      },
      {
        new: true,
        runValidators: true,
      }
    );

    // Check whether it exists and belongs to the user.
    if (!notification) {
      const exists = await Notification.exists({
        _id: notificationId,
        userId,
      });

      if (!exists) {
        return next(new HttpError(404, "Notification not found"));
      }

      // Already read: return the existing notification.
      const existingNotification = await Notification.findOne({
        _id: notificationId,
        userId,
      }).lean();

      return res.status(200).json({
        success: true,
        message: "Notification is already marked as read",
        data: existingNotification,
      });
    }

    res.status(200).json({
      success: true,
      message: "Notification marked as read",
      data: notification,
    });
  } catch (error) {
    next(error);
  }
};

// 4. Mark all notifications as read
export const markAllNotificationsAsRead = async (
  req,
  res,
  next
) => {
  try {
    const userId = getAuthenticatedUserId(req);

    if (!mongoose.isValidObjectId(userId)) {
      return next(new HttpError(401, "Invalid authenticated user"));
    }

    const result = await Notification.updateMany(
      {
        userId,
        readAt: null,
      },
      {
        $set: { readAt: new Date() },
      }
    );

    res.status(200).json({
      success: true,
      message: "All notifications marked as read",
      data: {
        modifiedCount: result.modifiedCount,
      },
    });
  } catch (error) {
    next(error);
  }
};

// 5. Delete a single notification
export const deleteNotification = async (
  req,
  res,
  next
) => {
  try {
    const { notificationId } = req.params;
    const userId = getAuthenticatedUserId(req);

    if (!mongoose.isValidObjectId(userId)) {
      return next(new HttpError(401, "Invalid authenticated user"));
    }

    if (!mongoose.isValidObjectId(notificationId)) {
      return next(new HttpError(400, "Invalid notification ID"));
    }

    const notification = await Notification.findOneAndDelete({
      _id: notificationId,
      userId,
    });

    if (!notification) {
      return next(new HttpError(404, "Notification not found"));
    }

    res.status(200).json({
      success: true,
      message: "Notification deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

// 6. Delete all notifications for the logged-in user
export const deleteAllNotifications = async (
  req,
  res,
  next
) => {
  try {
    const userId = getAuthenticatedUserId(req);

    if (!mongoose.isValidObjectId(userId)) {
      return next(new HttpError(401, "Invalid authenticated user"));
    }

    const result = await Notification.deleteMany({ userId });

    res.status(200).json({
      success: true,
      message: "All notifications deleted successfully",
      data: {
        deletedCount: result.deletedCount,
      },
    });
  } catch (error) {
    next(error);
  }
};
