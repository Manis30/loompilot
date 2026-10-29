import mongoose, { Schema, Document } from "mongoose";

export interface ICustomerDocument extends Document {
  tenantId: string;
  name: string;
  code: string;
  contactPerson: string;
  email: string;
  phone: string;
  address?: string;
  creditPeriodDays: number;
  gstin?: string;
  preferredChannel: "whatsapp" | "email" | "sms";
  notes?: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerSchema = new Schema<ICustomerDocument>(
  {
    tenantId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    code: { type: String, required: true },
    contactPerson: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: String },
    creditPeriodDays: { type: Number, default: 30 },
    gstin: { type: String },
    preferredChannel: {
      type: String,
      enum: ["whatsapp", "email", "sms"],
      default: "whatsapp",
    },
    notes: { type: String },
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

CustomerSchema.index({ tenantId: 1, code: 1 }, { unique: true });

export const CustomerModel = mongoose.model<ICustomerDocument>("Customer", CustomerSchema);
