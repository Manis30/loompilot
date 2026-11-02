import { test, describe } from "node:test";
import assert from "node:assert";
import { validatePaymentSchedule, type PaymentScheduleMilestoneInput } from "../dist/index.js";

describe("Stage 3.5: validatePaymentSchedule", () => {
  const validTotal = 100000; // 1,000.00 INR
  const validSchedule: PaymentScheduleMilestoneInput[] = [
    {
      milestone: "Advance Deposit",
      trigger: "advance",
      percent: 30,
      amountPaise: 30000,
      dueDate: "2026-11-01",
    },
    {
      milestone: "Post-Weaving Progress",
      trigger: "stage",
      stage: "weaving",
      percent: 40,
      amountPaise: 40000,
      dueDate: "2026-11-15",
    },
    {
      milestone: "Final Delivery Balance",
      trigger: "stage",
      stage: "packing",
      percent: 30,
      amountPaise: 30000,
      dueDate: "2026-11-30",
    },
  ];

  test("Passes validation for a complete, compliant payment schedule", () => {
    const result = validatePaymentSchedule(validSchedule, validTotal);
    assert.strictEqual(result.valid, true);
    assert.deepStrictEqual(result.errors, []);
  });

  test("Rejects schedule with zero advance milestones", () => {
    const noAdvance: PaymentScheduleMilestoneInput[] = [
      {
        milestone: "Full Stage Payment",
        trigger: "stage",
        stage: "packing",
        percent: 100,
        amountPaise: 100000,
      },
    ];
    const result = validatePaymentSchedule(noAdvance, validTotal);
    assert.strictEqual(result.valid, false);
    assert.strictEqual(
      result.errors.some((e) => e.includes("exactly one 'advance' milestone")),
      true
    );
  });

  test("Rejects schedule with multiple advance milestones", () => {
    const multiAdvance: PaymentScheduleMilestoneInput[] = [
      {
        milestone: "Advance 1",
        trigger: "advance",
        percent: 15,
        amountPaise: 15000,
      },
      {
        milestone: "Advance 2",
        trigger: "advance",
        percent: 15,
        amountPaise: 15000,
      },
      {
        milestone: "Balance",
        trigger: "stage",
        stage: "finishing",
        percent: 70,
        amountPaise: 70000,
      },
    ];
    const result = validatePaymentSchedule(multiAdvance, validTotal);
    assert.strictEqual(result.valid, false);
    assert.strictEqual(
      result.errors.some((e) => e.includes("exactly one 'advance' milestone; found 2")),
      true
    );
  });

  test("Rejects when percentages do not sum to 100%", () => {
    const badPercents: PaymentScheduleMilestoneInput[] = [
      {
        milestone: "Advance",
        trigger: "advance",
        percent: 30,
        amountPaise: 30000,
      },
      {
        milestone: "Delivery",
        trigger: "stage",
        stage: "packing",
        percent: 69.5, // sums to 99.5%
        amountPaise: 70000,
      },
    ];
    const result = validatePaymentSchedule(badPercents, validTotal);
    assert.strictEqual(result.valid, false);
    assert.strictEqual(
      result.errors.some((e) => e.includes("percentages must sum to 100%")),
      true
    );
  });

  test("Rejects when milestone amount sums do not match totalPaise", () => {
    const badAmount: PaymentScheduleMilestoneInput[] = [
      {
        milestone: "Advance",
        trigger: "advance",
        percent: 50,
        amountPaise: 50000,
      },
      {
        milestone: "Delivery",
        trigger: "stage",
        stage: "packing",
        percent: 50,
        amountPaise: 49999, // 1 paise short!
      },
    ];
    const result = validatePaymentSchedule(badAmount, validTotal);
    assert.strictEqual(result.valid, false);
    assert.strictEqual(
      result.errors.some((e) => e.includes("milestone amounts must sum to totalPaise")),
      true
    );
  });

  test("Rejects stage milestone missing required stage name", () => {
    const missingStage: PaymentScheduleMilestoneInput[] = [
      {
        milestone: "Advance",
        trigger: "advance",
        percent: 50,
        amountPaise: 50000,
      },
      {
        milestone: "Milestone 2",
        trigger: "stage",
        // stage omitted!
        percent: 50,
        amountPaise: 50000,
      },
    ];
    const result = validatePaymentSchedule(missingStage, validTotal);
    assert.strictEqual(result.valid, false);
    assert.strictEqual(
      result.errors.some((e) => e.includes("requires a valid stage name")),
      true
    );
  });

  test("Rejects malformed dueDate strings", () => {
    const badDate: PaymentScheduleMilestoneInput[] = [
      {
        milestone: "Advance",
        trigger: "advance",
        percent: 100,
        amountPaise: 100000,
        dueDate: "30-10-2026", // Wrong format
      },
    ];
    const result = validatePaymentSchedule(badDate, validTotal);
    assert.strictEqual(result.valid, false);
    assert.strictEqual(
      result.errors.some((e) => e.includes("dueDate must be a valid 'YYYY-MM-DD' string")),
      true
    );
  });
});
