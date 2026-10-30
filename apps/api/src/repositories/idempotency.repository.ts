import {
  IIdempotencyKey,
  IdempotencyKeyModel,
} from "../models/platform/idempotency-key.model.js";

export class IdempotencyRepository {
  private readonly model = IdempotencyKeyModel;

  /**
   * Attempts to atomically claim an idempotency key.
   * If the key already exists (E11000 duplicate key error on tenantId+key+route),
   * returns the existing record.
   */
  async claimKey(params: {
    tenantId: string;
    key: string;
    route: string;
    requestHash: string;
    ttlSeconds?: number;
  }): Promise<{ claimed: boolean; existingRecord?: IIdempotencyKey }> {
    const ttlSeconds = params.ttlSeconds ?? 86400; // 24 hours default
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    try {
      await this.model.create({
        tenantId: params.tenantId,
        key: params.key,
        route: params.route,
        requestHash: params.requestHash,
        state: "in_progress",
        expiresAt,
      });
      return { claimed: true };
    } catch (err: any) {
      if (err.code === 11000) {
        // Fetch the conflicting record
        const existing = await this.model.findOne({
          tenantId: params.tenantId,
          key: params.key,
          route: params.route,
        });
        return { claimed: false, existingRecord: existing || undefined };
      }
      throw err;
    }
  }

  /**
   * Updates an in-progress idempotency key to completed with stored response status and body.
   */
  async completeKey(params: {
    tenantId: string;
    key: string;
    route: string;
    responseStatus: number;
    responseBody: any;
  }): Promise<void> {
    await this.model.updateOne(
      {
        tenantId: params.tenantId,
        key: params.key,
        route: params.route,
      },
      {
        $set: {
          state: "completed",
          responseStatus: params.responseStatus,
          responseBody: params.responseBody,
        },
      }
    );
  }

  /**
   * Releases an idempotency key upon unhandled 5xx error so the client can retry.
   */
  async releaseKey(params: {
    tenantId: string;
    key: string;
    route: string;
  }): Promise<void> {
    await this.model.deleteOne({
      tenantId: params.tenantId,
      key: params.key,
      route: params.route,
    });
  }
}

