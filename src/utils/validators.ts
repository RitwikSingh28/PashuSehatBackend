/**
 * Validates an Indian phone number
 * Format: +91XXXXXXXXXX
 */
export const isValidPhoneNumber = (phone: string): boolean => {
  const phoneRegex = /^\+91[1-9]\d{9}$/;
  return phoneRegex.test(phone);
};

/**
 * Validates password requirements:
 * - Minimum 6 characters
 * - Must start with a capital letter
 * - Must contain at least one number
 * - Must contain at least one special character
 */
export const isValidPassword = (password: string): boolean => {
  const passwordRegex = /^[A-Z](?=.*[0-9])(?=.*[!@#$%^&*])[a-zA-Z0-9!@#$%^&*]{5,}$/;
  return passwordRegex.test(password);
};

/**
 * Formats a phone number to ensure it has the +91 prefix
 */
export const formatPhoneNumber = (phone: string): string => {
  // Remove any spaces, dashes, or other separators
  const cleaned = phone.replace(/\D/g, "");

  // If it's a 10-digit number, add +91
  if (/^[1-9]\d{9}$/.test(cleaned)) {
    return `+91${cleaned}`;
  }

  // If it already has the country code (91 or +91), format it
  if (/^(\+?91)?[1-9]\d{9}$/.test(cleaned)) {
    return `+91${cleaned.slice(-10)}`;
  }

  throw new Error("Invalid phone number format");
};

/**
 * Generates a random 6-digit OTP
 */
export const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};
