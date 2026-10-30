import { describe, it, expect } from "vitest";
import {
  paginationQuerySchema,
  createPaginationMeta,
  paginate,
} from "../../src/utils/pagination.js";

describe("Pagination Utility", () => {
  it("applies default query values", () => {
    const parsed = paginationQuerySchema.parse({});
    expect(parsed.page).toBe(1);
    expect(parsed.limit).toBe(20);
    expect(parsed.sortOrder).toBe("desc");
  });

  it("coerces string numbers and limits max limit to 100", () => {
    const parsed = paginationQuerySchema.parse({
      page: "3",
      limit: "50",
      sortBy: "createdAt",
      sortOrder: "asc",
    });

    expect(parsed.page).toBe(3);
    expect(parsed.limit).toBe(50);
    expect(parsed.sortBy).toBe("createdAt");
    expect(parsed.sortOrder).toBe("asc");

    expect(() =>
      paginationQuerySchema.parse({
        limit: "150", // exceeds max 100
      })
    ).toThrow();
  });

  it("creates pagination metadata accurately", () => {
    const meta = createPaginationMeta(95, 2, 20);
    expect(meta.total).toBe(95);
    expect(meta.page).toBe(2);
    expect(meta.limit).toBe(20);
    expect(meta.totalPages).toBe(5);
    expect(meta.hasNext).toBe(true);
    expect(meta.hasPrev).toBe(true);
  });

  it("wraps data in paginated result envelope", () => {
    const items = [{ id: "1" }, { id: "2" }];
    const result = paginate(items, 2, 1, 10);
    expect(result.data).toEqual(items);
    expect(result.meta.total).toBe(2);
    expect(result.meta.hasNext).toBe(false);
    expect(result.meta.hasPrev).toBe(false);
  });
});

