
import mongoose from "mongoose";
import Stripe from "stripe";
import dotenv from "dotenv";

import Booking from "../models/Booking.js";

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ==================================================
// CREATE STRIPE CHECKOUT SESSION
// POST /api/payments/create-checkout-session
// ==================================================

export const createCheckoutSession = async (req, res, next) => {
  try {
    const userId =
      req.user?._id ||
      req.user?.id ||
      req.user?.user_id ||
      req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const { bookingId } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({
        success: false,
        message: "Valid bookingId is required",
      });
    }

    const booking = await Booking.findOne({
      _id: bookingId,
      userId,
    }).populate("tourId", "title");

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    if (booking.paymentStatus === "paid") {
      return res.status(400).json({
        success: false,
        message: "This booking has already been paid",
      });
    }

    if (["cancelled", "rejected", "completed"].includes(booking.status)) {
      return res.status(400).json({
        success: false,
        message: "Payment is not available for this booking",
      });
    }

    if (!Number.isFinite(booking.totalPrice) || booking.totalPrice <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking amount",
      });
    }

    const currency = booking.currency.toLowerCase();
    const amount = Math.round(booking.totalPrice * 100);

    if (!Number.isSafeInteger(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment amount",
      });
    }

    const frontendUrl = process.env.FRONTEND_URL;

    if (!frontendUrl) {
      throw new Error("FRONTEND_URL is not configured");
    }

    const tourTitle = booking.tourId?.title || "Tripora Tour";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",

      customer_email: booking.travelerDetails.email,

      client_reference_id: booking._id.toString(),

      metadata: {
        bookingId: booking._id.toString(),
        bookingReference: booking.bookingReference,
      },

      line_items: [
        {
          price_data: {
            currency: booking.currency.toLowerCase(),
            product_data: {
              name: booking.tourId?.title || "Tripora Tour",
            },
            unit_amount: Math.round(booking.totalPrice * 100),
          },
          quantity: 1,
        },
      ],

      success_url: `${process.env.FRONTEND_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,

      cancel_url: `${process.env.FRONTEND_URL}/payment/cancel?booking_id=${booking._id}`,
    });

    booking.paymentMethod = "stripe";
    booking.stripeCheckoutSessionId = session.id;

    await booking.save();

    return res.status(200).json({
      success: true,
      message: "Stripe Checkout Session created",
      url: session.url,
      sessionId: session.id,
    });
  } catch (error) {
    console.error("Create Stripe Checkout Error:", error.message);

    next(error);
  }
};



// ==================================================
// VERIFY STRIPE CHECKOUT SESSION
// POST /api/payments/verify-session
// ==================================================

export const verifyCheckoutSession = async (req, res, next) => {
  try {
    const userId =
      req.user?._id ||
      req.user?.id ||
      req.user?.user_id ||
      req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const { sessionId } = req.body || {};

    if (
      typeof sessionId !== "string" ||
      !sessionId.startsWith("cs_")
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid Stripe session ID is required",
      });
    }

    // Retrieve the actual session directly from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      return res.status(400).json({
        success: false,
        paymentStatus: session.payment_status,
        message: "Payment has not been completed",
      });
    }

    const bookingId = session.metadata?.bookingId;

    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking information",
      });
    }

    // Verify booking belongs to the logged-in user
    // and matches this exact Stripe session.
    const booking = await Booking.findOne({
      _id: bookingId,
      userId,
      stripeCheckoutSessionId: session.id,
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found for this payment session",
      });
    }

    // Verify amount and currency
    const expectedAmount = Math.round(booking.totalPrice * 100);
    const expectedCurrency = booking.currency.toLowerCase();

    if (
      session.amount_total !== expectedAmount ||
      session.currency !== expectedCurrency
    ) {
      return res.status(400).json({
        success: false,
        message: "Payment amount or currency mismatch",
      });
    }

    // Update payment only after Stripe confirms it
    if (booking.paymentStatus !== "paid") {
      booking.paymentStatus = "paid";
      booking.paymentMethod = "stripe";
      booking.paymentId =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id || null;

      await booking.save();
    }

    console.log("Stripe session verified successfully");
    console.log("Booking:", booking._id);
    console.log("Payment status:", booking.paymentStatus);

    return res.status(200).json({
      success: true,
      message: "Payment verified successfully",
      paymentStatus: booking.paymentStatus,
      bookingStatus: booking.status,
    });
  } catch (error) {
    console.error("Stripe Session Verification Error:", error.message);
    next(error);
  }
};

// ==================================================
// STRIPE WEBHOOK
// POST /api/payments/webhook
// ==================================================

export const handleStripeWebhook = async (req, res) => {
  console.log("🔥 STRIPE WEBHOOK ROUTE HIT");
  console.log("Stripe signature exists:", Boolean(req.headers["stripe-signature"]));
  const signature = req.headers["stripe-signature"];

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
    console.log("========== STRIPE WEBHOOK ==========");
    console.log("Event:", event.type);
    console.log("Session ID:", event.data.object.id);
    console.log("Payment status:", event.data.object.payment_status);
    console.log("Amount:", event.data.object.amount_total);
    console.log("Currency:", event.data.object.currency);
    console.log("Metadata:", event.data.object.metadata);
  } catch (error) {
    console.error("Stripe webhook signature error:", error.message);

    return res.status(400).send(`Webhook Error: ${error.message}`);
  }

  try {
    const session = event.data.object;

    // Successful Checkout payment
    if (event.type === "checkout.session.completed") {
      if (session.payment_status !== "paid") {
        return res.status(200).json({ received: true });
      }

      const bookingId = session.metadata?.bookingId;

      if (!mongoose.Types.ObjectId.isValid(bookingId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid booking ID in Stripe session",
        });
      }



      const booking = await Booking.findOne({
        _id: bookingId,
        stripeCheckoutSessionId: session.id,
      });

      // DEBUG LOGS — place them here
      console.log("Booking found:", Boolean(booking));

      if (booking) {
        console.log("Booking ID:", booking._id);
        console.log("Database total:", booking.totalPrice);
        console.log("Database currency:", booking.currency);
        console.log("Database payment status:", booking.paymentStatus);
      }

      if (!booking) {
        console.error("Booking not found for Stripe session:", session.id);
        return res.status(200).json({ received: true });
      }

      const expectedAmount = Math.round(booking.totalPrice * 100);
      const expectedCurrency = booking.currency.toLowerCase();

      // Verify amount and currency against the database.
      if (
        session.amount_total !== expectedAmount ||
        session.currency !== expectedCurrency
      ) {
        console.error("Stripe payment amount/currency mismatch:", session.id);

        return res.status(400).json({
          success: false,
          message: "Payment amount or currency mismatch",
        });
      }

      // Idempotent update: do not process an already-paid booking again.
      if (booking.paymentStatus !== "paid") {
        booking.paymentStatus = "paid";
        booking.paymentMethod = "stripe";
        booking.paymentId =
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id || null;

        // Keep booking.status pending.
        // The operator must still approve the booking.
        await booking.save();
        console.log("SUCCESS: Booking payment updated to PAID");
        console.log("Updated payment status:", booking.paymentStatus);
      }
    }

    // Handle asynchronous payment failure if enabled in the future.
    if (event.type === "checkout.session.async_payment_failed") {
      const bookingId = session.metadata?.bookingId;

      if (mongoose.Types.ObjectId.isValid(bookingId)) {
        await Booking.updateOne(
          {
            _id: bookingId,
            stripeCheckoutSessionId: session.id,
            paymentStatus: "pending",
          },
          {
            $set: {
              paymentStatus: "failed",
              paymentMethod: "stripe",
            },
          }
        );
      }
    }


    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("Stripe webhook processing error:", error);

    // A non-2xx response tells Stripe to retry the event.
    return res.status(500).json({
      success: false,
      message: "Webhook processing failed",
    });
  }
};
