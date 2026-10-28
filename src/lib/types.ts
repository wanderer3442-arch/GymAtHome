// ─── Profile ─────────────────────────────────────────────────────────────────

export type Gender = 'male' | 'female' | 'other';

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'very_active' | 'extra_active';

export type Goal = 'lose' | 'maintain' | 'gain';

export interface Profile {
  name: string | null;
  /** Profile photo as a small JPEG data URL (downscaled before storing). */
  photo?: string | null;
  gender: Gender | null;
  age: number | null;
  height: number | null; // cm
  weight: number | null; // kg
  activityLevel: ActivityLevel | null;
  goal: Goal | null;
  healthProblems: string[];
}

export interface Calculations {
  bmi: number;
  bmiCategory: string;
  bmr: number;
  tdee: number;
  targetCalories: number;
  protein: number;
  carbs: number;
  fat: number;
  hydration: number; // liters per day
}

// ─── Food ────────────────────────────────────────────────────────────────────

export type Allergen =
  | 'gluten'
  | 'dairy'
  | 'eggs'
  | 'peanuts'
  | 'tree_nuts'
  | 'soy'
  | 'shellfish'
  | 'fish'
  | 'sesame'
  | 'nightshades'
  | 'nuts';

export type FoodCategory =
  | 'fruits'
  | 'vegetables'
  | 'proteins'
  | 'poultry'
  | 'red_meat'
  | 'seafood'
  | 'dairy'
  | 'grains'
  | 'legumes'
  | 'nuts_seeds'
  | 'oils_fats'
  | 'oils'
  | 'condiments'
  | 'snacks'
  | 'beverages'
  | 'sweets'
  | 'prepared'
  | 'indian'
  | 'chinese'
  | 'japanese'
  | 'korean'
  | 'thai'
  | 'mexican'
  | 'mediterranean'
  | 'american'
  | 'other';

export type Cuisine =
  | 'indian'
  | 'chinese'
  | 'japanese'
  | 'korean'
  | 'thai'
  | 'mexican'
  | 'mediterranean'
  | 'american'
  | 'general'
  | 'italian'
  | 'asian';

export type DietaryTag =
  | 'vegan'
  | 'vegetarian'
  | 'gluten_free'
  | 'dairy_free'
  | 'keto'
  | 'low_carb'
  | 'high_protein'
  | 'halal'
  | 'spicy';

export interface NutritionFacts {
  calories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
}

export interface ServingSize {
  label: string;
  amount: number;
  unit: 'g' | 'ml' | 'cup' | 'tbsp' | 'tsp' | 'piece' | 'slice' | 'bowl';
}

export interface FoodItem {
  id: string;
  name: string;
  category: FoodCategory;
  cuisines: Cuisine[];
  nutrition: NutritionFacts;
  servingSizes: ServingSize[];
  allergens: Allergen[];
  tags: DietaryTag[];
}

// ─── Meal ────────────────────────────────────────────────────────────────────

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface MealEntry {
  id: string;
  foodId: string;
  foodName: string;
  servingSize: ServingSize;
  quantity: number;
  mealType: MealType;
  loggedAt: string;
  isCustom?: boolean;
}

export interface DailyMealPlan {
  date: string;
  meals: MealEntry[];
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
}

export interface FoodSelection {
  foodId: string;
  foodName: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  servingSize: string;
  quantity: number;
  /** Total grams for this selection (source of truth for portion editing). */
  grams?: number;
}

export interface DayFoodIntake {
  breakfast: FoodSelection[];
  lunch: FoodSelection[];
  dinner: FoodSelection[];
  mealPhoto?: string;
}

export interface WeeklyFoodPreference {
  monday: DayFoodIntake;
  tuesday: DayFoodIntake;
  wednesday: DayFoodIntake;
  thursday: DayFoodIntake;
  friday: DayFoodIntake;
  saturday: DayFoodIntake;
  sunday: DayFoodIntake;
  allergies: Allergen[];
}

// ─── Exercise ────────────────────────────────────────────────────────────────

export type ExerciseCategory = 'strength' | 'cardio' | 'flexibility' | 'hiit';

export type MuscleGroup = 'chest' | 'back' | 'shoulders' | 'biceps' | 'triceps' | 'legs' | 'core' | 'full_body';

export type Equipment = 'gym' | 'home' | 'none';

export interface Exercise {
  id: string;
  name: string;
  category: ExerciseCategory;
  muscleGroup: MuscleGroup;
  equipment: Equipment;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  caloriesPerMinute: number;
  instructions: string;
}

export interface ExerciseEntry {
  id: string;
  exerciseId: string;
  exerciseName: string;
  sets: number;
  reps: number;
  weight?: number;
  duration?: number; // minutes
  loggedAt: string;
}

export interface WorkoutPlan {
  id: string;
  name: string;
  goal: Goal;
  equipment: Equipment;
  daysPerWeek: number;
  exercises: WorkoutExercise[];
  isGenerated: boolean;
  split?: string[][];
}

export interface WorkoutExercise {
  exerciseId: string;
  exerciseName: string;
  sets: number;
  reps: number;
  weight?: number;
  duration?: number;
  day: string;
}

// ─── Habit ───────────────────────────────────────────────────────────────────

export interface Habit {
  id: string;
  name: string;
  frequency: 'daily' | 'weekly';
  completedDates: string[];
}

// ─── Health ──────────────────────────────────────────────────────────────────

export interface HealthCondition {
  id: string;
  name: string;
  description: string;
  foodsToEat: string[];
  foodsToAvoid: string[];
  exercises: string[];
  lifestyle: string[];
  source: string;
}

// ─── Body Metrics ────────────────────────────────────────────────────────────

export interface BodyMetric {
  date: string;
  weight: number;
  height: number;
}

// ─── Water Tracking ─────────────────────────────────────────────────────────

export interface WaterLog {
  date: string;
  amount: number; // ml
  loggedAt: string;
}

// ─── Sleep Tracking ────────────────────────────────────────────────────────

export interface SleepLog {
  date: string;
  hours: number;
  loggedAt: string;
}

// ─── Badges ─────────────────────────────────────────────────────────────────

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string; // emoji
  unlockedAt: string | null;
  condition: string; // internal key
  /** Leveled badges (streak) upgrade in place — index into STREAK_TIERS. */
  level?: number;
}
