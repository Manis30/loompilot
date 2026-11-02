export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

export function paiseToRupees(paise: number): number {
  return paise / 100;
}

export function formatINR(paise: number): string {
  const rupees = paise / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rupees);
}

export function addPaise(...amounts: number[]): number {
  return amounts.reduce((acc, curr) => acc + Math.trunc(curr), 0);
}

/**
 * Validates that a value is a valid integer paise amount.
 * Money in LoomPilot must always be stored and handled as integer paise (no floats).
 * @param paise The number to validate.
 * @param allowSigned Whether negative paise values are permitted (e.g. for signed deltaPaise).
 */
export function isValidPaise(paise: unknown, allowSigned = false): boolean {
  if (typeof paise !== "number" || !Number.isInteger(paise)) {
    return false;
  }
  return allowSigned ? true : paise >= 0;
}

export function assertPaise(paise: unknown, fieldName = "paise", allowSigned = false): void {
  if (!isValidPaise(paise, allowSigned)) {
    throw new TypeError(
      `${fieldName} must be an integer paise value${allowSigned ? "" : " >= 0"}, got: ${paise}`
    );
  }
}

/**
 * Applies a percentage to an integer paise amount using exact integer arithmetic (BigInt)
 * and symmetric round half-away-from-zero.
 *
 * Requirements:
 * - Percentage must not exceed 2 decimal places (e.g. 10.25 is valid, 10.255 will be rejected).
 * - Paise input must be an integer.
 */
export function applyPercentage(paise: number, percentage: number): number {
  if (!Number.isInteger(paise)) {
    throw new TypeError(`Amount must be an integer paise, got: ${paise}`);
  }

  // Reject percentages with more than 2 decimal places
  const scaledPct100 = percentage * 100;
  if (Math.abs(scaledPct100 - Math.round(scaledPct100)) > 1e-7) {
    throw new RangeError(
      `Percentage cannot have more than 2 decimal places: ${percentage}`
    );
  }

  if (paise === 0 || percentage === 0) return 0;

  const SCALE = 10000n;
  const DENOMINATOR = 100n * SCALE; // 1,000,000n

  const scaledPercentage = BigInt(Math.round(percentage * 10000));
  const numerator = BigInt(paise) * scaledPercentage;

  let quotient = numerator / DENOMINATOR;
  const remainder = numerator % DENOMINATOR;

  const absRemainder = remainder < 0n ? -remainder : remainder;

  if (2n * absRemainder >= DENOMINATOR) {
    if (numerator > 0n) {
      quotient += 1n;
    } else if (numerator < 0n) {
      quotient -= 1n;
    }
  }

  return Number(quotient);
}

/**
 * Splits an integer paise amount into discrete integer paise parts according to given weights/proportions,
 * using the Largest Remainder Method (Hamilton-Hare method).
 *
 * Guarantees:
 * 1. Every returned part is an integer paise.
 * 2. The sum of all parts equals totalPaise EXACTLY (no lost or gained fractions).
 * 3. Distribution is fair and deterministic (ties resolved by index).
 *
 * @param totalPaise Integer paise amount (>= 0).
 * @param weights Array of non-negative weights (e.g. percentages or ratios). Sum must be > 0.
 */
export function splitPaise(totalPaise: number, weights: number[]): number[] {
  assertPaise(totalPaise, "totalPaise");

  if (!Array.isArray(weights) || weights.length === 0) {
    throw new TypeError("weights must be a non-empty array of numbers");
  }

  for (let i = 0; i < weights.length; i++) {
    const w = weights[i];
    if (w === undefined || typeof w !== "number" || isNaN(w) || w < 0) {
      throw new RangeError(`Weight at index ${i} must be a non-negative number, got: ${w}`);
    }
  }

  const sumWeights = weights.reduce((acc, w) => acc + w, 0);
  if (sumWeights <= 0) {
    throw new RangeError("Sum of weights must be greater than zero");
  }

  if (totalPaise === 0) {
    return new Array(weights.length).fill(0);
  }

  const parts: number[] = new Array(weights.length);
  const remainders: Array<{ index: number; remainder: number }> = [];

  let allocated = 0;

  for (let i = 0; i < weights.length; i++) {
    const w = weights[i] ?? 0;
    const exact = (totalPaise * w) / sumWeights;
    const floor = Math.floor(exact);
    parts[i] = floor;
    allocated += floor;
    remainders.push({ index: i, remainder: exact - floor });
  }

  const deficit = totalPaise - allocated;

  // Sort remainders descending. Stable sort by preserving original index on tie.
  remainders.sort((a, b) => {
    if (b.remainder !== a.remainder) {
      return b.remainder - a.remainder;
    }
    return a.index - b.index;
  });

  for (let i = 0; i < deficit; i++) {
    const r = remainders[i];
    if (r !== undefined) {
      parts[r.index] = (parts[r.index] ?? 0) + 1;
    }
  }

  return parts;
}

