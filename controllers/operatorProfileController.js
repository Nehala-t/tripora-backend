
import User from "../models/User.js";
import HttpError from "../utils/httpError.js";

// ==================================================
// HELPER: FIND ACTIVE OPERATOR
// ==================================================

const findOperator = async (userId) => {
  return User.findOne({
    _id: userId,
    role: "operator",
    status: "active",
    isDeleted: false,
  });
};

// ==================================================
// 1. GET OPERATOR PROFILE
// ==================================================


export const getOperatorProfile = async (req, res, next) => {
  try {
    const operator = await findOperator(req.user.user_id);

    // Check authentication
  if (!req.user || !req.user.user_id) {
    console.log("ERROR: No authenticated user");

    return next(
      new HttpError("Unauthorized user", 401)
    );
  }

    if (!operator) {
      return next(
        new HttpError("Operator not found or inactive", 404)
      );
    }

    return res.status(200).json({
      success: true,
      message: "Operator profile fetched successfully",
      operator: {
        _id: operator._id,
        firstName: operator.firstName,
        lastName: operator.lastName,
        fullName: operator.fullName,
        email: operator.email,
        phone: operator.phone,
        profileImage: operator.profileImage,
        bio: operator.bio,
        country: operator.country,
        city: operator.city,
        operatorProfile: operator.operatorProfile,
        sellerVerificationStatus:
          operator.sellerVerificationStatus,
        sellerRejectionReason:
          operator.sellerRejectionReason,
        sellerApplicationSubmittedAt:
          operator.sellerApplicationSubmittedAt,
        sellerApprovedAt: operator.sellerApprovedAt,
        createdAt: operator.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};


// ==================================================
// 2. UPDATE OPERATOR PROFILE
// ==================================================

export const updateOperatorProfile = async (
  req,
  res,
  next
) => {
  try {
    const operator = await findOperator(req.user.user_id);

    // Check authentication
  if (!req.user || !req.user.user_id) {
    console.log("ERROR: No authenticated user");

    return next(
      new HttpError("Unauthorized user", 401)
    );
  }

    if (!operator) {
      return next(new HttpError("Operator not found", 404));
    }

    const body = req.body || {};

    const allowedFields = [
      "firstName",
      "lastName",
      "phone",
      "bio",
      "country",
      "city",
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (typeof body[field] !== "string") {
          return next(
            new HttpError(`${field} must be a string`, 400)
          );
        }

        operator[field] = body[field].trim();
      }
    }

    if (
      operator.firstName.length < 2 ||
      operator.lastName.length < 1
    ) {
      return next(
        new HttpError(
          "Please provide a valid first name and last name",
          400
        )
      );
    }

    await operator.save();

    return res.status(200).json({
      success: true,
      message: "Operator profile updated successfully",
      operator: {
        _id: operator._id,
        firstName: operator.firstName,
        lastName: operator.lastName,
        fullName: operator.fullName,
        email: operator.email,
        phone: operator.phone,
        bio: operator.bio,
        country: operator.country,
        city: operator.city,
        profileImage: operator.profileImage,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ==================================================
// 3. UPDATE OPERATOR PROFILE IMAGE
// ==================================================

export const updateOperatorProfileImage = async (
  req,
  res,
  next
) => {
  try {
    const operator = await findOperator(req.user.user_id);

    // Check authentication
  if (!req.user || !req.user.user_id) {
    console.log("ERROR: No authenticated user");

    return next(
      new HttpError("Unauthorized user", 401)
    );
  }

    if (!operator) {
      return next(new HttpError("Operator not found", 404));
    }

    if (!req.file) {
      return next(
        new HttpError("Please select a profile image", 400)
      );
    }

    operator.profileImage = {
      url: req.file.path,
      publicId: req.file.filename,
    };

    await operator.save();

    return res.status(200).json({
      success: true,
      message: "Operator profile image updated successfully",
      profileImage: operator.profileImage,
    });
  } catch (error) {
    next(error);
  }
};


// ==================================================
// 4. UPDATE OPERATOR BUSINESS DETAILS
// ==================================================

export const updateOperatorBusinessDetails = async (
  req,
  res,
  next
) => {
  try {
    const operator = await findOperator(req.user.user_id);

    // Check authentication
  if (!req.user || !req.user.user_id) {
    console.log("ERROR: No authenticated user");

    return next(
      new HttpError("Unauthorized user", 401)
    );
  }

    if (!operator) {
      return next(new HttpError("Operator not found", 404));
    }

    const body = req.body || {};

    const allowedFields = [
      "businessName",
      "businessDescription",
      "businessEmail",
      "businessPhone",
      "website",
      "businessAddress",
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (typeof body[field] !== "string") {
          return next(
            new HttpError(`${field} must be a string`, 400)
          );
        }

        operator.set(
          `operatorProfile.${field}`,
          body[field].trim()
        );
      }
    }

  if (
  operator.operatorProfile?.businessEmail &&
  !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    operator.operatorProfile.businessEmail
  )
) {
  return next(
    new HttpError("Please provide a valid business email", 400)
  );
}

    await operator.save();

    return res.status(200).json({
      success: true,
      message: "Business details updated successfully",
      operatorProfile: operator.operatorProfile,
    });
  } catch (error) {
    next(error);
  }
};


// ==================================================
// 5. GET OPERATOR VERIFICATION STATUS
// ==================================================

export const getOperatorVerificationStatus = async (
  req,
  res,
  next
) => {
  try {
    const operator = await findOperator(req.user.user_id);


    // Check authentication
  if (!req.user || !req.user.user_id) {
    console.log("ERROR: No authenticated user");

    return next(
      new HttpError("Unauthorized user", 401)
    );
  }

    if (!operator) {
      return next(new HttpError("Operator not found", 404));
    }

    return res.status(200).json({
      success: true,
      message: "Verification status fetched successfully",
      verification: {
        status: operator.sellerVerificationStatus,
        rejectionReason: operator.sellerRejectionReason,
        submittedAt: operator.sellerApplicationSubmittedAt,
        approvedAt: operator.sellerApprovedAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

