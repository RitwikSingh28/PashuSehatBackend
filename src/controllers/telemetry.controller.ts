import { Request, Response, NextFunction } from "express";
import { AppError } from "#utils/errors.js";
import telemetryService from "#services/telemetry.service.js";
import cattleService from "#services/cattle.service.js";
import { z } from "zod";

// Validation schemas
const timeRangeSchema = z.object({
  minutes: z
    .string()
    .transform(Number)
    .refine((val) => val > 0 && val <= 1440, {
      message: "Minutes must be between 1 and 1440 (24 hours)",
    })
    .optional(),
});

export class TelemetryController {
  /**
   * Get recent telemetry readings for a specific cattle
   */
  async getRecentTelemetry(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { cattleId } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        throw new AppError(401, "Authentication required", "UNAUTHORIZED");
      }

      // Validate query parameters
      const { minutes } = timeRangeSchema.parse(req.query);

      // First check if the cattle exists and belongs to the user
      const cattle = await cattleService.getCattle(cattleId);
      if (!cattle || cattle.userId !== userId) {
        throw new AppError(404, "Cattle not found", "CATTLE_NOT_FOUND");
      }

      // Get telemetry data
      const telemetryData = await telemetryService.getRecentTelemetry(
        cattle.tagId,
        minutes ?? 10, // Default to last 10 minutes if not specified
      );

      res.status(200).json(telemetryData);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get telemetry statistics for a specific cattle
   */
  async getTelemetryStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { cattleId } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        throw new AppError(401, "Authentication required", "UNAUTHORIZED");
      }

      // Validate query parameters
      const { minutes } = timeRangeSchema.parse(req.query);

      // First check if the cattle exists and belongs to the user
      const cattle = await cattleService.getCattle(cattleId);
      if (!cattle || cattle.userId !== userId) {
        throw new AppError(404, "Cattle not found", "CATTLE_NOT_FOUND");
      }

      // Get telemetry statistics
      const stats = await telemetryService.getTelemetryStats(
        cattle.tagId,
        minutes ?? 60, // Default to last hour if not specified
      );

      res.status(200).json(stats);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get recent telemetry readings for all cattle owned by the user
   */
  async getAllCattleTelemetry(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        throw new AppError(401, "Authentication required", "UNAUTHORIZED");
      }

      // Validate query parameters
      const { minutes } = timeRangeSchema.parse(req.query);

      // Get all cattle owned by the user
      const cattleList = await cattleService.listCattleForUser(userId);

      // Get telemetry data for each cattle
      const telemetryPromises = cattleList.map(async (cattle) => {
        const telemetry = await telemetryService.getRecentTelemetry(
          cattle.tagId,
          minutes ?? 10, // Default to last 10 minutes
        );

        const stats = await telemetryService.getTelemetryStats(
          cattle.tagId,
          minutes ?? 60, // Default to last hour for stats
        );

        return {
          cattleId: cattle.cattleId,
          name: cattle.name,
          tagId: cattle.tagId,
          recentReadings: telemetry,
          statistics: stats,
        };
      });

      const allTelemetry = await Promise.all(telemetryPromises);

      res.status(200).json(allTelemetry);
    } catch (error) {
      next(error);
    }
  }
}

export default new TelemetryController();
