import mongoose, { Schema, Types } from "mongoose";
import { BaseEntity } from "../../interfaces/base-repository.interface.js";
import { paiseField } from "../common/paise-schema.js";

export interface IAgentError {
  code?: string;
  message?: string;
  details?: any;
}

export interface IAgentRun extends BaseEntity {
  agent:
    | "feasibility"
    | "quotation"
    | "market"
    | "chat"
    | "monitoring"
    | "admin_assistant";
  trigger: string;
  orderId?: Types.ObjectId;
  status: string;
  timings?: any;
  decision?: any;
  guardrails?: any;
  model?: string;
  tokens?: any;
  costPaise?: number;
  requestId?: string;
  promptVersion?: string;
  schemaVersion?: string;
  retryOfRunId?: Types.ObjectId;
  error?: IAgentError;
  outputSnapshot?: string;
}

const AgentErrorSchema = new Schema<IAgentError>(
  {
    code: { type: String },
    message: { type: String },
    details: { type: Schema.Types.Mixed },
  },
  { _id: false, strict: true }
);

const AgentRunSchema = new Schema<IAgentRun>(
  {
    tenantId: { type: String, required: true, index: true },
    agent: {
      type: String,
      enum: ["feasibility", "quotation", "market", "chat", "monitoring", "admin_assistant"],
      required: true,
    },
    trigger: { type: String, required: true },
    orderId: { type: Schema.Types.ObjectId, ref: "Order" },
    status: { type: String, required: true },
    timings: { type: Schema.Types.Mixed },
    decision: { type: Schema.Types.Mixed },
    guardrails: { type: Schema.Types.Mixed },
    model: { type: String },
    tokens: { type: Schema.Types.Mixed },
    costPaise: paiseField({ default: 0 }),
    requestId: { type: String },
    promptVersion: { type: String },
    schemaVersion: { type: String },
    retryOfRunId: { type: Schema.Types.ObjectId, ref: "AgentRun" },
    error: { type: AgentErrorSchema },
    outputSnapshot: {
      type: String,
      validate: {
        validator: function (val: string) {
          if (!val) return true;
          return Buffer.byteLength(val, "utf8") <= 65536;
        },
        message: "outputSnapshot exceeds maximum size of 64KB (CAP_EXCEEDED)",
      },
    },
    version: { type: Number, default: 1 },
  },
  { timestamps: true }
);

AgentRunSchema.index({ tenantId: 1, agent: 1, createdAt: 1 });
AgentRunSchema.index({ tenantId: 1, orderId: 1, createdAt: 1 });

export const AgentRunModel: mongoose.Model<IAgentRun> =
  (mongoose.models.AgentRun as mongoose.Model<IAgentRun>) ||
  mongoose.model<IAgentRun>("AgentRun", AgentRunSchema, "agentRuns");
