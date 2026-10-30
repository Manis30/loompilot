import mongoose, { Schema, Types } from "mongoose";
import { BaseEntity } from "../../interfaces/base-repository.interface.js";
import { paiseField } from "../common/paise-schema.js";

export interface IQuotationRevisionClientDecision {
  decision: string;
  by?: string;
  quotationVersion?: number;
  at?: Date;
}

export interface IQuotationRevisionInputsSnapshot {
  prices?: any;
  affectedMaterials?: any;
  [key: string]: any;
}

export interface IQuotationRevision extends BaseEntity {
  quotationId: Types.ObjectId;
  orderId: Types.ObjectId;
  priceAlertId?: Types.ObjectId;
  reasonType: "price_surge" | "admin_edit" | "discount" | "date_change";
  oldPricePaise: number;
  newPricePaise: number;
  changePct: number;
  newEtaDate?: string;
  clientReason?: string;
  clientDrivers: string[];
  lockedMaterials: Types.ObjectId[];
  inputsSnapshot?: IQuotationRevisionInputsSnapshot;
  status: "proposed" | "approved" | "sent" | "accepted" | "declined" | "superseded";
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;
  sentAt?: Date;
  clientDecision?: IQuotationRevisionClientDecision;
  agentRunId?: Types.ObjectId;
}

const QuotationRevisionSchema = new Schema<IQuotationRevision>(
  {
    tenantId: { type: String, required: true, index: true },
    quotationId: { type: Schema.Types.ObjectId, required: true, ref: "Quotation" },
    orderId: { type: Schema.Types.ObjectId, required: true, ref: "Order" },
    priceAlertId: { type: Schema.Types.ObjectId, ref: "PriceAlert" },
    reasonType: {
      type: String,
      enum: ["price_surge", "admin_edit", "discount", "date_change"],
      required: true,
    },
    oldPricePaise: paiseField({ required: true }),
    newPricePaise: paiseField({ required: true }),
    changePct: { type: Number, required: true },
    newEtaDate: { type: String },
    clientReason: { type: String },
    clientDrivers: [{ type: String }],
    lockedMaterials: [{ type: Schema.Types.ObjectId, ref: "Material" }],
    inputsSnapshot: {
      prices: { type: Schema.Types.Mixed },
      affectedMaterials: { type: Schema.Types.Mixed },
    },
    status: {
      type: String,
      enum: ["proposed", "approved", "sent", "accepted", "declined", "superseded"],
      default: "proposed",
      required: true,
    },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },
    sentAt: { type: Date },
    clientDecision: {
      decision: { type: String },
      by: { type: String },
      quotationVersion: { type: Number },
      at: { type: Date },
    },
    agentRunId: { type: Schema.Types.ObjectId, ref: "AgentRun" },
    version: { type: Number, default: 1 },
  },
  { timestamps: true }
);

QuotationRevisionSchema.index({ tenantId: 1, quotationId: 1 });
QuotationRevisionSchema.index({ tenantId: 1, orderId: 1 });

export const QuotationRevisionModel =
  mongoose.models.QuotationRevision ||
  mongoose.model<IQuotationRevision>("QuotationRevision", QuotationRevisionSchema);
