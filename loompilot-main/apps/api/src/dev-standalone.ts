import { MongoMemoryReplSet } from "mongodb-memory-server";
import { UserModel, ClientModel, SettingsModel } from "./models/index.js";
import { DEFAULT_SETTINGS } from "./config/tenant-defaults.js";
import { hashPassword } from "./utils/password.js";

async function seedInitialData() {
  console.log("Seeding initial dev accounts...");
  const tenants = ["default", "tenant_loompilot_tn_01"];

  for (const tenantId of tenants) {
    try {
      const existingSettings = await SettingsModel.findOne({ tenantId });
      if (!existingSettings) {
        await SettingsModel.create({
          tenantId,
          ...DEFAULT_SETTINGS,
        });
      }

      const adminPassHash = await hashPassword("AdminSecret123!");
      await UserModel.findOneAndUpdate(
        { tenantId, email: "admin@mill.loompilot.local" },
        {
          tenantId,
          role: "admin",
          name: "Managing Director",
          email: "admin@mill.loompilot.local",
          phone: "+91 98765 00001",
          passwordHash: adminPassHash,
          processAreas: [
            "yarn_stock",
            "knitting",
            "dyeing_processing",
            "cutting",
            "stitching",
            "checking",
            "ironing_finishing",
            "packing",
          ],
          status: "active",
        },
        { upsert: true, new: true }
      );

      const supPassHash = await hashPassword("SupervisorSecret123!");
      await UserModel.findOneAndUpdate(
        { tenantId, email: "supervisor@mill.loompilot.local" },
        {
          tenantId,
          role: "supervisor",
          name: "Shift Floor Supervisor",
          email: "supervisor@mill.loompilot.local",
          phone: "+91 98765 00002",
          passwordHash: supPassHash,
          processAreas: ["knitting", "dyeing_processing", "cutting", "stitching"],
          status: "active",
        },
        { upsert: true, new: true }
      );

      const clientPassHash = await hashPassword("ClientPass123!");
      await ClientModel.findOneAndUpdate(
        { tenantId, email: "client@acme.com" },
        {
          tenantId,
          clientName: "Acme Apparel & Textiles",
          contactPerson: "Rajesh Sharma",
          email: "client@acme.com",
          phone: "+91 98765 43210",
          city: "Coimbatore",
          address: "Industrial Estate, Avinashi Road",
          country: "India",
          status: "active",
          portalAccess: {
            email: "client@acme.com",
            status: "active",
            passwordHash: clientPassHash,
          },
        },
        { upsert: true, new: true }
      );
    } catch (err) {
      console.warn(`Seeding warning for tenant ${tenantId}:`, err);
    }
  }
  console.log("Seeding complete: Admin, Supervisor, and Client accounts are ready!");
}

async function main() {
  console.log("Starting in-memory MongoDB replica set...");
  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const mongoUri = replSet.getUri();
  console.log("In-memory MongoDB ready at:", mongoUri);

  process.env.MONGODB_URI = mongoUri;
  process.env.USE_REDIS_MOCK = "true";

  console.log("Importing and bootstrapping server...");
  const { bootstrap } = await import("./server.js");
  await bootstrap();
  console.log("Server bootstrapped successfully!");

  await seedInitialData();
}

main().catch((err) => {
  console.error("Boot error:", err);
  process.exit(1);
});
