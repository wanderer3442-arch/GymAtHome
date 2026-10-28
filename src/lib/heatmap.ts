import { addDays, localDateKey, mondayIndex, startOfMonth } from './date';

/** How much history a heatmap shows. */
export type HeatRange = '7d' | 'month' | 'year';
/** Calendar = cells carry the day number (like a wall calendar); grid = GitHub strip. */
export type HeatKind = 'calendar' | 'grid';

export interface HeatDay {
  key: string;
  date: Date;
  /** 0 = nothing, 1 = full (all habits done / meals + workout logged). */
  value: number;
  future: boolean;
}

export const RANGE_LABEL: Record<HeatRange, string> = {
  '7d': 'Last 7 days',
  month: 'This month',
  year: 'This year',
};

export const RANGE_SHORT: Record<HeatRange, string> = {
  '7d': '7 days',
  month: 'Month',
  year: 'Year',
};

/** Day cells for a range, in chronological order (oldest first). */
export function buildHeatDays(
  range: HeatRange,
  getValue: (key: string) => number,
  now: Date = new Date()
): HeatDay[] {
  const todayKey = localDateKey(now);
  const days: HeatDay[] = [];

  const push = (date: Date) => {
    const key = localDateKey(date);
    days.push({
      key,
      date,
      value: Math.max(0, Math.min(1, getValue(key))),
      future: key > todayKey,
    });
  };

  if (range === '7d') {
    for (let i = 6; i >= 0; i -= 1) push(addDays(now, -i));
    return days;
  }

  if (range === 'month') {
    const first = startOfMonth(now);
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0, 12);
    for (let d = new Date(first); d <= last; d = addDays(d, 1)) push(d);
    return days;
  }

  const first = new Date(now.getFullYear(), 0, 1, 12);
  const last = new Date(now.getFullYear(), 11, 31, 12);
  for (let d = new Date(first); d <= last; d = addDays(d, 1)) push(d);
  return days;
}

/** Monday-aligned weeks (columns), padded with `null` before/after the range. */
export function toWeeks(days: HeatDay[]): (HeatDay | null)[][] {
  if (days.length === 0) return [];
  const cells: (HeatDay | null)[] = [];
  const lead = mondayIndex(days[0].date);
  for (let i = 0; i < lead; i += 1) cells.push(null);
  cells.push(...days);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (HeatDay | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** Split a full-year list into 12 Monday-aligned month grids. */
export function toMonthGrids(days: HeatDay[]): { month: number; weeks: (HeatDay | null)[][] }[] {
  const buckets: HeatDay[][] = Array.from({ length: 12 }, () => []);
  days.forEach((d) => {
    buckets[d.date.getMonth()].push(d);
  });
  return buckets
    .map((bucket, month) => ({ month, weeks: toWeeks(bucket) }))
    .filter((m) => m.weeks.length > 0);
}

export function heatColorClass(value: number): string {
  if (value <= 0) return 'bg-surface-container-high';
  if (value < 0.34) return 'bg-primary/[0.28]';
  if (value < 0.67) return 'bg-primary/[0.55]';
  if (value < 1) return 'bg-primary/[0.8]';
  return 'bg-primary';
}

export const HEAT_LEGEND = [0, 0.3, 0.6, 0.85, 1];

export function heatSummary(days: HeatDay[], unit = 'days'): string {
  const elapsed = days.filter((d) => !d.future);
  const active = elapsed.filter((d) => d.value > 0).length;
  if (elapsed.length === 0) return `No ${unit} yet`;
  return `${active} of ${elapsed.length} ${unit} active`;
}
