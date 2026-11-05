import * as yup from "yup";

// ========================================
// PERSONAL PROFILE VALIDATION
// ========================================

export const profileSchema = yup
  .object({
    firstName: yup
      .string()
      .trim()
      .required("Please enter your first name")
      .min(2, "First name must contain at least 2 characters")
      .max(50, "First name cannot exceed 50 characters")
      .matches(
        /^[A-Za-z]+(?:[ '-][A-Za-z]+)*$/,
        "First name should contain only letters"
      ),

    lastName: yup
      .string()
      .trim()
      .required("Please enter your last name")
      .min(2, "Last name must contain at least 2 characters")
      .max(50, "Last name cannot exceed 50 characters")
      .matches(
        /^[A-Za-z]+(?:[ '-][A-Za-z]+)*$/,
        "Last name should contain only letters"
      ),

    phone: yup
      .string()
      .trim()
      .max(25, "Phone number cannot exceed 25 characters")
      .defined(),

    bio: yup
      .string()
      .trim()
      .max(1000, "Bio cannot exceed 1000 characters")
      .defined(),

    country: yup
      .string()
      .trim()
      .max(100, "Country cannot exceed 100 characters")
      .defined(),

    city: yup
      .string()
      .trim()
      .max(100, "City cannot exceed 100 characters")
      .defined(),
  })
  .required();

export type ProfileFormValues = yup.InferType<typeof profileSchema>;

// ========================================
// TRAVEL PREFERENCES VALIDATION
// ========================================

export const travelPreferencesSchema = yup
  .object({
    preferredLanguage: yup
      .string()
      .trim()
      .required("Please select your preferred language")
      .max(20, "Language cannot exceed 20 characters"),

    preferredCurrency: yup
      .mixed<"INR" | "USD" | "EUR" | "GBP" | "AED">()
      .oneOf(
        ["INR", "USD", "EUR", "GBP", "AED"],
        "Please select a valid currency"
      )
      .required("Please select your preferred currency"),

    preferredDestinations: yup
      .array()
      .of(
        yup
          .string()
          .trim()
          .required("Destination cannot be empty")
          .max(100, "Destination cannot exceed 100 characters")
      )
      .max(20, "You can add up to 20 destinations")
      .required(),

    travelStyle: yup
      .mixed<
        | "adventure"
        | "relaxation"
        | "luxury"
        | "budget"
        | "cultural"
        | "family"
        | "solo"
      >()
      .oneOf(
        [
          "adventure",
          "relaxation",
          "luxury",
          "budget",
          "cultural",
          "family",
          "solo",
        ],
        "Please select a valid travel style"
      )
      .required("Please select your travel style"),

    budget: yup
      .mixed<"Low" | "Medium" | "High">()
      .oneOf(["Low", "Medium", "High"], "Please select a valid budget")
      .required("Please select your travel budget"),

    travelInterests: yup
      .array()
      .of(
        yup
          .mixed<
            | "adventure"
            | "culture"
            | "food"
            | "nature"
            | "sightseeing"
            | "water_sports"
            | "wildlife"
            | "wellness"
          >()
          .oneOf([
            "adventure",
            "culture",
            "food",
            "nature",
            "sightseeing",
            "water_sports",
            "wildlife",
            "wellness",
          ])
          .required()
      )
      .required(),
  })
  .required();

export type TravelPreferencesFormValues = yup.InferType<
  typeof travelPreferencesSchema
>;

// ========================================
// OPERATOR APPLICATION VALIDATION
// ========================================

export const operatorSchema = yup
  .object({
    businessName: yup
      .string()
      .trim()
      .required("Please enter your business name")
      .max(150, "Business name cannot exceed 150 characters"),

    businessEmail: yup
      .string()
      .trim()
      .required("Please enter your business email")
      .email("Please enter a valid business email"),

    businessPhone: yup
      .string()
      .trim()
      .required("Please enter your business phone number")
      .max(25, "Phone number cannot exceed 25 characters"),

    website: yup
      .string()
      .trim()
      .defined()
      .test(
        "valid-url",
        "Please enter a valid website URL",
        (value) =>
          !value ||
          /^(https?:\/\/)([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(?::\d+)?(?:[/?#][^\s]*)?$/i.test(
            value
          )
      ),

    businessAddress: yup
      .string()
      .trim()
      .required("Please enter your business address")
      .max(250, "Business address cannot exceed 250 characters"),

    businessDescription: yup
      .string()
      .trim()
      .required("Please enter your business description")
      .max(2000, "Description cannot exceed 2000 characters"),
  })
  .required();

export type OperatorFormValues = yup.InferType<typeof operatorSchema>;