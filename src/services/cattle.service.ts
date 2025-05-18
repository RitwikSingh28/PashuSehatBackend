import { v4 as uuidv4 } from "uuid";
import { docClient, TABLES } from "#config/aws.js";
import { AppError } from "#utils/errors.js";
import type { Cattle } from "#types/cattle.types.js";
import tagService from "#services/tag.service.js";
import { z } from "zod";

// Validation schemas
const createCattleSchema = z.object({
  tagId: z.string(),
  name: z.string(),
  dateOfBirth: z.number(),
  gender: z.enum(["MALE", "FEMALE"]),
  ageGroup: z.enum(["CALF", "ADULT", "RETIRED"]),
  breed: z.string(),
  governmentId: z.string().optional(),
  fatherName: z.string().optional(),
  motherName: z.string().optional(),
  notes: z.array(z.string()).default([]),
});

type CreateCattleInput = z.infer<typeof createCattleSchema>;
type UpdateCattleInput = Partial<CreateCattleInput>;

export class CattleService {
  /**
   * Register a new cattle
   */
  async createCattle(userId: string, data: unknown): Promise<Cattle> {
    // Validate input data
    const validatedData = createCattleSchema.parse(data);

    // First check if tag exists and is available
    const tag = await tagService.getTag(validatedData.tagId);
    if (!tag) {
      throw new AppError(404, "The specified tag ID does not exist", "TAG_NOT_FOUND");
    }

    if (tag.isAssigned) {
      throw new AppError(400, "The specified tag is already assigned to another cattle", "TAG_ALREADY_ASSIGNED");
    }

    const now = Date.now();
    const cattleId = uuidv4();

    const cattle: Cattle = {
      cattleId,
      userId,
      tagId: validatedData.tagId,
      name: validatedData.name,
      dateOfBirth: validatedData.dateOfBirth,
      gender: validatedData.gender,
      ageGroup: validatedData.ageGroup,
      breed: validatedData.breed,
      governmentId: validatedData.governmentId,
      fatherName: validatedData.fatherName,
      motherName: validatedData.motherName,
      notes: validatedData.notes,
      createdAt: now,
      updatedAt: now,
    };

    // Create cattle in DynamoDB
    await docClient.put({
      TableName: TABLES.CATTLE,
      Item: cattle,
    });

    // Update tag to mark it as assigned
    await tagService.updateTagStatus(validatedData.tagId, true);

    return cattle;
  }

  /**
   * Get a cattle by ID
   */
  async getCattle(cattleId: string): Promise<Cattle | null> {
    const result = await docClient.get({
      TableName: TABLES.CATTLE,
      Key: { cattleId },
    });

    return result.Item as Cattle | null;
  }

  /**
   * Get cattle by tag ID
   */
  async getCattleByTagId(tagId: string): Promise<Cattle | null> {
    const result = await docClient.query({
      TableName: TABLES.CATTLE,
      IndexName: "TagIdIndex",
      KeyConditionExpression: "tagId = :tagId",
      ExpressionAttributeValues: {
        ":tagId": tagId,
      },
    });

    return result.Items?.[0] as Cattle | null;
  }

  /**
   * List all cattle for a user
   */
  async listCattleForUser(userId: string): Promise<Cattle[]> {
    const result = await docClient.query({
      TableName: TABLES.CATTLE,
      IndexName: "UserIdIndex",
      KeyConditionExpression: "userId = :userId",
      ExpressionAttributeValues: {
        ":userId": userId,
      },
    });

    return (result.Items ?? []) as Cattle[];
  }

  /**
   * Update cattle information
   */
  async updateCattle(cattleId: string, updates: UpdateCattleInput): Promise<Cattle | null> {
    const updateExpressions: string[] = ["#updatedAt = :updatedAt"];
    const expressionAttributeValues: Record<string, unknown> = {
      ":updatedAt": Date.now(),
    };
    const expressionAttributeNames: Record<string, string> = {
      "#updatedAt": "updatedAt",
    };

    // Add each field to the update expression if it exists
    for (const [key, value] of Object.entries(updates)) {
      const attributeName = `#${key}`;
      const attributeValue = `:${key}`;
      updateExpressions.push(`${attributeName} = ${attributeValue}`);
      expressionAttributeValues[attributeValue] = value;
      expressionAttributeNames[attributeName] = key;
    }

    const result = await docClient.update({
      TableName: TABLES.CATTLE,
      Key: { cattleId },
      UpdateExpression: `SET ${updateExpressions.join(", ")}`,
      ExpressionAttributeValues: expressionAttributeValues,
      ExpressionAttributeNames: expressionAttributeNames,
      ReturnValues: "ALL_NEW",
    });

    return result.Attributes as Cattle | null;
  }

  /**
   * Add a note to cattle
   */
  async addNote(cattleId: string, note: string): Promise<Cattle | null> {
    const result = await docClient.update({
      TableName: TABLES.CATTLE,
      Key: { cattleId },
      UpdateExpression: "SET #notes = list_append(if_not_exists(#notes, :empty_list), :new_note), #updatedAt = :updatedAt",
      ExpressionAttributeNames: {
        "#notes": "notes",
        "#updatedAt": "updatedAt",
      },
      ExpressionAttributeValues: {
        ":new_note": [note],
        ":empty_list": [],
        ":updatedAt": Date.now(),
      },
      ReturnValues: "ALL_NEW",
    });

    return result.Attributes as Cattle | null;
  }

  /**
   * Delete cattle
   */
  async deleteCattle(cattleId: string): Promise<void> {
    // First get the cattle to find the tag ID
    const cattle = await this.getCattle(cattleId);
    if (!cattle) {
      throw new AppError(404, "Cattle not found", "CATTLE_NOT_FOUND");
    }

    // Delete the cattle
    await docClient.delete({
      TableName: TABLES.CATTLE,
      Key: { cattleId },
    });

    // Update the tag to mark it as unassigned
    await tagService.updateTagStatus(cattle.tagId, false);
  }
}

export default new CattleService();
