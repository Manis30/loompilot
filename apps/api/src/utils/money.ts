export {
  applyPercentage,
  formatINR,
  rupeesToPaise,
  paiseToRupees,
  addPaise,
} from "@loompilot/shared";

export function subPaise(a: number, b: number, allowNegative: boolean = false): number {
  const result = Math.trunc(a) - Math.trunc(b);
  if (!allowNegative && result < 0) {
    throw new Error(`Subtraction resulted in negative paise: ${result}`);
  }
  return result;
}

export function multiplyPaise(paise: number, factor: number): number {
  return Math.round(paise * factor);
}

export function assertIntegerPaise(amount: number): void {
  if (!Number.isInteger(amount)) {
    throw new Error(`Amount '${amount}' must be an integer paise amount`);
  }
  if (amount < 0) {
    throw new Error(`Amount '${amount}' cannot be negative paise`);
  }
}
