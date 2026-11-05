import express from "express";
import ConnectDB from "./config/connectDb.js";
import cookieParser from "cookie-parser";
import cors from "cors"; 

import authRoutes from "./routes/authRoutes.js"
import userProfileRoutes from "./routes/userProfileRoutes.js"
import operatorProfileRoutes from "./routes/operatorProfileRoutes.js"
import destinationRoutes from "./routes/destinationRoutes.js"
import tourRoutes from "./routes/tourRoutes.js"
import categoryRoutes from "./routes/categoryRoutes.js"
import availabilityRoutes from "./routes/availabilityRoutes.js"
import bookingRoutes from "./routes/bookingRoutes.js";
import reviewRoutes from "./routes/reviewRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import wishlistRoutes from "./routes/wishlistRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import operatorRoutes from "./routes/operatorRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import { handleStripeWebhook } from "./controllers/paymentController.js";



import dotenv from "dotenv";

dotenv.config();

const app = express();

const PORT = process.env.PORT || 5000;

// CORS
app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  })
);

// IMPORTANT: Stripe webhook must come before express.json()
app.post(
  "/api/payments/webhook",
  express.raw({ type: "application/json" }),
  handleStripeWebhook
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

ConnectDB();

// Payment routes
app.use("/api/payments", paymentRoutes);

// Existing routes
app.use("/api/auth", authRoutes);
app.use("/api/user-profile", userProfileRoutes);
app.use("/api/operator-profile", operatorProfileRoutes);
app.use("/api/destinations", destinationRoutes);
app.use("/api/tours", tourRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/availability", availabilityRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/operator", operatorRoutes);

app.get("/", (req, res) => {
  res.send("Tour and Activity Booking Platform Backend is running");
});

// Error handler
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || err.status || 500;

  if (res.headersSent) {
    return next(err);
  }

  return res.status(statusCode).json({
    success: false,
    message:
      statusCode >= 500
        ? "Internal server error"
        : err.message || "Something went wrong",
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
