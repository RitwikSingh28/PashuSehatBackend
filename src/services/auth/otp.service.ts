import { docClient, sns, TABLES } from "#config/aws.js";
import { AppError, ErrorCodes } from "#utils/errors.js";
import type { OTPRecord } from "#types/auth.js";
import { generateOTP } from "#utils/validators.js";

const OTP_EXPIRY = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 3;

export const OTPService = {
  /**
   * Generate and send OTP to a phone number
   */
  async generateAndSendOTP(phoneNumber: string): Promise<void> {
    const otp = generateOTP();
    const now = Date.now();

    const otpRecord: OTPRecord = {
      phoneNumber,
      otp,
      expiresAt: now + OTP_EXPIRY,
      attempts: 0,
      createdAt: now,
    };

    // Store OTP in DynamoDB
    await docClient.put({
      TableName: TABLES.OTP,
      Item: otpRecord,
    });

    // Send OTP via SNS
    try {
      await sns.publish({
        PhoneNumber: phoneNumber,
        Message: `Your PashuSehat verification code is: ${otp}. Valid for 10 minutes.`,
      });
    } catch (error) {
      console.error("Failed to send OTP:", error);
      throw new AppError(500, "Failed to send OTP", ErrorCodes.INTERNAL_ERROR);
    }
  },

  /**
   * Verify an OTP for a phone number
   */
  async verifyOTP(phoneNumber: string, otp: string): Promise<void> {
    const result = await docClient.get({
      TableName: TABLES.OTP,
      Key: { phoneNumber },
    });

    const otpRecord = result.Item as OTPRecord | undefined;

    if (!otpRecord) {
      throw new AppError(400, "No OTP found for this number", ErrorCodes.INVALID_OTP);
    }

    if (otpRecord.expiresAt < Date.now()) {
      throw new AppError(400, "OTP has expired", ErrorCodes.OTP_EXPIRED);
    }

    if (otpRecord.attempts >= MAX_ATTEMPTS) {
      throw new AppError(400, "Too many attempts", ErrorCodes.TOO_MANY_ATTEMPTS);
    }

    // Increment attempts
    await docClient.update({
      TableName: TABLES.OTP,
      Key: { phoneNumber },
      UpdateExpression: "SET attempts = attempts + :inc",
      ExpressionAttributeValues: {
        ":inc": 1,
      },
    });

    if (otpRecord.otp !== otp) {
      throw new AppError(400, "Invalid OTP", ErrorCodes.INVALID_OTP);
    }

    // OTP verified successfully, delete it
    await docClient.delete({
      TableName: TABLES.OTP,
      Key: { phoneNumber },
    });
  },

  /**
   * Clear expired OTPs (this would typically be run by a scheduled Lambda)
   */
  async clearExpiredOTPs(): Promise<void> {
    const now = Date.now();

    const result = await docClient.scan({
      TableName: TABLES.OTP,
      FilterExpression: "expiresAt < :now",
      ExpressionAttributeValues: {
        ":now": now,
      },
    });

    const expiredItems = result.Items as OTPRecord[] | undefined;
    if (expiredItems?.length) {
      await Promise.all(
        expiredItems.map((item) =>
          docClient.delete({
            TableName: TABLES.OTP,
            Key: { phoneNumber: item.phoneNumber },
          }),
        ),
      );
    }
  },
};
