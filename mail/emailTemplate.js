import fs from "fs";
import path from "path";
import Handlebars from "handlebars";
import { fileURLToPath } from "url";

// Register the eq helper here
Handlebars.registerHelper("eq", (a, b) => a === b);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load a template from the views folder
const loadTemplate = (templateName) => {
  const templatePath = path.join(
    __dirname,
    "..",
    "views",
    templateName
  );

  return fs.readFileSync(templatePath, "utf-8");
};

// Account status email
export const accountStatusTemplate = ({
  firstName,
  status,
}) => {
  const template = Handlebars.compile(
    loadTemplate("account_status_template.hbs")
  );

  return template({
    firstName,
    status,
    year: new Date().getFullYear(),
  });
};

// Forgot password email
export const forgotPasswordTemplate = ({
  firstName,
  resetUrl,
}) => {
  const template = Handlebars.compile(
    loadTemplate("forgot_password_template.hbs")
  );

  return template({
    firstName,
    resetUrl,
    year: new Date().getFullYear(),
  });
};

// General Tripora notification email
export const notificationTemplate = ({
  firstName = "Traveler",
  title,
  message,
  bookingReference = "",
}) => {
  const template = Handlebars.compile(
    loadTemplate("notification_template.hbs")
  );

  return template({
    firstName,
    title,
    message,
    bookingReference,
    year: new Date().getFullYear(),
  });
};

// Tour deleted by admin email
export const tourDeletedTemplate = ({
  firstName = "Operator",
  tourTitle,
  message,
}) => {
  const template = Handlebars.compile(
    loadTemplate("tour_deleted_template.hbs")
  );

  return template({
    firstName,
    tourTitle,
    message,
    year: new Date().getFullYear(),
  });
};
