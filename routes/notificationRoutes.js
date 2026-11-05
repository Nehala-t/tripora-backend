import express from "express";

import {
  getMyNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  deleteAllNotifications,
} from "../controllers/notificationController.js";

import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

// All notification routes require authentication
router.use(authMiddleware);

// Get all notifications for the logged-in user
router.get("/", getMyNotifications);

// Get unread notification count
router.get("/unread-count", getUnreadNotificationCount);

// Mark all notifications as read
router.patch("/mark-all-read", markAllNotificationsAsRead);

// Mark a single notification as read
router.patch("/:notificationId/read", markNotificationAsRead);

// Delete all notifications
router.delete("/delete-all", deleteAllNotifications);

// Delete a single notification
router.delete("/:notificationId", deleteNotification);

export default router;
