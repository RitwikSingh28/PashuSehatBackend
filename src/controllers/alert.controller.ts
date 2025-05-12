import { Request, Response, NextFunction } from "express";
import { AppError } from "#utils/errors.js";
import alertService from "#services/alert.service.js";
import cattleService from "#services/cattle.service.js";
import { z } from "zod";

// Validation schemas
const queryParamsSchema = z
  .object({
    status: z.enum(["new", "acknowledged", "all"]).optional(),
    startDate: z
      .string()
      .datetime()
      .transform((val) => new Date(val).getTime())
      .optional(),
    endDate: z
      .string()
      .datetime()
      .transform((val) => new Date(val).getTime())
      .optional(),
  })
  .refine((data) => !(data.startDate && !data.endDate) && !(!data.startDate && data.endDate), {
    message: "Both startDate and endDate must be provided together",
  });

export class AlertController {
  /**
   * Get all alerts for authenticated user
   */
  async getUserAlerts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        throw new AppError(401, "Authentication required", "UNAUTHORIZED");
      }

      // Validate and parse query parameters
      const { status, startDate, endDate } = queryParamsSchema.parse(req.query);

      const alerts = await alertService.getAlertsForUser(userId, status, startDate, endDate);

      res.status(200).json(alerts);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get alerts for a specific cattle
   */
  async getCattleAlerts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { cattleId } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        throw new AppError(401, "Authentication required", "UNAUTHORIZED");
      }

      // Check if cattle belongs to user
      const cattle = await cattleService.getCattle(cattleId);
      if (!cattle || cattle.userId !== userId) {
        throw new AppError(404, "Cattle not found", "CATTLE_NOT_FOUND");
      }

      // Validate and parse query parameters
      const { status, startDate, endDate } = queryParamsSchema.parse(req.query);

      const alerts = await alertService.getAlertsForCattle(cattleId, status, startDate, endDate);

      res.status(200).json(alerts);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { alertId } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        throw new AppError(401, "Authentication required", "UNAUTHORIZED");
      }

      // Get the alert
      const alert = await alertService.getAlert(alertId);

      // Check if alert exists and belongs to user
      if (!alert) {
        throw new AppError(404, "Alert not found", "ALERT_NOT_FOUND");
      }

      if (alert.userId !== userId) {
        throw new AppError(403, "You don't have permission to acknowledge this alert", "FORBIDDEN");
      }

      // Check if already acknowledged
      if (alert.status === "acknowledged") {
        throw new AppError(400, "This alert has already been acknowledged", "ALREADY_ACKNOWLEDGED");
      }

      // Acknowledge the alert
      const updatedAlert = await alertService.acknowledgeAlert(alertId, userId);

      res.status(200).json(updatedAlert);
    } catch (error) {
      next(error);
    }
  }
}

export default new AlertController();
