import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.string().default("3000"),

  // AWS Configuration
  AWS_REGION: z.string().default("ap-south-1"),
  AWS_ACCESS_KEY_ID: z.string(),
  AWS_SECRET_ACCESS_KEY: z.string(),

  // DynamoDB Tables
  DYNAMODB_USERS_TABLE: z.string(),
  DYNAMODB_TOKENS_TABLE: z.string(),
  DYNAMODB_OTP_TABLE: z.string(),

  // S3
  S3_BUCKET_NAME: z.string(),

  // JWT Configuration
  JWT_ACCESS_SECRET: z.string(),
  JWT_REFRESH_SECRET: z.string(),
  JWT_ACCESS_EXPIRY: z.string().default("30m"),
  JWT_REFRESH_EXPIRY: z.string().default("30d"),

  // Redis (for caching)
  REDIS_URI: z.string(),
});

const env = envSchema.parse(process.env);

export default env;
