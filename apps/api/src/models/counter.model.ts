import mongoose, { Schema, Document, ClientSession } from "mongoose";

export interface ICounterDocument extends Document {
  tenantId: string;
  entity: string;
  seq: number;
  createdAt: Date;
  updatedAt: Date;
}

const CounterSchema = new Schema<ICounterDocument>(
  {
    tenantId: { type: String, required: true },
    entity: { type: String, required: true },
    seq: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
);

CounterSchema.index({ tenantId: 1, entity: 1 }, { unique: true });

export const CounterModel = mongoose.model<ICounterDocument>("Counter", CounterSchema);

/**
 * Atomically increments and returns the next sequence number for a given tenant and entity.
 */
export async function getNextSequence(
  tenantId: string,
  entity: string,
  session?: ClientSession | null
): Promise<number> {
  const result = await CounterModel.findOneAndUpdate(
    { tenantId, entity },
    { $inc: { seq: 1 } },
    {
      new: true,
      upsert: true,
      session: session || null,
      setDefaultsOnInsert: true,
    }
  );
  return result.seq;
}

/**
 * Returns formatted sequential document number (e.g. "ENQ-00001", "QT-00001", "PO-00001").
 */
export async function getNextDocumentNumber(
  tenantId: string,
  entity: string,
  prefix: string,
  digits: number = 5,
  session?: ClientSession | null
): Promise<string> {
  const seq = await getNextSequence(tenantId, entity, session);
  return `${prefix}-${String(seq).padStart(digits, "0")}`;
}

