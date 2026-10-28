/**
 * Gym at Home report model
 * ─────────────────────
 * Turns the raw store into the numbers the poster prints: targets, the last
 * seven calorie bars, the training split, weight history, and the current
 * month's habit calendar. Kept separate from the canvas drawing so the CSV
 * export and the PDF always agree.
 */

import { allFoods } from './food-database';
import { dateFromKey, localDateKey } from './date';
import type {
  BodyMetric,
  Calculations,
  ExerciseEntry,
  Habit,
  MealEntry,
  Profile,
  SleepLog,
  WorkoutPlan,
} from './types';

export interface ReportSections {
  exercise: boolean;
  nutrition: boolean;
  health: boolean;
  body: boolean;
  habits: boolean;
}

export interface ReportInput {
  profile: Profile | null;
  calculations: Calculations | null;
  meals: MealEntry[];
  exerciseLogs: ExerciseEntry[];
  bodyMetrics: BodyMetric[];
  sleepLogs: SleepLog[];
  habits: Habit[];
  workoutPlan: WorkoutPlan | null;
  sections: ReportSections;
  includeMacros: boolean;
  includeNotes: boolean;
  periodLabel: string;
  periodDays: number;
  reportId: string;
  dateLabel: string;
}

export interface ReportPlanExercise {
  name: string;
  sets: number;
  reps: number;
  weight?: number;
  duration?: number;
}

export interface ReportPlanDay {
  day: string;
  focus: string;
  exercises: ReportPlanExercise[];
  sets: number;
}

export interface ReportMetric {
  date: string;
  weight: number;
  height: number;
  bmi: string;
}

export interface ReportHabit {
  name: string;
  streak: number;
  done: number;
  monthDone: number;
  monthDays: number;
  pct: number;
}

export interface ReportMealRow {
  date: string;
  name: string;
  type: string;
  kcal: number;
}

export interface ReportModel {
  name: string;
  reportId: string;
  dateLabel: string;
  periodLabel: string;
  periodDays: number;
  goalLabel: string;
  goalShort: string;
  sex: string;
  age: string;
  height: string;
  weight: string;
  bmi: string;
  bmiLabel: string;
  targets: { calories: number; protein: number; carbs: number; fat: number; hydration: number };
  macros: { protein: number; carbs: number; fat: number };
  week: { day: string; date: string; kcal: number }[];
  weekMax: number;
  avgKcal: number;
  avgPerMeal: number;
  mealsLogged: number;
  workoutsLogged: number;
  avgSleep: number;
  bestStreak: number;
  topFoods: { name: string; count: number; kcal: number }[];
  planDays: ReportPlanDay[];
  metrics: ReportMetric[];
  habits: ReportHabit[];
  /** Current-month calendar heatmap (day numbers, Monday-first weeks). */
  heat: ReportHeat;
  mealRows: ReportMealRow[];
  sections: ReportSections;
  includeMacros: boolean;
  includeNotes: boolean;
}

const foodIndex = new Map(allFoods.map((f) => [f.id, f]));

const DAY_FOCUS: Record<string, string> = {
  Monday: 'Push',
  Tuesday: 'Pull',
  Wednesday: 'Legs',
  Thursday: 'Upper',
  Friday: 'Lower',
  Saturday: 'Full Body',
  Sunday: 'Rest',
};

const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export interface ReportHeatCell {
  date: string;
  day: number;
  /** 0..1 (share of habits completed). */
  value: number;
  future: boolean;
}

export interface ReportHeat {
  year: number;
  month: number;
  label: string;
  /** Monday-first weeks; `null` pads days outside the current month. */
  weeks: (ReportHeatCell | null)[][];
  /** Elapsed days in the month. */
  days: number;
  activeDays: number;
}

const dateKey = (d: Date) => localDateKey(d);

const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

export function mealKcal(m: MealEntry): number {
  const food = foodIndex.get(m.foodId);
  return Math.round((food ? food.nutrition.calories : 0) * (m.quantity || 1));
}

/**
 * Consecutive completed days ending today. Today may still be unchecked —
 * the streak then counts back from yesterday instead of reporting 0.
 */
export function habitStreak(dates: string[]): number {
  if (dates.length === 0) return 0;
  const set = new Set(dates);
  const d = new Date();
  let key = dateKey(d);
  if (!set.has(key)) {
    d.setDate(d.getDate() - 1);
    key = dateKey(d);
  }
  let count = 0;
  while (set.has(key)) {
    count++;
    d.setDate(d.getDate() - 1);
    key = dateKey(d);
  }
  return count;
}

function buildHeat(habits: Habit[]): ReportHeat {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1, 12);
  const start = addDays(first, -((first.getDay() + 6) % 7));
  const sets = habits.map((h) => new Set(h.completedDates));
  const todayKey = dateKey(now);
  const weeks: (ReportHeatCell | null)[][] = [];
  let days = 0;
  let activeDays = 0;

  for (let w = 0; w < 6; w++) {
    const week: (ReportHeatCell | null)[] = [];
    for (let d = 0; d < 7; d++) {
      const dt = addDays(start, w * 7 + d);
      if (dt.getMonth() !== now.getMonth() || dt.getFullYear() !== now.getFullYear()) {
        week.push(null);
        continue;
      }
      const key = dateKey(dt);
      const future = key > todayKey;
      if (!future) days++;
      const value =
        future || habits.length === 0
          ? 0
          : sets.reduce((n, s) => n + (s.has(key) ? 1 : 0), 0) / habits.length;
      if (value > 0) activeDays++;
      week.push({ date: key, day: dt.getDate(), value, future });
    }
    weeks.push(week);
  }
  while (weeks.length > 0 && weeks[weeks.length - 1].every((cell) => cell === null)) {
    weeks.pop();
  }

  return {
    year: now.getFullYear(),
    month: now.getMonth(),
    label: now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    weeks,
    days,
    activeDays,
  };
}

export function buildReportModel(input: ReportInput): ReportModel {
  const {
    profile,
    calculations,
    meals,
    exerciseLogs,
    bodyMetrics,
    sleepLogs,
    habits,
    workoutPlan,
    periodDays,
    periodLabel,
  } = input;

  const periodStart = dateKey(addDays(new Date(), -periodDays));
  const inPeriod = (value?: string) => !value || value.slice(0, 10) >= periodStart;

  const periodMeals = meals.filter((m) => inPeriod((m as unknown as { loggedAt?: string }).loggedAt));
  const periodExercises = exerciseLogs.filter((e) => inPeriod((e as unknown as { loggedAt?: string }).loggedAt));
  const periodMetrics = bodyMetrics
    .filter((b) => inPeriod(b.date))
    .slice()
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  const periodSleep = sleepLogs.filter((s) => inPeriod(s.date));

  const totalKcal = periodMeals.reduce((sum, m) => sum + mealKcal(m), 0);
  const mealDays = new Set(periodMeals.map((m) => ((m as unknown as { loggedAt?: string }).loggedAt || '').slice(0, 10)));

  const avgKcal = mealDays.size ? Math.round(totalKcal / mealDays.size) : 0;
  const avgPerMeal = periodMeals.length ? Math.round(totalKcal / periodMeals.length) : 0;
  const avgSleep = periodSleep.length
    ? periodSleep.reduce((sum, s) => sum + (s.hours || 0), 0) / periodSleep.length
    : 0;

  // Last seven days of energy intake (independent of the selected period).
  const week: ReportModel['week'] = [];
  for (let i = 6; i >= 0; i--) {
    const d = addDays(new Date(), -i);
    const key = dateKey(d);
    const kcal = meals
      .filter((m) => ((m as unknown as { loggedAt?: string }).loggedAt || '').slice(0, 10) === key)
      .reduce((sum, m) => sum + mealKcal(m), 0);
    week.push({ day: DAY_SHORT[d.getDay()], date: key, kcal: Math.round(kcal) });
  }

  // Most-logged foods in the period.
  const foodTotals = new Map<string, { name: string; count: number; kcal: number }>();
  periodMeals.forEach((m) => {
    const name = m.foodName || 'Meal';
    const row = foodTotals.get(name) || { name, count: 0, kcal: 0 };
    row.count += 1;
    row.kcal += mealKcal(m);
    foodTotals.set(name, row);
  });
  const topFoods = [...foodTotals.values()]
    .sort((a, b) => b.count - a.count || b.kcal - a.kcal)
    .slice(0, 10);

  // Training split.
  const grouped = new Map<string, ReportPlanExercise[]>();
  (workoutPlan?.exercises || []).forEach((ex) => {
    const key = ex.day || 'Day';
    const list = grouped.get(key) || [];
    list.push({
      name: ex.exerciseName,
      sets: ex.sets || 3,
      reps: ex.reps || 10,
      weight: ex.weight,
      duration: ex.duration,
    });
    grouped.set(key, list);
  });
  const planDays: ReportPlanDay[] = [...grouped.entries()]
    .sort((a, b) => {
      const ia = DAY_ORDER.indexOf(a[0]);
      const ib = DAY_ORDER.indexOf(b[0]);
      return (ia < 0 ? 9 : ia) - (ib < 0 ? 9 : ib);
    })
    .map(([day, exercises]) => ({
      day,
      focus: DAY_FOCUS[day] || 'Training',
      exercises,
      sets: exercises.reduce((n, e) => n + (e.sets || 0), 0),
    }));

  const metrics: ReportMetric[] = periodMetrics.slice(-8).map((b) => ({
    date: b.date,
    weight: b.weight,
    height: b.height,
    bmi:
      b.weight && profile?.height
        ? (b.weight / (profile.height / 100) ** 2).toFixed(1)
        : '--',
  }));

  // Habits.
  const today = new Date();
  const monthDays = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const habitRows: ReportHabit[] = habits.map((h) => {
    const monthDone = h.completedDates.filter((d) => {
      const dt = dateFromKey(d);
      return dt.getMonth() === today.getMonth() && dt.getFullYear() === today.getFullYear();
    }).length;
    return {
      name: h.name,
      streak: habitStreak(h.completedDates),
      done: h.completedDates.length,
      monthDone,
      monthDays,
      pct: Math.min(100, Math.round((monthDone / monthDays) * 100)),
    };
  });

  const heat = buildHeat(habits);

  const p = (calculations?.protein || 0) * 4;
  const c = (calculations?.carbs || 0) * 4;
  const f = (calculations?.fat || 0) * 9;
  const macroTotal = p + c + f;
  const macros = macroTotal
    ? (() => {
        const protein = Math.round((p / macroTotal) * 100);
        const carbs = Math.round((c / macroTotal) * 100);
        return { protein, carbs, fat: Math.max(0, 100 - protein - carbs) };
      })()
    : { protein: 30, carbs: 40, fat: 30 };

  const bmi = profile?.weight && profile?.height
    ? (profile.weight / (profile.height / 100) ** 2).toFixed(1)
    : calculations?.bmi
      ? calculations.bmi.toFixed(1)
      : '--';
  const bmiValue = parseFloat(bmi);

  const goalShort =
    profile?.goal === 'lose'
      ? 'Fat Loss'
      : profile?.goal === 'gain'
        ? 'Muscle Gain'
        : profile?.goal === 'maintain'
          ? 'Maintain'
          : 'General Fitness';

  const mealRows: ReportMealRow[] = periodMeals
    .slice()
    .reverse()
    .slice(0, 40)
    .map((m) => ({
      date: ((m as unknown as { loggedAt?: string }).loggedAt || '').slice(0, 10),
      name: m.foodName || 'Meal',
      type: m.mealType || '',
      kcal: mealKcal(m),
    }));

  return {
    name: profile?.name || 'Athlete',
    reportId: input.reportId,
    dateLabel: input.dateLabel,
    periodLabel,
    periodDays,
    goalLabel:
      profile?.goal === 'lose'
        ? 'Fat Loss'
        : profile?.goal === 'gain'
          ? 'Muscle Growth'
          : profile?.goal === 'maintain'
            ? 'Maintain Weight'
            : 'General Fitness',
    goalShort,
    sex: profile?.gender ? profile.gender[0].toUpperCase() + profile.gender.slice(1) : '--',
    age: profile?.age ? `${profile.age}` : '--',
    height: profile?.height ? `${profile.height}` : '--',
    weight: profile?.weight ? `${profile.weight}` : '--',
    bmi,
    bmiLabel:
      !bmiValue ? '--' : bmiValue < 18.5 ? 'Underweight' : bmiValue < 25 ? 'Healthy range' : bmiValue < 30 ? 'Overweight' : 'High',
    targets: {
      calories: calculations?.targetCalories || 0,
      protein: calculations?.protein || 0,
      carbs: calculations?.carbs || 0,
      fat: calculations?.fat || 0,
      hydration: calculations?.hydration || 0,
    },
    macros,
    week,
    weekMax: Math.max(...week.map((d) => d.kcal), calculations?.targetCalories || 0, 1),
    avgKcal,
    avgPerMeal,
    mealsLogged: periodMeals.length,
    workoutsLogged: periodExercises.length,
    avgSleep,
    bestStreak: habitRows.reduce((n, h) => Math.max(n, h.streak), 0),
    topFoods,
    planDays,
    metrics,
    habits: habitRows,
    heat,
    mealRows,
    sections: input.sections,
    includeMacros: input.includeMacros,
    includeNotes: input.includeNotes,
  };
}

/** Rows for the CSV export (and the on-screen spreadsheet preview). */
export function buildCsvRows(m: ReportModel): string[][] {
  const rows: string[][] = [];
  const blank = () => rows.push([]);

  rows.push(['Gym at Home — Personal Health Protocol']);
  rows.push(['Client', m.name]);
  rows.push(['Generated', m.dateLabel]);
  rows.push(['Period', m.periodLabel]);
  rows.push(['Report ID', `GAH-${m.reportId}`]);
  blank();
  rows.push(['PROFILE', '']);
  rows.push(['Goal', m.goalLabel]);
  rows.push(['Age', m.age]);
  rows.push(['Height (cm)', m.height]);
  rows.push(['Weight (kg)', m.weight]);
  rows.push(['BMI', m.bmi, m.bmiLabel]);
  blank();

  if (m.sections.nutrition) {
    rows.push(['NUTRITION TARGETS', '']);
    rows.push(['Calories (kcal/day)', String(m.targets.calories)]);
    rows.push(['Protein (g/day)', String(m.targets.protein)]);
    rows.push(['Carbs (g/day)', String(m.targets.carbs)]);
    rows.push(['Fat (g/day)', String(m.targets.fat)]);
    rows.push(['Hydration (L/day)', String(m.targets.hydration)]);
    rows.push(['Macro split', `${m.macros.protein}% protein`, `${m.macros.carbs}% carbs`, `${m.macros.fat}% fat`]);
    blank();
    rows.push(['CALORIES — LAST 7 DAYS', '']);
    m.week.forEach((d) => rows.push([d.day, d.date, `${d.kcal} kcal`]));
    rows.push(['Average', '', `${m.avgKcal} kcal/day`]);
    blank();
    rows.push(['RECENT MEALS', '']);
    rows.push(['Meal', 'Date', 'Type', 'Calories']);
    m.mealRows.forEach((r) => rows.push([r.name, r.date, r.type, `${r.kcal} kcal`]));
    blank();
  }

  if (m.sections.exercise) {
    rows.push(['EXERCISE PLAN', '']);
    rows.push(['Day', 'Focus', 'Exercise', 'Sets', 'Reps', 'Weight (kg)']);
    m.planDays.forEach((d) => {
      d.exercises.forEach((e) =>
        rows.push([d.day, d.focus, e.name, String(e.sets), String(e.reps), e.weight ? String(e.weight) : ''])
      );
    });
    blank();
  }

  if (m.sections.body) {
    rows.push(['BODY METRICS', '']);
    rows.push(['Date', 'Weight (kg)', 'Height (cm)', 'BMI']);
    m.metrics.forEach((b) => rows.push([b.date, String(b.weight), String(b.height), b.bmi]));
    blank();
  }

  if (m.sections.habits) {
    rows.push(['HABITS & CONSISTENCY', '']);
    rows.push(['Habit', 'Current streak (days)', 'Total days', 'This month', 'Month %']);
    m.habits.forEach((h) =>
      rows.push([h.name, String(h.streak), String(h.done), `${h.monthDone}/${h.monthDays}`, `${h.pct}%`])
    );
    blank();
  }

  if (m.sections.health) {
    rows.push(['HEALTH SNAPSHOT', '']);
    rows.push(['Average sleep (hrs)', m.avgSleep ? m.avgSleep.toFixed(1) : '--']);
    rows.push(['Workouts logged', String(m.workoutsLogged)]);
    rows.push(['Meals logged', String(m.mealsLogged)]);
    rows.push(['Best habit streak', `${m.bestStreak} days`]);
  }

  return rows;
}
