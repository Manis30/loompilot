import mongoose, { Schema, Types } from "mongoose";
import { BaseEntity } from "../../interfaces/base-repository.interface.js";
import { paiseField } from "../common/paise-schema.js";

export interface IAgentRunRef {
  collectionName: string;
  id: string;
}

export interface IAgentRunDecision {
  outcome: string;
  summary: string;
}

export interface IAgentRun extends BaseEntity {
  agent: "feasibility" | "quotation" | "market" | "chat" | "monitoring";
  trigger: string;
  orderId?: Types.ObjectId;
  clientId?: Types.ObjectId;
  materialId?: Types.ObjectId;
  status: "running" | "ok" | "failed";
  startedAt: Date;
  finishedAt?: Date;
  durationMs?: number;
  retryOfRunId?: Types.ObjectId;
  error?: string;
  inputRef?: IAgentRunRef;
  outputRef?: IAgentRunRef;
  decision?: IAgentRunDecision;
  guardrails?: any;
  promptVersion?: string;
  model?: string;
  tokensIn?: number;
  tokensOut?: number;
  costPaise?: number;
  requestId?: string;
  schemaVersion?: number;
}

const AgentRunSchema = new Schema<IAgentRun>(
  {
    tenantId: { type: String, required: true, index: true },
    agent: {
      type: String,
      enum: ["feasibility", "quotation", "market", "chat", "monitoring"],
      required: true,
    },
    trigger: { type: String, required: true },
    orderId: { type: Schema.Types.ObjectId, ref: "Order" },
    clientId: { type: Schema.Types.ObjectId, ref: "Client" },
    materialId: { type: Schema.Types.ObjectId, ref: "Material" },
    status: {
      type: String,
      enum: ["running", "ok", "failed"],
      default: "running",
      required: true,
    },
    startedAt: { type: Date, default: Date.now },
    finishedAt: { type: Date },
    durationMs: { type: Number },
    retryOfRunId: { type: Schema.Types.ObjectId, ref: "AgentRun" },
    error: { type: String },
    inputRef: {
      collectionName: { type: String },
      id: { type: String },
    },
    outputRef: {
      collectionName: { type: String },
      id: { type: String },
    },
    decision: {
      outcome: { type: String },
      summary: { type: String },
    },
    guardrails: { type: Schema.Types.Mixed },
    promptVersion: { type: String },
    model: { type: String },
    tokensIn: { type: Number },
    tokensOut: { type: Number },
    costPaise: paiseField(),
    requestId: { type: String },
    schemaVersion: { type: Number, default: 3 },
    version: { type: Number, default: 1 },
  },
  { timestamps: true }
);

AgentRunSchema.index({ tenantId: 1, agent: 1, status: 1 });
AgentRunSchema.index({ tenantId: 1, orderId: 1 });

export const AgentRunModel =
  mongoose.models.AgentRun || mongoose.model<IAgentRun>("AgentRun", AgentRunSchema);
