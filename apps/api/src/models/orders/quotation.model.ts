import mongoose, { Schema, Types } from "mongoose";
import { BaseEntity } from "../../interfaces/base-repository.interface.js";
import { QuotationStatus } from "@loompilot/shared";
import { paiseField } from "../common/paise-schema.js";

export interface IQuotationLineItem {
  desc: string;
  qty: number;
  unitPricePaise: number;
}

export interface IQuotationProcessPlan {
  stage: string;
  start: string;
  end: string;
  dailyTarget: number;
}

export interface IQuotationEtaBasis {
  supplierLead: number;
  prodDays: number;
  safetyDays: number;
}

export interface IQuotationGenerationError {
  code: string;
  message: string;
  at: Date;
}

export interface IQuotationInputsSnapshot {
  capacity?: any;
  prices?: any;
  bom?: any;
  formulaVer?: string;
  [key: string]: any;
}

export interface IQuotationClientResponse {
  decision: string;
  reason?: string;
  by?: string;
  quotationVersion?: number;
  at?: Date;
}

export interface IQuotation extends BaseEntity {
  orderId: Types.ObjectId;
  clientId: Types.ObjectId;
  status: QuotationStatus;
  generationError?: IQuotationGenerationError;
  lineItems: IQuotationLineItem[];
  totalPaise: number;
  unitPricePaise: number;
  validUntil: string; // 'YYYY-MM-DD'
  etaDate: string; // 'YYYY-MM-DD'
  processPlan: IQuotationProcessPlan[];
  etaBasis?: IQuotationEtaBasis;
  clientExplanation?: string;
  explanation?: string;
  assumptions?: string;
  termsVersion?: string;
  priceVariationClause?: string;
  lockedMaterials: Types.ObjectId[];
  marginWarning: boolean;
  lowData: boolean;
  inputsSnapshot?: IQuotationInputsSnapshot;
  clientResponse?: IQuotationClientResponse;
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;
  sentAt?: Date;
  clientPdfFileId?: string;
  agentRunId?: Types.ObjectId;
  idempotencyKey?: string;
}

export const QUOTATION_STATUS_ENUM = Object.values(QuotationStatus);

const QuotationSchema = new Schema<IQuotation>(
  {
    tenantId: { type: String, required: true, index: true },
    orderId: { type: Schema.Types.ObjectId, required: true, ref: "Order" },
    clientId: { type: Schema.Types.ObjectId, required: true, ref: "Client" },
    version: { type: Number, default: 1, required: true },
    status: {
      type: String,
      enum: QUOTATION_STATUS_ENUM,
      default: QuotationStatus.PENDING_APPROVAL,
      required: true,
    },
    generationError: {
      code: { type: String },
      message: { type: String },
      at: { type: Date },
    },
    lineItems: [
      {
        _id: false,
        desc: { type: String, required: true },
        qty: { type: Number, required: true },
        unitPricePaise: paiseField({ required: true }),
      },
    ],
    totalPaise: paiseField({ required: true }),
    unitPricePaise: paiseField({ required: true }),
    validUntil: {
      type: String,
      required: true,
      match: [/^\d{4}-\d{2}-\d{2}$/, "Must be 'YYYY-MM-DD' format"],
    },
    etaDate: {
      type: String,
      required: true,
      match: [/^\d{4}-\d{2}-\d{2}$/, "Must be 'YYYY-MM-DD' format"],
    },
    processPlan: [
      {
        _id: false,
        stage: { type: String, required: true },
        start: { type: String, required: true },
        end: { type: String, required: true },
        dailyTarget: { type: Number, required: true },
      },
    ],
    etaBasis: {
      supplierLead: { type: Number },
      prodDays: { type: Number },
      safetyDays: { type: Number },
    },
    clientExplanation: { type: String },
    explanation: { type: String },
    assumptions: { type: String },
    termsVersion: { type: String },
    priceVariationClause: { type: String },
    lockedMaterials: [{ type: Schema.Types.ObjectId, ref: "Material" }],
    marginWarning: { type: Boolean, default: false },
    lowData: { type: Boolean, default: false },
    inputsSnapshot: {
      capacity: { type: Schema.Types.Mixed },
      prices: { type: Schema.Types.Mixed },
      bom: { type: Schema.Types.Mixed },
      formulaVer: { type: String },
    },
    clientResponse: {
      decision: { type: String },
      reason: { type: String },
      by: { type: String },
      quotationVersion: { type: Number },
      at: { type: Date },
    },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },
    sentAt: { type: Date },
    clientPdfFileId: { type: String },
    agentRunId: { type: Schema.Types.ObjectId, ref: "AgentRun" },
    idempotencyKey: { type: String },
  },
  { timestamps: true }
);

QuotationSchema.index({ tenantId: 1, orderId: 1, version: 1 }, { unique: true });
QuotationSchema.index({ tenantId: 1, status: 1 });
QuotationSchema.index({ tenantId: 1, clientId: 1 });

export const QuotationModel =
  mongoose.models.Quotation || mongoose.model<IQuotation>("Quotation", QuotationSchema);
