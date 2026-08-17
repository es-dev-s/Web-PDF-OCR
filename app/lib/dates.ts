export const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export function formatDate(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

export function formatDateTime(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${formatDate(date)}, ${hh}:${mm}`;
}

export function formatRelative(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const delta = Date.now() - date.getTime();
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (delta < minute) return "now";
  if (delta < hour) return `${Math.floor(delta / minute)}m`;
  if (delta < day) return `${Math.floor(delta / hour)}h`;
  return `${Math.floor(delta / day)}d`;
}

export const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;

export function toDayKey(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayKey(): string {
  return toDayKey(new Date());
}

export function formatDayKey(key: string): string {
  const [year, month, date] = key.split("-").map(Number);
  if (!year || !month || !date) return key;
  return `${date} ${MONTHS[month - 1]} ${year}`;
}

export function shiftMonth(year: number, month: number, delta: number) {
  const next = new Date(year, month + delta, 1);
  return { year: next.getFullYear(), month: next.getMonth() };
}

export type CalendarCell = {
  key: string
  day: number
  inMonth: boolean
};

export function monthCells(year: number, month: number): CalendarCell[] {
  const first = new Date(year, month, 1);
  const start = first.getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const prevDays = new Date(year, month, 0).getDate();
  const cells: CalendarCell[] = [];
  for (let i = 0; i < start; i += 1) {
    const day = prevDays - start + 1 + i;
    const date = new Date(year, month - 1, day);
    cells.push({ key: toDayKey(date), day, inMonth: false });
  }
  for (let day = 1; day <= days; day += 1) {
    cells.push({
      key: toDayKey(new Date(year, month, day)),
      day,
      inMonth: true,
    });
  }
  while (cells.length % 7 !== 0) {
    const day = cells.length - (start + days) + 1;
    const date = new Date(year, month + 1, day);
    cells.push({ key: toDayKey(date), day, inMonth: false });
  }
  return cells;
}
