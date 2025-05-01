import { Router } from "express";
import { AuthService } from "#services/auth/auth.service.js";
import { AppError, ErrorCodes } from "#utils/errors.js";
import type {
  PhonePasswordLoginRequest,
  PhoneOTPLoginRequest,
  RequestOTPRequest,
  ResetPasswordRequest,
  SignupRequest,
  VerifyPhoneRequest,
} from "#types/auth.js";

const router = Router();

/**
 * Sign up a new user
 * POST /auth/signup
 */
router.post("/signup", async (req, res, next) => {
  try {
    const data = req.body as SignupRequest;

    if (!data.phoneNumber || !data.name || !data.password || !data.farmAddress || !data.pinCode) {
      throw new AppError(400, "All fields are required", ErrorCodes.INVALID_INPUT);
    }

    const response = await AuthService.signup(data);
    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * Verify phone number with OTP
 * POST /auth/verify
 */
router.post("/verify", async (req, res, next) => {
  try {
    const data = req.body as VerifyPhoneRequest;

    if (!data.phoneNumber || !data.otp) {
      throw new AppError(400, "Phone number and OTP are required", ErrorCodes.INVALID_INPUT);
    }

    const response = await AuthService.verifyPhone(data);
    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * Login with phone and password
 * POST /auth/login/password
 */
router.post("/login/password", async (req, res, next) => {
  try {
    const data = req.body as PhonePasswordLoginRequest;

    if (!data.phoneNumber || !data.password) {
      throw new AppError(400, "Phone number and password are required", ErrorCodes.INVALID_CREDENTIALS);
    }

    const response = await AuthService.loginWithPassword(data);
    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * Login with phone and OTP
 * POST /auth/login/otp
 */
router.post("/login/otp", async (req, res, next) => {
  try {
    const data = req.body as PhoneOTPLoginRequest;

    if (!data.phoneNumber || !data.otp) {
      throw new AppError(400, "Phone number and OTP are required", ErrorCodes.INVALID_CREDENTIALS);
    }

    const response = await AuthService.loginWithOTP(data);
    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * Request OTP
 * POST /auth/otp/request
 */
router.post("/otp/request", async (req, res, next) => {
  try {
    const data = req.body as RequestOTPRequest;

    if (!data.phoneNumber) {
      throw new AppError(400, "Phone number is required", ErrorCodes.INVALID_PHONE);
    }

    await AuthService.requestOTP(data);
    res.json({ message: "OTP sent successfully" });
  } catch (error) {
    next(error);
  }
});

/**
 * Reset password with OTP
 * POST /auth/password/reset
 */
router.post("/password/reset", async (req, res, next) => {
  try {
    const data = req.body as ResetPasswordRequest;

    if (!data.phoneNumber || !data.otp || !data.newPassword) {
      throw new AppError(400, "Phone number, OTP, and new password are required", ErrorCodes.INVALID_CREDENTIALS);
    }

    await AuthService.resetPassword(data);
    res.json({ message: "Password reset successfully" });
  } catch (error) {
    next(error);
  }
});

/**
 * Refresh access token
 * POST /auth/token/refresh
 */
router.post("/token/refresh", async (req, res, next) => {
  try {
    const { refreshToken } = req.body as { refreshToken: string };

    if (!refreshToken) {
      throw new AppError(400, "Refresh token is required", ErrorCodes.INVALID_TOKEN);
    }

    const response = await AuthService.refreshToken(refreshToken);
    res.json(response);
  } catch (error) {
    next(error);
  }
});

export default router;
