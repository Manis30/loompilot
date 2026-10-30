import { getRedisClient } from "../config/redis.js";
import { logger } from "../utils/logger.js";

export class StatusCacheService {
  private static makeKey(
    realm: "user" | "client",
    tenantId: string,
    subjectId: string
  ): string {
    return `status:${realm}:${tenantId}:${subjectId}`;
  }

  static async getStatus(
    realm: "user" | "client",
    tenantId: string,
    subjectId: string
  ): Promise<string | null> {
    try {
      const redis = getRedisClient();
      return await redis.get(this.makeKey(realm, tenantId, subjectId));
    } catch (err: any) {
      logger.warn({ err: err.message }, "Status cache get failed; falling back to DB");
      return null;
    }
  }

  static async setStatus(
    realm: "user" | "client",
    tenantId: string,
    subjectId: string,
    status: string,
    ttlSeconds = 60
  ): Promise<void> {
    try {
      const redis = getRedisClient();
      await redis.set(this.makeKey(realm, tenantId, subjectId), status, "EX", ttlSeconds);
    } catch (err: any) {
      logger.warn({ err: err.message }, "Status cache set failed");
    }
  }

  static async invalidate(
    realm: "user" | "client",
    tenantId: string,
    subjectId: string
  ): Promise<void> {
    try {
      const redis = getRedisClient();
      await redis.del(this.makeKey(realm, tenantId, subjectId));
    } catch (err: any) {
      logger.warn({ err: err.message }, "Status cache invalidate failed");
    }
  }
}

