'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useToast } from '@/components/ui/ToastNotification';
import { Badge } from './types';

import {
  Profile,
  Calculations,
  MealEntry,
  ExerciseEntry,
  Habit,
  WorkoutPlan,
  BodyMetric,
  WeeklyFoodPreference,
  WaterLog,
  SleepLog,
} from './types';
import { calculateAll } from './calculations';
import { allFoods } from './food-database';
import { BADGE_CATALOG, STREAK_BADGE_ID, STREAK_TIERS, streakTierIndex } from './badges';
import { keyOfTimestamp, localDateKey, streakEndingToday } from './date';

// Single-device store. Replaces the old per-account `gymathome_store_<id>` keys
// left behind by the removed sign-in flow.
export const GYMATHOME_STORE_KEY = 'gymathome_store';

export function migrateLegacyStore(): void {
  try {
    if (localStorage.getItem(GYMATHOME_STORE_KEY)) return;

    const candidates: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('gymathome_store_')) candidates.push(k);
    }
    if (candidates.length === 0) return;

    // Prefer the store belonging to the last active session, else the largest one.
    let chosen: string | null = null;
    try {
      const session = JSON.parse(localStorage.getItem('gymathome_auth') || 'null');
      const id = session?.user?.id;
      if (id && candidates.includes(`gymathome_store_${id}`)) {
        chosen = `gymathome_store_${id}`;
      }
    } catch {
      // fall through to largest-store heuristic
    }
    if (!chosen) {
      chosen = candidates.reduce((a, b) =>
        (localStorage.getItem(a) || '').length >= (localStorage.getItem(b) || '').length ? a : b
      );
    }
    const data = localStorage.getItem(chosen);
    if (data) localStorage.setItem(GYMATHOME_STORE_KEY, data);
  } catch {
    // migration is best-effort; a fresh store is created on save
  }
}

export function readStoredProfile(): Profile | null {
  try {
    migrateLegacyStore();
    const raw = localStorage.getItem(GYMATHOME_STORE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.profile ?? null;
  } catch {
    return null;
  }
}

interface StoreContextType {
  profile: Profile;
  updateProfile: (profile: Partial<Profile>) => void;
  calculations: Calculations | null;
  recalculate: () => void;

  meals: MealEntry[];
  addMeal: (meal: MealEntry) => void;
  removeMeal: (id: string) => void;
  getMealsForDate: (date: string) => MealEntry[];

  exercises: ExerciseEntry[];
  addExercise: (entry: ExerciseEntry) => void;
  removeExercise: (id: string) => void;
  getExercisesForDate: (date: string) => ExerciseEntry[];

  habits: Habit[];
  addHabit: (habit: Habit) => void;
  removeHabit: (id: string) => void;
  toggleHabitDate: (habitId: string, date: string) => void;

  workoutPlan: WorkoutPlan | null;
  setWorkoutPlan: (plan: WorkoutPlan) => void;

  bodyMetrics: BodyMetric[];
  addBodyMetric: (metric: BodyMetric) => void;

  foodPreferences: WeeklyFoodPreference;
  setFoodPreferences: (prefs: WeeklyFoodPreference) => void;

  waterLogs: WaterLog[];
  addWater: (amount: number) => void;
  getWaterForDate: (date: string) => number;

  sleepLogs: SleepLog[];
  addSleep: (hours: number) => void;
  getSleepForDate: (date: string) => number;

  badges: Badge[];
  checkBadges: () => void;

  theme: 'light' | 'dark';
  toggleTheme: () => void;

  isProfileSet: boolean;
  setIsProfileSet: (val: boolean) => void;
  hydrated: boolean;
}

const defaultProfile: Profile = {
  name: null,
  photo: null,
  gender: null,
  age: null,
  height: null,
  weight: null,
  activityLevel: null,
  goal: null,
  healthProblems: [],
};

const defaultFoodPreferences = (): WeeklyFoodPreference => ({
  monday: { breakfast: [], lunch: [], dinner: [] },
  tuesday: { breakfast: [], lunch: [], dinner: [] },
  wednesday: { breakfast: [], lunch: [], dinner: [] },
  thursday: { breakfast: [], lunch: [], dinner: [] },
  friday: { breakfast: [], lunch: [], dinner: [] },
  saturday: { breakfast: [], lunch: [], dinner: [] },
  sunday: { breakfast: [], lunch: [], dinner: [] },
  allergies: [],
});

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile>(defaultProfile);
  const [calculations, setCalculations] = useState<Calculations | null>(null);
  const [meals, setMeals] = useState<MealEntry[]>([]);
  const [exercises, setExercises] = useState<ExerciseEntry[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [workoutPlan, setWorkoutPlan] = useState<WorkoutPlan | null>(null);
  const [bodyMetrics, setBodyMetrics] = useState<BodyMetric[]>([]);
  const [foodPreferences, setFoodPreferences] = useState<WeeklyFoodPreference>(defaultFoodPreferences());
  const [waterLogs, setWaterLogs] = useState<WaterLog[]>([]);
  const [sleepLogs, setSleepLogs] = useState<SleepLog[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [isProfileSet, setIsProfileSet] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const { showToast } = useToast();

  // Load data from the single local store on mount
  useEffect(() => {
    migrateLegacyStore();
    const saved = localStorage.getItem(GYMATHOME_STORE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.profile) setProfile(parsed.profile);
        if (parsed.meals) setMeals(parsed.meals);
        if (parsed.exercises) setExercises(parsed.exercises);
        if (parsed.habits) setHabits(parsed.habits);
        if (parsed.workoutPlan) setWorkoutPlan(parsed.workoutPlan);
        if (parsed.bodyMetrics) setBodyMetrics(parsed.bodyMetrics);
        if (parsed.foodPreferences) setFoodPreferences(parsed.foodPreferences);
        if (parsed.waterLogs) setWaterLogs(parsed.waterLogs);
        if (parsed.sleepLogs) setSleepLogs(parsed.sleepLogs);
        if (parsed.badges) {
          const seenIds = new Set<string>();
          // `streak_7` was the old one-off badge; it becomes level 1 of the
          // single leveled streak badge.
          setBadges(
            parsed.badges
              .map((b: Badge) =>
                b.id === 'streak_7' ? { ...b, id: STREAK_BADGE_ID, level: 1 } : b
              )
              .filter((b: Badge) => {
                if (seenIds.has(b.id)) return false;
                seenIds.add(b.id);
                return true;
              })
          );
        }
        if (parsed.theme) setTheme(parsed.theme);
        if (parsed.isProfileSet) setIsProfileSet(parsed.isProfileSet);
      } catch {
        localStorage.removeItem(GYMATHOME_STORE_KEY);
      }
    }
    setLoaded(true);
  }, []);

  // Save data to localStorage
  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(
      GYMATHOME_STORE_KEY,
      JSON.stringify({
        profile,
        meals,
        exercises,
        habits,
        workoutPlan,
        bodyMetrics,
        foodPreferences,
        waterLogs,
        sleepLogs,
        badges,
        theme,
        isProfileSet,
      })
    );
  }, [loaded, profile, meals, exercises, habits, workoutPlan, bodyMetrics, foodPreferences, waterLogs, sleepLogs, badges, theme, isProfileSet]);

  const recalculate = () => {
    const calc = calculateAll(profile);
    setCalculations(calc);
  };

  useEffect(() => {
    if (isProfileSet && profile.age && profile.height && profile.weight && profile.gender && profile.activityLevel && profile.goal) {
      const calc = calculateAll(profile);
      setCalculations(calc);
    } else {
      setCalculations(null);
    }
  }, [profile, isProfileSet]);

  const updateProfile = (updates: Partial<Profile>) => {
    setProfile(prev => ({ ...prev, ...updates }));
  };

  const addMeal = (meal: MealEntry) => {
    setMeals(prev => [...prev, meal]);
    // Check for badges after adding a meal
    checkBadges();
  };

  const removeMeal = (id: string) => {
    setMeals(prev => prev.filter(m => m.id !== id));
    // Check for badges after removing a meal
    checkBadges();
  };

  const getMealsForDate = (date: string) => {
    // Timestamps are UTC ISO strings; group by the user's local day.
    return meals.filter((m) => keyOfTimestamp(m.loggedAt) === date);
  };

  const addExercise = (entry: ExerciseEntry) => {
    setExercises(prev => [...prev, entry]);
    // Check for badges after adding exercise
    checkBadges();
  };

  const removeExercise = (id: string) => {
    setExercises(prev => prev.filter(e => e.id !== id));
    // Check for badges after removing exercise
    checkBadges();
  };

  const getExercisesForDate = (date: string) => {
    return exercises.filter((e) => keyOfTimestamp(e.loggedAt) === date);
  };

  const addHabit = (habit: Habit) => {
    setHabits(prev => [...prev, habit]);
  };

  const removeHabit = (id: string) => {
    setHabits(prev => prev.filter(h => h.id !== id));
  };

  const toggleHabitDate = (habitId: string, date: string) => {
    setHabits(prev =>
      prev.map(h => {
        if (h.id !== habitId) return h;
        const completed = h.completedDates.includes(date);
        return {
          ...h,
          completedDates: completed
            ? h.completedDates.filter(d => d !== date)
            : [...h.completedDates, date],
        };
      })
    );
  };

  const addBodyMetric = (metric: BodyMetric) => {
    setBodyMetrics(prev => [...prev.filter(m => m.date !== metric.date), metric]);
  };

  const addWater = (amount: number) => {
    const today = localDateKey();
    setWaterLogs(prev => [...prev, { date: today, amount, loggedAt: new Date().toISOString() }]);
    // Check for water badge
    checkBadges();
  };

  const getWaterForDate = (date: string) => {
    return waterLogs.filter(w => w.date === date).reduce((sum, w) => sum + w.amount, 0);
  };

  const addSleep = (hours: number) => {
    const today = localDateKey();
    setSleepLogs(prev => [...prev, { date: today, hours, loggedAt: new Date().toISOString() }]);
  };

  const getSleepForDate = (date: string) => {
    return sleepLogs.filter(s => s.date === date).reduce((sum, s) => sum + s.hours, 0);
  };

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  // Apply theme to document
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const checkBadges = () => {
    const today = localDateKey();
    const newBadges: Badge[] = [];

    const hasBadge = (id: string) => badges.some(b => b.id === id);

    const pushBadge = (id: string) => {
      const def = BADGE_CATALOG.find(b => b.id === id);
      if (def) {
        newBadges.push({ ...def, unlockedAt: today });
        // Show toast notification for badge unlock
        showToast(`🏆 New Badge Unlocked: ${def.name}`, 'success', 5000);
      }
    };

    // Consistency badge: one badge that levels up with the streak, never a new
    // badge for every milestone.
    const streak = streakEndingToday(
      (key) => getMealsForDate(key).length > 0 || getExercisesForDate(key).length > 0
    );
    const tier = streakTierIndex(streak);
    if (tier >= 0) {
      const existing = badges.find((b) => b.id === STREAK_BADGE_ID);
      const currentLevel = existing?.level ?? -1;
      if (tier > currentLevel) {
        const def = STREAK_TIERS[tier];
        const upgraded: Badge = {
          id: STREAK_BADGE_ID,
          name: def.name,
          description: def.description,
          icon: def.icon,
          unlockedAt: today,
          condition: 'streak',
          level: tier,
        };
        setBadges((prev) => {
          const has = prev.some((b) => b.id === STREAK_BADGE_ID);
          return has
            ? prev.map((b) => (b.id === STREAK_BADGE_ID ? upgraded : b))
            : [...prev, upgraded];
        });
        showToast(
          existing
            ? `🔥 Streak badge upgraded: ${def.name}`
            : `🏆 New Badge Unlocked: ${def.name}`,
          'success',
          5000
        );
      }
    }

    // 100 meals logged
    if (!hasBadge('meals_100') && meals.length >= 100) {
      pushBadge('meals_100');
    }

    // 10 workouts
    if (!hasBadge('workouts_10') && exercises.length >= 10) {
      pushBadge('workouts_10');
    }

    // 50 workouts
    if (!hasBadge('workouts_50') && exercises.length >= 50) {
      pushBadge('workouts_50');
    }

    // 7-day water tracking
    if (!hasBadge('water_7')) {
      let waterDays = 0;
      const d = new Date();
      for (let i = 0; i < 7; i++) {
        if (getWaterForDate(localDateKey(d)) > 0) waterDays++;
        d.setDate(d.getDate() - 1);
      }
      if (waterDays >= 7) {
        pushBadge('water_7');
      }
    }

    // Hit protein target 5 days
    if (!hasBadge('protein_5') && calculations) {
      let proteinDays = 0;
      const d = new Date();
      for (let i = 0; i < 30; i++) {
        const dayMeals = getMealsForDate(localDateKey(d));
        let totalProtein = 0;
        dayMeals.forEach(m => {
          const food = allFoods.find((f: any) => f.id === m.foodId);
          if (food) totalProtein += food.nutrition.protein * m.quantity;
        });
        if (totalProtein >= calculations.protein * 0.9) proteinDays++;
        d.setDate(d.getDate() - 1);
      }
      if (proteinDays >= 5) {
        pushBadge('protein_5');
      }
    }

    // First meal logged
    if (!hasBadge('first_meal') && meals.length >= 1) {
      pushBadge('first_meal');
    }

    // First workout
    if (!hasBadge('first_workout') && exercises.length >= 1) {
      pushBadge('first_workout');
    }

    if (newBadges.length > 0) {
      setBadges(prev => {
        const existingIds = new Set(prev.map(b => b.id));
        const uniqueNew = newBadges.filter(b => !existingIds.has(b.id));
        return uniqueNew.length > 0 ? [...prev, ...uniqueNew] : prev;
      });
    }
  };

  // Re-evaluate badges once the persisted store is hydrated — the mount-time
  // call runs before localStorage is read, so streaks would look empty. Also
  // runs whenever new activity lands.
  useEffect(() => {
    if (!loaded) return;
    checkBadges();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, meals.length, exercises.length, waterLogs.length]);

  return (
    <StoreContext.Provider
      value={{
        profile,
        updateProfile,
        calculations,
        recalculate,
        meals,
        addMeal,
        removeMeal,
        getMealsForDate,
        exercises,
        addExercise,
        removeExercise,
        getExercisesForDate,
        habits,
        addHabit,
        removeHabit,
        toggleHabitDate,
        workoutPlan,
        setWorkoutPlan,
        bodyMetrics,
        addBodyMetric,
        foodPreferences,
        setFoodPreferences,
        waterLogs,
        addWater,
        getWaterForDate,
        sleepLogs,
        addSleep,
        getSleepForDate,
        badges,
        checkBadges,
        theme,
        toggleTheme,
        isProfileSet,
        setIsProfileSet,
        hydrated: loaded,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
}