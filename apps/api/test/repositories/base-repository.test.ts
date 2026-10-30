import { describe, it, expect } from "vitest";
import mongoose, { Schema } from "mongoose";
import { BaseRepository } from "../../src/repositories/base.repository.js";
import { BaseEntity } from "../../src/interfaces/base-repository.interface.js";
import { VersionConflictError } from "../../src/errors/app-error.js";

interface IProductEntity extends BaseEntity {
  name: string;
  sku: string;
}

const ProductSchema = new Schema<IProductEntity>(
  {
    tenantId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    sku: { type: String, required: true },
    version: { type: Number, default: 1 },
  },
  { timestamps: true }
);

const ProductModel = mongoose.model<IProductEntity>("TestProduct", ProductSchema);

class ProductRepository extends BaseRepository<IProductEntity> {
  constructor() {
    super(ProductModel);
  }
}

describe("Tenant-Scoped Base Repository", () => {
  const repo = new ProductRepository();
  const tenantA = "tenant_alpha";
  const tenantB = "tenant_beta";

  it("creates a document with tenant scoping and version 1", async () => {
    const created = await repo.create(tenantA, {
      name: "Cotton Yarn 40s",
      sku: "CY-40",
      version: 1,
    });

    expect(created.tenantId).toBe(tenantA);
    expect(created.name).toBe("Cotton Yarn 40s");
    expect(created.version).toBe(1);
    expect(created._id).toBeDefined();
  });

  it("strictly isolates queries between tenants", async () => {
    const created = await repo.create(tenantA, {
      name: "Secret Formula Dye",
      sku: "SFD-01",
      version: 1,
    });

    const docId = String(created._id);

    // Tenant A can find it
    const foundA = await repo.findById(tenantA, docId);
    expect(foundA).not.toBeNull();
    expect(foundA?.name).toBe("Secret Formula Dye");

    // Tenant B cannot find it (returns null, proving isolation)
    const foundB = await repo.findById(tenantB, docId);
    expect(foundB).toBeNull();

    // Tenant B cannot find it via findOne
    const foundOneB = await repo.findOne(tenantB, { sku: "SFD-01" });
    expect(foundOneB).toBeNull();
  });

  it("enforces tenantId and rejects empty or missing tenantId", async () => {
    await expect(repo.findById("", "some_id")).rejects.toThrow(
      "Repository operation rejected: missing or invalid tenantId"
    );
  });

  it("paginates queries within tenant boundary", async () => {
    const tenantP = "tenant_paginate";
    for (let i = 1; i <= 5; i++) {
      await repo.create(tenantP, {
        name: `Item ${i}`,
        sku: `SKU-${i}`,
        version: 1,
      });
    }

    const result = await repo.findPaginated(tenantP, {}, { page: 1, limit: 3, sortOrder: "asc" });
    expect(result.data.length).toBe(3);
    expect(result.meta.total).toBe(5);
    expect(result.meta.totalPages).toBe(2);
    expect(result.meta.hasNext).toBe(true);

    // Another tenant sees 0 items
    const emptyResult = await repo.findPaginated("other_tenant", {}, { page: 1, limit: 10, sortOrder: "desc" });
    expect(emptyResult.meta.total).toBe(0);
    expect(emptyResult.data.length).toBe(0);
  });

  it("handles optimistic locking and throws VersionConflictError on version mismatch", async () => {
    const item = await repo.create(tenantA, {
      name: "Fabric Grey",
      sku: "FG-001",
      version: 1,
    });

    const itemId = String(item._id);

    // First update succeeds and increments version to 2
    const updated = await repo.updateWithVersion(tenantA, itemId, 1, {
      name: "Fabric Grey Updated",
    });
    expect(updated).not.toBeNull();
    expect(updated?.version).toBe(2);
    expect(updated?.name).toBe("Fabric Grey Updated");

    // Concurrent update with stale version 1 throws VersionConflictError
    await expect(
      repo.updateWithVersion(tenantA, itemId, 1, {
        name: "Conflicting Update",
      })
    ).rejects.toThrow(VersionConflictError);
  });

  it("deletes document strictly within tenant boundary", async () => {
    const item = await repo.create(tenantA, {
      name: "Delete Item",
      sku: "DEL-01",
      version: 1,
    });

    const itemId = String(item._id);

    // Tenant B cannot delete Tenant A's item
    const deletedByB = await repo.delete(tenantB, itemId);
    expect(deletedByB).toBe(false);

    // Tenant A deletes successfully
    const deletedByA = await repo.delete(tenantA, itemId);
    expect(deletedByA).toBe(true);

    const check = await repo.findById(tenantA, itemId);
    expect(check).toBeNull();
  });
});

