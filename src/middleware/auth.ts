import { Request, Response, NextFunction } from "express";
import { TokenService } from "#services/auth/token.service.js";
import { AppError, ErrorCodes } from "#utils/errors.js";
import type { UserRole } from "#types/auth.js";

// Extend Express Request type
type RequestWithUser = Request & {
  user?: {
    userId: string;
    role: UserRole;
    farmId?: string;
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
      role: UserRole;
      farmId?: string;
    };

    req.user = decoded;
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to check if user has required role
 */
export const authorize = (roles: UserRole[]) => {
  return (req: RequestWithUser, _res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new AppError(401, "Not authenticated", ErrorCodes.INVALID_TOKEN);
      }

      if (!roles.includes(req.user.role)) {
        throw new AppError(403, "Not authorized", ErrorCodes.INVALID_TOKEN);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
