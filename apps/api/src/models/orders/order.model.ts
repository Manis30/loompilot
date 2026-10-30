import mongoose, { Schema, Types } from "mongoose";
import { BaseEntity } from "../../interfaces/base-repository.interface.js";
import { OrderStatus } from "@loompilot/shared";
import { paiseField } from "../common/paise-schema.js";

export interface IOrderStatusHistory {
  status: string;
  by: Types.ObjectId;
  at: Date;
  reason?: string;
}

export interface IOrderProcessPlan {
  stage: string;
  start: string; // 'YYYY-MM-DD'
  end: string; // 'YYYY-MM-DD'
  dailyTarget: number;
}

export interface IOrderEtaBasis {
  supplierLead: number;
  prodDays: number;
  safetyDays: number;
}

export interface IOrderSpec {
  sizes?: string[];
  colours?: string[];
  fabric?: string;
  print?: string;
  [key: string]: any;
}

export interface IOrder extends BaseEntity {
  orderNumber: string;
  clientId: Types.ObjectId;
  productId?: Types.ObjectId;
  productDescription?: string;
  quantity: number;
  producedQty: number;
  deliveredQty: number;
  deliveryDeadline: string; // 'YYYY-MM-DD'
  estimatedCompletionDate?: string; // 'YYYY-MM-DD'
  spec?: IOrderSpec;
  deliveryAddress?: string;
  deliveryNotes?: string;
  referenceFiles: string[];
  source: "client_portal" | "admin_manual" | "import";
  parentOrderId?: Types.ObjectId;
  requestVersion: number;
  status: OrderStatus;
  statusHistory: IOrderStatusHistory[];
  currentQuotationId?: Types.ObjectId;
  latestFeasibilityId?: Types.ObjectId;
  processPlan: IOrderProcessPlan[];
  etaBasis?: IOrderEtaBasis;
  quotedUnitPricePaise?: number;
  quotedTotalPaise?: number;
  percentComplete?: number;
  phase?: string;
  idempotencyKey?: string;
}

export const ORDER_STATUS_ENUM = Object.values(OrderStatus);

const OrderSchema = new Schema<IOrder>(
  {
    tenantId: { type: String, required: true, index: true },
    orderNumber: { type: String, required: true, uppercase: true, trim: true },
    clientId: { type: Schema.Types.ObjectId, required: true, ref: "Client" },
    productId: { type: Schema.Types.ObjectId, ref: "Product" },
    productDescription: { type: String },
    quantity: { type: Number, required: true },
    producedQty: { type: Number, default: 0 },
    deliveredQty: { type: Number, default: 0 },
    deliveryDeadline: {
      type: String,
      required: true,
      match: [/^\d{4}-\d{2}-\d{2}$/, "Must be 'YYYY-MM-DD' format"],
    },
    estimatedCompletionDate: { type: String },
    spec: {
      sizes: [{ type: String }],
      colours: [{ type: String }],
      fabric: { type: String },
      print: { type: String },
    },
    deliveryAddress: { type: String },
    deliveryNotes: { type: String },
    referenceFiles: [{ type: String }],
    source: {
      type: String,
      enum: ["client_portal", "admin_manual", "import"],
      default: "admin_manual",
      required: true,
    },
    parentOrderId: { type: Schema.Types.ObjectId, ref: "Order" },
    requestVersion: { type: Number, default: 1 },
    status: {
      type: String,
      enum: ORDER_STATUS_ENUM,
      default: OrderStatus.SUBMITTED,
      required: true,
    },
    statusHistory: [
      {
        _id: false,
        status: { type: String, required: true },
        by: { type: Schema.Types.ObjectId, required: true, ref: "User" },
        at: { type: Date, default: Date.now },
        reason: { type: String },
      },
    ],
    currentQuotationId: { type: Schema.Types.ObjectId, ref: "Quotation" },
    latestFeasibilityId: { type: Schema.Types.ObjectId, ref: "FeasibilityReport" },
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
    quotedUnitPricePaise: paiseField(),
    quotedTotalPaise: paiseField(),
    percentComplete: { type: Number, default: 0 },
    phase: { type: String },
    idempotencyKey: { type: String },
    version: { type: Number, default: 1 },
  },
  { timestamps: true }
);

OrderSchema.index({ tenantId: 1, orderNumber: 1 }, { unique: true });
OrderSchema.index({ tenantId: 1, status: 1, deliveryDeadline: 1 });
OrderSchema.index({ tenantId: 1, clientId: 1 });

export const OrderModel = mongoose.models.Order || mongoose.model<IOrder>("Order", OrderSchema);
