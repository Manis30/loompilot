import mongoose, { Schema, Types } from "mongoose";
import { BaseEntity } from "../../interfaces/base-repository.interface.js";
import { paiseField } from "../common/paise-schema.js";

export interface IPriceObservation extends BaseEntity {
  materialId: Types.ObjectId;
  observationDate: string; // 'YYYY-MM-DD'
  unitPricePaise: number;
  sourceId: Types.ObjectId;
  verificationStatus: "verified" | "pending" | "rejected";
}

const PriceObservationSchema = new Schema<IPriceObservation>(
  {
    tenantId: { type: String, required: true, index: true },
    materialId: { type: Schema.Types.ObjectId, required: true, ref: "Material" },
    observationDate: {
      type: String,
      required: true,
      match: [/^\d{4}-\d{2}-\d{2}$/, "Must be 'YYYY-MM-DD' format"],
    },
    unitPricePaise: paiseField({ required: true }),
    sourceId: { type: Schema.Types.ObjectId, required: true, ref: "MarketSource" },
    verificationStatus: {
      type: String,
      enum: ["verified", "pending", "rejected"],
      default: "pending",
      required: true,
    },
    version: { type: Number, default: 1 },
  },
  { timestamps: true }
);

PriceObservationSchema.index(
  { tenantId: 1, materialId: 1, observationDate: 1, sourceId: 1 },
  { unique: true }
);

export const PriceObservationModel =
  mongoose.models.PriceObservation ||
  mongoose.model<IPriceObservation>("PriceObservation", PriceObservationSchema);
