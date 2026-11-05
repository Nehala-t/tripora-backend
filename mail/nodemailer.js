
import "dotenv/config";
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

export const sendEmail = async ({ to, subject, text, html }) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    throw new Error(
      "Email configuration is missing. Check EMAIL_USER and EMAIL_PASSWORD in your backend .env file."
    );
  }

  try {
    const info = await transporter.sendMail({
      from: `"${process.env.EMAIL_FROM_NAME || "Tripora"}" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      ...(text ? { text } : {}),
      ...(html ? { html } : {}),
    });

    console.log("Email sent successfully:", info.messageId);
    console.log("Email recipient:", to);

    return info;
  } catch (error) {
    console.error("Nodemailer Error:", error.message);
    throw error;
  }
};
