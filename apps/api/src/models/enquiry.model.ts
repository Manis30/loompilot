import mongoose, { Schema, Document } from "mongoose";

export interface IEnquirySpecs {
  width?: string;
  gsm?: number;
  weaveType?: string;
  colorOrPantone?: string;
  finishRequirements?: string;
  packaging?: string;
}

export interface IEnquiryDocument extends Document {
  tenantId: string;
  enquiryNumber: string;
  customerId: string;
  customerName: string;
  rawText: string;
  specs?: IEnquirySpecs;
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

const EnquirySchema = new Schema<IEnquiryDocument>(
  {
    tenantId: { type: String, required: true, index: true },
    enquiryNumber: { type: String, required: true },
    customerId: { type: String, required: true, index: true },
    customerName: { type: String, required: true },
    rawText: { type: String, required: true },
    specs: {
      width: { type: String },
      gsm: { type: Number },
      weaveType: { type: String },
      colorOrPantone: { type: String },
      finishRequirements: { type: String },
      packaging: { type: String },
    },
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

export const EnquiryModel = mongoose.model<IEnquiryDocument>("Enquiry", EnquirySchema);
