import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Import Mongoose models
import { AgentRunModel } from '../apps/api/src/models/interaction/agent-run.model.js';
import { ClientModel } from '../apps/api/src/models/identity/client.model.js';
import { ConversationModel } from '../apps/api/src/models/interaction/conversation.model.js';
import { MachineModel } from '../apps/api/src/models/catalog/machine.model.js';
import { MaintenanceTicketModel } from '../apps/api/src/models/production/maintenance-ticket.model.js';
import { MarketPriceModel } from '../apps/api/src/models/catalog/market-price.model.js';
import { MaterialModel } from '../apps/api/src/models/catalog/material.model.js';
import { OrderModel } from '../apps/api/src/models/orders/order.model.js';
import { ProductModel } from '../apps/api/src/models/catalog/product.model.js';
import { SettingsModel } from '../apps/api/src/models/identity/settings.model.js';
import { StockMovementModel } from '../apps/api/src/models/production/stock-movement.model.js';
import { SupervisorDailyReportModel } from '../apps/api/src/models/production/supervisor-daily-report.model.js';
import { SupplierModel } from '../apps/api/src/models/identity/supplier.model.js';
import { UserModel } from '../apps/api/src/models/identity/user.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const sourceDatasetDir = 'C:/Users/MANI S/.gemini/antigravity/brain/92c7484d-34ef-4061-8c20-76fbe4f1e53b/scratch/extracted_dataset/dataset';
const backupDir = path.join(rootDir, 'data/backup_original');
const repairedDir = path.join(rootDir, 'data/repaired');
const idMappingPath = path.join(rootDir, 'data/id-mapping.json');

// Ensure output directories exist
fs.mkdirSync(backupDir, { recursive: true });
fs.mkdirSync(repairedDir, { recursive: true });

// 1. Create backup of original dataset
const sourceFiles = fs.readdirSync(sourceDatasetDir).filter(f => f.endsWith('.json'));
console.log(`=== 1. CREATING BACKUP OF ORIGINAL DATASET (${sourceFiles.length} files) ===`);
for (const file of sourceFiles) {
  const src = path.join(sourceDatasetDir, file);
  const dest = path.join(backupDir, file);
  fs.copyFileSync(src, dest);
}
console.log(`Backup created at: ${backupDir}\n`);

// 2. Deterministic ID normalization tracker
const idMapping: Record<string, { newId: string; entityType: string; occurrences: number }> = {};

function normalizeId(id: string, entityType: string = 'unknown'): string {
  if (typeof id !== 'string') return id;
  let newId = id;
  if (/^[0-9a-fA-F]{23}$/.test(id)) {
    // 23 chars: insert '0' after 6-char prefix
    newId = id.slice(0, 6) + '0' + id.slice(6);
  } else if (/^[0-9a-fA-F]{20}$/.test(id)) {
    // 20 chars: insert '0000' after 6-char prefix
    newId = id.slice(0, 6) + '0000' + id.slice(6);
  }

  if (newId !== id) {
    if (!idMapping[id]) {
      idMapping[id] = { newId, entityType, occurrences: 0 };
    }
    idMapping[id].occurrences++;
  }
  return newId;
}

// 3. Load collections
const rawCollections: Record<string, any> = {};
for (const file of sourceFiles) {
  const content = fs.readFileSync(path.join(sourceDatasetDir, file), 'utf8');
  rawCollections[file] = JSON.parse(content);
}

// 4. Transform collections
console.log('=== 2. REPAIRING DATASET COLLECTIONS ===');

const repaired: Record<string, any> = {};

// Users
repaired['users.json'] = rawCollections['users.json'];

// Clients
repaired['clients.json'] = rawCollections['clients.json'];

// Suppliers
repaired['suppliers.json'] = rawCollections['suppliers.json'];

// Machines
repaired['machines.json'] = rawCollections['machines.json'];

// Materials
repaired['materials.json'] = rawCollections['materials.json'].map((raw: any) => {
  const m = JSON.parse(JSON.stringify(raw));
  if (m.preferredSupplierId) {
    m.preferredSupplierId = normalizeId(m.preferredSupplierId, 'Supplier');
  }
  if (m.supplierOffers) {
    m.supplierOffers.forEach((so: any) => {
      so.supplierId = normalizeId(so.supplierId, 'Supplier');
    });
  }
  // Enum corrections
  if (m.type === 'dyeing_processing') m.type = 'dye_chemical';
  if (m.type === 'trims') m.type = 'trim';
  return m;
});

// Products
repaired['products.json'] = rawCollections['products.json'].map((raw: any) => {
  const p = JSON.parse(JSON.stringify(raw));
  if (p.bom) {
    p.bom.forEach((b: any) => {
      b.materialId = normalizeId(b.materialId, 'Material');
    });
  }
  return p;
});

// Maintenance Tickets
repaired['maintenanceTickets.json'] = rawCollections['maintenanceTickets.json'].map((raw: any) => {
  const t = JSON.parse(JSON.stringify(raw));
  t._id = normalizeId(t._id, 'MaintenanceTicket');
  t.machineId = normalizeId(t.machineId, 'Machine');
  return t;
});

// Stock Movements
repaired['stockMovements.json'] = rawCollections['stockMovements.json'].map((raw: any) => {
  const sm = JSON.parse(JSON.stringify(raw));
  sm.materialId = normalizeId(sm.materialId, 'Material');
  sm.orderId = normalizeId(sm.orderId, 'Order');
  return sm;
});

// Agent Runs
repaired['agentRuns.json'] = rawCollections['agentRuns.json'].map((raw: any) => {
  const ar = JSON.parse(JSON.stringify(raw));
  ar._id = normalizeId(ar._id, 'AgentRun');
  if (ar.orderId) ar.orderId = normalizeId(ar.orderId, 'Order');
  if (ar.materialId) ar.materialId = normalizeId(ar.materialId, 'Material');
  // Enum corrections
  if (ar.agent === 'marketPrice') ar.agent = 'market';
  if (ar.agent === 'clientAssistant') ar.agent = 'chat';
  return ar;
});

// Conversations
repaired['conversations.json'] = rawCollections['conversations.json'].map((raw: any) => {
  const c = JSON.parse(JSON.stringify(raw));
  c._id = normalizeId(c._id, 'Conversation');
  c.orderId = normalizeId(c.orderId, 'Order');
  c.messages?.forEach((m: any) => {
    if (typeof m.guardrail === 'boolean') {
      m.guardrail = { passed: m.guardrail, issues: [] };
    }
  });
  if (c.escalation && typeof c.escalation.resolution === 'string') {
    c.escalation.resolution = {
      outcome: c.escalation.resolution,
      by: c.assignedAdminId || '668001000000000000000001',
      at: c.createdAt || new Date(),
    };
  }
  return c;
});

// Market Prices
repaired['marketPrices.json'] = rawCollections['marketPrices.json'].map((raw: any) => {
  const mp = JSON.parse(JSON.stringify(raw));
  mp.materialId = normalizeId(mp.materialId, 'Material');
  // Method enum correction
  if (mp.method === 'weighted_average') mp.method = 'median';
  if (mp.alert) {
    if (mp.alert.status === 'acknowledged') mp.alert.status = 'ack';
    if (Array.isArray(mp.alert.affectedOrderIds)) {
      mp.alert.affectedOrderIds = mp.alert.affectedOrderIds.map((id: string) => normalizeId(id, 'Order'));
    }
  }
  return mp;
});

// Settings
const rawSettings = Array.isArray(rawCollections['settings.json'])
  ? rawCollections['settings.json'][0]
  : rawCollections['settings.json'];
const s = JSON.parse(JSON.stringify(rawSettings));
if (s.processConfig) {
  s.processConfig.forEach((pc: any) => {
    pc.overlap = typeof pc.overlap === 'number' ? pc.overlap > 0 : Boolean(pc.overlap);
  });
}
if (typeof s.riskBuffer === 'number') {
  s.riskBuffer = {
    minPct: s.riskBuffer,
    maxPct: s.riskBuffer * 2,
    k: 1.5,
    windowDays: 30,
  };
}
repaired['settings.json'] = [s];

// Supervisor Daily Reports
repaired['supervisorDailyReports.json'] = rawCollections['supervisorDailyReports.json'].map((raw: any) => {
  const r = JSON.parse(JSON.stringify(raw));
  r.machines?.forEach((m: any) => {
    m.machineId = normalizeId(m.machineId, 'Machine');
    if (m.operatingHours !== undefined && m.hours === undefined) m.hours = m.operatingHours;
  });
  r.stockCounts?.forEach((sc: any) => {
    sc.materialId = normalizeId(sc.materialId, 'Material');
    if (sc.qtyOnHand !== undefined && sc.qty === undefined) sc.qty = sc.qtyOnHand;
  });
  r.outputs?.forEach((o: any) => {
    o.orderId = normalizeId(o.orderId, 'Order');
    if (o.producedQty !== undefined && o.produced === undefined) o.produced = o.producedQty;
    if (o.defectiveQty !== undefined && o.defective === undefined) o.defective = o.defectiveQty;
  });
  r.workforce?.forEach((w: any) => {
    if (w.present !== undefined && w.count === undefined) w.count = w.present;
  });
  r.issues?.forEach((iss: any) => {
    if (iss.machineId) iss.machineId = normalizeId(iss.machineId, 'Machine');
    if (iss.issue !== undefined && iss.notes === undefined) iss.notes = iss.issue;
    if (!iss.type) iss.type = iss.machineId ? 'machine' : 'other';
  });
  // Rule 10: ensure employeesPresentTotal equals sum of workforce counts
  if (r.workforce && r.workforce.length > 0) {
    r.employeesPresentTotal = r.workforce.reduce((acc: number, w: any) => acc + (w.count || 0), 0);
  }
  return r;
});

// Orders
repaired['orders.json'] = rawCollections['orders.json'].map((raw: any) => {
  const o = JSON.parse(JSON.stringify(raw));
  o._id = normalizeId(o._id, 'Order');

  // Spec sizes
  if (o.spec && typeof o.spec.sizes === 'object' && !Array.isArray(o.spec.sizes)) {
    if (!o.spec.customFields) o.spec.customFields = {};
    o.spec.customFields.sizeBreakdown = o.spec.sizes;
    o.spec.sizes = Object.keys(o.spec.sizes);
  }

  // Feasibility
  if (o.feasibility?.materialRequirements) {
    o.feasibility.materialRequirements.forEach((m: any) => {
      m.materialId = normalizeId(m.materialId, 'Material');
      if (m.req === undefined) m.req = m.quantityRequired;
      if (m.avail === undefined) m.avail = m.stockAvailable;
      if (m.short === undefined) m.short = m.toPurchase;
    });
  }

  // Quotation
  if (o.quotation) {
    if (!o.quotation.unitPricePaise) o.quotation.unitPricePaise = o.quotedUnitPricePaise;
    if (!o.quotation.totalPaise) o.quotation.totalPaise = o.quotedTotalPaise;
    o.quotation.paymentSchedule?.forEach((p: any) => {
      if (p.trigger === 'advance_acceptance') {
        p.trigger = 'advance';
      } else if (p.trigger && p.trigger !== 'advance' && p.trigger !== 'stage') {
        p.stage = p.trigger;
        p.trigger = 'stage';
      }
    });
  }

  // Costing
  if (o.costing) {
    const matReqMap = new Map<string, number>();
    o.feasibility?.materialRequirements?.forEach((mr: any) => {
      matReqMap.set(String(mr.materialId), mr.req);
    });

    o.costing.materialCosts?.forEach((mc: any) => {
      mc.materialId = normalizeId(mc.materialId, 'Material');
      if (mc.paise === undefined) mc.paise = mc.costPaise;
      if (mc.qty === undefined) {
        mc.qty = matReqMap.get(String(mc.materialId)) || o.quantity || 1;
      }
      if (mc.ratePaise === undefined) {
        mc.ratePaise = mc.qty > 0 ? Math.round(mc.paise / mc.qty) : mc.paise;
      }
    });

    o.costing.processingCosts?.forEach((pc: any) => {
      if (pc.paise === undefined) pc.paise = pc.costPaise;
    });
  }

  // Production
  if (o.production?.processPlan) {
    o.production.processPlan.forEach((pp: any) => {
      if (pp.start === undefined) pp.start = pp.plannedStart;
      if (pp.end === undefined) pp.end = pp.plannedEnd;
      if (pp.dailyTarget === undefined) {
        const startD = new Date(pp.start).getTime();
        const endD = new Date(pp.end).getTime();
        const days = Math.max(1, Math.round((endD - startD) / 86400000));
        pp.dailyTarget = Math.ceil(o.quantity / days);
      }
    });
  }

  // Financials
  if (o.financials?.milestones) {
    o.financials.milestones.forEach((m: any, idx: number) => {
      if (!m.trigger) {
        m.trigger = (idx === 0 || m.milestone?.toLowerCase().includes('advance')) ? 'advance' : 'stage';
      }
      m.receipts?.forEach((r: any) => {
        if (!r.method && r.mode) {
          r.method = r.mode === 'bank_transfer' ? 'neft' : r.mode;
        }
        if (!r.ref && r.refNo) {
          r.ref = r.refNo;
        }
      });
    });
  }

  // Delivery
  if (o.delivery && !o.deliveries) {
    o.deliveries = [
      {
        deliveryDate: o.delivery.deliveryDate,
        qty: o.delivery.qty,
        invoiceNo: o.delivery.invoiceNo,
        invoiceAmountPaise: o.quotedTotalPaise || (o.quantity * (o.quotedUnitPricePaise || 0)),
        onTime: o.delivery.onTime ?? true,
        delayDays: 0,
        recordedBy: '668001000000000000000001',
      },
    ];
  }

  return o;
});

// 5. Write repaired files & ID mapping
console.log('=== 3. WRITING REPAIRED DATASET FILES ===');
for (const [file, data] of Object.entries(repaired)) {
  const filePath = path.join(repairedDir, file);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`Saved: ${filePath} (${Array.isArray(data) ? data.length : 1} records)`);
}

fs.writeFileSync(idMappingPath, JSON.stringify(idMapping, null, 2), 'utf8');
console.log(`Saved ID mapping table (${Object.keys(idMapping).length} unique IDs mapped) to: ${idMappingPath}\n`);

// 6. Revalidate all repaired files against Mongoose models
console.log('=== 4. REVALIDATING REPAIRED FILES AGAINST MONGOOSE SCHEMAS ===');

const modelMap: Record<string, any> = {
  'users.json': UserModel,
  'clients.json': ClientModel,
  'suppliers.json': SupplierModel,
  'machines.json': MachineModel,
  'materials.json': MaterialModel,
  'products.json': ProductModel,
  'maintenanceTickets.json': MaintenanceTicketModel,
  'stockMovements.json': StockMovementModel,
  'agentRuns.json': AgentRunModel,
  'conversations.json': ConversationModel,
  'marketPrices.json': MarketPriceModel,
  'settings.json': SettingsModel,
  'supervisorDailyReports.json': SupervisorDailyReportModel,
  'orders.json': OrderModel,
};

let allValid = true;
const results: Record<string, { total: number; valid: number; invalid: number }> = {};

for (const [file, model] of Object.entries(modelMap)) {
  const records = repaired[file];
  const list = Array.isArray(records) ? records : [records];
  let validCount = 0;
  let invalidCount = 0;
  const errors: string[] = [];

  for (let i = 0; i < list.length; i++) {
    const doc = new model(list[i]);
    const err = doc.validateSync();
    if (err) {
      invalidCount++;
      if (errors.length < 2) errors.push(`Record ${i}: ${err.message}`);
    } else {
      validCount++;
    }
  }

  results[file] = { total: list.length, valid: validCount, invalid: invalidCount };
  console.log(`${file.padEnd(28)} | Total: ${String(list.length).padStart(4)} | Valid: ${String(validCount).padStart(4)} | Invalid: ${String(invalidCount).padStart(4)} | Status: ${invalidCount === 0 ? 'PASS' : 'FAIL'}`);
  if (invalidCount > 0) {
    allValid = false;
    errors.forEach(e => console.log(`   ${e}`));
  }
}

// 7. Verify Referential Integrity on Repaired Dataset
console.log('\n=== 5. VERIFYING REFERENTIAL INTEGRITY ON REPAIRED DATASET ===');

const repIdSets: Record<string, Set<string>> = {};
for (const [file, records] of Object.entries(repaired)) {
  repIdSets[file] = new Set((Array.isArray(records) ? records : [records]).map(r => String(r._id)));
}

function verifyRef(source: string, target: string, getRefs: (r: any) => string[]) {
  const list = Array.isArray(repaired[source]) ? repaired[source] : [repaired[source]];
  const targetSet = repIdSets[target];
  let total = 0;
  let broken = 0;

  for (const r of list) {
    for (const ref of getRefs(r)) {
      if (!ref) continue;
      total++;
      if (!targetSet.has(String(ref))) {
        broken++;
      }
    }
  }
  console.log(`${source.padEnd(28)} -> ${target.padEnd(16)} | Checked: ${String(total).padStart(4)} | Broken: ${broken} | Status: ${broken === 0 ? 'PASS' : 'FAIL'}`);
  if (broken > 0) allValid = false;
}

verifyRef('orders.json', 'clients.json', r => [r.clientId]);
verifyRef('orders.json', 'products.json', r => [r.productId]);
verifyRef('orders.json', 'materials.json', r => {
  const mats: string[] = [];
  r.feasibility?.materialRequirements?.forEach((m: any) => mats.push(m.materialId));
  r.costing?.materialCosts?.forEach((m: any) => mats.push(m.materialId));
  return mats;
});
verifyRef('products.json', 'materials.json', r => (r.bom || []).map((b: any) => b.materialId));
verifyRef('materials.json', 'suppliers.json', r => {
  const sups: string[] = [];
  if (r.preferredSupplierId) sups.push(r.preferredSupplierId);
  (r.supplierOffers || []).forEach((o: any) => sups.push(o.supplierId));
  return sups;
});
verifyRef('conversations.json', 'orders.json', r => [r.orderId]);
verifyRef('conversations.json', 'clients.json', r => [r.clientId]);
verifyRef('conversations.json', 'users.json', r => [r.assignedAdminId]);
verifyRef('agentRuns.json', 'orders.json', r => [r.orderId]);
verifyRef('agentRuns.json', 'clients.json', r => [r.clientId]);
verifyRef('agentRuns.json', 'materials.json', r => [r.materialId]);
verifyRef('maintenanceTickets.json', 'machines.json', r => [r.machineId]);
verifyRef('maintenanceTickets.json', 'supervisorDailyReports.json', r => [r.sourceReportId]);
verifyRef('marketPrices.json', 'materials.json', r => [r.materialId]);
verifyRef('stockMovements.json', 'materials.json', r => [r.materialId]);
verifyRef('stockMovements.json', 'orders.json', r => [r.orderId]);
verifyRef('stockMovements.json', 'supervisorDailyReports.json', r => [r.reportId]);
verifyRef('supervisorDailyReports.json', 'users.json', r => [r.supervisorId]);
verifyRef('supervisorDailyReports.json', 'orders.json', r => (r.outputs || []).map((o: any) => o.orderId));
verifyRef('supervisorDailyReports.json', 'materials.json', r => (r.stockCounts || []).map((s: any) => s.materialId));
verifyRef('supervisorDailyReports.json', 'machines.json', r => (r.machines || []).map((m: any) => m.machineId));

console.log('\n=========================================');
console.log(`FINAL DATASET REPAIR VERIFICATION: ${allValid ? 'ALL PASSED (100% VALID)' : 'FAILURES DETECTED'}`);
console.log('=========================================');

