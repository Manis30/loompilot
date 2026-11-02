import mongoose, { Schema, Types } from "mongoose";
import { BaseEntity } from "../../interfaces/base-repository.interface.js";
import { paiseField } from "../common/paise-schema.js";

export interface IBomItem {
  materialId: Types.ObjectId;
  qtyPerUnit: number;
  wastage?: number;
}

export interface IRoutingStep {
  stage: string;
  seq: number;
  stdMinPerUnit: number;
}

export interface IProduct extends BaseEntity {
  productName: string;
  category: string;
  basePricePaise: number;
  routing: IRoutingStep[];
  bom: IBomItem[];
  imageFileIds?: Types.ObjectId[];
  active?: boolean;
}

const RoutingStepSchema = new Schema<IRoutingStep>(
  {
    stage: { type: String, required: true },
    seq: { type: Number, required: true },
    stdMinPerUnit: { type: Number, required: true },
  },
  { _id: false, strict: true }
);

const BomItemSchema = new Schema<IBomItem>(
  {
    materialId: { type: Schema.Types.ObjectId, required: true, ref: "Material" },
    qtyPerUnit: { type: Number, required: true },
    wastage: { type: Number, default: 0 },
  },
  { _id: false, strict: true }
);

const ProductSchema = new Schema<IProduct>(
  {
    tenantId: { type: String, required: true, index: true },
    productName: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    basePricePaise: paiseField({ required: true }),
    routing: { type: [RoutingStepSchema], required: true },
    bom: { type: [BomItemSchema], required: true },
    imageFileIds: [{ type: Schema.Types.ObjectId, ref: "File" }],
    active: { type: Boolean, default: true },
    version: { type: Number, default: 1 },
  },
  { timestamps: true }
);

ProductSchema.index({ tenantId: 1, productName: 1 });

export const ProductModel: mongoose.Model<IProduct> =
  (mongoose.models.Product as mongoose.Model<IProduct>) ||
  mongoose.model<IProduct>("Product", ProductSchema, "products");
