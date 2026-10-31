import { Types } from "mongoose";
import { getEnv } from "../config/env.js";
import { connectMongo, disconnectMongo, isMongoConnected } from "../config/database.js";
import { SettingsModel } from "../models/identity/settings.model.js";
import { UserModel } from "../models/identity/user.model.js";
import { SupplierModel } from "../models/identity/supplier.model.js";
import { MaterialModel } from "../models/catalog/material.model.js";
import { MachineModel } from "../models/catalog/machine.model.js";
import { ProductModel } from "../models/catalog/product.model.js";
import { ClientModel } from "../models/identity/client.model.js";
import { DEFAULT_SETTINGS, DEFAULT_PROCESS_CONFIG } from "../config/tenant-defaults.js";
import { hashPassword } from "../utils/password.js";
import { logger } from "../utils/logger.js";

export async function runDevSeed(options?: { tenantId?: string }): Promise<void> {
  const env = getEnv();

  // Guard: Refuse to execute in production environment
  if (env.NODE_ENV === "production" || process.env.NODE_ENV === "production") {
    throw new Error("Dev seed refused: Execution is strictly prohibited in production environments");
  }

  const tenantId = options?.tenantId || env.TENANT_DEFAULT_ID || "default";

  if (!isMongoConnected()) {
    await connectMongo();
  }

  logger.info({ tenantId }, "Starting dev seed execution...");

  // 1. Settings
  await SettingsModel.updateOne(
    { tenantId },
    {
      $setOnInsert: {
        tenantId,
        ...DEFAULT_SETTINGS,
      },
    },
    { upsert: true }
  );
  logger.info("Dev seed: Settings provisioned");

  // 2. Admin User
  const adminPasswordHash = await hashPassword("AdminSecret123!");
  const adminDoc = await UserModel.findOneAndUpdate(
    { tenantId, email: "admin@mill.loompilot.local" },
    {
      $setOnInsert: {
        tenantId,
        name: "System Administrator",
        email: "admin@mill.loompilot.local",
        passwordHash: adminPasswordHash,
        role: "admin",
        status: "active",
        processAreas: DEFAULT_PROCESS_CONFIG.map((p) => p.area),
        notificationPrefs: { inApp: true, email: true, wa: false, sms: false },
      },
    },
    { upsert: true, new: true }
  );
  logger.info({ adminId: adminDoc._id }, "Dev seed: 1 Admin provisioned");

  // 3. Three Supervisors
  const supervisorPasswordHash = await hashPassword("SupervisorSecret123!");
  const supervisorsData = [
    {
      name: "Supervisor Knitting & Yarn",
      email: "sup.knitting@mill.loompilot.local",
      role: "supervisor" as const,
      processAreas: ["yarn_stock", "knitting", "dyeing_processing"],
    },
    {
      name: "Supervisor Cutting & Stitching",
      email: "sup.stitching@mill.loompilot.local",
      role: "supervisor" as const,
      processAreas: ["cutting", "stitching"],
    },
    {
      name: "Supervisor Finishing & Packing",
      email: "sup.packing@mill.loompilot.local",
      role: "supervisor" as const,
      processAreas: ["checking", "ironing_finishing", "packing"],
    },
  ];

  for (const sup of supervisorsData) {
    await UserModel.updateOne(
      { tenantId, email: sup.email },
      {
        $setOnInsert: {
          tenantId,
          name: sup.name,
          email: sup.email,
          passwordHash: supervisorPasswordHash,
          role: sup.role,
          status: "active",
          processAreas: sup.processAreas,
          notificationPrefs: { inApp: true, email: true, wa: false, sms: false },
        },
      },
      { upsert: true }
    );
  }
  logger.info("Dev seed: 3 Supervisors provisioned");

  // 4. Two Suppliers with Offers
  const supplierA = await SupplierModel.findOneAndUpdate(
    { tenantId, supplierName: "Apex Yarns & Textiles" },
    {
      $setOnInsert: {
        tenantId,
        supplierName: "Apex Yarns & Textiles",
        contactPerson: "Rajesh Kumar",
        email: "rajesh@apexyarns.in",
        phone: "+919876543210",
        city: "Coimbatore",
        country: "India",
        defaultLeadTimeDays: 5,
        status: "active",
      },
    },
    { upsert: true, new: true }
  );

  const supplierB = await SupplierModel.findOneAndUpdate(
    { tenantId, supplierName: "Premier Dyes & Trims" },
    {
      $setOnInsert: {
        tenantId,
        supplierName: "Premier Dyes & Trims",
        contactPerson: "Suresh Patel",
        email: "suresh@premierdyes.in",
        phone: "+919876543211",
        city: "Tirupur",
        country: "India",
        defaultLeadTimeDays: 3,
        status: "active",
      },
    },
    { upsert: true, new: true }
  );
  logger.info("Dev seed: 2 Suppliers provisioned");

  // 5. Materials in the Five Groups (yarn, fabric, dye_chemical, trim, packing)
  const materialsData = [
    {
      materialName: "30s Combed Cotton Yarn",
      type: "yarn" as const,
      stockQty: 5000,
      reservedQty: 0,
      reorderLevel: 1000,
      currentRatePaise: 28500, // ₹285.00 / kg
      unit: "kg",
      preferredSupplierId: supplierA._id,
      supplierOffers: [
        { supplierId: supplierA._id as Types.ObjectId, ratePaise: 28000, leadDays: 4 },
      ],
      watchlist: true,
    },
    {
      materialName: "Single Jersey 160 GSM",
      type: "fabric" as const,
      stockQty: 2500,
      reservedQty: 0,
      reorderLevel: 500,
      currentRatePaise: 38000, // ₹380.00 / kg
      unit: "kg",
      preferredSupplierId: supplierA._id,
      supplierOffers: [
        { supplierId: supplierA._id as Types.ObjectId, ratePaise: 37500, leadDays: 5 },
      ],
    },
    {
      materialName: "Reactive Navy Blue Dye",
      type: "dye_chemical" as const,
      stockQty: 300,
      reservedQty: 0,
      reorderLevel: 50,
      currentRatePaise: 45000, // ₹450.00 / kg
      unit: "kg",
      preferredSupplierId: supplierB._id,
      supplierOffers: [
        { supplierId: supplierB._id as Types.ObjectId, ratePaise: 44000, leadDays: 3 },
      ],
    },
    {
      materialName: "100% Polyester Sewing Thread",
      type: "trim" as const,
      stockQty: 1000,
      reservedQty: 0,
      reorderLevel: 200,
      currentRatePaise: 3500, // ₹35.00 / cone
      unit: "cone",
      preferredSupplierId: supplierB._id,
      supplierOffers: [
        { supplierId: supplierB._id as Types.ObjectId, ratePaise: 3400, leadDays: 2 },
      ],
    },
    {
      materialName: "Standard Export Polybag",
      type: "packing" as const,
      stockQty: 20000,
      reservedQty: 0,
      reorderLevel: 3000,
      currentRatePaise: 150, // ₹1.50 / piece
      unit: "pcs",
      preferredSupplierId: supplierB._id,
      supplierOffers: [
        { supplierId: supplierB._id as Types.ObjectId, ratePaise: 140, leadDays: 2 },
      ],
    },
  ];

  const seededMaterials: Record<string, Types.ObjectId> = {};
  for (const m of materialsData) {
    const doc = await MaterialModel.findOneAndUpdate(
      { tenantId, materialName: m.materialName },
      { $setOnInsert: { tenantId, ...m } },
      { upsert: true, new: true }
    );
    seededMaterials[m.materialName] = doc._id as Types.ObjectId;
  }
  logger.info("Dev seed: Materials across 5 groups provisioned");

  // 6. Machines per Area
  const machinesData = [
    { machineCode: "KM-01", machineName: "Circular Knitting Unit 1", processArea: "knitting", capacityUnitsPerDay: 250 },
    { machineCode: "KM-02", machineName: "Circular Knitting Unit 2", processArea: "knitting", capacityUnitsPerDay: 250 },
    { machineCode: "DM-01", machineName: "Softflow Dyeing Machine 1", processArea: "dyeing_processing", capacityUnitsPerDay: 500 },
    { machineCode: "CT-01", machineName: "Auto Spreader & Cutting Table 1", processArea: "cutting", capacityUnitsPerDay: 2000 },
    { machineCode: "ST-01", machineName: "Overlock & Flatlock Line 1", processArea: "stitching", capacityUnitsPerDay: 800 },
    { machineCode: "ST-02", machineName: "Overlock & Flatlock Line 2", processArea: "stitching", capacityUnitsPerDay: 800 },
    { machineCode: "CK-01", machineName: "Quality Inspection Station 1", processArea: "checking", capacityUnitsPerDay: 1000 },
    { machineCode: "IR-01", machineName: "Vacuum Steam Iron Station 1", processArea: "ironing_finishing", capacityUnitsPerDay: 1000 },
    { machineCode: "PK-01", machineName: "Automatic Polybagging Station 1", processArea: "packing", capacityUnitsPerDay: 1500 },
  ];

  for (const m of machinesData) {
    await MachineModel.updateOne(
      { tenantId, machineCode: m.machineCode },
      {
        $setOnInsert: {
          tenantId,
          ...m,
          currentStatus: "available",
        },
      },
      { upsert: true }
    );
  }
  logger.info("Dev seed: Machines per process area provisioned");

  // 7. Products with BOM, Routing, and BasePricePaise
  const yarnId = seededMaterials["30s Combed Cotton Yarn"];
  const threadId = seededMaterials["100% Polyester Sewing Thread"];
  const polybagId = seededMaterials["Standard Export Polybag"];

  const routingSteps = [
    { seq: 1, stage: "knitting", stdMinPerUnit: 4 },
    { seq: 2, stage: "dyeing_processing", stdMinPerUnit: 5 },
    { seq: 3, stage: "cutting", stdMinPerUnit: 2 },
    { seq: 4, stage: "stitching", stdMinPerUnit: 8 },
    { seq: 5, stage: "checking", stdMinPerUnit: 2 },
    { seq: 6, stage: "ironing_finishing", stdMinPerUnit: 2 },
    { seq: 7, stage: "packing", stdMinPerUnit: 1 },
  ];

  const productsData = [
    {
      productName: "Classic Cotton Crewneck T-Shirt",
      category: "Apparel",
      basePricePaise: 24500, // ₹245.00
      active: true,
      bom: [
        { materialId: yarnId, qtyPerUnit: 0.22, wastage: 0.05 },
        { materialId: threadId, qtyPerUnit: 0.02, wastage: 0.02 },
        { materialId: polybagId, qtyPerUnit: 1, wastage: 0.01 },
      ],
      routing: routingSteps,
    },
    {
      productName: "Premium Polo Pique T-Shirt",
      category: "Apparel",
      basePricePaise: 38000, // ₹380.00
      active: true,
      bom: [
        { materialId: yarnId, qtyPerUnit: 0.3, wastage: 0.06 },
        { materialId: threadId, qtyPerUnit: 0.03, wastage: 0.02 },
        { materialId: polybagId, qtyPerUnit: 1, wastage: 0.01 },
      ],
      routing: routingSteps,
    },
  ];

  for (const p of productsData) {
    await ProductModel.updateOne(
      { tenantId, productName: p.productName },
      { $setOnInsert: { tenantId, ...p } },
      { upsert: true }
    );
  }
  logger.info("Dev seed: Products with BOM & routing provisioned");

  // 8. Two Clients with Portal Invites
  const clientsData = [
    {
      clientName: "Nordic Retailers Ltd",
      contactPerson: "Lars Hansen",
      email: "procurement@nordicretail.com",
      phone: "+4512345678",
      city: "Copenhagen",
      country: "Denmark",
      paymentTermsDays: 30,
      status: "active" as const,
      portalAccess: {
        email: "procurement@nordicretail.com",
        status: "invited" as const,
        invitedBy: adminDoc._id as Types.ObjectId,
        invitedAt: new Date(),
        notificationPrefs: { inApp: true, email: true, wa: false, sms: false },
      },
    },
    {
      clientName: "Urban Trendsetters Inc",
      contactPerson: "Maya Lin",
      email: "orders@urbantrends.co",
      phone: "+14155552671",
      city: "San Francisco",
      country: "USA",
      paymentTermsDays: 15,
      status: "active" as const,
      portalAccess: {
        email: "orders@urbantrends.co",
        status: "invited" as const,
        invitedBy: adminDoc._id as Types.ObjectId,
        invitedAt: new Date(),
        notificationPrefs: { inApp: true, email: true, wa: false, sms: false },
      },
    },
  ];

  for (const c of clientsData) {
    await ClientModel.updateOne(
      { tenantId, clientName: c.clientName },
      { $setOnInsert: { tenantId, ...c } },
      { upsert: true }
    );
  }
  logger.info("Dev seed: 2 Clients with portal invites provisioned");

  logger.info("Dev seed completed successfully!");
}

if (process.argv[1]?.includes("dev-seed")) {
  runDevSeed()
    .then(async () => {
      await disconnectMongo();
      process.exit(0);
    })
    .catch(async (err) => {
      logger.error({ err }, "Dev seed failed");
      await disconnectMongo();
      process.exit(1);
    });
}

