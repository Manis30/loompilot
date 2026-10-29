import mongoose, { Schema, Document } from "mongoose";

export interface ISupplierDocument extends Document {
  tenantId: string;
  name: string;
  code?: string;
  contactPerson: string;
  email: string;
  phone: string;
  address?: string;
  gstin?: string;
  paymentTermsDays?: number;
  leadTimeDays: number;
  rating: number;
  suppliedMaterials: mongoose.Types.ObjectId[];
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SupplierSchema = new Schema<ISupplierDocument>(
  {
    tenantId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    code: { type: String, sparse: true },
    contactPerson: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: String },
    gstin: { type: String },
    paymentTermsDays: { type: Number, default: 30 },
    leadTimeDays: { type: Number, required: true, default: 7 },
    rating: { type: Number, default: 4.5, min: 1, max: 5 },
    suppliedMaterials: [{ type: Schema.Types.ObjectId, ref: "Material" }],
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

SupplierSchema.index({ tenantId: 1, name: 1 });
SupplierSchema.index({ tenantId: 1, code: 1 });

export const SupplierModel = mongoose.model<ISupplierDocument>("Supplier", SupplierSchema);

