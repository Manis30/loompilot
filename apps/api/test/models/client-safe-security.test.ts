import { describe, it, expect, beforeAll } from "vitest";
import mongoose from "mongoose";
import {
  OrderModel,
  QuotationModel,
  QuotationCostingModel,
  QuotationRevisionModel,
  UserModel,
} from "../../src/models/index.js";
import { createClientSafeViews } from "../../src/seed/migrations/create-views.js";

describe("Security Checkpoint: Real Client-Safe Views in MongoDB", () => {
  const tenantId = "tenant_security_test";
  const clientId = new mongoose.Types.ObjectId();
  const rawMaterialId = new mongoose.Types.ObjectId();

  let sampleOrderId: mongoose.Types.ObjectId;
  let submittedOrderId: mongoose.Types.ObjectId;
  let draftQuoteId: mongoose.Types.ObjectId;
  let pendingApprovalQuoteId: mongoose.Types.ObjectId;
  let sentQuoteId: mongoose.Types.ObjectId;
  let sentRevisionId: mongoose.Types.ObjectId;
  let proposedRevisionId: mongoose.Types.ObjectId;
  let approvedRevisionId: mongoose.Types.ObjectId;
  let acceptedRevisionId: mongoose.Types.ObjectId;
  let declinedRevisionId: mongoose.Types.ObjectId;
  let testUserId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    // 1. Create real client-safe database views in mongodb-memory-server
    await createClientSafeViews();

    // 2. Seed an order with internal process plan in "in_production" status
    const order = await OrderModel.create({
      tenantId,
      orderNumber: "ORD-SEC-001",
      clientId,
      quantity: 5000,
      status: "in_production",
      deliveryDeadline: "2026-12-15",
      estimatedCompletionDate: "2026-12-10",
      phase: "weaving",
      percentComplete: 30,
      source: "client_portal",
      processPlan: [
        {
          stage: "weaving",
          start: "2026-11-01",
          end: "2026-11-10",
          dailyTarget: 500,
        },
      ],
    });
    sampleOrderId = order._id as mongoose.Types.ObjectId;

    // Seed another order with "submitted" status to verify customer status mapping
    const submittedOrder = await OrderModel.create({
      tenantId,
      orderNumber: "ORD-SEC-002",
      clientId,
      quantity: 1200,
      status: "submitted",
      deliveryDeadline: "2026-12-30",
      phase: "winding",
      percentComplete: 0,
      source: "client_portal",
    });
    submittedOrderId = submittedOrder._id as mongoose.Types.ObjectId;

    // 3. Seed a pending_approval quotation (must NOT appear in clientSafeQuotations)
    const draftQuote = await QuotationModel.create({
      tenantId,
      orderId: sampleOrderId,
      clientId,
      version: 1,
      status: "pending_approval",
      lineItems: [
        {
          desc: "Internal Spec",
          qty: 1000,
          unitPricePaise: 10000,
        },
      ],
      totalPaise: 10000000,
      unitPricePaise: 10000,
      etaDate: "2026-12-01",
      validUntil: "2026-11-15",
      explanation: "Internal calculation notes",
      assumptions: "Cotton price remains stable",
      clientExplanation: "Tentative draft",
    });
    draftQuoteId = draftQuote._id as mongoose.Types.ObjectId;

    // 4. Seed an approved-unsent quotation (must NOT appear in clientSafeQuotations)
    const approvedQuote = await QuotationModel.create({
      tenantId,
      orderId: sampleOrderId,
      clientId,
      version: 2,
      status: "approved", // approved internally but not yet sent to customer
      lineItems: [
        {
          desc: "Approved but unsent",
          qty: 2000,
          unitPricePaise: 11000,
        },
      ],
      totalPaise: 22000000,
      unitPricePaise: 11000,
      etaDate: "2026-12-10",
      validUntil: "2026-11-20",
      explanation: "Internal margin check passed",
      clientExplanation: "Ready to dispatch to client",
    });
    pendingApprovalQuoteId = approvedQuote._id as mongoose.Types.ObjectId;

    // 5. Seed a SENT quotation (MUST appear in clientSafeQuotations)
    const sentQuote = await QuotationModel.create({
      tenantId,
      orderId: sampleOrderId,
      clientId,
      version: 3,
      status: "sent",
      lineItems: [
        {
          desc: "Cotton Shirting 40s",
          qty: 5000,
          unitPricePaise: 12000, // ₹120.00 / meter
        },
      ],
      totalPaise: 60000000, // ₹6,00,000.00
      unitPricePaise: 12000,
      etaDate: "2026-12-15",
      validUntil: "2026-11-15",
      sentAt: new Date("2026-10-30T10:00:00Z"),
      explanation: "Standard batch pricing with 18% internal margin",
      assumptions: "Yarn rates locked for 30 days",
      clientExplanation: "Standard batch pricing per confirmed specification",
      termsVersion: "v1.0",
      priceVariationClause: "Standard cotton price escalation clause",
    });
    sentQuoteId = sentQuote._id as mongoose.Types.ObjectId;

    // 6. Seed confidential quotationCostings in the ADMIN-ONLY collection
    await QuotationCostingModel.create({
      tenantId,
      quotationId: sentQuoteId,
      materialCosts: [
        {
          materialId: rawMaterialId,
          qty: 2500,
          ratePaise: 15000,
          paise: 37500000,
        },
      ],
      processingCosts: [
        {
          stage: "weaving",
          costing: "stitch",
          paise: 5000000,
        },
      ],
      wastagePaise: 1200000,
      riskBufferPaise: 1800000,
      overheadPaise: 2500000,
      totalCostPaise: 48000000,
      marginPct: 20,
      marginPaise: 12000000,
      formulaVersion: "v3",
      revisions: [],
    });

    // 7. Seed QuotationRevisions across all 5 statuses
    const proposedRev = await QuotationRevisionModel.create({
      tenantId,
      quotationId: sentQuoteId,
      orderId: sampleOrderId,
      revisionNumber: 1,
      reasonType: "price_surge",
      oldPricePaise: 60000000,
      newPricePaise: 65000000,
      changePct: 8.33,
      status: "proposed",
      clientDrivers: ["raw_material_surge"],
      clientReason: "Proposed revision for yarn spike",
    });
    proposedRevisionId = proposedRev._id as mongoose.Types.ObjectId;

    const approvedRev = await QuotationRevisionModel.create({
      tenantId,
      quotationId: sentQuoteId,
      orderId: sampleOrderId,
      revisionNumber: 2,
      reasonType: "price_surge",
      oldPricePaise: 60000000,
      newPricePaise: 65000000,
      changePct: 8.33,
      status: "approved",
      clientDrivers: ["raw_material_surge"],
      clientReason: "Approved revision awaiting dispatch",
    });
    approvedRevisionId = approvedRev._id as mongoose.Types.ObjectId;

    const sentRev = await QuotationRevisionModel.create({
      tenantId,
      quotationId: sentQuoteId,
      orderId: sampleOrderId,
      revisionNumber: 3,
      reasonType: "price_surge",
      oldPricePaise: 60000000,
      newPricePaise: 65000000,
      changePct: 8.33,
      status: "sent",
      sentAt: new Date("2026-10-30T10:30:00Z"),
      clientDrivers: ["raw_material_surge"],
      clientReason: "Market yarn rate adjustment",
    });
    sentRevisionId = sentRev._id as mongoose.Types.ObjectId;

    const acceptedRev = await QuotationRevisionModel.create({
      tenantId,
      quotationId: sentQuoteId,
      orderId: sampleOrderId,
      revisionNumber: 4,
      reasonType: "price_surge",
      oldPricePaise: 60000000,
      newPricePaise: 65000000,
      changePct: 8.33,
      status: "accepted",
      sentAt: new Date("2026-10-30T10:30:00Z"),
      clientDrivers: ["raw_material_surge"],
      clientReason: "Accepted revision",
    });
    acceptedRevisionId = acceptedRev._id as mongoose.Types.ObjectId;

    const declinedRev = await QuotationRevisionModel.create({
      tenantId,
      quotationId: sentQuoteId,
      orderId: sampleOrderId,
      revisionNumber: 5,
      reasonType: "price_surge",
      oldPricePaise: 60000000,
      newPricePaise: 65000000,
      changePct: 8.33,
      status: "declined",
      sentAt: new Date("2026-10-30T10:30:00Z"),
      clientDrivers: ["raw_material_surge"],
      clientReason: "Declined revision",
    });
    declinedRevisionId = declinedRev._id as mongoose.Types.ObjectId;

    // 8. Seed User with sensitive credentials
    const user = await UserModel.create({
      tenantId,
      name: "Supervisor Rajan",
      email: "rajan@mill.loompilot.internal",
      phone: "+919876543210",
      passwordHash: "$2b$12$eX4mpL3H45h53cr3tN3v3rExP0s3d",
      role: "supervisor",
      processAreas: ["weaving", "winding"],
      status: "active",
    });
    testUserId = user._id as mongoose.Types.ObjectId;

    // 9. Inject an unexpected/new internal field directly into base documents
    const db = mongoose.connection.db!;
    await db.collection("quotations").updateOne(
      { _id: sentQuoteId },
      {
        $set: {
          futureInternalSecret: "TOP_SECRET_COSTING_FORMULA",
          newAdminFlag: true,
          supplierKickbackPaise: 500000,
        },
      }
    );
    await db.collection("quotationRevisions").updateOne(
      { _id: sentRevisionId },
      {
        $set: {
          internalAuditSecret: "REVISION_INTERNAL_AUDIT",
        },
      }
    );
  }, 30000);

  it("proves pending_approval and approved-unsent quotations are strictly absent from clientSafeQuotations view", async () => {
    const db = mongoose.connection.db!;

    // Pending approval quote query on real view MUST return null
    const draftInView = await db
      .collection("clientSafeQuotations")
      .findOne({ _id: draftQuoteId });
    expect(draftInView).toBeNull();

    // Approved-unsent quote query on real view MUST return null
    const approvedUnsentInView = await db
      .collection("clientSafeQuotations")
      .findOne({ _id: pendingApprovalQuoteId });
    expect(approvedUnsentInView).toBeNull();

    // Only customer-facing status (sent) MUST be visible
    const sentInView = await db
      .collection("clientSafeQuotations")
      .findOne({ _id: sentQuoteId });
    expect(sentInView).not.toBeNull();
    expect(sentInView?.totalPaise).toBe(60000000);
    expect(sentInView?.status).toBe("sent");
  });

  it("proves cost and margin fields and internal explanation/assumptions are completely absent from clientSafeQuotations view", async () => {
    const db = mongoose.connection.db!;
    const safeQuote = await db
      .collection("clientSafeQuotations")
      .findOne({ _id: sentQuoteId });

    expect(safeQuote).not.toBeNull();

    // Costing & margin figures must NOT exist
    expect(safeQuote?.materialCosts).toBeUndefined();
    expect(safeQuote?.processingCosts).toBeUndefined();
    expect(safeQuote?.wastagePaise).toBeUndefined();
    expect(safeQuote?.riskBufferPaise).toBeUndefined();
    expect(safeQuote?.overheadPaise).toBeUndefined();
    expect(safeQuote?.marginPct).toBeUndefined();
    expect(safeQuote?.marginPaise).toBeUndefined();
    expect(safeQuote?.totalCostPaise).toBeUndefined();
    expect(safeQuote?.costBreakdown).toBeUndefined();
    expect(safeQuote?.inputsSnapshot).toBeUndefined();

    // Internal explanation and assumptions MUST be stripped
    expect(safeQuote?.explanation).toBeUndefined();
    expect(safeQuote?.assumptions).toBeUndefined();

    // clientExplanation, termsVersion and priceVariationClause MUST be present
    expect(safeQuote?.clientExplanation).toBe("Standard batch pricing per confirmed specification");
    expect(safeQuote?.termsVersion).toBe("v1.0");
    expect(safeQuote?.priceVariationClause).toBe("Standard cotton price escalation clause");
  });

  it("proves a field added to the base collection later does NOT appear in clientSafeQuotations view (whitelist inclusion)", async () => {
    const db = mongoose.connection.db!;

    // 1. Verify field exists in raw base collection
    const rawQuote = await db
      .collection("quotations")
      .findOne({ _id: sentQuoteId });
    expect(rawQuote?.futureInternalSecret).toBe("TOP_SECRET_COSTING_FORMULA");
    expect(rawQuote?.newAdminFlag).toBe(true);
    expect(rawQuote?.supplierKickbackPaise).toBe(500000);

    // 2. Verify field is physically excluded from the real client view due to inclusion $project
    const viewQuote = await db
      .collection("clientSafeQuotations")
      .findOne({ _id: sentQuoteId });
    expect(viewQuote?.futureInternalSecret).toBeUndefined();
    expect(viewQuote?.newAdminFlag).toBeUndefined();
    expect(viewQuote?.supplierKickbackPaise).toBeUndefined();
  });

  it("proves clientSafeOrders maps internal statuses to customer-safe statuses and excludes internal process plan", async () => {
    const db = mongoose.connection.db!;

    // In production order maps to client status "in_production"
    const inProdOrder = await db
      .collection("clientSafeOrders")
      .findOne({ _id: sampleOrderId });
    expect(inProdOrder).not.toBeNull();
    expect(inProdOrder?.status).toBe("in_production");
    expect(inProdOrder?.tenantId).toBe(tenantId);
    expect(String(inProdOrder?.clientId)).toBe(String(clientId));
    expect(inProdOrder?.orderNumber).toBe("ORD-SEC-001");
    expect(inProdOrder?.processPlan).toBeUndefined(); // internal plan stripped!

    // Submitted order maps to customer status "received"
    const subOrder = await db
      .collection("clientSafeOrders")
      .findOne({ _id: submittedOrderId });
    expect(subOrder).not.toBeNull();
    expect(subOrder?.status).toBe("received"); // mapped from internal "submitted"!
  });

  it("proves clientSafeRevisions only exposes sent, accepted and declined revisions (proposed and approved are hidden)", async () => {
    const db = mongoose.connection.db!;

    // 1. Proposed revision must NOT appear in view
    const proposedInView = await db
      .collection("clientSafeRevisions")
      .findOne({ _id: proposedRevisionId });
    expect(proposedInView).toBeNull();

    // 2. Approved revision must NOT appear in view
    const approvedInView = await db
      .collection("clientSafeRevisions")
      .findOne({ _id: approvedRevisionId });
    expect(approvedInView).toBeNull();

    // 3. Sent revision MUST appear
    const sentInView = await db
      .collection("clientSafeRevisions")
      .findOne({ _id: sentRevisionId });
    expect(sentInView).not.toBeNull();
    expect(sentInView?.clientReason).toBe("Market yarn rate adjustment");
    expect(sentInView?.costDrivers).toBeUndefined(); // internal cost breakdown stripped!
    expect(sentInView?.internalAuditSecret).toBeUndefined(); // whitelist inclusion strips later additions!

    // 4. Accepted revision MUST appear
    const acceptedInView = await db
      .collection("clientSafeRevisions")
      .findOne({ _id: acceptedRevisionId });
    expect(acceptedInView).not.toBeNull();
    expect(acceptedInView?.status).toBe("accepted");

    // 5. Declined revision MUST appear
    const declinedInView = await db
      .collection("clientSafeRevisions")
      .findOne({ _id: declinedRevisionId });
    expect(declinedInView).not.toBeNull();
    expect(declinedInView?.status).toBe("declined");
  });

  it("proves agentSafeUsers exposes role and processAreas but strips sensitive auth/contact details", async () => {
    const db = mongoose.connection.db!;

    const agentUser = await db
      .collection("agentSafeUsers")
      .findOne({ _id: testUserId });

    expect(agentUser).not.toBeNull();
    expect(agentUser?.name).toBe("Supervisor Rajan");
    expect(agentUser?.role).toBe("supervisor");
    expect(agentUser?.processAreas).toEqual(["weaving", "winding"]);

    // Security check: sensitive fields MUST NOT be exposed to agents_ro
    expect(agentUser?.passwordHash).toBeUndefined();
    expect(agentUser?.email).toBeUndefined();
    expect(agentUser?.phone).toBeUndefined();
  });
});
