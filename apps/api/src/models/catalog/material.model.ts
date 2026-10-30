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
  type: "yarn" | "fabric" | "dye_chemical" | "trim" | "packing";
  stockQty: number;
  reservedQty: number;
  reorderLevel: number;
  currentRatePaise: number;
  preferredSupplierId?: Types.ObjectId;
  supplierOffers?: ISupplierOffer[];
  unit: string;
  watchlist?: boolean;
}

const SupplierOfferSchema = new Schema<ISupplierOffer>(
  {
    supplierId: { type: Schema.Types.ObjectId, required: true, ref: "Supplier" },
    ratePaise: paiseField({ required: true }),
    leadDays: { type: Number, required: true },
  },
  { _id: false, strict: true }
);

const MaterialSchema = new Schema<IMaterial>(
  {
    tenantId: { type: String, required: true, index: true },
    materialName: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ["yarn", "fabric", "dye_chemical", "trim", "packing"],
      required: true,
    },
    stockQty: { type: Number, default: 0, required: true },
    reservedQty: { type: Number, default: 0, required: true },
    reorderLevel: { type: Number, default: 0, required: true },
    currentRatePaise: paiseField({ required: true }),
    preferredSupplierId: { type: Schema.Types.ObjectId, ref: "Supplier" },
    supplierOffers: { type: [SupplierOfferSchema] },
    unit: { type: String, trim: true },
    watchlist: { type: Boolean },
    version: { type: Number, default: 1 },
  },
  { timestamps: true }
);

MaterialSchema.index({ tenantId: 1, type: 1 });
MaterialSchema.index({ tenantId: 1, materialName: 1 });

export const MaterialModel: mongoose.Model<IMaterial> =
  (mongoose.models.Material as mongoose.Model<IMaterial>) ||
  mongoose.model<IMaterial>("Material", MaterialSchema, "materials");
