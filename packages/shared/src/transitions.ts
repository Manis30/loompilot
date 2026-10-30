import { ErrorCode } from "./errors.js";

export interface TransitionContext {
  role?: "admin" | "supervisor";
  reason?: string;
  [key: string]: any;
}

export const TRANSITION_TABLES = {
  order: {
    submitted: ["analyzing", "cancelled"],
    analyzing: ["awaiting_admin_decision", "quotation_drafting", "analysis_failed"],
    analysis_failed: ["awaiting_admin_decision", "cancelled"],
    awaiting_admin_decision: ["quotation_drafting", "rejected_by_admin", "cancelled"],
    quotation_drafting: ["quotation_pending_approval", "cancelled"],
    quotation_pending_approval: ["quotation_sent", "quotation_drafting", "rejected_by_admin", "cancelled"],
    quotation_sent: ["client_accepted", "declined_by_client", "expired", "cancelled"],
    client_accepted: ["assigned", "cancelled"],
    assigned: ["in_production", "on_hold", "cancelled"],
    in_production: ["ready_for_delivery", "partially_delivered", "on_hold", "cancelled"],
    on_hold: ["assigned", "in_production", "cancelled"],
    ready_for_delivery: ["partially_delivered", "delivered", "cancelled"],
    partially_delivered: ["delivered", "in_production", "cancelled"],
    delivered: ["completed"],
    completed: [],
    declined_by_client: [],
    rejected_by_admin: [],
    expired: [],
    cancelled: [],
  },

  quotation: {
    generating: ["generation_failed", "pending_approval"],
    generation_failed: ["generating", "superseded"],
    pending_approval: ["approved", "generating", "rejected", "superseded"],
    approved: ["sent", "superseded"],
    sent: ["accepted", "declined", "expired", "superseded"],
    accepted: [],
    declined: [],
    rejected: [],
    expired: [],
    superseded: [],
  },

  revision: {
    proposed: ["approved", "superseded"],
    approved: ["sent", "superseded"],
    sent: ["accepted", "declined", "superseded"],
    accepted: [],
    declined: [],
    superseded: [],
  },

  feasibility: {
    running: ["ready", "failed"],
    ready: ["superseded"],
    failed: ["superseded", "running"],
    superseded: [],
  },

  escalation: {
    open: ["in_progress", "resolved"],
    in_progress: ["resolved"],
    resolved: [],
  },

  conversation: {
    agent_handling: ["escalated", "admin_handling", "resolved"],
    escalated: ["admin_handling", "resolved"],
    admin_handling: ["agent_handling", "resolved"],
    resolved: ["agent_handling"],
  },

  milestone: {
    pending: ["partial", "received", "overdue"],
    overdue: ["partial", "received"],
    partial: ["received"],
    received: [],
  },

  ticket: {
    open: ["assigned", "resolved"],
    assigned: ["resolved"],
    resolved: [],
  },

  marketPriceAlert: {
    open: ["ack", "resolved", "dismissed"],
    ack: ["resolved", "dismissed"],
    resolved: [],
    dismissed: [],
  },
} as const;

export type TransitionEntity = keyof typeof TRANSITION_TABLES;

export class TransitionError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;

  constructor(message: string, code: ErrorCode = ErrorCode.INVALID_TRANSITION, statusCode = 400) {
    super(message);
    this.name = "TransitionError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

/**
 * Validates and asserts that a state transition for an entity is permissible under LoomPilot S4 rules.
 *
 * Special Safeguards:
 * - order -> 'on_hold': Admin only, requires non-empty reason, permissible ONLY from 'assigned' or 'in_production'.
 */
export function assertTransition(
  entity: TransitionEntity,
  fromStatus: string,
  toStatus: string,
  context?: TransitionContext
): void {
  const table = TRANSITION_TABLES[entity] as Record<string, readonly string[]>;
  if (!table) {
    throw new TransitionError(`Unknown transition entity '${entity}'`);
  }

  const allowed = table[fromStatus];
  if (!allowed) {
    throw new TransitionError(
      `Invalid starting status '${fromStatus}' for entity '${entity}'`
    );
  }

  if (!allowed.includes(toStatus)) {
    throw new TransitionError(
      `Invalid transition for '${entity}' from '${fromStatus}' to '${toStatus}'. Allowed: [${allowed.join(", ")}]`
    );
  }

  // S4 Safeguard: Order on_hold rules
  if (entity === "order" && toStatus === "on_hold") {
    if (fromStatus !== "assigned" && fromStatus !== "in_production") {
      throw new TransitionError(
        `Order can only be put on_hold from 'assigned' or 'in_production'; current status is '${fromStatus}'`
      );
    }
    if (context?.role !== "admin") {
      throw new TransitionError(
        "Only an admin can put an order on_hold",
        ErrorCode.FORBIDDEN,
        403
      );
    }
    if (!context?.reason || typeof context.reason !== "string" || context.reason.trim() === "") {
      throw new TransitionError(
        "A valid reason is required to put an order on_hold",
        ErrorCode.VALIDATION_FAILED,
        400
      );
    }
  }
}

