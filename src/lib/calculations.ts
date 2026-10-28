import { Profile, Calculations, MealEntry, ExerciseEntry } from './types';
import { allFoods } from './food-database';
import { findFood } from './food-portion';

export function calculateBMI(weight: number, heightCm: number): { value: number; category: string } {
  const heightM = heightCm / 100;
  const bmi = weight / (heightM * heightM);
  let category = '';
  if (bmi < 18.5) category = 'Underweight';
  else if (bmi < 25) category = 'Normal';
  else if (bmi < 30) category = 'Overweight';
  else category = 'Obese';
  return { value: parseFloat(bmi.toFixed(1)), category };
}

export function calculateBMR(profile: Profile): number {
  const { gender, age, height, weight } = profile;
  if (!age || !height || !weight) return 0;
  if (gender === 'male') {
    return Math.round(10 * weight + 6.25 * height - 5 * age + 5);
  } else {
    return Math.round(10 * weight + 6.25 * height - 5 * age - 161);
  }
}

export function calculateTDEE(bmr: number, activityLevel: string): number {
  const multipliers: Record<string, number> = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    very_active: 1.725,
    extra_active: 1.9,
  };
  return Math.round(bmr * (multipliers[activityLevel] || 1.55));
}

export function calculateTargetCalories(tdee: number, goal: string): number {
  switch (goal) {
    case 'lose':
      return tdee - 500;
    case 'gain':
      return tdee + 300;
    default:
      return tdee;
  }
}

export function calculateMacros(targetCalories: number, weight: number, goal: string): { protein: number; carbs: number; fat: number } {
  let proteinPerKg = 1.8;
  if (goal === 'lose') proteinPerKg = 2.2;
  if (goal === 'gain') proteinPerKg = 2.0;

  const protein = Math.round(weight * proteinPerKg);
  const proteinCalories = protein * 4;

  const fatGrams = Math.round(weight * 0.9);
  const fatCalories = fatGrams * 9;

  const remainingCalories = targetCalories - proteinCalories - fatCalories;
  const carbs = Math.max(0, Math.round(remainingCalories / 4));

  return { protein, carbs, fat: fatGrams };
}

export function calculateHydration(weight: number): number {
  return parseFloat(((weight * 33) / 1000).toFixed(1));
}

export function calculateAll(profile: Profile): Calculations {
  if (!profile.weight || !profile.height || !profile.age || !profile.gender || !profile.activityLevel || !profile.goal) {
    return {
      bmi: 0, bmiCategory: '', bmr: 0, tdee: 0, targetCalories: 0,
      protein: 0, carbs: 0, fat: 0, hydration: 0,
    };
  }
  const bmi = calculateBMI(profile.weight, profile.height);
  const bmr = calculateBMR(profile);
  const tdee = calculateTDEE(bmr, profile.activityLevel);
  const targetCalories = calculateTargetCalories(tdee, profile.goal);
  const macros = calculateMacros(targetCalories, profile.weight, profile.goal);
  const hydration = calculateHydration(profile.weight);

  return {
    bmi: bmi.value,
    bmiCategory: bmi.category,
    bmr,
    tdee,
    targetCalories,
    protein: macros.protein,
    carbs: macros.carbs,
    fat: macros.fat,
    hydration,
  };
}

// ─── Shared nutrition / burn helpers (single source of truth) ────────────────

export interface MealNutrition {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

const foodById = new Map(allFoods.map((f) => [f.id, f]));

export function getFoodById(id: string) {
  return foodById.get(id);
}

/** Sum nutrition for meals via foodId lookup (MealEntry has no inline macros). */
export function sumMealNutrition(meals: MealEntry[]): MealNutrition {
  let calories = 0, protein = 0, carbs = 0, fat = 0;
  for (const m of meals) {
    const food = findFood(m.foodId, m.foodName);
    if (!food) continue;
    const q = m.quantity || 1;
    calories += food.nutrition.calories * q;
    protein += food.nutrition.protein * q;
    carbs += food.nutrition.carbohydrates * q;
    fat += food.nutrition.fat * q;
  }
  return {
    calories: Math.round(calories),
    protein: Math.round(protein),
    carbs: Math.round(carbs),
    fat: Math.round(fat),
  };
}

/** Unified calories-burned estimate for a logged exercise entry. */
export function estimateExerciseCalories(entry: ExerciseEntry): number {
  if (entry.duration && entry.duration > 0) {
    return Math.round(entry.duration * 7);
  }
  const weight = entry.weight || 0;
  return Math.round(entry.sets * entry.reps * (0.1 + weight * 0.02));
}
