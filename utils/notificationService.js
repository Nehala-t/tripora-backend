
import Notification from "../models/Notification.js";
import User from "../models/User.js";
import Booking from "../models/Booking.js";

import { notificationTemplate } from "../mail/emailTemplate.js";
import { sendEmail } from "../mail/nodemailer.js";

export const createNotification = async ({
  userId,
  type,
  title,
  message,
  relatedBookingId = null,
  relatedTourId = null,
  relatedReviewId = null,
  sendEmailNotification = true,
}) => {
  // Save the in-app notification first
  const notification = await Notification.create({
    userId,
    type,
    title,
    message,
    relatedBookingId,
    relatedTourId,
    relatedReviewId,
  });

  // Send a transactional email if requested
  if (sendEmailNotification) {
    try {
      const user = await User.findById(userId)
        .select("name firstName email")
        .lean();

      if (user?.email) {
        let bookingReference = "";

        if (relatedBookingId) {
          const booking = await Booking.findById(relatedBookingId)
            .select("bookingReference")
            .lean();

          bookingReference = booking?.bookingReference || "";
        }

        const html = notificationTemplate({
          firstName:
            user.firstName ||
            user.name ||
            "Traveler",
          title,
          message,
          bookingReference,
        });

        await sendEmail({
          to: user.email,
          subject: `Tripora: ${title}`,
          html,
        });

        notification.emailSent = true;
        notification.emailSentAt = new Date();

        await notification.save();
      }
    } catch (error) {
      // Do not lose the in-app notification if email delivery fails.
      console.error("Notification email failed:", error.message);
    }
  }

  return notification;
};
