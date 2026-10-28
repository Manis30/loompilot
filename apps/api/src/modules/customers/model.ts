import mongoose, { Schema, Document } from "mongoose";

export interface ICustomer extends Document {
  tenantId: string;
  name: string;
  code: string;
  contactPerson: string;
  email: string;
  phone: string;
  address?: string;
  creditPeriodDays: number;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerSchema = new Schema<ICustomer>(
  {
    tenantId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    code: { type: String, required: true },
    contactPerson: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: String },
    creditPeriodDays: { type: Number, default: 30 },
  },
  { timestamps: true }
);

CustomerSchema.index({ tenantId: 1, code: 1 }, { unique: true });

export const CustomerModel = mongoose.model<ICustomer>("Customer", CustomerSchema);

