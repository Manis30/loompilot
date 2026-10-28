import mongoose, { Schema, Document } from "mongoose";

export interface ISupplier extends Document {
  tenantId: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  leadTimeDays: number;
  rating: number;
  suppliedMaterials: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const SupplierSchema = new Schema<ISupplier>(
  {
    tenantId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    contactPerson: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    leadTimeDays: { type: Number, required: true, default: 7 },
    rating: { type: Number, default: 4.5, min: 1, max: 5 },
    suppliedMaterials: [{ type: Schema.Types.ObjectId, ref: "Material" }],
  },
  { timestamps: true }
);

SupplierSchema.index({ tenantId: 1, name: 1 });

export const SupplierModel = mongoose.model<ISupplier>("Supplier", SupplierSchema);
