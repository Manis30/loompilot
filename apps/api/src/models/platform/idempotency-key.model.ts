import mongoose, { Schema } from "mongoose";
import { BaseEntity } from "../../interfaces/base-repository.interface.js";

export type IdempotencyState = "in_progress" | "completed";

export interface IIdempotencyKey extends BaseEntity {
  key: string;
  route: string;
  requestHash: string;
  state: IdempotencyState;
  responseStatus?: number;
  responseBody?: any;
  expiresAt: Date;
}

const IdempotencyKeySchema = new Schema<IIdempotencyKey>(
  {
    tenantId: { type: String, required: true, index: true },
    key: { type: String, required: true },
    route: { type: String, required: true },
    requestHash: { type: String, required: true },
    state: {
      type: String,
      enum: ["in_progress", "completed"],
      default: "in_progress",
      required: true,
    },
    responseStatus: { type: Number },
    responseBody: { type: Schema.Types.Mixed },
    expiresAt: { type: Date, required: true },
    version: { type: Number, default: 1 },
  },
  { timestamps: true }
);

IdempotencyKeySchema.index({ tenantId: 1, key: 1, route: 1 }, { unique: true });
IdempotencyKeySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL on expiresAt

export const IdempotencyKeyModel: mongoose.Model<IIdempotencyKey> =
  (mongoose.models.IdempotencyKey as mongoose.Model<IIdempotencyKey>) ||
  mongoose.model<IIdempotencyKey>("IdempotencyKey", IdempotencyKeySchema);
