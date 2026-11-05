import express from "express";
import { userRegister, userLogin, logout, forgotPassword, resetPassword, verifyEmail, resendVerificationEmail, changePassword} from "../controllers/authController.js";
import { registerValidator,loginValidator } from "../validators/authValidator.js";
import { validatorMiddleware } from "../middleware/validatorMiddleware.js"
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/register", registerValidator,validatorMiddleware, userRegister);
router.post("/login", loginValidator, validatorMiddleware, userLogin);
router.post("/logout", logout);


// Public routes
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/verify-email", verifyEmail);
router.post("/resend-verification-email", resendVerificationEmail);

// Protected route
router.patch(
  "/change-password",
  authMiddleware,
  changePassword
);



export default router;