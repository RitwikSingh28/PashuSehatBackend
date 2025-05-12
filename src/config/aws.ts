import { DynamoDB } from "@aws-sdk/client-dynamodb";
import { S3 } from "@aws-sdk/client-s3";
import { SNS } from "@aws-sdk/client-sns";
import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb";
import env from "#config/env.js";

// AWS SDK v3 configuration
const config = {
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
};

// Initialize DynamoDB
const dynamoDb = new DynamoDB(config);
export const docClient = DynamoDBDocument.from(dynamoDb);

// Initialize S3
export const s3 = new S3(config);

// Initialize SNS (for SMS)
export const sns = new SNS(config);

// Table names
export const TABLES = {
  USERS: env.DYNAMODB_USERS_TABLE,
  TOKENS: env.DYNAMODB_TOKENS_TABLE,
  OTP: env.DYNAMODB_OTP_TABLE,
  TAGS: env.DYNAMODB_TAGS_TABLE,
  CATTLE: env.DYNAMODB_CATTLE_TABLE,
  TELEMETRY: env.DYNAMODB_TELEMETRY_TABLE,
  ALERTS: env.DYNAMODB_ALERTS_TABLE,
} as const;
