import mongoose, { Schema } from "mongoose";
import { BaseEntity } from "../../interfaces/base-repository.interface.js";

export interface ISupplier extends BaseEntity {
  supplierName: string;
  contactPerson?: string;
  email: string;
  phone: string;
  city: string;
  country?: string;
  defaultLeadTimeDays?: number;
  status: "active" | "inactive";
}

const SupplierSchema = new Schema<ISupplier>(
  {
    tenantId: { type: String, required: true, index: true },
    supplierName: { type: String, required: true, trim: true },
    contactPerson: { type: String, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    country: { type: String, trim: true },
    defaultLeadTimeDays: { type: Number },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
      required: true,
    },
    version: { type: Number, default: 1 },
  },
  { timestamps: true }
);

SupplierSchema.index({ tenantId: 1, supplierName: 1 });

export const SupplierModel: mongoose.Model<ISupplier> =
  (mongoose.models.Supplier as mongoose.Model<ISupplier>) ||
  mongoose.model<ISupplier>("Supplier", SupplierSchema, "suppliers");
