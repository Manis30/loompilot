import mongoose, { Schema, Types } from "mongoose";
import { BaseEntity } from "../../interfaces/base-repository.interface.js";

export interface IClientInteractionRefCollection {
  collectionName: string;
  id: string;
}

export interface IClientInteractionAgentDecision {
  agent: string;
  outcome: string;
  reason: string;
}

export interface IClientInteraction extends BaseEntity {
  orderId?: Types.ObjectId;
  clientId: Types.ObjectId;
  actorType: "client" | "agent" | "admin" | "system";
  type: string;
  channel: "web" | "email" | "whatsapp" | "sms" | string;
  refCollection?: IClientInteractionRefCollection;
  summary: string;
  agentDecision?: IClientInteractionAgentDecision;
  agentRunId?: Types.ObjectId;
  occurredAt: Date;
}

const ClientInteractionSchema = new Schema<IClientInteraction>(
  {
    tenantId: { type: String, required: true, index: true },
    orderId: { type: Schema.Types.ObjectId, ref: "Order" },
    clientId: { type: Schema.Types.ObjectId, required: true, ref: "Client" },
    actorType: {
      type: String,
      enum: ["client", "agent", "admin", "system"],
      required: true,
    },
    type: { type: String, required: true },
    channel: {
      type: String,
      enum: ["web", "email", "whatsapp", "sms"],
      required: true,
    },
    refCollection: {
      collectionName: { type: String },
      id: { type: String },
    },
    summary: { type: String, required: true },
    agentDecision: {
      agent: { type: String },
      outcome: { type: String },
      reason: { type: String },
    },
    agentRunId: { type: Schema.Types.ObjectId, ref: "AgentRun" },
    occurredAt: { type: Date, default: Date.now },
    version: { type: Number, default: 1 },
  },
  { timestamps: true }
);

ClientInteractionSchema.index({ tenantId: 1, clientId: 1, occurredAt: -1 });

export const ClientInteractionModel =
  mongoose.models.ClientInteraction ||
  mongoose.model<IClientInteraction>("ClientInteraction", ClientInteractionSchema);
