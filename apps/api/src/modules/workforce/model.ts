import mongoose, { Schema, Document } from "mongoose";

// 1. Worker Model
export interface IWorker extends Document {
  tenantId: string;
  workerCode: string;
  name: string;
  skillLevel: "unskilled" | "semi_skilled" | "skilled";
  hourlyRatePaise: number;
  assignedProcessId?: mongoose.Types.ObjectId;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const WorkerSchema = new Schema<IWorker>(
  {
    tenantId: { type: String, required: true, index: true },
    workerCode: { type: String, required: true },
    name: { type: String, required: true },
    skillLevel: {
      type: String,
      enum: ["unskilled", "semi_skilled", "skilled"],
      default: "semi_skilled",
    },
    hourlyRatePaise: { type: Number, required: true, default: 12000 }, // 120 INR/hr
    assignedProcessId: { type: Schema.Types.ObjectId, ref: "Process" },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

WorkerSchema.index({ tenantId: 1, workerCode: 1 }, { unique: true });

export const WorkerModel = mongoose.model<IWorker>("Worker", WorkerSchema);

// 2. Attendance Model
export interface IAttendance extends Document {
  tenantId: string;
  workerId: mongoose.Types.ObjectId;
  date: string; // YYYY-MM-DD
  isPresent: boolean;
  hoursWorked: number;
  createdAt: Date;
}

const AttendanceSchema = new Schema<IAttendance>(
  {
    tenantId: { type: String, required: true, index: true },
    workerId: { type: Schema.Types.ObjectId, ref: "Worker", required: true, index: true },
    date: { type: String, required: true },
    isPresent: { type: Boolean, default: true },
    hoursWorked: { type: Number, default: 8, min: 0, max: 24 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

AttendanceSchema.index({ tenantId: 1, workerId: 1, date: 1 }, { unique: true });
AttendanceSchema.index({ tenantId: 1, date: 1 });

export const AttendanceModel = mongoose.model<IAttendance>("Attendance", AttendanceSchema);

// 3. DailyOutput Model (Unique compound index on orderId + processId + date)
export interface IDailyOutput extends Document {
  tenantId: string;
  orderId: mongoose.Types.ObjectId;
  processId: mongoose.Types.ObjectId;
  date: string; // YYYY-MM-DD
  quantityProduced: number;
  quantityDefective: number;
  operatorId?: string;
  notes?: string;
  idempotencyKey: string;
  createdAt: Date;
  updatedAt: Date;
}

const DailyOutputSchema = new Schema<IDailyOutput>(
  {
    tenantId: { type: String, required: true, index: true },
    orderId: { type: Schema.Types.ObjectId, ref: "ProductionOrder", required: true, index: true },
    processId: { type: Schema.Types.ObjectId, ref: "Process", required: true, index: true },
    date: { type: String, required: true },
    quantityProduced: { type: Number, required: true, min: 0 },
    quantityDefective: { type: Number, default: 0, min: 0 },
    operatorId: { type: String },
    notes: { type: String },
    idempotencyKey: { type: String, required: true },
  },
  { timestamps: true }
);

// Strict unique compound indexes
DailyOutputSchema.index({ tenantId: 1, orderId: 1, processId: 1, date: 1 }, { unique: true });
DailyOutputSchema.index({ tenantId: 1, idempotencyKey: 1 }, { unique: true });

export const DailyOutputModel = mongoose.model<IDailyOutput>("DailyOutput", DailyOutputSchema);

