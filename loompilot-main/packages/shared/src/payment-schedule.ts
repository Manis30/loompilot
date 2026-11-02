import { assertPaise } from "./money.js";

export interface PaymentScheduleMilestoneInput {
  milestone: string;
  trigger: "advance" | "stage";
  stage?: string;
  percent: number;
  amountPaise: number;
  dueDate?: string; // YYYY-MM-DD
}

export interface PaymentScheduleValidationResult {
  valid: boolean;
  errors: string[];
}

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validates a quotation payment schedule against core business rules:
 * 1. Exactly one advance milestone (trigger: "advance").
 * 2. If trigger is "stage", a non-empty stage name is required.
 * 3. Percents must be positive numbers with at most 2 decimal places, summing to 100%.
 * 4. Milestone amountPaise must be non-negative integer paise, summing exactly to totalPaise.
 * 5. Due dates, if provided, must be valid 'YYYY-MM-DD' calendar strings.
 */
export function validatePaymentSchedule(
  schedule: PaymentScheduleMilestoneInput[],
  totalPaise: number
): PaymentScheduleValidationResult {
  const errors: string[] = [];

  assertPaise(totalPaise, "totalPaise");

  if (!Array.isArray(schedule) || schedule.length === 0) {
    errors.push("Payment schedule must contain at least one milestone");
    return { valid: false, errors };
  }

  let advanceCount = 0;
  let sumPercent = 0;
  let sumAmountPaise = 0;

  for (let i = 0; i < schedule.length; i++) {
    const item = schedule[i];
    if (!item) continue;

    if (!item.milestone || typeof item.milestone !== "string" || item.milestone.trim() === "") {
      errors.push(`Milestone at index ${i} must have a non-empty name`);
    }

    if (item.trigger === "advance") {
      advanceCount++;
    } else if (item.trigger === "stage") {
      if (!item.stage || typeof item.stage !== "string" || item.stage.trim() === "") {
        errors.push(`Stage milestone at index ${i} ('${item.milestone}') requires a valid stage name`);
      }
    } else {
      errors.push(`Milestone at index ${i} has invalid trigger '${item.trigger}'; expected 'advance' or 'stage'`);
    }

    if (typeof item.percent !== "number" || isNaN(item.percent) || item.percent <= 0) {
      errors.push(`Milestone at index ${i} ('${item.milestone}') must have a positive percentage`);
    } else {
      const scaled = item.percent * 100;
      if (Math.abs(scaled - Math.round(scaled)) > 1e-7) {
        errors.push(`Milestone at index ${i} ('${item.milestone}') percent cannot have more than 2 decimal places: ${item.percent}`);
      }
      sumPercent += item.percent;
    }

    if (typeof item.amountPaise !== "number" || !Number.isInteger(item.amountPaise) || item.amountPaise < 0) {
      errors.push(`Milestone at index ${i} ('${item.milestone}') amountPaise must be a non-negative integer paise, got: ${item.amountPaise}`);
    } else {
      sumAmountPaise += item.amountPaise;
    }

    if (item.dueDate !== undefined && item.dueDate !== null) {
      if (typeof item.dueDate !== "string" || !DATE_REGEX.test(item.dueDate)) {
        errors.push(`Milestone at index ${i} ('${item.milestone}') dueDate must be a valid 'YYYY-MM-DD' string, got: '${item.dueDate}'`);
      }
    }
  }

  if (advanceCount !== 1) {
    errors.push(`Payment schedule must have exactly one 'advance' milestone; found ${advanceCount}`);
  }

  // Percents must sum to 100.00%
  if (Math.abs(sumPercent - 100) > 0.001) {
    errors.push(`Payment schedule milestone percentages must sum to 100%; current sum: ${sumPercent.toFixed(2)}%`);
  }

  // Amounts must sum exactly to totalPaise
  if (sumAmountPaise !== totalPaise) {
    errors.push(
      `Payment schedule milestone amounts must sum to totalPaise (${totalPaise} paise); current sum: ${sumAmountPaise} paise`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
