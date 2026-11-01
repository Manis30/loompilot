import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose, { Model as MongooseModel } from 'mongoose';

// Connect & Config utilities
import { connectMongo, disconnectMongo } from '../apps/api/src/config/database.js';
import { getEnv } from '../apps/api/src/config/env.js';

// Mongoose Models
import { SettingsModel } from '../apps/api/src/models/identity/settings.model.js';
import { UserModel } from '../apps/api/src/models/identity/user.model.js';
import { ClientModel } from '../apps/api/src/models/identity/client.model.js';
import { SupplierModel } from '../apps/api/src/models/identity/supplier.model.js';
import { MaterialModel } from '../apps/api/src/models/catalog/material.model.js';
import { MachineModel } from '../apps/api/src/models/catalog/machine.model.js';
import { ProductModel } from '../apps/api/src/models/catalog/product.model.js';
import { OrderModel } from '../apps/api/src/models/orders/order.model.js';
import { SupervisorDailyReportModel } from '../apps/api/src/models/production/supervisor-daily-report.model.js';
import { MaintenanceTicketModel } from '../apps/api/src/models/production/maintenance-ticket.model.js';
import { StockMovementModel } from '../apps/api/src/models/production/stock-movement.model.js';
import { MarketPriceModel } from '../apps/api/src/models/catalog/market-price.model.js';
import { ConversationModel } from '../apps/api/src/models/interaction/conversation.model.js';
import { AgentRunModel } from '../apps/api/src/models/interaction/agent-run.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const repairedDir = path.join(rootDir, 'data/repaired');

interface CollectionDef {
  name: string;
  file: string;
  model: MongooseModel<any>;
  dependencies: string[];
  extractForeignKeys?: (doc: any) => Array<{ targetCollection: string; id: string }>;
}

// Topological order respecting entity dependencies
const COLLECTION_DEFS: CollectionDef[] = [
  {
    name: 'settings',
    file: 'settings.json',
    model: SettingsModel,
    dependencies: [],
  },
  {
    name: 'users',
    file: 'users.json',
    model: UserModel,
    dependencies: [],
  },
  {
    name: 'clients',
    file: 'clients.json',
    model: ClientModel,
    dependencies: [],
  },
  {
    name: 'suppliers',
    file: 'suppliers.json',
    model: SupplierModel,
    dependencies: [],
  },
  {
    name: 'materials',
    file: 'materials.json',
    model: MaterialModel,
    dependencies: ['suppliers'],
    extractForeignKeys: (doc) => {
      const refs: Array<{ targetCollection: string; id: string }> = [];
      if (doc.preferredSupplierId) {
        refs.push({ targetCollection: 'suppliers', id: String(doc.preferredSupplierId) });
      }
      doc.supplierOffers?.forEach((so: any) => {
        if (so.supplierId) refs.push({ targetCollection: 'suppliers', id: String(so.supplierId) });
      });
      return refs;
    },
  },
  {
    name: 'machines',
    file: 'machines.json',
    model: MachineModel,
    dependencies: [],
  },
  {
    name: 'products',
    file: 'products.json',
    model: ProductModel,
    dependencies: ['materials'],
    extractForeignKeys: (doc) => {
      const refs: Array<{ targetCollection: string; id: string }> = [];
      doc.bom?.forEach((b: any) => {
        if (b.materialId) refs.push({ targetCollection: 'materials', id: String(b.materialId) });
      });
      return refs;
    },
  },
  {
    name: 'orders',
    file: 'orders.json',
    model: OrderModel,
    dependencies: ['clients', 'products', 'materials', 'users'],
    extractForeignKeys: (doc) => {
      const refs: Array<{ targetCollection: string; id: string }> = [];
      if (doc.clientId) refs.push({ targetCollection: 'clients', id: String(doc.clientId) });
      if (doc.productId) refs.push({ targetCollection: 'products', id: String(doc.productId) });
      doc.feasibility?.materialRequirements?.forEach((mr: any) => {
        if (mr.materialId) refs.push({ targetCollection: 'materials', id: String(mr.materialId) });
      });
      doc.costing?.materialCosts?.forEach((mc: any) => {
        if (mc.materialId) refs.push({ targetCollection: 'materials', id: String(mc.materialId) });
      });
      doc.production?.assignedSupervisors?.forEach((as: any) => {
        if (as.supervisorId) refs.push({ targetCollection: 'users', id: String(as.supervisorId) });
      });
      return refs;
    },
  },
  {
    name: 'supervisorDailyReports',
    file: 'supervisorDailyReports.json',
    model: SupervisorDailyReportModel,
    dependencies: ['users', 'orders', 'materials', 'machines'],
    extractForeignKeys: (doc) => {
      const refs: Array<{ targetCollection: string; id: string }> = [];
      if (doc.supervisorId) refs.push({ targetCollection: 'users', id: String(doc.supervisorId) });
      doc.outputs?.forEach((o: any) => {
        if (o.orderId) refs.push({ targetCollection: 'orders', id: String(o.orderId) });
      });
      doc.stockCounts?.forEach((sc: any) => {
        if (sc.materialId) refs.push({ targetCollection: 'materials', id: String(sc.materialId) });
      });
      doc.machines?.forEach((m: any) => {
        if (m.machineId) refs.push({ targetCollection: 'machines', id: String(m.machineId) });
      });
      doc.issues?.forEach((i: any) => {
        if (i.machineId) refs.push({ targetCollection: 'machines', id: String(i.machineId) });
      });
      return refs;
    },
  },
  {
    name: 'maintenanceTickets',
    file: 'maintenanceTickets.json',
    model: MaintenanceTicketModel,
    dependencies: ['machines', 'supervisorDailyReports'],
    extractForeignKeys: (doc) => {
      const refs: Array<{ targetCollection: string; id: string }> = [];
      if (doc.machineId) refs.push({ targetCollection: 'machines', id: String(doc.machineId) });
      if (doc.sourceReportId) refs.push({ targetCollection: 'supervisorDailyReports', id: String(doc.sourceReportId) });
      return refs;
    },
  },
  {
    name: 'stockMovements',
    file: 'stockMovements.json',
    model: StockMovementModel,
    dependencies: ['materials', 'orders', 'supervisorDailyReports'],
    extractForeignKeys: (doc) => {
      const refs: Array<{ targetCollection: string; id: string }> = [];
      if (doc.materialId) refs.push({ targetCollection: 'materials', id: String(doc.materialId) });
      if (doc.orderId) refs.push({ targetCollection: 'orders', id: String(doc.orderId) });
      if (doc.reportId) refs.push({ targetCollection: 'supervisorDailyReports', id: String(doc.reportId) });
      return refs;
    },
  },
  {
    name: 'marketPrices',
    file: 'marketPrices.json',
    model: MarketPriceModel,
    dependencies: ['materials', 'orders'],
    extractForeignKeys: (doc) => {
      const refs: Array<{ targetCollection: string; id: string }> = [];
      if (doc.materialId) refs.push({ targetCollection: 'materials', id: String(doc.materialId) });
      doc.alert?.affectedOrderIds?.forEach((oid: any) => {
        refs.push({ targetCollection: 'orders', id: String(oid) });
      });
      return refs;
    },
  },
  {
    name: 'conversations',
    file: 'conversations.json',
    model: ConversationModel,
    dependencies: ['orders', 'clients', 'users'],
    extractForeignKeys: (doc) => {
      const refs: Array<{ targetCollection: string; id: string }> = [];
      if (doc.orderId) refs.push({ targetCollection: 'orders', id: String(doc.orderId) });
      if (doc.clientId) refs.push({ targetCollection: 'clients', id: String(doc.clientId) });
      if (doc.assignedAdminId) refs.push({ targetCollection: 'users', id: String(doc.assignedAdminId) });
      return refs;
    },
  },
  {
    name: 'agentRuns',
    file: 'agentRuns.json',
    model: AgentRunModel,
    dependencies: ['orders', 'clients', 'materials'],
    extractForeignKeys: (doc) => {
      const refs: Array<{ targetCollection: string; id: string }> = [];
      if (doc.orderId) refs.push({ targetCollection: 'orders', id: String(doc.orderId) });
      if (doc.clientId) refs.push({ targetCollection: 'clients', id: String(doc.clientId) });
      if (doc.materialId) refs.push({ targetCollection: 'materials', id: String(doc.materialId) });
      return refs;
    },
  },
];

interface ImportStats {
  collection: string;
  file: string;
  sourceCount: number;
  existingCount: number;
  toInsert: number;
  toSkip: number;
  inserted: number;
  failed: number;
  validationErrors: number;
  refErrors: number;
  uniqueConflicts: number;
}

const EXPECTED_DB_NAME = 'Loompilot';

export async function runImporter(options: {
  isDryRun: boolean;
  allowProduction: boolean;
  atomic?: boolean;
}): Promise<boolean> {
  const env = getEnv();
  const startTime = Date.now();

  console.log('===============================================================');
  console.log('             LOOMPILOT DATASET IMPORTER (Schema v4)            ');
  console.log('===============================================================');
  console.log(`Execution Mode:     ${options.isDryRun ? 'DRY-RUN (Validation Only, No Database Writes)' : 'LIVE IMPORT (Writing to Database)'}`);
  console.log(`Source Directory:   ${repairedDir}`);
  console.log(`Target Environment: ${env.NODE_ENV}`);
  if (!options.isDryRun) {
    console.log(`Atomicity:          ${options.atomic !== false ? 'TRANSACTIONAL (ACID rollback on failure)' : 'NON-TRANSACTIONAL'}`);
  }

  // Safety Gate 1: Prevent accidental production imports
  if (env.NODE_ENV === 'production' && !options.isDryRun && !options.allowProduction) {
    console.error('\n[SAFETY GATE REJECTION] Target NODE_ENV is "production".');
    console.error('To execute live writes against production, pass: --allow-production');
    return false;
  }

  // 1. Check data directory
  if (!fs.existsSync(repairedDir)) {
    console.error(`[ERROR] Repaired dataset directory does not exist: ${repairedDir}`);
    return false;
  }

  // 2. Connect to MongoDB using existing configuration with retry resilience
  console.log('\nConnecting to MongoDB...');
  let connected = false;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      await connectMongo();
      connected = true;
      break;
    } catch (err: any) {
      console.warn(`[WARN] Connection attempt ${attempt}/4 failed (${err.message}). Retrying in 2s...`);
      if (attempt === 4) throw err;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Failed to obtain MongoDB database reference');
  }

  const targetDbName = db.databaseName;
  const targetHost = mongoose.connection.host;
  console.log(`Connected to Database: "${targetDbName}" on host "${targetHost}"`);

  // Safety Gate 2: Strict Database Name Verification
  if (targetDbName.toLowerCase() !== EXPECTED_DB_NAME.toLowerCase()) {
    console.error(`\n[DATABASE SAFETY GATE REJECTION] Connected database "${targetDbName}" does not match intended database "${EXPECTED_DB_NAME}".`);
    console.error(`Aborting operation to protect non-target databases.`);
    await disconnectMongo();
    return false;
  }
  console.log(`Database Name Guard: Confirmed connection to intended "${targetDbName}" database.`);
  console.log('---------------------------------------------------------------');

  // Known ID registry (combines existing DB IDs + staged dataset IDs)
  const knownIds: Record<string, Set<string>> = {};
  for (const def of COLLECTION_DEFS) {
    knownIds[def.name] = new Set<string>();
  }

  // Load existing IDs from MongoDB into registry
  for (const def of COLLECTION_DEFS) {
    try {
      const existing = await def.model.find({}, { _id: 1 }).lean();
      for (const doc of existing) {
        knownIds[def.name].add(String(doc._id));
      }
    } catch (err: any) {
      console.warn(`[WARN] Could not read existing IDs for collection ${def.name}: ${err.message}`);
    }
  }

  // Load and pre-register all repaired dataset IDs into registry
  const loadedData: Record<string, any[]> = {};
  for (const def of COLLECTION_DEFS) {
    const filePath = path.join(repairedDir, def.file);
    if (!fs.existsSync(filePath)) {
      console.error(`[ERROR] Required file not found: ${filePath}`);
      await disconnectMongo();
      return false;
    }
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const records = Array.isArray(raw) ? raw : [raw];
    loadedData[def.name] = records;
    for (const r of records) {
      if (r._id) {
        knownIds[def.name].add(String(r._id));
      }
    }
  }

  const statsList: ImportStats[] = [];
  let hasErrors = false;

  console.log('\n=== STEP 1: VALIDATING SCHEMAS & CHECKING FOREIGN KEYS ===');

  for (const def of COLLECTION_DEFS) {
    const records = loadedData[def.name];
    let valErrors = 0;
    let refErrors = 0;

    for (let i = 0; i < records.length; i++) {
      const record = records[i];

      // A. Mongoose Schema Validation
      const doc = new def.model(record);
      const valErr = doc.validateSync();
      if (valErr) {
        valErrors++;
        hasErrors = true;
        console.error(`[VALIDATION ERROR] ${def.file} record ${i} (${record._id}): ${valErr.message}`);
      }

      // B. Foreign Key Referential Integrity Check
      if (def.extractForeignKeys) {
        const refs = def.extractForeignKeys(record);
        for (const ref of refs) {
          const targetSet = knownIds[ref.targetCollection];
          if (!targetSet || !targetSet.has(ref.id)) {
            refErrors++;
            hasErrors = true;
            console.error(`[BROKEN REFERENCE] ${def.file} record ${i} references missing ${ref.targetCollection} ID: ${ref.id}`);
          }
        }
      }
    }

    // C. Unique-Index Conflict Check against Existing Records with Different _id
    let uniqueConflicts = 0;
    try {
      const indexes = await def.model.collection.indexes();
      const uniqueIndexes = indexes.filter((idx) => idx.unique && idx.name !== '_id_');

      if (uniqueIndexes.length > 0) {
        const existingDocs = await def.model.find().lean();
        if (existingDocs.length > 0) {
          for (const uIdx of uniqueIndexes) {
            const keys = Object.keys(uIdx.key);
            for (let i = 0; i < records.length; i++) {
              const record = records[i];
              const query: any = {};
              for (const k of keys) {
                const val = k.includes('.')
                  ? k.split('.').reduce((obj: any, key: string) => obj?.[key], record)
                  : record[k];
                if (val !== undefined) {
                  query[k] = val;
                }
              }
              if (Object.keys(query).length === keys.length) {
                const match = existingDocs.find((ed: any) => {
                  return keys.every((k) => {
                    const edVal = k.includes('.')
                      ? k.split('.').reduce((obj: any, key: string) => obj?.[key], ed)
                      : ed[k];
                    return String(edVal) === String(query[k]);
                  });
                });
                if (match && String(match._id) !== String(record._id)) {
                  uniqueConflicts++;
                  hasErrors = true;
                  console.error(
                    `[UNIQUE INDEX CONFLICT] ${def.file} record ${i} (${record._id}) conflicts with existing DB document ${match._id} on unique index "${uIdx.name}": ${JSON.stringify(query)}`
                  );
                }
              }
            }
          }
        }
      }
    } catch (err: any) {
      console.warn(`[WARN] Could not inspect unique indexes for ${def.name}: ${err.message}`);
    }

    // Check DB for existing records to compute insert vs skip counts
    const docIds = records.map((r) => r._id).filter(Boolean);
    const existingInDb = await def.model.find({ _id: { $in: docIds } }, { _id: 1 }).lean();
    const existingInDbSet = new Set(existingInDb.map((d) => String(d._id)));

    const toInsertCount = records.filter((r) => !existingInDbSet.has(String(r._id))).length;
    const toSkipCount = records.length - toInsertCount;
    const currentDbTotal = await def.model.countDocuments();

    statsList.push({
      collection: def.name,
      file: def.file,
      sourceCount: records.length,
      existingCount: currentDbTotal,
      toInsert: toInsertCount,
      toSkip: toSkipCount,
      inserted: 0,
      failed: 0,
      validationErrors: valErrors,
      refErrors,
      uniqueConflicts,
    });
  }

  // Print Step 1 Validation Summary Table
  console.log('\nSchema, Referential & Unique-Index Validation Summary:');
  console.table(
    statsList.map((s) => ({
      Collection: s.collection,
      Source: s.sourceCount,
      'DB Total (Pre)': s.existingCount,
      'To Insert': s.toInsert,
      'To Skip (Exist)': s.toSkip,
      'Val Errors': s.validationErrors,
      'Ref Errors': s.refErrors,
      'Unique Conflicts': s.uniqueConflicts,
      Status: s.validationErrors === 0 && s.refErrors === 0 && s.uniqueConflicts === 0 ? 'READY' : 'INVALID',
    }))
  );

  if (hasErrors) {
    console.error('\n[HALT] Validation, referential integrity, or unique index conflicts detected. Aborting.');
    await disconnectMongo();
    return false;
  }

  // Step 2: Database Operations (Dry-Run vs Live Execution)
  const totalSourceRecords = statsList.reduce((acc, s) => acc + s.sourceCount, 0);
  if (options.isDryRun) {
    console.log('\n=== STEP 2: DRY-RUN COMPLETED (NO DATABASE WRITES PERFORMED) ===');
    console.log('✓ Zero records were inserted or modified.');
    console.log(`✓ All 14 files and ${totalSourceRecords} records are 100% valid and ready for live import.`);
    console.log(`✓ Total documents that will be inserted upon execution: ${statsList.reduce((acc, s) => acc + s.toInsert, 0)}`);
    console.log(`✓ Total documents that will be skipped (already exist): ${statsList.reduce((acc, s) => acc + s.toSkip, 0)}`);
  } else {
    console.log('\n=== STEP 2: EXECUTING LIVE DATABASE IMPORT ===');

    // Strict Pre-Write Database Name Assertion
    if (targetDbName.toLowerCase() !== EXPECTED_DB_NAME.toLowerCase()) {
      console.error(`[CRITICAL ABORT] Pre-write assertion failed: Database name is "${targetDbName}", expected "${EXPECTED_DB_NAME}".`);
      await disconnectMongo();
      return false;
    }

    const useTransaction = options.atomic !== false;
    let session: mongoose.ClientSession | null = null;
    if (useTransaction) {
      console.log('Starting atomic MongoDB transaction (ACID rollback on any failure)...');
      session = await mongoose.startSession();
      session.startTransaction();
    }

    let importFailed = false;

    try {
      for (const def of COLLECTION_DEFS) {
        const records = loadedData[def.name];
        const stats = statsList.find((s) => s.collection === def.name)!;

        // Filter only new records to insert (idempotency guarantee)
        const docIds = records.map((r) => r._id).filter(Boolean);
        const existingInDb = await def.model.find({ _id: { $in: docIds } }, { _id: 1 }).lean();
        const existingSet = new Set(existingInDb.map((d) => String(d._id)));
        const newRecords = records.filter((r) => !existingSet.has(String(r._id)));

        if (newRecords.length > 0) {
          console.log(`Inserting ${newRecords.length} records into "${def.name}"...`);
          try {
            const insertOptions: any = { ordered: false };
            if (session) {
              insertOptions.session = session;
            }
            await def.model.insertMany(newRecords, insertOptions);
            stats.inserted = newRecords.length;
            stats.failed = 0;
          } catch (err: any) {
            importFailed = true;
            // Extract accurate inserted & write errors count from BulkWriteError
            const insertedCount = err.result?.nInserted ?? err.insertedDocs?.length ?? 0;
            const writeErrors = err.writeErrors || err.result?.writeErrors || [];
            stats.inserted = insertedCount;
            stats.failed = writeErrors.length > 0 ? writeErrors.length : newRecords.length - insertedCount;

            console.error(`\n[INSERTION ERROR] Failed during "${def.name}" insert: ${err.message}`);
            if (writeErrors.length > 0) {
              console.error(`  Total write errors in batch: ${writeErrors.length}`);
              for (const we of writeErrors.slice(0, 5)) {
                console.error(`  - Index ${we.index}: [Code ${we.code}] ${we.errmsg}`);
              }
              if (writeErrors.length > 5) {
                console.error(`  ... and ${writeErrors.length - 5} more write errors.`);
              }
            }

            if (session) {
              console.error(`\n[ABORTING TRANSACTION] Rolling back all writes across all collections...`);
              await session.abortTransaction();
              session.endSession();
              session = null;
              break;
            }
          }
        } else {
          console.log(`Skipping "${def.name}": all ${records.length} records already exist in database.`);
          stats.inserted = 0;
          stats.failed = 0;
        }
      }

      if (session && !importFailed) {
        await session.commitTransaction();
        session.endSession();
        console.log('\n✓ Transaction successfully committed. All writes applied atomically.');
      }
    } catch (err: any) {
      if (session) {
        await session.abortTransaction();
        session.endSession();
      }
      console.error('\n[FATAL ERROR DURING IMPORT]:', err.message);
      importFailed = true;
    }

    // Print final live execution summary
    console.log('\nFinal Live Import Execution Summary:');
    console.table(
      statsList.map((s) => ({
        Collection: s.collection,
        Source: s.sourceCount,
        'Pre-DB': s.existingCount,
        'To Insert': s.toInsert,
        Skipped: s.toSkip,
        Inserted: s.inserted,
        Failed: s.failed,
        Status: s.failed > 0 ? 'FAILED' : s.inserted > 0 ? 'INSERTED' : 'SKIPPED',
      }))
    );

    if (importFailed) {
      console.error('\n[IMPORT FAILED] One or more errors occurred.');
      if (useTransaction) {
        console.error('Because atomic transaction was enabled, no partial writes were persisted to the database.');
      }
      await disconnectMongo();
      return false;
    }

    console.log('\n✓ Live import completed successfully.');
  }

  await disconnectMongo();
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\nOperation finished in ${elapsed}s.`);
  console.log('===============================================================\n');

  return true;
}

// CLI Execution Entry Point
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const isExecute = args.includes('--execute') || args.includes('--commit');
  const isDryRun = args.includes('--dry-run') || !isExecute;
  const allowProduction = args.includes('--allow-production');
  const atomic = !args.includes('--no-transaction');

  runImporter({ isDryRun, allowProduction, atomic })
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((err) => {
      console.error('\nFatal importer error:', err);
      process.exit(1);
    });
}
