import mongoose, { Schema, Document } from "mongoose";

export interface IEnquiry extends Document {
  tenantId: string;
  enquiryNumber: string;
  customerId: string;
  customerName: string;
  rawText: string;
  parsedRequirements?: {
    productName: string;
    quantity: number;
    unit: string;
    targetDeliveryDate?: string;
    specialInstructions?: string;
  };
  status: "new" | "processing" | "quoted" | "closed";
  createdAt: Date;
  updatedAt: Date;
}

const EnquirySchema = new Schema<IEnquiry>(
  {
    tenantId: { type: String, required: true, index: true },
    enquiryNumber: { type: String, required: true },
    customerId: { type: String, required: true, index: true },
    customerName: { type: String, required: true },
    rawText: { type: String, required: true },
    parsedRequirements: {
      productName: { type: String },
      quantity: { type: Number },
      unit: { type: String },
      targetDeliveryDate: { type: String },
      specialInstructions: { type: String },
    },
    status: {
      type: String,
      enum: ["new", "processing", "quoted", "closed"],
      default: "new",
    },
  },
  { timestamps: true }
);

EnquirySchema.index({ tenantId: 1, enquiryNumber: 1 }, { unique: true });

export const EnquiryModel = mongoose.model<IEnquiry>("Enquiry", EnquirySchema);
