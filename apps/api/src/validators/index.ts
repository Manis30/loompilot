import { Request, Response, NextFunction } from "express";
import { z, ZodSchema, ZodType } from "zod";
import { AppError } from "../errors/app-error.js";
import { ErrorCode } from "@loompilot/shared";
import { paginationQuerySchema } from "../utils/pagination.js";

export { paginationQuerySchema };

export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const details = result.error.errors.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      }));
      next(new AppError(ErrorCode.VALIDATION_FAILED, "Request validation failed", 400, details));
      return;
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const details = result.error.errors.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      }));
      next(new AppError(ErrorCode.VALIDATION_FAILED, "Query validation failed", 400, details));
      return;
    }
    req.query = result.data as any;
    next();
  };
}

export function validateParams<T = any>(schema: ZodType<T, any, any>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      const details = result.error.errors.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      }));
      next(new AppError(ErrorCode.VALIDATION_FAILED, "Path parameter validation failed", 400, details));
      return;
    }
    req.params = result.data as any;
    next();
  };
}

// ============================================================================
// Phase B Validation Schemas
// ============================================================================

export const IdParamSchema = z.object({
  id: z.string().min(1),
});

export const SettingsUpdateSchema = z.object({
  version: z.number().int().positive().optional(),
  timezone: z.string().optional(),
  minMarginPct: z.number().min(0).max(100).optional(),
  defaultMarginPct: z.number().min(0).max(100).optional(),
  advancePct: z.number().min(0).max(100).optional(),
  processConfig: z
    .array(
      z.object({
        area: z.string().min(1),
        hours: z.number().positive(),
        overlap: z.boolean(),
        fallbackOut: z.number().positive().optional(),
        usualWorkers: z.number().int().positive().optional(),
      })
    )
    .optional(),
  holidays: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  weeklyOffs: z.array(z.number().int().min(0).max(6)).optional(),
  marketRuntime: z.string().optional(),
  reportCutoff: z.string().optional(),
  safetyDays: z.number().int().nonnegative().optional(),
  quoteValidityDays: z.number().int().positive().optional(),
  riskBuffer: z
    .object({
      k: z.number().optional(),
      minPct: z.number().optional(),
      maxPct: z.number().optional(),
      windowDays: z.number().optional(),
    })
    .optional(),
  behindThresholdPct: z.number().optional(),
  maxBackdateDays: z.number().int().positive().optional(),
  priceThresholds: z
    .object({
      daily: z.number().optional(),
      sevenday: z.number().optional(),
      vol: z.number().optional(),
    })
    .optional(),
  quoteReminderDays: z.array(z.number().int().positive()).optional(),
  paymentReminderLeadDays: z.number().int().nonnegative().optional(),
  basePriceTolerancePct: z.number().nullable().optional(),
  marketSources: z
    .array(
      z.object({
        name: z.string().min(1),
        type: z.enum(["supplier_quote", "web", "feed"]),
        trust: z.enum(["trusted", "normal", "unverified"]),
        active: z.boolean().optional(),
        config: z.record(z.any()).optional(),
      })
    )
    .optional(),
});

export const UserCreateSchema = z.object({
  name: z.string().min(1).trim(),
  email: z.string().email().trim(),
  password: z.string().min(10).max(72),
  role: z.enum(["admin", "supervisor"]),
  phone: z.string().trim().optional(),
  processAreas: z.array(z.string().min(1).trim()).optional().default([]),
  tenantId: z.string().optional(),
});

export const UserUpdateSchema = z.object({
  name: z.string().min(1).trim().optional(),
  phone: z.string().trim().optional(),
  role: z.enum(["admin", "supervisor"]).optional(),
  status: z.enum(["active", "locked"]).optional(),
  processAreas: z.array(z.string().min(1).trim()).optional(),
  tenantId: z.string().optional(),
});

export const UserQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().trim().optional(),
  role: z.enum(["admin", "supervisor"]).optional(),
  status: z.enum(["active", "locked"]).optional(),
  processArea: z.string().trim().optional(),
  sortBy: z.enum(["name", "email", "role", "status", "createdAt", "updatedAt"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  tenantId: z.string().optional(),
});

export const ClientCreateSchema = z
  .object({
    clientName: z.string().min(1).trim(),
    contactPerson: z.string().trim().optional(),
    email: z.string().email().trim(),
    phone: z.string().trim().optional(),
    city: z.string().trim().optional(),
    address: z.string().trim().optional(),
    customerType: z.string().trim().optional(),
    paymentTermsDays: z.number().int().nonnegative().optional(),
    country: z.string().trim().optional(),
    status: z.enum(["active", "inactive"]).optional(),
  })
  .strict();

export const ClientUpdateSchema = z
  .object({
    clientName: z.string().min(1).trim().optional(),
    contactPerson: z.string().trim().optional(),
    email: z.string().email().trim().optional(),
    phone: z.string().trim().optional(),
    city: z.string().trim().optional(),
    address: z.string().trim().optional(),
    customerType: z.string().trim().optional(),
    paymentTermsDays: z.number().int().nonnegative().optional(),
    country: z.string().trim().optional(),
    status: z.enum(["active", "inactive"]).optional(),
  })
  .strict();

export const ClientQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    search: z.string().trim().optional(),
    status: z.enum(["active", "inactive"]).optional(),
    customerType: z.string().trim().optional(),
    city: z.string().trim().optional(),
    country: z.string().trim().optional(),
    portalStatus: z.enum(["invited", "active", "locked"]).optional(),
    sortBy: z
      .enum(["clientName", "email", "status", "paymentTermsDays", "createdAt", "updatedAt"])
      .optional(),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  })
  .strict();

export const ClientPortalInviteSchema = z
  .object({
    email: z.string().email().trim(),
    name: z.string().trim().optional(),
    phone: z.string().trim().optional(),
  })
  .strict();

export const SupplierCreateSchema = z.object({
  supplierName: z.string().min(1),
  contactPerson: z.string().optional(),
  email: z.string().email(),
  phone: z.string().min(1),
  city: z.string().min(1),
  country: z.string().optional(),
  defaultLeadTimeDays: z.number().int().nonnegative().optional(),
});

export const SupplierUpdateSchema = SupplierCreateSchema.partial();

export const MaterialCreateSchema = z.object({
  materialName: z.string().min(1),
  type: z.enum(["yarn", "fabric", "dye_chemical", "trim", "packing"]),
  stockQty: z.number().nonnegative().optional(),
  reorderLevel: z.number().nonnegative().optional(),
  currentRatePaise: z.number().int().positive(),
  preferredSupplierId: z.string().optional(),
  unit: z.string().optional(),
  watchlist: z.boolean().optional(),
});

export const MaterialUpdateSchema = MaterialCreateSchema.partial();

export const MaterialRateUpdateSchema = z.object({
  currentRatePaise: z.number().int().positive(),
});

export const SupplierOffersUpdateSchema = z.object({
  supplierOffers: z.array(
    z.object({
      supplierId: z.string().min(1),
      ratePaise: z.number().int().positive(),
      leadDays: z.number().int().nonnegative(),
    })
  ),
});

export const MachineCreateSchema = z.object({
  machineCode: z.string().min(1),
  machineName: z.string().min(1),
  processArea: z.string().min(1),
  capacityUnitsPerDay: z.number().positive(),
  machineType: z.string().optional(),
});

export const MachineUpdateSchema = MachineCreateSchema.partial();

export const MachineStatusUpdateSchema = z
  .object({
    status: z.enum(["available", "maint", "breakdown", "inactive"]).optional(),
    currentStatus: z.enum(["available", "maint", "breakdown", "inactive"]).optional(),
    notes: z.string().optional(),
  })
  .refine((data) => data.status !== undefined || data.currentStatus !== undefined, {
    message: "Either status or currentStatus is required",
  });

export const ProductCreateSchema = z
  .object({
    productName: z.string().min(1).trim(),
    category: z.string().min(1).trim(),
    basePricePaise: z.number().int().positive(),
    bom: z
      .array(
        z
          .object({
            materialId: z.string().min(1),
            qtyPerUnit: z.number().positive(),
            wastage: z.number().nonnegative().optional(),
          })
          .strict()
      )
      .min(1),
    routing: z
      .array(
        z
          .object({
            stage: z.string().min(1).trim(),
            seq: z.number().int().positive(),
            stdMinPerUnit: z.number().positive(),
          })
          .strict()
      )
      .min(1),
    imageFileIds: z.array(z.string().min(1)).optional(),
    active: z.boolean().optional(),
  })
  .strict();

export const ProductUpdateSchema = z
  .object({
    productName: z.string().min(1).trim().optional(),
    category: z.string().min(1).trim().optional(),
    basePricePaise: z.number().int().positive().optional(),
    bom: z
      .array(
        z
          .object({
            materialId: z.string().min(1),
            qtyPerUnit: z.number().positive(),
            wastage: z.number().nonnegative().optional(),
          })
          .strict()
      )
      .min(1)
      .optional(),
    routing: z
      .array(
        z
          .object({
            stage: z.string().min(1).trim(),
            seq: z.number().int().positive(),
            stdMinPerUnit: z.number().positive(),
          })
          .strict()
      )
      .min(1)
      .optional(),
    imageFileIds: z.array(z.string().min(1)).optional(),
    active: z.boolean().optional(),
  })
  .strict();

export const ProductQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    search: z.string().trim().optional(),
    category: z.string().trim().optional(),
    active: z
      .preprocess((val) => {
        if (typeof val === "string") {
          const lower = val.trim().toLowerCase();
          if (lower === "true" || lower === "1") return true;
          if (lower === "false" || lower === "0") return false;
        }
        return val;
      }, z.boolean().optional())
      .optional(),
    status: z.enum(["active", "inactive"]).optional(),
    sortBy: z
      .enum(["productName", "category", "basePricePaise", "createdAt", "updatedAt"])
      .optional(),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  })
  .strict();

export const ClientCatalogueQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    search: z.string().trim().optional(),
    category: z.string().trim().optional(),
    sortBy: z
      .enum(["productName", "category", "basePricePaise", "createdAt"])
      .optional(),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  })
  .strict();

export const ProductImageSchema = z
  .object({
    fileId: z.string().min(1),
  })
  .strict();

export const StockGoodsReceiptSchema = z.object({
  materialId: z.string().min(1),
  qty: z.number().positive(),
  unitCostPaise: z.number().int().positive(),
  supplierId: z.string().min(1),
  orderId: z.string().optional(),
  purchaseDecisionId: z.string().optional(),
});

export const StockAdjustSchema = z.object({
  materialId: z.string().min(1),
  deltaQty: z.number(),
  reason: z.string().min(1),
});

export const ImportDryRunSchema = z.object({
  type: z.enum(["materials", "suppliers", "machines", "products", "market_prices"]),
  csvContent: z.string().optional(),
  fileId: z.string().optional(),
});

export const ImportCommitSchema = z.object({
  jobId: z.string().optional(),
  type: z.enum(["materials", "suppliers", "machines", "products", "market_prices"]).optional(),
  fileHash: z.string().optional(),
  csvContent: z.string().optional(),
  fileId: z.string().optional(),
});

export const ClientSubmitOrderSchema = z.object({
  productId: z.string().optional(),
  productDescription: z.string().optional(),
  quantity: z.number().int().positive(),
  deliveryDeadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "deliveryDeadline must be YYYY-MM-DD"),
  deliveryAddress: z.string().optional(),
  deliveryNotes: z.string().optional(),
  spec: z
    .object({
      sizes: z.array(z.string()).optional(),
      gsm: z.number().optional(),
      colours: z.array(z.string()).optional(),
      fabric: z.string().optional(),
      print: z.string().optional(),
    })
    .optional()
    .default({}),
  notes: z.string().optional(),
  referenceFiles: z.array(z.string()).optional(),
  unitPricePaise: z.number().int().positive().optional(),
  targetPricePaise: z.number().int().positive().optional(),
  tenantId: z.string().optional(),
});

export const AdminCreateOrderSchema = ClientSubmitOrderSchema.extend({
  clientId: z.string().min(1, "clientId is required for admin manual entry"),
  unitPricePaise: z.number().int().positive().optional(),
  targetPricePaise: z.number().int().positive().optional(),
  tenantId: z.string().optional(),
});

export const OrderQuerySchema = z.object({
  page: z.union([z.string().regex(/^\d+$/).transform(Number), z.number().int().positive()]).optional(),
  limit: z.union([z.string().regex(/^\d+$/).transform(Number), z.number().int().positive()]).optional(),
  status: z.string().optional(),
  clientId: z.string().optional(),
  productId: z.string().optional(),
  search: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  createdFrom: z.string().optional(),
  createdTo: z.string().optional(),
  deliveryFrom: z.string().optional(),
  deliveryTo: z.string().optional(),
  deadlineFrom: z.string().optional(),
  deadlineTo: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
  tenantId: z.string().optional(),
});

export const OrderUpdateSchema = z.object({
  quantity: z.number().int().positive().optional(),
  deliveryDeadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "deliveryDeadline must be YYYY-MM-DD").optional(),
  deliveryAddress: z.string().optional(),
  deliveryNotes: z.string().optional(),
  productDescription: z.string().optional(),
  productId: z.string().optional(),
  clientId: z.string().optional(),
  spec: z
    .object({
      sizes: z.array(z.string()).optional(),
      gsm: z.number().optional(),
      colours: z.array(z.string()).optional(),
      fabric: z.string().optional(),
      print: z.string().optional(),
    })
    .optional(),
  notes: z.string().optional(),
  referenceFiles: z.array(z.string()).optional(),
  status: z.string().optional(),
  statusReason: z.string().optional(),
  reason: z.string().optional(),
  tenantId: z.string().optional(),
});

export const OrderStageAdvanceSchema = z.object({
  stage: z.string().min(1).trim(),
  producedQty: z.number().nonnegative().optional(),
  percentComplete: z.number().min(0).max(100).optional(),
  notes: z.string().optional(),
});

export const OrderDecisionSchema = z.object({
  decision: z.enum(["proceed", "reject", "alternative"]),
  alternativeId: z.string().optional(),
  purchaseDecision: z.record(z.any()).optional(),
  notes: z.string().optional(),
});

export const OrderApproveQuotationSchema = z.object({
  action: z.enum(["approve", "reject", "recalculate"]).default("approve"),
  editedMarginPercent: z.number().min(0).max(100).optional(),
  editedDeliveryDate: z.string().optional(),
  unitPricePaise: z.number().int().positive().optional(),
  totalPaise: z.number().int().positive().optional(),
  lineItems: z
    .array(
      z.object({
        description: z.string().min(1),
        quantity: z.number().positive(),
        unitPricePaise: z.number().int().positive(),
        totalPaise: z.number().int().positive(),
        category: z.string().optional(),
      })
    )
    .optional(),
  paymentSchedule: z
    .array(
      z.object({
        milestone: z.string(),
        percent: z.number().min(0).max(100),
        amountPaise: z.number().int().nonnegative().optional(),
        trigger: z.enum(["advance", "stage", "delivery"]),
        stage: z.string().optional(),
      })
    )
    .optional(),
  notes: z.string().optional(),
  reason: z.string().optional(),
  recalculateReason: z.enum(["price_surge", "admin_edit", "discount", "date_change"]).optional(),
});

export const ClientAcceptQuotationSchema = z
  .object({
    revisionNo: z.number().int().positive().optional(),
  })
  .optional();

export const ClientDeclineQuotationSchema = z.object({
  revisionNo: z.number().int().positive().optional(),
  reason: z.string().optional(),
});

// ============================================================================
// Phase D Validation Schemas (Handover, Payments, Deliveries)
// ============================================================================

export const OrderAssignSupervisorsSchema = z.object({
  assignments: z
    .array(
      z.object({
        supervisorId: z.string().min(1, "supervisorId is required"),
        processes: z.array(z.string().min(1)).min(1).optional(),
        processArea: z.string().min(1).optional(),
      })
    )
    .min(1, "At least one supervisor assignment is required"),
  overrideReason: z.string().optional(),
  notes: z.string().optional(),
});

export const OrderHoldSchema = z.object({
  reason: z.string().min(1, "reason is required to put an order on hold"),
});

export const OrderCancelSchema = z.object({
  reason: z.string().min(1, "reason is required to cancel an order"),
});

export const OrderCreatePaymentOrderSchema = z.object({
  milestoneIndex: z.number().int().nonnegative().optional(),
  notes: z.record(z.string()).optional(),
});

export const OrderMilestoneParamSchema = z.object({
  id: z.string().min(1),
  milestoneIndex: z.string().regex(/^\d+$/).transform(Number),
});

export const ClientVerifyPaymentSchema = z.object({
  gatewayOrderId: z.string().min(1, "gatewayOrderId is required"),
  paymentId: z.string().min(1, "paymentId is required"),
  signature: z.string().min(1, "signature is required"),
});

export const OrderManualReceiptSchema = z.object({
  milestoneIndex: z.number().int().nonnegative(),
  amountPaise: z.number().int().positive("amountPaise must be positive"),
  method: z.enum(["razorpay", "neft", "rtgs", "upi", "cheque", "cash"]).optional(),
  mode: z.enum(["razorpay", "neft", "rtgs", "upi", "cheque", "cash"]).optional(),
  ref: z.string().min(1, "payment reference is required"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD").optional(),
  notes: z.string().optional(),
});

export const OrderReverseReceiptSchema = z.object({
  milestoneIndex: z.number().int().nonnegative(),
  receiptIndex: z.number().int().nonnegative().optional(),
  receiptRef: z.string().optional(),
  reason: z.string().trim().min(1, "reason is required for payment reversal"),
});

export const OrderDeliverySchema = z.object({
  deliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "deliveryDate must be YYYY-MM-DD"),
  qty: z.number().int().positive("quantity must be positive"),
  invoiceNo: z.string().trim().min(1, "invoiceNo is required"),
  invoiceAmountPaise: z.number().int().positive("invoiceAmountPaise must be positive"),
  carrier: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

// ============================================================================
// Phase 6 Validation Schemas (Production, Reports, Maintenance & Monitoring)
// ============================================================================

export const SupervisorDailyReportSubmitSchema = z.object({
  reportDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "reportDate must be in YYYY-MM-DD format"),
  employeesPresentTotal: z.number().int().nonnegative("employeesPresentTotal must be non-negative"),
  workforce: z
    .array(
      z.object({
        area: z.string().min(1, "area is required"),
        count: z.number().int().nonnegative(),
      })
    )
    .optional(),
  resources: z
    .object({
      machinesAvail: z.number().int().nonnegative(),
      machinesDown: z.number().int().nonnegative().optional().default(0),
    })
    .optional(),
  stockCounts: z
    .array(
      z.object({
        materialId: z.string().min(1),
        qty: z.number().nonnegative(),
      })
    )
    .optional(),
  outputs: z
    .array(
      z.object({
        orderId: z.string().min(1),
        stage: z.string().min(1),
        produced: z.number().int().nonnegative(),
        defective: z.number().int().nonnegative().optional().default(0),
      })
    )
    .optional(),
  machines: z
    .array(
      z.object({
        machineId: z.string().min(1),
        status: z.enum(["available", "maint", "breakdown"]),
        hours: z.number().nonnegative(),
        remarks: z.string().optional(),
      })
    )
    .optional(),
  issues: z
    .array(
      z.object({
        type: z.enum(["machine", "shortage", "delay", "quality", "other"]),
        notes: z.string().min(1),
        machineId: z.string().optional(),
      })
    )
    .optional(),
  clientGeneratedId: z.string().optional(),
  status: z.enum(["draft", "submitted"]).optional().default("submitted"),
});

export const SupervisorDailyReportQuerySchema = paginationQuerySchema.extend({
  reportDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  status: z.enum(["draft", "submitted", "corrected"]).optional(),
  supervisorId: z.string().optional(),
  isLate: z.coerce.boolean().optional(),
});

export const SupervisorDailyReportCorrectionSchema = z.object({
  reason: z.string().min(1, "Correction reason is required"),
  employeesPresentTotal: z.number().int().nonnegative().optional(),
  workforce: z
    .array(
      z.object({
        area: z.string().min(1),
        count: z.number().int().nonnegative(),
      })
    )
    .optional(),
  resources: z
    .object({
      machinesAvail: z.number().int().nonnegative(),
      machinesDown: z.number().int().nonnegative().optional(),
    })
    .optional(),
  outputs: z
    .array(
      z.object({
        orderId: z.string().min(1),
        stage: z.string().min(1),
        produced: z.number().int().nonnegative(),
        defective: z.number().int().nonnegative().optional(),
      })
    )
    .optional(),
  machines: z
    .array(
      z.object({
        machineId: z.string().min(1),
        status: z.enum(["available", "maint", "breakdown"]),
        hours: z.number().nonnegative(),
        remarks: z.string().optional(),
      })
    )
    .optional(),
  issues: z
    .array(
      z.object({
        type: z.enum(["machine", "shortage", "delay", "quality", "other"]),
        notes: z.string().min(1),
        machineId: z.string().optional(),
      })
    )
    .optional(),
});

export const MaintenanceTicketCreateSchema = z.object({
  machineId: z.string().min(1, "machineId is required"),
  sourceReportId: z.string().optional(),
  issue: z.string().min(1, "issue description is required"),
  notes: z.string().optional(),
});

export const MaintenanceTicketUpdateSchema = z.object({
  status: z.enum(["open", "assigned", "resolved"]).optional(),
  technicianName: z.string().optional(),
  technicianContact: z.string().optional(),
  notes: z.string().optional(),
});

export const MaintenanceTicketQuerySchema = paginationQuerySchema.extend({
  machineId: z.string().optional(),
  status: z.enum(["open", "assigned", "resolved"]).optional(),
});

export const SupervisorNotificationQuerySchema = paginationQuerySchema.extend({
  kind: z.enum(["notification", "alert"]).optional(),
  unreadOnly: z.coerce.boolean().optional(),
});

export const StockConsumeSchema = z.object({
  materialId: z.string().min(1, "materialId is required"),
  qty: z.number().positive("qty must be positive"),
  orderId: z.string().min(1, "orderId is required"),
  reason: z.string().optional(),
});

export const PurchaseDecisionCreateSchema = z.object({
  decisionId: z.string().optional(),
  optionId: z.string().optional(),
  materialId: z.string().min(1, "materialId is required"),
  supplierId: z.string().optional(),
  qty: z.number().positive("qty must be positive"),
  ratePaise: z.number().int().positive("ratePaise must be positive integer"),
  expectedArrivalDate: z.string().optional(),
  supplierOrderNo: z.string().optional(),
  notes: z.string().optional(),
});

export const PurchaseRequestDirectCreateSchema = z.object({
  orderId: z.string().min(1, "orderId is required"),
  materialId: z.string().min(1, "materialId is required"),
  qty: z.number().positive("qty must be positive"),
  ratePaise: z.number().int().positive("ratePaise must be positive integer").optional(),
  supplierId: z.string().optional(),
  decisionId: z.string().optional(),
  optionId: z.string().optional(),
  expectedArrivalDate: z.string().optional(),
  supplierOrderNo: z.string().optional(),
  notes: z.string().optional(),
});

export const PurchaseDecisionUpdateSchema = z.object({
  expectedArrivalDate: z.string().optional(),
  status: z.enum(["ordered", "cancelled", "approved", "rejected"]).optional(),
  action: z.enum(["approve", "reject"]).optional(),
  reason: z.string().optional(),
  notes: z.string().optional(),
  orderId: z.string().optional(),
});

export const PurchaseDecisionQuerySchema = paginationQuerySchema.extend({
  status: z.enum(["ordered", "partially_received", "received", "cancelled"]).optional(),
  materialId: z.string().optional(),
  supplierId: z.string().optional(),
  orderId: z.string().optional(),
  search: z.string().optional(),
});

export const StockMovementQuerySchema = paginationQuerySchema.extend({
  materialId: z.string().optional(),
  orderId: z.string().optional(),
  type: z.enum(["receipt", "consume", "reserve", "release", "adjust", "opening"]).optional(),
});

export const StockBalancesQuerySchema = paginationQuerySchema.extend({
  type: z.enum(["yarn", "fabric", "dye_chemical", "trim", "packing"]).optional(),
  search: z.string().optional(),
});

export const DateRangeQuerySchema = z.object({
  dateFrom: z.string().trim().optional(),
  dateTo: z.string().trim().optional(),
  clientId: z.string().trim().optional(),
});

export const AuditQuerySchema = paginationQuerySchema.extend({
  entity: z.string().trim().optional(),
  actorId: z.string().trim().optional(),
  actorType: z.enum(["user", "client", "agent", "system"]).optional(),
  action: z.string().trim().optional(),
  dateFrom: z.string().trim().optional(),
  dateTo: z.string().trim().optional(),
});

