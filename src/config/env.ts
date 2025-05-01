import { z } from "zod";
import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.string().default("3000"),

  // AWS Configuration
  AWS_REGION: z.string().default("ap-south-1"),
  AWS_ACCESS_KEY_ID: z.string(),
  AWS_SECRET_ACCESS_KEY: z.string(),

  // DynamoDB Tables
  DYNAMODB_USERS_TABLE: z.string().default("cattle-health-users"),
  DYNAMODB_TOKENS_TABLE: z.string().default("cattle-health-tokens"),
  DYNAMODB_OTP_TABLE: z.string().default("cattle-health-otp"),

  // SNS Configuration
  SNS_TOPIC_ARN: z.string(),

  // JWT Configuration
  JWT_ACCESS_SECRET: z.string().default("dev-access-secret"),
  JWT_REFRESH_SECRET: z.string().default("dev-refresh-secret"),
  JWT_ACCESS_EXPIRY: z.string().default("15m"),
  JWT_REFRESH_EXPIRY: z.string().default("30d"),
});

// Parse and validate environment variables
const env = envSchema.parse(process.env);

export default env;
