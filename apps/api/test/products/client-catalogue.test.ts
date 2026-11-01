import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import mongoose, { Types } from "mongoose";
import { createApp } from "../../src/app.js";
import { createContainer } from "../../src/container.js";
import { ProductModel } from "../../src/models/catalog/product.model.js";
import { createClientSafeViews } from "../../src/seed/migrations/create-views.js";
import { createTestUser, createTestClientAccount, generateTestAuthHeader } from "../helpers/auth-helper.js";

describe("Client Catalogue API Integration & Boundary Tests (GET /api/v1/client/products)", () => {
  const container = createContainer();
  const app = createApp(container);

  const tenantA = `tenant_cat_a_${Date.now()}`;
  const tenantB = `tenant_cat_b_${Date.now()}`;
  const tenantC = `tenant_cat_c_${Date.now()}`; // Empty tenant

  let clientTokenA: string;
  let clientTokenB: string;
  let clientTokenC: string;
  let adminTokenA: string;

  let activeProdA1Id: string;
  let activeProdA2Id: string;
  let inactiveProdA3Id: string;
  let activeProdB1Id: string;

  beforeAll(async () => {
    // 1. Ensure Schema v4 database views (including clientSafeProducts) are created
    await createClientSafeViews(mongoose.connection.db!);

    // 2. Set up clients for Tenant A, B, and C
    const { account: clientAccA } = await createTestClientAccount({ tenantId: tenantA });
    clientTokenA = generateTestAuthHeader({
      subjectId: String(clientAccA._id),
      realm: "client",
      tenantId: tenantA,
      clientId: String(clientAccA._id),
    });

    const { account: clientAccB } = await createTestClientAccount({ tenantId: tenantB });
    clientTokenB = generateTestAuthHeader({
      subjectId: String(clientAccB._id),
      realm: "client",
      tenantId: tenantB,
      clientId: String(clientAccB._id),
    });

    const { account: clientAccC } = await createTestClientAccount({ tenantId: tenantC });
    clientTokenC = generateTestAuthHeader({
      subjectId: String(clientAccC._id),
      realm: "client",
      tenantId: tenantC,
      clientId: String(clientAccC._id),
    });

    // 3. Set up Admin for Tenant A
    const { user: adminA } = await createTestUser({
      tenantId: tenantA,
      role: "admin",
      email: `admin.${Date.now()}@tenant-a.local`,
    });
    adminTokenA = generateTestAuthHeader({
      subjectId: String(adminA._id),
      realm: "user",
      role: "admin",
      tenantId: tenantA,
    });

    // 4. Populate Products
    const imageId = new Types.ObjectId();
    const materialId = new Types.ObjectId();

    // Tenant A - Active Product 1
    const pA1 = await ProductModel.create({
      tenantId: tenantA,
      productName: "Premium Cotton T-Shirt",
      category: "t_shirt",
      basePricePaise: 45000,
      imageFileIds: [imageId],
      active: true,
      bom: [{ materialId, qtyPerUnit: 1.2, wastage: 0.05 }],
      routing: [{ stage: "knitting", seq: 1, stdMinPerUnit: 15 }],
      version: 1,
    });
    activeProdA1Id = String(pA1._id);

    // Tenant A - Active Product 2
    const pA2 = await ProductModel.create({
      tenantId: tenantA,
      productName: "Classic Linen Shirt",
      category: "shirt",
      basePricePaise: 95000,
      imageFileIds: [],
      active: true,
      bom: [{ materialId, qtyPerUnit: 2.0, wastage: 0.1 }],
      routing: [{ stage: "weaving", seq: 1, stdMinPerUnit: 30 }],
      version: 1,
    });
    activeProdA2Id = String(pA2._id);

    // Tenant A - Inactive Product 3
    const pA3 = await ProductModel.create({
      tenantId: tenantA,
      productName: "Discontinued Wool Blend Jacket",
      category: "jacket",
      basePricePaise: 250000,
      imageFileIds: [],
      active: false, // INACTIVE
      bom: [{ materialId, qtyPerUnit: 3.5, wastage: 0.15 }],
      routing: [{ stage: "sewing", seq: 1, stdMinPerUnit: 60 }],
      version: 1,
    });
    inactiveProdA3Id = String(pA3._id);

    // Tenant B - Active Product 1
    const pB1 = await ProductModel.create({
      tenantId: tenantB,
      productName: "Tenant B Silk Scarf",
      category: "accessory",
      basePricePaise: 35000,
      imageFileIds: [],
      active: true,
      bom: [{ materialId, qtyPerUnit: 0.8, wastage: 0.02 }],
      routing: [{ stage: "finishing_packing", seq: 1, stdMinPerUnit: 10 }],
      version: 1,
    });
    activeProdB1Id = String(pB1._id);
  });

  it("1. A client in a tenant with active products receives those products", async () => {
    const res = await request(app)
      .get("/api/v1/client/products")
      .set("Authorization", clientTokenA);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.data.length).toBe(2);
    expect(res.body.meta.total).toBe(2);

    const productNames = res.body.data.map((p: any) => p.productName);
    expect(productNames).toContain("Premium Cotton T-Shirt");
    expect(productNames).toContain("Classic Linen Shirt");
  });

  it("2. Inactive products are strictly excluded from client catalogue", async () => {
    const res = await request(app)
      .get("/api/v1/client/products")
      .set("Authorization", clientTokenA);

    expect(res.status).toBe(200);
    const returnedIds = res.body.data.map((p: any) => p.id);
    expect(returnedIds).not.toContain(inactiveProdA3Id);

    const productNames = res.body.data.map((p: any) => p.productName);
    expect(productNames).not.toContain("Discontinued Wool Blend Jacket");
  });

  it("3. Products from another tenant are never returned (cross-tenant isolation)", async () => {
    const resA = await request(app)
      .get("/api/v1/client/products")
      .set("Authorization", clientTokenA);

    expect(resA.status).toBe(200);
    const returnedIdsA = resA.body.data.map((p: any) => p.id);
    expect(returnedIdsA).not.toContain(activeProdB1Id);

    const resB = await request(app)
      .get("/api/v1/client/products")
      .set("Authorization", clientTokenB);

    expect(resB.status).toBe(200);
    expect(resB.body.data.length).toBe(1);
    expect(resB.body.data[0].id).toBe(activeProdB1Id);
    expect(resB.body.data[0].productName).toBe("Tenant B Silk Scarf");
    expect(resB.body.data[0].id).not.toBe(activeProdA1Id);
    expect(resB.body.data[0].id).not.toBe(activeProdA2Id);
  });

  it("4. The response contains only fields permitted by the client-safe API contract", async () => {
    const res = await request(app)
      .get("/api/v1/client/products")
      .set("Authorization", clientTokenA);

    expect(res.status).toBe(200);
    for (const item of res.body.data) {
      // Must include whitelist fields
      expect(item.id).toBeDefined();
      expect(item.productName).toBeDefined();
      expect(item.category).toBeDefined();
      expect(item.basePricePaise).toBeDefined();
      expect(item.createdAt).toBeDefined();
      expect(item.updatedAt).toBeDefined();

      // Must NEVER leak internal, sensitive, or redundant fields
      expect(item._id).toBeUndefined();
      expect(item.tenantId).toBeUndefined();
      expect(item.active).toBeUndefined();
      expect(item.bom).toBeUndefined();
      expect(item.routing).toBeUndefined();
      expect(item.version).toBeUndefined();
    }
  });

  it("5. A tenant with no active products receives a valid empty result", async () => {
    const res = await request(app)
      .get("/api/v1/client/products")
      .set("Authorization", clientTokenC);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.meta.total).toBe(0);
    expect(res.body.meta.page).toBe(1);
  });

  it("6. GET /api/v1/client/products/:id returns single active product and enforces tenant/active boundaries", async () => {
    // 6a. Active product in same tenant -> 200 OK
    const resValid = await request(app)
      .get(`/api/v1/client/products/${activeProdA1Id}`)
      .set("Authorization", clientTokenA);

    expect(resValid.status).toBe(200);
    expect(resValid.body.data.id).toBe(activeProdA1Id);
    expect(resValid.body.data.productName).toBe("Premium Cotton T-Shirt");
    expect(resValid.body.data.bom).toBeUndefined();
    expect(resValid.body.data.routing).toBeUndefined();
    expect(resValid.body.data.tenantId).toBeUndefined();

    // 6b. Inactive product -> 404 Not Found
    const resInactive = await request(app)
      .get(`/api/v1/client/products/${inactiveProdA3Id}`)
      .set("Authorization", clientTokenA);

    expect(resInactive.status).toBe(404);

    // 6c. Product belonging to another tenant -> 404 Not Found
    const resOtherTenant = await request(app)
      .get(`/api/v1/client/products/${activeProdB1Id}`)
      .set("Authorization", clientTokenA);

    expect(resOtherTenant.status).toBe(404);

    // 6d. Non-existent product ID -> 404 Not Found
    const resNotFound = await request(app)
      .get("/api/v1/client/products/000000000000000000000000")
      .set("Authorization", clientTokenA);

    expect(resNotFound.status).toBe(404);
  });

  it("7. Existing admin product listing behavior remains unchanged", async () => {
    const resAdmin = await request(app)
      .get("/api/v1/products")
      .set("Authorization", adminTokenA);

    expect(resAdmin.status).toBe(200);
    // Admin sees all 3 products for Tenant A (including inactive product)
    expect(resAdmin.body.data.length).toBe(3);
    expect(resAdmin.body.meta.total).toBe(3);

    const returnedIds = resAdmin.body.data.map((p: any) => p._id);
    expect(returnedIds).toContain(activeProdA1Id);
    expect(returnedIds).toContain(activeProdA2Id);
    expect(returnedIds).toContain(inactiveProdA3Id);

    // Admin response includes internal fields (bom, routing, active)
    const adminProd = resAdmin.body.data.find((p: any) => p._id === activeProdA1Id);
    expect(adminProd.bom).toBeDefined();
    expect(adminProd.routing).toBeDefined();
    expect(adminProd.active).toBe(true);

    const inactiveAdminProd = resAdmin.body.data.find((p: any) => p._id === inactiveProdA3Id);
    expect(inactiveAdminProd.active).toBe(false);
  });

  it("8. Fallback mode: when clientSafeProducts view is dropped, fallback query excludes inactive products and preserves tenant boundaries", async () => {
    const db = mongoose.connection.db!;
    await db.collection("clientSafeProducts").drop();

    // Verify view is dropped
    const colls = await db.listCollections({ name: "clientSafeProducts" }).toArray();
    expect(colls.length).toBe(0);

    // Client A in fallback mode
    const resA = await request(app)
      .get("/api/v1/client/products")
      .set("Authorization", clientTokenA);

    expect(resA.status).toBe(200);
    expect(resA.body.data.length).toBe(2);
    expect(resA.body.meta.total).toBe(2);
    const names = resA.body.data.map((p: any) => p.productName);
    expect(names).toContain("Premium Cotton T-Shirt");
    expect(names).toContain("Classic Linen Shirt");
    expect(names).not.toContain("Discontinued Wool Blend Jacket"); // Inactive excluded!
    expect(names).not.toContain("Tenant B Silk Scarf"); // Other tenant excluded!

    // Client B in fallback mode
    const resB = await request(app)
      .get("/api/v1/client/products")
      .set("Authorization", clientTokenB);

    expect(resB.status).toBe(200);
    expect(resB.body.data.length).toBe(1);
    expect(resB.body.data[0].productName).toBe("Tenant B Silk Scarf");

    // Client C in fallback mode (empty tenant)
    const resC = await request(app)
      .get("/api/v1/client/products")
      .set("Authorization", clientTokenC);

    expect(resC.status).toBe(200);
    expect(resC.body.data).toEqual([]);
    expect(resC.body.meta.total).toBe(0);

    // Fallback single item lookup
    const resItem = await request(app)
      .get(`/api/v1/client/products/${activeProdA1Id}`)
      .set("Authorization", clientTokenA);

    expect(resItem.status).toBe(200);
    expect(resItem.body.data.id).toBe(activeProdA1Id);

    // Inactive product in fallback mode -> 404
    const resInactive = await request(app)
      .get(`/api/v1/client/products/${inactiveProdA3Id}`)
      .set("Authorization", clientTokenA);

    expect(resInactive.status).toBe(404);
  });
});
