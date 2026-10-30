import { describe, it, expect } from "vitest";
import {
  assertIntegerPaise,
  subPaise,
  multiplyPaise,
  rupeesToPaise,
  paiseToRupees,
  formatINR,
  addPaise,
  applyPercentage,
} from "../../src/utils/money.js";

function referenceBigIntApplyPercentage(paise: number, percentage: number): number {
  if (paise === 0 || percentage === 0) return 0;
  const SCALE = 10000n;
  const DENOMINATOR = 100n * SCALE;
  const scaledPct = BigInt(Math.round(percentage * 10000));
  const num = BigInt(Math.trunc(paise)) * scaledPct;
  let q = num / DENOMINATOR;
  const rem = num % DENOMINATOR;
  const absRem = rem < 0n ? -rem : rem;
  if (2n * absRem >= DENOMINATOR) {
    if (num > 0n) q += 1n;
    else if (num < 0n) q -= 1n;
  }
  return Number(q);
}

describe("Money Utilities (Integer Paise)", () => {
  it("converts rupees to paise accurately without floating point drift", () => {
    expect(rupeesToPaise(100)).toBe(10000);
    expect(rupeesToPaise(10.5)).toBe(1050);
    expect(rupeesToPaise("145.75" as unknown as number)).toBe(14575);
    expect(rupeesToPaise(0.01)).toBe(1);
    expect(rupeesToPaise(0)).toBe(0);
  });

  it("converts paise to rupees accurately", () => {
    expect(paiseToRupees(10000)).toBe(100);
    expect(paiseToRupees(1050)).toBe(10.5);
    expect(paiseToRupees(14575)).toBe(145.75);
    expect(paiseToRupees(1)).toBe(0.01);
  });

  it("formats integer paise to INR currency strings", () => {
    const formatted = formatINR(1450075);
    expect(formatted).toContain("14,500.75");
  });

  it("adds paise amounts correctly", () => {
    expect(addPaise(100, 250, 300)).toBe(650);
    expect(addPaise(0, 0)).toBe(0);
  });

  it("subtracts paise amounts and prevents accidental negatives", () => {
    expect(subPaise(500, 200)).toBe(300);
    expect(() => subPaise(200, 500)).toThrow(/Subtraction resulted in negative paise/);
    expect(subPaise(200, 500, true)).toBe(-300);
  });

  it("multiplies paise and rounds to whole paise", () => {
    expect(multiplyPaise(1000, 1.05)).toBe(1050);
    expect(multiplyPaise(1001, 0.5)).toBe(501); // 500.5 rounded to 501
  });

  it("calculates percentage accurately with standard integer paise", () => {
    expect(applyPercentage(10000, 18)).toBe(1800); // 18% of 100 INR = 18 INR
    expect(applyPercentage(1000, 5)).toBe(50);
    expect(applyPercentage(0, 10)).toBe(0);
  });

  it("applies symmetric half-up rounding on 0.5 paise edge cases (5 paise x 10% and 1 paise x 50%)", () => {
    // 5 paise x 10% = 0.5 paise -> rounds UP to 1 paise
    expect(applyPercentage(5, 10)).toBe(1);

    // 1 paise x 50% = 0.5 paise -> rounds UP to 1 paise
    expect(applyPercentage(1, 50)).toBe(1);

    // 4 paise x 10% = 0.4 paise -> rounds DOWN to 0 paise
    expect(applyPercentage(4, 10)).toBe(0);

    // 250 paise * 1% = 2.5 paise -> rounds UP to 3 paise
    expect(applyPercentage(250, 1)).toBe(3);

    // Negative values (symmetric half-up away from zero):
    // -5 paise * 10% = -0.5 paise -> rounds AWAY from zero to -1 paise
    expect(applyPercentage(-5, 10)).toBe(-1);

    // -1 paise * 50% = -0.5 paise -> rounds AWAY from zero to -1 paise
    expect(applyPercentage(-1, 50)).toBe(-1);

    // -4 paise * 10% = -0.4 paise -> rounds towards zero to 0 paise
    expect(applyPercentage(-4, 10)).toBe(0);

    // -250 paise * 1% = -2.5 paise -> rounds AWAY from zero to -3 paise
    expect(applyPercentage(-250, 1)).toBe(-3);
  });

  it("passes fuzz testing against pure BigInt reference implementation (5,000 iterations)", () => {
    for (let i = 0; i < 5000; i++) {
      const paise = Math.floor(Math.random() * 20000000) - 10000000;
      // Percentages with up to 2 decimal places (basis points)
      const percentage = Math.round((Math.random() * 200 - 100) * 100) / 100;

      const actual = applyPercentage(paise, percentage);
      const expected = referenceBigIntApplyPercentage(paise, percentage);

      expect(actual).toBe(expected);
    }
  });

  it("rejects percentages with more than 2 decimal places", () => {
    expect(() => applyPercentage(10000, 12.345)).toThrow(/more than 2 decimal places/);
    expect(() => applyPercentage(10000, 0.001)).toThrow(/more than 2 decimal places/);
    expect(() => applyPercentage(10000, 12.34)).not.toThrow();
  });

  it("assertIntegerPaise enforces integer and non-negative values", () => {
    expect(() => assertIntegerPaise(100)).not.toThrow();
    expect(() => assertIntegerPaise(0)).not.toThrow();
    expect(() => assertIntegerPaise(10.5)).toThrow(/must be an integer paise amount/);
    expect(() => assertIntegerPaise(-50)).toThrow(/cannot be negative paise/);
  });
});
