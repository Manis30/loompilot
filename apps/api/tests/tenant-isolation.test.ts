import { describe, it, beforeAll, afterAll, beforeEach, expect } from "vitest";
import { setupTestDB, teardownTestDB, clearTestDB } from "./setup.js";
import mongoose from "mongoose";
import { UserRole, QuotationStatus, OrderStatus, DeliveryStatus, AlertType, AlertSeverity, ProcessName, MaterialType } from "@loompilot/shared";

// All 12 repositories
import { MongoUserRepository } from "../src/repositories/user.repository.js";
import { MongoCustomerRepository } from "../src/repositories/customer.repository.js";
import { MongoEnquiryRepository } from "../src/repositories/enquiry.repository.js";
import { MongoQuotationRepository } from "../src/repositories/quotation.repository.js";
import { MongoMaterialRepository } from "../src/repositories/material.repository.js";
import { MongoSupplierRepository } from "../src/repositories/supplier.repository.js";
import { MongoProcessRepository } from "../src/repositories/process.repository.js";
import { MongoWorkforceRepository } from "../src/repositories/workforce.repository.js";
import { MongoOrderRepository } from "../src/repositories/order.repository.js";
import { MongoAlertRepository } from "../src/repositories/alert.repository.js";
import { MongoDeliveryRepository } from "../src/repositories/delivery.repository.js";
import { MongoPaymentRepository } from "../src/repositories/payment.repository.js";

describe("Table-Driven: Complete Tenant Isolation Across All Repositories", () => {
  const tenantA = "tenant_isolation_alpha";
  const tenantB = "tenant_isolation_beta";

  beforeAll(async () => {
    await setupTestDB();
  }, 60000);

  afterAll(async () => {
    await teardownTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  const testCases = [
    {
      repoName: "MongoUserRepository",
      createFn: async () => {
        const repo = new MongoUserRepository();
        const user = await repo.create({
          tenantId: tenantA,
          email: "user_a@alpha.test",
          name: "User Alpha",
          passwordHash: "hash123",
          role: UserRole.OWNER,
        });
        return {
          id: user.id,
          queryB: async () => repo.findById(tenantB, user.id),
          listB: async () => repo.list(tenantB),
        };
      },
    },
    {
      repoName: "MongoCustomerRepository",
      createFn: async () => {
        const repo = new MongoCustomerRepository();
        const customer = await repo.create({
          tenantId: tenantA,
          name: "Customer Alpha",
          code: "CUST-A",
          contactPerson: "Arjun Verma",
          email: "arjun@alpha.test",
          phone: "+91 9876543210",
          creditPeriodDays: 30,
        });
        return {
          id: customer.id,
          queryB: async () => repo.findById(tenantB, customer.id),
          listB: async () => (await repo.list(tenantB)).items,
        };
      },
    },
    {
      repoName: "MongoEnquiryRepository",
      createFn: async () => {
        const repo = new MongoEnquiryRepository();
        const enquiry = await repo.create({
          tenantId: tenantA,
          enquiryNumber: "ENQ-00001",
          customerId: new mongoose.Types.ObjectId().toString(),
          customerName: "Customer Alpha",
          rawText: "Need 1000m sheeting",
          status: "new",
        });
        return {
          id: enquiry.id,
          queryB: async () => repo.findById(tenantB, enquiry.id),
          listB: async () => (await repo.list(tenantB)).items,
        };
      },
    },
    {
      repoName: "MongoQuotationRepository",
      createFn: async () => {
        const repo = new MongoQuotationRepository();
        const quotation = await repo.create({
          tenantId: tenantA,
          enquiryId: new mongoose.Types.ObjectId().toString(),
          customerId: new mongoose.Types.ObjectId().toString(),
          quotationNumber: "QT-00001",
          lineItems: [],
          materialCostPaise: 100000,
          subtotalCostPaise: 100000,
          marginPct: 15,
          finalPricePaise: 115000,
          etaDate: "2026-11-20",
          validUntil: "2026-11-10",
          status: QuotationStatus.DRAFT,
          explanation: "Alpha quote",
        });
        return {
          id: quotation.id,
          queryB: async () => repo.findById(tenantB, quotation.id),
          listB: async () => (await repo.list(tenantB)).items,
        };
      },
    },
    {
      repoName: "MongoMaterialRepository",
      createFn: async () => {
        const repo = new MongoMaterialRepository();
        const material = await repo.create({
          tenantId: tenantA,
          code: "MAT-A",
          name: "Yarn Alpha",
          type: MaterialType.YARN,
          unit: "kg",
          onHandQuantity: 500,
          reservedQuantity: 0,
          currentRatePaise: 25000,
          avgCostPaise: 24000,
        });
        return {
          id: material.id,
          queryB: async () => repo.findById(tenantB, material.id),
          listB: async () => (await repo.list(tenantB)).items,
        };
      },
    },
    {
      repoName: "MongoSupplierRepository",
      createFn: async () => {
        const repo = new MongoSupplierRepository();
        const supplier = await repo.create({
          tenantId: tenantA,
          name: "Supplier Alpha",
          contactPerson: "Rajesh Shah",
          email: "rajesh@alpha.test",
          phone: "+91 9876543210",
          leadDays: 7,
        });
        return {
          id: supplier.id,
          queryB: async () => repo.findById(tenantB, supplier.id),
          listB: async () => (await repo.list(tenantB)).items,
        };
      },
    },
    {
      repoName: "MongoProcessRepository",
      createFn: async () => {
        const repo = new MongoProcessRepository();
        const process = await repo.create({
          tenantId: tenantA,
          name: ProcessName.WEAVING,
          sequence: 1,
          costPerUnitPaise: 500,
          unit: "meters",
        });
        return {
          id: process.id,
          queryB: async () => repo.findById(tenantB, process.id),
          listB: async () => repo.listAllOrdered(tenantB),
        };
      },
    },
    {
      repoName: "MongoWorkforceRepository (Worker)",
      createFn: async () => {
        const repo = new MongoWorkforceRepository();
        const worker = await repo.createWorker({
          tenantId: tenantA,
          workerCode: "WRK-A",
          name: "Worker Alpha",
          active: true,
        });
        return {
          id: worker.id,
          queryB: async () => repo.findWorkerById(tenantB, worker.id),
          listB: async () => (await repo.listWorkers(tenantB)).items,
        };
      },
    },
    {
      repoName: "MongoOrderRepository",
      createFn: async () => {
        const repo = new MongoOrderRepository();
        const order = await repo.create({
          tenantId: tenantA,
          quotationId: new mongoose.Types.ObjectId().toString(),
          customerId: new mongoose.Types.ObjectId().toString(),
          orderNumber: "PO-A001",
          productName: "Fabric Alpha",
          totalQuantity: 1000,
          unit: "meters",
          status: OrderStatus.PLANNED,
          startDate: "2026-11-01",
          targetDeliveryDate: "2026-11-15",
          plan: [],
        });
        return {
          id: order.id,
          queryB: async () => repo.findById(tenantB, order.id),
          listB: async () => (await repo.list(tenantB)).items,
        };
      },
    },
    {
      repoName: "MongoAlertRepository",
      createFn: async () => {
        const repo = new MongoAlertRepository();
        const alert = await repo.upsertAlert({
          tenantId: tenantA,
          orderId: new mongoose.Types.ObjectId().toString(),
          processId: new mongoose.Types.ObjectId().toString(),
          date: "2026-10-28",
          type: AlertType.DELAY_WARNING,
          severity: AlertSeverity.HIGH,
          title: "Delay Alpha",
          message: "Output behind target",
          metrics: {
            requiredDaily: 100,
            actualRate: 50,
            deficitQty: 50,
            delayDaysEstimated: 1,
          },
        });
        return {
          id: alert.id,
          queryB: async () => repo.findAlertById(tenantB, alert.id),
          listB: async () => (await repo.listAlerts(tenantB)).items,
        };
      },
    },
    {
      repoName: "MongoDeliveryRepository",
      createFn: async () => {
        const repo = new MongoDeliveryRepository();
        const delivery = await repo.create({
          tenantId: tenantA,
          orderId: new mongoose.Types.ObjectId().toString(),
          customerId: new mongoose.Types.ObjectId().toString(),
          deliveryNumber: "DEL-A001",
          deliveredQuantity: 1000,
          deliveryDate: "2026-11-14",
          status: DeliveryStatus.DELIVERED,
          isOnTime: true,
          totalInvoicePaise: 5000000,
        });
        return {
          id: delivery.id,
          queryB: async () => repo.findById(tenantB, delivery.id),
          listB: async () => (await repo.list(tenantB)).items,
        };
      },
    },
    {
      repoName: "MongoPaymentRepository",
      createFn: async () => {
        const repo = new MongoPaymentRepository();
        const payment = await repo.create({
          tenantId: tenantA,
          deliveryId: new mongoose.Types.ObjectId().toString(),
          orderId: new mongoose.Types.ObjectId().toString(),
          customerId: new mongoose.Types.ObjectId().toString(),
          invoiceNumber: "INV-A001",
          totalInvoicePaise: 5000000,
          amountReceivedPaise: 0,
          balancePaise: 5000000,
          dueDate: "2026-12-15",
          paymentTerms: "Net 30",
        });
        return {
          id: payment.id,
          queryB: async () => repo.findById(tenantB, payment.id),
          listB: async () => (await repo.list(tenantB)).items,
        };
      },
    },
  ];

  it.each(testCases)(
    "$repoName: data created under Tenant A is completely invisible to Tenant B",
    async ({ createFn }) => {
      const { queryB, listB } = await createFn();

      // Querying by ID under Tenant B must return null
      const itemUnderB = await queryB();
      expect(itemUnderB).toBeNull();

      // Listing items under Tenant B must return an empty array (0 items)
      const listUnderB = await listB();
      expect(listUnderB).toHaveLength(0);
    }
  );
});
