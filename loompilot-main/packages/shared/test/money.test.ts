import { test, describe } from "node:test";
import assert from "node:assert";
import {
  APP_NAME,
  UserRole,
  Realm,
  rupeesToPaise,
  paiseToRupees,
  formatINR,
  addPaise,
  applyPercentage,
  isValidPaise,
  assertPaise,
} from "../dist/index.js";

// Reference BigInt implementation for mathematical ground truth
function referenceApplyPercentage(paise: number, percentage: number): number {
  if (paise === 0 || percentage === 0) return 0;
  const scale = 10000n;
  const den = 100n * scale;
  const scaledPct = BigInt(Math.round(percentage * 10000));
  const num = BigInt(Math.trunc(paise)) * scaledPct;
  let q = num / den;
  const rem = num % den;
  const absRem = rem < 0n ? -rem : rem;
  if (2n * absRem >= den) {
    if (num > 0n) q += 1n;
    else if (num < 0n) q -= 1n;
  }
  return Number(q);
}

describe("Shared Package Tests", () => {
  test("APP_NAME constant is correctly defined", () => {
    assert.strictEqual(APP_NAME, "LoomPilot");
  });

  test("UserRole enum contains admin and supervisor, and Realm contains user and client", () => {
    assert.strictEqual(UserRole.ADMIN, "admin");
    assert.strictEqual(UserRole.SUPERVISOR, "supervisor");
    assert.strictEqual(Object.keys(UserRole).length, 2);
    assert.strictEqual(Realm.USER, "user");
    assert.strictEqual(Realm.CLIENT, "client");
    assert.strictEqual(Object.keys(Realm).length, 2);
  });

  test("Monetary conversions to and from integer paise work precisely", () => {
    assert.strictEqual(rupeesToPaise(100), 10000);
    assert.strictEqual(rupeesToPaise(45.5), 4550);
    assert.strictEqual(paiseToRupees(4550), 45.5);
    assert.strictEqual(addPaise(1000, 2500, 50), 3550);
    assert.strictEqual(applyPercentage(10000, 15), 1500);
  });

  test("isValidPaise and assertPaise reject non-integers (1.5) and negative values unless signed", () => {
    assert.strictEqual(isValidPaise(100), true);
    assert.strictEqual(isValidPaise(0), true);
    assert.strictEqual(isValidPaise(1.5), false);
    assert.strictEqual(isValidPaise(-50), false);
    assert.strictEqual(isValidPaise(-50, true), true); // allowed when allowSigned = true
    assert.strictEqual(isValidPaise(-1.5, true), false);

    assert.throws(() => assertPaise(1.5), /must be an integer paise value/);
    assert.throws(() => assertPaise(-10), /must be an integer paise value/);
    assert.doesNotThrow(() => assertPaise(100));
    assert.doesNotThrow(() => assertPaise(-10, "deltaPaise", true));
  });

  test("applyPercentage rejects percentages with more than 2 decimal places", () => {
    assert.doesNotThrow(() => applyPercentage(10000, 15));
    assert.doesNotThrow(() => applyPercentage(10000, 15.5));
    assert.doesNotThrow(() => applyPercentage(10000, 15.25));
    assert.throws(
      () => applyPercentage(10000, 15.255),
      /Percentage cannot have more than 2 decimal places/
    );
    assert.throws(
      () => applyPercentage(10000, 0.001),
      /Percentage cannot have more than 2 decimal places/
    );
    assert.throws(
      () => applyPercentage(1.5, 10),
      /Amount must be an integer paise/
    );
  });

  test("formatINR formats Indian Rupee string correctly", () => {
    const formatted = formatINR(123456789);
    assert.ok(formatted.includes("12,34,567.89"));
  });

  test("applyPercentage: specific boundary cases", () => {
    // 5 paise x 10% = 0.5 paise -> rounds half-away-from-zero to 1 paise
    assert.strictEqual(applyPercentage(5, 10), 1);
    // 1 paise x 50% = 0.5 paise -> rounds half-away-from-zero to 1 paise
    assert.strictEqual(applyPercentage(1, 50), 1);
    // 4 paise x 10% = 0.4 paise -> rounds down to 0 paise
    assert.strictEqual(applyPercentage(4, 10), 0);
    // -5 paise x 10% = -0.5 paise -> rounds to -1 paise
    assert.strictEqual(applyPercentage(-5, 10), -1);
    // -4 paise x 10% = -0.4 paise -> rounds to 0 paise
    assert.strictEqual(applyPercentage(-4, 10), 0);
  });

  test("applyPercentage: 5,000 iteration fuzz test against BigInt reference", () => {
    for (let i = 0; i < 5000; i++) {
      const paise = Math.floor(Math.random() * 20000000) - 10000000;
      // 2 decimal places
      const percentage = Math.round((Math.random() * 200 - 100) * 100) / 100;
      const actual = applyPercentage(paise, percentage);
      const expected = referenceApplyPercentage(paise, percentage);
      assert.strictEqual(
        actual,
        expected,
        `Mismatch for paise=${paise}, percentage=${percentage}: got ${actual}, expected ${expected}`
      );
    }
  });
});
