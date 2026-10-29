import { UserRole, MaterialType, StockMovementType, ProcessName, OrderStatus, QuotationStatus, DeliveryStatus, PaymentStatus, ReminderStatus, AlertType, AlertSeverity, RecommendationStatus, NotificationChannel } from "@loompilot/shared";

/**
 * Reusable OpenAPI 3.0.3 Schemas for LoomPilot Backend
 */
export const openapiSchemas = {
  // ==========================================
  // Envelopes & Common
  // ==========================================
  RequestId: {
    type: "string",
    format: "uuid",
    example: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    description: "Unique request tracing identifier assigned by requestIdMiddleware.",
  },

  PaginationMeta: {
    type: "object",
    required: ["total", "page", "limit"],
    properties: {
      total: { type: "integer", minimum: 0, example: 42, description: "Total number of matching records in tenant" },
      page: { type: "integer", minimum: 1, example: 1, description: "Current page index (1-based)" },
      limit: { type: "integer", minimum: 1, maximum: 100, example: 20, description: "Records returned per page" },
    },
  },

  StandardError: {
    type: "object",
    required: ["error", "message", "requestId"],
    properties: {
      error: { type: "string", example: "NotFoundError", description: "Standardized error code or error class name" },
      message: { type: "string", example: "Customer with ID 65e0a1b2c3d4e5f6a7b8c901 not found", description: "Human-readable failure explanation" },
      requestId: { $ref: "#/components/schemas/RequestId" },
      stack: { type: "string", description: "Stack trace emitted exclusively in development mode" },
    },
  },

  ValidationError: {
    type: "object",
    required: ["error", "message", "details", "requestId"],
    properties: {
      error: { type: "string", example: "ValidationError" },
      message: { type: "string", example: "Request validation failed" },
      details: {
        type: "array",
        items: {
          type: "object",
          properties: {
            code: { type: "string", example: "invalid_type" },
            expected: { type: "string", example: "string" },
            received: { type: "string", example: "undefined" },
            path: { type: "array", items: { type: "string" }, example: ["name"] },
            message: { type: "string", example: "Required" },
          },
        },
      },
      requestId: { $ref: "#/components/schemas/RequestId" },
    },
  },

  // ==========================================
  // Auth & User
  // ==========================================
  UserRole: {
    type: "string",
    enum: Object.values(UserRole),
    example: UserRole.OWNER,
    description: "Role-Based Access Control identifier (owner, manager, sales, store, accounts)",
  },

  User: {
    type: "object",
    required: ["id", "email", "name", "role", "tenantId", "isActive"],
    properties: {
      id: { type: "string", example: "65e0a1b2c3d4e5f6a7b8c001" },
      email: { type: "string", format: "email", example: "anand@loompilot.test" },
      name: { type: "string", example: "Anand Textiles Owner" },
      role: { $ref: "#/components/schemas/UserRole" },
      tenantId: { type: "string", example: "tenant_default" },
      isActive: { type: "boolean", example: true },
      createdAt: { type: "string", format: "date-time", example: "2026-10-28T12:00:00.000Z" },
      updatedAt: { type: "string", format: "date-time", example: "2026-10-28T12:00:00.000Z" },
    },
  },

  LoginRequest: {
    type: "object",
    required: ["email", "password", "tenantId"],
    properties: {
      email: { type: "string", format: "email", example: "owner@loompilot.test" },
      password: { type: "string", format: "password", example: "password123" },
      tenantId: { type: "string", example: "tenant_default", description: "Multi-tenant workspace organization slug" },
    },
  },

  LoginResponse: {
    type: "object",
    required: ["accessToken", "user"],
    properties: {
      accessToken: { type: "string", example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...", description: "Short-lived JWT (1h) containing userId, email, role, and tenantId" },
      user: { $ref: "#/components/schemas/User" },
    },
  },

  RegisterUserRequest: {
    type: "object",
    required: ["email", "password", "name", "role", "tenantId"],
    properties: {
      email: { type: "string", format: "email", example: "manager@loompilot.test" },
      password: { type: "string", format: "password", minLength: 6, example: "securePass123!" },
      name: { type: "string", example: "Production Manager" },
      role: { $ref: "#/components/schemas/UserRole" },
      tenantId: { type: "string", example: "tenant_default" },
    },
  },

  RefreshTokenRequest: {
    type: "object",
    properties: {
      refreshToken: {
        type: "string",
        example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        description: "Optional in request body if delivered via HTTP-only cookie 'loompilot_refresh_token'",
      },
    },
  },

  AuthMeResponse: {
    type: "object",
    required: ["userId", "email", "role", "tenantId"],
    properties: {
      userId: { type: "string", example: "65e0a1b2c3d4e5f6a7b8c001" },
      email: { type: "string", format: "email", example: "owner@loompilot.test" },
      role: { $ref: "#/components/schemas/UserRole" },
      tenantId: { type: "string", example: "tenant_default" },
    },
  },

  // ==========================================
  // Customers & Suppliers
  // ==========================================
  Customer: {
    type: "object",
    required: ["id", "tenantId", "name", "code", "contactPerson", "email", "phone", "creditPeriodDays"],
    properties: {
      id: { type: "string", example: "65e0a1b2c3d4e5f6a7b8c101" },
      tenantId: { type: "string", example: "tenant_default" },
      name: { type: "string", example: "Heritage Silks Pvt Ltd" },
      code: { type: "string", example: "CUST-001" },
      contactPerson: { type: "string", example: "Suresh Pillai" },
      email: { type: "string", format: "email", example: "orders@heritagesilks.in" },
      phone: { type: "string", example: "+91 98401 12345" },
      address: { type: "string", example: "45 Weaver's Lane, Salem, Tamil Nadu" },
      creditPeriodDays: { type: "integer", example: 30 },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
  },

  CreateCustomerRequest: {
    type: "object",
    required: ["name", "code", "contactPerson", "email", "phone"],
    properties: {
      name: { type: "string", example: "Heritage Silks Pvt Ltd" },
      code: { type: "string", example: "CUST-001" },
      contactPerson: { type: "string", example: "Suresh Pillai" },
      email: { type: "string", format: "email", example: "orders@heritagesilks.in" },
      phone: { type: "string", example: "+91 98401 12345" },
      address: { type: "string", example: "45 Weaver's Lane, Salem, Tamil Nadu" },
      creditPeriodDays: { type: "integer", default: 30, example: 30 },
    },
  },

  Supplier: {
    type: "object",
    required: ["id", "tenantId", "name", "contactPerson", "email", "phone", "leadTimeDays", "rating", "suppliedMaterials"],
    properties: {
      id: { type: "string", example: "65e0a1b2c3d4e5f6a7b8c201" },
      tenantId: { type: "string", example: "tenant_default" },
      name: { type: "string", example: "Surat Yarn Mills" },
      contactPerson: { type: "string", example: "Rajesh Shah" },
      email: { type: "string", format: "email", example: "sales@suratyarn.in" },
      phone: { type: "string", example: "+91 98250 11223" },
      leadTimeDays: { type: "integer", example: 7, description: "Average supplier shipment lead time in calendar days" },
      rating: { type: "number", minimum: 1, maximum: 5, example: 4.8 },
      suppliedMaterials: { type: "array", items: { type: "string" }, example: ["65e0a1b2c3d4e5f6a7b8c301"] },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
  },

  CreateSupplierRequest: {
    type: "object",
    required: ["name", "contactPerson", "email", "phone", "leadTimeDays"],
    properties: {
      name: { type: "string", example: "Surat Yarn Mills" },
      contactPerson: { type: "string", example: "Rajesh Shah" },
      email: { type: "string", format: "email", example: "sales@suratyarn.in" },
      phone: { type: "string", example: "+91 98250 11223" },
      leadTimeDays: { type: "integer", default: 7, example: 7 },
      rating: { type: "number", minimum: 1, maximum: 5, default: 4.5, example: 4.8 },
      suppliedMaterials: { type: "array", items: { type: "string" } },
    },
  },

  // ==========================================
  // Enquiries
  // ==========================================
  EnquiryParsedRequirements: {
    type: "object",
    properties: {
      productName: { type: "string", example: "Cotton Voile 60s" },
      quantity: { type: "number", example: 5000 },
      unit: { type: "string", example: "meters" },
      targetDeliveryDate: { type: "string", format: "date", example: "2026-11-30" },
      specialInstructions: { type: "string", example: "Enzyme washed, soft finish" },
    },
  },

  Enquiry: {
    type: "object",
    required: ["id", "tenantId", "enquiryNumber", "customerId", "customerName", "rawText", "status"],
    properties: {
      id: { type: "string", example: "65e0a1b2c3d4e5f6a7b8c401" },
      tenantId: { type: "string", example: "tenant_default" },
      enquiryNumber: { type: "string", example: "ENQ-00001" },
      customerId: { type: "string", example: "65e0a1b2c3d4e5f6a7b8c101" },
      customerName: { type: "string", example: "Heritage Silks Pvt Ltd" },
      rawText: { type: "string", example: "Need 5000 meters of 60s cotton voile by Nov end. Please quote rates." },
      parsedRequirements: { $ref: "#/components/schemas/EnquiryParsedRequirements" },
      status: { type: "string", enum: ["new", "processing", "quoted", "closed"], example: "new" },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
  },

  CreateEnquiryRequest: {
    type: "object",
    required: ["customerId", "customerName", "rawText"],
    properties: {
      customerId: { type: "string", example: "65e0a1b2c3d4e5f6a7b8c101" },
      customerName: { type: "string", example: "Heritage Silks Pvt Ltd" },
      rawText: { type: "string", example: "Need 5000 meters of 60s cotton voile by Nov end. Please quote rates." },
      parsedRequirements: { $ref: "#/components/schemas/EnquiryParsedRequirements" },
    },
  },

  // ==========================================
  // Materials & Inventory
  // ==========================================
  MaterialType: {
    type: "string",
    enum: Object.values(MaterialType),
    example: MaterialType.YARN,
    description: "Raw material classification category",
  },

  Material: {
    type: "object",
    required: ["id", "tenantId", "code", "name", "type", "unit", "onHandQuantity", "reservedQuantity", "reorderLevel"],
    properties: {
      id: { type: "string", example: "65e0a1b2c3d4e5f6a7b8c301" },
      tenantId: { type: "string", example: "tenant_default" },
      code: { type: "string", example: "MAT-YRN-40S" },
      name: { type: "string", example: "Cotton Yarn 40s Combed" },
      type: { $ref: "#/components/schemas/MaterialType" },
      unit: { type: "string", example: "kg" },
      currentRatePaise: { type: "integer", example: 28000, description: "Current purchase rate in integer paise (Rs 280.00). Hidden from store role." },
      avgCostPaise: { type: "integer", example: 27500, description: "Weighted average inventory cost in integer paise. Hidden from store role." },
      onHandQuantity: { type: "number", example: 800 },
      reservedQuantity: { type: "number", example: 200 },
      reorderLevel: { type: "number", example: 400 },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
  },

  CreateMaterialRequest: {
    type: "object",
    required: ["code", "name", "type", "unit", "currentRatePaise", "avgCostPaise"],
    properties: {
      code: { type: "string", example: "MAT-YRN-40S" },
      name: { type: "string", example: "Cotton Yarn 40s Combed" },
      type: { $ref: "#/components/schemas/MaterialType" },
      unit: { type: "string", example: "kg" },
      currentRatePaise: { type: "integer", minimum: 0, example: 28000, description: "Integer paise (e.g. 28000 = Rs 280.00)" },
      avgCostPaise: { type: "integer", minimum: 0, example: 27500 },
      onHandQuantity: { type: "number", default: 0, example: 500 },
      reorderLevel: { type: "number", default: 0, example: 200 },
    },
  },

  StockMovement: {
    type: "object",
    required: ["id", "tenantId", "materialId", "type", "quantity", "previousBalance", "newBalance", "referenceType"],
    properties: {
      id: { type: "string", example: "65e0a1b2c3d4e5f6a7b8c350" },
      tenantId: { type: "string", example: "tenant_default" },
      materialId: { type: "string", example: "65e0a1b2c3d4e5f6a7b8c301" },
      type: { type: "string", enum: Object.values(StockMovementType), example: StockMovementType.RECEIPT },
      quantity: { type: "number", example: 300 },
      previousBalance: { type: "number", example: 500 },
      newBalance: { type: "number", example: 800 },
      referenceType: { type: "string", enum: ["receipt", "order_issue", "reservation", "adjustment"], example: "receipt" },
      referenceId: { type: "string", example: "PO-2026-0042" },
      notes: { type: "string", example: "Received from Surat Yarn Mills" },
      createdAt: { type: "string", format: "date-time" },
    },
  },

  RecordMovementRequest: {
    type: "object",
    required: ["type", "quantity", "referenceType"],
    properties: {
      type: { type: "string", enum: Object.values(StockMovementType), example: StockMovementType.RECEIPT },
      quantity: { type: "number", minimum: 0.01, example: 300 },
      referenceType: { type: "string", enum: ["receipt", "order_issue", "reservation", "adjustment"], example: "receipt" },
      referenceId: { type: "string", example: "PO-2026-0042" },
      notes: { type: "string", example: "Inward shipment inspection approved" },
    },
  },

  PriceHistory: {
    type: "object",
    required: ["id", "tenantId", "materialId", "date", "ratePaise", "source"],
    properties: {
      id: { type: "string", example: "65e0a1b2c3d4e5f6a7b8c380" },
      tenantId: { type: "string", example: "tenant_default" },
      materialId: { type: "string", example: "65e0a1b2c3d4e5f6a7b8c301" },
      date: { type: "string", format: "date", example: "2026-10-15" },
      ratePaise: { type: "integer", example: 28000 },
      source: { type: "string", example: "Surat Yarn Mills invoice INV-9921" },
      createdAt: { type: "string", format: "date-time" },
    },
  },

  // ==========================================
  // Processes & Workforce
  // ==========================================
  Process: {
    type: "object",
    required: ["id", "tenantId", "name", "sequence", "standardWastagePct", "avgOutputPerWorkerHour", "unit"],
    properties: {
      id: { type: "string", example: "65e0a1b2c3d4e5f6a7b8c501" },
      tenantId: { type: "string", example: "tenant_default" },
      name: { type: "string", enum: Object.values(ProcessName), example: ProcessName.WEAVING },
      sequence: { type: "integer", example: 3 },
      standardWastagePct: { type: "number", example: 2.5, description: "Historical benchmark wastage allowance percentage" },
      avgOutputPerWorkerHour: { type: "number", example: 12.5, description: "Standard worker productivity metric per hour" },
      unit: { type: "string", example: "meters" },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
  },

  CreateProcessRequest: {
    type: "object",
    required: ["name", "sequence"],
    properties: {
      name: { type: "string", enum: Object.values(ProcessName), example: ProcessName.WEAVING },
      sequence: { type: "integer", minimum: 1, example: 3 },
      standardWastagePct: { type: "number", default: 2.0, example: 2.5 },
      avgOutputPerWorkerHour: { type: "number", default: 10, example: 12.5 },
      unit: { type: "string", default: "meters", example: "meters" },
    },
  },

  Worker: {
    type: "object",
    required: ["id", "tenantId", "workerCode", "name", "skillLevel", "hourlyRatePaise", "active"],
    properties: {
      id: { type: "string", example: "65e0a1b2c3d4e5f6a7b8c601" },
      tenantId: { type: "string", example: "tenant_default" },
      workerCode: { type: "string", example: "WRK-001" },
      name: { type: "string", example: "Murugan P." },
      skillLevel: { type: "string", enum: ["unskilled", "semi_skilled", "skilled"], example: "skilled" },
      hourlyRatePaise: { type: "integer", example: 12000, description: "Base pay rate in integer paise (Rs 120.00/hr)" },
      assignedProcessId: { type: "string", example: "65e0a1b2c3d4e5f6a7b8c501" },
      active: { type: "boolean", example: true },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
  },

  CreateWorkerRequest: {
    type: "object",
    required: ["workerCode", "name"],
    properties: {
      workerCode: { type: "string", example: "WRK-001" },
      name: { type: "string", example: "Murugan P." },
      skillLevel: { type: "string", enum: ["unskilled", "semi_skilled", "skilled"], default: "semi_skilled", example: "skilled" },
      hourlyRatePaise: { type: "integer", default: 12000, example: 12000 },
      assignedProcessId: { type: "string" },
    },
  },

  AttendanceRecord: {
    type: "object",
    required: ["id", "tenantId", "workerId", "date", "isPresent", "hoursWorked"],
    properties: {
      id: { type: "string", example: "65e0a1b2c3d4e5f6a7b8c650" },
      tenantId: { type: "string", example: "tenant_default" },
      workerId: { type: "string", example: "65e0a1b2c3d4e5f6a7b8c601" },
      date: { type: "string", format: "date", example: "2026-10-28" },
      isPresent: { type: "boolean", example: true },
      hoursWorked: { type: "number", minimum: 0, maximum: 24, example: 8 },
      createdAt: { type: "string", format: "date-time" },
    },
  },

  RecordAttendanceRequest: {
    type: "object",
    required: ["records"],
    properties: {
      records: {
        type: "array",
        items: {
          type: "object",
          required: ["workerId", "date", "isPresent"],
          properties: {
            workerId: { type: "string", example: "65e0a1b2c3d4e5f6a7b8c601" },
            date: { type: "string", format: "date", example: "2026-10-28" },
            isPresent: { type: "boolean", example: true },
            hoursWorked: { type: "number", default: 8, example: 8 },
          },
        },
      },
    },
  },

  DailyOutput: {
    type: "object",
    required: ["id", "tenantId", "orderId", "processId", "date", "quantityProduced", "quantityDefective", "idempotencyKey"],
    properties: {
      id: { type: "string", example: "65e0a1b2c3d4e5f6a7b8c680" },
      tenantId: { type: "string", example: "tenant_default" },
      orderId: { type: "string", example: "65e0a1b2c3d4e5f6a7b8c701" },
      processId: { type: "string", example: "65e0a1b2c3d4e5f6a7b8c501" },
      date: { type: "string", format: "date", example: "2026-10-28" },
      quantityProduced: { type: "number", example: 250 },
      quantityDefective: { type: "number", example: 5 },
      operatorId: { type: "string", example: "WRK-001" },
      notes: { type: "string", example: "Loom 4 running at peak capacity" },
      idempotencyKey: { type: "string", example: "daily_out_ord701_proc501_20261028" },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
  },

  RecordDailyOutputRequest: {
    type: "object",
    required: ["orderId", "processId", "date", "quantityProduced", "idempotencyKey"],
    properties: {
      orderId: { type: "string", example: "65e0a1b2c3d4e5f6a7b8c701" },
      processId: { type: "string", example: "65e0a1b2c3d4e5f6a7b8c501" },
      date: { type: "string", format: "date", example: "2026-10-28" },
      quantityProduced: { type: "number", minimum: 0, example: 250 },
      quantityDefective: { type: "number", default: 0, example: 5 },
      operatorId: { type: "string", example: "WRK-001" },
      notes: { type: "string", example: "Shift A production complete" },
      idempotencyKey: {
        type: "string",
        example: "daily_out_ord701_proc501_20261028",
        description: "Strict unique idempotency key. Submitting identical key returns existing record without duplicate key error.",
      },
    },
  },

  // ==========================================
  // Quotations
  // ==========================================
  QuotationLineItem: {
    type: "object",
    required: ["materialId", "materialName", "requiredQty", "unit", "onHandQty", "reservedQty", "toPurchaseQty", "unitCostPaise", "totalCostPaise", "supplierLeadDays"],
    properties: {
      materialId: { type: "string", example: "65e0a1b2c3d4e5f6a7b8c301" },
      materialName: { type: "string", example: "Cotton Yarn 40s Combed" },
      requiredQty: { type: "number", example: 500 },
      unit: { type: "string", example: "kg" },
      onHandQty: { type: "number", example: 200 },
      reservedQty: { type: "number", example: 0 },
      toPurchaseQty: { type: "number", example: 300 },
      unitCostPaise: { type: "integer", example: 28000, description: "Integer paise. Hidden from store role." },
      totalCostPaise: { type: "integer", example: 14000000, description: "Integer paise. Hidden from store role." },
      supplierLeadDays: { type: "integer", example: 7 },
    },
  },

  Quotation: {
    type: "object",
    required: ["id", "tenantId", "enquiryId", "customerId", "quotationNumber", "lineItems", "finalPricePaise", "etaDate", "validUntil", "status"],
    properties: {
      id: { type: "string", example: "65e0a1b2c3d4e5f6a7b8c801" },
      tenantId: { type: "string", example: "tenant_default" },
      enquiryId: { type: "string", example: "65e0a1b2c3d4e5f6a7b8c401" },
      customerId: { type: "string", example: "65e0a1b2c3d4e5f6a7b8c101" },
      quotationNumber: { type: "string", example: "QT-00001" },
      lineItems: { type: "array", items: { $ref: "#/components/schemas/QuotationLineItem" } },
      materialCostPaise: { type: "integer", example: 14000000, description: "Hidden from store role." },
      processingCostPaise: { type: "integer", example: 2000000, description: "Hidden from store role." },
      overheadCostPaise: { type: "integer", example: 1000000, description: "Hidden from store role." },
      wastagePct: { type: "number", example: 2.5 },
      wastageCostPaise: { type: "integer", example: 425000, description: "Hidden from store role." },
      riskBufferPct: { type: "number", example: 5.0 },
      riskBufferCostPaise: { type: "integer", example: 850000, description: "Hidden from store role." },
      subtotalCostPaise: { type: "integer", example: 18275000, description: "Hidden from store role." },
      marginPct: { type: "number", example: 15.0, description: "Hidden from store role." },
      profitPaise: { type: "integer", example: 3225000, description: "Hidden from store role." },
      finalPricePaise: { type: "integer", example: 21500000, description: "Total itemized price in paise (Rs 2,15,000.00)" },
      etaDate: { type: "string", format: "date", example: "2026-11-20" },
      validUntil: { type: "string", format: "date", example: "2026-11-05" },
      status: { type: "string", enum: Object.values(QuotationStatus), example: QuotationStatus.DRAFT },
      explanation: { type: "string", example: "Quotation generated with 2.5% wastage buffer and 7-day supplier lead time." },
      assumptions: { type: "array", items: { type: "string" }, example: ["Yarn rates locked for 10 days", "Normal 8-hour loom shifts"] },
      generationError: { type: "string", example: "Agents client not connected. Ready for user retry in Stage 4." },
      approvedBy: { type: "string", example: "65e0a1b2c3d4e5f6a7b8c001" },
      approvedAt: { type: "string", format: "date-time" },
      sentAt: { type: "string", format: "date-time" },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
  },

  RequestQuotationDraftRequest: {
    type: "object",
    required: ["enquiryId"],
    properties: {
      enquiryId: { type: "string", example: "65e0a1b2c3d4e5f6a7b8c401" },
    },
  },

  RecalculateQuotationRequest: {
    type: "object",
    properties: {
      lineItems: { type: "array", items: { $ref: "#/components/schemas/QuotationLineItem" } },
      marginPct: { type: "number", example: 18.0 },
      assumptions: { type: "array", items: { type: "string" } },
    },
  },

  // ==========================================
  // Production Orders
  // ==========================================
  ProcessPlanStep: {
    type: "object",
    required: ["processId", "processName", "sequence", "targetQty", "dailyTarget", "startDate", "endDate", "completedQty"],
    properties: {
      processId: { type: "string", example: "65e0a1b2c3d4e5f6a7b8c501" },
      processName: { type: "string", enum: Object.values(ProcessName), example: ProcessName.WEAVING },
      sequence: { type: "integer", example: 3 },
      targetQty: { type: "number", example: 5000 },
      dailyTarget: { type: "number", example: 1000 },
      startDate: { type: "string", format: "date", example: "2026-11-10" },
      endDate: { type: "string", format: "date", example: "2026-11-15" },
      completedQty: { type: "number", example: 2450 },
    },
  },

  ProductionOrder: {
    type: "object",
    required: ["id", "tenantId", "quotationId", "customerId", "orderNumber", "productName", "totalQuantity", "unit", "status", "startDate", "targetDeliveryDate", "plan"],
    properties: {
      id: { type: "string", example: "65e0a1b2c3d4e5f6a7b8c701" },
      tenantId: { type: "string", example: "tenant_default" },
      quotationId: { type: "string", example: "65e0a1b2c3d4e5f6a7b8c801" },
      customerId: { type: "string", example: "65e0a1b2c3d4e5f6a7b8c101" },
      orderNumber: { type: "string", example: "ORD-00001" },
      productName: { type: "string", example: "Cotton Voile 60s" },
      totalQuantity: { type: "number", example: 5000 },
      unit: { type: "string", example: "meters" },
      status: { type: "string", enum: Object.values(OrderStatus), example: OrderStatus.PLANNED },
      startDate: { type: "string", format: "date", example: "2026-11-01" },
      targetDeliveryDate: { type: "string", format: "date", example: "2026-11-20" },
      actualDeliveryDate: { type: "string", format: "date", example: "2026-11-19" },
      plan: { type: "array", items: { $ref: "#/components/schemas/ProcessPlanStep" } },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
  },

  OrderVarianceReport: {
    type: "object",
    required: ["orderId", "orderNumber", "totalQuantity", "status", "varianceData"],
    properties: {
      orderId: { type: "string", example: "65e0a1b2c3d4e5f6a7b8c701" },
      orderNumber: { type: "string", example: "ORD-00001" },
      totalQuantity: { type: "number", example: 5000 },
      status: { type: "string", enum: Object.values(OrderStatus), example: OrderStatus.PLANNED },
      varianceData: {
        type: "array",
        items: {
          type: "object",
          required: ["processName", "targetDate", "plannedQty", "actualQty", "deficitQty", "isBehind"],
          properties: {
            processName: { type: "string", example: "Weaving" },
            targetDate: { type: "string", format: "date", example: "2026-11-15" },
            plannedQty: { type: "number", example: 5000 },
            actualQty: { type: "number", example: 4200 },
            deficitQty: { type: "number", example: 800 },
            isBehind: { type: "boolean", example: true },
          },
        },
      },
    },
  },

  // ==========================================
  // Deliveries & Payments
  // ==========================================
  Delivery: {
    type: "object",
    required: ["id", "tenantId", "orderId", "customerId", "deliveryNumber", "deliveredQuantity", "deliveryDate", "status", "isOnTime", "invoiceNumber", "totalInvoicePaise"],
    properties: {
      id: { type: "string", example: "65e0a1b2c3d4e5f6a7b8c901" },
      tenantId: { type: "string", example: "tenant_default" },
      orderId: { type: "string", example: "65e0a1b2c3d4e5f6a7b8c701" },
      customerId: { type: "string", example: "65e0a1b2c3d4e5f6a7b8c101" },
      deliveryNumber: { type: "string", example: "DEL-00001" },
      deliveredQuantity: { type: "number", example: 5000 },
      deliveryDate: { type: "string", format: "date", example: "2026-11-19" },
      status: { type: "string", enum: Object.values(DeliveryStatus), example: DeliveryStatus.DELIVERED },
      isOnTime: { type: "boolean", example: true, description: "True if deliveryDate <= order.targetDeliveryDate" },
      invoiceNumber: { type: "string", example: "INV-2026-0001" },
      totalInvoicePaise: { type: "integer", example: 21500000, description: "Total invoice in integer paise" },
      receivedBy: { type: "string", example: "R. Sharma (Store Manager)" },
      notes: { type: "string", example: "Delivered in full, no transit defects" },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
  },

  RecordDeliveryRequest: {
    type: "object",
    required: ["orderId", "customerId", "deliveredQuantity", "totalInvoicePaise"],
    properties: {
      orderId: { type: "string", example: "65e0a1b2c3d4e5f6a7b8c701" },
      customerId: { type: "string", example: "65e0a1b2c3d4e5f6a7b8c101" },
      deliveredQuantity: { type: "number", minimum: 1, example: 5000 },
      deliveryDate: { type: "string", format: "date", example: "2026-11-19", description: "Defaults to today if omitted" },
      totalInvoicePaise: { type: "integer", minimum: 0, example: 21500000 },
      receivedBy: { type: "string", example: "R. Sharma" },
      notes: { type: "string", example: "Received in good condition" },
    },
  },

  PaymentReminder: {
    type: "object",
    required: ["id", "reminderNumber", "channel", "recipient", "messageBody", "scheduledDate", "status"],
    properties: {
      id: { type: "string", example: "65e0a1b2c3d4e5f6a7b8c950" },
      reminderNumber: { type: "integer", example: 1 },
      channel: { type: "string", enum: Object.values(NotificationChannel), example: NotificationChannel.EMAIL },
      recipient: { type: "string", example: "accounts@heritagesilks.in" },
      subject: { type: "string", example: "Payment Reminder: Invoice INV-2026-0001 Due Soon" },
      messageBody: { type: "string", example: "Dear Heritage Silks, your payment for invoice INV-2026-0001 is due on 2026-12-19." },
      scheduledDate: { type: "string", format: "date", example: "2026-12-15" },
      status: { type: "string", enum: Object.values(ReminderStatus), example: ReminderStatus.DRAFT },
      approvedBy: { type: "string", example: "65e0a1b2c3d4e5f6a7b8c004" },
      approvedAt: { type: "string", format: "date-time" },
      sentAt: { type: "string", format: "date-time" },
      failureReason: { type: "string" },
    },
  },

  Payment: {
    type: "object",
    required: ["id", "tenantId", "deliveryId", "orderId", "customerId", "invoiceNumber", "totalInvoicePaise", "amountReceivedPaise", "balancePaise", "dueDate", "status", "paymentTerms", "reminders"],
    properties: {
      id: { type: "string", example: "65e0a1b2c3d4e5f6a7b8c920" },
      tenantId: { type: "string", example: "tenant_default" },
      deliveryId: { type: "string", example: "65e0a1b2c3d4e5f6a7b8c901" },
      orderId: { type: "string", example: "65e0a1b2c3d4e5f6a7b8c701" },
      customerId: { type: "string", example: "65e0a1b2c3d4e5f6a7b8c101" },
      invoiceNumber: { type: "string", example: "INV-2026-0001" },
      totalInvoicePaise: { type: "integer", example: 21500000 },
      amountReceivedPaise: { type: "integer", example: 10000000 },
      balancePaise: { type: "integer", example: 11500000 },
      dueDate: { type: "string", format: "date", example: "2026-12-19" },
      status: { type: "string", enum: Object.values(PaymentStatus), example: PaymentStatus.PARTIAL },
      paymentTerms: { type: "string", example: "Net 30" },
      reminders: { type: "array", items: { $ref: "#/components/schemas/PaymentReminder" } },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
  },

  ApproveReminderRequest: {
    type: "object",
    required: ["action"],
    properties: {
      action: { type: "string", enum: ["approve", "reject"], example: "approve" },
      rejectionReason: { type: "string", example: "Customer requested extension till next week" },
    },
  },

  RecordReceiptRequest: {
    type: "object",
    required: ["amountPaise"],
    properties: {
      amountPaise: { type: "integer", minimum: 1, example: 5000000, description: "Payment receipt amount in integer paise (Rs 50,000.00)" },
    },
  },

  // ==========================================
  // Alerts & Recommendations
  // ==========================================
  AlertMetrics: {
    type: "object",
    required: ["requiredDaily", "actualRate", "deficitQty", "delayDaysEstimated"],
    properties: {
      requiredDaily: { type: "number", example: 200 },
      actualRate: { type: "number", example: 120 },
      deficitQty: { type: "number", example: 80 },
      delayDaysEstimated: { type: "number", example: 2.5 },
    },
  },

  Alert: {
    type: "object",
    required: ["id", "tenantId", "orderId", "processId", "date", "type", "severity", "title", "message", "metrics", "isAcknowledged"],
    properties: {
      id: { type: "string", example: "65e0a1b2c3d4e5f6a7b8ca01" },
      tenantId: { type: "string", example: "tenant_default" },
      orderId: { type: "string", example: "65e0a1b2c3d4e5f6a7b8c701" },
      processId: { type: "string", example: "65e0a1b2c3d4e5f6a7b8c501" },
      date: { type: "string", format: "date", example: "2026-10-28" },
      type: { type: "string", enum: Object.values(AlertType), example: AlertType.DELAY_WARNING },
      severity: { type: "string", enum: Object.values(AlertSeverity), example: AlertSeverity.HIGH },
      title: { type: "string", example: "Weaving Output Deficit" },
      message: { type: "string", example: "Weaving output fell short by 80 meters today." },
      metrics: { $ref: "#/components/schemas/AlertMetrics" },
      isAcknowledged: { type: "boolean", example: false },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
  },

  RecoveryOption: {
    type: "object",
    required: ["id", "title", "description", "additionalCostPaise"],
    properties: {
      id: { type: "string", example: "opt-1" },
      title: { type: "string", example: "Allocate 2 Additional Weavers" },
      description: { type: "string", example: "Assign Murugan P. and Karthik R. to second shift to recover 80m deficit" },
      extraWorkersNeeded: { type: "integer", example: 2 },
      revisedDailyTarget: { type: "number", example: 280 },
      projectedCatchupDays: { type: "number", example: 2 },
      additionalCostPaise: { type: "integer", example: 48000, description: "Additional labour cost in integer paise (Rs 480.00)" },
    },
  },

  Recommendation: {
    type: "object",
    required: ["id", "tenantId", "alertId", "orderId", "status", "title", "explanation", "options"],
    properties: {
      id: { type: "string", example: "65e0a1b2c3d4e5f6a7b8cb01" },
      tenantId: { type: "string", example: "tenant_default" },
      alertId: { type: "string", example: "65e0a1b2c3d4e5f6a7b8ca01" },
      orderId: { type: "string", example: "65e0a1b2c3d4e5f6a7b8c701" },
      status: { type: "string", enum: Object.values(RecommendationStatus), example: RecommendationStatus.PROPOSED },
      title: { type: "string", example: "Weaving Recovery Recommendations" },
      explanation: { type: "string", example: "Adding 2 weavers for 2 days recovers the deficit with minimum cost overhead." },
      options: { type: "array", items: { $ref: "#/components/schemas/RecoveryOption" } },
      selectedOptionId: { type: "string", example: "opt-1" },
      decidedBy: { type: "string", example: "65e0a1b2c3d4e5f6a7b8c001" },
      decidedAt: { type: "string", format: "date-time" },
      rejectionReason: { type: "string" },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
  },

  DecideRecommendationRequest: {
    type: "object",
    required: ["action"],
    properties: {
      action: { type: "string", enum: ["accept", "reject"], example: "accept" },
      selectedOptionId: { type: "string", example: "opt-1", description: "Required if action is accept" },
      rejectionReason: { type: "string", example: "Will catch up on Saturday regular shift" },
    },
  },

  // ==========================================
  // Reports
  // ==========================================
  MarginReport: {
    type: "object",
    required: ["tenantId", "totalRevenuePaise", "totalCostPaise", "grossMarginPaise", "grossMarginPct", "orderBreakdown"],
    properties: {
      tenantId: { type: "string", example: "tenant_default" },
      totalRevenuePaise: { type: "integer", example: 45000000 },
      totalCostPaise: { type: "integer", example: 38250000 },
      grossMarginPaise: { type: "integer", example: 6750000 },
      grossMarginPct: { type: "number", example: 15.0 },
      orderBreakdown: {
        type: "array",
        items: {
          type: "object",
          required: ["quotationId", "quotationNumber", "revenuePaise", "costPaise", "marginPaise", "marginPct"],
          properties: {
            quotationId: { type: "string", example: "65e0a1b2c3d4e5f6a7b8c801" },
            quotationNumber: { type: "string", example: "QT-00001" },
            revenuePaise: { type: "integer", example: 21500000 },
            costPaise: { type: "integer", example: 18275000 },
            marginPaise: { type: "integer", example: 3225000 },
            marginPct: { type: "number", example: 15.0 },
          },
        },
      },
    },
  },

  OnTimeReport: {
    type: "object",
    required: ["tenantId", "totalDeliveries", "onTimeDeliveries", "lateDeliveries", "onTimeRatePct", "averageDelayDays"],
    properties: {
      tenantId: { type: "string", example: "tenant_default" },
      totalDeliveries: { type: "integer", example: 12 },
      onTimeDeliveries: { type: "integer", example: 11 },
      lateDeliveries: { type: "integer", example: 1 },
      onTimeRatePct: { type: "number", example: 91.7 },
      averageDelayDays: { type: "number", example: 0.3 },
    },
  },

  CollectionsReport: {
    type: "object",
    required: ["tenantId", "totalInvoicedPaise", "totalCollectedPaise", "totalOutstandingPaise", "totalOverduePaise", "agingSummary"],
    properties: {
      tenantId: { type: "string", example: "tenant_default" },
      totalInvoicedPaise: { type: "integer", example: 50000000 },
      totalCollectedPaise: { type: "integer", example: 35000000 },
      totalOutstandingPaise: { type: "integer", example: 15000000 },
      totalOverduePaise: { type: "integer", example: 3000000 },
      agingSummary: {
        type: "object",
        required: ["currentPaise", "days1To30Paise", "days31To60Paise", "days61PlusPaise"],
        properties: {
          currentPaise: { type: "integer", example: 12000000 },
          days1To30Paise: { type: "integer", example: 3000000 },
          days31To60Paise: { type: "integer", example: 0 },
          days61PlusPaise: { type: "integer", example: 0 },
        },
      },
    },
  },

  // ==========================================
  // Agent Gateway Ingestion Payloads
  // ==========================================
  CreateAlertRequest: {
    type: "object",
    required: ["orderId", "processId", "date", "type", "title", "message", "metrics"],
    properties: {
      tenantId: { type: "string", example: "tenant_default", description: "Target tenant ID (injected from service gateway context)" },
      orderId: { type: "string", example: "65e0a1b2c3d4e5f6a7b8c701" },
      processId: { type: "string", example: "65e0a1b2c3d4e5f6a7b8c501" },
      date: { type: "string", format: "date", example: "2026-10-28" },
      type: { type: "string", enum: Object.values(AlertType), example: AlertType.DELAY_WARNING },
      severity: { type: "string", enum: Object.values(AlertSeverity), example: AlertSeverity.HIGH },
      title: { type: "string", example: "Weaving Output Deficit" },
      message: { type: "string", example: "Output fell short by 80 units today." },
      metrics: { $ref: "#/components/schemas/AlertMetrics" },
    },
  },

  CreateRecommendationRequest: {
    type: "object",
    required: ["alertId", "orderId", "title", "explanation", "options"],
    properties: {
      tenantId: { type: "string", example: "tenant_default" },
      alertId: { type: "string", example: "65e0a1b2c3d4e5f6a7b8ca01" },
      orderId: { type: "string", example: "65e0a1b2c3d4e5f6a7b8c701" },
      title: { type: "string", example: "Allocate Additional Weavers" },
      explanation: { type: "string", example: "Adding 2 weavers for 2 days recovers the deficit with minimal cost." },
      options: {
        type: "array",
        items: {
          type: "object",
          required: ["id", "title", "description"],
          properties: {
            id: { type: "string", example: "opt-1" },
            title: { type: "string", example: "Add 2 Workers" },
            description: { type: "string", example: "Assign Murugan P. and Karthik R. to next shift" },
            extraWorkersNeeded: { type: "integer", example: 2 },
            revisedDailyTarget: { type: "number", example: 280 },
            projectedCatchupDays: { type: "number", example: 2 },
            additionalCostPaise: { type: "integer", example: 48000 },
          },
        },
      },
    },
  },

  RecordMonitoringSnapshotRequest: {
    type: "object",
    required: ["orderId", "date"],
    properties: {
      tenantId: { type: "string", example: "tenant_default" },
      orderId: { type: "string", example: "65e0a1b2c3d4e5f6a7b8c701" },
      date: { type: "string", format: "date", example: "2026-10-28" },
      status: { type: "string", example: "BEHIND" },
      deficitQty: { type: "number", example: 80 },
      delayDaysEstimated: { type: "number", example: 1.5 },
      requiredDailyRate: { type: "number", example: 120 },
      actualDailyRate: { type: "number", example: 95 },
    },
  },

  RecordMonitoringSnapshotResponse: {
    type: "object",
    required: ["status", "timestamp"],
    properties: {
      status: { type: "string", example: "recorded" },
      timestamp: { type: "string", format: "date-time", example: "2026-10-28T14:30:00.000Z" },
    },
  },

  CreatePaymentFollowupRequest: {
    type: "object",
    required: ["deliveryId", "orderId", "customerId", "invoiceNumber", "totalInvoicePaise", "dueDate"],
    properties: {
      tenantId: { type: "string", example: "tenant_default" },
      deliveryId: { type: "string", example: "65e0a1b2c3d4e5f6a7b8c901" },
      orderId: { type: "string", example: "65e0a1b2c3d4e5f6a7b8c701" },
      customerId: { type: "string", example: "65e0a1b2c3d4e5f6a7b8c101" },
      invoiceNumber: { type: "string", example: "INV-2026-0001" },
      totalInvoicePaise: { type: "integer", minimum: 0, example: 21500000 },
      amountReceivedPaise: { type: "integer", minimum: 0, default: 0, example: 0 },
      dueDate: { type: "string", format: "date", example: "2026-12-19" },
      paymentTerms: { type: "string", default: "Net 30", example: "Net 30" },
    },
  },

  AddReminderDraftRequest: {
    type: "object",
    required: ["paymentId", "reminderNumber", "channel", "recipient", "messageBody", "scheduledDate"],
    properties: {
      tenantId: { type: "string", example: "tenant_default" },
      paymentId: { type: "string", example: "65e0a1b2c3d4e5f6a7b8c920" },
      reminderNumber: { type: "integer", minimum: 1, example: 1 },
      channel: { type: "string", enum: Object.values(NotificationChannel), example: NotificationChannel.EMAIL },
      recipient: { type: "string", example: "accounts@heritagesilks.in" },
      subject: { type: "string", example: "Payment Due: Invoice INV-2026-0001" },
      messageBody: { type: "string", example: "Dear Heritage Silks, this is a courteous reminder that invoice INV-2026-0001 is due on 2026-12-19." },
      scheduledDate: { type: "string", format: "date", example: "2026-12-15" },
    },
  },

  // ==========================================
  // System Health
  // ==========================================
  HealthResponse: {
    type: "object",
    required: ["status", "app", "timestamp"],
    properties: {
      status: { type: "string", example: "ok" },
      app: { type: "string", example: "LoomPilot" },
      timestamp: { type: "string", format: "date-time", example: "2026-10-28T14:30:00.000Z" },
    },
  },
};
