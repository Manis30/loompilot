import mongoose, { Schema, Types } from "mongoose";
import { BaseEntity } from "../../interfaces/base-repository.interface.js";
import { OrderStatus } from "@loompilot/shared";
import { paiseField } from "../common/paise-schema.js";

export const ORDER_STATUS_ENUM = Object.values(OrderStatus);

// Subdocument Interfaces
export interface IOrderSpec {
  sizes: string[];
  gsm?: number;
  colours?: string[];
  fabric?: string;
  print?: string;
}

export interface IOrderStatusHistory {
  status: string;
  by?: Types.ObjectId;
  at: Date;
  reason?: string;
}

export interface IMaterialRequirement {
  materialId: Types.ObjectId;
  req: number;
  avail: number;
  short: number;
}

export interface IProcessCheck {
  stage: string;
  labourCap?: number;
  machineCap?: number;
  load?: number;
  free?: number;
  days?: number;
  start?: string;
  end?: string;
}

export interface IRiskFactor {
  type: string;
  severity: "low" | "medium" | "high";
}

export interface IRecoveryOption {
  optionId: string;
  type: string;
  details?: {
    supplierId?: Types.ObjectId;
    supplierName?: string;
    sourceType?: "supplier" | "local_market";
    rate?: number;
    leadDays?: number;
    qty?: number;
  };
  etaEffect?: number;
  priceEffect?: number;
}

export interface IFeasibility {
  verdict?: "feasible" | "at_risk" | "infeasible";
  etaDate?: string;
  bottleneckProcess?: string;
  materialRequirements?: IMaterialRequirement[];
  version?: number;
  status?: "running" | "ready" | "failed" | "superseded";
  materialReadyDate?: string;
  processChecks?: IProcessCheck[];
  riskFactors?: IRiskFactor[];
  recoveryOptions?: IRecoveryOption[];
  reasonsSummary?: string;
  lowData?: boolean;
  dataBasis?: any;
  inputsSnapshot?: any;
  adminDecision?: {
    choice: string;
    optionId?: string;
    by: Types.ObjectId;
    at: Date;
  };
  agentRunId?: Types.ObjectId;
}

export interface IPaymentScheduleItem {
  milestone: string;
  trigger: "advance" | "stage";
  stage?: string;
  percent: number;
  amountPaise: number;
  dueDate?: string;
}

export interface ILineItem {
  desc: string;
  qty: number;
  unitPricePaise: number;
}

export interface IProcessPlanItem {
  stage: string;
  start: string;
  end: string;
  dailyTarget: number;
}

export interface IQuotationRevision {
  revisionNo: number;
  reasonType: "price_surge" | "admin_edit" | "discount" | "date_change";
  priceAlertRef?: {
    materialId?: Types.ObjectId;
    date?: string;
  };
  oldPricePaise: number;
  newPricePaise: number;
  changePct: number;
  newEtaDate?: string;
  clientReason: string;
  status: "proposed" | "approved" | "sent" | "accepted" | "declined" | "superseded";
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;
  sentAt?: Date;
  clientDecision?: {
    decision?: string;
    reason?: string;
    quotationVersion?: number;
    at?: Date;
  };
  agentRunId?: Types.ObjectId;
}

export interface IQuotation {
  unitPricePaise?: number;
  totalPaise?: number;
  etaDate?: string;
  paymentSchedule?: IPaymentScheduleItem[];
  version?: number;
  status?:
    | "generating"
    | "generation_failed"
    | "pending_approval"
    | "approved"
    | "sent"
    | "accepted"
    | "declined"
    | "rejected"
    | "expired"
    | "superseded";
  generationError?: {
    code?: string;
    message?: string;
    at?: Date;
  };
  lineItems?: ILineItem[];
  validUntil?: string;
  processPlan?: IProcessPlanItem[];
  etaBasis?: {
    supplierLead?: number;
    prodDays?: number;
    safetyDays?: number;
  };
  explanation?: string;
  clientExplanation?: string;
  termsVersion?: string;
  priceVariationClause?: string;
  lockedMaterials?: Types.ObjectId[];
  marginWarning?: boolean;
  basePriceWarning?: boolean;
  lowData?: boolean;
  clientResponse?: {
    decision: string;
    reason?: string;
    by?: Types.ObjectId;
    quotationVersion: number;
    at: Date;
  };
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;
  sentAt?: Date;
  clientPdfFileId?: Types.ObjectId;
  agentRunId?: Types.ObjectId;
  revisions?: IQuotationRevision[];
}

export interface ICosting {
  materialCosts?: Array<{
    materialId: Types.ObjectId;
    qty: number;
    ratePaise: number;
    paise: number;
  }>;
  processingCosts?: Array<{
    stage: string;
    costing?: any;
    paise: number;
  }>;
  marginPct: number;
  marginPaise: number;
  wastagePaise?: number;
  riskBufferPaise?: number;
  overheadPaise?: number;
  totalCostPaise: number;
  formulaVersion?: string;
  revisions?: Array<{
    revisionNo: number;
    costDrivers?: any;
    deltaPaise: number;
  }>;
  inputsSnapshot?: any;
  agentRunId?: Types.ObjectId;
}

export interface IPurchaseDecision {
  decisionId: string;
  optionId?: string;
  materialId: Types.ObjectId;
  supplierId?: Types.ObjectId;
  qty: number;
  ratePaise: number;
  expectedArrivalDate?: string;
  decidedBy: Types.ObjectId;
  decidedAt: Date;
  supplierOrder?: {
    orderNo: string;
    status: "ordered" | "partially_received" | "received" | "cancelled";
    recvQty?: number;
    recvAt?: Date;
  };
}

export interface IReservation {
  materialId: Types.ObjectId;
  qty: number;
  status: "active" | "released" | "consumed";
}

export interface IProduction {
  assignedSupervisors?: Array<{
    supervisorId: Types.ObjectId;
    processes: string[];
    acknowledgedAt?: Date;
  }>;
  phase?: string;
  percentComplete?: number;
  producedQty?: number;
  deliveredQty?: number;
  processPlan?: IProcessPlanItem[];
  assignmentStatus?: "assigned" | "started" | "done";
  assignedBy?: Types.ObjectId;
  assignedAt?: Date;
  stageTotals?: Array<{
    stage: string;
    produced: number;
    defective: number;
  }>;
  monitoring?: {
    requiredDailyOutput?: number;
    actualRate?: number;
    projectedFinish?: string;
    status?: "on_track" | "at_risk" | "behind";
    stale?: boolean;
    byStage?: Array<{
      stage: string;
      produced: number;
      percent: number;
    }>;
    recommendations?: string[];
    updatedAt?: Date;
    agentRunId?: Types.ObjectId;
  };
}

export interface IReceipt {
  amountPaise: number;
  method: "razorpay" | "neft" | "rtgs" | "upi" | "cheque" | "cash";
  ref: string;
  date: string;
  by?: Types.ObjectId;
  razorpayPaymentId?: string;
  reversedAt?: Date;
}

export interface IMilestone {
  milestone: string;
  trigger: "advance" | "stage";
  stage?: string;
  amountPaise: number;
  dueDate?: string;
  status: "pending" | "partial" | "received" | "overdue";
  reminderSentAt?: Date;
  receivedPaise?: number;
  invoiceNo?: string;
  razorpayOrderId?: string;
  receipts?: IReceipt[];
}

export interface IFinancials {
  advanceReceivedPaise?: number;
  totalPaidPaise?: number;
  milestones?: IMilestone[];
}

export interface IDelivery {
  deliveryDate: string;
  qty: number;
  invoiceNo: string;
  invoiceAmountPaise: number;
  onTime: boolean;
  delayDays?: number;
  recordedBy: Types.ObjectId;
}

export interface IOrder extends BaseEntity {
  orderNumber: string;
  clientId: Types.ObjectId;
  productId?: Types.ObjectId;
  quantity: number;
  deliveryDeadline: string;
  status: OrderStatus;
  spec: IOrderSpec;
  productDescription?: string;
  estimatedCompletionDate?: string;
  statusHistory?: IOrderStatusHistory[];
  source: "client_portal" | "admin_manual" | "import";
  requestVersion: number;
  parentOrderId?: Types.ObjectId;
  deliveryAddress?: string;
  deliveryNotes?: string;
  referenceFiles?: Types.ObjectId[];
  idempotencyKey?: string;

  feasibility?: IFeasibility;
  quotation?: IQuotation;
  costing?: ICosting;
  purchaseDecisions?: IPurchaseDecision[];
  reservations?: IReservation[];
  production?: IProduction;
  financials?: IFinancials;
  deliveries?: IDelivery[];
}

// Subdocument Schemas (all with _id: false, strict: true)
const SpecSchema = new Schema<IOrderSpec>(
  {
    sizes: { type: [String], required: true },
    gsm: { type: Number },
    colours: { type: [String] },
    fabric: { type: String },
    print: { type: String },
  },
  { _id: false, strict: true }
);

const StatusHistorySchema = new Schema<IOrderStatusHistory>(
  {
    status: { type: String, required: true },
    by: { type: Schema.Types.ObjectId, ref: "User" },
    at: { type: Date, required: true },
    reason: { type: String },
  },
  { _id: false, strict: true }
);

const MaterialRequirementSchema = new Schema<IMaterialRequirement>(
  {
    materialId: { type: Schema.Types.ObjectId, ref: "Material", required: true },
    req: { type: Number, required: true },
    avail: { type: Number, required: true },
    short: { type: Number, required: true },
  },
  { _id: false, strict: true }
);

const ProcessCheckSchema = new Schema<IProcessCheck>(
  {
    stage: { type: String, required: true },
    labourCap: { type: Number },
    machineCap: { type: Number },
    load: { type: Number },
    free: { type: Number },
    days: { type: Number },
    start: { type: String },
    end: { type: String },
  },
  { _id: false, strict: true }
);

const RiskFactorSchema = new Schema<IRiskFactor>(
  {
    type: { type: String, required: true },
    severity: { type: String, enum: ["low", "medium", "high"], required: true },
  },
  { _id: false, strict: true }
);

const RecoveryOptionSchema = new Schema<IRecoveryOption>(
  {
    optionId: { type: String, required: true },
    type: { type: String, required: true },
    details: {
      type: new Schema(
        {
          supplierId: { type: Schema.Types.ObjectId, ref: "Supplier" },
          supplierName: { type: String },
          sourceType: { type: String, enum: ["supplier", "local_market"] },
          rate: { type: Number },
          leadDays: { type: Number },
          qty: { type: Number },
        },
        { _id: false, strict: true }
      ),
    },
    etaEffect: { type: Number, default: 0 },
    priceEffect: { type: Number, default: 0 },
  },
  { _id: false, strict: true }
);

const FeasibilitySchema = new Schema<IFeasibility>(
  {
    verdict: { type: String, enum: ["feasible", "at_risk", "infeasible"] },
    etaDate: { type: String },
    bottleneckProcess: { type: String },
    materialRequirements: { type: [MaterialRequirementSchema] },
    version: { type: Number, default: 1 },
    status: {
      type: String,
      enum: ["running", "ready", "failed", "superseded"],
      default: "running",
    },
    materialReadyDate: { type: String },
    processChecks: { type: [ProcessCheckSchema] },
    riskFactors: { type: [RiskFactorSchema] },
    recoveryOptions: { type: [RecoveryOptionSchema] },
    reasonsSummary: { type: String },
    lowData: { type: Boolean, default: false },
    dataBasis: { type: Schema.Types.Mixed },
    inputsSnapshot: { type: Schema.Types.Mixed },
    adminDecision: {
      type: new Schema(
        {
          choice: { type: String, required: true },
          optionId: { type: String },
          by: { type: Schema.Types.ObjectId, ref: "User", required: true },
          at: { type: Date, required: true },
        },
        { _id: false, strict: true }
      ),
    },
    agentRunId: { type: Schema.Types.ObjectId, ref: "AgentRun" },
  },
  { _id: false, strict: true }
);

const PaymentScheduleSchema = new Schema<IPaymentScheduleItem>(
  {
    milestone: { type: String, required: true },
    trigger: { type: String, enum: ["advance", "stage"], required: true },
    stage: { type: String },
    percent: { type: Number, required: true },
    amountPaise: paiseField({ required: true }),
    dueDate: { type: String },
  },
  { _id: false, strict: true }
);

const LineItemSchema = new Schema<ILineItem>(
  {
    desc: { type: String, required: true },
    qty: { type: Number, required: true },
    unitPricePaise: paiseField({ required: true }),
  },
  { _id: false, strict: true }
);

const ProcessPlanSchema = new Schema<IProcessPlanItem>(
  {
    stage: { type: String, required: true },
    start: { type: String, required: true },
    end: { type: String, required: true },
    dailyTarget: { type: Number, required: true },
  },
  { _id: false, strict: true }
);

const QuotationRevisionSchema = new Schema<IQuotationRevision>(
  {
    revisionNo: { type: Number, required: true },
    reasonType: {
      type: String,
      enum: ["price_surge", "admin_edit", "discount", "date_change"],
      required: true,
    },
    priceAlertRef: {
      type: new Schema(
        {
          materialId: { type: Schema.Types.ObjectId, ref: "Material" },
          date: { type: String },
        },
        { _id: false, strict: true }
      ),
    },
    oldPricePaise: paiseField({ required: true }),
    newPricePaise: paiseField({ required: true }),
    changePct: { type: Number, required: true },
    newEtaDate: { type: String },
    clientReason: { type: String, required: true },
    status: {
      type: String,
      enum: ["proposed", "approved", "sent", "accepted", "declined", "superseded"],
      default: "proposed",
      required: true,
    },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },
    sentAt: { type: Date },
    clientDecision: {
      type: new Schema(
        {
          decision: { type: String },
          reason: { type: String },
          quotationVersion: { type: Number },
          at: { type: Date },
        },
        { _id: false, strict: true }
      ),
    },
    agentRunId: { type: Schema.Types.ObjectId, ref: "AgentRun" },
  },
  { _id: false, strict: true }
);

const QuotationSchema = new Schema<IQuotation>(
  {
    unitPricePaise: paiseField(),
    totalPaise: paiseField(),
    etaDate: { type: String },
    paymentSchedule: { type: [PaymentScheduleSchema] },
    version: { type: Number, default: 1 },
    status: {
      type: String,
      enum: [
        "generating",
        "generation_failed",
        "pending_approval",
        "approved",
        "sent",
        "accepted",
        "declined",
        "rejected",
        "expired",
        "superseded",
      ],
      default: "generating",
    },
    generationError: {
      type: new Schema(
        {
          code: { type: String },
          message: { type: String },
          at: { type: Date },
        },
        { _id: false, strict: true }
      ),
    },
    lineItems: { type: [LineItemSchema] },
    validUntil: { type: String },
    processPlan: { type: [ProcessPlanSchema] },
    etaBasis: {
      type: new Schema(
        {
          supplierLead: { type: Number },
          prodDays: { type: Number },
          safetyDays: { type: Number },
        },
        { _id: false, strict: true }
      ),
    },
    explanation: { type: String },
    clientExplanation: { type: String },
    termsVersion: { type: String },
    priceVariationClause: { type: String },
    lockedMaterials: [{ type: Schema.Types.ObjectId, ref: "Material" }],
    marginWarning: { type: Boolean, default: false },
    basePriceWarning: { type: Boolean, default: false },
    lowData: { type: Boolean, default: false },
    clientResponse: {
      type: new Schema(
        {
          decision: { type: String, required: true },
          reason: { type: String },
          by: { type: Schema.Types.ObjectId, ref: "Client" },
          quotationVersion: { type: Number, required: true },
          at: { type: Date, required: true },
        },
        { _id: false, strict: true }
      ),
    },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },
    sentAt: { type: Date },
    clientPdfFileId: { type: Schema.Types.ObjectId, ref: "File" },
    agentRunId: { type: Schema.Types.ObjectId, ref: "AgentRun" },
    revisions: { type: [QuotationRevisionSchema] },
  },
  { _id: false, strict: true }
);

const CostingSchema = new Schema<ICosting>(
  {
    materialCosts: [
      {
        _id: false,
        materialId: { type: Schema.Types.ObjectId, ref: "Material", required: true },
        qty: { type: Number, required: true },
        ratePaise: paiseField({ required: true }),
        paise: paiseField({ required: true }),
      },
    ],
    processingCosts: [
      {
        _id: false,
        stage: { type: String, required: true },
        costing: { type: Schema.Types.Mixed },
        paise: paiseField({ required: true }),
      },
    ],
    marginPct: { type: Number, required: true },
    marginPaise: paiseField({ required: true }),
    wastagePaise: paiseField({ default: 0 }),
    riskBufferPaise: paiseField({ default: 0 }),
    overheadPaise: paiseField({ default: 0 }),
    totalCostPaise: paiseField({ required: true }),
    formulaVersion: { type: String, default: "v4" },
    revisions: [
      {
        _id: false,
        revisionNo: { type: Number, required: true },
        costDrivers: { type: Schema.Types.Mixed },
        deltaPaise: paiseField({ allowSigned: true, required: true }),
      },
    ],
    inputsSnapshot: { type: Schema.Types.Mixed },
    agentRunId: { type: Schema.Types.ObjectId, ref: "AgentRun" },
  },
  { _id: false, strict: true }
);

const PurchaseDecisionSchema = new Schema<IPurchaseDecision>(
  {
    decisionId: { type: String, required: true },
    optionId: { type: String },
    materialId: { type: Schema.Types.ObjectId, ref: "Material", required: true },
    supplierId: { type: Schema.Types.ObjectId, ref: "Supplier" },
    qty: { type: Number, required: true },
    ratePaise: paiseField({ required: true }),
    expectedArrivalDate: { type: String },
    decidedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    decidedAt: { type: Date, required: true },
    supplierOrder: {
      type: new Schema(
        {
          orderNo: { type: String, required: true },
          status: {
            type: String,
            enum: ["ordered", "partially_received", "received", "cancelled"],
            default: "ordered",
          },
          recvQty: { type: Number, default: 0 },
          recvAt: { type: Date },
        },
        { _id: false, strict: true }
      ),
    },
  },
  { _id: false, strict: true }
);

const ReservationSchema = new Schema<IReservation>(
  {
    materialId: { type: Schema.Types.ObjectId, ref: "Material", required: true },
    qty: { type: Number, required: true },
    status: {
      type: String,
      enum: ["active", "released", "consumed"],
      default: "active",
      required: true,
    },
  },
  { _id: false, strict: true }
);

const ProductionSchema = new Schema<IProduction>(
  {
    assignedSupervisors: [
      {
        _id: false,
        supervisorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        processes: { type: [String], required: true },
        acknowledgedAt: { type: Date },
      },
    ],
    phase: { type: String },
    percentComplete: { type: Number, default: 0 },
    producedQty: { type: Number, default: 0 },
    deliveredQty: { type: Number, default: 0 },
    processPlan: { type: [ProcessPlanSchema] },
    assignmentStatus: {
      type: String,
      enum: ["assigned", "started", "done"],
      default: "assigned",
    },
    assignedBy: { type: Schema.Types.ObjectId, ref: "User" },
    assignedAt: { type: Date },
    stageTotals: [
      {
        _id: false,
        stage: { type: String, required: true },
        produced: { type: Number, default: 0 },
        defective: { type: Number, default: 0 },
      },
    ],
    monitoring: {
      type: new Schema(
        {
          requiredDailyOutput: { type: Number },
          actualRate: { type: Number },
          projectedFinish: { type: String },
          status: {
            type: String,
            enum: ["on_track", "at_risk", "behind"],
            default: "on_track",
          },
          stale: { type: Boolean, default: false },
          byStage: [
            {
              _id: false,
              stage: { type: String, required: true },
              produced: { type: Number, default: 0 },
              percent: { type: Number, default: 0 },
            },
          ],
          recommendations: { type: [String] },
          updatedAt: { type: Date },
          agentRunId: { type: Schema.Types.ObjectId, ref: "AgentRun" },
        },
        { _id: false, strict: true }
      ),
    },
  },
  { _id: false, strict: true }
);

const ReceiptSchema = new Schema<IReceipt>(
  {
    amountPaise: paiseField({ required: true }),
    method: {
      type: String,
      enum: ["razorpay", "neft", "rtgs", "upi", "cheque", "cash"],
      required: true,
    },
    ref: { type: String, required: true },
    date: { type: String, required: true },
    by: { type: Schema.Types.ObjectId, ref: "User" },
    razorpayPaymentId: { type: String },
    reversedAt: { type: Date },
  },
  { _id: false, strict: true }
);

const MilestoneSchema = new Schema<IMilestone>(
  {
    milestone: { type: String, required: true },
    trigger: { type: String, enum: ["advance", "stage"], required: true },
    stage: { type: String },
    amountPaise: paiseField({ required: true }),
    dueDate: { type: String },
    status: {
      type: String,
      enum: ["pending", "partial", "received", "overdue"],
      default: "pending",
      required: true,
    },
    reminderSentAt: { type: Date },
    receivedPaise: paiseField({ default: 0 }),
    invoiceNo: { type: String },
    razorpayOrderId: { type: String },
    receipts: { type: [ReceiptSchema] },
  },
  { _id: false, strict: true }
);

const FinancialsSchema = new Schema<IFinancials>(
  {
    advanceReceivedPaise: paiseField({ default: 0 }),
    totalPaidPaise: paiseField({ default: 0 }),
    milestones: { type: [MilestoneSchema] },
  },
  { _id: false, strict: true }
);

const DeliverySchema = new Schema<IDelivery>(
  {
    deliveryDate: { type: String, required: true },
    qty: { type: Number, required: true },
    invoiceNo: { type: String, required: true },
    invoiceAmountPaise: paiseField({ required: true }),
    onTime: { type: Boolean, required: true },
    delayDays: { type: Number, default: 0 },
    recordedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { _id: false, strict: true }
);

// Main Order Schema
const OrderSchema = new Schema<IOrder>(
  {
    tenantId: { type: String, required: true, index: true },
    orderNumber: { type: String, required: true, uppercase: true, trim: true },
    clientId: { type: Schema.Types.ObjectId, required: true, ref: "Client" },
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: [
        function (this: any) {
          return !this?.productDescription;
        },
        "Either productId or productDescription must be provided",
      ],
    },
    quantity: { type: Number, required: true },
    deliveryDeadline: { type: String, required: true },
    status: {
      type: String,
      enum: ORDER_STATUS_ENUM,
      default: OrderStatus.SUBMITTED,
      required: true,
    },
    spec: { type: SpecSchema, required: true },
    productDescription: { type: String },
    estimatedCompletionDate: { type: String },
    statusHistory: { type: [StatusHistorySchema] },
    source: {
      type: String,
      enum: ["client_portal", "admin_manual", "import"],
      default: "admin_manual",
      required: true,
    },
    requestVersion: { type: Number, default: 1 },
    parentOrderId: { type: Schema.Types.ObjectId, ref: "Order" },
    deliveryAddress: { type: String },
    deliveryNotes: { type: String },
    referenceFiles: [{ type: Schema.Types.ObjectId, ref: "File" }],
    idempotencyKey: { type: String },

    feasibility: { type: FeasibilitySchema },
    quotation: { type: QuotationSchema },
    costing: { type: CostingSchema, select: false },
    purchaseDecisions: { type: [PurchaseDecisionSchema] },
    reservations: { type: [ReservationSchema] },
    production: { type: ProductionSchema },
    financials: { type: FinancialsSchema },
    deliveries: { type: [DeliverySchema] },
    version: { type: Number, default: 1 },
  },
  { timestamps: true }
);

// Indexes
OrderSchema.index({ tenantId: 1, orderNumber: 1 }, { unique: true });
OrderSchema.index({ tenantId: 1, status: 1, deliveryDeadline: 1 });
OrderSchema.index({ tenantId: 1, clientId: 1, createdAt: 1 });
OrderSchema.index({ tenantId: 1, "production.assignedSupervisors.supervisorId": 1, status: 1 });
OrderSchema.index({ tenantId: 1, "financials.milestones.status": 1, "financials.milestones.dueDate": 1 });
OrderSchema.index({
  tenantId: 1,
  "financials.milestones.receipts.razorpayPaymentId": 1,
});
OrderSchema.index(
  { tenantId: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: { idempotencyKey: { $type: "string" } },
  }
);

export const OrderModel: mongoose.Model<IOrder> =
  (mongoose.models.Order as mongoose.Model<IOrder>) ||
  mongoose.model<IOrder>("Order", OrderSchema, "orders");
