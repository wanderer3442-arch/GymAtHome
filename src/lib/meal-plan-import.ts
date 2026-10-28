import { allFoods } from './food-database';
import { isBulkServing, makeSelection, parseGrams, servingUnitGrams } from './food-portion';
import { DayFoodIntake, FoodItem, FoodSelection, WeeklyFoodPreference } from './types';

/**
 * Turns the compact meal-plan JSON that V appends to its answers
 * (`[{ day, meals: [...] }]`) into real weekly meal-plan entries, so a plan
 * generated in the chat can be saved straight into the Meal Plan page.
 *
 * Meal strings may be prefixed with their slot ("Breakfast: 2 idlis + sambar").
 * Without a prefix the position decides: 1st = breakfast, 2nd = lunch, rest =
 * dinner. Each piece is matched against the food database so calories/macros
 * come from real data; unmatched pieces are kept by name (0 kcal until logged).
 */

export interface ParsedPlanDay {
  day: string;
  meals: string[];
}

const DAY_KEYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

type DayKey = (typeof DAY_KEYS)[number];
type Slot = 'breakfast' | 'lunch' | 'dinner';

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Crude singular: "idlis" -> "idli", "rotis" -> "roti" (drops a trailing s). */
const singular = (s: string) => s.replace(/\b([a-z]{3,})s\b/g, '$1');

/** Whole-word containment test on already-normalized text. */
function hasWord(haystack: string, needle: string): boolean {
  if (!needle) return false;
  return new RegExp(`(^| )${escapeRe(needle)}( |$)`).test(haystack);
}

/** Best food-database match for a free-text meal item. */
export function matchFoodText(text: string): FoodItem | null {
  const n = norm(text);
  if (!n) return null;
  const ns = singular(n);

  let best: FoodItem | null = null;
  let bestScore = 0;
  let bestLen = 0;

  for (const food of allFoods) {
    const fn = norm(food.name);
    if (!fn) continue;
    const fns = singular(fn);

    // Exact > singular-exact > "name appears in the text" > "text appears in
    // the name". Longer names are more specific; shorter ones are more generic
    // ("sambar" should resolve to Sambar, not Yellow Cucumber Sambar).
    let score = 0;
    if (fn === n) score = 4;
    else if (fns === ns) score = 3;
    else if (hasWord(n, fn) || hasWord(ns, fns)) score = 2;
    else if (hasWord(fn, n) || hasWord(fns, ns)) score = 1;
    if (score === 0) continue;

    const better =
      score > bestScore ||
      (score === bestScore &&
        (score >= 2 ? fn.length > bestLen : fn.length < bestLen));

    if (better) {
      best = food;
      bestScore = score;
      bestLen = fn.length;
    }
  }
  return best;
}

/** "2 idlis + sambar, 1 banana" -> ["2 idlis", "sambar", "1 banana"] */
function splitItems(text: string): string[] {
  return text
    .split(/\s*(?:\+|,|;|&|\band\b)\s*/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Pull the slot from an optional "Breakfast: ..." style prefix. */
function slotFromPrefix(entry: string): { slot: Slot | null; rest: string } {
  const m = entry.match(
    /^\s*(breakfast|brunch|morning|mid[- ]?morning|snack|lunch|noon|afternoon|dinner|supper|evening|night)\s*[:\-–—]\s*(.+)$/i
  );
  if (!m) return { slot: null, rest: entry.trim() };
  const label = m[1].toLowerCase();
  let slot: Slot = 'dinner';
  if (/breakfast|brunch|morning/.test(label)) slot = 'breakfast';
  else if (/lunch|noon|afternoon/.test(label)) slot = 'lunch';
  // Snacks attach to the closest main meal so nothing is lost.
  else if (/snack/.test(label)) slot = 'lunch';
  return { slot, rest: m[2].trim() };
}

function toSelection(text: string): FoodSelection {
  // "3 rotis" -> 3 pieces; plain names stay at 1. An explicit gram amount in
  // the text ("3 rotis (120 g)") always wins.
  const qtyMatch = text.match(/^\s*(\d+(?:\.\d+)?)\s*/);
  const qty = qtyMatch ? Math.max(1, Math.round(parseFloat(qtyMatch[1]))) : 1;
  const explicitGrams = parseGrams(text);
  const food = matchFoodText(text);
  if (food) {
    // A bare count ("5 almonds") is a number of pieces, not five bulk servings:
    // when the only serving size is a weight and the text names no unit, treat
    // it as one serving instead of multiplying.
    const hasUnit =
      /\b(?:g|gram|grams|kg|ml|l|oz|cups?|tbsp|tsp|tablespoons?|teaspoons?|katori|bowls?|glasses?|cans?|slices?|pieces?|scoops?|plates?|servings?)\b/i.test(
        text
      );
    const servings = isBulkServing(food) && !hasUnit && qty > 1 ? 1 : qty;
    const grams = explicitGrams ?? Math.round(servingUnitGrams(food) * servings);
    return makeSelection(food, grams);
  }
  return {
    foodId: '',
    foodName: text.replace(/\s*\([^)]*\b(?:g|grams?|ml)\b[^)]*\)\s*$/i, '').trim() || text,
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    servingSize: explicitGrams ? `${explicitGrams} g` : '1 serving',
    quantity: 1,
    ...(explicitGrams ? { grams: explicitGrams } : {}),
  };
}

/** Map a plan label ("Today", "Tomorrow", "Monday", "Day 3") to a weekday. */
function resolveDayKey(label: string, fallbackIndex: number, today: Date): DayKey {
  const l = (label || '').trim().toLowerCase();
  const offset = (days: number): DayKey => {
    const d = new Date(today);
    d.setDate(d.getDate() + days);
    return DAY_KEYS[d.getDay()];
  };

  if (/\btoday\b/.test(l)) return offset(0);
  if (/\btomorrow\b/.test(l)) return offset(1);

  const named = DAY_KEYS.find((k) => l.includes(k));
  if (named) return named;

  const dayNum = l.match(/day\s*(\d+)/);
  if (dayNum) return offset(Math.max(0, parseInt(dayNum[1], 10) - 1));

  return offset(fallbackIndex);
}

export interface SavePlanResult {
  prefs: WeeklyFoodPreference;
  added: number;
  days: number;
  unmatched: number;
}

/**
 * Merge a parsed AI plan into the stored weekly preferences.
 * Existing entries are kept; duplicates (same food name in the same day/slot)
 * are skipped so tapping "Save plan" twice is harmless.
 */
export function savePlanToPreferences(
  plan: ParsedPlanDay[],
  prefs: WeeklyFoodPreference,
  today: Date = new Date()
): SavePlanResult {
  const next: WeeklyFoodPreference = { ...prefs };
  let added = 0;
  let days = 0;
  let unmatched = 0;

  plan.forEach((entry, idx) => {
    if (!entry || !Array.isArray(entry.meals) || entry.meals.length === 0) return;

    const key = resolveDayKey(entry.day, idx, today);
    const existing = next[key];
    const dayData: DayFoodIntake = {
      breakfast: [...(existing?.breakfast ?? [])],
      lunch: [...(existing?.lunch ?? [])],
      dinner: [...(existing?.dinner ?? [])],
      ...(existing?.mealPhoto ? { mealPhoto: existing.mealPhoto } : {}),
    };

    let dayAdded = 0;
    entry.meals.forEach((mealText, i) => {
      const { slot: prefSlot, rest } = slotFromPrefix(String(mealText));
      const slot: Slot = prefSlot ?? (i === 0 ? 'breakfast' : i === 1 ? 'lunch' : 'dinner');

      for (const piece of splitItems(rest)) {
        const sel = toSelection(piece);
        if (!sel.foodName.trim()) continue;
        const duplicate = dayData[slot].some(
          (f) => f.foodName.trim().toLowerCase() === sel.foodName.trim().toLowerCase()
        );
        if (duplicate) continue;
        dayData[slot].push(sel);
        dayAdded++;
        if (!sel.foodId) unmatched++;
      }
    });

    if (dayAdded > 0) {
      next[key] = dayData;
      added += dayAdded;
      days++;
    }
  });

  return { prefs: next, added, days, unmatched };
}
