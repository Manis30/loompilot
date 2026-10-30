import mongoose, { Schema, Types } from "mongoose";
import { BaseEntity } from "../../interfaces/base-repository.interface.js";

export interface IBomItem {
  materialId: Types.ObjectId;
  qtyPerUnit: number;
  wastage: number;
}

export interface IRoutingStep {
  stage: string;
  seq: number;
  stdMinPerUnit: number;
}

export interface IProduct extends BaseEntity {
  productName: string;
  category: string;
  routing: IRoutingStep[];
  bom: IBomItem[];
  active: boolean;
}

const ProductSchema = new Schema<IProduct>(
  {
    tenantId: { type: String, required: true, index: true },
    productName: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    routing: [
      {
        _id: false,
        stage: { type: String, required: true },
        seq: { type: Number, required: true },
        stdMinPerUnit: { type: Number, required: true },
      },
    ],
    bom: [
      {
        _id: false,
        materialId: { type: Schema.Types.ObjectId, required: true, ref: "Material" },
        qtyPerUnit: { type: Number, required: true },
        wastage: { type: Number, default: 0 },
      },
    ],
    active: { type: Boolean, default: true },
    version: { type: Number, default: 1 },
  },
  { timestamps: true }
);

ProductSchema.index({ tenantId: 1, productName: 1 }, { unique: true });

export const ProductModel =
  mongoose.models.Product || mongoose.model<IProduct>("Product", ProductSchema);
