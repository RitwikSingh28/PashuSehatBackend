import { Request, Response, NextFunction } from "express";
import { AppError } from "#utils/errors.js";
import cattleService from "#services/cattle.service.js";
import { z } from "zod";

// Validation schemas
const createCattleSchema = z.object({
  tagId: z.string(),
  name: z.string(),
  age: z.number().positive(),
  gender: z.enum(["male", "female"]),
  breed: z.string(),
  notes: z.string().optional(),
});

const updateCattleSchema = z.object({
  name: z.string().optional(),
  age: z.number().positive().optional(),
  breed: z.string().optional(),
  healthStatus: z.enum(["healthy", "sick", "under_observation"]).optional(),
  notes: z.string().optional(),
});

export class CattleController {
  /**
   * Register a new cattle
   */
  async createCattle(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        throw new AppError(401, "Authentication required", "UNAUTHORIZED");
      }

      // Validate input
      const validatedData = createCattleSchema.parse(req.body);

      // Create the cattle
      const cattle = await cattleService.createCattle(
        userId,
        validatedData.tagId,
        validatedData.name,
        validatedData.age,
        validatedData.gender,
        validatedData.breed,
        validatedData.notes,
      );

      res.status(201).json(cattle);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get cattle by ID
   */
  async getCattle(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { cattleId } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        throw new AppError(401, "Authentication required", "UNAUTHORIZED");
      }

      const cattle = await cattleService.getCattle(cattleId);

      // Check if cattle exists and belongs to the user
      if (!cattle || cattle.userId !== userId) {
        throw new AppError(404, "Cattle not found", "CATTLE_NOT_FOUND");
      }

      res.status(200).json(cattle);
    } catch (error) {
      next(error);
    }
  }

  /**
   * List all cattle for the authenticated user
   */
  async listCattle(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        throw new AppError(401, "Authentication required", "UNAUTHORIZED");
      }

      const cattleList = await cattleService.listCattleForUser(userId);

      res.status(200).json(cattleList);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update cattle information
   */
  async updateCattle(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { cattleId } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        throw new AppError(401, "Authentication required", "UNAUTHORIZED");
      }

      // Check if the cattle exists and belongs to the user
      const existingCattle = await cattleService.getCattle(cattleId);
      if (!existingCattle || existingCattle.userId !== userId) {
        throw new AppError(404, "Cattle not found", "CATTLE_NOT_FOUND");
      }

      // Validate input
      const validatedData = updateCattleSchema.parse(req.body);

      // Update the cattle
      const updatedCattle = await cattleService.updateCattle(cattleId, validatedData);

      res.status(200).json(updatedCattle);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete cattle
   */
  async deleteCattle(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { cattleId } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        throw new AppError(401, "Authentication required", "UNAUTHORIZED");
      }

      // Check if the cattle exists and belongs to the user
      const existingCattle = await cattleService.getCattle(cattleId);
      if (!existingCattle || existingCattle.userId !== userId) {
        throw new AppError(404, "Cattle not found", "CATTLE_NOT_FOUND");
      }

      // Delete the cattle
      await cattleService.deleteCattle(cattleId);

      res.status(200).json({
        message: "Cattle deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new CattleController();
