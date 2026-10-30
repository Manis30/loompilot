import { test, describe } from "node:test";
import assert from "node:assert";
import { splitPaise } from "../dist/index.js";

describe("Stage 3.5: splitPaise (Largest Remainder Method)", () => {
  test("Splits 100 paise evenly into 3 parts (34 + 33 + 33 = 100)", () => {
    const parts = splitPaise(100, [1, 1, 1]);
    assert.deepStrictEqual(parts, [34, 33, 33]);
    assert.strictEqual(parts.reduce((a, b) => a + b, 0), 100);
  });

  test("Splits 1000 paise by percentage weights [10, 20, 30, 40]", () => {
    const parts = splitPaise(1000, [10, 20, 30, 40]);
    assert.deepStrictEqual(parts, [100, 200, 300, 400]);
    assert.strictEqual(parts.reduce((a, b) => a + b, 0), 1000);
  });

  test("Handles zero paise total (all parts zero)", () => {
    const parts = splitPaise(0, [25, 25, 50]);
    assert.deepStrictEqual(parts, [0, 0, 0]);
    assert.strictEqual(parts.reduce((a, b) => a + b, 0), 0);
  });

  test("Handles 1 paise split among 3 equal weights (1 + 0 + 0 = 1)", () => {
    const parts = splitPaise(1, [1, 1, 1]);
    assert.deepStrictEqual(parts, [1, 0, 0]);
    assert.strictEqual(parts.reduce((a, b) => a + b, 0), 1);
  });

  test("Handles 2 paise split among 3 equal weights (1 + 1 + 0 = 2)", () => {
    const parts = splitPaise(2, [1, 1, 1]);
    assert.deepStrictEqual(parts, [1, 1, 0]);
    assert.strictEqual(parts.reduce((a, b) => a + b, 0), 2);
  });

  test("Single weight gets the full amount", () => {
    const parts = splitPaise(49999, [100]);
    assert.deepStrictEqual(parts, [49999]);
  });

  test("Property test: 1000 random trials guarantee exact sum and integer paise parts", () => {
    // Deterministic pseudo-random generation
    let seed = 123456789;
    function rand() {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    }

    for (let trial = 0; trial < 1000; trial++) {
      const totalPaise = Math.floor(rand() * 1000000); // 0 to 1,000,000 paise
      const numParts = Math.floor(rand() * 10) + 1; // 1 to 10 parts
      const weights: number[] = [];
      for (let i = 0; i < numParts; i++) {
        weights.push(Math.floor(rand() * 100) + 1);
      }

      const parts = splitPaise(totalPaise, weights);

      // Invariant 1: Correct number of parts
      assert.strictEqual(parts.length, weights.length);

      // Invariant 2: Every part is an integer
      for (const p of parts) {
        assert.strictEqual(Number.isInteger(p), true);
        assert.strictEqual(p >= 0, true);
      }

      // Invariant 3: Exact sum matching totalPaise
      const sum = parts.reduce((a, b) => a + b, 0);
      assert.strictEqual(
        sum,
        totalPaise,
        `Trial ${trial} failed: sum ${sum} !== totalPaise ${totalPaise}`
      );
    }
  });

  test("Rejects non-integers, negative amounts, or invalid weights", () => {
    assert.throws(() => splitPaise(100.5, [1, 2]), /totalPaise must be an integer paise/);
    assert.throws(() => splitPaise(-50, [1, 2]), /totalPaise must be an integer paise value >= 0/);
    assert.throws(() => splitPaise(100, []), /weights must be a non-empty array/);
    assert.throws(() => splitPaise(100, [-1, 2]), /must be a non-negative number/);
    assert.throws(() => splitPaise(100, [0, 0]), /Sum of weights must be greater than zero/);
  });
});
