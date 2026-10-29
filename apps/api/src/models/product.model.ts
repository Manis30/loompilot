import mongoose, { Schema, Document } from "mongoose";

export interface IProductDocument extends Document {
  tenantId: string;
  code: string;
  name: string;
  description?: string;
  unit: string;
  active: boolean;
  category: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IBomDocument extends Document {
  tenantId: string;
  productId: mongoose.Types.ObjectId;
  version: number;
  effectiveFrom: Date;
  effectiveTo?: Date | null;
  items: Array<{
    materialId: mongoose.Types.ObjectId;
    quantityPerUnit: number;
    unit: string;
    wastageAllowancePct: number;
  }>;
  createdAt: Date;
}

const ProductSchema = new Schema<IProductDocument>(
  {
    tenantId: { type: String, required: true, index: true },
    code: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String },
    unit: { type: String, required: true },
    active: { type: Boolean, default: true, index: true },
    category: { type: String, required: true, index: true },
  },
  { timestamps: true }
);

ProductSchema.index({ tenantId: 1, code: 1 }, { unique: true });

const BomItemSchema = new Schema(
  {
    materialId: { type: Schema.Types.ObjectId, ref: "Material", required: true },
    quantityPerUnit: { type: Number, required: true, min: 0 },
    unit: { type: String, required: true },
    wastageAllowancePct: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const BomSchema = new Schema<IBomDocument>(
  {
    tenantId: { type: String, required: true, index: true },
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    version: { type: Number, required: true },
    effectiveFrom: { type: Date, default: Date.now },
    effectiveTo: { type: Date, default: null },
    items: { type: [BomItemSchema], default: [] },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

BomSchema.index({ tenantId: 1, productId: 1, version: -1 });

export const ProductModel = mongoose.model<IProductDocument>("Product", ProductSchema);
export const BomModel = mongoose.model<IBomDocument>("Bom", BomSchema);
