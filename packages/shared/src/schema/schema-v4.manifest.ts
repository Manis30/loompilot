/**
 * LoomPilot MongoDB Atlas Schema v4 Manifest (Source of Truth)
 *
 * Defines the optimized 14-collection domain architecture + 8 platform collections (Total: 22 collections).
 * Conforms to `docs/schema/loompilot_optimized_schema.png` and LoomPilot Application Workflow Overview v1.3.
 *
 * Conventions:
 * 1. ObjectId refs across all collections (tenantId is String).
 * 2. Integer paise via paise: true on all monetary fields.
 * 3. YYYY-MM-DD business dates.
 * 4. Common fields: tenantId, createdAt, updatedAt, version.
 * 5. select: false on security-sensitive fields (passwordHash, costing).
 * 6. Hard document-level caps on unbounded arrays.
 */

export interface ManifestField {
  type: "String" | "Number" | "Boolean" | "Date" | "ObjectId" | "Mixed" | "Array";
  ref?: string;
  description?: string;
  enum?: readonly string[];
  paise?: boolean;
  allowSigned?: boolean;
  required?: boolean;
  select?: boolean;
  cap?: number;
  maxBytes?: number;
  default?: any;
  embedded?: Record<string, ManifestField>;
  items?: ManifestField;
}

export interface ManifestIndex {
  fields: Record<string, 1 | -1>;
  unique?: boolean;
  sparse?: boolean;
  expireAfterSeconds?: number;
  partialFilterExpression?: Record<string, any>;
}

export interface CollectionManifest {
  modelName: string;
  collectionName: string;
  isDomain: boolean;
  adminOnly?: boolean;
  fields: Record<string, ManifestField>;
  indexes: ManifestIndex[];
}

export const COLLECTION_MAP: Record<string, string> = {
  clientAccounts: "clients.portalAccess",
  marketSources: "settings.marketSources[]",
  priceObservations: "marketPrices.observations[]",
  priceHistory: "marketPrices",
  priceAlerts: "marketPrices.alert",
  feasibilityReports: "orders.feasibility (latest; history in agentRuns.outputSnapshot)",
  quotations: "orders.quotation",
  quotationRevisions: "orders.quotation.revisions[]",
  quotationCostings: "orders.costing (select:false, admin only)",
  orderAssignments: "orders.production.assignedSupervisors[]",
  purchaseDecisions: "orders.purchaseDecisions[]",
  deliveries: "orders.deliveries[]",
  payments: "orders.financials.milestones[]",
  reservations: "orders.reservations[] + materials.reservedQty + stockMovements",
  dailyOutputs: "supervisorDailyReports.outputs[] (+ running totals in orders.production.stageTotals[])",
  machineStatusLogs: "supervisorDailyReports.machines[]",
  monitoringSnapshots: "orders.production.monitoring (latest)",
  alerts: "derived from domain state + notifications(kind=alert, dedupeKey); machine issues -> maintenanceTickets",
  messages: "conversations.messages[]",
  escalations: "conversations.escalation",
  clientInteractions: "dropped (covered by auditLogs and conversations)",
};

export const SCHEMA_V4_MANIFEST: Record<string, CollectionManifest> = {
  // =========================================================================
  // 1. IDENTITY & CONFIG (3 Domain Collections)
  // =========================================================================

  SettingsModel: {
    modelName: "Settings",
    collectionName: "settings",
    isDomain: true,
    fields: {
      timezone: { type: "String", default: "Asia/Kolkata", required: true },
      minMarginPct: { type: "Number", required: true },
      defaultMarginPct: { type: "Number", required: true },
      advancePct: { type: "Number", default: 30, required: true },
      processConfig: {
        type: "Array",
        required: true,
        items: {
          type: "Mixed",
          embedded: {
            area: { type: "String", required: true },
            hours: { type: "Number", required: true },
            overlap: { type: "Boolean", required: true },
            fallbackOut: { type: "Number" },
            usualWorkers: { type: "Number" },
          },
        },
      },
      holidays: {
        type: "Array",
        items: { type: "String" }, // 'YYYY-MM-DD'
        required: true,
      },
      marketRuntime: { type: "String", default: "06:00", required: true },
      reportCutoff: { type: "String", default: "19:00", required: true },
      weeklyOffs: {
        type: "Array",
        items: { type: "Number" }, // 0-6 ints
        required: true,
        default: [0],
      },
      safetyDays: { type: "Number" },
      quoteValidityDays: { type: "Number" },
      riskBuffer: {
        type: "Mixed",
        embedded: {
          k: { type: "Number" },
          minPct: { type: "Number" },
          maxPct: { type: "Number" },
          windowDays: { type: "Number" },
        },
      },
      behindThresholdPct: { type: "Number" },
      maxBackdateDays: { type: "Number" },
      priceThresholds: {
        type: "Mixed",
        embedded: {
          daily: { type: "Number" },
          sevenday: { type: "Number" },
          vol: { type: "Number" },
        },
      },
      quoteReminderDays: {
        type: "Array",
        items: { type: "Number" },
        default: [1],
      },
      paymentReminderLeadDays: { type: "Number", default: 1 },
      basePriceTolerancePct: { type: "Number" },
      marketSources: {
        type: "Array",
        items: {
          type: "Mixed",
          embedded: {
            name: { type: "String", required: true },
            type: { type: "String", enum: ["supplier_quote", "web", "feed"], required: true },
            trust: { type: "String", enum: ["trusted", "normal", "unverified"], required: true },
            active: { type: "Boolean", default: true },
            lastFetchedAt: { type: "Date" },
            lastStatus: { type: "String" },
            config: { type: "Mixed" },
          },
        },
      },
    },
    indexes: [{ fields: { tenantId: 1 }, unique: true }],
  },

  UserModel: {
    modelName: "User",
    collectionName: "users",
    isDomain: true,
    fields: {
      role: { type: "String", enum: ["admin", "supervisor"], required: true },
      name: { type: "String", required: true },
      email: { type: "String" },
      phone: { type: "String" },
      passwordHash: { type: "String", required: true, select: false },
      processAreas: {
        type: "Array",
        items: { type: "String" },
        required: true,
      },
      status: { type: "String", enum: ["active", "locked"], default: "active", required: true },
      notificationPrefs: {
        type: "Mixed",
        embedded: {
          inApp: { type: "Boolean", default: true },
          email: { type: "Boolean", default: true },
          wa: { type: "Boolean", default: false },
          sms: { type: "Boolean", default: false },
        },
      },
      lockout: {
        type: "Mixed",
        embedded: {
          failedCount: { type: "Number", default: 0 },
          lockedUntil: { type: "Date" },
        },
      },
    },
    indexes: [{ fields: { tenantId: 1, email: 1 }, unique: true }],
  },

  ClientModel: {
    modelName: "Client",
    collectionName: "clients",
    isDomain: true,
    fields: {
      clientName: { type: "String", required: true },
      contactPerson: { type: "String" },
      email: { type: "String" },
      phone: { type: "String" },
      city: { type: "String" },
      address: { type: "String" },
      customerType: { type: "String" },
      paymentTermsDays: { type: "Number" },
      country: { type: "String" },
      status: { type: "String", enum: ["active", "inactive"], default: "active", required: true },
      portalAccess: {
        type: "Mixed",
        embedded: {
          email: { type: "String" },
          passwordHash: { type: "String", select: false },
          status: { type: "String", enum: ["invited", "active", "locked"], default: "invited" },
          invitedBy: { type: "ObjectId", ref: "User" },
          invitedAt: { type: "Date" },
          acceptedAt: { type: "Date" },
          lockout: {
            type: "Mixed",
            embedded: {
              failedCount: { type: "Number", default: 0 },
              lockedUntil: { type: "Date" },
            },
          },
          notificationPrefs: {
            type: "Mixed",
            embedded: {
              inApp: { type: "Boolean", default: true },
              email: { type: "Boolean", default: true },
              wa: { type: "Boolean", default: false },
              sms: { type: "Boolean", default: false },
            },
          },
        },
      },
    },
    indexes: [
      {
        fields: { tenantId: 1, "portalAccess.email": 1 },
        unique: true,
        partialFilterExpression: { "portalAccess.email": { $type: "string" } },
      },
      { fields: { tenantId: 1, clientName: 1 } },
    ],
  },

  // =========================================================================
  // 2. CATALOG & MARKET PRICES (5 Domain Collections)
  // =========================================================================

  SupplierModel: {
    modelName: "Supplier",
    collectionName: "suppliers",
    isDomain: true,
    fields: {
      supplierName: { type: "String", required: true },
      contactPerson: { type: "String" },
      email: { type: "String" },
      phone: { type: "String", required: true },
      city: { type: "String", required: true },
      country: { type: "String" },
      defaultLeadTimeDays: { type: "Number" },
      status: { type: "String", enum: ["active", "inactive"], default: "active", required: true },
    },
    indexes: [{ fields: { tenantId: 1, supplierName: 1 } }],
  },

  MaterialModel: {
    modelName: "Material",
    collectionName: "materials",
    isDomain: true,
    fields: {
      materialName: { type: "String", required: true },
      type: {
        type: "String",
        enum: ["yarn", "fabric", "dye_chemical", "trim", "packing"],
        required: true,
      },
      stockQty: { type: "Number", default: 0, required: true },
      reservedQty: { type: "Number", default: 0, required: true },
      reorderLevel: { type: "Number", default: 0, required: true },
      currentRatePaise: { type: "Number", paise: true, required: true },
      preferredSupplierId: { type: "ObjectId", ref: "Supplier" },
      supplierOffers: {
        type: "Array",
        items: {
          type: "Mixed",
          embedded: {
            supplierId: { type: "ObjectId", ref: "Supplier", required: true },
            ratePaise: { type: "Number", paise: true, required: true },
            leadDays: { type: "Number", required: true },
          },
        },
      },
      unit: { type: "String", required: true },
      watchlist: { type: "Boolean" },
    },
    indexes: [
      { fields: { tenantId: 1, type: 1 } },
      { fields: { tenantId: 1, materialName: 1 } },
    ],
  },

  MachineModel: {
    modelName: "Machine",
    collectionName: "machines",
    isDomain: true,
    fields: {
      machineCode: { type: "String", required: true },
      machineName: { type: "String", required: true },
      processArea: { type: "String", required: true },
      capacityUnitsPerDay: { type: "Number", required: true },
      currentStatus: {
        type: "String",
        enum: ["available", "maint", "breakdown"],
        default: "available",
        required: true,
      },
      machineType: { type: "String" },
    },
    indexes: [{ fields: { tenantId: 1, machineCode: 1 }, unique: true }],
  },

  ProductModel: {
    modelName: "Product",
    collectionName: "products",
    isDomain: true,
    fields: {
      productName: { type: "String", required: true },
      category: { type: "String", required: true },
      basePricePaise: { type: "Number", paise: true, required: true },
      routing: {
        type: "Array",
        required: true,
        items: {
          type: "Mixed",
          embedded: {
            stage: { type: "String", required: true },
            seq: { type: "Number", required: true },
            stdMinPerUnit: { type: "Number", required: true }, // Rule 4: stdMinPerUnit
          },
        },
      },
      bom: {
        type: "Array",
        required: true,
        items: {
          type: "Mixed",
          embedded: {
            materialId: { type: "ObjectId", ref: "Material", required: true },
            qtyPerUnit: { type: "Number", required: true }, // Rule 4: qtyPerUnit
            wastage: { type: "Number", default: 0 },
          },
        },
      },
      imageFileIds: {
        type: "Array",
        items: { type: "ObjectId", ref: "File" },
      },
      active: { type: "Boolean" },
    },
    indexes: [{ fields: { tenantId: 1, productName: 1 } }],
  },

  MarketPriceModel: {
    modelName: "MarketPrice",
    collectionName: "marketPrices",
    isDomain: true,
    fields: {
      materialId: { type: "ObjectId", ref: "Material", required: true },
      date: { type: "String", required: true }, // YYYY-MM-DD
      consolidatedPricePaise: { type: "Number", paise: true, required: true },
      change1dPct: { type: "Number" },
      change7dPct: { type: "Number" },
      volatility: { type: "Number" },
      method: { type: "String", enum: ["baseline", "median"] },
      sourceCount: { type: "Number" },
      hasUnverifiedMove: { type: "Boolean" },
      observations: {
        type: "Array",
        cap: 20,
        items: {
          type: "Mixed",
          embedded: {
            source: { type: "String", required: true },
            sourceType: { type: "String", enum: ["supplier_quote", "web", "feed"], required: true },
            unitPricePaise: { type: "Number", paise: true, required: true },
            trust: { type: "String", enum: ["trusted", "normal", "unverified"], required: true },
            verificationStatus: {
              type: "String",
              enum: ["verified", "pending", "rejected"],
              default: "pending",
              required: true,
            },
          },
        },
      },
      alert: {
        type: "Mixed",
        embedded: {
          thresholdBreached: { type: "String", required: true },
          status: {
            type: "String",
            enum: ["open", "ack", "resolved", "dismissed"],
            default: "open",
            required: true,
          },
          acknowledgedBy: { type: "ObjectId", ref: "User" },
          affectedOrderIds: {
            type: "Array",
            items: { type: "ObjectId", ref: "Order" },
          },
          agentRunId: { type: "ObjectId", ref: "AgentRun" },
        },
      },
    },
    indexes: [{ fields: { tenantId: 1, materialId: 1, date: 1 }, unique: true }],
  },

  // =========================================================================
  // 3. ORDERS & PRODUCTION FLOOR (6 Domain Collections)
  // =========================================================================

  OrderModel: {
    modelName: "Order",
    collectionName: "orders",
    isDomain: true,
    fields: {
      // Identity Block
      orderNumber: { type: "String", required: true },
      clientId: { type: "ObjectId", ref: "Client", required: true },
      productId: {
        type: "ObjectId",
        ref: "Product",
        description: "Catalog product FK (optional when productDescription is present)",
      },
      quantity: { type: "Number", required: true },
      deliveryDeadline: { type: "String", required: true }, // YYYY-MM-DD
      status: {
        type: "String",
        enum: [
          "submitted",
          "analyzing",
          "analysis_failed",
          "awaiting_admin_decision",
          "quotation_drafting",
          "quotation_pending_approval",
          "quotation_sent",
          "client_accepted",
          "assigned",
          "in_production",
          "ready_for_delivery",
          "partially_delivered",
          "delivered",
          "completed",
          "declined_by_client",
          "rejected_by_admin",
          "expired",
          "cancelled",
          "on_hold",
        ],
        default: "submitted",
        required: true,
      },
      spec: {
        type: "Mixed",
        required: true,
        embedded: {
          sizes: { type: "Array", items: { type: "String" }, required: true },
          gsm: { type: "Number" },
          colours: { type: "Array", items: { type: "String" } },
          fabric: { type: "String" },
          print: { type: "String" },
        },
      },
      productDescription: { type: "String" },
      estimatedCompletionDate: { type: "String" }, // YYYY-MM-DD
      statusHistory: {
        type: "Array",
        cap: 200,
        items: {
          type: "Mixed",
          embedded: {
            status: { type: "String", required: true },
            by: { type: "ObjectId", ref: "User" },
            at: { type: "Date", required: true },
            reason: { type: "String" },
          },
        },
      },
      source: {
        type: "String",
        enum: ["client_portal", "admin_manual", "import"],
        default: "admin_manual",
        required: true,
      },
      requestVersion: { type: "Number", default: 1 },
      parentOrderId: { type: "ObjectId", ref: "Order" },
      deliveryAddress: { type: "String" },
      deliveryNotes: { type: "String" },
      referenceFiles: {
        type: "Array",
        items: { type: "ObjectId", ref: "File" },
      },
      idempotencyKey: { type: "String" },

      // Feasibility Subdocument
      feasibility: {
        type: "Mixed",
        embedded: {
          verdict: { type: "String", enum: ["feasible", "at_risk", "infeasible"] },
          etaDate: { type: "String" }, // YYYY-MM-DD
          bottleneckProcess: { type: "String" },
          materialRequirements: {
            type: "Array",
            items: {
              type: "Mixed",
              embedded: {
                materialId: { type: "ObjectId", ref: "Material", required: true },
                req: { type: "Number", required: true },
                avail: { type: "Number", required: true },
                short: { type: "Number", required: true },
              },
            },
          },
          version: { type: "Number", default: 1 },
          status: {
            type: "String",
            enum: ["running", "ready", "failed", "superseded"],
            default: "running",
          },
          materialReadyDate: { type: "String" }, // YYYY-MM-DD
          processChecks: {
            type: "Array",
            items: {
              type: "Mixed",
              embedded: {
                stage: { type: "String", required: true },
                labourCap: { type: "Number" },
                machineCap: { type: "Number" },
                load: { type: "Number" },
                free: { type: "Number" },
                days: { type: "Number" },
                start: { type: "String" },
                end: { type: "String" },
              },
            },
          },
          riskFactors: {
            type: "Array",
            items: {
              type: "Mixed",
              embedded: {
                type: { type: "String", required: true },
                severity: { type: "String", enum: ["low", "medium", "high"], required: true },
              },
            },
          },
          recoveryOptions: {
            type: "Array",
            items: {
              type: "Mixed",
              embedded: {
                optionId: { type: "String", required: true },
                type: { type: "String", required: true },
                details: {
                  type: "Mixed",
                  embedded: {
                    supplierId: { type: "ObjectId", ref: "Supplier" },
                    supplierName: { type: "String" },
                    sourceType: { type: "String", enum: ["supplier", "local_market"] },
                    rate: { type: "Number" },
                    leadDays: { type: "Number" },
                    qty: { type: "Number" },
                  },
                },
                etaEffect: { type: "Number", default: 0 },
                priceEffect: { type: "Number", default: 0 },
              },
            },
          },
          reasonsSummary: { type: "String" },
          lowData: { type: "Boolean", default: false },
          dataBasis: { type: "Mixed" },
          inputsSnapshot: { type: "Mixed" },
          adminDecision: {
            type: "Mixed",
            embedded: {
              choice: { type: "String", required: true },
              optionId: { type: "String" },
              by: { type: "ObjectId", ref: "User", required: true },
              at: { type: "Date", required: true },
            },
          },
          agentRunId: { type: "ObjectId", ref: "AgentRun" },
        },
      },

      // Quotation Subdocument
      quotation: {
        type: "Mixed",
        embedded: {
          unitPricePaise: { type: "Number", paise: true },
          totalPaise: { type: "Number", paise: true },
          etaDate: { type: "String" }, // YYYY-MM-DD
          paymentSchedule: {
            type: "Array",
            items: {
              type: "Mixed",
              embedded: {
                milestone: { type: "String", required: true },
                trigger: { type: "String", enum: ["advance", "stage"], required: true },
                stage: { type: "String" },
                percent: { type: "Number", required: true },
                amountPaise: { type: "Number", paise: true, required: true },
                dueDate: { type: "String" }, // YYYY-MM-DD
              },
            },
          },
          version: { type: "Number", default: 1 },
          status: {
            type: "String",
            enum: [
              "generating",
              "generation_failed",
              "pending_approval",
              "approved",
              "sent",
              "accepted",
              "declined",
              "rejected",
              "expired",
              "superseded",
            ],
            default: "generating",
          },
          generationError: {
            type: "Mixed",
            embedded: {
              code: { type: "String" },
              message: { type: "String" },
              at: { type: "Date" },
            },
          },
          lineItems: {
            type: "Array",
            items: {
              type: "Mixed",
              embedded: {
                desc: { type: "String", required: true },
                qty: { type: "Number", required: true },
                unitPricePaise: { type: "Number", paise: true, required: true },
              },
            },
          },
          validUntil: { type: "String" }, // YYYY-MM-DD
          processPlan: {
            type: "Array",
            items: {
              type: "Mixed",
              embedded: {
                stage: { type: "String", required: true },
                start: { type: "String", required: true },
                end: { type: "String", required: true },
                dailyTarget: { type: "Number", required: true },
              },
            },
          },
          etaBasis: {
            type: "Mixed",
            embedded: {
              supplierLead: { type: "Number" },
              prodDays: { type: "Number" },
              safetyDays: { type: "Number" },
            },
          },
          explanation: { type: "String" }, // Admin-internal only
          clientExplanation: { type: "String" },
          termsVersion: { type: "String" },
          priceVariationClause: { type: "String" },
          lockedMaterials: {
            type: "Array",
            items: { type: "ObjectId", ref: "Material" },
          },
          marginWarning: { type: "Boolean", default: false },
          basePriceWarning: { type: "Boolean", default: false },
          lowData: { type: "Boolean", default: false },
          clientResponse: {
            type: "Mixed",
            embedded: {
              decision: { type: "String", required: true },
              reason: { type: "String" },
              by: { type: "ObjectId", ref: "Client" },
              quotationVersion: { type: "Number", required: true },
              at: { type: "Date", required: true },
            },
          },
          approvedBy: { type: "ObjectId", ref: "User" },
          approvedAt: { type: "Date" },
          sentAt: { type: "Date" },
          clientPdfFileId: { type: "ObjectId", ref: "File" },
          agentRunId: { type: "ObjectId", ref: "AgentRun" },
          revisions: {
            type: "Array",
            cap: 20,
            items: {
              type: "Mixed",
              embedded: {
                revisionNo: { type: "Number", required: true },
                reasonType: {
                  type: "String",
                  enum: ["price_surge", "admin_edit", "discount", "date_change"],
                  required: true,
                },
                priceAlertRef: {
                  type: "Mixed",
                  embedded: {
                    materialId: { type: "ObjectId", ref: "Material" },
                    date: { type: "String" },
                  },
                },
                oldPricePaise: { type: "Number", paise: true, required: true },
                newPricePaise: { type: "Number", paise: true, required: true },
                changePct: { type: "Number", required: true },
                newEtaDate: { type: "String" },
                clientReason: { type: "String", required: true },
                status: {
                  type: "String",
                  enum: ["proposed", "approved", "sent", "accepted", "declined", "superseded"],
                  default: "proposed",
                  required: true,
                },
                approvedBy: { type: "ObjectId", ref: "User" },
                approvedAt: { type: "Date" },
                sentAt: { type: "Date" },
                clientDecision: {
                  type: "Mixed",
                  embedded: {
                    decision: { type: "String" },
                    reason: { type: "String" },
                    quotationVersion: { type: "Number" },
                    at: { type: "Date" },
                  },
                },
                agentRunId: { type: "ObjectId", ref: "AgentRun" },
              },
            },
          },
        },
      },

      // Costing Subdocument (ADMIN ONLY, select: false)
      costing: {
        type: "Mixed",
        select: false,
        embedded: {
          materialCosts: {
            type: "Array",
            items: {
              type: "Mixed",
              embedded: {
                materialId: { type: "ObjectId", ref: "Material", required: true },
                qty: { type: "Number", required: true },
                ratePaise: { type: "Number", paise: true, required: true },
                paise: { type: "Number", paise: true, required: true },
              },
            },
          },
          processingCosts: {
            type: "Array",
            items: {
              type: "Mixed",
              embedded: {
                stage: { type: "String", required: true },
                costing: { type: "Mixed" },
                paise: { type: "Number", paise: true, required: true },
              },
            },
          },
          marginPct: { type: "Number", required: true },
          marginPaise: { type: "Number", paise: true, required: true },
          wastagePaise: { type: "Number", paise: true, default: 0 },
          riskBufferPaise: { type: "Number", paise: true, default: 0 },
          overheadPaise: { type: "Number", paise: true, default: 0 },
          totalCostPaise: { type: "Number", paise: true, required: true },
          formulaVersion: { type: "String", default: "v4" },
          revisions: {
            type: "Array",
            items: {
              type: "Mixed",
              embedded: {
                revisionNo: { type: "Number", required: true },
                costDrivers: { type: "Mixed" },
                deltaPaise: { type: "Number", paise: true, allowSigned: true, required: true },
              },
            },
          },
          inputsSnapshot: { type: "Mixed" },
          agentRunId: { type: "ObjectId", ref: "AgentRun" },
        },
      },

      // Purchase Decisions Subdocument Array (cap 50)
      purchaseDecisions: {
        type: "Array",
        cap: 50,
        items: {
          type: "Mixed",
          embedded: {
            decisionId: { type: "String", required: true },
            optionId: { type: "String" },
            materialId: { type: "ObjectId", ref: "Material", required: true },
            supplierId: { type: "ObjectId", ref: "Supplier" },
            qty: { type: "Number", required: true },
            ratePaise: { type: "Number", paise: true, required: true },
            expectedArrivalDate: { type: "String" },
            decidedBy: { type: "ObjectId", ref: "User", required: true },
            decidedAt: { type: "Date", required: true },
            supplierOrder: {
              type: "Mixed",
              embedded: {
                orderNo: { type: "String", required: true },
                status: {
                  type: "String",
                  enum: ["ordered", "partially_received", "received", "cancelled"],
                  default: "ordered",
                },
                recvQty: { type: "Number", default: 0 },
                recvAt: { type: "Date" },
              },
            },
          },
        },
      },

      // Reservations Subdocument Array
      reservations: {
        type: "Array",
        items: {
          type: "Mixed",
          embedded: {
            materialId: { type: "ObjectId", ref: "Material", required: true },
            qty: { type: "Number", required: true },
            status: {
              type: "String",
              enum: ["active", "released", "consumed"],
              default: "active",
              required: true,
            },
          },
        },
      },

      // Production Subdocument
      production: {
        type: "Mixed",
        embedded: {
          assignedSupervisors: {
            type: "Array",
            items: {
              type: "Mixed",
              embedded: {
                supervisorId: { type: "ObjectId", ref: "User", required: true },
                processes: { type: "Array", items: { type: "String" }, required: true },
                acknowledgedAt: { type: "Date" },
              },
            },
          },
          phase: { type: "String" },
          percentComplete: { type: "Number", default: 0 },
          producedQty: { type: "Number", default: 0 },
          deliveredQty: { type: "Number", default: 0 },
          processPlan: {
            type: "Array",
            items: {
              type: "Mixed",
              embedded: {
                stage: { type: "String", required: true },
                start: { type: "String", required: true },
                end: { type: "String", required: true },
                dailyTarget: { type: "Number", required: true },
              },
            },
          },
          assignmentStatus: {
            type: "String",
            enum: ["assigned", "started", "done"],
            default: "assigned",
          },
          assignedBy: { type: "ObjectId", ref: "User" },
          assignedAt: { type: "Date" },
          stageTotals: {
            type: "Array",
            items: {
              type: "Mixed",
              embedded: {
                stage: { type: "String", required: true },
                produced: { type: "Number", default: 0 },
                defective: { type: "Number", default: 0 },
              },
            },
          },
          monitoring: {
            type: "Mixed",
            embedded: {
              requiredDailyOutput: { type: "Number" },
              actualRate: { type: "Number" },
              projectedFinish: { type: "String" },
              status: {
                type: "String",
                enum: ["on_track", "at_risk", "behind"],
                default: "on_track",
              },
              stale: { type: "Boolean", default: false },
              byStage: {
                type: "Array",
                items: {
                  type: "Mixed",
                  embedded: {
                    stage: { type: "String", required: true },
                    produced: { type: "Number", default: 0 },
                    percent: { type: "Number", default: 0 },
                  },
                },
              },
              recommendations: { type: "Array", items: { type: "String" } },
              updatedAt: { type: "Date" },
              agentRunId: { type: "ObjectId", ref: "AgentRun" },
            },
          },
        },
      },

      // Financials Subdocument
      financials: {
        type: "Mixed",
        embedded: {
          advanceReceivedPaise: { type: "Number", paise: true, default: 0 },
          totalPaidPaise: { type: "Number", paise: true, default: 0 },
          milestones: {
            type: "Array",
            cap: 12,
            items: {
              type: "Mixed",
              embedded: {
                milestone: { type: "String", required: true },
                trigger: { type: "String", enum: ["advance", "stage"], required: true },
                stage: { type: "String" },
                amountPaise: { type: "Number", paise: true, required: true },
                dueDate: { type: "String" },
                status: {
                  type: "String",
                  enum: ["pending", "partial", "received", "overdue"],
                  default: "pending",
                  required: true,
                },
                reminderSentAt: { type: "Date" },
                receivedPaise: { type: "Number", paise: true, default: 0 },
                invoiceNo: { type: "String" },
                razorpayOrderId: { type: "String" },
                receipts: {
                  type: "Array",
                  cap: 50,
                  items: {
                    type: "Mixed",
                    embedded: {
                      amountPaise: { type: "Number", paise: true, required: true },
                      method: {
                        type: "String",
                        enum: ["razorpay", "neft", "rtgs", "upi", "cheque", "cash"],
                        required: true,
                      },
                      ref: { type: "String", required: true },
                      date: { type: "String", required: true },
                      by: { type: "ObjectId", ref: "User" },
                      razorpayPaymentId: { type: "String" },
                      reversedAt: { type: "Date" },
                    },
                  },
                },
              },
            },
          },
        },
      },

      // Deliveries Array (cap 50)
      deliveries: {
        type: "Array",
        cap: 50,
        items: {
          type: "Mixed",
          embedded: {
            deliveryDate: { type: "String", required: true }, // YYYY-MM-DD
            qty: { type: "Number", required: true },
            invoiceNo: { type: "String", required: true },
            invoiceAmountPaise: { type: "Number", paise: true, required: true },
            onTime: { type: "Boolean", required: true },
            delayDays: { type: "Number", default: 0 },
            recordedBy: { type: "ObjectId", ref: "User", required: true },
          },
        },
      },
    },
    indexes: [
      { fields: { tenantId: 1, orderNumber: 1 }, unique: true },
      { fields: { tenantId: 1, status: 1, deliveryDeadline: 1 } },
      { fields: { tenantId: 1, clientId: 1, createdAt: 1 } },
      { fields: { tenantId: 1, "production.assignedSupervisors.supervisorId": 1, status: 1 } },
      { fields: { tenantId: 1, "financials.milestones.status": 1, "financials.milestones.dueDate": 1 } },
      {
        fields: {
          tenantId: 1,
          "financials.milestones.receipts.razorpayPaymentId": 1,
        },
      },
      {
        fields: { tenantId: 1, idempotencyKey: 1 },
        unique: true,
        partialFilterExpression: { idempotencyKey: { $type: "string" } },
      },
    ],
  },

  SupervisorDailyReportModel: {
    modelName: "SupervisorDailyReport",
    collectionName: "supervisorDailyReports",
    isDomain: true,
    fields: {
      reportDate: { type: "String", required: true }, // YYYY-MM-DD
      supervisorId: { type: "ObjectId", ref: "User", required: true },
      processAreas: { type: "Array", items: { type: "String" }, required: true },
      employeesPresentTotal: { type: "Number", required: true },
      workforce: {
        type: "Array",
        items: {
          type: "Mixed",
          embedded: {
            area: { type: "String", required: true },
            count: { type: "Number", required: true },
          },
        },
      },
      resources: {
        type: "Mixed",
        embedded: {
          machinesAvail: { type: "Number", required: true },
          machinesDown: { type: "Number", default: 0 },
        },
      },
      stockCounts: {
        type: "Array",
        items: {
          type: "Mixed",
          embedded: {
            materialId: { type: "ObjectId", ref: "Material", required: true },
            qty: { type: "Number", required: true },
          },
        },
      },
      outputs: {
        type: "Array",
        items: {
          type: "Mixed",
          embedded: {
            orderId: { type: "ObjectId", ref: "Order", required: true },
            stage: { type: "String", required: true },
            produced: { type: "Number", required: true },
            defective: { type: "Number", default: 0 },
          },
        },
      },
      machines: {
        type: "Array",
        items: {
          type: "Mixed",
          embedded: {
            machineId: { type: "ObjectId", ref: "Machine", required: true },
            status: { type: "String", enum: ["available", "maint", "breakdown"], required: true },
            hours: { type: "Number", required: true },
            remarks: { type: "String" },
          },
        },
      },
      issues: {
        type: "Array",
        items: {
          type: "Mixed",
          embedded: {
            type: {
              type: "String",
              enum: ["machine", "shortage", "delay", "quality", "other"],
              required: true,
            },
            notes: { type: "String", required: true },
            machineId: { type: "ObjectId", ref: "Machine" },
          },
        },
      },
      status: {
        type: "String",
        enum: ["draft", "submitted", "corrected"],
        default: "draft",
        required: true,
      },
      submittedAt: { type: "Date" },
      isLate: { type: "Boolean", default: false },
      corrections: {
        type: "Array",
        items: {
          type: "Mixed",
          embedded: {
            reason: { type: "String", required: true },
            by: { type: "ObjectId", ref: "User", required: true },
            at: { type: "Date", required: true },
          },
        },
      },
      clientGeneratedId: { type: "String" },
    },
    indexes: [
      { fields: { tenantId: 1, supervisorId: 1, reportDate: 1 }, unique: true },
      { fields: { tenantId: 1, "outputs.orderId": 1, reportDate: 1 } },
      {
        fields: { tenantId: 1, clientGeneratedId: 1 },
        unique: true,
        partialFilterExpression: { clientGeneratedId: { $type: "string" } },
      },
    ],
  },

  ConversationModel: {
    modelName: "Conversation",
    collectionName: "conversations",
    isDomain: true,
    fields: {
      orderId: { type: "ObjectId", ref: "Order", required: true },
      clientId: { type: "ObjectId", ref: "Client", required: true },
      status: {
        type: "String",
        enum: ["agent_handling", "escalated", "admin_handling", "resolved"],
        default: "agent_handling",
        required: true,
      },
      assignedAdminId: { type: "ObjectId", ref: "User" },
      lastMessageAt: { type: "Date" },
      messages: {
        type: "Array",
        cap: 2000,
        items: {
          type: "Mixed",
          embedded: {
            senderType: { type: "String", enum: ["client", "assistant", "admin"], required: true },
            text: { type: "String", required: true },
            guardrail: {
              type: "Mixed",
              embedded: {
                passed: { type: "Boolean", required: true },
                issues: { type: "Array", items: { type: "String" } },
              },
            },
            visibility: {
              type: "String",
              enum: ["client_visible", "admin_note"],
              default: "client_visible",
            },
            figuresChecked: {
              type: "Array",
              items: {
                type: "Mixed",
                embedded: {
                  field: { type: "String", required: true },
                  value: { type: "Mixed" },
                  ok: { type: "Boolean", required: true },
                },
              },
            },
            readAt: { type: "Date" },
            createdAt: { type: "Date", required: true },
            agentRunId: { type: "ObjectId", ref: "AgentRun" },
          },
        },
      },
      escalation: {
        type: "Mixed",
        embedded: {
          type: {
            type: "String",
            enum: ["discount", "extra_demand", "unsure", "complaint"],
            required: true,
          },
          summary: { type: "String", required: true },
          resolution: {
            type: "Mixed",
            embedded: {
              by: { type: "ObjectId", ref: "User", required: true },
              at: { type: "Date", required: true },
              outcome: { type: "String", required: true },
              notes: { type: "String" },
            },
          },
          currentPricePaise: { type: "Number", paise: true },
          status: {
            type: "String",
            enum: ["open", "in_progress", "resolved"],
            default: "open",
            required: true,
          },
          assignedTo: { type: "ObjectId", ref: "User" },
        },
      },
      escalationHistory: { type: "Array", items: { type: "Mixed" } },
    },
    indexes: [{ fields: { tenantId: 1, orderId: 1 }, unique: true }],
  },

  MaintenanceTicketModel: {
    modelName: "MaintenanceTicket",
    collectionName: "maintenanceTickets",
    isDomain: true,
    fields: {
      machineId: { type: "ObjectId", ref: "Machine", required: true },
      sourceReportId: { type: "ObjectId", ref: "SupervisorDailyReport" },
      issue: { type: "String", required: true },
      technicianName: { type: "String" }, // External contractor, not User (required on open->assigned)
      technicianContact: { type: "String" },
      status: {
        type: "String",
        enum: ["open", "assigned", "resolved"],
        default: "open",
        required: true,
      },
      assignedAt: { type: "Date" },
      resolvedAt: { type: "Date" },
      openedBy: { type: "ObjectId", ref: "User" },
      notes: { type: "String" },
    },
    indexes: [{ fields: { tenantId: 1, machineId: 1, status: 1 } }],
  },

  StockMovementModel: {
    modelName: "StockMovement",
    collectionName: "stockMovements",
    isDomain: true,
    fields: {
      materialId: { type: "ObjectId", ref: "Material", required: true },
      type: {
        type: "String",
        enum: ["receipt", "consume", "reserve", "release", "adjust", "opening"],
        required: true,
      },
      qty: { type: "Number", required: true },
      qtyAfter: { type: "Number", required: true },
      orderId: { type: "ObjectId", ref: "Order" },
      reportId: { type: "ObjectId", ref: "SupervisorDailyReport" },
      purchaseDecisionRef: {
        type: "Mixed",
        embedded: {
          orderId: { type: "ObjectId", ref: "Order", required: true },
          decisionId: { type: "String", required: true },
        },
      },
    },
    indexes: [{ fields: { tenantId: 1, materialId: 1, createdAt: 1 } }],
  },

  AgentRunModel: {
    modelName: "AgentRun",
    collectionName: "agentRuns",
    isDomain: true,
    fields: {
      agent: {
        type: "String",
        enum: ["feasibility", "quotation", "market", "chat", "monitoring", "admin_assistant"],
        required: true,
      },
      trigger: { type: "String", required: true },
      orderId: { type: "ObjectId", ref: "Order" },
      status: { type: "String", required: true },
      timings: { type: "Mixed" },
      decision: { type: "Mixed" },
      guardrails: { type: "Mixed" },
      model: { type: "String" },
      tokens: { type: "Mixed" },
      costPaise: { type: "Number", paise: true, default: 0 },
      requestId: { type: "String" },
      promptVersion: { type: "String" },
      schemaVersion: { type: "String" },
      retryOfRunId: { type: "ObjectId", ref: "AgentRun" },
      error: {
        type: "Mixed",
        embedded: {
          code: { type: "String" },
          message: { type: "String" },
          details: { type: "Mixed" },
        },
      },
      outputSnapshot: { type: "String", maxBytes: 65536 }, // cap <= 64KB
    },
    indexes: [
      { fields: { tenantId: 1, agent: 1, createdAt: 1 } },
      { fields: { tenantId: 1, orderId: 1, createdAt: 1 } },
    ],
  },

  // =========================================================================
  // 4. PLATFORM & INFRASTRUCTURE (8 Collections)
  // =========================================================================

  RefreshTokenModel: {
    modelName: "RefreshToken",
    collectionName: "refreshTokens",
    isDomain: false,
    fields: {
      realm: { type: "String", enum: ["user", "client"], required: true },
      subjectId: { type: "ObjectId", required: true }, // ref User or Client by realm
      familyId: { type: "String", required: true },
      tokenHash: { type: "String", required: true },
      expiresAt: { type: "Date", required: true },
      revokedAt: { type: "Date" },
      replacedByTokenHash: { type: "String" },
    },
    indexes: [
      { fields: { tokenHash: 1 }, unique: true },
      { fields: { tenantId: 1, realm: 1, subjectId: 1 } },
      { fields: { familyId: 1 } },
      { fields: { expiresAt: 1 }, expireAfterSeconds: 0 },
    ],
  },

  IdempotencyKeyModel: {
    modelName: "IdempotencyKey",
    collectionName: "idempotencyKeys",
    isDomain: false,
    fields: {
      key: { type: "String", required: true },
      route: { type: "String", required: true },
      requestHash: { type: "String", required: true },
      state: {
        type: "String",
        enum: ["in_progress", "completed"],
        default: "in_progress",
        required: true,
      },
      responseStatus: { type: "Number" },
      responseBody: { type: "Mixed" },
      expiresAt: { type: "Date", required: true },
    },
    indexes: [
      { fields: { tenantId: 1, key: 1, route: 1 }, unique: true },
      { fields: { expiresAt: 1 }, expireAfterSeconds: 0 },
    ],
  },

  AuditLogModel: {
    modelName: "AuditLog",
    collectionName: "auditLogs",
    isDomain: false,
    fields: {
      actor: {
        type: "Mixed",
        required: true,
        embedded: {
          id: { type: "ObjectId" },
          type: { type: "String", enum: ["user", "client", "agent", "system"], required: true },
          email: { type: "String" },
        },
      },
      action: { type: "String", required: true },
      entity: {
        type: "Mixed",
        required: true,
        embedded: {
          collection: { type: "String", required: true },
          id: { type: "String", required: true },
        },
      },
      before: { type: "Mixed" },
      after: { type: "Mixed" },
      ip: { type: "String" },
      requestId: { type: "String" },
    },
    indexes: [
      { fields: { tenantId: 1, createdAt: -1 } },
      { fields: { tenantId: 1, "entity.collection": 1, "entity.id": 1 } },
    ],
  },

  CounterModel: {
    modelName: "Counter",
    collectionName: "counters",
    isDomain: false,
    fields: {
      key: { type: "String", required: true },
      seq: { type: "Number", default: 0, required: true },
    },
    indexes: [{ fields: { tenantId: 1, key: 1 }, unique: true }],
  },

  NotificationModel: {
    modelName: "Notification",
    collectionName: "notifications",
    isDomain: false,
    fields: {
      recipient: {
        type: "Mixed",
        required: true,
        embedded: {
          userId: { type: "ObjectId", ref: "User" },
          clientId: { type: "ObjectId", ref: "Client" },
        },
      },
      kind: { type: "String", enum: ["notification", "alert"], default: "notification", required: true },
      type: { type: "String", required: true },
      channel: {
        type: "String",
        enum: ["in_app", "email", "whatsapp", "sms"],
        required: true,
      },
      status: {
        type: "String",
        enum: ["pending", "sent", "failed", "delivered"],
        default: "pending",
        required: true,
      },
      attempts: { type: "Number", default: 0 },
      title: { type: "String", required: true },
      body: { type: "String", required: true },
      entity: {
        type: "Mixed",
        embedded: {
          collection: { type: "String", required: true },
          id: { type: "String", required: true },
        },
      },
      dedupeKey: { type: "String" },
      readAt: { type: "Date" },
      resolvedAt: { type: "Date" },
    },
    indexes: [
      { fields: { tenantId: 1, "recipient.userId": 1, createdAt: -1 } },
      { fields: { tenantId: 1, "recipient.clientId": 1, createdAt: -1 } },
      { fields: { tenantId: 1, status: 1 } },
      {
        fields: { tenantId: 1, dedupeKey: 1 },
        unique: true,
        partialFilterExpression: { dedupeKey: { $type: "string" } },
      },
    ],
  },

  OutboxMessageModel: {
    modelName: "OutboxMessage",
    collectionName: "outboxMessages",
    isDomain: false,
    fields: {
      recipient: {
        type: "Mixed",
        required: true,
        embedded: {
          userId: { type: "ObjectId", ref: "User" },
          clientId: { type: "ObjectId", ref: "Client" },
        },
      },
      channel: { type: "String", enum: ["email", "whatsapp", "sms"], required: true },
      status: {
        type: "String",
        enum: ["pending", "processing", "sent", "failed"],
        default: "pending",
        required: true,
      },
      attempts: { type: "Number", default: 0 },
      payload: { type: "Mixed", required: true },
      error: { type: "String" },
      nextAttemptAt: { type: "Date" },
    },
    indexes: [{ fields: { tenantId: 1, status: 1, nextAttemptAt: 1 } }],
  },

  ImportJobModel: {
    modelName: "ImportJob",
    collectionName: "importJobs",
    isDomain: false,
    fields: {
      type: { type: "String", required: true },
      status: {
        type: "String",
        enum: ["pending", "processing", "completed", "failed"],
        default: "pending",
        required: true,
      },
      rowsOk: { type: "Number", default: 0 },
      rowsFailed: { type: "Number", default: 0 },
      errors: {
        type: "Array",
        items: {
          type: "Mixed",
          embedded: {
            row: { type: "Number", required: true },
            error: { type: "String", required: true },
          },
        },
      },
      fileId: { type: "ObjectId", ref: "File", required: true },
      createdBy: { type: "ObjectId", ref: "User", required: true },
    },
    indexes: [{ fields: { tenantId: 1, createdAt: -1 } }],
  },

  FileRecordModel: {
    modelName: "File",
    collectionName: "files",
    isDomain: false,
    fields: {
      ownerRealm: { type: "String", enum: ["user", "client"], required: true },
      ownerId: { type: "ObjectId", required: true },
      storageKey: { type: "String", required: true },
      name: { type: "String", required: true },
      mime: { type: "String", required: true },
      size: { type: "Number", required: true },
    },
    indexes: [{ fields: { tenantId: 1, ownerRealm: 1, ownerId: 1 } }],
  },
};

