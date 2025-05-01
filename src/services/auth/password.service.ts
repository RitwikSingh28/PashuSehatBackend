import bcrypt from "bcryptjs";
import { docClient, TABLES } from "#config/aws.js";
import { AppError, ErrorCodes } from "#utils/errors.js";
import { isValidPassword } from "#utils/validators.js";
import type { User } from "#types/auth.js";

const SALT_ROUNDS = 10;

export const PasswordService = {
  /**
   * Hash a password
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  },

  /**
   * Compare a password with a hash
   */
  async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  },

  /**
   * Update a user's password
   */
  async updatePassword(userId: string, newPassword: string): Promise<void> {
    if (!isValidPassword(newPassword)) {
      throw new AppError(400, "Invalid password format", ErrorCodes.INVALID_PASSWORD);
    }

    const passwordHash = await this.hashPassword(newPassword);

    await docClient.update({
      TableName: TABLES.USERS,
      Key: { userId },
      UpdateExpression: "SET passwordHash = :hash",
      ExpressionAttributeValues: {
        ":hash": passwordHash,
      },
    });
  },

  /**
   * Reset a user's password using OTP verification
   */
  async resetPassword(phoneNumber: string, newPassword: string): Promise<void> {
    if (!isValidPassword(newPassword)) {
      throw new AppError(400, "Invalid password format", ErrorCodes.INVALID_PASSWORD);
    }

    const result = await docClient.query({
      TableName: TABLES.USERS,
      IndexName: "PhoneNumberIndex",
      KeyConditionExpression: "phoneNumber = :phone",
      ExpressionAttributeValues: {
        ":phone": phoneNumber,
      },
    });

    const user = result.Items?.[0] as User | undefined;

    if (!user) {
      throw new AppError(404, "User not found", ErrorCodes.USER_NOT_FOUND);
    }

    const passwordHash = await this.hashPassword(newPassword);

    await docClient.update({
      TableName: TABLES.USERS,
      Key: { userId: user.userId },
      UpdateExpression: "SET passwordHash = :hash",
      ExpressionAttributeValues: {
        ":hash": passwordHash,
      },
    });
  },

  /**
   * Validate password format
   */
  validatePassword(password: string): void {
    if (!isValidPassword(password)) {
      throw new AppError(
        400,
        "Password must start with a capital letter, contain at least one number and one special character, and be at least 6 characters long",
        ErrorCodes.INVALID_PASSWORD,
      );
    }
  },
};
