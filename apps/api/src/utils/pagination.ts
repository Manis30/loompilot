export interface ListQuery {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  sort?: string;
  status?: string;
  from?: string;
  to?: string;
  q?: string;
}

export interface ParsedListQuery {
  page: number;
  limit: number;
  skip: number;
  sort?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  status?: string;
  from?: string;
  to?: string;
  q?: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages?: number;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function parseListQuery(query: any): ParsedListQuery {
  const page = Math.max(1, parseInt(query?.page as string, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query?.limit as string, 10) || 20));
  const skip = (page - 1) * limit;

  const sort = (query?.sort as string) || (query?.sortBy ? `${query.sortBy}:${query.sortOrder || "desc"}` : undefined);
  const status = query?.status as string | undefined;
  const from = query?.from as string | undefined;
  const to = query?.to as string | undefined;
  const q = (query?.q as string) || (query?.search as string) || undefined;

  return {
    page,
    limit,
    skip,
    sort,
    sortBy: query?.sortBy as string | undefined,
    sortOrder: (query?.sortOrder as "asc" | "desc") || undefined,
    status,
    from,
    to,
    q,
  };
}

export function toPage<T>(items: T[], total: number, page: number = 1, limit: number = 20): Page<T> {
  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
  };
}

export function buildPaginatedEnvelope<T>(
  items: T[],
  meta: { page: number; limit: number; total: number },
  requestId?: string
) {
  return {
    data: items,
    meta: {
      page: meta.page,
      limit: meta.limit,
      total: meta.total,
    },
    // Backwards-compatible top-level fields
    total: meta.total,
    page: meta.page,
    limit: meta.limit,
    ...(requestId ? { requestId } : {}),
  };
}
