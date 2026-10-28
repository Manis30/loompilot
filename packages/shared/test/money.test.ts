import { test, describe } from "node:test";
import assert from "node:assert";
import {
  APP_NAME,
  UserRole,
  rupeesToPaise,
  paiseToRupees,
  formatINR,
  addPaise,
  applyPercentage,
} from "../dist/index.js";

describe("Shared Package Tests", () => {
  test("APP_NAME constant is correctly defined", () => {
    assert.strictEqual(APP_NAME, "LoomPilot");
  });

  test("UserRole enum contains all 5 manufacturing roles", () => {
    assert.strictEqual(UserRole.OWNER, "owner");
    assert.strictEqual(UserRole.MANAGER, "manager");
    assert.strictEqual(UserRole.SALES, "sales");
    assert.strictEqual(UserRole.STORE, "store");
    assert.strictEqual(UserRole.ACCOUNTS, "accounts");
  });

  test("Monetary conversions to and from integer paise work precisely", () => {
    assert.strictEqual(rupeesToPaise(100), 10000);
    assert.strictEqual(rupeesToPaise("45.50"), 4550);
    assert.strictEqual(paiseToRupees(4550), 45.5);
    assert.strictEqual(addPaise(1000, 2500, 50), 3550);
    assert.strictEqual(applyPercentage(10000, 15), 1500);
  });

  test("formatINR formats Indian Rupee string correctly", () => {
    const formatted = formatINR(125000); // 1,250.00
    assert.ok(formatted.includes("1,250.00"));
  });
});
