import mongoose, { Schema, Types } from "mongoose";
import { BaseEntity } from "../../interfaces/base-repository.interface.js";
import { paiseField } from "../common/paise-schema.js";

export interface IEscalationResolution {
  by?: Types.ObjectId;
  at?: Date;
  outcome?: string;
  notes?: string;
}

export interface IEscalation extends BaseEntity {
  conversationId: Types.ObjectId;
  orderId?: Types.ObjectId;
  clientId: Types.ObjectId;
  type: "discount" | "extra_demand" | "unsure" | "complaint" | string;
  visibility: "admin_only";
  summary: string;
  currentPricePaise?: number;
  status: "open" | "in_progress" | "resolved";
  assignedTo?: Types.ObjectId;
  resolution?: IEscalationResolution;
  linkedRevisionId?: Types.ObjectId;
}

const EscalationSchema = new Schema<IEscalation>(
  {
    tenantId: { type: String, required: true, index: true },
    conversationId: { type: Schema.Types.ObjectId, required: true, ref: "Conversation" },
    orderId: { type: Schema.Types.ObjectId, ref: "Order" },
    clientId: { type: Schema.Types.ObjectId, required: true, ref: "Client" },
    type: {
      type: String,
      enum: ["discount", "extra_demand", "unsure", "complaint"],
      required: true,
    },
    visibility: {
      type: String,
      enum: ["admin_only"],
      default: "admin_only",
      required: true,
    },
    summary: { type: String, required: true },
    currentPricePaise: paiseField(),
    status: {
      type: String,
      enum: ["open", "in_progress", "resolved"],
      default: "open",
      required: true,
    },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User" },
    resolution: {
      by: { type: Schema.Types.ObjectId, ref: "User" },
      at: { type: Date },
      outcome: { type: String },
      notes: { type: String },
    },
    linkedRevisionId: { type: Schema.Types.ObjectId, ref: "QuotationRevision" },
    version: { type: Number, default: 1 },
  },
  { timestamps: true }
);

EscalationSchema.index({ tenantId: 1, status: 1 });
EscalationSchema.index({ tenantId: 1, conversationId: 1 });

export const EscalationModel =
  mongoose.models.Escalation || mongoose.model<IEscalation>("Escalation", EscalationSchema);
