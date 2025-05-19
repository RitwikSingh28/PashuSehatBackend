import type { ErrorRequestHandler } from "express";
import { AppError } from "#utils/errors.js";

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  console.error("Error:", error);

  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      status: "error",
      code: error.code,
      message: error.message,
    });
    return;
  }

  // Handle other types of errors
  res.status(500).json({
    status: "error",
    code: "INTERNAL_ERROR",
    message: "An unexpected error occurred",
  });
};
