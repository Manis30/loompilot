import { describe, it, expect } from "vitest";
import {
  todayInTz,
  isPastCutoff,
  isWorkingDay,
  addWorkingDays,
  addDays,
  isPast,
  DEFAULT_TIMEZONE,
} from "../../src/utils/dates.js";

describe("Tenant Timezone & Date Utilities (Asia/Kolkata)", () => {
  describe("todayInTz edge cases around midnight IST", () => {
    it("returns previous calendar day at 23:30 IST (18:00 UTC)", () => {
      // 18:00:00 UTC on 2026-10-28 is 23:30:00 IST on 2026-10-28
      const utcDate = new Date("2026-10-28T18:00:00.000Z");
      const dateInIST = todayInTz(DEFAULT_TIMEZONE, utcDate);
      expect(dateInIST).toBe("2026-10-28");
    });

    it("returns next calendar day at 00:30 IST (19:00 UTC)", () => {
      // 19:00:00 UTC on 2026-10-28 is 00:30:00 IST on 2026-10-29
      const utcDate = new Date("2026-10-28T19:00:00.000Z");
      const dateInIST = todayInTz(DEFAULT_TIMEZONE, utcDate);
      expect(dateInIST).toBe("2026-10-29");
    });

    it("correctly handles custom tenant timezone (e.g. UTC)", () => {
      const utcDate = new Date("2026-10-28T19:00:00.000Z");
      expect(todayInTz("UTC", utcDate)).toBe("2026-10-28");
    });
  });

  describe("isPastCutoff", () => {
    it("returns false before cutoff time in tenant timezone", () => {
      // 12:29 UTC is 17:59 IST (before 18:00 cutoff)
      const beforeCutoff = new Date("2026-10-28T12:29:00.000Z");
      expect(isPastCutoff("18:00", DEFAULT_TIMEZONE, beforeCutoff)).toBe(false);
    });

    it("returns true at or after cutoff time in tenant timezone", () => {
      // 12:30 UTC is 18:00 IST (exactly at 18:00 cutoff)
      const atCutoff = new Date("2026-10-28T12:30:00.000Z");
      expect(isPastCutoff("18:00", DEFAULT_TIMEZONE, atCutoff)).toBe(true);

      // 12:31 UTC is 18:01 IST (past cutoff)
      const afterCutoff = new Date("2026-10-28T12:31:00.000Z");
      expect(isPastCutoff("18:00", DEFAULT_TIMEZONE, afterCutoff)).toBe(true);
    });
  });

  describe("Working Day Helpers", () => {
    const holidays = ["2026-11-01", "2026-11-04"]; // e.g. Diwali
    const sundayOff = [0]; // Sunday = 0

    it("evaluates working days correctly", () => {
      // 2026-11-01 is Sunday and in holidays -> false
      expect(isWorkingDay("2026-11-01", holidays, sundayOff)).toBe(false);
      // 2026-11-02 is Monday -> true
      expect(isWorkingDay("2026-11-02", holidays, sundayOff)).toBe(true);
      // 2026-11-04 is Wednesday but holiday -> false
      expect(isWorkingDay("2026-11-04", holidays, sundayOff)).toBe(false);
    });

    it("adds working days skipping Sundays and holidays", () => {
      // Starting from Friday 2026-10-30:
      // Saturday 2026-10-31: working day 1
      // Sunday 2026-11-01: OFF
      // Monday 2026-11-02: working day 2
      // Tuesday 2026-11-03: working day 3
      // Wednesday 2026-11-04: Holiday (skipped)
      // Thursday 2026-11-05: working day 4
      const result = addWorkingDays("2026-10-30", 4, holidays, sundayOff);
      expect(result).toBe("2026-11-05");
    });

    it("adds calendar days correctly", () => {
      expect(addDays("2026-10-30", 3)).toBe("2026-11-02");
    });
  });
});

