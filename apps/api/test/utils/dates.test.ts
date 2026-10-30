import { describe, it, expect } from "vitest";
import {
  isBusinessDateString,
  toBusinessDateString,
  parseBusinessDate,
  isWorkingDay,
  addWorkingDays,
  countWorkingDaysBetween,
  validateWeeklyOffs,
} from "../../src/utils/dates.js";

describe("Date Utilities (Tenant Timezone & Working Days with weeklyOffs)", () => {
  it("validates strict 'YYYY-MM-DD' business date strings", () => {
    expect(isBusinessDateString("2026-10-29")).toBe(true);
    expect(isBusinessDateString("2026-02-28")).toBe(true);
    expect(isBusinessDateString("2026-13-01")).toBe(false);
    expect(isBusinessDateString("2026-02-31")).toBe(false);
    expect(isBusinessDateString("29-10-2026")).toBe(false);
    expect(isBusinessDateString("invalid")).toBe(false);
  });

  it("formats dates to 'YYYY-MM-DD' in specified timezone", () => {
    const lateUtcDate = new Date("2026-10-29T23:30:00.000Z");
    const kolkataDateStr = toBusinessDateString(lateUtcDate, "Asia/Kolkata");
    expect(kolkataDateStr).toBe("2026-10-30");

    const utcDateStr = toBusinessDateString(lateUtcDate, "UTC");
    expect(utcDateStr).toBe("2026-10-29");
  });

  it("parses business date string into UTC Date object", () => {
    const parsed = parseBusinessDate("2026-10-29");
    expect(parsed.getUTCFullYear()).toBe(2026);
    expect(parsed.getUTCMonth()).toBe(9);
    expect(parsed.getUTCDate()).toBe(29);
  });

  it("validates weeklyOffs strictly: integers 0-6, at most 6 distinct days", () => {
    // Valid cases: 0 to 6 distinct days
    expect(() => validateWeeklyOffs([])).not.toThrow();
    expect(() => validateWeeklyOffs([0])).not.toThrow();
    expect(() => validateWeeklyOffs([0, 6])).not.toThrow();
    expect(() => validateWeeklyOffs([0, 1, 2, 3, 4, 5])).not.toThrow();

    // Invalid day numbers
    expect(() => validateWeeklyOffs([7])).toThrow(/Invalid weekly off day '7'/);
    expect(() => validateWeeklyOffs([-1])).toThrow(/Invalid weekly off day '-1'/);
    expect(() => validateWeeklyOffs([1.5])).toThrow(/Invalid weekly off day '1.5'/);
    expect(() => validateWeeklyOffs("invalid" as unknown as number[])).toThrow(/must be an array/);

    // All 7 days configured as off: MUST THROW
    expect(() => validateWeeklyOffs([0, 1, 2, 3, 4, 5, 6])).toThrow(
      /Cannot configure all 7 days as weekly offs; at least one working day is required/
    );

    // All 7 days with duplicates: MUST THROW
    expect(() => validateWeeklyOffs([0, 1, 2, 3, 4, 5, 6, 0])).toThrow(
      /Cannot configure all 7 days as weekly offs/
    );
  });

  it("respects required weeklyOffs (0=Sun, 5=Fri, 6=Sat) without default Sunday", () => {
    // 2026-11-01 is a Sunday (day 0)
    // 2026-11-06 is a Friday (day 5)
    // 2026-11-07 is a Saturday (day 6)

    // With Sunday off (weeklyOffs = [0]):
    expect(isWorkingDay("2026-11-01", [0], [])).toBe(false);
    expect(isWorkingDay("2026-11-06", [0], [])).toBe(true);

    // With Friday off only (weeklyOffs = [5]): Sunday is a working day, Friday is non-working
    expect(isWorkingDay("2026-11-01", [5], [])).toBe(true);
    expect(isWorkingDay("2026-11-06", [5], [])).toBe(false);

    // With weekend off (weeklyOffs = [0, 6]):
    expect(isWorkingDay("2026-11-01", [0, 6], [])).toBe(false);
    expect(isWorkingDay("2026-11-07", [0, 6], [])).toBe(false);

    // With no weekly offs (weeklyOffs = []):
    expect(isWorkingDay("2026-11-01", [], [])).toBe(true);

    // Monday as a declared holiday
    expect(isWorkingDay("2026-11-02", [0], ["2026-11-02"])).toBe(false);

    // All days off throws an error
    expect(() => isWorkingDay("2026-11-01", [0, 1, 2, 3, 4, 5, 6], [])).toThrow(
      /Cannot configure all 7 days as weekly offs/
    );
  });

  it("adds working days skipping configured weeklyOffs and holidays", () => {
    // 2026-10-30 is Friday.
    // With weeklyOffs = [0] (Sunday):
    // +1 -> 2026-10-31 (Sat)
    // +2 -> 2026-11-02 (Mon, skipping Sun 2026-11-01)
    const result = addWorkingDays("2026-10-30", 2, [0], []);
    expect(result).toBe("2026-11-02");

    // With weeklyOffs = [0, 6] (Sat & Sun):
    // +1 -> 2026-11-02 (Mon)
    // +2 -> 2026-11-03 (Tue)
    const resultWeekendOff = addWorkingDays("2026-10-30", 2, [0, 6], []);
    expect(resultWeekendOff).toBe("2026-11-03");

    // With holiday on Monday 2026-11-02:
    const resultWithHoliday = addWorkingDays("2026-10-30", 2, [0], ["2026-11-02"]);
    expect(resultWithHoliday).toBe("2026-11-03");

    // Throw if all 7 days off:
    expect(() => addWorkingDays("2026-10-30", 1, [0, 1, 2, 3, 4, 5, 6], [])).toThrow(
      /Cannot configure all 7 days as weekly offs/
    );
  });

  it("counts working days between dates using configured weeklyOffs", () => {
    // 2026-10-30 (Fri) to 2026-11-02 (Mon)
    // weeklyOffs = [0] (Sunday off): Fri, Sat, Mon = 3 working days
    expect(countWorkingDaysBetween("2026-10-30", "2026-11-02", [0], [])).toBe(3);

    // weeklyOffs = [0, 6] (Sat & Sun off): Fri, Mon = 2 working days
    expect(countWorkingDaysBetween("2026-10-30", "2026-11-02", [0, 6], [])).toBe(2);

    // If Monday is holiday:
    expect(countWorkingDaysBetween("2026-10-30", "2026-11-02", [0], ["2026-11-02"])).toBe(2);

    // Throw if all 7 days off:
    expect(() =>
      countWorkingDaysBetween("2026-10-30", "2026-11-02", [0, 1, 2, 3, 4, 5, 6], [])
    ).toThrow(/Cannot configure all 7 days as weekly offs/);
  });
});
