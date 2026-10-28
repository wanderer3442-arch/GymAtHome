import { allFoods } from './food-database';
import type { FoodItem, FoodSelection, WeeklyFoodPreference } from './types';

/**
 * Portion maths for the meal plan.
 *
 * Food DB nutrition is per 100 g/ml, while a selection stores the totals for the
 * amount the user actually eats. `grams` is the source of truth; older saved
 * plans that predate it are backfilled from the serving label × quantity and
 * their macros are rebuilt so every entry uses the same unit.
 */

const foodsById = new Map<string, FoodItem[]>();
for (const food of allFoods) {
  const existing = foodsById.get(food.id);
  if (existing) existing.push(food);
  else foodsById.set(food.id, [food]);
}

const DAY_KEYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

export interface PortionNutrition {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

/** Resolve a food by id, preferring an exact name match when ids are duplicated. */
export function findFood(id: string, name?: string): FoodItem | null {
  if (!id) return null;
  const candidates = foodsById.get(id);
  if (!candidates || candidates.length === 0) return null;
  if (candidates.length === 1 || !name) return candidates[0];
  const key = name.trim().toLowerCase();
  return candidates.find((food) => food.name.trim().toLowerCase() === key) ?? candidates[0];
}

export function getSelectionFood(selection: FoodSelection): FoodItem | null {
  return findFood(selection.foodId, selection.foodName);
}

/** Standard portion from the food DB (first serving size), e.g. idli = 100 g. */
export function standardGrams(food: FoodItem | null): number {
  const amount = food?.servingSizes?.[0]?.amount;
  return Number.isFinite(amount) && (amount as number) > 0 ? Math.round(amount as number) : 100;
}

/**
 * Pull an explicit gram/ml amount out of free text or a serving label:
 * "120 g", "1 katori (150 g)", "2 pieces (100g)", "240ml" → 120 / 150 / 100 / 240.
 */
export function parseGrams(text?: string | null): number | null {
  if (!text) return null;
  const match = String(text).match(
    /(\d+(?:\.\d+)?)\s*(?:g|gm|grams?|ml|millilit(?:er|re)s?)\b/i
  );
  if (!match) return null;
  const value = parseFloat(match[1]);
  return Number.isFinite(value) && value > 0 ? Math.round(value) : null;
}

/** Total grams represented by one serving of a food (per piece for "2 pieces (100g)"). */
export function servingUnitGrams(food: FoodItem): number {
  const serving = food.servingSizes?.[0];
  if (!serving) return 100;
  const total =
    serving.amount > 0 ? serving.amount : parseGrams(serving.label) ?? 100;
  const countMatch = serving.label.match(
    /^\s*(\d+(?:\.\d+)?)\s*(?:pieces?|slices?|cups?|katoris?|bowls?|glasses?|scoops?|plates?|servings?)\b/i
  );
  const count = countMatch ? parseFloat(countMatch[1]) : 1;
  return total / Math.max(1, count);
}

/** True when the serving label is a bulk weight ("100 g") rather than a portion. */
export function isBulkServing(food: FoodItem): boolean {
  const label = food.servingSizes?.[0]?.label ?? '';
  return /^\s*(?:\d+(?:\.\d+)?\s*(?:oz|g|grams?|ml)\b|100\s*g\b)/i.test(label);
}

/** Nutrition for an arbitrary gram amount, using the DB's per-100 g values. */
export function nutritionForGrams(food: FoodItem, grams: number): PortionNutrition {
  const scale = Math.max(1, grams) / 100;
  const round1 = (value: number) => Math.round(value * scale * 10) / 10;
  return {
    calories: Math.round(food.nutrition.calories * scale),
    protein: round1(food.nutrition.protein),
    carbs: round1(food.nutrition.carbohydrates),
    fat: round1(food.nutrition.fat),
  };
}

/** Build a fresh selection for a food and a gram amount. */
export function makeSelection(food: FoodItem, grams: number): FoodSelection {
  const amount = Math.max(1, Math.round(grams));
  const nutrition = nutritionForGrams(food, amount);
  return {
    foodId: food.id,
    foodName: food.name,
    calories: nutrition.calories,
    protein: nutrition.protein,
    carbs: nutrition.carbs,
    fat: nutrition.fat,
    servingSize: `${amount} g`,
    quantity: 1,
    grams: amount,
  };
}

/**
 * Grams shown for a selection. New entries carry `grams`; legacy entries derive
 * it from the stored serving label × quantity, which matches how their calories
 * were originally calculated.
 */
export function selectionGrams(selection: FoodSelection): number {
  if (typeof selection.grams === 'number' && selection.grams > 0) {
    return Math.round(selection.grams);
  }
  const food = getSelectionFood(selection);
  const storedLabel = selection.servingSize;
  const dbLabel = food?.servingSizes?.[0]?.label;
  // AI-saved entries keep the database label (which may combine several units,
  // e.g. "1 scoop (31g) + 250ml water"); manual entries store "100 g". Prefer
  // the DB's serving weight when the labels match, otherwise parse the text.
  const perServing =
    (food && dbLabel && storedLabel === dbLabel
      ? standardGrams(food)
      : parseGrams(storedLabel)) ?? standardGrams(food);
  const quantity = selection.quantity > 0 ? selection.quantity : 1;
  return Math.max(1, Math.round(perServing * quantity));
}

/** Rewrite a selection to a new gram amount, rescaling its calories and macros. */
export function withGrams(selection: FoodSelection, grams: number): FoodSelection {
  const amount = Math.max(1, Math.round(grams));
  const food = getSelectionFood(selection);

  if (food) {
    const nutrition = nutritionForGrams(food, amount);
    return {
      ...selection,
      calories: nutrition.calories,
      protein: nutrition.protein,
      carbs: nutrition.carbs,
      fat: nutrition.fat,
      servingSize: `${amount} g`,
      quantity: 1,
      grams: amount,
    };
  }

  // Unmatched food (e.g. "salt to taste"): keep the same calorie density and
  // scale by how much the portion changed.
  const previous = selectionGrams(selection);
  const ratio = previous > 0 ? amount / previous : 1;
  const round1 = (value: number) => Math.round((value || 0) * ratio * 10) / 10;
  return {
    ...selection,
    calories: Math.round((selection.calories || 0) * ratio),
    protein: round1(selection.protein),
    carbs: round1(selection.carbs),
    fat: round1(selection.fat),
    servingSize: `${amount} g`,
    quantity: 1,
    grams: amount,
  };
}

/** Backfill `grams` on saved plans and normalise their macros to the portion. */
export function migrateFoodPreferences(prefs: WeeklyFoodPreference): WeeklyFoodPreference {
  if (!prefs || typeof prefs !== 'object') return prefs;
  const next: WeeklyFoodPreference = { ...prefs };

  for (const dayKey of DAY_KEYS) {
    const day = prefs[dayKey];
    if (!day || Array.isArray(day)) continue;
    // Older entries stored per-100 g values (or totals) in `calories` and kept
    // the serving count in `quantity`. Rebuilding every matched entry from its
    // grams makes all saved plans use one consistent unit (and is a no-op for
    // entries that were already normalised). Unmatched items keep their label.
    const backfill = (items?: FoodSelection[]) =>
      (items || []).map((item) => {
        const hasGrams = typeof item.grams === 'number' && item.grams > 0;
        if (!item.foodId && !hasGrams) return item;
        return withGrams(item, selectionGrams(item));
      });
    next[dayKey] = {
      ...day,
      breakfast: backfill(day.breakfast),
      lunch: backfill(day.lunch),
      dinner: backfill(day.dinner),
    };
  }

  return next;
}
