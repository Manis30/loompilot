import { describe, it, expect } from "vitest";
import mongoose, { Schema } from "mongoose";
import { SCHEMA_V4_MANIFEST } from "@loompilot/shared";

describe("Stage 3.5: Partial Unique Indexes (Replacement of Sparse Unique Indexes)", () => {
  it("verifies manifest definitions specify partialFilterExpression for all 5 sparse replacements", () => {
    // 1. clients.portalAccess.email
    const clientIndexes = SCHEMA_V4_MANIFEST.ClientModel.indexes;
    const portalEmailIdx = clientIndexes.find(
      (idx) => idx.fields["portalAccess.email"] === 1 && idx.fields.tenantId === 1
    );
    expect(portalEmailIdx).toBeDefined();
    expect(portalEmailIdx?.unique).toBe(true);
    expect(portalEmailIdx?.sparse).toBeUndefined();
    expect(portalEmailIdx?.partialFilterExpression).toEqual({
      "portalAccess.email": { $type: "string" },
    });

    // 2. orders.idempotencyKey
    const orderIndexes = SCHEMA_V4_MANIFEST.OrderModel.indexes;
    const idempotencyIdx = orderIndexes.find(
      (idx) => idx.fields.idempotencyKey === 1 && idx.fields.tenantId === 1
    );
    expect(idempotencyIdx).toBeDefined();
    expect(idempotencyIdx?.unique).toBe(true);
    expect(idempotencyIdx?.sparse).toBeUndefined();
    expect(idempotencyIdx?.partialFilterExpression).toEqual({
      idempotencyKey: { $type: "string" },
    });

    // 3. orders.financials.milestones.receipts.razorpayPaymentId
    const rzpIdx = orderIndexes.find(
      (idx) =>
        idx.fields["financials.milestones.receipts.razorpayPaymentId"] === 1 &&
        idx.fields.tenantId === 1
    );
    expect(rzpIdx).toBeDefined();
    expect(rzpIdx?.unique).toBe(true);
    expect(rzpIdx?.sparse).toBeUndefined();
    expect(rzpIdx?.partialFilterExpression).toEqual({
      "financials.milestones.receipts.razorpayPaymentId": { $type: "string" },
    });

    // 4. supervisorDailyReports.clientGeneratedId
    const reportIndexes = SCHEMA_V4_MANIFEST.SupervisorDailyReportModel.indexes;
    const clientGenIdx = reportIndexes.find(
      (idx) => idx.fields.clientGeneratedId === 1 && idx.fields.tenantId === 1
    );
    expect(clientGenIdx).toBeDefined();
    expect(clientGenIdx?.unique).toBe(true);
    expect(clientGenIdx?.sparse).toBeUndefined();
    expect(clientGenIdx?.partialFilterExpression).toEqual({
      clientGeneratedId: { $type: "string" },
    });

    // 5. notifications.dedupeKey
    const notifIndexes = SCHEMA_V4_MANIFEST.NotificationModel.indexes;
    const dedupeIdx = notifIndexes.find(
      (idx) => idx.fields.dedupeKey === 1 && idx.fields.tenantId === 1
    );
    expect(dedupeIdx).toBeDefined();
    expect(dedupeIdx?.unique).toBe(true);
    expect(dedupeIdx?.sparse).toBeUndefined();
    expect(dedupeIdx?.partialFilterExpression).toEqual({
      dedupeKey: { $type: "string" },
    });
  });

  it("proves in real MongoDB: two docs without the field both insert, but duplicates are rejected", async () => {
    const TestSchema = new Schema(
      {
        tenantId: { type: String, required: true },
        clientGeneratedId: { type: String },
        note: { type: String },
      },
      { timestamps: true }
    );

    TestSchema.index(
      { tenantId: 1, clientGeneratedId: 1 },
      {
        unique: true,
        partialFilterExpression: { clientGeneratedId: { $type: "string" } },
      }
    );

    const TestModel =
      mongoose.models.PartialIndexTest ||
      mongoose.model("PartialIndexTest", TestSchema);

    await TestModel.init();

    // 1. Two docs WITHOUT the field (both undefined / absent) both insert successfully
    const doc1 = await TestModel.create({ tenantId: "tenant_partial_test", note: "Doc without ID 1" });
    const doc2 = await TestModel.create({ tenantId: "tenant_partial_test", note: "Doc without ID 2" });
    expect(doc1._id).toBeDefined();
    expect(doc2._id).toBeDefined();

    // 2. Two docs with different string values both insert
    const doc3 = await TestModel.create({
      tenantId: "tenant_partial_test",
      clientGeneratedId: "ID-100",
      note: "Doc with ID 100",
    });
    const doc4 = await TestModel.create({
      tenantId: "tenant_partial_test",
      clientGeneratedId: "ID-200",
      note: "Doc with ID 200",
    });
    expect(doc3.clientGeneratedId).toBe("ID-100");
    expect(doc4.clientGeneratedId).toBe("ID-200");

    // 3. Duplicate string in the same tenant fails with duplicate key error
    await expect(
      TestModel.create({
        tenantId: "tenant_partial_test",
        clientGeneratedId: "ID-100",
        note: "Duplicate ID 100",
      })
    ).rejects.toThrow(/E11000/);
  });
});
