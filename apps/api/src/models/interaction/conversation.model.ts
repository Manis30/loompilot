import mongoose, { Schema, Types } from "mongoose";
import { BaseEntity } from "../../interfaces/base-repository.interface.js";

export interface IConversation extends BaseEntity {
  orderId?: Types.ObjectId;
  clientId: Types.ObjectId;
  status: "agent_handling" | "escalated" | "admin_handling" | "resolved";
  assignedAdminId?: Types.ObjectId;
  lastMessageAt?: Date;
}

const ConversationSchema = new Schema<IConversation>(
  {
    tenantId: { type: String, required: true, index: true },
    orderId: { type: Schema.Types.ObjectId, ref: "Order" },
    clientId: { type: Schema.Types.ObjectId, required: true, ref: "Client" },
    status: {
      type: String,
      enum: ["agent_handling", "escalated", "admin_handling", "resolved"],
      default: "agent_handling",
      required: true,
    },
    assignedAdminId: { type: Schema.Types.ObjectId, ref: "User" },
    lastMessageAt: { type: Date, default: Date.now },
    version: { type: Number, default: 1 },
  },
  { timestamps: true }
);

ConversationSchema.index({ tenantId: 1, orderId: 1 }, { unique: true, sparse: true });
ConversationSchema.index({ tenantId: 1, clientId: 1, lastMessageAt: -1 });

export const ConversationModel =
  mongoose.models.Conversation ||
  mongoose.model<IConversation>("Conversation", ConversationSchema);
