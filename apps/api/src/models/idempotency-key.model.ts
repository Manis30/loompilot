import mongoose, { Schema, Document } from "mongoose";

export interface IIdempotencyKeyDocument extends Document {
  tenantId: string;
  key: string;
  endpoint: string;
  requestHash: string;
  statusCode: number;
  responseBody: any;
  createdAt: Date;
  expiresAt: Date;
}

const IdempotencyKeySchema = new Schema<IIdempotencyKeyDocument>(
  {
    tenantId: { type: String, required: true },
    key: { type: String, required: true },
    endpoint: { type: String, required: true },
    requestHash: { type: String, required: true },
    statusCode: { type: Number, required: true },
    responseBody: { type: Schema.Types.Mixed, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// Compound unique constraint per tenant
IdempotencyKeySchema.index({ tenantId: 1, key: 1 }, { unique: true });

// 24-hour TTL expiration index
IdempotencyKeySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const IdempotencyKeyModel = mongoose.model<IIdempotencyKeyDocument>(
  "IdempotencyKey",
  IdempotencyKeySchema
);

