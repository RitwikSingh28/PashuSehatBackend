import { Request, Response, NextFunction } from "express";
import { AppError } from "#utils/errors.js";
import { TokenService } from "#services/auth/token.service.js";

// Extend Request type to include user
interface RequestWithUser extends Request {
  user?: {
    userId: string;
    phoneNumber: string;
    isVerified: boolean;
    farmLocation: {
      address: string;
      pinCode: string;
    };
  };
}

/**
 * Authentication middleware
 */
export const authenticate = (req: RequestWithUser, _res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      throw new AppError(401, "No token provided", "UNAUTHORIZED");
    }

    const token = authHeader.split(" ")[1];
    const decoded = TokenService.verifyAccessToken(token);

    // Add user to request object
    req.user = {
      userId: decoded.userId,
      phoneNumber: decoded.phoneNumber,
      isVerified: decoded.isVerified,
      farmLocation: decoded.farmLocation,
    };

    next();
  } catch (error) {
    next(error);
  }
};
