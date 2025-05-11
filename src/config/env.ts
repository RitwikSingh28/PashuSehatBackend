import { z } from "zod";

const envSchema = z.object({
  // Server
  PORT: z.string().default("3000"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  // JWT
  JWT_ACCESS_SECRET: z.string(),
  JWT_REFRESH_SECRET: z.string(),
  JWT_ACCESS_EXPIRY: z.string().default("15m"),
  JWT_REFRESH_EXPIRY: z.string().default("30d"),

  // AWS
  AWS_REGION: z.string(),
  AWS_ACCESS_KEY_ID: z.string(),
  AWS_SECRET_ACCESS_KEY: z.string(),

  // DynamoDB Tables
  DYNAMODB_USERS_TABLE: z.string(),
  DYNAMODB_TOKENS_TABLE: z.string(),
  DYNAMODB_OTP_TABLE: z.string(),
  DYNAMODB_TAGS_TABLE: z.string(),

  // S3
  S3_BUCKET_NAME: z.string(),

  // SNS
  SNS_TOPIC_ARN: z.string(),

  // Admin Configuration
  ADMIN_PHONE_NUMBERS: z.string().optional(),
});

const env = envSchema.parse(process.env);

// Debug log environment variables
console.log("Environment Variables:", {
  adminPhones: env.ADMIN_PHONE_NUMBERS,
  parsedPhones: env.ADMIN_PHONE_NUMBERS?.split(",") ?? [],
  nodeEnv: env.NODE_ENV,
});

export default env;
