import mongoose, { Schema, Types } from "mongoose";
import { BaseEntity } from "../../interfaces/base-repository.interface.js";

export interface IMessageFigureCheck {
  field: string;
  value: number;
  ok: boolean;
}

export interface IMessageGuardrail {
  passed: boolean;
  issues: string[];
}

export interface IMessage extends BaseEntity {
  conversationId: Types.ObjectId;
  orderId?: Types.ObjectId;
  clientId: Types.ObjectId;
  senderType: "client" | "assistant" | "admin";
  visibility: "client_visible" | "admin_note";
  text: string;
  figuresChecked: IMessageFigureCheck[];
  guardrail?: IMessageGuardrail;
  readAt?: Date;
  agentRunId?: Types.ObjectId;
}

const MessageSchema = new Schema<IMessage>(
  {
    tenantId: { type: String, required: true, index: true },
    conversationId: { type: Schema.Types.ObjectId, required: true, ref: "Conversation" },
    orderId: { type: Schema.Types.ObjectId, ref: "Order" },
    clientId: { type: Schema.Types.ObjectId, required: true, ref: "Client" },
    senderType: {
      type: String,
      enum: ["client", "assistant", "admin"],
      required: true,
    },
    visibility: {
      type: String,
      enum: ["client_visible", "admin_note"],
      default: "client_visible",
      required: true,
    },
    text: { type: String, required: true },
    figuresChecked: [
      {
        _id: false,
        field: { type: String, required: true },
        value: { type: Number, required: true },
        ok: { type: Boolean, required: true },
      },
    ],
    guardrail: {
      passed: { type: Boolean, default: true },
      issues: [{ type: String }],
    },
    readAt: { type: Date },
    agentRunId: { type: Schema.Types.ObjectId, ref: "AgentRun" },
    version: { type: Number, default: 1 },
  },
  { timestamps: true }
);

MessageSchema.index({ tenantId: 1, conversationId: 1, createdAt: 1 });

export const MessageModel =
  mongoose.models.Message || mongoose.model<IMessage>("Message", MessageSchema);
