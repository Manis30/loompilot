import mongoose, { Schema } from "mongoose";
import { BaseEntity } from "../../interfaces/base-repository.interface.js";

export interface IClient extends BaseEntity {
  clientName: string;
  contactPerson: string;
  email: string;
  phone: string;
  city: string;
  country: string;
  address: string;
  customerType?: string;
  status: "active" | "inactive";
  paymentTermsDays: number;
}

const ClientSchema = new Schema<IClient>(
  {
    tenantId: { type: String, required: true, index: true },
    clientName: { type: String, required: true, trim: true },
    contactPerson: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    country: { type: String, required: true, trim: true },
    address: { type: String, required: true },
    customerType: { type: String },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
      required: true,
    },
    paymentTermsDays: { type: Number, default: 30 },
    version: { type: Number, default: 1 },
  },
  { timestamps: true }
);

ClientSchema.index({ tenantId: 1, clientName: 1 }, { unique: true });

export const ClientModel = mongoose.models.Client || mongoose.model<IClient>("Client", ClientSchema);
