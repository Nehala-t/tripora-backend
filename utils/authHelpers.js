
import crypto from "crypto";

export const createEmailToken = () => {
  const token = crypto.randomBytes(32).toString("hex");

  const hashedToken = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");

  return { token, hashedToken };
};

export const hashToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

export const frontendUrl = () => {
  const url = process.env.FRONTEND_URL;

  if (!url) {
    throw new Error("FRONTEND_URL is missing from .env");
  }

  return url.replace(/\/+$/, "");
};

export const isValidPassword = (password) =>
  typeof password === "string" && password.length >= 8;
