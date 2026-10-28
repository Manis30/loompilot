import { describe, it, beforeAll, afterAll, beforeEach, expect } from "vitest";
import { setupTestDB, teardownTestDB, clearTestDB } from "./setup.js";
import { QuotationService } from "../src/modules/quotations/service.js";
import { QuotationModel } from "../src/modules/quotations/model.js";
import { MaterialModel, ReservationModel, StockMovementModel } from "../src/models/material.model.js";
import { ProcessModel } from "../src/models/process.model.js";
import { CustomerModel } from "../src/models/customer.model.js";
import { ProductionOrderModel } from "../src/models/order.model.js";
import { QuotationStatus, OrderStatus, ProcessName, MaterialType, StockMovementType } from "@loompilot/shared";
import mongoose from "mongoose";

describe("Stage 2: Order Confirmation Transaction Tests (MongoMemoryReplSet)", () => {
  const tenantId = "tenant_tx_test";

  beforeAll(async () => {
    await setupTestDB();
  }, 60000);

  afterAll(async () => {
    await teardownTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  it("atomically confirms quotation, reserves stock, records ledger movement, and generates production plan", async () => {
    // 1. Setup Customer
    const customer = await CustomerModel.create({
      tenantId,
      name: "Heritage Silks Ltd",
      code: "CUST-001",
      contactPerson: "Arjun Verma",
      email: "arjun@heritage.test",
      phone: "+91 9876543210",
      creditPeriodDays: 30,
    });

    // 2. Setup Materials
    const material1 = await MaterialModel.create({
      tenantId,
      code: "YARN-40S",
      name: "Combed Yarn 40s",
      type: MaterialType.YARN,
      unit: "kg",
      currentRatePaise: 32000,
      avgCostPaise: 31000,
      onHandQuantity: 1000,
      reservedQuantity: 0,
    });

    // 3. Setup Processes
    const processNames = [
      ProcessName.SPINNING,
      ProcessName.WEAVING,
      ProcessName.DYEING,
      ProcessName.FINISHING,
      ProcessName.PACKING,
    ];

    for (let i = 0; i < processNames.length; i++) {
      await ProcessModel.create({
        tenantId,
        name: processNames[i],
        sequence: i + 1,
        standardWastagePct: 2.0,
        avgOutputPerWorkerHour: 15,
        unit: "meters",
      });
    }

    // 4. Create Quotation
    const quotation = await QuotationModel.create({
      tenantId,
      enquiryId: new mongoose.Types.ObjectId(),
      customerId: customer._id,
      quotationNumber: "QT-CONFIRM-001",
      lineItems: [
        {
          materialId: material1._id,
          materialName: material1.name,
          requiredQty: 400,
          unit: "kg",
          onHandQty: 1000,
          reservedQty: 0,
          toPurchaseQty: 0,
          unitCostPaise: 32000,
          totalCostPaise: 12800000,
          supplierLeadDays: 5,
        },
      ],
      materialCostPaise: 12800000,
      subtotalCostPaise: 12800000,
      wastagePct: 2.5,
      wastageCostPaise: 320000,
      riskBufferPct: 3.0,
      riskBufferCostPaise: 384000,
      marginPct: 15.0,
      profitPaise: 2025600,
      finalPricePaise: 15529600,
      etaDate: "2026-11-20",
      validUntil: "2026-11-05",
      status: QuotationStatus.APPROVED,
      explanation: "Approved quotation ready for confirmation",
      inputsSnapshot: {
        productName: "Premium Cotton Sheeting",
        targetQty: 2000,
        unit: "meters",
      },
    });

    // 5. Execute Transactional Order Confirmation
    const order = await QuotationService.confirmOrder(tenantId, quotation._id.toString());

    // --- Assertions ---
    // A. Production order created
    expect(order).toBeDefined();
    expect(order.status).toBe(OrderStatus.PLANNED);
    expect(order.orderNumber).toBe("PO-00001");
    expect(order.totalQuantity).toBe(2000);
    expect(order.plan).toHaveLength(5);
    expect(order.plan[0]!.processName).toBe(ProcessName.SPINNING);
    expect(order.plan[4]!.processName).toBe(ProcessName.PACKING);

    // B. Quotation updated to confirmed
    const updatedQuote = await QuotationModel.findById(quotation._id);
    expect(updatedQuote!.status).toBe(QuotationStatus.CONFIRMED);

    // C. Stock reserved on Material
    const updatedMaterial = await MaterialModel.findById(material1._id);
    expect(updatedMaterial!.reservedQuantity).toBe(400);

    // D. Reservation document created
    const reservation = await ReservationModel.findOne({
      tenantId,
      materialId: material1._id,
      orderId: quotation._id,
    });
    expect(reservation).toBeDefined();
    expect(reservation!.quantity).toBe(400);
    expect(reservation!.status).toBe("reserved");

    // E. Append-only ledger movement created
    const movement = await StockMovementModel.findOne({
      tenantId,
      materialId: material1._id,
      type: StockMovementType.RESERVATION,
    });
    expect(movement).toBeDefined();
    expect(movement!.quantity).toBe(400);
    expect(movement!.referenceType).toBe("reservation");
  });
});

