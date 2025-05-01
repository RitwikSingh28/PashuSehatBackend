import { v4 as uuidv4 } from "uuid";
import { docClient, TABLES } from "#config/aws.js";
import { AppError, ErrorCodes } from "#utils/errors.js";
import { TokenService } from "./token.service.js";
import { OTPService } from "./otp.service.js";
import { PasswordService } from "./password.service.js";
import { formatPhoneNumber, isValidPhoneNumber, isValidPinCode } from "#utils/validators.js";
import type {
  User,
  LoginResponse,
  PhonePasswordLoginRequest,
  PhoneOTPLoginRequest,
  RequestOTPRequest,
  ResetPasswordRequest,
  SignupRequest,
  VerifyPhoneRequest,
  RefreshToken,
} from "#types/auth.js";

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

async function findUserByPhone(phoneNumber: string): Promise<User | undefined> {
  const result = await docClient.query({
    TableName: TABLES.USERS,
    IndexName: "PhoneNumberIndex",
    KeyConditionExpression: "phoneNumber = :phone",
    ExpressionAttributeValues: {
      ":phone": phoneNumber,
    },
  });

  return result.Items?.[0] as User | undefined;
}

export const AuthService = {
  async signup(data: SignupRequest): Promise<{ userId: string }> {
    const phoneNumber = formatPhoneNumber(data.phoneNumber);

    if (!isValidPhoneNumber(phoneNumber)) {
      throw new AppError(400, "Invalid phone number format", ErrorCodes.INVALID_PHONE);
    }

    if (!isValidPinCode(data.pinCode)) {
      throw new AppError(400, "Invalid PIN code format", ErrorCodes.INVALID_INPUT);
    }

    if (data.farmAddress.length > 120) {
      throw new AppError(400, "Farm address must be 120 characters or less", ErrorCodes.INVALID_INPUT);
    }

    // Check if phone number already exists
    const existingUser = await findUserByPhone(phoneNumber);

    if (existingUser) {
      throw new AppError(409, "Phone number already registered", ErrorCodes.DUPLICATE_PHONE);
    }

    // Hash password
    const passwordHash = await PasswordService.hashPassword(data.password);

    // Create new user
    const user: User = {
      userId: uuidv4(),
      phoneNumber,
      passwordHash,
      name: data.name,
      farmLocation: {
        address: data.farmAddress,
        pinCode: data.pinCode,
      },
      isVerified: false,
      createdAt: Date.now(),
      lastLogin: Date.now(),
    };

    await docClient.put({
      TableName: TABLES.USERS,
      Item: user,
    });

    return { userId: user.userId };
  },

  async verifyPhone(data: VerifyPhoneRequest): Promise<LoginResponse> {
    const phoneNumber = formatPhoneNumber(data.phoneNumber);

    if (!isValidPhoneNumber(phoneNumber)) {
      throw new AppError(400, "Invalid phone number format", ErrorCodes.INVALID_PHONE);
    }

    // Verify OTP
    await OTPService.verifyOTP(phoneNumber, data.otp);

    // Find user
    const user = await findUserByPhone(phoneNumber);

    if (!user) {
      throw new AppError(404, "User not found", ErrorCodes.USER_NOT_FOUND);
    }

    // Update verification status
    await docClient.update({
      TableName: TABLES.USERS,
      Key: { userId: user.userId },
      UpdateExpression: "SET isVerified = :verified",
      ExpressionAttributeValues: {
        ":verified": true,
      },
    });

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
      user: {
        ...userWithoutPassword,
        isVerified: true, // Update local copy since we just verified
      },
    };
  },

  async loginWithPassword(data: PhonePasswordLoginRequest): Promise<LoginResponse> {
    const phoneNumber = formatPhoneNumber(data.phoneNumber);

    if (!isValidPhoneNumber(phoneNumber)) {
      throw new AppError(400, "Invalid phone number format", ErrorCodes.INVALID_PHONE);
    }

    // Find user by phone number
    const user = await findUserByPhone(phoneNumber);

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

    // Find user
    const user = await findUserByPhone(phoneNumber);

    if (!user) {
      throw new AppError(404, "User not found", ErrorCodes.USER_NOT_FOUND);
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

  async deleteUser(identifier: { userId?: string; phoneNumber?: string }): Promise<void> {
    let user: User | undefined;

    if (identifier.phoneNumber) {
      const phoneNumber = formatPhoneNumber(identifier.phoneNumber);
      user = await findUserByPhone(phoneNumber);
    } else if (identifier.userId) {
      const result = await docClient.get({
        TableName: TABLES.USERS,
        Key: { userId: identifier.userId },
      });
      user = result.Item as User | undefined;
    } else {
      throw new AppError(400, "Either userId or phoneNumber is required", ErrorCodes.INVALID_INPUT);
    }

    if (!user) {
      throw new AppError(404, "User not found", ErrorCodes.USER_NOT_FOUND);
    }

    // Delete all refresh tokens for the user
    const tokenResult = await docClient.scan({
      TableName: TABLES.TOKENS,
      FilterExpression: "userId = :userId",
      ExpressionAttributeValues: {
        ":userId": user.userId,
      },
    });

    const tokens = tokenResult.Items as RefreshToken[] | undefined;
    if (tokens?.length) {
      await Promise.all(
        tokens.map((token) =>
          docClient.delete({
            TableName: TABLES.TOKENS,
            Key: { tokenId: token.tokenId },
          }),
        ),
      );
    }

    // Delete any pending OTP
    await docClient.delete({
      TableName: TABLES.OTP,
      Key: { phoneNumber: user.phoneNumber },
    });

    // Finally, delete the user
    await docClient.delete({
      TableName: TABLES.USERS,
      Key: { userId: user.userId },
    });
  },
};
