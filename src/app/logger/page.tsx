'use client';

import DashboardLayout from '@/components/layout/DashboardLayout';
import {
  Plus,
  Droplets,
  Moon,
  Scale,
  TrendingUp,
  TrendingDown,
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

  const today = new Date().toISOString().split('T')[0];

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

  const todayTotalCalories = useMemo(() => {
    return sumMealNutrition(getMealsForDate(today)).calories;
  }, [meals, today]);

  return (
    <DashboardLayout title="Health Logger" subtitle="Track your daily health metrics">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Log */}
        <div className="lg:col-span-3 bg-surface rounded-xl border border-outline-variant p-6">
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

      </div>
    </DashboardLayout>
  );
}
