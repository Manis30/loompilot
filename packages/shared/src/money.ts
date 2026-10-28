import { PAISE_PER_RUPEE } from "./constants.js";

/**
 * Pure monetary utilities ensuring zero floating-point accumulation errors.
 * All amounts inside database and internal payloads are integer paise.
 */

export function rupeesToPaise(rupees: number | string): number {
  const num = typeof rupees === "string" ? parseFloat(rupees) : rupees;
  if (isNaN(num)) {
    throw new Error(`Invalid rupee amount: ${rupees}`);
  }
  return Math.round(num * PAISE_PER_RUPEE);
}

export function paiseToRupees(paise: number): number {
  return paise / PAISE_PER_RUPEE;
}

export function formatINR(paise: number): string {
  const rupees = paiseToRupees(paise);
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

export function applyPercentage(paise: number, percentage: number): number {
  return Math.round((paise * percentage) / 100);
}
