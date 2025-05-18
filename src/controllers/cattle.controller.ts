import { Request, Response, NextFunction } from "express";
import { AppError } from "#utils/errors.js";
import cattleService from "#services/cattle.service.js";
import { z } from "zod";

// Validation schemas
const createCattleSchema = z.object({
  tagId: z.string(),
  name: z.string(),
  dateOfBirth: z.string().transform((val) => new Date(val).getTime()),
  gender: z.enum(["MALE", "FEMALE"]),
  ageGroup: z.enum(["CALF", "ADULT", "RETIRED"]),
  breed: z.string(),
  governmentId: z.string().optional(),
  fatherName: z.string().optional(),
  motherName: z.string().optional(),
  notes: z.array(z.string()).default([]),
});

const updateCattleSchema = createCattleSchema.partial();

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
      const cattle = await cattleService.createCattle(userId, validatedData);

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
   * Add a note to cattle
   */
  async addNote(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { cattleId } = req.params;
      const { note } = req.body as { note?: string };
      const userId = req.user?.userId;

      if (!userId) {
        throw new AppError(401, "Authentication required", "UNAUTHORIZED");
      }

      if (!note) {
        throw new AppError(400, "Note is required", "INVALID_INPUT");
      }

      // Check if the cattle exists and belongs to the user
      const existingCattle = await cattleService.getCattle(cattleId);
      if (!existingCattle || existingCattle.userId !== userId) {
        throw new AppError(404, "Cattle not found", "CATTLE_NOT_FOUND");
      }

      // Add the note
      const updatedCattle = await cattleService.addNote(cattleId, note);

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
