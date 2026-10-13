'use client';

import DashboardLayout from '@/components/layout/DashboardLayout';
import {
  Plus,
  Droplets,
  Moon,
  Scale,
  Check,
  Clock,
  TrendingUp,
  TrendingDown,
  Trash2,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useStore } from '@/lib/store-context';
import { sumMealNutrition } from '@/lib/calculations';

const habitCategories = [
  { id: 'water', name: 'Water Intake', icon: Droplets, color: '#0058be', unit: 'ml', target: 2500 },
  { id: 'sleep', name: 'Sleep', icon: Moon, color: '#006c49', unit: 'hrs', target: 8 },
  { id: 'weight', name: 'Weight', icon: Scale, color: '#f57c00', unit: 'kg', target: null },
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-surface-elevated p-3 rounded-lg shadow-elevated border border-outline-variant/20">
        <p className="text-sm font-medium text-on-surface mb-1">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-xs text-on-surface-variant">
            <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: entry.color }} />
            {entry.name}: {entry.value.toLocaleString()} {entry.name === 'water' ? 'ml' : entry.name === 'sleep' ? 'hrs' : entry.name === 'weight' ? 'kg' : entry.name === 'heartRate' ? 'bpm' : entry.name === 'steps' ? '' : 'kcal'}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function LoggerPage() {
  const {
    habits,
    addHabit,
    removeHabit,
    toggleHabitDate,
    bodyMetrics,
    addBodyMetric,
    meals,
    getMealsForDate,
    profile,
    waterLogs,
    addWater,
    getWaterForDate,
    addSleep,
    getSleepForDate,
    sleepLogs,
    calculations,
  } = useStore();

  const [selectedHabit, setSelectedHabit] = useState('water');
  const [logValue, setLogValue] = useState('');
  const [newHabitName, setNewHabitName] = useState('');
  const [showAddHabit, setShowAddHabit] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  const todayHabits = useMemo(() => {
    if (habits.length === 0) return [];
    return habits.map((h) => ({
      ...h,
      completed: h.completedDates.includes(today),
    }));
  }, [habits, today]);

  const completedHabits = todayHabits.filter((h) => h.completed).length;
  const totalHabits = todayHabits.length;

  const waterTargetMl = Math.round((calculations?.hydration || 2.5) * 1000);
  const calorieGoal = calculations?.targetCalories || 0;

  const weeklyData = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const result = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayMeals = getMealsForDate(dateStr);
      const metric = bodyMetrics.find((m) => m.date === dateStr);
      const dayWater = waterLogs.filter(w => w.date === dateStr).reduce((sum, w) => sum + w.amount, 0);
      result.push({
        day: days[d.getDay()],
        water: dayWater || 0,
        sleep: getSleepForDate(dateStr) || 0,
        weight: metric?.weight || 0,
        calories: sumMealNutrition(dayMeals).calories,
      });
    }
    return result;
  }, [meals, bodyMetrics, waterLogs, sleepLogs]);

  const latestMetric = bodyMetrics.length > 0
    ? [...bodyMetrics].sort((a, b) => b.date.localeCompare(a.date))[0]
    : null;

  const weightChartData = useMemo(() => {
    return [...bodyMetrics]
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-14)
      .map((m) => ({
        date: new Date(m.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        weight: m.weight,
      }));
  }, [bodyMetrics]);

  const bodyMetricHistory = useMemo(() => {
    return [...bodyMetrics]
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-7)
      .map((m) => ({
        date: m.date,
        weight: m.weight,
      }));
  }, [bodyMetrics]);

  const handleLog = () => {
    if (!logValue) return;
    const value = parseFloat(logValue);
    if (isNaN(value)) return;

    if (selectedHabit === 'weight') {
      addBodyMetric({
        date: today,
        weight: value,
        height: profile.height || 0,
      });
    } else if (selectedHabit === 'water') {
      addWater(value);
    } else if (selectedHabit === 'sleep') {
      addSleep(value);
    }

    setLogValue('');
  };

  const addNewHabit = () => {
    if (!newHabitName.trim()) return;
    addHabit({
      id: crypto.randomUUID(),
      name: newHabitName.trim(),
      frequency: 'daily',
      completedDates: [],
    });
    setNewHabitName('');
    setShowAddHabit(false);
  };

  const todayTotalCalories = useMemo(() => {
    return sumMealNutrition(getMealsForDate(today)).calories;
  }, [meals, today]);

  return (
    <DashboardLayout title="Logger Hub" subtitle="Track your daily habits and body metrics">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Log */}
        <div className="lg:col-span-2 bg-surface rounded-xl border border-outline-variant p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-headline-md font-semibold text-on-surface">Quick Log</h2>
            <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-label-md font-bold">Today</span>
          </div>

          {/* Category Tabs */}
          <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar pb-2">
            {habitCategories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedHabit(cat.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-all ${
                  selectedHabit === cat.id
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                <cat.icon className="w-4 h-4" />
                <span className="text-sm font-medium">{cat.name}</span>
              </button>
            ))}
          </div>

          {/* Log Input */}
          <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="flex-1">
              <label className="block text-label-md text-on-surface-variant mb-1.5">
                Enter {habitCategories.find((c) => c.id === selectedHabit)?.name}
              </label>
              <input
                type="number"
                value={logValue}
                onChange={(e) => setLogValue(e.target.value)}
                placeholder={`Enter value in ${habitCategories.find((c) => c.id === selectedHabit)?.unit}`}
                className="w-full h-12 px-4 rounded-lg border border-outline-variant bg-surface text-body-md text-on-surface focus:border-secondary focus:ring-2 focus:ring-secondary/20 transition-all outline-none"
              />
            </div>
            <button
              onClick={handleLog}
              className="h-12 px-6 bg-primary text-on-primary rounded-lg text-label-md font-bold hover:bg-primary/90 transition-all shadow-sm flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Log
            </button>
          </div>

          {/* Today's Progress */}
          <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-3">
            {habitCategories.map((cat) => {
              const target = cat.id === 'water' ? waterTargetMl : cat.target;
              const todayWater = getWaterForDate(today);
              const current = cat.id === 'water' ? todayWater
                : cat.id === 'sleep' ? getSleepForDate(today)
                : cat.id === 'weight' ? (latestMetric?.weight || 0)
                : 0;
              const percentage = target ? Math.min((current / target) * 100, 100) : 0;

              return (
                <div key={cat.id} className="p-3 bg-surface-container rounded-lg min-w-0 overflow-hidden">
                  <div className="flex items-center gap-1.5 mb-1.5 min-w-0">
                    <cat.icon className="w-4 h-4 shrink-0" style={{ color: cat.color }} />
                    <span className="text-xs text-on-surface-variant truncate">{cat.name}</span>
                  </div>
                  <p className="text-sm sm:text-base font-bold text-on-surface truncate">
                    {typeof current === 'number' && current % 1 !== 0 ? current.toFixed(1) : current.toLocaleString()}
                    <span className="text-xs font-normal ml-1 text-on-surface-variant">{cat.unit}</span>
                  </p>
                  {target && (
                    <div className="mt-2 h-1.5 bg-surface rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%`, backgroundColor: cat.color }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Today's Calories Summary */}
          <div className="mt-4 p-3 bg-primary/5 border border-primary/20 rounded-lg">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1">
              <span className="text-xs sm:text-label-md text-on-surface-variant">Today&apos;s Calories Logged</span>
              <span className="text-lg sm:text-headline-md font-bold text-primary">{todayTotalCalories.toLocaleString()} kcal</span>
            </div>
          </div>
        </div>

        {/* Today's Habits */}
        <div className="bg-surface rounded-xl border border-outline-variant p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-headline-md font-semibold text-on-surface">Today&apos;s Habits</h2>
            <span className="text-sm text-on-surface-variant">{completedHabits}/{totalHabits}</span>
          </div>
          {totalHabits > 0 && (
            <div className="h-2 bg-surface-container rounded-full overflow-hidden mb-4">
              <div
                className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full transition-all duration-500"
                style={{ width: `${(completedHabits / totalHabits) * 100}%` }}
              />
            </div>
          )}
          <div className="space-y-2">
            {todayHabits.length === 0 ? (
              <p className="text-label-md text-on-surface-variant py-4 text-center italic">
                No habits yet. Add one below!
              </p>
            ) : (
              todayHabits.map((habit) => (
                <div
                  key={habit.id}
                  onClick={() => toggleHabitDate(habit.id, today)}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-lg transition-colors text-left min-w-0 cursor-pointer ${
                    habit.completed ? 'bg-primary/5' : 'hover:bg-surface-container'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors shrink-0 ${
                    habit.completed
                      ? 'bg-primary border-primary text-white'
                      : 'border-outline-variant hover:border-primary'
                  }`}>
                    {habit.completed && <Check className="w-3 h-3" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${habit.completed ? 'text-on-surface-variant line-through' : 'text-on-surface'}`}>
                      {habit.name}
                    </p>
                    <p className="text-xs text-on-surface-variant flex items-center gap-1">
                      <Clock className="w-3 h-3 shrink-0" /> {habit.frequency}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeHabit(habit.id);
                    }}
                    className="text-outline hover:text-error opacity-60 hover:opacity-100 transition-opacity shrink-0 p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Add Habit */}
          {showAddHabit ? (
            <div className="mt-4 p-3 bg-surface-container rounded-lg">
              <input
                type="text"
                value={newHabitName}
                onChange={(e) => setNewHabitName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addNewHabit()}
                placeholder="Habit name (e.g., Meditation)"
                className="w-full h-10 px-3 rounded-lg border border-outline-variant bg-surface text-body-md outline-none focus:border-primary mb-2"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={addNewHabit}
                  className="flex-1 h-9 bg-primary text-on-primary rounded-lg text-label-md font-bold hover:bg-primary/90 transition-colors"
                >
                  Add
                </button>
                <button
                  onClick={() => { setShowAddHabit(false); setNewHabitName(''); }}
                  className="flex-1 h-9 bg-surface-container text-on-surface-variant rounded-lg text-label-md hover:bg-surface-container-high transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAddHabit(true)}
              className="w-full mt-4 py-2.5 border border-dashed border-outline rounded-lg text-label-md text-on-surface-variant hover:bg-surface-container transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Habit
            </button>
          )}
        </div>

        {/* Weight Tracking Line Chart */}
        <div className="lg:col-span-2 bg-surface rounded-xl border border-outline-variant p-4 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-headline-md font-semibold text-on-surface">Weight Trend</h2>
            {bodyMetricHistory.length >= 2 && (
              <div className={`flex items-center gap-1 text-sm ${bodyMetricHistory[bodyMetricHistory.length - 1].weight < bodyMetricHistory[0].weight ? 'text-success' : 'text-error'}`}>
                {bodyMetricHistory[bodyMetricHistory.length - 1].weight < bodyMetricHistory[0].weight
                  ? <TrendingDown className="w-4 h-4" />
                  : <TrendingUp className="w-4 h-4" />
                }
                <span>
                  {(bodyMetricHistory[bodyMetricHistory.length - 1].weight - bodyMetricHistory[0].weight).toFixed(1)} kg
                </span>
              </div>
            )}
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={bodyMetricHistory.length > 0 ? bodyMetricHistory : [{ date: '', weight: 0 }]} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" vertical={false} />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b6b6b' }} />
                <YAxis domain={['dataMin - 1', 'dataMax + 1']} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b6b6b' }} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="weight" stroke="#f57c00" strokeWidth={2.5} dot={bodyMetricHistory.length > 0 ? { fill: '#f57c00', strokeWidth: 2, r: 4 } : false} activeDot={{ r: 6 }} name="weight" strokeDasharray={bodyMetricHistory.length === 0 ? '5 5' : undefined} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Water Intake Bar Chart */}
        <div className="bg-surface rounded-xl border border-outline-variant p-4 md:p-6">
          <h2 className="text-headline-md font-semibold text-on-surface mb-4">Water Intake</h2>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6b6b6b' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6b6b6b' }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="water" fill="#0058be" radius={[4, 4, 0, 0]} name="water" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap items-center justify-between mt-2 text-xs text-on-surface-variant gap-1">
            <span>Goal: {waterTargetMl.toLocaleString()} ml</span>
            <span>Avg: {Math.round(weeklyData.reduce((sum, d) => sum + d.water, 0) / 7).toLocaleString()} ml</span>
          </div>
        </div>

        {/* Sleep Tracking Area Chart */}
        <div className="lg:col-span-2 bg-surface rounded-xl border border-outline-variant p-4 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-headline-md font-semibold text-on-surface">Sleep Tracking</h2>
            <div className="flex items-center gap-1 text-sm text-primary">
              <Moon className="w-4 h-4" />
              <span>Avg: {(weeklyData.reduce((sum, d) => sum + d.sleep, 0) / weeklyData.length).toFixed(1)} hrs</span>
            </div>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weeklyData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="sleepGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#006c49" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#006c49" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" vertical={false} />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b6b6b' }} />
                <YAxis domain={[5, 10]} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b6b6b' }} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="sleep" stroke="#006c49" strokeWidth={2.5} fill="url(#sleepGradient)" name="sleep" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Calories Chart */}
        <div className="bg-surface rounded-xl border border-outline-variant p-4 md:p-6">
          <h2 className="text-headline-md font-semibold text-on-surface mb-4">Calories</h2>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6b6b6b' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6b6b6b' }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="calories" fill="#e53935" radius={[4, 4, 0, 0]} name="calories" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap items-center justify-between mt-2 text-xs text-on-surface-variant gap-1">
            <span>Goal: {calorieGoal.toLocaleString()} kcal</span>
            <span>Avg: {Math.round(weeklyData.reduce((sum, d) => sum + d.calories, 0) / weeklyData.length).toLocaleString()} kcal</span>
          </div>
        </div>

        {/* Habit Consistency - LeetCode Calendar */}
        <div className="lg:col-span-3 bg-surface rounded-xl border border-outline-variant p-5 md:p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-headline-md font-semibold text-on-surface">Habit Consistency</h2>
            <div className="flex items-center gap-1.5 text-[10px] text-on-surface-variant">
              <span>Less</span>
              <div className="w-3 h-3 rounded bg-surface-container-high" />
              <div className="w-3 h-3 rounded bg-primary/20" />
              <div className="w-3 h-3 rounded bg-primary/50" />
              <div className="w-3 h-3 rounded bg-primary/80" />
              <div className="w-3 h-3 rounded bg-primary" />
              <span>More</span>
            </div>
          </div>
          {habits.length === 0 ? (
            <p className="text-sm text-on-surface-variant text-center py-10 italic">Add habits above to track consistency</p>
          ) : (
            <div>
              {/* Calendar Grid */}
              <div className="overflow-x-auto no-scrollbar pb-2">
                {(() => {
                  const today = new Date();
                  const startDay = today.getDay();
                  const totalWeeks = 22;
                  const weeks: { date: Date; dateStr: string; count: number }[][] = [];
                  let currentWeek: { date: Date; dateStr: string; count: number }[] = [];

                  const dateCountMap: Record<string, number> = {};
                  habits.forEach(h => {
                    h.completedDates.forEach(d => {
                      dateCountMap[d] = (dateCountMap[d] || 0) + 1;
                    });
                  });

                  const totalDays = totalWeeks * 7 + startDay;
                  for (let i = totalDays; i >= 0; i--) {
                    const d = new Date(today);
                    d.setDate(today.getDate() - i);
                    const ds = d.toISOString().split('T')[0];
                    const count = dateCountMap[ds] || 0;
                    currentWeek.push({ date: d, dateStr: ds, count });
                    if (currentWeek.length === 7) {
                      weeks.push(currentWeek);
                      currentWeek = [];
                    }
                  }
                  if (currentWeek.length > 0) weeks.push(currentWeek);

                  const monthLabels: { week: number; label: string }[] = [];
                  let lastMonth = -1;
                  weeks.forEach((week, wi) => {
                    const m = week[0]?.date.getMonth();
                    if (m !== undefined && m !== lastMonth) {
                      monthLabels.push({ week: wi, label: week[0].date.toLocaleDateString('en', { month: 'short' }) });
                      lastMonth = m;
                    }
                  });

                  const getBg = (count: number) => {
                    if (count === 0) return 'bg-surface-container-high';
                    const total = habits.length;
                    const ratio = count / total;
                    if (ratio <= 0.25) return 'bg-primary/20';
                    if (ratio <= 0.5) return 'bg-primary/50';
                    if (ratio <= 0.75) return 'bg-primary/80';
                    return 'bg-primary';
                  };

                  return (
                    <div className="min-w-max">
                      {/* Month labels row */}
                      <div className="flex ml-[42px] mb-1">
                        {monthLabels.map((ml, i) => (
                          <div
                            key={i}
                            className="text-[10px] text-on-surface-variant font-medium"
                            style={{ width: `${ml.week * 22}px`, flexShrink: 0 }}
                          >
                            {ml.label}
                          </div>
                        ))}
                      </div>
                      {/* Grid row: day labels + cells */}
                      <div className="flex gap-[6px]">
                        <div className="flex flex-col gap-[5px] mr-1.5">
                          {['Mon', '', 'Wed', '', 'Fri', '', ''].map((day, i) => (
                            <div key={i} className="h-4 text-[10px] text-on-surface-variant flex items-center font-medium">{day}</div>
                          ))}
                        </div>
                        <div className="flex gap-[6px]">
                          {weeks.map((week, wi) => (
                            <div key={wi} className="flex flex-col gap-[6px]">
                              {week.map((day, di) => (
                                <div
                                  key={di}
                                  className={`w-4 h-4 rounded-[3px] ${getBg(day.count)} transition-colors cursor-default`}
                                  title={`${day.dateStr}: ${day.count}/${habits.length} habits`}
                                />
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Habit Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mt-5 pt-4 border-t border-outline-variant/30">
                {habits.map(h => {
                  let streak = 0;
                  const today = new Date();
                  for (let d = 0; d < 365; d++) {
                    const dateStr = new Date(today);
                    dateStr.setDate(today.getDate() - d);
                    const ds = dateStr.toISOString().split('T')[0];
                    if (h.completedDates.includes(ds)) streak++;
                    else break;
                  }
                  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
                  const completedThisMonth = h.completedDates.filter(d => {
                    const dt = new Date(d);
                    return dt.getMonth() === today.getMonth() && dt.getFullYear() === today.getFullYear();
                  }).length;
                  const level = streak >= 30 ? '🔥' : streak >= 7 ? '⭐' : streak >= 3 ? '✅' : '○';

                  return (
                    <div key={h.id} className="bg-surface-container rounded-lg p-3 border border-outline-variant/30">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm">{level}</span>
                          <span className="text-xs font-semibold text-on-surface truncate">{h.name}</span>
                        </div>
                        <span className={`text-xs font-bold ${streak >= 7 ? 'text-primary' : 'text-on-surface-variant'}`}>{streak}d</span>
                      </div>
                      <div className="w-full bg-surface rounded-full h-1.5">
                        <div className="bg-primary h-1.5 rounded-full transition-all" style={{ width: `${Math.min((completedThisMonth / daysInMonth) * 100, 100)}%` }} />
                      </div>
                      <p className="text-[10px] text-on-surface-variant mt-1.5">{completedThisMonth}/{daysInMonth} days this month</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

      </div>
    </DashboardLayout>
  );
}
