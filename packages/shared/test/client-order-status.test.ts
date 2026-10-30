import { test, describe } from "node:test";
import assert from "node:assert";
import { OrderStatus, toClientOrderStatus } from "../dist/index.js";

describe("Stage 3.5: toClientOrderStatus mapping (all 19 states)", () => {
  const expectedMappings: Record<OrderStatus, string> = {
    [OrderStatus.SUBMITTED]: "received",
    [OrderStatus.ANALYZING]: "under_review",
    [OrderStatus.ANALYSIS_FAILED]: "under_review",
    [OrderStatus.AWAITING_ADMIN_DECISION]: "under_review",
    [OrderStatus.QUOTATION_DRAFTING]: "under_review",
    [OrderStatus.QUOTATION_PENDING_APPROVAL]: "under_review",
    [OrderStatus.QUOTATION_SENT]: "quotation_ready",
    [OrderStatus.CLIENT_ACCEPTED]: "confirmed",
    [OrderStatus.ASSIGNED]: "confirmed",
    [OrderStatus.IN_PRODUCTION]: "in_production",
    [OrderStatus.READY_FOR_DELIVERY]: "ready",
    [OrderStatus.PARTIALLY_DELIVERED]: "in_production",
    [OrderStatus.DELIVERED]: "delivered",
    [OrderStatus.COMPLETED]: "closed",
    [OrderStatus.DECLINED_BY_CLIENT]: "declined",
    [OrderStatus.REJECTED_BY_ADMIN]: "declined",
    [OrderStatus.EXPIRED]: "declined",
    [OrderStatus.CANCELLED]: "declined",
    [OrderStatus.ON_HOLD]: "under_review",
  };

  test("Verifies all 19 OrderStatus enum values map to the exact 9 client-safe statuses", () => {
    const allStatuses = Object.values(OrderStatus);
    assert.strictEqual(allStatuses.length, 19, "Must have exactly 19 states in OrderStatus enum");

    for (const status of allStatuses) {
      const clientStatus = toClientOrderStatus(status);
      const expected = expectedMappings[status];
      assert.strictEqual(
        clientStatus,
        expected,
        `Expected OrderStatus.${status} to map to '${expected}', got '${clientStatus}'`
      );
    }
  });

  test("Allows string representations matching the 19 states", () => {
    assert.strictEqual(toClientOrderStatus("submitted"), "received");
    assert.strictEqual(toClientOrderStatus("in_production"), "in_production");
    assert.strictEqual(toClientOrderStatus("completed"), "closed");
  });

  test("Throws an error when given an invalid or unknown order status", () => {
    assert.throws(
      () => toClientOrderStatus("invalid_status" as any),
      /Unknown or unmapped order status: invalid_status/
    );
  });
});
