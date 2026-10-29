import mongoose, { Schema, Document } from "mongoose";
import { MaterialType, StockMovementType } from "@loompilot/shared";

// 1. Material Model
export interface IMaterial extends Document {
  tenantId: string;
  code: string;
  name: string;
  type: MaterialType;
  unit: string;
  currentRatePaise: number;
  avgCostPaise: number;
  onHandQuantity: number;
  reservedQuantity: number;
  reorderLevel: number;
  preferredSupplierId?: mongoose.Types.ObjectId;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const MaterialSchema = new Schema<IMaterial>(
  {
    tenantId: { type: String, required: true, index: true },
    code: { type: String, required: true },
    name: { type: String, required: true },
    type: { type: String, enum: Object.values(MaterialType), required: true },
    unit: { type: String, required: true },
    currentRatePaise: { type: Number, required: true, min: 0 },
    avgCostPaise: { type: Number, required: true, min: 0 },
    onHandQuantity: { type: Number, default: 0, min: 0 },
    reservedQuantity: { type: Number, default: 0, min: 0 },
    reorderLevel: { type: Number, default: 0, min: 0 },
    preferredSupplierId: { type: Schema.Types.ObjectId, ref: "Supplier" },
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

MaterialSchema.index({ tenantId: 1, code: 1 }, { unique: true });

export const MaterialModel = mongoose.model<IMaterial>("Material", MaterialSchema);

// 2. StockMovement Model (Append-Only Ledger)
export interface IStockMovement extends Document {
  tenantId: string;
  materialId: mongoose.Types.ObjectId;
  type: StockMovementType;
  quantity: number;
  previousBalance: number;
  newBalance: number;
  referenceType: "receipt" | "order_issue" | "reservation" | "adjustment";
  referenceId?: string;
  notes?: string;
  createdAt: Date;
}

const StockMovementSchema = new Schema<IStockMovement>(
  {
    tenantId: { type: String, required: true, index: true },
    materialId: { type: Schema.Types.ObjectId, ref: "Material", required: true, index: true },
    type: { type: String, enum: Object.values(StockMovementType), required: true },
    quantity: { type: Number, required: true },
    previousBalance: { type: Number, required: true },
    newBalance: { type: Number, required: true },
    referenceType: {
      type: String,
      enum: ["receipt", "order_issue", "reservation", "adjustment"],
      required: true,
    },
    referenceId: { type: String },
    notes: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

StockMovementSchema.index({ tenantId: 1, materialId: 1, createdAt: -1 });

export const StockMovementModel =
  mongoose.model<IStockMovement>("StockMovement", StockMovementSchema);

// 3. Reservation Model
export interface IReservation extends Document {
  tenantId: string;
  materialId: mongoose.Types.ObjectId;
  orderId: mongoose.Types.ObjectId;
  quantity: number;
  status: "reserved" | "allocated" | "released";
  createdAt: Date;
  updatedAt: Date;
}

const ReservationSchema = new Schema<IReservation>(
  {
    tenantId: { type: String, required: true, index: true },
    materialId: { type: Schema.Types.ObjectId, ref: "Material", required: true, index: true },
    orderId: { type: Schema.Types.ObjectId, ref: "ProductionOrder", required: true, index: true },
    quantity: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ["reserved", "allocated", "released"],
      default: "reserved",
    },
  },
  { timestamps: true }
);

export const ReservationModel =
  mongoose.model<IReservation>("Reservation", ReservationSchema);

// 4. PriceHistory Model
export interface IPriceHistory extends Document {
  tenantId: string;
  materialId: mongoose.Types.ObjectId;
  date: string; // YYYY-MM-DD
  ratePaise: number;
  source: string;
  referenceId?: string;
  createdAt: Date;
}

const PriceHistorySchema = new Schema<IPriceHistory>(
  {
    tenantId: { type: String, required: true, index: true },
    materialId: { type: Schema.Types.ObjectId, ref: "Material", required: true, index: true },
    date: { type: String, required: true },
    ratePaise: { type: Number, required: true, min: 0 },
    source: { type: String, default: "manual" },
    referenceId: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

PriceHistorySchema.index({ tenantId: 1, materialId: 1, date: -1 });

export const PriceHistoryModel =
  mongoose.model<IPriceHistory>("PriceHistory", PriceHistorySchema);
