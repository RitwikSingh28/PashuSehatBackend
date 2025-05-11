import { Request, Response, NextFunction } from "express";
import { AppError } from "#utils/errors.js";
import tagService from "#services/tag.service.js";

interface RegisterTagsRequest extends Request {
  body: {
    tagIds: string[];
  };
}

export class AdminController {
  /**
   * Register multiple collar tags (Admin only)
   */
  async registerTags(req: RegisterTagsRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { tagIds } = req.body;

      // Validate input
      if (!Array.isArray(tagIds) || tagIds.length === 0) {
        throw new AppError(400, "Please provide an array of tag IDs", "INVALID_INPUT");
      }

      // Validate each tag ID format (alphanumeric, certain length)
      const validTagPattern = /^[A-Z0-9]{8,12}$/;
      const invalidTags = tagIds.filter((id: string) => !validTagPattern.test(id));

      if (invalidTags.length > 0) {
        throw new AppError(400, "Tag IDs must be 8-12 characters and contain only uppercase letters and numbers", "INVALID_INPUT", { invalidTags });
      }

      // Register tags
      const result = await tagService.registerBulkTags(tagIds);

      // Return results
      res.status(200).json({
        message: `Successfully registered ${String(result.successful.length)} tags`,
        successful: result.successful,
        failed: result.failed,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all registered tags
   */
  async listTags(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tags = await tagService.listTags();
      res.status(200).json(tags);
    } catch (error) {
      next(error);
    }
  }
}

export default new AdminController();
