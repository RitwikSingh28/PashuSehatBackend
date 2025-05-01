export type UserRole = "farmer" | "admin" | "vet";

export interface User {
  userId: string;
  phoneNumber: string;
  passwordHash?: string; // Optional because OTP users won't have a password
  role: UserRole;
  farmId?: string;
  name: string;
  profilePicture?: string; // S3 key
  createdAt: number;
  lastLogin: number;
}

export interface RefreshToken {
  tokenId: string;
  userId: string;
  token: string;
  family: string; // For token rotation
  expiresAt: number;
  createdAt: number;
}

export interface OTPRecord {
  phoneNumber: string;
  otp: string;
  expiresAt: number;
  attempts: number;
  createdAt: number;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: Omit<User, "passwordHash">;
}

// Request types
export interface PhonePasswordLoginRequest {
  phoneNumber: string;
  password: string;
}

export interface PhoneOTPLoginRequest {
  phoneNumber: string;
  otp: string;
}

export interface RequestOTPRequest {
  phoneNumber: string;
}

export interface ResetPasswordRequest {
  phoneNumber: string;
  otp: string;
  newPassword: string;
}
