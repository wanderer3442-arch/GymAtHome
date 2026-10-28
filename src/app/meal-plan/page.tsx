'use client';

import DashboardLayout from '@/components/layout/DashboardLayout';
import Link from 'next/link';
import { useState, useMemo } from 'react';
import { Check, Sun, CloudSun, Moon, ChevronLeft, ChevronRight, UtensilsCrossed } from 'lucide-react';
import { useStore } from '@/lib/store-context';
import { sumMealNutrition, getFoodById } from '@/lib/calculations';
import { localDateKey } from '@/lib/date';
import { DayFoodIntake } from '@/lib/types';

function CalorieRing({ consumed, target }: { consumed: number; target: number }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const progress = target > 0 ? Math.min(consumed / target, 1) : 0;
  const offset = circumference * (1 - progress);

  return (
    <div className="relative w-40 h-40 flex items-center justify-center shrink-0">
      <svg className="w-full h-full" viewBox="0 0 120 120">
        <circle className="text-surface-variant stroke-current" cx="60" cy="60" fill="transparent" r={radius} strokeWidth="8" />
        <circle className="text-primary stroke-current" cx="60" cy="60" fill="transparent" r={radius} strokeWidth="8" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" transform="rotate(-90 60 60)" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-headline-lg font-bold text-on-surface">{Math.round(consumed)}</span>
        <span className="text-label-md text-on-surface-variant">/ {target}</span>
        <span className="text-label-sm text-on-surface-variant">kcal</span>
      </div>
    </div>
  );
}

function MacroBar({ label, current, target, color }: { label: string; current: number; target: number; color: string }) {
  const pct = target > 0 ? Math.min((current / target) * 100, 100) : 0;
  return (
    <div className="space-y-1 min-w-0">
      <div className="flex justify-between gap-2 text-label-md min-w-0">
        <span className="text-on-surface-variant shrink-0">{label}</span>
        <span className="text-on-surface font-semibold truncate text-right">{current}g / {target}g</span>
      </div>
      <div className="h-2 bg-surface-variant rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

const mealTypeIcons: Record<string, { icon: React.ReactNode; color: string }> = {
  breakfast: { icon: <Sun className="w-5 h-5" />, color: 'text-tertiary' },
  lunch: { icon: <CloudSun className="w-5 h-5" />, color: 'text-secondary' },
  dinner: { icon: <Moon className="w-5 h-5" />, color: 'text-primary' },
};

const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

export default function MealPlanPage() {
  const { calculations, foodPreferences, addMeal, meals, getMealsForDate } = useStore();
  const [weekOffset, setWeekOffset] = useState(0);

  const today = localDateKey();
  const todayDayIdx = new Date().getDay();
  const todayDayKey = dayKeys[todayDayIdx];

  const todayPrefs = useMemo(() => {
    const prefs = foodPreferences[todayDayKey];
    if (Array.isArray(prefs)) return { breakfast: [], lunch: [], dinner: [] } as DayFoodIntake;
    return (prefs || { breakfast: [], lunch: [], dinner: [] }) as DayFoodIntake;
  }, [foodPreferences, todayDayKey]);

  const todayLoggedMeals = useMemo(() => getMealsForDate(today), [meals, today]);

  const loggedSet = useMemo(() => {
    const set = new Set<string>();
    todayLoggedMeals.forEach((m: any) => {
      set.add(`${m.mealType}::${m.foodName}`);
    });
    return set;
  }, [todayLoggedMeals]);

  const handleTick = (mealType: 'breakfast' | 'lunch' | 'dinner', item: any) => {
    const key = `${mealType}::${item.foodName || item.name}`;
    if (loggedSet.has(key)) return;
    addMeal({
      id: crypto.randomUUID(),
      foodId: item.foodId || '',
      foodName: item.foodName || item.name,
      servingSize: typeof item.servingSize === 'string'
        ? { label: item.servingSize, amount: 100, unit: 'g' }
        : item.servingSize || { label: '1 serving', amount: 100, unit: 'g' },
      quantity: 1,
      mealType,
      loggedAt: new Date().toISOString(),
    });
  };

  const plannedTotals = useMemo(() => {
    let calories = 0, protein = 0, carbs = 0, fat = 0;
    const all = [
      ...(todayPrefs.breakfast || []),
      ...(todayPrefs.lunch || []),
      ...(todayPrefs.dinner || []),
    ];
    all.forEach((item: any) => {
      calories += item.calories || 0;
      protein += item.protein || 0;
      carbs += item.carbs || 0;
      fat += item.fat || 0;
    });
    return { calories, protein, carbs, fat };
  }, [todayPrefs]);

  const eatenTotals = useMemo(() => {
    const logged = sumMealNutrition(todayLoggedMeals);
    let calories = logged.calories, protein = logged.protein, carbs = logged.carbs, fat = logged.fat;
    const types: Array<'breakfast' | 'lunch' | 'dinner'> = ['breakfast', 'lunch', 'dinner'];
    types.forEach((type) => {
      const items = (todayPrefs[type] || []) as any[];
      items.forEach((item: any) => {
        const key = `${type}::${item.foodName || item.name}`;
        const fid = item.foodId || '';
        if (loggedSet.has(key) && !(fid && getFoodById(fid))) {
          calories += item.calories || 0;
          protein += item.protein || 0;
          carbs += item.carbs || 0;
          fat += item.fat || 0;
        }
      });
    });
    return { calories, protein, carbs, fat };
  }, [todayPrefs, loggedSet, todayLoggedMeals]);

  const targetCals = calculations?.targetCalories || 0;
  const targetProtein = calculations?.protein || 0;
  const targetCarbs = calculations?.carbs || 0;
  const targetFat = calculations?.fat || 0;

  const totalPlannedItems = (todayPrefs.breakfast?.length || 0) + (todayPrefs.lunch?.length || 0) + (todayPrefs.dinner?.length || 0);
  const totalEatenItems = useMemo(() => {
    let count = 0;
    const types: Array<'breakfast' | 'lunch' | 'dinner'> = ['breakfast', 'lunch', 'dinner'];
    types.forEach((type) => {
      const items = (todayPrefs[type] || []) as any[];
      items.forEach((item: any) => {
        const key = `${type}::${item.foodName || item.name}`;
        if (loggedSet.has(key)) count++;
      });
    });
    return count;
  }, [todayPrefs, loggedSet]);

  const mealSections = useMemo(() => {
    const types: Array<'breakfast' | 'lunch' | 'dinner'> = ['breakfast', 'lunch', 'dinner'];
    return types.map((type) => {
      const items = (todayPrefs[type] || []) as any[];
      const totalCals = items.reduce((s: number, f: any) => s + (f.calories || 0), 0);
      const eatenCals = items.reduce((s: number, f: any) => {
        const key = `${type}::${f.foodName || f.name}`;
        return loggedSet.has(key) ? s + (f.calories || 0) : s;
      }, 0);
      return {
        id: type,
        label: type.charAt(0).toUpperCase() + type.slice(1),
        icon: mealTypeIcons[type]?.icon,
        iconColor: mealTypeIcons[type]?.color || 'text-on-surface',
        items,
        totalCalories: totalCals,
        eatenCalories: eatenCals,
        eatenCount: items.filter((f: any) => loggedSet.has(`${type}::${f.foodName || f.name}`)).length,
      };
    });
  }, [todayPrefs, loggedSet]);

  const weekDays = useMemo(() => {
    const days = [];
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay() + (weekOffset * 7));
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      const dayIdx = d.getDay();
      const key = dayKeys[dayIdx];
      const prefsRaw = foodPreferences[key];
      const prefs = Array.isArray(prefsRaw) ? { breakfast: [], lunch: [], dinner: [] } : (prefsRaw || { breakfast: [], lunch: [], dinner: [] });
      const bCals = (prefs.breakfast || []).reduce((s: number, f: any) => s + (f.calories || 0), 0);
      const lCals = (prefs.lunch || []).reduce((s: number, f: any) => s + (f.calories || 0), 0);
      const dCals = (prefs.dinner || []).reduce((s: number, f: any) => s + (f.calories || 0), 0);
      const totalCals = bCals + lCals + dCals;
      days.push({
        dayIdx,
        dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNum: d.getDate(),
        isToday: localDateKey(d) === today,
        totalCalories: totalCals,
        hasBreakfast: (prefs.breakfast?.length || 0) > 0,
        hasLunch: (prefs.lunch?.length || 0) > 0,
        hasDinner: (prefs.dinner?.length || 0) > 0,
      });
    }
    return days;
  }, [foodPreferences, weekOffset, today]);

  return (
    <DashboardLayout title="Meal Plan" subtitle={totalPlannedItems > 0 ? `${totalPlannedItems} foods planned today` : 'Set up your weekly meal plan to get started'}>
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">

        {/* Header — mirrors the exercise plan page */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
          <div>
            <h1 className="text-2xl md:text-display-lg font-bold text-on-surface mb-1">
              Meal Plan
            </h1>
            <p className="text-sm md:text-body-lg text-on-surface-variant">
              {totalPlannedItems > 0
                ? `${totalPlannedItems} foods planned for today — tap to mark what you eat`
                : 'Set up your weekly meals based on your goals and preferences'}
            </p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <Link
              href="/food-intake"
              className="px-4 py-2 rounded-lg bg-primary text-on-primary text-label-md font-medium hover:bg-primary/90 transition-colors shadow-sm flex items-center gap-2"
            >
              <UtensilsCrossed className="w-5 h-5" />
              {totalPlannedItems > 0 ? 'Edit Meal Plan' : 'Set Up Meal Plan'}
            </Link>
          </div>
        </div>

        {/* Row 1: Overview — full width */}
        <section className="bg-surface rounded-xl p-6 shadow-elevated border border-outline-variant">
          <div className="flex flex-col lg:flex-row items-center gap-6">
            {/* Calorie Ring */}
            <div className="flex flex-col items-center shrink-0">
              <CalorieRing consumed={eatenTotals.calories} target={targetCals} />
              <p className="text-label-md text-on-surface-variant mt-2">
                {totalEatenItems} / {totalPlannedItems} foods eaten
              </p>
            </div>

            {/* Macro Bars */}
            <div className="flex-1 w-full min-w-0 space-y-3">
              <MacroBar label="Protein" current={Math.round(eatenTotals.protein)} target={targetProtein} color="bg-tertiary" />
              <MacroBar label="Carbs" current={Math.round(eatenTotals.carbs)} target={targetCarbs} color="bg-secondary" />
              <MacroBar label="Fat" current={Math.round(eatenTotals.fat)} target={targetFat} color="bg-primary" />
            </div>

            {/* Planned vs Remaining */}
            <div className="flex justify-around w-full lg:w-auto gap-6 text-label-md border-t lg:border-t-0 pt-4 lg:pt-0 shrink-0">
              <div className="space-y-1">
                <p className="font-semibold text-on-surface">Planned</p>
                <p className="text-on-surface-variant whitespace-nowrap">{Math.round(plannedTotals.calories)} kcal</p>
                <p className="text-on-surface-variant whitespace-nowrap">{Math.round(plannedTotals.protein)}g P</p>
                <p className="text-on-surface-variant whitespace-nowrap">{Math.round(plannedTotals.carbs)}g C</p>
                <p className="text-on-surface-variant whitespace-nowrap">{Math.round(plannedTotals.fat)}g F</p>
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-primary">Remaining</p>
                <p className="text-primary font-semibold whitespace-nowrap">{Math.max(0, targetCals - Math.round(eatenTotals.calories))} kcal</p>
                <p className="text-on-surface-variant whitespace-nowrap">{Math.max(0, targetProtein - Math.round(eatenTotals.protein))}g P</p>
                <p className="text-on-surface-variant whitespace-nowrap">{Math.max(0, targetCarbs - Math.round(eatenTotals.carbs))}g C</p>
                <p className="text-on-surface-variant whitespace-nowrap">{Math.max(0, targetFat - Math.round(eatenTotals.fat))}g F</p>
              </div>
            </div>
          </div>
        </section>

        {/* Row 2: Meal sections — full width, 3 columns on desktop */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {mealSections.map((section) => (
            <div key={section.id} className="bg-surface rounded-xl p-4 shadow-elevated border border-outline-variant overflow-hidden">
              <div className="flex items-center justify-between mb-4 gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`shrink-0 ${section.iconColor}`}>{section.icon}</span>
                  <h4 className="text-base sm:text-headline-sm font-semibold text-on-surface truncate">{section.label}</h4>
                  {section.items.length > 0 && (
                    <span className="text-xs sm:text-label-sm text-on-surface-variant shrink-0">
                      ({section.eatenCount}/{section.items.length})
                    </span>
                  )}
                </div>
                <span className="text-xs sm:text-body-md font-semibold text-on-surface-variant shrink-0 whitespace-nowrap">
                  {section.eatenCalories}/{section.totalCalories} kcal
                </span>
              </div>
              <div className="space-y-1 max-h-[300px] overflow-y-auto">
                {section.items.length === 0 ? (
                  <p className="text-label-md text-on-surface-variant py-3 italic">No foods planned</p>
                ) : (
                  section.items.map((item: any, idx: number) => {
                    const key = `${section.id}::${item.foodName || item.name}`;
                    const isEaten = loggedSet.has(key);
                    return (
                      <button
                        key={idx}
                        onClick={() => handleTick(section.id as any, item)}
                        className={`w-full flex items-center justify-between py-2.5 px-3 rounded-lg transition-all gap-2 ${
                          isEaten ? 'bg-primary/10 border border-primary/30' : 'hover:bg-surface-container-low border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ${
                            isEaten ? 'bg-primary border-primary' : 'border-outline-variant'
                          }`}>
                            {isEaten && <Check className="w-3.5 h-3.5 text-on-primary" />}
                          </div>
                          <div className="text-left min-w-0 flex-1">
                            <p className={`text-xs sm:text-body-md font-medium truncate ${isEaten ? 'text-on-surface font-semibold' : 'text-on-surface-variant'}`}>
                              {item.foodName || item.name}
                            </p>
                            <p className="text-[11px] sm:text-label-md text-on-surface-variant/80 truncate">
                              {typeof item.servingSize === 'string' ? item.servingSize : item.servingSize?.label || '1 serving'}
                            </p>
                          </div>
                        </div>
                        <span className={`text-xs sm:text-body-md font-bold shrink-0 ml-1 ${isEaten ? 'text-primary' : 'text-on-surface-variant'}`}>
                          {item.calories} kcal
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Row 3: Weekly Calendar — full width */}
        <section className="bg-surface rounded-xl p-6 shadow-elevated border border-outline-variant">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-headline-md font-semibold text-on-surface">Weekly Plan</h3>
            <div className="flex items-center gap-2">
              <button onClick={() => setWeekOffset(weekOffset - 1)} className="p-2 hover:bg-surface-container rounded-lg">
                <ChevronLeft className="w-5 h-5 text-on-surface-variant" />
              </button>
              <span className="text-label-md text-on-surface-variant min-w-[100px] text-center">
                {weekOffset === 0 ? 'This Week' : weekOffset > 0 ? `+${weekOffset} week` : `${weekOffset} week`}
              </span>
              <button onClick={() => setWeekOffset(weekOffset + 1)} className="p-2 hover:bg-surface-container rounded-lg">
                <ChevronRight className="w-5 h-5 text-on-surface-variant" />
              </button>
            </div>
          </div>
          <div className="overflow-x-auto -mx-2 px-2">
            <div className="grid grid-cols-7 gap-2 min-w-[560px]">
            {weekDays.map((day) => (
              <div
                key={day.dayIdx}
                className={`p-3 rounded-xl text-center transition-all ${
                  day.isToday ? 'bg-primary/10 text-primary border border-primary/30' : 'bg-surface-container-low'
                }`}
              >
                <p className={`text-label-md ${day.isToday ? 'text-primary font-semibold' : 'text-on-surface-variant'}`}>{day.dayName}</p>
                <p className={`text-2xl font-bold mt-1 ${day.isToday ? 'text-primary' : 'text-on-surface'}`}>{day.dayNum}</p>
                <div className={`text-xs font-semibold mt-2 ${day.isToday ? 'text-primary' : 'text-on-surface-variant'}`}>
                  {day.totalCalories > 0 ? `${day.totalCalories} kcal` : '--'}
                </div>
                <div className="flex justify-center gap-1 mt-2">
                  {[day.hasBreakfast, day.hasLunch, day.hasDinner].map((has, i) => (
                    <div key={i} className={`w-2 h-2 rounded-full ${has ? 'bg-primary' : 'bg-outline-variant'}`} />
                  ))}
                </div>
              </div>
            ))}
            </div>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
