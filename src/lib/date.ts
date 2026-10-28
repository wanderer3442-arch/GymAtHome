/**
 * Local-calendar helpers.
 *
 * Timestamps are stored as ISO strings (UTC), but every "day" the user sees is
 * their *local* day. Deriving date keys with `toISOString()` gives the UTC day,
 * which in India is wrong between 00:00 and 05:29 — meals, workouts and habit
 * ticks landed on yesterday. Everything day-based goes through here.
 */

export function localDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Parse a YYYY-MM-DD key as local noon (stable across DST). */
export function dateFromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y || 1970, (m || 1) - 1, d || 1, 12);
}

/** Local date key of an ISO timestamp (or a plain date key). */
export function keyOfTimestamp(iso: string | null | undefined): string {
  if (!iso) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso.slice(0, 10) : localDateKey(d);
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function addDaysKey(key: string, days: number): string {
  return localDateKey(addDays(dateFromKey(key), days));
}

/** Monday = 0 … Sunday = 6. */
export function mondayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 12);
}

export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 12);
}

export function monthLabel(date: Date, short = false): string {
  return date.toLocaleDateString('en-US', { month: short ? 'short' : 'long', year: 'numeric' });
}

export function dayLabel(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/** Whole days between two date keys (b - a). */
export function daysBetween(a: string, b: string): number {
  const ms = dateFromKey(b).getTime() - dateFromKey(a).getTime();
  return Math.round(ms / 86_400_000);
}

/** Consecutive days ending today (or yesterday, if today is still empty). */
export function streakEndingToday(hasDay: (key: string) => boolean, now = new Date()): number {
  let cursor = new Date(now);
  if (!hasDay(localDateKey(cursor))) {
    cursor = addDays(cursor, -1);
  }
  let count = 0;
  while (hasDay(localDateKey(cursor))) {
    count += 1;
    cursor = addDays(cursor, -1);
  }
  return count;
}
