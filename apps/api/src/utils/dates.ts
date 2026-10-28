export function todayISO(): string {
  return new Date().toISOString().split("T")[0]!;
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0]!;
}

export function isPast(dateStr: string): boolean {
  return dateStr < todayISO();
}
