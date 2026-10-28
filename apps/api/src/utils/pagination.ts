export interface ListQuery {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function toPage<T>(items: T[], total: number, page: number = 1, limit: number = 50): Page<T> {
  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
  };
}
