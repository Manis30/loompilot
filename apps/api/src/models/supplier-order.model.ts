import mongoose, { Schema, Document } from "mongoose";

export interface ISupplierOrderItem {
  materialId: mongoose.Types.ObjectId;
  quantity: number;
  unitCostPaise: number;
  receivedQty: number;
}

export interface ISupplierOrderDocument extends Document {
  tenantId: string;
  orderNumber: string;
  supplierId: mongoose.Types.ObjectId;
  status: "draft" | "placed" | "partially_received" | "received" | "cancelled";
  items: ISupplierOrderItem[];
  expectedDeliveryDate?: string;
  placedAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SupplierOrderItemSchema = new Schema<ISupplierOrderItem>(
  {
    materialId: { type: Schema.Types.ObjectId, ref: "Material", required: true },
    quantity: { type: Number, required: true, min: 0.001 },
    unitCostPaise: { type: Number, required: true, min: 0 },
    receivedQty: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const SupplierOrderSchema = new Schema<ISupplierOrderDocument>(
  {
    tenantId: { type: String, required: true, index: true },
    orderNumber: { type: String, required: true },
    supplierId: { type: Schema.Types.ObjectId, ref: "Supplier", required: true, index: true },
    status: {
      type: String,
      enum: ["draft", "placed", "partially_received", "received", "cancelled"],
      default: "draft",
      index: true,
    },
    items: { type: [SupplierOrderItemSchema], required: true },
    expectedDeliveryDate: { type: String },
    placedAt: { type: Date },
    notes: { type: String },
  },
  { timestamps: true }
);

SupplierOrderSchema.index({ tenantId: 1, orderNumber: 1 }, { unique: true });

export const SupplierOrderModel = mongoose.model<ISupplierOrderDocument>(
  "SupplierOrder",
  SupplierOrderSchema
);

