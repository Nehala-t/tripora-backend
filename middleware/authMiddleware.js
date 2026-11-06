
import jwt from "jsonwebtoken";
import HttpError from "../utils/httpError.js";

export const authMiddleware = (req, res, next) => {
  try {
    // 1. Get token from cookie, if available
    let token = req.cookies?.accessToken;

    // 2. Otherwise, check Authorization header
    if (!token) {
      const authHeader = req.headers.authorization;

      if (authHeader?.startsWith("Bearer ")) {
        token = authHeader.split(" ")[1];
      }
    }

    // 3. Check whether a token exists
    if (!token) {
      return next(
        new HttpError("Access token is required", 401)
      );
    }

    // 4. Verify JWT
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    // 5. Assign authenticated user information
    req.user = decoded;

    // Temporary debugging logs
    console.log("Authenticated user ID:",
      decoded.user_id || decoded._id || decoded.id || decoded.userId
    );
    console.log("Authenticated role:", decoded.role);

    return next();
  } catch (error) {
    console.error("Authentication error:", error.message);

    return next(
      new HttpError("Invalid or expired token", 401)
    );
  }
};
