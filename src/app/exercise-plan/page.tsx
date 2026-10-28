'use client';

import DashboardLayout from '@/components/layout/DashboardLayout';
import { useState, useMemo } from 'react';
import {
  Dumbbell,
  Home,
  Plus,
  ArrowLeftRight,
  Settings,
  Eye,
  TrendingUp,
  AlertTriangle,
  Pencil,
  Trash2,
  Activity,
  RefreshCw,
  Check,
} from 'lucide-react';
import { useStore } from '@/lib/store-context';
import { keyOfTimestamp, localDateKey } from '@/lib/date';
import { exercises } from '@/lib/exercise-database';
import {
  generateWorkoutPlan,
  getWeeklyWorkoutSummary,
  getDefaultSplit,
  getDefaultWeight,
  PLAN_DAY_NAMES,
  MUSCLE_GROUP_OPTIONS,
} from '@/lib/exercise-planner';
import { Equipment, WorkoutExercise } from '@/lib/types';
import WorkoutTimer from '@/components/WorkoutTimer';
import { useBackHandler } from '@/lib/back-handler';
import { X, CalendarDays, MapPin, Target, Layers3 } from 'lucide-react';

type LocationFilter = 'gym' | 'home';

const muscleLabels: Record<string, string> = {
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  biceps: 'Biceps',
  triceps: 'Triceps',
  legs: 'Legs',
  core: 'Core',
  full_body: 'Full Body',
};

function splitLabel(split: string[][] | undefined, daysPerWeek: number): string {
  if (!split || split.length === 0) {
    return daysPerWeek === 3 ? 'Push/Pull/Legs' : `${daysPerWeek}-Day Split`;
  }
  return split
    .map((groups) => groups.map((g) => muscleLabels[g] || g).join(' + '))
    .join(' / ');
}

export default function ExercisePlanPage() {
  const { profile, workoutPlan, setWorkoutPlan, exercises: loggedExercises, addExercise, removeExercise, getExercisesForDate } = useStore();
  const [location, setLocation] = useState<LocationFilter>('gym');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null);
  const [addWeight, setAddWeight] = useState('');
  const [editKey, setEditKey] = useState<string | null>(null);
  const [editVal, setEditVal] = useState('');
  const [selectedDay, setSelectedDay] = useState<string>('');
  const [daysPerWeek, setDaysPerWeek] = useState(3);
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [draftSplit, setDraftSplit] = useState<string[][]>(() => getDefaultSplit(3));

  useBackHandler(showSplitModal, () => setShowSplitModal(false));
  useBackHandler(showAddModal, () => setShowAddModal(false));

  const plan = workoutPlan;

  const planDays = useMemo(() => {
    if (!plan) return [];
    const grouped: Record<string, WorkoutExercise[]> = {};
    plan.exercises.forEach((ex) => {
      if (!grouped[ex.day]) grouped[ex.day] = [];
      grouped[ex.day].push(ex);
    });
    const planSplit = plan.split && plan.split.length > 0 ? plan.split : undefined;
    if (!planSplit) {
      return Object.entries(grouped).map(([day, exs]) => ({
        day,
        label: day,
        exercises: exs,
      }));
    }
    // Derive days from the split so every planned day shows (even when empty)
    // and labels stay aligned with their day.
    const days = planSplit.map((groups, idx) => {
      const day = PLAN_DAY_NAMES[idx] || `Day ${idx + 1}`;
      return {
        day,
        label: groups.map((g) => muscleLabels[g] || g).join(' + '),
        exercises: grouped[day] || [],
      };
    });
    Object.entries(grouped).forEach(([day, exs]) => {
      if (!days.some((d) => d.day === day)) days.push({ day, label: day, exercises: exs });
    });
    return days;
  }, [plan]);

  const todayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()];

  const selectedDayName = useMemo(() => {
    if (selectedDay && planDays.some((d) => d.day === selectedDay)) return selectedDay;
    return planDays.find((d) => d.day === todayName)?.day ?? planDays[0]?.day ?? '';
  }, [planDays, selectedDay, todayName]);

  const selectedPlan = planDays.find((d) => d.day === selectedDayName);

  const openSplitEditor = () => {
    setDraftSplit(plan?.split && plan.split.length > 0 ? plan.split.map((d) => [...d]) : getDefaultSplit(daysPerWeek));
    setShowSplitModal(true);
  };

  const changeDaysPerWeek = (n: number) => {
    setDaysPerWeek(n);
    setDraftSplit(getDefaultSplit(n));
  };

  const toggleMuscle = (dayIndex: number, muscle: string) => {
    setDraftSplit((prev) =>
      prev.map((groups, idx) => {
        if (idx !== dayIndex) return groups;
        if (groups.includes(muscle)) {
          if (groups.length === 1) return groups;
          return groups.filter((g) => g !== muscle);
        }
        return [...groups, muscle];
      })
    );
  };

  const weeklyVolume = useMemo(() => {
    if (!plan) {
      return [
        { muscle: 'Chest', sets: 0, pct: 0, color: 'bg-primary' },
        { muscle: 'Back', sets: 0, pct: 0, color: 'bg-secondary' },
        { muscle: 'Legs', sets: 0, pct: 0, color: 'bg-tertiary' },
      ];
    }
    const counts: Record<string, number> = {};
    plan.exercises.forEach((ex) => {
      const dbEx = exercises.find((e) => e.id === ex.exerciseId);
      if (dbEx) {
        const group = dbEx.muscleGroup;
        counts[group] = (counts[group] || 0) + ex.sets;
      }
    });
    const maxSets = Math.max(...Object.values(counts), 1);
    const palette = ['bg-primary', 'bg-secondary', 'bg-tertiary'];
    const active = Object.entries(counts)
      .filter(([, sets]) => sets > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([muscle, sets], i) => ({
        muscle: muscleLabels[muscle] || muscle,
        sets,
        pct: Math.round((sets / maxSets) * 100),
        color: palette[i % palette.length],
      }));
    if (active.length > 0) return active;
    return ['chest', 'back', 'legs'].map((muscle) => ({
      muscle: muscleLabels[muscle] || muscle,
      sets: 0,
      pct: 0,
      color: muscle === 'legs' ? 'bg-tertiary' : muscle === 'back' ? 'bg-secondary' : 'bg-primary',
    }));
  }, [plan]);

  const progressData = useMemo(() => {
    const now = new Date();
    const data = [];
    for (let i = 3; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - (i * 7));
      const weekStr = `W${4 - i}`;
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      let count = 0;
      for (let j = 0; j < 7; j++) {
        const dd = new Date(weekStart);
        dd.setDate(weekStart.getDate() + j);
        const dateStr = localDateKey(dd);
        const dayExercises = loggedExercises.filter((e) => keyOfTimestamp(e.loggedAt) === dateStr);
        count += dayExercises.length;
      }
      data.push({ week: weekStr, value: count, height: count === 0 ? 8 : `${Math.min(20 + count * 10, 100)}%` });
    }
    return data;
  }, [loggedExercises]);

  const generatePlan = () => {
    const newPlan = generateWorkoutPlan({
      profile,
      equipment: location as Equipment,
      daysPerWeek,
      customSplit: draftSplit,
    });
    setWorkoutPlan(newPlan);
    setShowSplitModal(false);
    setSelectedDay('');
  };

  const addExerciseToDay = (day: string, exerciseId: string) => {
    if (!plan || !day) return;
    const dbEx = exercises.find((e) => e.id === exerciseId);
    if (!dbEx) return;
    // Skip duplicates — same exerciseId twice in one day breaks React keys.
    if (plan.exercises.some((e) => e.day === day && e.exerciseId === exerciseId)) {
      setShowAddModal(false);
      setAddWeight('');
      return;
    }
    const parsedWeight = parseFloat(addWeight);
    const weight = !isNaN(parsedWeight) && parsedWeight > 0
      ? Math.round(parsedWeight * 2) / 2
      : getDefaultWeight(dbEx);
    const newExercise: WorkoutExercise = {
      exerciseId: dbEx.id,
      exerciseName: dbEx.name,
      sets: profile.goal === 'gain' ? 4 : 3,
      reps: profile.goal === 'lose' ? 12 : profile.goal === 'gain' ? 8 : 10,
      ...(weight !== undefined ? { weight } : {}),
      day,
    };
    setWorkoutPlan({
      ...plan,
      exercises: [...plan.exercises, newExercise],
    });
    setShowAddModal(false);
    setAddWeight('');
  };

  const removeExerciseFromDay = (day: string, exerciseId: string) => {
    if (!plan) return;
    setWorkoutPlan({
      ...plan,
      exercises: plan.exercises.filter(
        (e) => !(e.day === day && e.exerciseId === exerciseId)
      ),
    });
  };

  const todayStr = localDateKey();
  const todayLogs = getExercisesForDate(todayStr);

  const startEdit = (key: string, val: number | undefined) => {
    setEditKey(key);
    setEditVal(val !== undefined ? String(val) : '');
  };

  const commitEdit = (day: string, exerciseId: string, field: 'sets' | 'reps' | 'weight') => {
    if (!plan) return;
    const num = parseFloat(editVal);
    setWorkoutPlan({
      ...plan,
      exercises: plan.exercises.map((e) => {
        if (e.day !== day || e.exerciseId !== exerciseId) return e;
        if (isNaN(num)) return e;
        if (field === 'weight') {
          const w = Math.max(0, Math.round(num * 2) / 2);
          return w === 0 ? { ...e, weight: undefined } : { ...e, weight: w };
        }
        return { ...e, [field]: Math.max(1, Math.round(num)) };
      }),
    });
    setEditKey(null);
  };

  const toggleDone = (exercise: WorkoutExercise) => {
    const existing = todayLogs.find((e) => e.exerciseId === exercise.exerciseId);
    if (existing) {
      removeExercise(existing.id);
      return;
    }
    addExercise({
      id: crypto.randomUUID(),
      exerciseId: exercise.exerciseId,
      exerciseName: exercise.exerciseName,
      sets: exercise.sets,
      reps: exercise.reps,
      ...(exercise.weight !== undefined ? { weight: exercise.weight } : {}),
      ...(exercise.duration !== undefined ? { duration: exercise.duration } : {}),
      loggedAt: new Date().toISOString(),
    });
  };

  const filteredExercises = useMemo(() => {
    return exercises.filter((e) => {
      if (location === 'gym') return e.equipment === 'gym' || e.equipment === 'none';
      return e.equipment === 'home' || e.equipment === 'none';
    });
  }, [location]);

  return (
    <DashboardLayout title="Weekly Plan" subtitle={plan ? plan.name : 'Generate a plan to get started'}>
      <div className="max-w-7xl mx-auto space-y-6 pb-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
          <div>
            <h1 className="text-2xl md:text-display-lg font-bold text-on-surface mb-1">
              Weekly Plan
            </h1>
            <p className="text-sm md:text-body-lg text-on-surface-variant">
              {plan ? plan.name : 'Generate a personalized plan based on your profile'}
            </p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={generatePlan}
              className="px-4 py-2 rounded-lg bg-primary text-on-primary text-label-md font-medium hover:bg-primary/90 transition-colors shadow-sm flex items-center gap-2"
            >
              <RefreshCw className="w-5 h-5" />
              {plan ? 'Regenerate' : 'Generate Plan'}
            </button>
            {plan && (
              <button
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2 rounded-lg bg-secondary text-on-secondary text-label-md font-medium hover:bg-secondary/90 transition-colors shadow-sm flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Add Exercise
              </button>
            )}
          </div>
        </div>

        {/* Plan Overview */}
        <div className="bg-surface rounded-xl border border-outline-variant shadow-[0_4px_15px_-3px_rgba(15,23,42,0.04)] overflow-hidden">
          <div className="px-5 py-4 border-b border-outline-variant/40 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Activity className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <h2 className="text-headline-md font-semibold text-on-surface truncate">Plan Overview</h2>
                  {plan && (
                    <span className="bg-primary text-on-primary px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-label-md text-on-surface-variant mt-0.5 truncate">
                  {plan ? plan.name : 'No plan generated yet'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={openSplitEditor}
                className="px-3 py-1.5 rounded-lg bg-surface-container text-on-surface text-label-md font-medium hover:bg-surface-container-high transition-colors border border-outline-variant/60 flex items-center gap-1.5"
              >
                <Settings className="w-4 h-4" />
                Edit Split
              </button>
            </div>
          </div>

          {/* Stat tiles */}
          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-outline-variant/40">
            <div className="px-5 py-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-secondary/10 flex items-center justify-center shrink-0">
                <TrendingUp className="w-4.5 h-4.5 text-secondary" />
              </div>
              <div className="min-w-0">
                <p className="text-label-sm text-on-surface-variant uppercase tracking-wide">Focus</p>
                <p className="text-body-md font-semibold text-on-surface truncate">
                  {profile.goal === 'lose' ? 'Fat Loss' : profile.goal === 'gain' ? 'Muscle Growth' : 'General Fitness'}
                </p>
              </div>
            </div>
            <div className="px-5 py-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <CalendarDays className="w-4.5 h-4.5 text-primary" />
              </div>
              <div>
                <p className="text-label-sm text-on-surface-variant uppercase tracking-wide">Frequency</p>
                <p className="text-body-md font-semibold text-on-surface">
                  {plan?.daysPerWeek || daysPerWeek} Days / Week
                </p>
              </div>
            </div>
            <div className="px-5 py-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-tertiary/10 flex items-center justify-center shrink-0">
                <Layers3 className="w-4.5 h-4.5 text-tertiary" />
              </div>
              <div className="min-w-0">
                <p className="text-label-sm text-on-surface-variant uppercase tracking-wide">Split</p>
                <p className="text-body-md font-semibold text-on-surface truncate">
                  {splitLabel(plan?.split, plan?.daysPerWeek || daysPerWeek)}
                </p>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="px-5 py-4 border-t border-outline-variant/40 bg-surface-container-low/50 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-label-md text-on-surface-variant">Days</span>
              <div className="flex bg-surface-container-highest rounded-lg p-1">
                {[2, 3, 4, 5, 6].map((n) => (
                  <button
                    key={n}
                    onClick={() => changeDaysPerWeek(n)}
                    className={`w-8 h-7 rounded-md text-label-md text-xs transition-all ${
                      daysPerWeek === n
                        ? 'bg-surface text-primary shadow-sm font-semibold'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-label-md text-on-surface-variant">Location</span>
              <div className="flex bg-surface-container-highest rounded-lg p-1">
                <button
                  onClick={() => setLocation('gym')}
                  className={`px-3 py-1 rounded-md text-label-md text-xs transition-all flex items-center gap-1 ${
                    location === 'gym'
                      ? 'bg-surface text-primary shadow-sm font-semibold'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  <MapPin className="w-3.5 h-3.5" />
                  Gym
                </button>
                <button
                  onClick={() => setLocation('home')}
                  className={`px-3 py-1 rounded-md text-label-md text-xs transition-all flex items-center gap-1 ${
                    location === 'home'
                      ? 'bg-surface text-primary shadow-sm font-semibold'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  <Home className="w-3.5 h-3.5" />
                  Home
                </button>
              </div>
            </div>
          </div>
        </div>

        {!plan ? (
          <div className="bg-surface rounded-xl border border-outline-variant p-12 text-center">
            <Dumbbell className="w-16 h-16 mx-auto text-outline mb-4" />
            <h3 className="text-headline-md font-semibold text-on-surface mb-2">
              No Workout Plan Yet
            </h3>
            <p className="text-body-md text-on-surface-variant mb-6 max-w-md mx-auto">
              Generate a personalized workout plan based on your profile, goals, and available equipment.
            </p>
            <button
              onClick={generatePlan}
              className="px-6 py-3 bg-primary text-on-primary rounded-lg text-label-md font-bold hover:bg-primary/90 transition-colors shadow-sm inline-flex items-center gap-2"
            >
              <RefreshCw className="w-5 h-5" />
              Generate Your Plan
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-12 gap-6">
            {/* Main Schedule */}
            <div className="col-span-12 lg:col-span-8 flex flex-col gap-4">
              {/* Day selector */}
              <div className="bg-surface rounded-xl border border-outline-variant shadow-[0_4px_15px_-3px_rgba(15,23,42,0.04)] p-3">
                <div className="flex items-center justify-between px-1 mb-2">
                  <span className="text-label-md text-on-surface-variant">Training days</span>
                  {planDays.some((d) => d.day === todayName) && (
                    <span className="text-label-md font-semibold text-primary flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block" />
                      Today
                    </span>
                  )}
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {planDays.map((d) => {
                    const active = d.day === selectedDayName;
                    return (
                      <button
                        key={d.day}
                        onClick={() => setSelectedDay(d.day)}
                        className={`shrink-0 min-h-[40px] px-3 py-2 rounded-lg text-left transition-all border ${
                          active
                            ? 'bg-primary text-on-primary border-primary shadow-sm'
                            : 'bg-surface-container-low text-on-surface border-outline-variant/50 hover:bg-surface-container'
                        }`}
                      >
                        <span className="flex items-center gap-1.5 text-label-md font-semibold leading-tight">
                          {d.day}
                          {d.day === todayName && !active && <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block" />}
                        </span>
                        <span
                          className={`block text-[10px] leading-tight truncate max-w-[100px] ${
                            active ? 'text-on-primary/80' : 'text-on-surface-variant'
                          }`}
                        >
                          {d.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Selected day */}
              {selectedPlan && (
                <div className="bg-surface rounded-xl border border-outline-variant shadow-[0_4px_15px_-3px_rgba(15,23,42,0.04)] p-4">
                  <div className="flex justify-between items-center pb-3 mb-4 border-b border-outline-variant/50">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 min-w-0">
                      <div className="w-3 h-3 rounded-full shrink-0 bg-primary" />
                      <h3 className="text-lg sm:text-headline-md font-semibold text-on-surface">
                        {selectedPlan.day}
                      </h3>
                      {selectedPlan.day === todayName && (
                        <span className="bg-primary text-on-primary px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">
                          Today
                        </span>
                      )}
                      <span className="bg-tertiary-container/20 text-tertiary-container px-2 py-0.5 rounded-full text-label-md text-xs">
                        {selectedPlan.label}
                      </span>
                      <span className="text-xs text-on-surface-variant">
                        {selectedPlan.exercises.length} exercises
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        if (!plan) return;
                        setWorkoutPlan({
                          ...plan,
                          exercises: plan.exercises.filter((e) => e.day !== selectedPlan.day),
                        });
                      }}
                      className="text-on-surface-variant hover:text-error transition-colors p-1 shrink-0"
                      title="Clear this day"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>

                  {selectedPlan.exercises.length === 0 ? (
                    <div className="py-8 text-center">
                      <p className="text-body-md text-on-surface-variant mb-4">No exercises on this day yet.</p>
                      <button
                        onClick={() => setShowAddModal(true)}
                        className="px-4 py-2 rounded-lg bg-secondary text-on-secondary text-label-md font-medium hover:bg-secondary/90 transition-colors shadow-sm inline-flex items-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        Add Exercise
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {selectedPlan.exercises.map((exercise) => {
                        const dbEx = exercises.find((e) => e.id === exercise.exerciseId);
                        const isDone = todayLogs.some((e) => e.exerciseId === exercise.exerciseId);
                        const rowKey = `${selectedPlan.day}:${exercise.exerciseId}`;
                        const editingField = editKey?.startsWith(rowKey) ? editKey.slice(rowKey.length + 1) : null;
                        const renderStat = (field: 'sets' | 'reps' | 'weight', value: number | undefined, label: string) => {
                          const key = `${rowKey}:${field}`;
                          if (editKey === key) {
                            return (
                              <div className="text-center">
                                <input
                                  type="number"
                                  step={field === 'weight' ? 0.5 : 1}
                                  min={field === 'weight' ? 0 : 1}
                                  value={editVal}
                                  onChange={(e) => setEditVal(e.target.value)}
                                  onBlur={() => commitEdit(selectedPlan.day, exercise.exerciseId, field)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') commitEdit(selectedPlan.day, exercise.exerciseId, field);
                                    if (e.key === 'Escape') setEditKey(null);
                                  }}
                                  autoFocus
                                  className="w-14 h-8 text-center text-lg font-bold text-on-surface bg-surface-container rounded border border-primary outline-none"
                                />
                                <div className="text-label-md text-on-surface-variant text-xs">{label}</div>
                              </div>
                            );
                          }
                          return (
                            <button
                              onClick={() => startEdit(key, value)}
                              className="text-center min-w-[44px] rounded hover:bg-surface-container px-1"
                              title={`Edit ${label.toLowerCase()}`}
                            >
                              <div className="text-stat-value text-xl sm:text-2xl text-on-surface font-bold">
                                {field === 'weight' ? (value !== undefined ? value : 'BW') : value}
                              </div>
                              <div className="text-label-md text-on-surface-variant text-xs">
                                {field === 'weight' ? 'kg' : label}
                              </div>
                            </button>
                          );
                        };
                        return (
                          <div
                            key={exercise.exerciseId}
                            className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg hover:bg-surface-container-lowest border transition-all gap-3 group/item ${
                              isDone ? 'border-primary/40 bg-primary/5' : 'border-transparent hover:border-outline-variant'
                            }`}
                          >
                            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                              <button
                                onClick={() => toggleDone(exercise)}
                                className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center shrink-0 transition-all ${
                                  isDone
                                    ? 'bg-primary text-on-primary'
                                    : 'bg-surface-container text-outline hover:bg-primary/10 hover:text-primary'
                                }`}
                                title={isDone ? 'Logged today — tap to undo' : 'Mark as done'}
                              >
                                <Check className="w-4 h-4 sm:w-5 sm:h-5" />
                              </button>
                              <div className="min-w-0">
                                <h4 className="text-body-md font-semibold truncate text-on-surface">
                                  {exercise.exerciseName}
                                </h4>
                                <p className="text-xs text-on-surface-variant truncate">
                                  {dbEx ? `${muscleLabels[dbEx.muscleGroup]} · ${dbEx.category}` : exercise.day}
                                  {isDone && <span className="text-primary font-semibold"> · Done today</span>}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-6 pt-2 sm:pt-0 border-t sm:border-t-0 border-outline-variant/30">
                              {renderStat('sets', exercise.sets, 'Sets')}
                              {renderStat('reps', exercise.reps, 'Reps')}
                              {renderStat('weight', exercise.weight, 'Weight')}
                              <div className="flex gap-1 opacity-80 sm:opacity-60 group-hover/item:opacity-100 transition-opacity">
                                <button
                                  onClick={() => removeExerciseFromDay(selectedPlan.day, exercise.exerciseId)}
                                  className="p-1 text-on-surface-variant hover:text-error"
                                >
                                  <Trash2 className="w-5 h-5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right Sidebar */}
            <div className="col-span-12 lg:col-span-4 flex flex-col gap-4">
              {/* Weekly Volume Stats */}
              <div className="bg-surface rounded-xl border border-outline-variant shadow-sm p-4 relative overflow-hidden">
                <div className="absolute -right-10 -top-10 w-32 h-32 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
                <h3 className="text-headline-md text-on-surface mb-4 text-lg">Weekly Volume</h3>
                <div className="space-y-3">
                  {weeklyVolume.map((item) => (
                    <div key={item.muscle}>
                      <div className="flex justify-between text-label-md mb-1">
                        <span className="text-on-surface-variant">{item.muscle}</span>
                        <span className="text-on-surface font-semibold">{item.sets} Sets</span>
                      </div>
                      <div className="w-full h-2 bg-surface-container rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${item.color}`}
                          style={{ width: `${item.pct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Progress Tracker */}
              <div className="bg-surface rounded-xl border border-outline-variant shadow-sm p-4 relative overflow-hidden">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-headline-md text-on-surface text-lg">Progress Tracker</h3>
                  <Activity className="w-5 h-5 text-primary" />
                </div>
                <div className="h-32 flex items-end gap-2 pt-4">
                  {progressData.map((item, index) => (
                    <div
                      key={item.week}
                      className={`flex-1 rounded-t-sm relative group cursor-pointer transition-colors ${
                        index === progressData.length - 1
                          ? 'bg-primary/80 hover:bg-primary'
                          : 'bg-surface-container hover:bg-surface-container-high'
                      }`}
                      style={{ height: item.height }}
                    >
                      <div className="absolute -top-7 left-1/2 -translate-x-1/2 text-label-md text-on-surface opacity-0 group-hover:opacity-100 transition-opacity bg-surface px-2 py-1 rounded shadow-sm border border-outline-variant/50 text-xs whitespace-nowrap">
                        {item.value} exercise{item.value === 1 ? '' : 's'}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between text-label-md text-on-surface-variant mt-2 text-xs px-2">
                  {progressData.map((item) => (
                    <span key={item.week}>{item.week}</span>
                  ))}
                </div>
                <div className="mt-3 text-center text-label-md text-on-surface-variant text-xs flex items-center justify-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-primary inline-block" />
                  Exercises Logged (total)
                </div>
              </div>

              {/* Workout Timer */}
              <WorkoutTimer />

              {/* Exercise Database Quick Access */}
              <div className="bg-surface rounded-xl border border-outline-variant shadow-sm p-4">
                <h3 className="text-headline-md text-on-surface mb-3 text-lg">Quick Add</h3>
                {planDays.length === 0 ? (
                  <p className="text-label-md text-on-surface-variant">
                    No training days yet — generate your plan first.
                  </p>
                ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {filteredExercises.slice(0, 8).map((ex) => (
                    <button
                      key={ex.id}
                      onClick={() => {
                        if (!plan || !selectedDayName) return;
                        addExerciseToDay(selectedDayName, ex.id);
                      }}
                      className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-surface-container-low transition-colors text-left"
                    >
                      <div>
                        <p className="text-body-sm font-medium text-on-surface">{ex.name}</p>
                        <p className="text-label-md text-on-surface-variant">{muscleLabels[ex.muscleGroup]} · {ex.difficulty}</p>
                      </div>
                      <Plus className="w-4 h-4 text-primary" />
                    </button>
                  ))}
                </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Split Editor Modal */}
        {showSplitModal && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 sm:p-4">
            <div className="bg-surface sm:rounded-2xl rounded-t-2xl shadow-xl w-full sm:max-w-2xl max-h-[90vh] sm:max-h-[85vh] overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 fade-in duration-200">
              {/* Header */}
              <div className="px-5 py-4 border-b border-outline-variant/50 flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Layers3 className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-headline-md font-semibold text-on-surface">Edit Day Splits</h3>
                    <p className="text-label-md text-on-surface-variant mt-0.5">
                      Choose muscle groups for each training day
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowSplitModal(false)}
                  className="p-2 rounded-lg hover:bg-surface-container transition-colors text-on-surface-variant"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Days per week */}
              <div className="px-5 py-3 border-b border-outline-variant/40 bg-surface-container-low/50 flex items-center justify-between">
                <span className="text-label-md font-medium text-on-surface-variant">Days per week</span>
                <div className="flex bg-surface-container-highest rounded-lg p-1">
                  {[2, 3, 4, 5, 6].map((n) => (
                    <button
                      key={n}
                      onClick={() => changeDaysPerWeek(n)}
                      className={`w-8 h-7 rounded-md text-label-md text-xs transition-all ${
                        daysPerWeek === n
                          ? 'bg-surface text-primary shadow-sm font-semibold'
                          : 'text-on-surface-variant hover:text-on-surface'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {/* Day cards */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {draftSplit.map((groups, dayIndex) => (
                  <div
                    key={dayIndex}
                    className="rounded-xl border border-outline-variant/50 overflow-hidden bg-surface-container-lowest"
                  >
                    <div className="flex items-center gap-3 px-4 py-3 bg-surface-container-low border-b border-outline-variant/40">
                      <div className="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center text-label-md font-bold shrink-0">
                        {dayIndex + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-body-md font-semibold text-on-surface">
                          {PLAN_DAY_NAMES[dayIndex]}
                        </p>
                        <p className="text-label-md text-on-surface-variant truncate">
                          {groups.map((g) => muscleLabels[g] || g).join(' + ') || 'Rest'}
                        </p>
                      </div>
                      <span className="text-label-sm text-on-surface-variant bg-surface-container rounded-full px-2 py-0.5 shrink-0">
                        {groups.length} {groups.length === 1 ? 'group' : 'groups'}
                      </span>
                    </div>
                    <div className="p-3 flex flex-wrap gap-2">
                      {MUSCLE_GROUP_OPTIONS.map((muscle) => {
                        const active = groups.includes(muscle);
                        return (
                          <button
                            key={muscle}
                            onClick={() => toggleMuscle(dayIndex, muscle)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 min-h-[32px] ${
                              active
                                ? 'bg-primary text-on-primary shadow-sm'
                                : 'bg-surface-container text-on-surface-variant hover:text-on-surface border border-outline-variant/60'
                            }`}
                          >
                            {active && <Check className="w-3.5 h-3.5" />}
                            {muscleLabels[muscle]}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-outline-variant/50 bg-surface flex gap-3">
                <button
                  onClick={() => setDraftSplit(getDefaultSplit(daysPerWeek))}
                  className="flex-1 h-11 rounded-xl text-label-md font-medium bg-surface-container text-on-surface hover:bg-surface-container-high transition-colors border border-outline-variant"
                >
                  Reset to Default
                </button>
                <button
                  onClick={generatePlan}
                  className="flex-1 h-11 rounded-xl text-label-md font-bold bg-primary text-on-primary hover:bg-primary/90 transition-colors shadow-sm flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Apply & Generate
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Exercise Modal */}
        {showAddModal && plan && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 sm:p-4">
            <div className="bg-surface sm:rounded-2xl rounded-t-2xl shadow-xl w-full sm:max-w-lg max-h-[85vh] sm:max-h-[80vh] overflow-hidden flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-outline-variant/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center">
                    <Plus className="w-5 h-5 text-secondary" />
                  </div>
                  <div>
                    <h3 className="text-headline-md font-semibold text-on-surface">Add Exercise</h3>
                    <p className="text-label-md text-on-surface-variant">Adds to {selectedDayName || 'selected day'}</p>
                  </div>
                </div>
                <button onClick={() => setShowAddModal(false)} className="p-2 rounded-lg hover:bg-surface-container transition-colors text-on-surface-variant">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4 border-b border-outline-variant flex gap-3">
                <input
                  type="text"
                  placeholder="Search exercises..."
                  onChange={(e) => {
                    const query = e.target.value.toLowerCase();
                    setSelectedExercise(query);
                  }}
                  className="flex-1 min-w-0 h-10 px-4 rounded-lg border border-outline-variant bg-surface-container-lowest text-body-md outline-none focus:border-primary"
                />
                <div className="relative w-20 sm:w-28 shrink-0">
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={addWeight}
                    onChange={(e) => setAddWeight(e.target.value)}
                    placeholder="0"
                    className="w-full h-10 px-3 pr-7 rounded-lg border border-outline-variant bg-surface-container-lowest text-body-md outline-none focus:border-primary"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-label-md text-on-surface-variant">kg</span>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {planDays.length === 0 ? (
                  <p className="text-body-md text-on-surface-variant text-center py-8">
                    No training days yet — generate your plan first.
                  </p>
                ) : (
                filteredExercises
                  .filter((ex) => !selectedExercise || ex.name.toLowerCase().includes(selectedExercise.toLowerCase()))
                  .map((ex) => (
                    <button
                      key={ex.id}
                      onClick={() => {
                        if (selectedDayName) {
                          addExerciseToDay(selectedDayName, ex.id);
                        }
                      }}
                      className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-surface-container-low transition-colors text-left border border-outline-variant/30"
                    >
                      <div>
                        <p className="text-body-md font-medium text-on-surface">{ex.name}</p>
                        <p className="text-label-md text-on-surface-variant">
                          {muscleLabels[ex.muscleGroup]} · {ex.category} · {ex.difficulty} · {ex.equipment}
                        </p>
                      </div>
                      <Plus className="w-5 h-5 text-primary" />
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
