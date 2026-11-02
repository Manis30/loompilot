import mongoose, { Schema, Types } from "mongoose";
import { BaseEntity } from "../../interfaces/base-repository.interface.js";
import { paiseField } from "../common/paise-schema.js";

export interface IConversationMessage {
  senderType: "client" | "assistant" | "admin";
  text: string;
  guardrail?: {
    passed: boolean;
    issues?: string[];
  };
  visibility?: "client_visible" | "admin_note";
  figuresChecked?: Array<{
    field: string;
    value?: any;
    ok: boolean;
  }>;
  readAt?: Date;
  createdAt: Date;
  agentRunId?: Types.ObjectId;
}

export interface IConversationEscalation {
  type: "discount" | "extra_demand" | "unsure" | "complaint";
  summary: string;
  resolution?: {
    by: Types.ObjectId;
    at: Date;
    outcome: string;
    notes?: string;
  };
  currentPricePaise?: number;
  status: "open" | "in_progress" | "resolved";
  assignedTo?: Types.ObjectId;
}

export interface IConversation extends BaseEntity {
  orderId: Types.ObjectId;
  clientId: Types.ObjectId;
  status: "agent_handling" | "escalated" | "admin_handling" | "resolved";
  assignedAdminId?: Types.ObjectId;
  lastMessageAt?: Date;
  messages?: IConversationMessage[];
  escalation?: IConversationEscalation;
  escalationHistory?: any[];
}

const ConversationMessageSchema = new Schema<IConversationMessage>(
  {
    senderType: {
      type: String,
      enum: ["client", "assistant", "admin"],
      required: true,
    },
    text: { type: String, required: true },
    guardrail: {
      type: new Schema(
        {
          passed: { type: Boolean, required: true },
          issues: [{ type: String }],
        },
        { _id: false, strict: true }
      ),
    },
    visibility: {
      type: String,
      enum: ["client_visible", "admin_note"],
      default: "client_visible",
    },
    figuresChecked: [
      {
        _id: false,
        field: { type: String, required: true },
        value: { type: Schema.Types.Mixed },
        ok: { type: Boolean, required: true },
      },
    ],
    readAt: { type: Date },
    createdAt: { type: Date, required: true, default: Date.now },
    agentRunId: { type: Schema.Types.ObjectId, ref: "AgentRun" },
  },
  { _id: false, strict: true }
);

const ConversationEscalationSchema = new Schema<IConversationEscalation>(
  {
    type: {
      type: String,
      enum: ["discount", "extra_demand", "unsure", "complaint"],
      required: true,
    },
    summary: { type: String, required: true },
    resolution: {
      type: new Schema(
        {
          by: { type: Schema.Types.ObjectId, ref: "User", required: true },
          at: { type: Date, required: true },
          outcome: { type: String, required: true },
          notes: { type: String },
        },
        { _id: false, strict: true }
      ),
    },
    currentPricePaise: paiseField(),
    status: {
      type: String,
      enum: ["open", "in_progress", "resolved"],
      default: "open",
      required: true,
    },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { _id: false, strict: true }
);

const ConversationSchema = new Schema<IConversation>(
  {
    tenantId: { type: String, required: true, index: true },
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    clientId: { type: Schema.Types.ObjectId, ref: "Client", required: true },
    status: {
      type: String,
      enum: ["agent_handling", "escalated", "admin_handling", "resolved"],
      default: "agent_handling",
      required: true,
    },
    assignedAdminId: { type: Schema.Types.ObjectId, ref: "User" },
    lastMessageAt: { type: Date },
    messages: { type: [ConversationMessageSchema] },
    escalation: { type: ConversationEscalationSchema },
    escalationHistory: [{ type: Schema.Types.Mixed }],
    version: { type: Number, default: 1 },
  },
  { timestamps: true }
);

ConversationSchema.index({ tenantId: 1, orderId: 1 }, { unique: true });

export const ConversationModel: mongoose.Model<IConversation> =
  (mongoose.models.Conversation as mongoose.Model<IConversation>) ||
  mongoose.model<IConversation>("Conversation", ConversationSchema, "conversations");
