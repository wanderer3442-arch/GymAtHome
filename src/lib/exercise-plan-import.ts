import { exercises } from './exercise-database';
import { WorkoutPlan, WorkoutExercise, Goal, Equipment } from './types';

/**
 * Converts the compact workout-plan JSON V appends to its answers
 * (`[{ day, exercises: [{ name, sets, reps }] }]`) into a real WorkoutPlan so a
 * plan written in the chat can be saved into the Exercise Plan page.
 *
 * Existing days that the AI redefines are replaced; other days stay untouched,
 * so saving twice is harmless and a previous plan isn't wiped wholesale.
 */

export interface AiExercisePlanDay {
  day: string;
  exercises: { name: string; sets: number; reps: number }[];
}

const WEEK = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const singular = (s: string) => s.replace(/\b([a-z]{3,})s\b/g, '$1');

function hasWord(haystack: string, needle: string): boolean {
  if (!needle) return false;
  return new RegExp(`(^| )${escapeRe(needle)}( |$)`).test(haystack);
}

/** Best exercise-database match for a free-text exercise name. */
export function matchExerciseName(name: string) {
  const n = norm(name);
  if (!n) return null;
  const ns = singular(n);

  let best: (typeof exercises)[number] | null = null;
  let bestScore = 0;
  let bestLen = 0;

  for (const ex of exercises) {
    const en = norm(ex.name);
    if (!en) continue;
    const ens = singular(en);

    let score = 0;
    if (en === n) score = 4;
    else if (ens === ns) score = 3;
    else if (hasWord(n, en) || hasWord(ns, ens)) score = 2;
    else if (hasWord(en, n) || hasWord(ens, ns)) score = 1;
    if (score === 0) continue;

    // Exact/singular wins first; then longer names (more specific) for
    // "name inside text", shorter ones (closest) for "text inside name".
    const better =
      score > bestScore ||
      (score === bestScore &&
        (score >= 2 ? en.length > bestLen : en.length < bestLen));
    if (better) {
      best = ex;
      bestScore = score;
      bestLen = en.length;
    }
  }
  return best;
}

/** "Today" → weekday name, "Day 3" → "Day 3", "monday" → "Monday". */
function displayDayName(label: string): string {
  const l = (label || '').trim().toLowerCase();
  if (l === 'today') return WEEK[new Date().getDay()];
  if (l === 'tomorrow') return WEEK[(new Date().getDay() + 1) % 7];

  const named = WEEK.find((w) => w.toLowerCase() === l || l.includes(w.toLowerCase()));
  if (named) return named;

  const dayNum = l.match(/day\s*(\d+)/);
  if (dayNum) return `Day ${dayNum[1]}`;

  return label.trim() || 'Day 1';
}

const slug = (s: string) =>
  norm(s).replace(/ /g, '-').slice(0, 40) || 'exercise';

export interface MergeResult {
  plan: WorkoutPlan;
  added: number;
  days: number;
  matched: number;
}

export function mergeAiExercisePlan(
  days: AiExercisePlanDay[],
  existing: WorkoutPlan | null,
  opts: { goal?: Goal | null; equipment?: Equipment; name?: string } = {}
): MergeResult {
  const importedDayNames = new Set(days.map((d) => displayDayName(d.day)));
  const kept = (existing?.exercises ?? []).filter(
    (e) => !importedDayNames.has(e.day)
  );

  const imported: WorkoutExercise[] = [];
  const seen = new Set<string>();
  let matched = 0;

  days.forEach((d) => {
    const dayName = displayDayName(d.day);
    (d.exercises ?? []).forEach((ex) => {
      const label = String(ex?.name ?? '').trim();
      if (!label) return;
      // One entry per exercise per day — re-saving never duplicates rows.
      const dedupeKey = `${dayName}::${label.toLowerCase()}`;
      if (seen.has(dedupeKey)) return;
      seen.add(dedupeKey);

      const db = matchExerciseName(label);
      if (db) matched++;
      imported.push({
        // Keep V's plain name for display; the database id (when found) powers
        // calorie estimates and logging.
        exerciseId: db?.id ?? `ai-${slug(label)}`,
        exerciseName: label,
        sets: Math.max(1, Math.round(Number(ex?.sets) || 3)),
        reps: Math.max(1, Math.round(Number(ex?.reps) || 10)),
        day: dayName,
      });
    });
  });

  const allExercises = [...kept, ...imported];
  const dayCount = new Set(allExercises.map((e) => e.day)).size;

  return {
    plan: {
      id: existing?.id ?? `plan-${Date.now()}`,
      name: opts.name || existing?.name || 'V Workout Plan',
      goal: opts.goal ?? existing?.goal ?? 'maintain',
      equipment: opts.equipment ?? existing?.equipment ?? 'home',
      daysPerWeek: dayCount || days.length,
      exercises: allExercises,
      isGenerated: true,
      // Day labels come straight from the exercises — no split grouping.
      split: undefined,
    },
    added: imported.length,
    days: importedDayNames.size,
    matched,
  };
}
