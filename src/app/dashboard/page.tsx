'use client';

import DashboardLayout from '@/components/layout/DashboardLayout';
import { useState, useMemo, useEffect, useRef } from 'react';
import {
  Lightbulb,
  Search,
  Plus,
  ArrowRight,
  Flame,
  Dumbbell,
  Moon,
  Trophy,
  User,
  Check,
} from 'lucide-react';
import Link from 'next/link';
import { useStore } from '@/lib/store-context';
import { allFoods } from '@/lib/food-database';
import { BADGE_CATALOG, STREAK_BADGE_ID, STREAK_TIERS } from '@/lib/badges';
import { FoodItem } from '@/lib/types';
import { WeatherWidget } from '@/lib/weather';
import Heatmap from '@/components/Heatmap';
import { buildHeatDays, type HeatKind, type HeatRange } from '@/lib/heatmap';
import { localDateKey, streakEndingToday } from '@/lib/date';

const healthTips = [
  "8 hours of sleep is vital for muscle recovery and hormonal balance.",
  "Drinking water before meals can boost metabolism by 24-30%.",
  "Protein helps repair tissues and build lean muscle mass.",
  "A 10-minute walk after meals improves digestion significantly.",
  "Consistency beats intensity - small daily habits drive results.",
  "Getting sunlight in the morning regulates your circadian rhythm.",
];

export default function DashboardPage() {
  const {
    profile, calculations, meals, exercises, waterLogs,
    workoutPlan, badges, checkBadges,
    getMealsForDate, getExercisesForDate, getWaterForDate,
  } = useStore();
  const [tipIndex, setTipIndex] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [foodSearch, setFoodSearch] = useState('');
  const [searchResults, setSearchResults] = useState<FoodItem[]>([]);
  const [heatRange, setHeatRange] = useState<HeatRange>('month');
  const [heatKind, setHeatKind] = useState<HeatKind>('calendar');
  const [goals, setGoals] = useState([
    { id: 1, label: 'Log Meals', completed: false, pct: 0 },
    { id: 2, label: 'Daily Habit: Hydration', completed: false, pct: 0 },
    { id: 3, label: 'Exercise Session', completed: false, pct: 0 },
  ]);

  useEffect(() => {
    setMounted(true);
    setTipIndex(Math.floor(Math.random() * healthTips.length));
    checkBadges();
    const interval = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % healthTips.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const today = localDateKey();
  const todayMeals = useMemo(() => getMealsForDate(today), [meals, today]);
  const todayWaterMl = useMemo(() => getWaterForDate(today), [waterLogs, today]);
  const hydrationTarget = calculations?.hydration || 0;

  const todayPlan = useMemo(() => {
    if (!workoutPlan || workoutPlan.exercises.length === 0) return { state: 'none' as const };
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const todayName = dayNames[new Date().getDay()];
    const todayExs = workoutPlan.exercises.filter((e) => e.day === todayName);
    if (todayExs.length > 0) return { state: 'today' as const, day: todayName, count: todayExs.length };
    const weekOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const todayIdx = (new Date().getDay() + 6) % 7;
    for (let i = 1; i <= 7; i++) {
      const name = weekOrder[(todayIdx + i) % 7];
      const exs = workoutPlan.exercises.filter((e) => e.day === name);
      if (exs.length > 0) return { state: 'rest' as const, nextDay: name, nextCount: exs.length };
    }
    return { state: 'none' as const };
  }, [workoutPlan]);

  const manualGoals = useRef<Set<number>>(new Set());

  useEffect(() => {
    setGoals(prev => prev.map(g => {
      if (manualGoals.current.has(g.id)) return g;
      if (g.id === 1) {
        const done = todayMeals.length > 0;
        return { ...g, completed: done, pct: done ? 100 : 0 };
      }
      if (g.id === 2) {
        if (hydrationTarget <= 0) return g;
        const pct = Math.min(Math.round(((todayWaterMl / 1000) / hydrationTarget) * 100), 100);
        return { ...g, completed: pct >= 100, pct };
      }
      if (g.id === 3) {
        const done = getExercisesForDate(today).length > 0;
        return { ...g, completed: done, pct: done ? 100 : 0 };
      }
      return g;
    }));
  }, [todayMeals, exercises, waterLogs, hydrationTarget, today]);

  const streak = useMemo(
    () =>
      streakEndingToday(
        (key) => getMealsForDate(key).length > 0 || getExercisesForDate(key).length > 0
      ),
    [meals, exercises]
  );

  // Heatmap data for the selected range. A full day = meals + workout.
  const activityHeat = useMemo(() => {
    const scoreFor = (key: string) => {
      const hasMeal = getMealsForDate(key).length > 0;
      const hasWorkout = getExercisesForDate(key).length > 0;
      if (hasMeal && hasWorkout) return 1;
      if (hasWorkout) return 0.7;
      if (hasMeal) return 0.4;
      return 0;
    };
    return buildHeatDays(heatRange, scoreFor);
  }, [heatRange, meals, exercises]);

  const streakBadge = badges.find((b) => b.id === STREAK_BADGE_ID);
  const streakLevel = streakBadge ? streakBadge.level ?? 0 : -1;
  const nextStreakTier =
    streakLevel + 1 < STREAK_TIERS.length ? STREAK_TIERS[streakLevel + 1] : null;

  // All-time best weight per exercise (Personal Records)
  const personalRecords = useMemo(() => {
    const best = new Map<string, { name: string; weight: number; date: string }>();
    exercises.forEach((e) => {
      if (!e.weight || e.weight <= 0) return;
      const prev = best.get(e.exerciseId);
      if (!prev || e.weight > prev.weight) {
        best.set(e.exerciseId, { name: e.exerciseName, weight: e.weight, date: e.loggedAt.split('T')[0] });
      }
    });
    return Array.from(best.values()).sort((a, b) => b.weight - a.weight).slice(0, 5);
  }, [exercises]);

  const handleFoodSearch = (query: string) => {
    setFoodSearch(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    const results = allFoods
      .filter((f) => f.name.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 5);
    setSearchResults(results);
  };

  const greeting = (() => {
    if (!mounted) return 'Hello';
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  return (
    <DashboardLayout title="Dashboard" subtitle="">
      <div className="max-w-7xl mx-auto space-y-4 md:space-y-6 pb-8">
        {/* Hero: avatar, greeting, streak line, tip, weather */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 shrink-0 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center ring-2 ring-primary/20">
              {profile?.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.photo} alt="" className="w-full h-full object-cover" />
              ) : (
                <User className="w-7 h-7 text-primary" />
              )}
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl md:text-display-lg font-bold text-on-background">
                {greeting}, <span className="text-primary">{profile?.name || 'there'}</span>.
              </h1>
              {streak > 0 && (
                <p className="text-body-md md:text-body-lg text-on-surface-variant">
                  You&rsquo;re on a {streak}-day streak. Let&rsquo;s keep the momentum going.
                </p>
              )}
            </div>
          </div>
          {/* Daily tip - one subtle line (replaces the old rotating banner card) */}
          <p className="flex items-start gap-2 text-label-md text-on-surface-variant">
            <Lightbulb className="w-4 h-4 shrink-0 mt-0.5 text-tertiary-container" />
            <span>&ldquo;{healthTips[tipIndex]}&rdquo;</span>
          </p>
          {/* Weather */}
          <div className="mt-1">
            <WeatherWidget />
          </div>
        </section>

        {/* Today's Workout + Daily Goals */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          <section className="lg:col-span-2 bg-surface rounded-xl border border-outline-variant shadow-[0_4px_15px_4px_rgba(15,23,42,0.04)] p-5 flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-headline-md font-semibold text-on-background">Today&rsquo;s Workout</h2>
              <Dumbbell className="w-[18px] h-[18px] text-primary" />
            </div>
            <div className="flex-1 flex flex-col md:flex-row md:items-center gap-4">
              {todayPlan.state === 'today' && (
                <>
                  <div className="flex-1 bg-primary/5 border border-primary/10 rounded-xl p-4">
                    <p className="text-label-md text-on-surface-variant">{todayPlan.day}</p>
                    <p className="text-headline-md font-bold text-on-surface">{todayPlan.count} exercises</p>
                    <p className="text-label-md text-on-surface-variant mt-0.5">Scheduled for today</p>
                  </div>
                  <Link
                    href="/exercise-plan"
                    className="h-12 px-8 bg-primary text-on-primary rounded-lg text-label-md font-bold hover:bg-primary/90 shadow-sm transition-all flex items-center justify-center gap-2"
                  >
                    Start Workout <ArrowRight className="w-4 h-4" />
                  </Link>
                </>
              )}
              {todayPlan.state === 'rest' && (
                <>
                  <div className="flex-1 flex items-center gap-3 bg-surface-container rounded-xl p-4">
                    <div className="w-10 h-10 shrink-0 rounded-full bg-surface-container-high flex items-center justify-center">
                      <Moon className="w-5 h-5 text-on-surface-variant" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-body-md font-bold text-on-surface">Rest Day</p>
                      <p className="text-label-md text-on-surface-variant truncate">
                        Next: {todayPlan.nextDay} · {todayPlan.nextCount} exercises
                      </p>
                    </div>
                  </div>
                  <Link
                    href="/exercise-plan"
                    className="h-12 px-8 border border-outline-variant text-on-surface hover:bg-surface-container rounded-lg text-label-md font-bold transition-all flex items-center justify-center gap-2"
                  >
                    View Full Plan <ArrowRight className="w-4 h-4" />
                  </Link>
                </>
              )}
              {todayPlan.state === 'none' && (
                <>
                  <div className="flex-1 flex flex-col gap-1">
                    <p className="text-body-md font-bold text-on-surface">No plan yet</p>
                    <p className="text-label-md text-on-surface-variant">
                      Generate a personalized workout plan to see today&rsquo;s session here.
                    </p>
                  </div>
                  <Link
                    href="/exercise-plan"
                    className="h-12 px-8 bg-primary text-on-primary rounded-lg text-label-md font-bold hover:bg-primary/90 shadow-sm transition-all flex items-center justify-center gap-2"
                  >
                    Generate Plan <ArrowRight className="w-4 h-4" />
                  </Link>
                </>
              )}
            </div>
          </section>

          <section className="bg-surface rounded-xl border border-outline-variant shadow-[0_4px_15px_4px_rgba(15,23,42,0.04)] p-5 transition-shadow duration-300 hover:shadow-[0_8px_25px_8px_rgba(15,23,42,0.08)]">
            <h2 className="text-headline-md font-semibold text-on-background mb-5">Daily Goals</h2>
            <ul className="flex flex-col gap-3">
              {goals.map((goal) => (
                <li
                  key={goal.id}
                  onClick={() => {
                    manualGoals.current.add(goal.id);
                    setGoals((prev) =>
                      prev.map((g) =>
                        g.id === goal.id
                          ? { ...g, completed: !g.completed, pct: g.completed ? 0 : 100 }
                          : g
                      )
                    );
                  }}
                  className="flex items-center gap-3 p-2 rounded-xl hover:bg-surface-container-low transition-colors cursor-pointer group"
                >
                  <div className="relative w-8 h-8 flex items-center justify-center">
                    <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 36 36">
                      <circle className="stroke-surface-container-high" cx="18" cy="18" fill="none" r="16" strokeWidth="3" />
                      <circle
                        className={goal.completed ? 'stroke-primary' : 'stroke-secondary'}
                        cx="18"
                        cy="18"
                        fill="none"
                        r="16"
                        strokeDasharray={`${goal.pct}, 100`}
                        pathLength={100}
                        strokeLinecap="round"
                        strokeWidth="3"
                      />
                    </svg>
                    {goal.completed ? (
                      <svg className="w-4 h-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      goal.pct > 0 && (
                        <span className="text-[10px] font-bold text-secondary">{goal.pct}%</span>
                      )
                    )}
                  </div>
                  <span className="text-body-md text-on-surface">{goal.label}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* Consistency heatmap */}
        <section className="bg-surface rounded-xl border border-outline-variant shadow-[0_4px_15px_4px_rgba(15,23,42,0.04)] p-5 flex flex-col">
          <div className="flex flex-wrap justify-between items-start gap-3 mb-4">
            <div>
              <h2 className="text-headline-md font-semibold text-on-background">Consistency</h2>
              <p className="text-label-md text-on-surface-variant mt-1">
                Log meals or workouts to light up a day. Keep the chain going!
              </p>
            </div>
            <div className="flex items-center gap-2 bg-primary/10 px-3 py-1 rounded-full">
              <Flame className="w-[18px] h-[18px] text-primary" />
              <span className="text-label-md font-bold text-primary">{streak} Day Streak</span>
            </div>
          </div>
          <Heatmap
            days={activityHeat}
            range={heatRange}
            onRangeChange={setHeatRange}
            kind={heatKind}
            onKindChange={setHeatKind}
            unit="days"
          />
        </section>

        {/* Log Food - compact single row */}
        <section className="bg-surface rounded-xl border border-outline-variant shadow-[0_4px_15px_4px_rgba(15,23,42,0.04)] p-4 md:p-5">
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <h2 className="text-headline-md font-semibold text-on-background shrink-0">
              Eat anything new today?
            </h2>
            <div className="relative flex-1">
              <input
                type="text"
                value={foodSearch}
                onChange={(e) => handleFoodSearch(e.target.value)}
                placeholder="e.g. Avocado Toast"
                className="w-full h-12 px-4 pr-12 rounded-lg border border-outline-variant bg-surface text-body-md text-on-surface focus:outline-none focus:border-secondary-container focus:ring-2 focus:ring-secondary-container/20 transition-all"
              />
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-outline" />
              {searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-surface rounded-lg border border-outline-variant shadow-lg z-10 max-h-60 overflow-y-auto">
                  {searchResults.map((food) => (
                    <Link
                      key={food.id}
                      href="/meal-plan"
                      className="w-full flex justify-between items-center px-4 py-3 hover:bg-surface-container-low transition-colors text-left"
                    >
                      <div>
                        <p className="text-body-md text-on-surface font-medium">{food.name}</p>
                        <p className="text-label-md text-on-surface-variant">{food.category} · {food.nutrition.calories} kcal</p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-outline" />
                    </Link>
                  ))}
                </div>
              )}
            </div>
            <Link
              href="/meal-plan"
              className="h-12 px-6 shrink-0 bg-primary text-on-primary rounded-lg text-label-md font-bold hover:bg-primary/90 shadow-sm transition-all flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Log Food
            </Link>
          </div>
        </section>

        {/* Personal Records + Achievements */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          <section className="lg:col-span-2 bg-surface rounded-xl border border-outline-variant shadow-[0_4px_15px_4px_rgba(15,23,42,0.04)] p-5">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <Trophy className="w-[18px] h-[18px] text-tertiary-container" />
                <h2 className="text-headline-md font-semibold text-on-background">Personal Records</h2>
              </div>
              {personalRecords.length > 0 && (
                <Link href="/exercise-plan" className="text-label-md font-bold text-primary hover:underline">
                  View Plan
                </Link>
              )}
            </div>
            {personalRecords.length === 0 ? (
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between py-2">
                <p className="text-body-md text-on-surface-variant">
                  Complete weighted workouts to set your first records.
                </p>
                <Link
                  href="/exercise-plan"
                  className="h-11 px-6 bg-primary text-on-primary rounded-lg text-label-md font-bold hover:bg-primary/90 shadow-sm transition-all flex items-center justify-center gap-2 shrink-0"
                >
                  Start Training <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {personalRecords.slice(0, 3).map((pr) => (
                  <div
                    key={pr.name}
                    className="bg-surface-container rounded-xl p-3.5 flex flex-col gap-1 min-w-0"
                  >
                    <span className="text-body-md font-bold text-on-surface truncate">{pr.name}</span>
                    <span className="text-headline-md font-bold text-primary leading-tight">{pr.weight} kg</span>
                    <span className="text-label-md text-on-surface-variant">
                      {pr.date === today ? 'Set today' : `Set ${new Date(pr.date + 'T00:00:00').toLocaleDateString('en', { month: 'short', day: 'numeric' })}`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="bg-surface rounded-xl border border-outline-variant shadow-[0_4px_15px_4px_rgba(15,23,42,0.04)] p-5">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <Trophy className="w-[18px] h-[18px] text-tertiary-container" />
                <h2 className="text-headline-md font-semibold text-on-background">Achievements</h2>
              </div>
              <span className="bg-surface-container-high text-label-md px-2 py-1 rounded-full font-bold text-on-surface">
                {badges.length} / {BADGE_CATALOG.length}
              </span>
            </div>

            {/* Leveled consistency badge — upgrades in place as the streak grows */}
            <div className="mb-3 rounded-xl border border-primary/20 bg-primary/5 p-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl leading-none shrink-0">
                  {streakBadge?.icon ?? STREAK_TIERS[0].icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-label-md font-bold text-on-surface truncate">
                    {streakBadge?.name ?? 'Consistency Badge'}
                  </p>
                  <p className="text-[10px] text-on-surface-variant">
                    {streakBadge
                      ? `${streak}-day streak · level ${streakLevel + 1} of ${STREAK_TIERS.length}`
                      : 'Log meals or workouts 3 days in a row to unlock'}
                    {streakBadge && nextStreakTier
                      ? ` · ${Math.max(0, nextStreakTier.days - streak)} days to ${nextStreakTier.name}`
                      : ''}
                  </p>
                </div>
                {streakBadge && (
                  <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
                    Lv {streakLevel + 1}
                  </span>
                )}
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-container-high">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{
                    width: nextStreakTier
                      ? `${Math.min(100, Math.round((streak / nextStreakTier.days) * 100))}%`
                      : '100%',
                  }}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
              {BADGE_CATALOG.filter((b) => b.id !== STREAK_BADGE_ID).map((b) => {
                const unlocked = badges.some((x) => x.id === b.id);
                return (
                  <div
                    key={b.id}
                    title={b.description}
                    className={`flex items-center gap-3 p-2.5 rounded-lg ${
                      unlocked ? 'bg-tertiary-container/10' : 'bg-surface-container opacity-50'
                    }`}
                  >
                    <span className="text-xl leading-none shrink-0">{b.icon}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-label-md font-bold text-on-surface truncate">{b.name}</p>
                      <p className="text-[10px] text-on-surface-variant truncate">{b.description}</p>
                    </div>
                    {unlocked && <Check className="w-4 h-4 shrink-0 text-tertiary-container" />}
                  </div>
                );
              })}
            </div>
            {badges.length === 0 && (
              <p className="text-label-md text-on-surface-variant mt-3">
                Log a meal or complete a workout to earn your first badge.
              </p>
            )}
          </section>
        </div>
      </div>
    </DashboardLayout>
  );
}
