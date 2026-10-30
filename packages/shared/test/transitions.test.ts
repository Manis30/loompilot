import { test, describe } from "node:test";
import assert from "node:assert";
import { assertTransition, TransitionError, TRANSITION_TABLES, ErrorCode } from "../dist/index.js";

describe("Stage 3.5: State Transitions (S4 Safeguards)", () => {
  test("Table-driven test: all entities allow defined valid transitions", () => {
    for (const [entityName, table] of Object.entries(TRANSITION_TABLES)) {
      for (const [fromStatus, targets] of Object.entries(table)) {
        for (const toStatus of targets as readonly string[]) {
          // Provide context for order on_hold to pass its specific guard
          const context =
            entityName === "order" && toStatus === "on_hold"
              ? { role: "admin" as const, reason: "Machine breakdown" }
              : undefined;

          assert.doesNotThrow(
            () => assertTransition(entityName as any, fromStatus, toStatus, context),
            `Transition for ${entityName} from ${fromStatus} to ${toStatus} should succeed`
          );
        }
      }
    }
  });

  test("Order transition rejects invalid state jumps", () => {
    // submitted -> in_production is invalid (must go through analysis, quotation, acceptance, assignment)
    assert.throws(
      () => assertTransition("order", "submitted", "in_production"),
      (err: any) => err instanceof TransitionError && err.code === ErrorCode.INVALID_TRANSITION
    );

    // completed cannot transition anywhere
    assert.throws(
      () => assertTransition("order", "completed", "in_production"),
      (err: any) => err instanceof TransitionError
    );
  });

  test("Order on_hold safeguards: allows admin with reason from assigned or in_production only", () => {
    // 1. Allowed: Admin with reason from assigned
    assert.doesNotThrow(() =>
      assertTransition("order", "assigned", "on_hold", {
        role: "admin",
        reason: "Yarn delivery delayed",
      })
    );

    // 2. Allowed: Admin with reason from in_production
    assert.doesNotThrow(() =>
      assertTransition("order", "in_production", "on_hold", {
        role: "admin",
        reason: "Loom gear failure",
      })
    );

    // 3. Rejected: Supervisor cannot put order on_hold
    assert.throws(
      () =>
        assertTransition("order", "in_production", "on_hold", {
          role: "supervisor",
          reason: "Need pause",
        }),
      (err: any) => err.code === ErrorCode.FORBIDDEN
    );

    // 4. Rejected: Admin without reason
    assert.throws(
      () =>
        assertTransition("order", "in_production", "on_hold", {
          role: "admin",
          reason: "",
        }),
      (err: any) => err.code === ErrorCode.VALIDATION_FAILED
    );

    // 5. Rejected: from submitted
    assert.throws(
      () =>
        assertTransition("order", "submitted", "on_hold", {
          role: "admin",
          reason: "Valid reason",
        }),
      (err: any) => err.code === ErrorCode.INVALID_TRANSITION
    );
  });

  test("Quotation transitions enforce strict sequence and superseding", () => {
    assert.doesNotThrow(() => assertTransition("quotation", "generating", "pending_approval"));
    assert.doesNotThrow(() => assertTransition("quotation", "pending_approval", "approved"));
    assert.doesNotThrow(() => assertTransition("quotation", "approved", "sent"));
    assert.doesNotThrow(() => assertTransition("quotation", "sent", "accepted"));

    // Cannot jump from generating directly to sent
    assert.throws(() => assertTransition("quotation", "generating", "sent"), TransitionError);
  });

  test("Revision transitions enforce lifecycle", () => {
    assert.doesNotThrow(() => assertTransition("revision", "proposed", "approved"));
    assert.doesNotThrow(() => assertTransition("revision", "approved", "sent"));
    assert.doesNotThrow(() => assertTransition("revision", "sent", "accepted"));
    assert.throws(() => assertTransition("revision", "proposed", "sent"), TransitionError);
  });

  test("Maintenance ticket transitions", () => {
    assert.doesNotThrow(() => assertTransition("ticket", "open", "assigned"));
    assert.doesNotThrow(() => assertTransition("ticket", "assigned", "resolved"));
    assert.throws(() => assertTransition("ticket", "resolved", "open"), TransitionError);
  });

  test("Market price alert transitions", () => {
    assert.doesNotThrow(() => assertTransition("marketPriceAlert", "open", "ack"));
    assert.doesNotThrow(() => assertTransition("marketPriceAlert", "ack", "resolved"));
    assert.throws(() => assertTransition("marketPriceAlert", "resolved", "open"), TransitionError);
  });
});
