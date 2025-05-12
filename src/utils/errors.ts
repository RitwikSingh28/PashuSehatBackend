export const ErrorCodes = {
  // Auth related errors
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  INVALID_TOKEN: "INVALID_TOKEN",
  TOKEN_EXPIRED: "TOKEN_EXPIRED",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  INVALID_PASSWORD: "INVALID_PASSWORD",

  // OTP related errors
  INVALID_OTP: "INVALID_OTP",
  OTP_EXPIRED: "OTP_EXPIRED",
  OTP_ATTEMPTS_EXCEEDED: "OTP_ATTEMPTS_EXCEEDED",
  TOO_MANY_ATTEMPTS: "TOO_MANY_ATTEMPTS",

  // Input validation errors
  INVALID_INPUT: "INVALID_INPUT",
  INVALID_PHONE: "INVALID_PHONE",

  // Resource errors
  USER_NOT_FOUND: "USER_NOT_FOUND",
  DUPLICATE_PHONE: "DUPLICATE_PHONE",

  // Tag related errors
  TAG_NOT_FOUND: "TAG_NOT_FOUND",
  TAG_ALREADY_ASSIGNED: "TAG_ALREADY_ASSIGNED",

  // Cattle related errors
  CATTLE_NOT_FOUND: "CATTLE_NOT_FOUND",

  // Alert related errors
  ALERT_NOT_FOUND: "ALERT_NOT_FOUND",
  ALREADY_ACKNOWLEDGED: "ALREADY_ACKNOWLEDGED",
  INVALID_OPERATION: "INVALID_OPERATION",

  // System errors
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code: keyof typeof ErrorCodes,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
  }
}
