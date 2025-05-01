export interface User {
  userId: string;
  phoneNumber: string;
  passwordHash: string;
  name: string;
  farmLocation: {
    address: string; // Max 120 characters
    pinCode: string;
  };
  isVerified: boolean;
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

export interface AccessTokenPayload {
  userId: string;
  isVerified: boolean;
  farmLocation: {
    address: string;
    pinCode: string;
  };
  iat?: number;
  exp?: number;
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
export interface SignupRequest {
  phoneNumber: string;
  name: string;
  password: string;
  farmAddress: string; // Max 120 characters
  pinCode: string;
}

export interface VerifyPhoneRequest {
  phoneNumber: string;
  otp: string;
}

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
