import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { MaterialModel, ImportJobModel, FileRecordModel } from "../../src/models/index.js";
import { createTestUser, generateTestAuthHeader } from "../helpers/auth-helper.js";

describe("CSV Import Workflows (POST /api/v1/imports/dry-run & commit)", () => {
  let app: any;
  const tenantId = `tenant_import_${Date.now()}`;
  let adminToken: string;

  beforeAll(async () => {
    app = createApp();
    const { user } = await createTestUser({ tenantId, role: "admin" });
    adminToken = generateTestAuthHeader({
      subjectId: String(user._id),
      realm: "user",
      tenantId,
      role: "admin",
    });
  });

  afterAll(async () => {
    await MaterialModel.deleteMany({ tenantId });
    await ImportJobModel.deleteMany({ tenantId });
    await FileRecordModel.deleteMany({ tenantId });
  });

  it("performs CSV dry-run validation and commits records without a second file upload", async () => {
    const csvContent =
      "materialName,type,unit,stockQty,reorderLevel,currentRatePaise\nLinen 60s,yarn,kg,150,20,50000\nSilk 20D,yarn,kg,50,10,80000";

    // 1. Perform dry-run directly with CSV content
    const dryRunRes = await request(app)
      .post("/api/v1/imports/dry-run")
      .set("Authorization", adminToken)
      .send({
        type: "materials",
        csvContent,
      });

    expect(dryRunRes.status).toBe(200);
    expect(dryRunRes.body.data.totalRows).toBe(2);
    expect(dryRunRes.body.data.rowsOk).toBe(2);
    expect(dryRunRes.body.data.rowsFailed).toBe(0);
    const jobId = dryRunRes.body.data.jobId;
    expect(jobId).toBeDefined();

    // 2. Commit the import job using stored dry-run result
    const commitRes = await request(app)
      .post("/api/v1/imports/commit")
      .set("Authorization", adminToken)
      .set("Idempotency-Key", `idem_commit_${Date.now()}`)
      .send({ jobId });

    expect(commitRes.status).toBe(201);
    expect(commitRes.body.data.rowsOk).toBe(2);
    expect(commitRes.body.data.status).toBe("completed");

    // 3. Verify materials were created in the database
    const mat1 = await MaterialModel.findOne({ tenantId, materialName: "Linen 60s" }).lean();
    expect(mat1).toBeDefined();
    expect(mat1?.stockQty).toBe(150);

    const mat2 = await MaterialModel.findOne({ tenantId, materialName: "Silk 20D" }).lean();
    expect(mat2).toBeDefined();
    expect(mat2?.stockQty).toBe(50);
  });
});
