/**
 * Format phone number to E.164 format
 */
export function formatPhoneNumber(phone: string): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, "");

  // If number starts with '0', remove it
  const withoutLeadingZero = digits.replace(/^0+/, "");

  // If number doesn't start with country code (91 for India), add it
  if (!withoutLeadingZero.startsWith("91")) {
    return `91${withoutLeadingZero}`;
  }

  return withoutLeadingZero;
}

/**
 * Validate phone number format
 * Valid formats:
 * - +919876543210
 * - 919876543210
 * - 09876543210
 * - 9876543210
 */
export function isValidPhoneNumber(phone: string): boolean {
  const formattedPhone = formatPhoneNumber(phone);
  return /^91\d{10}$/.test(formattedPhone);
}

/**
 * Validate PIN code format (6 digits)
 */
export function isValidPinCode(pin: string): boolean {
  return /^\d{6}$/.test(pin);
}

/**
 * Generate a 6-digit OTP
 */
export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Validate password format
 * Requirements:
 * - At least 6 characters
 * - At least one uppercase letter
 * - At least one number
 * - At least one special character
 */
export function isValidPassword(password: string): boolean {
  const minLength = 6;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  return password.length >= minLength && hasUpperCase && hasNumber && hasSpecialChar;
}
