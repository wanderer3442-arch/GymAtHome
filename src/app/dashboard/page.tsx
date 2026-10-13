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
} from 'lucide-react';
import Link from 'next/link';
import { useStore } from '@/lib/store-context';
import { allFoods } from '@/lib/food-database';
import { BADGE_CATALOG } from '@/lib/badges';
import { FoodItem } from '@/lib/types';

const healthTips = [
  "8 hours of sleep is vital for muscle recovery and hormonal balance.",
  "Drinking water before meals can boost metabolism by 24-30%.",
  "Protein helps repair tissues and build lean muscle mass.",
  "A 10-minute walk after meals improves digestion significantly.",
  "Consistency beats intensity - small daily habits drive results.",
  "Getting sunlight in the morning regulates your circadian rhythm.",
];

const monthCellColor = (score: number) => {
  if (score < 0) return 'bg-transparent';
  if (score === 0) return 'bg-surface-container-high';
  if (score < 50) return 'bg-primary/30';
  if (score < 90) return 'bg-primary/70';
  return 'bg-primary';
};

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

  const today = new Date().toISOString().split('T')[0];
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

  const streak = useMemo(() => {
    let count = 0;
    const d = new Date();
    for (let i = 0; i < 30; i++) {
      const dateStr = d.toISOString().split('T')[0];
      if (getMealsForDate(dateStr).length > 0 || getExercisesForDate(dateStr).length > 0) {
        count++;
      } else if (i > 0) {
        break;
      }
      d.setDate(d.getDate() - 1);
    }
    return count;
  }, [meals, exercises]);

  // GitHub-style month grid from real daily activity (last 5 weeks, Monday-aligned)
  const monthWeeks = useMemo(() => {
    const end = new Date();
    const start = new Date(end);
    start.setDate(end.getDate() - 34);
    const dow = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - dow);
    const cells: { dateStr: string; score: number; isToday: boolean; empty: boolean }[] = [];
    const cur = new Date(start);
    while (cur <= end) {
      const dateStr = cur.toISOString().split('T')[0];
      const dayMeals = getMealsForDate(dateStr);
      const dayExercises = getExercisesForDate(dateStr);
      let score = 0;
      if (dayMeals.length > 0) score += 40;
      if (dayExercises.length > 0) score += 40;
      if (dayMeals.length > 2) score += 20;
      cells.push({ dateStr, score: Math.min(score, 100), isToday: dateStr === today, empty: false });
      cur.setDate(cur.getDate() + 1);
    }
    while (cells.length % 7 !== 0) {
      cells.push({ dateStr: '', score: -1, isToday: false, empty: true });
    }
    const weeks: typeof cells[] = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    return weeks;
  }, [meals, exercises, today]);

  const activeDays = monthWeeks.flat().filter((c) => !c.empty && c.score > 0).length;

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
      <div className="max-w-7xl mx-auto space-y-6 pb-8">
        <div className="grid grid-cols-4 md:grid-cols-12 gap-4 md:gap-6">
          {/* Hero + Health Tip Row */}
          <div className="col-span-4 md:col-span-12 grid grid-cols-4 md:grid-cols-12 gap-4 md:gap-6">
            {/* Hero Section */}
            <section className="col-span-4 md:col-span-8 flex flex-col justify-center gap-3 rounded-xl">
              <h1 className="text-2xl md:text-display-lg font-bold text-on-background">
                {greeting}, <span className="text-primary">{profile?.name || 'there'}</span>.
              </h1>
              <p className="text-body-lg text-on-surface-variant max-w-2xl">
                {streak > 0
                  ? `You're on a ${streak}-day streak. Let's keep the momentum going.`
                  : 'Start your fitness journey today. Log your first meal or workout!'}
              </p>
            </section>

            {/* Health Tip Banner */}
            <section className="col-span-4 md:col-span-4 bg-surface rounded-xl border border-outline-variant shadow-[0_4px_15px_4px_rgba(15,23,42,0.04)] p-5 relative overflow-hidden flex flex-col justify-center">
              <div className="flex items-center gap-2 text-tertiary-container mb-2">
                <div className="w-8 h-8 rounded-full bg-tertiary-container/10 flex items-center justify-center text-tertiary-container">
                  <Lightbulb className="w-[18px] h-[18px]" />
                </div>
                <span className="text-label-md uppercase tracking-wider font-bold text-tertiary-container">
                  Health Tip
                </span>
              </div>
              <p className="text-body-md text-on-surface font-medium">
                &ldquo;{healthTips[tipIndex]}&rdquo;
              </p>
              <div className="absolute bottom-0 left-0 w-full h-1 bg-surface-container-high">
                <div
                  className="h-full bg-tertiary-container"
                  style={{
                    animation: 'shrink 5s linear infinite',
                    transformOrigin: 'left',
                  }}
                />
              </div>
            </section>
          </div>

          {/* Today's Workout Row */}
          <div className="col-span-4 md:col-span-12 grid grid-cols-4 md:grid-cols-12 gap-4 md:gap-6">
            {/* Today's Workout */}
            <section className="col-span-4 md:col-span-12 bg-surface rounded-xl border border-outline-variant shadow-[0_4px_15px_4px_rgba(15,23,42,0.04)] p-5 flex flex-col">
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
          </div>

          {/* Month Heatmap + Daily Goals Row */}
          <div className="col-span-4 md:col-span-12 grid grid-cols-4 md:grid-cols-12 gap-4 md:gap-6">
            {/* Month Heatmap */}
            <section className="col-span-4 md:col-span-8 bg-surface rounded-xl border border-outline-variant shadow-[0_4px_15px_4px_rgba(15,23,42,0.04)] p-5 flex flex-col">
              <div className="flex flex-wrap justify-between items-start gap-3 mb-5">
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
              {/* Month header + grid */}
              <div className="flex gap-2">
                {/* Weekday labels */}
                <div className="flex flex-col gap-1.5">
                  <div className="h-4 mb-1" />
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d, i) => (
                    <span key={i} className="h-6 md:h-7 flex items-center text-[10px] text-on-surface-variant leading-none">{d}</span>
                  ))}
                </div>
                {/* Week columns with month labels above */}
                <div className="flex gap-1.5">
                  {monthWeeks.map((week, wi) => {
                    const month = new Date(week[0].dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' });
                    const prevMonth = wi > 0 ? new Date(monthWeeks[wi - 1][0].dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' }) : null;
                    return (
                      <div key={wi} className="flex flex-col items-center">
                        <span className="h-4 text-[10px] font-semibold text-on-surface-variant leading-none">
                          {month !== prevMonth ? month : ''}
                        </span>
                        <div className="flex flex-col gap-1.5 mt-1">
                          {week.map((cell, ci) => (
                            <div
                              key={ci}
                              title={cell.empty ? undefined : `${new Date(cell.dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — ${cell.score === 0 ? 'No activity' : cell.score < 50 ? 'Meals logged' : cell.score < 90 ? 'Meals + workout' : 'Full day'}`}
                              className={`w-6 h-6 md:w-7 md:h-7 rounded-[6px] transition-colors ${monthCellColor(cell.score)}${cell.isToday ? ' ring-2 ring-primary ring-offset-2 ring-offset-surface' : ''}`}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              {/* Summary + legend */}
              <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-3 border-t border-outline-variant/60">
                <span className="text-label-md text-on-surface-variant">
                  <span className="font-bold text-on-surface">{activeDays}</span> of the last 35 days active
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-on-surface-variant">Less</span>
                  {[0, 25, 60, 100].map((s) => (
                    <div key={s} className={`w-3 h-3 rounded-[3px] ${monthCellColor(s)}`} />
                  ))}
                  <span className="text-[10px] text-on-surface-variant">More</span>
                </div>
              </div>
            </section>

            {/* Daily Goals */}
            <section className="col-span-4 md:col-span-4 bg-surface rounded-xl border border-outline-variant shadow-[0_4px_15px_4px_rgba(15,23,42,0.04)] p-5 transition-shadow duration-300 hover:shadow-[0_8px_25px_8px_rgba(15,23,42,0.08)]">
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

          {/* Personal Records Row */}
          <div className="col-span-4 md:col-span-12 grid grid-cols-4 md:grid-cols-12 gap-4 md:gap-6">
            <section className="col-span-4 md:col-span-12 bg-surface rounded-xl border border-outline-variant shadow-[0_4px_15px_4px_rgba(15,23,42,0.04)] p-5">
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
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {personalRecords.map((pr) => (
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
          </div>

          {/* Log Food Row */}
          <div className="col-span-4 md:col-span-12 grid grid-cols-4 md:grid-cols-12 gap-4 md:gap-6">
            {/* Log Food */}
            <section className="col-span-4 md:col-span-12 bg-surface rounded-xl border border-outline-variant shadow-[0_4px_15px_4px_rgba(15,23,42,0.04)] p-5 flex flex-col justify-between">
              <div>
                <h2 className="text-headline-md font-semibold text-on-background mb-2">
                  Eat anything new today?
                </h2>
                <p className="text-label-md text-on-surface-variant mb-4">
                  Quick log for better tracking.
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <div className="relative">
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
                  className="w-full h-12 bg-primary text-on-primary rounded-lg text-label-md font-bold hover:bg-primary/90 shadow-sm transition-all flex items-center justify-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  Log Food
                </Link>
              </div>
            </section>
          </div>

          {/* Achievements Row */}
          <div className="col-span-4 md:col-span-12 grid grid-cols-4 md:grid-cols-12 gap-4 md:gap-6">
            <section className="col-span-4 md:col-span-12 bg-surface rounded-xl border border-outline-variant shadow-[0_4px_15px_4px_rgba(15,23,42,0.04)] p-5">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                  <Trophy className="w-[18px] h-[18px] text-tertiary-container" />
                  <h2 className="text-headline-md font-semibold text-on-background">Achievements</h2>
                </div>
                <span className="bg-surface-container-high text-label-md px-2 py-1 rounded-full font-bold text-on-surface">
                  {badges.length} / {BADGE_CATALOG.length}
                </span>
              </div>
              <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
                {BADGE_CATALOG.map((b) => {
                  const unlocked = badges.some((x) => x.id === b.id);
                  return (
                    <div
                      key={b.id}
                      title={b.description}
                      className={`flex flex-col items-center gap-1.5 min-w-[84px] p-3 rounded-xl border transition-all ${
                        unlocked
                          ? 'bg-tertiary-container/10 border-tertiary-container/30'
                          : 'bg-surface-container border-outline-variant/40 opacity-50'
                      }`}
                    >
                      <span className="text-2xl leading-none">{b.icon}</span>
                      <span className="text-[10px] font-bold text-center text-on-surface leading-tight">{b.name}</span>
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
      </div>
    </DashboardLayout>
  );
}
