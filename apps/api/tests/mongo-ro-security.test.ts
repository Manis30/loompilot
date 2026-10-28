import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

describe("Stage 2: Read-Only MongoDB User Security Test", () => {
  let mongoServer: MongoMemoryServer;
  let adminConnection: mongoose.Connection;
  let roConnection: mongoose.Connection;
  const dbName = "loompilot_ro_test";

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create({
      instance: {
        dbName,
        storageEngine: "wiredTiger",
      },
      auth: {
        enable: true,
        customRootName: "admin_user",
        customRootPwd: "admin_password",
        extraUsers: [
          {
            createUser: "agent_ro",
            pwd: "agent_ro_pass",
            roles: [{ role: "read", db: dbName }],
          },
        ],
      },
    });

    const baseUri = mongoServer.getUri();
    const hostPort = baseUri.replace("mongodb://", "").replace(/\/.*/, "");
    const adminUri = `mongodb://admin_user:admin_password@${hostPort}/${dbName}?authSource=admin`;
    const roUri = `mongodb://agent_ro:agent_ro_pass@${hostPort}/${dbName}?authSource=admin`;

    adminConnection = mongoose.createConnection(adminUri);
    await adminConnection.asPromise();

    roConnection = mongoose.createConnection(roUri);
    await roConnection.asPromise();
  }, 60000);

  afterAll(async () => {
    if (adminConnection) await adminConnection.close();
    if (roConnection) await roConnection.close();
    if (mongoServer) await mongoServer.stop();
  });

  it("permits the read-only user to read documents from the collection", async () => {
    const adminColl = adminConnection.collection("inventory_test");
    await adminColl.insertOne({ material: "Cotton Yarn 30s", stock: 500 });

    const roColl = roConnection.collection("inventory_test");
    const doc = await roColl.findOne({ material: "Cotton Yarn 30s" });

    expect(doc).toBeDefined();
    expect(doc?.stock).toBe(500);
  });

  it("proves the read-only user cannot perform write operations (fails with authorization error)", async () => {
    const roColl = roConnection.collection("inventory_test");

    // Attempting insertOne must fail with authorization error
    await expect(
      roColl.insertOne({
        material: "Unauthorized Yarn",
        stock: 9999,
        reason: "Agents must never write directly to MongoDB",
      })
    ).rejects.toThrow(/not authorized/i);

    // Attempting deleteMany must fail with authorization error
    await expect(
      roColl.deleteMany({})
    ).rejects.toThrow(/not authorized/i);

    // Attempting updateOne must fail with authorization error
    await expect(
      roColl.updateOne({ material: "Cotton Yarn 30s" }, { $set: { stock: 0 } })
    ).rejects.toThrow(/not authorized/i);
  });
});
