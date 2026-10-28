import mongoose, { Schema, Document } from "mongoose";
import { QuotationStatus } from "@loompilot/shared";

export interface IQuotationLineItem {
  materialId: mongoose.Types.ObjectId;
  materialName: string;
  requiredQty: number;
  unit: string;
  onHandQty: number;
  reservedQty: number;
  toPurchaseQty: number;
  unitCostPaise: number;
  totalCostPaise: number;
  supplierLeadDays: number;
}

export interface IQuotation extends Document {
  tenantId: string;
  enquiryId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  quotationNumber: string;
  lineItems: IQuotationLineItem[];
  materialCostPaise: number;
  processingCostPaise: number;
  overheadCostPaise: number;
  wastagePct: number;
  wastageCostPaise: number;
  riskBufferPct: number;
  riskBufferCostPaise: number;
  subtotalCostPaise: number;
  marginPct: number;
  profitPaise: number;
  finalPricePaise: number;
  etaDate: string;
  validUntil: string;
  status: QuotationStatus;
  explanation: string;
  assumptions: string[];
  inputsSnapshot: Record<string, any>;
  generationError?: string;
  approvedBy?: mongoose.Types.ObjectId;
  approvedAt?: Date;
  sentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const QuotationLineItemSchema = new Schema<IQuotationLineItem>(
  {
    materialId: { type: Schema.Types.ObjectId, ref: "Material", required: true },
    materialName: { type: String, required: true },
    requiredQty: { type: Number, required: true },
    unit: { type: String, required: true },
    onHandQty: { type: Number, required: true },
    reservedQty: { type: Number, required: true },
    toPurchaseQty: { type: Number, required: true },
    unitCostPaise: { type: Number, required: true },
    totalCostPaise: { type: Number, required: true },
    supplierLeadDays: { type: Number, required: true },
  },
  { _id: false }
);

const QuotationSchema = new Schema<IQuotation>(
  {
    tenantId: { type: String, required: true, index: true },
    enquiryId: { type: Schema.Types.ObjectId, ref: "Enquiry", required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    quotationNumber: { type: String, required: true },
    lineItems: [QuotationLineItemSchema],
    materialCostPaise: { type: Number, required: true, default: 0 },
    processingCostPaise: { type: Number, required: true, default: 0 },
    overheadCostPaise: { type: Number, required: true, default: 0 },
    wastagePct: { type: Number, required: true, default: 2.5 },
    wastageCostPaise: { type: Number, required: true, default: 0 },
    riskBufferPct: { type: Number, required: true, default: 5.0 },
    riskBufferCostPaise: { type: Number, required: true, default: 0 },
    subtotalCostPaise: { type: Number, required: true, default: 0 },
    marginPct: { type: Number, required: true, default: 15.0 },
    profitPaise: { type: Number, required: true, default: 0 },
    finalPricePaise: { type: Number, required: true, default: 0 },
    etaDate: { type: String, required: true },
    validUntil: { type: String, required: true },
    status: {
      type: String,
      enum: Object.values(QuotationStatus),
      default: QuotationStatus.DRAFT,
      required: true,
      index: true,
    },
    explanation: { type: String, default: "" },
    assumptions: [{ type: String }],
    inputsSnapshot: { type: Schema.Types.Mixed, default: {} },
    generationError: { type: String },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },
    sentAt: { type: Date },
  },
  { timestamps: true }
);

QuotationSchema.index({ tenantId: 1, quotationNumber: 1 }, { unique: true });

export const QuotationModel = mongoose.model<IQuotation>("Quotation", QuotationSchema);
