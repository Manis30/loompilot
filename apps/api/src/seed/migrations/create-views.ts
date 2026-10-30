import mongoose from "mongoose";
import { logger } from "../../utils/logger.js";
import { QuotationRevisionModel } from "../../models/orders/quotation-revision.model.js";

/**
 * Migration: Create Client-Safe and Agent-Safe Read Views in MongoDB
 *
 * 1. clientSafeOrders:
 *    Maps internal order status to customer-friendly status so no internal statuses reach chat_ro:
 *    (received, under_review, quotation_ready, confirmed, in_production, ready, delivered, closed, declined)
 *    Exposes only client-safe progress fields.
 *
 * 2. clientSafeQuotations:
 *    Exposes approved price, ETA, terms, and clientExplanation for sent/accepted/declined/expired quotations.
 *    Strictly matches customer-visible statuses: ["sent", "accepted", "declined", "expired"].
 *    Excludes internal explanation, assumptions, costings, margins, and inputs snapshots.
 *
 * 3. clientSafeRevisions:
 *    Exposes customer-facing quotation revisions (sent, accepted, declined).
 *    Excludes internal cost drivers, price alert IDs, and raw inputs.
 *
 * 4. agentSafeUsers:
 *    Allows agents_ro read-only access to supervisors/users (id, name, role, processAreas, status)
 *    without exposing password hashes, emails, phone numbers, or lockouts.
 */
export async function createClientSafeViews(
  db: mongoose.mongo.Db = mongoose.connection.db!
): Promise<void> {
  const collections = await db.listCollections().toArray();
  const collectionNames = collections.map((c) => c.name);

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
          clientId: 1,
          orderNumber: 1,
          status: {
            $switch: {
              branches: [
                {
                  case: {
                    $in: ["$status", ["submitted", "analyzing", "analysis_failed"]],
                  },
                  then: "received",
                },
                {
                  case: {
                    $in: [
                      "$status",
                      [
                        "awaiting_admin_decision",
                        "quotation_drafting",
                        "quotation_pending_approval",
                      ],
                    ],
                  },
                  then: "under_review",
                },
                {
                  case: { $eq: ["$status", "quotation_sent"] },
                  then: "quotation_ready",
                },
                {
                  case: {
                    $in: ["$status", ["client_accepted", "assigned"]],
                  },
                  then: "confirmed",
                },
                {
                  case: { $eq: ["$status", "in_production"] },
                  then: "in_production",
                },
                {
                  case: {
                    $in: ["$status", ["ready_for_delivery", "partially_delivered"]],
                  },
                  then: "ready",
                },
                {
                  case: {
                    $in: ["$status", ["delivered", "completed"]],
                  },
                  then: "delivered",
                },
                {
                  case: {
                    $in: [
                      "$status",
                      ["declined_by_client", "rejected_by_admin", "cancelled"],
                    ],
                  },
                  then: "declined",
                },
                {
                  case: {
                    $in: ["$status", ["expired", "on_hold"]],
                  },
                  then: "closed",
                },
              ],
              default: "under_review",
            },
          },
          phase: 1,
          quantity: 1,
          producedQty: 1,
          deliveredQty: 1,
          deliveryDeadline: 1,
          estimatedCompletionDate: 1,
          percentComplete: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      },
    ],
  });

  // 2. clientSafeQuotations View
  if (collectionNames.includes("clientSafeQuotations")) {
    logger.info("Dropping existing clientSafeQuotations view for recreation...");
    await db.collection("clientSafeQuotations").drop();
  }

  logger.info("Creating clientSafeQuotations view on 'quotations' collection...");
  await db.createCollection("clientSafeQuotations", {
    viewOn: "quotations",
    pipeline: [
      {
        $match: {
          status: { $in: ["sent", "accepted", "declined", "expired"] },
        },
      },
      {
        $project: {
          _id: 1,
          tenantId: 1,
          clientId: 1,
          orderId: 1,
          version: 1,
          status: 1,
          lineItems: 1,
          totalPaise: 1,
          unitPricePaise: 1,
          etaDate: 1,
          validUntil: 1,
          clientExplanation: 1,
          termsVersion: 1,
          priceVariationClause: 1,
          sentAt: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      },
    ],
  });

  // 3. clientSafeRevisions View
  if (collectionNames.includes("clientSafeRevisions")) {
    logger.info("Dropping existing clientSafeRevisions view for recreation...");
    await db.collection("clientSafeRevisions").drop();
  }

  const revisionsCollectionName = QuotationRevisionModel.collection?.name || "quotationrevisions";
  logger.info(`Creating clientSafeRevisions view on '${revisionsCollectionName}' collection...`);
  await db.createCollection("clientSafeRevisions", {
    viewOn: revisionsCollectionName,
    pipeline: [
      {
        $match: {
          status: { $in: ["sent", "accepted", "declined"] },
        },
      },
      {
        $project: {
          _id: 1,
          tenantId: 1,
          quotationId: 1,
          orderId: 1,
          reasonType: 1,
          oldPricePaise: 1,
          newPricePaise: 1,
          changePct: 1,
          newEtaDate: 1,
          clientReason: 1,
          clientDrivers: 1,
          status: 1,
          sentAt: 1,
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

  logger.info("Client-safe and agent-safe database views created successfully.");
}
