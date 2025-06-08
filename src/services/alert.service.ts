import { docClient, TABLES } from "#config/aws.js";
import { AppError } from "#utils/errors.js";
import { Alert } from "#types/alert.types.js";
import telemetryService from "#services/telemetry.service.js";
import { z } from "zod";
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";

// Validation schemas
const timeRangeSchema = z
  .object({
    startTime: z.number().optional(),
    endTime: z.number().optional(),
  })
  .refine((data) => !(data.startTime && !data.endTime) && !(!data.startTime && data.endTime), {
    message: "Both startTime and endTime must be provided together",
  });

const statusSchema = z.enum(["new", "acknowledged", "all"]).optional();

interface AlertWithTelemetry extends Alert {
  recentTelemetry: Array<{
    timestamp: number;
    temperature: number;
    pulseRate: number;
    motionData: number;
    batteryLevel?: number;
  }>;
}


export class AlertService {
  /**
   * Get an alert by ID
   */
  async getAlert(alertId: string): Promise<Alert | null> {
    const result = await docClient.get({
      TableName: TABLES.ALERTS,
      Key: { alertId },
    });

    return result.Item as Alert | null;
  }

  /**
   * Get all alerts for a user
   */
  async getAlertsForUser(userId: string, status?: "new" | "acknowledged" | "all", startTime?: number, endTime?: number): Promise<AlertWithTelemetry[]> {
    // Validate inputs
    statusSchema.parse(status);
    timeRangeSchema.parse({ startTime, endTime });

    const expressionAttributeValues: Record<string, unknown> = {
      ":userId": userId,
    };
    let keyConditionExpression = "userId = :userId";

    const filterExpressions: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};

    // Add status filter if provided
    if (status && status !== "all") {
      filterExpressions.push("#status = :status");
      expressionAttributeValues[":status"] = status;
      expressionAttributeNames["#status"] = "status";
    }

    // Add time range if provided
    if (startTime && endTime) {
      keyConditionExpression += " AND #ts BETWEEN :startTime AND :endTime";
      expressionAttributeValues[":startTime"] = startTime;
      expressionAttributeValues[":endTime"] = endTime;
      expressionAttributeNames["#ts"] = "timestamp";
    }

    const result = await docClient.query({
      TableName: TABLES.ALERTS,
      IndexName: "UserIdIndex",
      KeyConditionExpression: keyConditionExpression,
      FilterExpression: filterExpressions.length > 0 ? filterExpressions.join(" AND ") : undefined,
      ExpressionAttributeValues: expressionAttributeValues,
      ExpressionAttributeNames: Object.keys(expressionAttributeNames).length > 0 ? expressionAttributeNames : undefined,
      Limit: 50,
      ScanIndexForward: false, // newest first
    });

    return this.enrichAlertsWithTelemetry(result.Items as Alert[]);
  }

  /**
   * Get alerts for a specific cattle
   */
  async getAlertsForCattle(cattleId: string, status?: "new" | "acknowledged" | "all", startTime?: number, endTime?: number): Promise<AlertWithTelemetry[]> {
    // Validate inputs
    statusSchema.parse(status);
    timeRangeSchema.parse({ startTime, endTime });

    const expressionAttributeValues: Record<string, unknown> = {
      ":cattleId": cattleId,
    };
    let keyConditionExpression = "cattleId = :cattleId";

    const filterExpressions: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};

    // Add status filter if provided
    if (status && status !== "all") {
      filterExpressions.push("#status = :status");
      expressionAttributeValues[":status"] = status;
      expressionAttributeNames["#status"] = "status";
    }

    // Add time range if provided
    if (startTime && endTime) {
      keyConditionExpression += " AND #ts BETWEEN :startTime AND :endTime";
      expressionAttributeValues[":startTime"] = startTime;
      expressionAttributeValues[":endTime"] = endTime;
      expressionAttributeNames["#ts"] = "timestamp";
    }

    const result = await docClient.query({
      TableName: TABLES.ALERTS,
      IndexName: "CattleIdIndex",
      KeyConditionExpression: keyConditionExpression,
      FilterExpression: filterExpressions.length > 0 ? filterExpressions.join(" AND ") : undefined,
      ExpressionAttributeValues: expressionAttributeValues,
      ExpressionAttributeNames: Object.keys(expressionAttributeNames).length > 0 ? expressionAttributeNames : undefined,
      Limit: 50,
      ScanIndexForward: false, // newest first
    });

    return this.enrichAlertsWithTelemetry(result.Items as Alert[]);
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId: string, userId: string): Promise<Alert | null> {
    const now = Date.now();

    try {
      const result = await docClient.update({
        TableName: TABLES.ALERTS,
        Key: { alertId },
        UpdateExpression: "SET #status = :status, acknowledgedBy = :acknowledgedBy, acknowledgedAt = :acknowledgedAt",
        ConditionExpression: "attribute_exists(alertId) AND #status = :newStatus",
        ExpressionAttributeNames: {
          "#status": "status",
        },
        ExpressionAttributeValues: {
          ":status": "acknowledged",
          ":acknowledgedBy": userId,
          ":acknowledgedAt": now,
          ":newStatus": "new",
        },
        ReturnValues: "ALL_NEW",
      });

      return result.Attributes as Alert | null;
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) {
        throw new AppError(400, "Alert cannot be acknowledged", "INVALID_OPERATION", {
          details: "Alert may not exist or is already acknowledged",
        });
      }
      throw error;
    }
  }

  /**
   * Enrich alerts with recent telemetry data
   */
  private async enrichAlertsWithTelemetry(alerts: Alert[]): Promise<AlertWithTelemetry[]> {
    // Group alerts by tagId to minimize telemetry service calls
    const tagGroups = new Map<string, Alert[]>();
    alerts.forEach(alert => {
      const group = tagGroups.get(alert.tagId) || [];
      group.push(alert);
      tagGroups.set(alert.tagId, group);
    });

    // Fetch telemetry data for each unique tagId
    const enrichedAlerts: AlertWithTelemetry[] = [];
    for (const [tagId, tagAlerts] of tagGroups) {
      // For each alert, get telemetry data from 10 minutes before the alert
      for (const alert of tagAlerts) {
        const endTime = alert.timestamp;
        const startTime = endTime - (10 * 60 * 1000); // 10 minutes before alert
        const readings = await telemetryService.getRecentTelemetry(tagId, 10, startTime, endTime);
        enrichedAlerts.push({ ...alert, recentTelemetry: readings });
      }

    }

    return enrichedAlerts.sort((a, b) => b.timestamp - a.timestamp);
  }
}

export default new AlertService();
