import jwt, { SignOptions, Secret } from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { docClient, TABLES } from "#config/aws.js";
import env from "#config/env.js";
import { AppError } from "#utils/errors.js";
import type { User, RefreshToken, AccessTokenPayload } from "#types/auth.js";

export const TokenService = {
  /**
   * Generate access token for a user
   */
  generateAccessToken(user: Omit<User, "passwordHash">): string {
    const options: SignOptions = {
      expiresIn: env.JWT_ACCESS_EXPIRY as jwt.SignOptions["expiresIn"],
    };

    const payload: Omit<AccessTokenPayload, "iat" | "exp"> = {
      userId: user.userId,
      phoneNumber: user.phoneNumber,
      isVerified: user.isVerified,
      farmLocation: user.farmLocation,
    };

    // Debug log
    console.log("Creating token with payload:", payload);

    return jwt.sign(payload, env.JWT_ACCESS_SECRET as Secret, options);
  },

  /**
   * Generate a new refresh token and store it in DynamoDB
   */
  async generateRefreshToken(userId: string, family?: string): Promise<string> {
    const tokenId = uuidv4();
    const options: SignOptions = {
      expiresIn: env.JWT_REFRESH_EXPIRY as jwt.SignOptions["expiresIn"],
    };

    const token = jwt.sign({ tokenId }, env.JWT_REFRESH_SECRET as Secret, options);

    const now = Date.now();
    const expiresAt = now + 30 * 24 * 60 * 60 * 1000; // 30 days

    const refreshToken: RefreshToken = {
      tokenId,
      userId,
      token,
      family: family ?? uuidv4(), // New family if not provided
      expiresAt,
      createdAt: now,
    };

    await docClient.put({
      TableName: TABLES.TOKENS,
      Item: refreshToken,
    });

    return token;
  },

  /**
   * Verify and decode an access token
   */
  verifyAccessToken(token: string): AccessTokenPayload {
    try {
      const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET as Secret);
      return decoded as AccessTokenPayload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new AppError(401, "Access token expired", "TOKEN_EXPIRED");
      }
      throw new AppError(401, "Invalid access token", "INVALID_TOKEN");
    }
  },

  /**
   * Verify a refresh token and return the associated refresh token record
   */
  async verifyRefreshToken(token: string): Promise<RefreshToken> {
    try {
      const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET as Secret) as { tokenId: string };

      const result = await docClient.get({
        TableName: TABLES.TOKENS,
        Key: { tokenId: decoded.tokenId },
      });

      const refreshToken = result.Item as RefreshToken;
      if (result.Item === undefined) {
        throw new AppError(401, "Invalid refresh token", "INVALID_TOKEN");
      }

      if (refreshToken.expiresAt < Date.now()) {
        throw new AppError(401, "Refresh token expired", "TOKEN_EXPIRED");
      }

      return refreshToken;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(401, "Invalid refresh token", "INVALID_TOKEN");
    }
  },

  /**
   * Invalidate all refresh tokens for a given family
   */
  async invalidateTokenFamily(family: string): Promise<void> {
    // Note: This is a simplified version. In production, we'd need to handle pagination
    const result = await docClient.scan({
      TableName: TABLES.TOKENS,
      FilterExpression: "family = :family",
      ExpressionAttributeValues: {
        ":family": family,
      },
    });

    const tokens = result.Items as RefreshToken[];
    if (tokens.length > 0) {
      await Promise.all(
        tokens.map((token) =>
          docClient.delete({
            TableName: TABLES.TOKENS,
            Key: { tokenId: token.tokenId },
          }),
        ),
      );
    }
  },
};
