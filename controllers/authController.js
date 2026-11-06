
import HttpError from "../utils/httpError.js";
import User from "../models/User.js";
import Notification from "../models/Notification.js";
import {
  createEmailToken,
  hashToken,
  frontendUrl,
  isValidPassword,
} from "../utils/authHelpers.js";

import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { sendEmail } from "../mail/nodemailer.js";

import { forgotPasswordTemplate } from "../mail/emailTemplate.js";

// ==================================================
// AUTH NOTIFICATION HELPER
// ==================================================

const createAuthNotification = async ({
  userId,
  type,
  title,
  message,
}) => {
  try {
    await Notification.create({
      userId,
      type,
      title,
      message,
    });
  } catch (error) {
    // Notification failure should not interrupt authentication.
    console.error(
      "Auth notification creation failed:",
      error.message
    );
  }
};

// ==================================================
// USER REGISTER + SIGNUP NOTIFICATION
// ==================================================

export const userRegister = async (req, res, next) => {
  try {
    const { firstName, lastName, email, password, role } = req.body;

    if (!firstName || !lastName || !email || !password) {
      return next(
        new HttpError(
          "First name, last name, email, and password are required",
          400
        )
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return next(new HttpError("Email already exists", 400));
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      firstName,
      lastName,
      email: normalizedEmail,
      password: hashedPassword,
      role,
    });


    const { token: verificationToken, hashedToken } = createEmailToken();

    newUser.emailVerified = false;
    newUser.emailVerificationTokenHash = hashedToken;
    newUser.emailVerificationExpires = new Date(
      Date.now() + 24 * 60 * 60 * 1000
    );

    await newUser.save();

    const verificationUrl =
      `${frontendUrl()}/verify-email?token=${encodeURIComponent(verificationToken)}`;

    try {
      await sendEmail({
        to: newUser.email,
        subject: "Verify your Tripora email address",
        text: [
          `Hello ${newUser.firstName},`,
          "",
          "Please verify your email address to complete your Tripora account setup.",
          `Verify your email: ${verificationUrl}`,
          "",
          "This link expires in 24 hours.",
        ].join("\n"),
        html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 24px;">
        <h2>Welcome to Tripora!</h2>
        <p>Hello ${newUser.firstName},</p>
        <p>Please verify your email address to complete your account setup.</p>
        <p>
          <a href="${verificationUrl}"
             style="display:inline-block;padding:12px 20px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">
            Verify Email Address
          </a>
        </p>
        <p>This link expires in 24 hours.</p>
      </div>
    `,
      });

      console.log("Verification email sent to:", newUser.email);
    } catch (emailError) {
      console.error("Verification email failed:", emailError.message);
    }



    // Determine notification message based on user role
    const isOperator = newUser.role === "operator";

    const welcomeTitle = isOperator
      ? "Welcome to Tripora for Operators!"
      : "Welcome to Tripora!";

    const welcomeMessage = isOperator
      ? "Your operator account has been created successfully. Complete your profile and verification to start sharing your experiences."
      : "Your account has been created successfully. Explore destinations, discover exciting tours, and start planning your next adventure.";

    // Create Welcome Notification
    try {
      await Notification.create({
        userId: newUser._id,
        type: "welcome",
        title: welcomeTitle,
        message: welcomeMessage,
        actionUrl: isOperator ? "/operator/profile" : "/explore",
      });
    } catch (notificationError) {
      console.error(
        "Failed to create welcome notification:",
        notificationError.message
      );
    }


    const token = jwt.sign(
      {
        user_id: newUser._id,
        role: newUser.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_TOKEN_EXPIRY,
      }
    );

    // Store JWT in cookie.
    res.cookie("accessToken", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite:
        process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 24 * 60 * 60 * 1000,
      path: "/",
    });

    // Store role in cookie.
    res.cookie("role", newUser.role, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite:
        process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 24 * 60 * 60 * 1000,
      path: "/",
    });

    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: {
        email: newUser.email,
        role: newUser.role,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
      },
      accessToken: token,
    });
  } catch (error) {
    return next(
      new HttpError(
        error.message || "Internal Server Error",
        500
      )
    );
  }
};

// ==================================================
// USER LOGIN + LOGIN NOTIFICATION
// ==================================================

export const userLogin = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return next(
        new HttpError("Email and password are required", 400)
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    const user = await User.findOne({
      email: normalizedEmail,
    }).select("_id firstName lastName email role password status");

    if (!user) {
      return next(
        new HttpError("Invalid email or password", 401)
      );
    }

    // Check password first
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return next(
        new HttpError("Invalid email or password", 401)
      );
    }

    // Check account status before allowing login
    if (user.status !== "active") {
      return next(
        new HttpError(
          user.status === "suspended"
            ? "Your account has been suspended. Please contact support."
            : "Your account is inactive. Please contact support.",
          403
        )
      );
    }

    // Create notification only after successful authentication
    await createAuthNotification({
      userId: user._id,
      type: "login_success",
      title: "New login to your Tripora account",
      message: `Hello ${user.firstName}, you have successfully signed in to Tripora.`,
    });

    // Generate JWT
    const token = jwt.sign(
      {
        user_id: user._id,
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_TOKEN_EXPIRY,
      }
    );

    // Store JWT in cookie
    res.cookie("accessToken", token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite:
        process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 24 * 60 * 60 * 1000,
      path: "/",
    });

    // Store role in cookie
    res.cookie("role", user.role, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite:
        process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 24 * 60 * 60 * 1000,
      path: "/",
    });

    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      accessToken: token,
    });
  } catch (error) {
    return next(
      new HttpError(
        error.message || "Internal Server Error",
        500
      )
    );
  }
};

// ==================================================
// LOGOUT
// ==================================================

export const logout = async (req, res, next) => {
  try {
    const cookieOptions = {
      secure: process.env.NODE_ENV === "production",
      sameSite:
        process.env.NODE_ENV === "production" ? "none" : "lax",
      path: "/",
    };

    res.clearCookie("accessToken", {
      ...cookieOptions,
      httpOnly: true,
    });

    res.clearCookie("role", {
      ...cookieOptions,
      httpOnly: false,
    });

    return res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    return next(error);
  }
};

// ==================================================
// CHANGE PASSWORD
// ==================================================

export const changePassword = async (req, res, next) => {
  try {
    const {
      currentPassword,
      newPassword,
      confirmPassword,
    } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return next(
        new HttpError(
          "Current password, new password, and confirmation are required",
          400
        )
      );
    }

    if (!isValidPassword(newPassword)) {
      return next(
        new HttpError(
          "New password must contain at least 8 characters",
          400
        )
      );
    }

    if (newPassword !== confirmPassword) {
      return next(new HttpError("Passwords do not match", 400));
    }

    const user = await User.findOne({
      _id: req.user.user_id,
      isDeleted: false,
    }).select("+password +isDeleted");

    if (!user || user.status !== "active") {
      return next(
        new HttpError("User account not found or inactive", 404)
      );
    }

    const passwordMatches = await bcrypt.compare(
      currentPassword,
      user.password
    );

    if (!passwordMatches) {
      return next(
        new HttpError("Current password is incorrect", 400)
      );
    }

    if (currentPassword === newPassword) {
      return next(
        new HttpError(
          "New password must be different from the current password",
          400
        )
      );
    }

    user.password = await bcrypt.hash(newPassword, 12);
    user.passwordChangedAt = new Date();

    await user.save();

    // Create password change notification
    try {
      await Notification.create({
        userId: user._id,
        type: "general",
        title: "Password Changed Successfully",
        message:
          "Your Tripora account password has been changed successfully. If you did not make this change, please secure your account.",
        actionUrl: "/profile",
      });
    } catch (notificationError) {
      console.error(
        "Failed to create password change notification:",
        notificationError.message
      );
    }

    return res.status(200).json({
      success: true,
      message: "Password changed successfully. Please log in again.",
    });
  } catch (error) {
    return next(
      new HttpError(
        error.message || "Failed to change password",
        500
      )
    );
  }
};

// ==================================================
// FORGOT PASSWORD
// ==================================================

export const forgotPassword = async (req, res, next) => {
  try {
    const email = req.body.email?.trim().toLowerCase();

    if (!email) {
      return next(
        new HttpError("Email address is required", 400)
      );
    }

    const user = await User.findOne({
      email,
      status: "active",
      isDeleted: false,
      emailVerified: true,
    });

    // Do not reveal whether an account exists.
    if (!user) {
      return res.status(200).json({
        success: true,
        message:
          "If an eligible account exists, a password-reset link will be sent.",
      });
    }

    const { token, hashedToken } = createEmailToken();

    user.passwordResetTokenHash = hashedToken;
    user.passwordResetExpires = new Date(
      Date.now() + 15 * 60 * 1000
    );

    await user.save();

    const resetUrl =
      `${frontendUrl()}/reset-password?token=${encodeURIComponent(token)}`;

    try {
      const emailHtml = forgotPasswordTemplate({
        firstName: user.firstName,
        resetUrl,
      });

      await sendEmail({
        to: user.email,
        subject: "Reset your Tripora password",
        text: [
          `Hello ${user.firstName},`,
          "",
          "We received a request to reset your Tripora password.",
          `Open this link to reset it: ${resetUrl}`,
          "",
          "This link expires in 15 minutes.",
          "If you did not request a reset, you can ignore this email.",
        ].join("\n"),
        html: emailHtml,
      });

      console.log(
        "Password reset email sent successfully to:",
        user.email
      );

      // Create password reset notification
      try {
        await Notification.create({
          userId: user._id,
          type: "general",
          title: "Password Reset Email Sent",
          message:
            "A password reset link has been sent to your registered email address. The link expires in 15 minutes.",
          actionUrl: "/profile",
        });
      } catch (notificationError) {
        console.error(
          "Failed to create password reset notification:",
          notificationError.message
        );
      }
    } catch (emailError) {
      user.passwordResetTokenHash = null;
      user.passwordResetExpires = null;

      await user.save();

      console.error("Password reset email error:", emailError);

      throw emailError;
    }

    return res.status(200).json({
      success: true,
      message:
        "If an eligible account exists, a password-reset link will be sent.",
    });
  } catch (error) {
    console.error("Forgot password error:", error);

    return next(
      new HttpError(
        error.message || "Failed to process password reset",
        500
      )
    );
  }
};

// ==================================================
// RESET PASSWORD
// ==================================================

export const resetPassword = async (req, res, next) => {
  try {
    const {
      token,
      newPassword,
      confirmPassword,
    } = req.body;

    if (!token || !newPassword || !confirmPassword) {
      return next(
        new HttpError(
          "Reset token, new password, and confirmation are required",
          400
        )
      );
    }

    if (!isValidPassword(newPassword)) {
      return next(
        new HttpError(
          "Password must contain at least 8 characters",
          400
        )
      );
    }

    if (newPassword !== confirmPassword) {
      return next(
        new HttpError("Passwords do not match", 400)
      );
    }

    const hashedToken = hashToken(token);

    const user = await User.findOne({
      passwordResetTokenHash: hashedToken,
      passwordResetExpires: { $gt: new Date() },
      status: "active",
      isDeleted: false,
    });

    if (!user) {
      return next(
        new HttpError(
          "Reset link is invalid or has expired",
          400
        )
      );
    }

    user.password = await bcrypt.hash(newPassword, 12);
    user.passwordChangedAt = new Date();

    // Invalidate the token after successful password reset
    user.passwordResetTokenHash = null;
    user.passwordResetExpires = null;

    await user.save();

    // Create password reset success notification
    try {
      await Notification.create({
        userId: user._id,
        type: "general",
        title: "Password Reset Successfully",
        message:
          "Your Tripora password has been reset successfully. Please log in again using your new password.",
        actionUrl: "/login",
      });
    } catch (notificationError) {
      console.error(
        "Failed to create password reset notification:",
        notificationError.message
      );
    }

    return res.status(200).json({
      success: true,
      message: "Password reset successfully. Please log in again.",
    });
  } catch (error) {
    return next(
      new HttpError(
        error.message || "Failed to reset password",
        500
      )
    );
  }
};

// ==================================================
// VERIFY EMAIL
// ==================================================

export const verifyEmail = async (req, res, next) => {
  try {
    const token = req.body.token || req.query.token;

    if (!token || typeof token !== "string") {
      return next(
        new HttpError(
          "Email verification token is required",
          400
        )
      );
    }

    const hashedToken = hashToken(token);

    const user = await User.findOne({
      emailVerificationTokenHash: hashedToken,
      emailVerificationExpires: { $gt: new Date() },
      isDeleted: false,
    });

    if (!user) {
      return next(
        new HttpError(
          "Verification link is invalid or has expired",
          400
        )
      );
    }

    // Verify email address
    user.emailVerified = true;
    user.emailVerificationTokenHash = null;
    user.emailVerificationExpires = null;

    await user.save();

    // Create email verification notification
    try {
      await Notification.create({
        userId: user._id,
        type: "general",
        title: "Email Verified Successfully",
        message:
          "Your Tripora email address has been verified successfully. You can now explore destinations and discover exciting tours.",
        actionUrl: "/explore",
      });
    } catch (notificationError) {
      console.error(
        "Failed to create email verification notification:",
        notificationError.message
      );
    }

    return res.status(200).json({
      success: true,
      message: "Email address verified successfully.",
    });
  } catch (error) {
    return next(
      new HttpError(
        error.message || "Failed to verify email",
        500
      )
    );
  }
};

// ==================================================
// RESEND VERIFICATION EMAIL
// ==================================================

export const resendVerificationEmail = async (req, res, next) => {
  try {
    const email = req.body.email?.trim().toLowerCase();

    if (!email) {
      return next(
        new HttpError("Email address is required", 400)
      );
    }

    const genericMessage =
      "If an unverified account exists, a verification email will be sent.";

    const user = await User.findOne({
      email,
      emailVerified: false,
      status: "active",
      isDeleted: false,
    });

    // Do not reveal whether an account exists or is already verified.
    if (!user) {
      return res.status(200).json({
        success: true,
        message: genericMessage,
      });
    }

    // Generate a new verification token
    const { token, hashedToken } = createEmailToken();

    user.emailVerificationTokenHash = hashedToken;
    user.emailVerificationExpires = new Date(
      Date.now() + 24 * 60 * 60 * 1000
    );

    await user.save();

    const verificationUrl =
      `${frontendUrl()}/verify-email?token=${encodeURIComponent(token)}`;

    try {
      await sendEmail({
        to: user.email,
        subject: "Verify your Tripora email address",
        text: [
          `Hello ${user.firstName},`,
          "",
          "Please verify your email address to complete your Tripora account setup.",
          `Verify your email: ${verificationUrl}`,
          "",
          "This link expires in 24 hours.",
          "If you did not create this account, you can ignore this email.",
        ].join("\n"),
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 24px;">
            <h2>Verify your Tripora email address</h2>
            <p>Hello ${user.firstName},</p>
            <p>Please verify your email address to complete your account setup.</p>
            <p>
              <a
                href="${verificationUrl}"
                style="display:inline-block;padding:12px 20px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;"
              >
                Verify Email Address
              </a>
            </p>
            <p>This link expires in 24 hours.</p>
            <p>If you did not create this account, you can ignore this email.</p>
          </div>
        `,
      });

      console.log(
        "Verification email sent successfully to:",
        user.email
      );

      // Create resend verification notification
      try {
        await Notification.create({
          userId: user._id,
          type: "general",
          title: "Verification Email Sent",
          message:
            "A new email verification link has been sent to your registered email address. The link expires in 24 hours.",
          actionUrl: "/verify-email",
        });
      } catch (notificationError) {
        console.error(
          "Failed to create resend verification notification:",
          notificationError.message
        );
      }
    } catch (emailError) {
      user.emailVerificationTokenHash = null;
      user.emailVerificationExpires = null;

      await user.save();

      console.error(
        "Verification email failed:",
        emailError.message
      );

      throw emailError;
    }

    return res.status(200).json({
      success: true,
      message: genericMessage,
    });
  } catch (error) {
    return next(
      new HttpError(
        error.message || "Failed to resend verification email",
        500
      )
    );
  }
};
