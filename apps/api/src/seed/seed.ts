import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { UserModel } from "../models/user.model.js";
import { MaterialModel } from "../models/material.model.js";
import { SupplierModel } from "../models/supplier.model.js";
import { ProcessModel } from "../models/process.model.js";
import { WorkerModel } from "../models/workforce.model.js";
import { UserRole } from "@loompilot/shared";

export async function runSeed(tenantId: string = "tenant_default"): Promise<void> {
  logger.info({ tenantId }, "Starting database seed...");

  const passwordHash = await bcrypt.hash("password123", 10);

  // 1. Seed Users for each role
  const users = [
    { email: "owner@loompilot.test", name: "Anand Mills Owner", role: UserRole.OWNER },
    { email: "manager@loompilot.test", name: "Production Manager", role: UserRole.MANAGER },
    { email: "sales@loompilot.test", name: "Sales Executive", role: UserRole.SALES },
    { email: "accounts@loompilot.test", name: "Senior Accountant", role: UserRole.ACCOUNTS },
    { email: "store@loompilot.test", name: "Warehouse Storekeeper", role: UserRole.STORE },
  ];

  for (const u of users) {
    await UserModel.findOneAndUpdate(
      { tenantId, email: u.email },
      { ...u, tenantId, passwordHash },
      { upsert: true, new: true }
    );
  }
  logger.info("Users seeded");

  // 2. Seed Materials
  const materials = [
    {
      sku: "MAT-YRN-30S",
      name: "Cotton Yarn 30s Carded",
      category: "yarn",
      unit: "kg",
      onHandQty: 1200,
      reservedQty: 200,
      availableQty: 1000,
      reorderPoint: 500,
      currentRatePaise: 25000, // Rs 250.00 / kg
      avgCostPaise: 24500,
    },
    {
      sku: "MAT-YRN-40S",
      name: "Cotton Yarn 40s Combed",
      category: "yarn",
      unit: "kg",
      onHandQty: 800,
      reservedQty: 0,
      availableQty: 800,
      reorderPoint: 400,
      currentRatePaise: 28000, // Rs 280.00 / kg
      avgCostPaise: 27500,
    },
    {
      sku: "MAT-DYE-NVY",
      name: "Reactive Navy Blue Dye",
      category: "dyes",
      unit: "kg",
      onHandQty: 150,
      reservedQty: 10,
      availableQty: 140,
      reorderPoint: 50,
      currentRatePaise: 75000, // Rs 750.00 / kg
      avgCostPaise: 72000,
    },
  ];

  for (const m of materials) {
    await MaterialModel.findOneAndUpdate(
      { tenantId, sku: m.sku },
      { ...m, tenantId },
      { upsert: true, new: true }
    );
  }
  logger.info("Materials seeded");

  // 3. Seed Suppliers
  const suppliers = [
    {
      name: "Surat Yarn Mills",
      contactPerson: "Rajesh Shah",
      phone: "+91 98250 11223",
      email: "sales@suratyarn.in",
      leadDays: 7,
      rating: 4.8,
    },
    {
      name: "Coimbatore Spinning Ltd",
      contactPerson: "K. Subramanian",
      phone: "+91 94430 44556",
      email: "orders@coimbatorespinning.com",
      leadDays: 10,
      rating: 4.5,
    },
  ];

  for (const s of suppliers) {
    await SupplierModel.findOneAndUpdate(
      { tenantId, name: s.name },
      { ...s, tenantId },
      { upsert: true, new: true }
    );
  }
  logger.info("Suppliers seeded");

  // 4. Seed Processes
  const processes = [
    { name: "Warping", code: "WARP", sequence: 1, costPerUnitPaise: 150, unit: "meters" },
    { name: "Sizing", code: "SIZE", sequence: 2, costPerUnitPaise: 200, unit: "meters" },
    { name: "Weaving", code: "WEAV", sequence: 3, costPerUnitPaise: 800, unit: "meters" },
    { name: "Inspection", code: "INSP", sequence: 4, costPerUnitPaise: 100, unit: "meters" },
  ];

  for (const p of processes) {
    await ProcessModel.findOneAndUpdate(
      { tenantId, code: p.code },
      { ...p, tenantId },
      { upsert: true, new: true }
    );
  }
  logger.info("Processes seeded");

  // 5. Seed Workforce
  const workers = [
    { workerCode: "WRK-001", name: "Murugan P.", phone: "+91 98401 00001", skillLevel: "senior", active: true },
    { workerCode: "WRK-002", name: "Ramesh Kumar", phone: "+91 98401 00002", skillLevel: "senior", active: true },
    { workerCode: "WRK-003", name: "Selvam S.", phone: "+91 98401 00003", skillLevel: "mid", active: true },
    { workerCode: "WRK-004", name: "Karthik R.", phone: "+91 98401 00004", skillLevel: "mid", active: true },
    { workerCode: "WRK-005", name: "Muthu V.", phone: "+91 98401 00005", skillLevel: "junior", active: true },
  ];

  for (const w of workers) {
    await WorkerModel.findOneAndUpdate(
      { tenantId, workerCode: w.workerCode },
      { ...w, tenantId },
      { upsert: true, new: true }
    );
  }
  logger.info("Workers seeded");

  logger.info("Seed completed successfully!");
}

if (process.argv[1]?.endsWith("seed.ts") || process.argv[1]?.endsWith("seed.js")) {
  mongoose
    .connect(env.MONGODB_URI)
    .then(async () => {
      await runSeed();
      await mongoose.disconnect();
      process.exit(0);
    })
    .catch((err) => {
      logger.error({ error: err }, "Seed script failed");
      process.exit(1);
    });
}
