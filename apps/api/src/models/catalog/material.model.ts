import mongoose, { Schema, Types } from "mongoose";
import { BaseEntity } from "../../interfaces/base-repository.interface.js";
import { paiseField } from "../common/paise-schema.js";

export interface ISupplierOffer {
  supplierId: Types.ObjectId;
  ratePaise: number;
  leadDays: number;
}

export interface IMaterial extends BaseEntity {
  materialName: string;
  type: string;
  unit: string;
  stockQty: number;
  reservedQty: number;
  reorderLevel: number;
  currentRatePaise: number;
  watchlist: boolean;
  preferredSupplierId?: Types.ObjectId;
  supplierOffers: ISupplierOffer[];
}

const MaterialSchema = new Schema<IMaterial>(
  {
    tenantId: { type: String, required: true, index: true },
    materialName: { type: String, required: true, trim: true },
    type: { type: String, required: true, trim: true },
    unit: { type: String, required: true, trim: true },
    stockQty: { type: Number, default: 0 },
    reservedQty: { type: Number, default: 0 },
    reorderLevel: { type: Number, default: 0 },
    currentRatePaise: paiseField({ default: 0 }),
    watchlist: { type: Boolean, default: false },
    preferredSupplierId: { type: Schema.Types.ObjectId, ref: "Supplier" },
    supplierOffers: [
      {
        _id: false,
        supplierId: { type: Schema.Types.ObjectId, required: true, ref: "Supplier" },
        ratePaise: paiseField({ required: true }),
        leadDays: { type: Number, required: true },
      },
    ],
    version: { type: Number, default: 1 },
  },
  { timestamps: true }
);

MaterialSchema.index({ tenantId: 1, materialName: 1 }, { unique: true });
MaterialSchema.index({ tenantId: 1, watchlist: 1 });

export const MaterialModel =
  mongoose.models.Material || mongoose.model<IMaterial>("Material", MaterialSchema);
