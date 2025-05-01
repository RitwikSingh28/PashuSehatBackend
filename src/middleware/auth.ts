import { Request, Response, NextFunction } from "express";
import { TokenService } from "#services/auth/token.service.js";
import { AppError, ErrorCodes } from "#utils/errors.js";

// Extend Express Request type
type RequestWithUser = Request & {
  user?: {
    userId: string;
    isVerified: boolean;
    farmLocation: {
      address: string;
      pinCode: string;
    };
  };
};

/**
 * Middleware to verify JWT access token
 */
export const authenticate = (req: RequestWithUser, _res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      throw new AppError(401, "No token provided", ErrorCodes.INVALID_TOKEN);
    }

    const token = authHeader.split(" ")[1];
    const decoded = TokenService.verifyAccessToken(token) as {
      userId: string;
      isVerified: boolean;
      farmLocation: {
        address: string;
        pinCode: string;
      };
    };

    req.user = decoded;
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to check if user is verified
 */
export const requireVerified = (req: RequestWithUser, _res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError(401, "Not authenticated", ErrorCodes.INVALID_TOKEN);
    }

    if (!req.user.isVerified) {
      throw new AppError(403, "Phone number not verified", ErrorCodes.INVALID_INPUT);
    }

    next();
  } catch (error) {
    next(error);
  }
};
