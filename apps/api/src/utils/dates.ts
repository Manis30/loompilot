import { getEnv } from "../config/env.js";

const DEFAULT_TIMEZONE = "Asia/Kolkata";

/**
 * Validates weeklyOffs configuration:
 * - Must be an array of integers between 0 and 6 (0=Sunday, ..., 6=Saturday).
 * - Maximum of 6 distinct days.
 * - Throws if all 7 days are configured as weekly offs.
 */
export function validateWeeklyOffs(weeklyOffs: number[]): void {
  if (!Array.isArray(weeklyOffs)) {
    throw new Error("weeklyOffs must be an array of integers between 0 and 6");
  }

  const distinctDays = new Set<number>();
  for (const day of weeklyOffs) {
    if (!Number.isInteger(day) || day < 0 || day > 6) {
      throw new Error(
        `Invalid weekly off day '${day}'. Each day must be an integer between 0 (Sunday) and 6 (Saturday).`
      );
    }
    distinctDays.add(day);
  }

  if (distinctDays.size >= 7) {
    throw new Error(
      "Cannot configure all 7 days as weekly offs; at least one working day is required."
    );
  }
}

/**
 * Checks if a string is in strictly valid 'YYYY-MM-DD' format.
 */
export function isBusinessDateString(val: unknown): val is string {
  if (typeof val !== "string") return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(val);
  if (!match) return false;
  const [, y, m, d] = match;
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/**
 * Formats a Date or timestamp to 'YYYY-MM-DD' in the given timezone (defaults to tenant timezone).
 */
export function toBusinessDateString(
  dateInput: Date | string | number = new Date(),
  tz?: string
): string {
  const timezone = tz ?? getEnv().TENANT_TIMEZONE ?? DEFAULT_TIMEZONE;
  const date = typeof dateInput === "string" && isBusinessDateString(dateInput)
    ? parseBusinessDate(dateInput)
    : new Date(dateInput);

  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date input: ${String(dateInput)}`);
  }

  // Use Intl.DateTimeFormat to reliably extract year, month, day in target timezone
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(date); // en-CA formats as YYYY-MM-DD
}

/**
 * Returns today's date in 'YYYY-MM-DD' string in tenant timezone.
 */
export function getTodayBusinessDate(tz?: string): string {
  return toBusinessDateString(new Date(), tz);
}

/**
 * Parses a 'YYYY-MM-DD' string into a UTC midnight Date object.
 */
export function parseBusinessDate(dateStr: string): Date {
  if (!isBusinessDateString(dateStr)) {
    throw new Error(`Invalid business date string: '${dateStr}'. Expected format 'YYYY-MM-DD'`);
  }
  const [yearStr, monthStr, dayStr] = dateStr.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

/**
 * Checks if a given date or 'YYYY-MM-DD' string is a working day.
 * Days in weeklyOffs (0=Sunday, 1=Monday, ..., 6=Saturday) and dates present in holidays are non-working.
 * weeklyOffs and holidays are REQUIRED parameters matching settings in schema v3.
 */
export function isWorkingDay(
  dateInput: Date | string,
  weeklyOffs: number[],
  holidays: string[],
  tz?: string
): boolean {
  validateWeeklyOffs(weeklyOffs);

  const dateStr = typeof dateInput === "string" && isBusinessDateString(dateInput)
    ? dateInput
    : toBusinessDateString(dateInput, tz);

  if (holidays.includes(dateStr)) {
    return false;
  }

  const date = parseBusinessDate(dateStr);
  const dayOfWeek = date.getUTCDay(); // 0 is Sunday, 1 is Monday ... 6 is Saturday
  return !weeklyOffs.includes(dayOfWeek);
}

/**
 * Adds N working days to a start business date, skipping days matching weeklyOffs and holidays.
 * weeklyOffs and holidays are REQUIRED parameters matching settings in schema v3.
 */
export function addWorkingDays(
  startDateInput: Date | string,
  workingDaysToAdd: number,
  weeklyOffs: number[],
  holidays: string[],
  tz?: string
): string {
  validateWeeklyOffs(weeklyOffs);

  if (workingDaysToAdd < 0) {
    throw new Error(`Cannot add negative working days: ${workingDaysToAdd}`);
  }

  let currentDateStr = typeof startDateInput === "string" && isBusinessDateString(startDateInput)
    ? startDateInput
    : toBusinessDateString(startDateInput, tz);

  let daysRemaining = workingDaysToAdd;

  while (daysRemaining > 0) {
    const nextDate = parseBusinessDate(currentDateStr);
    nextDate.setUTCDate(nextDate.getUTCDate() + 1);
    currentDateStr = toBusinessDateString(nextDate, "UTC");

    if (isWorkingDay(currentDateStr, weeklyOffs, holidays, "UTC")) {
      daysRemaining--;
    }
  }

  return currentDateStr;
}

/**
 * Calculates the number of working days between two business dates (inclusive of both start and end if working).
 * weeklyOffs and holidays are REQUIRED parameters matching settings in schema v3.
 */
export function countWorkingDaysBetween(
  startDateStr: string,
  endDateStr: string,
  weeklyOffs: number[],
  holidays: string[]
): number {
  validateWeeklyOffs(weeklyOffs);

  if (!isBusinessDateString(startDateStr) || !isBusinessDateString(endDateStr)) {
    throw new Error("Both start and end dates must be valid 'YYYY-MM-DD' business date strings");
  }

  if (startDateStr > endDateStr) {
    return 0;
  }

  let count = 0;
  let current = parseBusinessDate(startDateStr);
  const end = parseBusinessDate(endDateStr);

  while (current <= end) {
    const currentStr = toBusinessDateString(current, "UTC");
    if (isWorkingDay(currentStr, weeklyOffs, holidays, "UTC")) {
      count++;
    }
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return count;
}
