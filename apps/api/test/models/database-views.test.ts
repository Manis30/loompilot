import { describe, it, expect, beforeAll } from "vitest";
import mongoose, { Types } from "mongoose";
import { createClientSafeViews } from "../../src/seed/migrations/create-views.js";
import { OrderModel } from "../../src/models/orders/order.model.js";
import { ProductModel } from "../../src/models/catalog/product.model.js";
import { UserModel } from "../../src/models/identity/user.model.js";
import { ClientModel } from "../../src/models/identity/client.model.js";
import { hashPassword } from "../../src/utils/password.js";

describe("Stage 3.5 Step 4: Database Views & Collection Access Boundaries", () => {
  const tenantId = "tenant_views_test";

  beforeAll(async () => {
    // Re-create the 5 Schema v4 database views against mongodb-memory-server
    await createClientSafeViews(mongoose.connection.db!);
  });

  it("clientSafeOrders: exposes whitelist fields, maps clientStatus, embeds safe quotation/financials/deliveries/progress, and NEVER leaks internal costing or unprojected fields", async () => {
    const db = mongoose.connection.db!;
    const clientId = new Types.ObjectId();
    const adminId = new Types.ObjectId();
    const supervisorId = new Types.ObjectId();

    // Insert a fully populated order fixture with ALL internal and costing fields
    const fullyPopulatedOrder = {
      tenantId,
      orderNumber: "ORD-VIEW-001",
      clientId,
      status: "quotation_sent",
      quantity: 1000,
      deliveryDeadline: "2026-12-15",
      spec: {
        fabricType: "Cotton Satin",
        gsm: 180,
        widthInches: 48,
        warpCount: "40s",
        weftCount: "40s",
      },
      source: "client_portal",
      requestVersion: 1,

      // Sensitive Feasibility block (MUST NOT LEAK TO CLIENT)
      feasibility: {
        status: "feasible",
        feasible: true,
        checkedAt: new Date(),
        assumptions: ["Sufficient warp yarn stock in godown A"],
        bottlenecks: ["Knitting machine 4 under maintenance"],
        leadTimeDays: 14,
      },

      // Embedded Quotation with sent and drafting revisions
      quotation: {
        status: "sent",
        unitPricePaise: 150000,
        totalPaise: 150000000,
        etaDate: "2026-12-10",
        validUntil: "2026-11-20",
        paymentSchedule: "30% advance on approval, 70% before dispatch",
        clientExplanation: "Standard cotton satin finishing process applied",
        termsVersion: "v2.0",
        priceVariationClause: "Cotton yarn price escalation clause applicable",
        internalExplanation: "CONFIDENTIAL: Margin calculated at 22% above base cost",
        assumptions: "Yarn price locked for 10 days",
        revisions: [
          {
            revisionNo: 1,
            oldPricePaise: 140000,
            newPricePaise: 150000,
            changePct: 7.14,
            newEtaDate: "2026-12-10",
            clientReason: "Raw yarn escalation",
            status: "sent",
            internalNotes: "CONFIDENTIAL: Supplier hike of 5%",
          },
          {
            revisionNo: 2,
            oldPricePaise: 150000,
            newPricePaise: 160000,
            changePct: 6.67,
            status: "drafting", // Drafting revision MUST NOT LEAK TO CLIENT
            internalNotes: "CONFIDENTIAL: Internal draft",
          },
        ],
      },

      // Embedded Costing (STRICTLY CONFIDENTIAL)
      costing: {
        materialsTotalPaise: 80000000,
        productionTotalPaise: 20000000,
        overheadPaise: 5000000,
        riskBufferPaise: 3000000,
        totalCostPaise: 108000000,
        targetUnitPricePaise: 150000,
        calculatedAt: new Date(),
        inputsSnapshot: { secretFactor: 1.15 },
      },

      // Financials with Milestones and Receipts
      financials: {
        advanceReceivedPaise: 45000000,
        totalPaidPaise: 45000000,
        milestones: [
          {
            milestone: "Advance 30%",
            trigger: "advance",
            amountPaise: 45000000,
            dueDate: "2026-11-05",
            status: "received",
            receivedPaise: 45000000,
            invoiceNo: "INV-ADV-001",
            // Sensitive receipts block (MUST NOT LEAK TO CLIENT VIEW)
            receipts: [
              {
                amountPaise: 45000000,
                method: "razorpay",
                ref: "rzp_pay_999888",
                date: "2026-11-04",
                by: adminId,
                razorpayPaymentId: "pay_secret_id_12345",
              },
            ],
          },
        ],
      },

      // Deliveries
      deliveries: [
        {
          deliveryDate: "2026-12-08",
          qty: 500,
          invoiceNo: "INV-DEL-001",
          invoiceAmountPaise: 75000000,
          onTime: true,
          recordedBy: adminId,
        },
      ],

      // Production & Progress
      phase: "weaving",
      percentComplete: 60,
      producedQty: 600,
      deliveredQty: 0,
      production: {
        assignedSupervisors: [
          { supervisorId, processes: ["weaving"], acknowledgedAt: new Date() },
        ],
        monitoring: {
          requiredDailyOutput: 50,
          recommendations: ["Increase warp beam tension"],
        },
      },

      // Platform & internal audit fields (MUST NOT LEAK)
      statusHistory: [
        {
          from: "submitted",
          to: "quotation_sent",
          changedAt: new Date(),
          changedBy: adminId,
          reason: "Approved quote",
        },
      ],
      idempotencyKey: "idemp_order_secret_hash_999",

      // Arbitrary unmodeled field added to base collection later
      futureSecretField: "CRITICAL_LEAK_TEST_SECRET",
      unmodeledCostMargin: 999999,
    };

    // Insert directly into the base 'orders' collection
    await db.collection("orders").insertOne(fullyPopulatedOrder);

    // Query clientSafeOrders view
    const viewDoc = await db
      .collection("clientSafeOrders")
      .findOne({ orderNumber: "ORD-VIEW-001" });

    expect(viewDoc).toBeDefined();

    // 1. Check clientStatus mapping ("quotation_sent" -> "quotation_ready")
    expect(viewDoc?.clientStatus).toBe("quotation_ready");

    // 2. Check quotation projection
    expect(viewDoc?.quotation).toBeDefined();
    expect(viewDoc?.quotation.unitPricePaise).toBe(150000);
    expect(viewDoc?.quotation.totalPaise).toBe(150000000);
    expect(viewDoc?.quotation.clientExplanation).toBe(
      "Standard cotton satin finishing process applied"
    );
    expect(viewDoc?.quotation.internalExplanation).toBeUndefined();
    expect(viewDoc?.quotation.assumptions).toBeUndefined();

    // 3. Check revisions filtering (only 'sent' allowed, 'drafting' stripped)
    expect(viewDoc?.quotation.revisions).toHaveLength(1);
    expect(viewDoc?.quotation.revisions[0].revisionNo).toBe(1);
    expect(viewDoc?.quotation.revisions[0].clientReason).toBe("Raw yarn escalation");
    expect(viewDoc?.quotation.revisions[0].internalNotes).toBeUndefined();

    // 4. Check financials milestones (receipts NEVER leaked)
    expect(viewDoc?.financials.milestones).toHaveLength(1);
    expect(viewDoc?.financials.milestones[0].milestone).toBe("Advance 30%");
    expect(viewDoc?.financials.milestones[0].amountPaise).toBe(45000000);
    expect(viewDoc?.financials.milestones[0].receipts).toBeUndefined();

    // 5. Check deliveries mapping
    expect(viewDoc?.deliveries).toHaveLength(1);
    expect(viewDoc?.deliveries[0].deliveryDate).toBe("2026-12-08");
    expect(viewDoc?.deliveries[0].qty).toBe(500);
    expect(viewDoc?.deliveries[0].invoiceNo).toBe("INV-DEL-001");
    expect(viewDoc?.deliveries[0].onTime).toBe(true);
    expect(viewDoc?.deliveries[0].invoiceAmountPaise).toBeUndefined();
    expect(viewDoc?.deliveries[0].recordedBy).toBeUndefined();

    // 6. Check production progress
    expect(viewDoc?.phase).toBe("weaving");
    expect(viewDoc?.percentComplete).toBe(60);
    expect(viewDoc?.producedQty).toBe(600);
    expect(viewDoc?.deliveredQty).toBe(0);

    // 7. Verify STRICT PROHIBITIONS: NEVER costing, feasibility, statusHistory, assignments, monitoring, idempotencyKey
    expect(viewDoc?.costing).toBeUndefined();
    expect(viewDoc?.feasibility).toBeUndefined();
    expect(viewDoc?.statusHistory).toBeUndefined();
    expect(viewDoc?.production).toBeUndefined();
    expect(viewDoc?.idempotencyKey).toBeUndefined();

    // 8. Invariant: A field added to the base collection later never appears in the view!
    expect(viewDoc?.futureSecretField).toBeUndefined();
    expect(viewDoc?.unmodeledCostMargin).toBeUndefined();
  });

  it("clientSafeProducts: projects active products only with productName, category, basePricePaise, imageFileIds (excluding bom, routing, and unmodeled fields)", async () => {
    const db = mongoose.connection.db!;
    const imageId = new Types.ObjectId();
    const materialId = new Types.ObjectId();

    // Insert active and inactive products
    await db.collection("products").insertMany([
      {
        tenantId,
        productName: "Premium Silk Saree",
        category: "Saree",
        basePricePaise: 850000,
        imageFileIds: [imageId],
        active: true,
        bom: [{ materialId, qtyPerUnit: 5.5, wastage: 0.1 }],
        routing: [{ stage: "weaving", seq: 1, stdMinPerUnit: 120 }],
        internalProductionNotes: "CONFIDENTIAL LOOM SETUP",
        futureFieldLaterAdded: "SECRET_PRODUCT_METADATA",
      },
      {
        tenantId,
        productName: "Discontinued Cotton Fabric",
        category: "Fabric",
        basePricePaise: 250000,
        active: false, // Inactive
      },
    ]);

    const activeViewDocs = await db
      .collection("clientSafeProducts")
      .find({ tenantId })
      .toArray();

    // Only active product is returned
    expect(activeViewDocs).toHaveLength(1);
    const prod = activeViewDocs[0];
    expect(prod?.productName).toBe("Premium Silk Saree");
    expect(prod?.category).toBe("Saree");
    expect(prod?.basePricePaise).toBe(850000);
    expect(prod?.imageFileIds).toBeDefined();

    // Proves bom, routing, internal notes, and future unmodeled fields NEVER appear
    expect(prod?.bom).toBeUndefined();
    expect(prod?.routing).toBeUndefined();
    expect(prod?.internalProductionNotes).toBeUndefined();
    expect(prod?.futureFieldLaterAdded).toBeUndefined();
  });

  it("agentSafeOrders: exposes operational order details but strictly excludes costing, receipts, statusHistory, idempotencyKey, and future fields", async () => {
    const db = mongoose.connection.db!;
    const agentOrder = await db
      .collection("agentSafeOrders")
      .findOne({ orderNumber: "ORD-VIEW-001" });

    expect(agentOrder).toBeDefined();

    // Allowed for analytical agents
    expect(agentOrder?.status).toBe("quotation_sent");
    expect(agentOrder?.spec?.fabricType).toBe("Cotton Satin");
    expect(agentOrder?.feasibility?.status).toBe("feasible");
    expect(agentOrder?.quotation?.status).toBe("sent");
    expect(agentOrder?.deliveries).toHaveLength(1);

    // Strictly forbidden for agents
    expect(agentOrder?.costing).toBeUndefined();
    expect(agentOrder?.statusHistory).toBeUndefined();
    expect(agentOrder?.idempotencyKey).toBeUndefined();
    expect(agentOrder?.financials?.milestones?.[0]?.receipts).toBeUndefined();

    // Invariant: future added fields never appear
    expect(agentOrder?.futureSecretField).toBeUndefined();
    expect(agentOrder?.unmodeledCostMargin).toBeUndefined();
  });

  it("agentSafeUsers: exposes name, role, processAreas, status only (NEVER passwordHash, email, lockout, or unmodeled fields)", async () => {
    const db = mongoose.connection.db!;
    const hash = await hashPassword("UserSecret123!");

    await db.collection("users").insertOne({
      tenantId,
      name: "Supervisor Anand",
      email: "anand.supervisor@mill.local",
      phone: "+919876543210",
      passwordHash: hash,
      role: "supervisor",
      status: "active",
      processAreas: ["winding", "weaving"],
      lockout: { failedCount: 0, lockedUntil: null },
      notificationPrefs: { inApp: true, email: true },
      futureUserField: "SECRET_USER_FIELD",
    });

    const userView = await db
      .collection("agentSafeUsers")
      .findOne({ tenantId, name: "Supervisor Anand" });

    expect(userView).toBeDefined();
    expect(userView?.name).toBe("Supervisor Anand");
    expect(userView?.role).toBe("supervisor");
    expect(userView?.processAreas).toEqual(["winding", "weaving"]);
    expect(userView?.status).toBe("active");

    // Strictly forbidden
    expect(userView?.passwordHash).toBeUndefined();
    expect(userView?.email).toBeUndefined();
    expect(userView?.phone).toBeUndefined();
    expect(userView?.lockout).toBeUndefined();
    expect(userView?.notificationPrefs).toBeUndefined();
    expect(userView?.futureUserField).toBeUndefined();
  });

  it("agentSafeClients: exposes clientName, customerType, paymentTermsDays only (NEVER portalAccess, email, phone, contactPerson, or unmodeled fields)", async () => {
    const db = mongoose.connection.db!;
    const passHash = await hashPassword("ClientSecret123!");

    await db.collection("clients").insertOne({
      tenantId,
      clientName: "Madurai Handlooms",
      customerType: "wholesale",
      paymentTermsDays: 45,
      contactPerson: "Sundaram Pillai",
      email: "billing@madurai-handlooms.local",
      phone: "+919944001122",
      address: "Meenakshi Bazaar, Madurai",
      status: "active",
      portalAccess: {
        email: "portal@madurai-handlooms.local",
        passwordHash: passHash,
        status: "active",
      },
      futureClientField: "SECRET_CLIENT_FIELD",
    });

    const clientView = await db
      .collection("agentSafeClients")
      .findOne({ tenantId, clientName: "Madurai Handlooms" });

    expect(clientView).toBeDefined();
    expect(clientView?.clientName).toBe("Madurai Handlooms");
    expect(clientView?.customerType).toBe("wholesale");
    expect(clientView?.paymentTermsDays).toBe(45);

    // Strictly forbidden
    expect(clientView?.portalAccess).toBeUndefined();
    expect(clientView?.email).toBeUndefined();
    expect(clientView?.phone).toBeUndefined();
    expect(clientView?.contactPerson).toBeUndefined();
    expect(clientView?.address).toBeUndefined();
    expect(clientView?.futureClientField).toBeUndefined();
  });

  it("Proves the architectural invariant: a field added to the base collection later NEVER appears in any view", async () => {
    const db = mongoose.connection.db!;
    const laterAddedPropertyKey = "arbitraryFutureUnmodeledProperty_xyz987";
    const secretValue = "LEAK_VERIFICATION_VALUE_2026";

    // 1. Add document to 'orders' with the unmodeled property
    await db.collection("orders").insertOne({
      tenantId,
      orderNumber: "ORD-FUTURE-INVARIANT-001",
      clientId: new Types.ObjectId(),
      status: "submitted",
      quantity: 50,
      deliveryDeadline: "2026-12-31",
      [laterAddedPropertyKey]: secretValue,
    });

    // Check clientSafeOrders and agentSafeOrders
    const clientSafeOrder = await db
      .collection("clientSafeOrders")
      .findOne({ orderNumber: "ORD-FUTURE-INVARIANT-001" });
    const agentSafeOrder = await db
      .collection("agentSafeOrders")
      .findOne({ orderNumber: "ORD-FUTURE-INVARIANT-001" });

    expect(clientSafeOrder).toBeDefined();
    expect(agentSafeOrder).toBeDefined();
    expect(clientSafeOrder?.[laterAddedPropertyKey]).toBeUndefined();
    expect(agentSafeOrder?.[laterAddedPropertyKey]).toBeUndefined();

    // 2. Add document to 'products' with the unmodeled property
    await db.collection("products").insertOne({
      tenantId,
      productName: "Future Fabric",
      category: "Future",
      basePricePaise: 100000,
      active: true,
      [laterAddedPropertyKey]: secretValue,
    });

    const clientSafeProduct = await db
      .collection("clientSafeProducts")
      .findOne({ productName: "Future Fabric" });
    expect(clientSafeProduct).toBeDefined();
    expect(clientSafeProduct?.[laterAddedPropertyKey]).toBeUndefined();
  });
});

