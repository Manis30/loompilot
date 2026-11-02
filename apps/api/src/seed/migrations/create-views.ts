import mongoose from "mongoose";
import { logger } from "../../utils/logger.js";

/**
 * Migration: Create Client-Safe and Agent-Safe Read Views in MongoDB (Schema v4)
 *
 * 1. clientSafeOrders:
 *    Rewritten for embedded Schema v4 orders.
 *    Strict whitelist $project.
 *    clientStatus derived via $switch following toClientOrderStatus (9 states).
 *    quotation block only when status is sent/accepted/declined/expired.
 *    quotation.revisions filtered to sent/accepted/declined and mapped.
 *    financials.milestones mapped without receipts.
 *    deliveries mapped.
 *    production progress: phase, percentComplete, producedQty, deliveredQty.
 *    NEVER costing, feasibility, statusHistory, assignments, monitoring recommendations, receipts, idempotencyKey.
 *
 * 2. clientSafeProducts:
 *    Active products only ($match: { active: true }).
 *    Whitelist: productName, category, basePricePaise, imageFileIds.
 *
 * 3. agentSafeOrders:
 *    Everything in orders except costing, financials.milestones.receipts, statusHistory, idempotencyKey.
 *
 * 4. agentSafeUsers:
 *    name, role, processAreas, status.
 *
 * 5. agentSafeClients:
 *    clientName, customerType, paymentTermsDays.
 *    NEVER portalAccess, email, phone, contactPerson.
 */
export async function createClientSafeViews(
  db: mongoose.mongo.Db = mongoose.connection.db!
): Promise<void> {
  const collections = await db.listCollections().toArray();
  const collectionNames = collections.map((c) => c.name);

  // Drop obsolete legacy views if they exist
  const obsoleteViews = ["clientSafeQuotations", "clientSafeRevisions"];
  for (const obsolete of obsoleteViews) {
    if (collectionNames.includes(obsolete)) {
      logger.info(`Dropping obsolete view '${obsolete}'...`);
      await db.collection(obsolete).drop();
    }
  }

  // 1. clientSafeOrders View
  if (collectionNames.includes("clientSafeOrders")) {
    logger.info("Dropping existing clientSafeOrders view for recreation...");
    await db.collection("clientSafeOrders").drop();
  }

  logger.info("Creating clientSafeOrders view on 'orders' collection...");
  await db.createCollection("clientSafeOrders", {
    viewOn: "orders",
    pipeline: [
      {
        $project: {
          _id: 1,
          tenantId: 1,
          orderNumber: 1,
          clientId: 1,
          productId: 1,
          quantity: 1,
          deliveryDeadline: 1,
          clientStatus: {
            $switch: {
              branches: [
                { case: { $eq: ["$status", "submitted"] }, then: "received" },
                {
                  case: {
                    $in: [
                      "$status",
                      [
                        "analyzing",
                        "analysis_failed",
                        "awaiting_admin_decision",
                        "quotation_drafting",
                        "quotation_pending_approval",
                      ],
                    ],
                  },
                  then: "under_review",
                },
                { case: { $eq: ["$status", "quotation_sent"] }, then: "quotation_ready" },
                { case: { $in: ["$status", ["client_accepted", "assigned"]] }, then: "confirmed" },
                { case: { $in: ["$status", ["in_production", "on_hold"]] }, then: "in_production" },
                { case: { $in: ["$status", ["ready_for_delivery", "partially_delivered"]] }, then: "ready" },
                { case: { $eq: ["$status", "delivered"] }, then: "delivered" },
                { case: { $eq: ["$status", "completed"] }, then: "closed" },
                {
                  case: {
                    $in: [
                      "$status",
                      ["declined_by_client", "rejected_by_admin", "expired", "cancelled"],
                    ],
                  },
                  then: "declined",
                },
              ],
              default: "under_review",
            },
          },
          quotation: {
            $cond: {
              if: {
                $in: ["$quotation.status", ["sent", "accepted", "declined", "expired"]],
              },
              then: {
                status: "$quotation.status",
                unitPricePaise: "$quotation.unitPricePaise",
                totalPaise: "$quotation.totalPaise",
                etaDate: "$quotation.etaDate",
                validUntil: "$quotation.validUntil",
                paymentSchedule: "$quotation.paymentSchedule",
                clientExplanation: "$quotation.clientExplanation",
                termsVersion: "$quotation.termsVersion",
                priceVariationClause: "$quotation.priceVariationClause",
                revisions: {
                  $map: {
                    input: {
                      $filter: {
                        input: { $ifNull: ["$quotation.revisions", []] },
                        as: "rev",
                        cond: {
                          $in: ["$$rev.status", ["sent", "accepted", "declined"]],
                        },
                      },
                    },
                    as: "r",
                    in: {
                      revisionNo: "$$r.revisionNo",
                      oldPricePaise: "$$r.oldPricePaise",
                      newPricePaise: "$$r.newPricePaise",
                      changePct: "$$r.changePct",
                      newEtaDate: "$$r.newEtaDate",
                      clientReason: "$$r.clientReason",
                      status: "$$r.status",
                    },
                  },
                },
              },
              else: "$$REMOVE",
            },
          },
          financials: {
            milestones: {
              $map: {
                input: { $ifNull: ["$financials.milestones", []] },
                as: "m",
                in: {
                  milestone: "$$m.milestone",
                  amountPaise: "$$m.amountPaise",
                  dueDate: "$$m.dueDate",
                  receivedPaise: "$$m.receivedPaise",
                  status: "$$m.status",
                },
              },
            },
          },
          deliveries: {
            $map: {
              input: { $ifNull: ["$deliveries", []] },
              as: "d",
              in: {
                deliveryDate: "$$d.deliveryDate",
                qty: "$$d.qty",
                invoiceNo: "$$d.invoiceNo",
                onTime: "$$d.onTime",
              },
            },
          },
          phase: 1,
          percentComplete: 1,
          producedQty: 1,
          deliveredQty: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      },
    ],
  });

  // 2. clientSafeProducts View
  if (collectionNames.includes("clientSafeProducts")) {
    logger.info("Dropping existing clientSafeProducts view for recreation...");
    await db.collection("clientSafeProducts").drop();
  }

  logger.info("Creating clientSafeProducts view on 'products' collection...");
  await db.createCollection("clientSafeProducts", {
    viewOn: "products",
    pipeline: [
      { $match: { active: true } },
      {
        $project: {
          _id: 1,
          tenantId: 1,
          productName: 1,
          category: 1,
          basePricePaise: 1,
          imageFileIds: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      },
    ],
  });

  // 3. agentSafeOrders View
  if (collectionNames.includes("agentSafeOrders")) {
    logger.info("Dropping existing agentSafeOrders view for recreation...");
    await db.collection("agentSafeOrders").drop();
  }

  logger.info("Creating agentSafeOrders view on 'orders' collection...");
  await db.createCollection("agentSafeOrders", {
    viewOn: "orders",
    pipeline: [
      {
        $project: {
          _id: 1,
          tenantId: 1,
          orderNumber: 1,
          clientId: 1,
          productId: 1,
          quantity: 1,
          deliveryDeadline: 1,
          status: 1,
          spec: 1,
          productDescription: 1,
          estimatedCompletionDate: 1,
          source: 1,
          requestVersion: 1,
          parentOrderId: 1,
          deliveryAddress: 1,
          deliveryNotes: 1,
          referenceFiles: 1,
          feasibility: 1,
          quotation: 1,
          purchaseDecisions: 1,
          reservations: 1,
          production: 1,
          financials: {
            advanceReceivedPaise: "$financials.advanceReceivedPaise",
            totalPaidPaise: "$financials.totalPaidPaise",
            milestones: {
              $map: {
                input: { $ifNull: ["$financials.milestones", []] },
                as: "m",
                in: {
                  milestone: "$$m.milestone",
                  trigger: "$$m.trigger",
                  stage: "$$m.stage",
                  amountPaise: "$$m.amountPaise",
                  dueDate: "$$m.dueDate",
                  status: "$$m.status",
                  reminderSentAt: "$$m.reminderSentAt",
                  receivedPaise: "$$m.receivedPaise",
                  invoiceNo: "$$m.invoiceNo",
                  razorpayOrderId: "$$m.razorpayOrderId",
                },
              },
            },
          },
          deliveries: 1,
          phase: 1,
          percentComplete: 1,
          producedQty: 1,
          deliveredQty: 1,
          version: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      },
    ],
  });

  // 4. agentSafeUsers View
  if (collectionNames.includes("agentSafeUsers")) {
    logger.info("Dropping existing agentSafeUsers view for recreation...");
    await db.collection("agentSafeUsers").drop();
  }

  logger.info("Creating agentSafeUsers view on 'users' collection...");
  await db.createCollection("agentSafeUsers", {
    viewOn: "users",
    pipeline: [
      {
        $project: {
          _id: 1,
          tenantId: 1,
          name: 1,
          role: 1,
          processAreas: 1,
          status: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      },
    ],
  });

  // 5. agentSafeClients View
  if (collectionNames.includes("agentSafeClients")) {
    logger.info("Dropping existing agentSafeClients view for recreation...");
    await db.collection("agentSafeClients").drop();
  }

  logger.info("Creating agentSafeClients view on 'clients' collection...");
  await db.createCollection("agentSafeClients", {
    viewOn: "clients",
    pipeline: [
      {
        $project: {
          _id: 1,
          tenantId: 1,
          clientName: 1,
          customerType: 1,
          paymentTermsDays: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      },
    ],
  });

  logger.info("All 5 Schema v4 client-safe and agent-safe database views created successfully.");
}
