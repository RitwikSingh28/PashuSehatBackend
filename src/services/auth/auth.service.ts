import { v4 as uuidv4 } from "uuid";
import { docClient, TABLES } from "#config/aws.js";
import { AppError, ErrorCodes } from "#utils/errors.js";
import { TokenService } from "./token.service.js";
import { OTPService } from "./otp.service.js";
import { PasswordService } from "./password.service.js";
import { formatPhoneNumber, isValidPhoneNumber } from "#utils/validators.js";
import type { User, LoginResponse, PhonePasswordLoginRequest, PhoneOTPLoginRequest, RequestOTPRequest, ResetPasswordRequest } from "#types/auth.js";

// Helper functions
async function updateLastLogin(userId: string): Promise<void> {
  await docClient.update({
    TableName: TABLES.USERS,
    Key: { userId },
    UpdateExpression: "SET lastLogin = :now",
    ExpressionAttributeValues: {
      ":now": Date.now(),
    },
  });
}

async function findOrCreateUser(phoneNumber: string): Promise<User> {
  const result = await docClient.query({
    TableName: TABLES.USERS,
    IndexName: "PhoneNumberIndex",
    KeyConditionExpression: "phoneNumber = :phone",
    ExpressionAttributeValues: {
      ":phone": phoneNumber,
    },
  });

  const existingUser = result.Items?.[0] as User | undefined;
  if (existingUser) {
    return existingUser;
  }

  // Create new user
  const user: User = {
    userId: uuidv4(),
    phoneNumber,
    role: "farmer", // Default role
    name: `User_${phoneNumber.slice(-4)}`, // Temporary name
    createdAt: Date.now(),
    lastLogin: Date.now(),
  };

  await docClient.put({
    TableName: TABLES.USERS,
    Item: user,
  });

  return user;
}

export const AuthService = {
  async loginWithPassword(data: PhonePasswordLoginRequest): Promise<LoginResponse> {
    const phoneNumber = formatPhoneNumber(data.phoneNumber);

    if (!isValidPhoneNumber(phoneNumber)) {
      throw new AppError(400, "Invalid phone number format", ErrorCodes.INVALID_PHONE);
    }

    // Find user by phone number
    const result = await docClient.query({
      TableName: TABLES.USERS,
      IndexName: "PhoneNumberIndex",
      KeyConditionExpression: "phoneNumber = :phone",
      ExpressionAttributeValues: {
        ":phone": phoneNumber,
      },
    });

    const user = result.Items?.[0] as User | undefined;

    if (!user?.passwordHash) {
      throw new AppError(401, "Invalid credentials", ErrorCodes.INVALID_CREDENTIALS);
    }

    // Verify password
    const isValid = await PasswordService.comparePassword(data.password, user.passwordHash);

    if (!isValid) {
      throw new AppError(401, "Invalid credentials", ErrorCodes.INVALID_CREDENTIALS);
    }

    // Update last login
    await updateLastLogin(user.userId);

    // Generate tokens
    const accessToken = TokenService.generateAccessToken(user);
    const refreshToken = await TokenService.generateRefreshToken(user.userId);

    // Create response without passwordHash
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...userWithoutPassword } = user;

    return {
      accessToken,
      refreshToken,
      user: userWithoutPassword,
    };
  },

  async loginWithOTP(data: PhoneOTPLoginRequest): Promise<LoginResponse> {
    const phoneNumber = formatPhoneNumber(data.phoneNumber);

    if (!isValidPhoneNumber(phoneNumber)) {
      throw new AppError(400, "Invalid phone number format", ErrorCodes.INVALID_PHONE);
    }

    // Verify OTP
    await OTPService.verifyOTP(phoneNumber, data.otp);

    // Find or create user
    const user = await findOrCreateUser(phoneNumber);

    // Update last login
    await updateLastLogin(user.userId);

    // Generate tokens
    const accessToken = TokenService.generateAccessToken(user);
    const refreshToken = await TokenService.generateRefreshToken(user.userId);

    // Create response without passwordHash
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...userWithoutPassword } = user;

    return {
      accessToken,
      refreshToken,
      user: userWithoutPassword,
    };
  },

  async requestOTP(data: RequestOTPRequest): Promise<void> {
    const phoneNumber = formatPhoneNumber(data.phoneNumber);

    if (!isValidPhoneNumber(phoneNumber)) {
      throw new AppError(400, "Invalid phone number format", ErrorCodes.INVALID_PHONE);
    }

    await OTPService.generateAndSendOTP(phoneNumber);
  },

  async resetPassword(data: ResetPasswordRequest): Promise<void> {
    const phoneNumber = formatPhoneNumber(data.phoneNumber);

    if (!isValidPhoneNumber(phoneNumber)) {
      throw new AppError(400, "Invalid phone number format", ErrorCodes.INVALID_PHONE);
    }

    // Verify OTP first
    await OTPService.verifyOTP(phoneNumber, data.otp);

    // Reset password
    await PasswordService.resetPassword(phoneNumber, data.newPassword);
  },

  async refreshToken(token: string): Promise<{ accessToken: string; refreshToken: string }> {
    const refreshToken = await TokenService.verifyRefreshToken(token);

    // Find user
    const result = await docClient.get({
      TableName: TABLES.USERS,
      Key: { userId: refreshToken.userId },
    });

    const user = result.Item as User | undefined;

    if (!user) {
      throw new AppError(404, "User not found", ErrorCodes.USER_NOT_FOUND);
    }

    // Generate new access token
    const accessToken = TokenService.generateAccessToken(user);

    // Generate new refresh token (token rotation)
    const newRefreshToken = await TokenService.generateRefreshToken(user.userId, refreshToken.family);

    // Invalidate old refresh token
    await docClient.delete({
      TableName: TABLES.TOKENS,
      Key: { tokenId: refreshToken.tokenId },
    });

    return {
      accessToken,
      refreshToken: newRefreshToken,
    };
  },
};
