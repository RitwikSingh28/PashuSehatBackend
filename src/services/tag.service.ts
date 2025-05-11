import { docClient, TABLES } from "#config/aws.js";
import { Tag } from "#types/tag.types.js";

export class TagService {
  /**
   * Register a new tag in the system
   */
  async registerTag(tagId: string): Promise<Tag> {
    const now = Date.now();

    const tag: Tag = {
      tagId,
      isAssigned: false,
      createdAt: now,
    };

    await docClient.put({
      TableName: TABLES.TAGS,
      Item: tag,
      // Ensure we don't overwrite existing tags
      ConditionExpression: "attribute_not_exists(tagId)",
    });

    return tag;
  }

  /**
   * Register multiple tags at once
   */
  async registerBulkTags(tagIds: string[]): Promise<{ successful: string[]; failed: string[] }> {
    const successful: string[] = [];
    const failed: string[] = [];

    // Process each tag individually to handle failures
    for (const tagId of tagIds) {
      try {
        await this.registerTag(tagId);
        successful.push(tagId);
      } catch {
        failed.push(tagId);
      }
    }

    return { successful, failed };
  }

  /**
   * Get a tag by ID
   */
  async getTag(tagId: string): Promise<Tag | null> {
    const result = await docClient.get({
      TableName: TABLES.TAGS,
      Key: { tagId },
    });

    return result.Item as Tag | null;
  }

  /**
   * List all tags
   */
  async listTags(limit = 100): Promise<Tag[]> {
    const result = await docClient.scan({
      TableName: TABLES.TAGS,
      Limit: limit,
    });

    return (result.Items ?? []) as Tag[];
  }

  /**
   * Update tag status (assigned or not)
   */
  async updateTagStatus(tagId: string, isAssigned: boolean): Promise<Tag | null> {
    const result = await docClient.update({
      TableName: TABLES.TAGS,
      Key: { tagId },
      UpdateExpression: "SET isAssigned = :isAssigned",
      ExpressionAttributeValues: {
        ":isAssigned": isAssigned,
      },
      ReturnValues: "ALL_NEW",
    });

    return (result.Attributes ?? null) as Tag | null;
  }
}

export default new TagService();
