import { Request, Response, NextFunction } from "express";
import { AppError } from "#utils/errors.js";
import env from "#config/env.js";

export const isAdmin = (req: Request, _res: Response, next: NextFunction): void => {
  // Use your existing authentication to get the user
  const user = req.user;

  if (!user) {
    throw new AppError(401, "Authentication required", "UNAUTHORIZED");
  }

  // Check if user is admin
  const ADMIN_PHONE_NUMBERS = env.ADMIN_PHONE_NUMBERS?.split(",") ?? [];

  console.log("Debug Admin Check:", {
    userPhone: user.phoneNumber,
    adminPhones: ADMIN_PHONE_NUMBERS,
    isAdmin: ADMIN_PHONE_NUMBERS.includes(user.phoneNumber),
    envVar: env.ADMIN_PHONE_NUMBERS,
  });

  if (ADMIN_PHONE_NUMBERS.includes(user.phoneNumber)) {
    next();
    return;
  }

  throw new AppError(403, "You don't have permission to perform this action", "FORBIDDEN");
};
