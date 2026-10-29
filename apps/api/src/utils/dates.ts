export const DEFAULT_TIMEZONE = "Asia/Kolkata";

/**
 * Returns the current date in YYYY-MM-DD format within the given timezone (default Asia/Kolkata).
 */
export function todayInTz(tz: string = DEFAULT_TIMEZONE, date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date);
}

/**
 * Returns formatted YYYY-MM-DD string for any given Date object in the specified timezone.
 */
export function formatDateInTz(date: Date, tz: string = DEFAULT_TIMEZONE): string {
  return todayInTz(tz, date);
}

/**
 * Checks whether the current time in the given timezone is past a cutoff time (e.g. "18:00").
 */
export function isPastCutoff(
  cutoffTime: string = "18:00",
  tz: string = DEFAULT_TIMEZONE,
  now: Date = new Date()
): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(now);

  const currentHour = parseInt(parts.find((p) => p.type === "hour")?.value || "0", 10);
  const currentMinute = parseInt(parts.find((p) => p.type === "minute")?.value || "0", 10);
  const currentMinutes = currentHour * 60 + currentMinute;

  const [cutoffH = 18, cutoffM = 0] = cutoffTime.split(":").map((v) => parseInt(v, 10));
  const cutoffMinutes = cutoffH * 60 + cutoffM;

  return currentMinutes >= cutoffMinutes;
}

/**
 * Checks whether a given YYYY-MM-DD date is a working day (not in holidays list and not a weekly off day).
 * Weekly offs default to [0] (Sunday).
 */
export function isWorkingDay(
  dateStr: string,
  holidays: string[] = [],
  weeklyOffs: number[] = [0]
): boolean {
  if (holidays.includes(dateStr)) {
    return false;
  }
  const d = new Date(`${dateStr}T00:00:00Z`);
  const dayOfWeek = d.getUTCDay();
  return !weeklyOffs.includes(dayOfWeek);
}

/**
 * Adds a number of working days to a starting YYYY-MM-DD date, skipping holidays and weekly offs.
 */
export function addWorkingDays(
  startDateStr: string,
  days: number,
  holidays: string[] = [],
  weeklyOffs: number[] = [0]
): string {
  let count = 0;
  let current = new Date(`${startDateStr}T00:00:00Z`);

  while (count < days) {
    current.setUTCDate(current.getUTCDate() + 1);
    const dateStr = current.toISOString().slice(0, 10);
    if (isWorkingDay(dateStr, holidays, weeklyOffs)) {
      count++;
    }
  }

  return current.toISOString().slice(0, 10);
}

/**
 * Adds calendar days to a YYYY-MM-DD date string.
 */
export function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Checks if a date string is strictly in the past relative to today in the given timezone.
 */
export function isPast(dateStr: string, tz: string = DEFAULT_TIMEZONE): boolean {
  return dateStr < todayInTz(tz);
}

/**
 * Returns today's ISO date string in tenant timezone (alias for backward compatibility).
 */
export function todayISO(tz: string = DEFAULT_TIMEZONE): string {
  return todayInTz(tz);
}
