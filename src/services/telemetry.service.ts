import { docClient, TABLES } from "#config/aws.js";
import { AppError } from "#utils/errors.js";
import { TelemetryReading } from "#types/telemetry.types.js";

export class TelemetryService {
  /**
   * Get recent telemetry for a specific tag
   */
  async getRecentTelemetry(tagId: string, minutes = 10): Promise<TelemetryReading[]> {
    // Validate input
    if (minutes <= 0 || minutes > 1440) {
      // Max 24 hours
      throw new AppError(400, "Minutes must be between 1 and 1440", "INVALID_INPUT");
    }

    const endTime = Date.now();
    const startTime = endTime - minutes * 60 * 1000;

    const result = await docClient.query({
      TableName: TABLES.TELEMETRY,
      KeyConditionExpression: "tagId = :tagId AND #ts BETWEEN :start AND :end",
      ExpressionAttributeNames: {
        "#ts": "timestamp",
      },
      ExpressionAttributeValues: {
        ":tagId": tagId,
        ":start": startTime,
        ":end": endTime,
      },
      ScanIndexForward: true, // ascending order by timestamp
    });

    return result.Items as TelemetryReading[];
  }

  /**
   * Get telemetry statistics for a specific tag
   */
  async getTelemetryStats(
    tagId: string,
    minutes = 60,
  ): Promise<{
    avgTemperature: number;
    avgPulseRate: number;
    avgMotion: number;
    lastBatteryLevel?: number;
    readingCount: number;
  }> {
    const readings = await this.getRecentTelemetry(tagId, minutes);

    if (readings.length === 0) {
      return {
        avgTemperature: 0,
        avgPulseRate: 0,
        avgMotion: 0,
        readingCount: 0,
      };
    }

    const stats = readings.reduce(
      (acc, reading) => {
        acc.totalTemp += reading.temperature;
        acc.totalPulse += reading.pulseRate;
        acc.totalMotion += reading.motionData;
        if (reading.batteryLevel !== undefined) {
          acc.lastBattery = reading.batteryLevel;
        }
        return acc;
      },
      {
        totalTemp: 0,
        totalPulse: 0,
        totalMotion: 0,
        lastBattery: undefined as number | undefined,
      },
    );

    const count = readings.length;

    return {
      avgTemperature: Number((stats.totalTemp / count).toFixed(1)),
      avgPulseRate: Math.round(stats.totalPulse / count),
      avgMotion: Number((stats.totalMotion / count).toFixed(1)),
      ...(stats.lastBattery !== undefined && { lastBatteryLevel: stats.lastBattery }),
      readingCount: count,
    };
  }
}

export default new TelemetryService();
