'use client';

import DashboardLayout from '@/components/layout/DashboardLayout';
import { useState, useEffect, useRef } from 'react';
import { useStore } from '@/lib/store-context';
import { allFoods } from '@/lib/food-database';
import { FoodItem, FoodSelection, DayFoodIntake } from '@/lib/types';
import {
  makeSelection,
  nutritionForGrams,
  selectionGrams,
  standardGrams,
  withGrams,
} from '@/lib/food-portion';
import {
  ChevronRight,
  ChevronLeft,
  Search,
  X,
  AlertTriangle,
  Coffee,
  Sun,
  Moon,
  CheckCircle,
} from 'lucide-react';

const dayKeys = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
const dayLabels = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const mealTypes = [
  { id: 'breakfast', label: 'Breakfast', icon: Coffee, color: 'text-amber-600', bg: 'bg-amber-50' },
  { id: 'lunch', label: 'Lunch', icon: Sun, color: 'text-green-600', bg: 'bg-green-50' },
  { id: 'dinner', label: 'Dinner', icon: Moon, color: 'text-blue-600', bg: 'bg-blue-50' },
] as const;

const commonAllergies = [
  'Peanuts', 'Tree Nuts', 'Milk', 'Eggs', 'Soy', 'Wheat', 'Fish', 'Shellfish', 'Sesame',
];

function AutocompleteInput({
  placeholder,
  onSelect,
  allergies,
}: {
  placeholder: string;
  onSelect: (food: FoodItem) => void;
  allergies: string[];
}) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<FoodItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.length < 1) {
      setSuggestions([]);
      return;
    }
    const q = query.toLowerCase();
    const filtered = allFoods
      .filter((f) => f.name.toLowerCase().includes(q))
      .filter((f) => {
        if (allergies.length === 0) return true;
        return !f.allergens.some((a) => allergies.includes(a));
      })
      .slice(0, 8);
    setSuggestions(filtered);
  }, [query, allergies]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (food: FoodItem) => {
    onSelect(food);
    setQuery('');
    setShowSuggestions(false);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline-variant" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setShowSuggestions(true); }}
          onFocus={() => query.length > 0 && setShowSuggestions(true)}
          placeholder={placeholder}
          className="w-full pl-10 pr-4 py-3 bg-surface-container-lowest border border-outline-variant/40 rounded-lg text-body-md text-on-surface placeholder:text-outline-variant focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
        />
      </div>
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-outline-variant/40 rounded-xl shadow-xl z-50 max-h-80 overflow-y-auto">
              {suggestions.map((food, idx) => {
            const serving = food.servingSizes?.[0];
            const servingLabel = serving?.label || `${standardGrams(food)} g`;
            const perServing = nutritionForGrams(food, standardGrams(food));
            return (
              <button
                key={`${food.id}-${idx}`}
                onClick={() => handleSelect(food)}
                className="w-full text-left px-4 py-3 hover:bg-surface-container-low transition-colors border-b border-outline-variant/20 last:border-0"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-body-md text-on-surface font-semibold truncate">{food.name}</p>
                    <p className="text-xs text-on-surface-variant mt-0.5">{servingLabel}</p>
                  </div>
                  <div className="text-right flex-shrink-0 ml-3">
                    <p className="text-body-md font-bold text-primary">{perServing.calories} kcal</p>
                    <div className="flex gap-2 text-xs text-on-surface-variant mt-0.5">
                      <span>P: {perServing.protein}g</span>
                      <span>C: {perServing.carbs}g</span>
                      <span>F: {perServing.fat}g</span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FoodChip({ selection, onRemove, onGramsChange }: { selection: FoodSelection; onRemove: () => void; onGramsChange: (grams: number) => void }) {
  const grams = selectionGrams(selection);
  const [draft, setDraft] = useState(String(grams));

  useEffect(() => {
    setDraft(String(grams));
  }, [grams]);

  const commit = () => {
    const next = parseInt(draft, 10);
    if (Number.isFinite(next) && next > 0) {
      onGramsChange(next);
      setDraft(String(next));
    } else {
      setDraft(String(grams));
    }
  };

  return (
    <div className="flex items-center gap-2 bg-surface-container-low border border-outline-variant/30 rounded-lg px-3 py-2">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-on-surface truncate">{selection.foodName}</p>
        <p className="text-xs text-on-surface-variant truncate">
          {Math.round(selection.calories)} kcal | P: {Math.round(selection.protein)}g | C: {Math.round(selection.carbs)}g | F: {Math.round(selection.fat)}g
        </p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <input
          type="number"
          inputMode="numeric"
          min={1}
          step={10}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit();
              (e.target as HTMLInputElement).blur();
            }
          }}
          aria-label={`Grams of ${selection.foodName}`}
          className="w-16 px-1.5 py-1 bg-surface-container-lowest border border-outline-variant/40 rounded text-xs font-semibold text-on-surface text-center focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
        />
        <span className="text-xs font-semibold text-on-surface-variant">g</span>
      </div>
      <button onClick={onRemove} className="p-1 hover:bg-error-container rounded transition-colors shrink-0">
        <X className="w-3.5 h-3.5 text-error" />
      </button>
    </div>
  );
}

export default function FoodIntakePage() {
  const { foodPreferences, setFoodPreferences } = useStore();
  const [currentDay, setCurrentDay] = useState(0);
  const [allergies, setAllergies] = useState<string[]>(foodPreferences.allergies || []);
  const [allergyInput, setAllergyInput] = useState('');
  const [showAllergySuggestions, setShowAllergySuggestions] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState<'breakfast' | 'lunch' | 'dinner'>('breakfast');
  const [pendingFood, setPendingFood] = useState<FoodItem | null>(null);
  const [portionGrams, setPortionGrams] = useState('100');
  const [portionMeal, setPortionMeal] = useState<'breakfast' | 'lunch' | 'dinner'>('breakfast');

  const dayKey = dayKeys[currentDay];
  const dayData: DayFoodIntake = foodPreferences[dayKey] || { breakfast: [], lunch: [], dinner: [] };

  const getMealEntries = (day: DayFoodIntake, meal: string): FoodSelection[] => {
    if (meal === 'breakfast') return day.breakfast || [];
    if (meal === 'lunch') return day.lunch || [];
    if (meal === 'dinner') return day.dinner || [];
    return [];
  };

  const dayCals = ['breakfast', 'lunch', 'dinner'].reduce((sum, meal) => {
    return sum + getMealEntries(dayData, meal).reduce((s, f) => s + f.calories, 0);
  }, 0);

  const weekTotalCals = dayKeys.reduce((sum, key) => {
    const day = foodPreferences[key] || { breakfast: [], lunch: [], dinner: [] };
    return sum + ['breakfast', 'lunch', 'dinner'].reduce((mSum, meal) => {
      return mSum + getMealEntries(day, meal).reduce((s, f) => s + f.calories, 0);
    }, 0);
  }, 0);

  const avgDailyCals = Math.round(weekTotalCals / 7);

  const openPortion = (food: FoodItem) => {
    setPendingFood(food);
    setPortionGrams(String(standardGrams(food)));
    setPortionMeal(selectedMeal);
  };

  const handleAddFood = (meal: 'breakfast' | 'lunch' | 'dinner', food: FoodItem, grams: number) => {
    const selection = makeSelection(food, grams);
    setFoodPreferences({
      ...foodPreferences,
      [dayKey]: {
        ...dayData,
        [meal]: [...getMealEntries(dayData, meal), selection],
      },
    });
    setPendingFood(null);
  };

  const handleRemoveFood = (meal: 'breakfast' | 'lunch' | 'dinner', index: number) => {
    const current = getMealEntries(dayData, meal);
    setFoodPreferences({
      ...foodPreferences,
      [dayKey]: {
        ...dayData,
        [meal]: current.filter((_: FoodSelection, i: number) => i !== index),
      },
    });
  };

  const handleGramsChange = (meal: 'breakfast' | 'lunch' | 'dinner', index: number, grams: number) => {
    const current = getMealEntries(dayData, meal);
    const updated = current.map((item: FoodSelection, i: number) =>
      i === index ? withGrams(item, grams) : item
    );
    setFoodPreferences({
      ...foodPreferences,
      [dayKey]: {
        ...dayData,
        [meal]: updated,
      },
    });
  };

  const addAllergy = (allergy: string) => {
    if (allergy && !allergies.includes(allergy)) {
      const newAllergies = [...allergies, allergy];
      setAllergies(newAllergies);
      setFoodPreferences({ ...foodPreferences, allergies: newAllergies as any });
      setAllergyInput('');
    }
    setShowAllergySuggestions(false);
  };

  const removeAllergy = (allergy: string) => {
    const newAllergies = allergies.filter((a) => a !== allergy);
    setAllergies(newAllergies);
    setFoodPreferences({ ...foodPreferences, allergies: newAllergies as any });
  };

  const handleAllergyKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && allergyInput.trim()) {
      addAllergy(allergyInput.trim());
    }
  };

  const isDayComplete = (dayIndex: number) => {
    const day = foodPreferences[dayKeys[dayIndex]];
    if (!day) return false;
    return (day.breakfast?.length || 0) + (day.lunch?.length || 0) + (day.dinner?.length || 0) > 0;
  };

  const allDaysComplete = dayKeys.every((key) => {
    const day = foodPreferences[key];
    return (day?.breakfast?.length || 0) + (day?.lunch?.length || 0) + (day?.dinner?.length || 0) > 0;
  });

  const filteredAllergySuggestions = commonAllergies.filter(
    (a) => !allergies.includes(a) && a.toLowerCase().includes(allergyInput.toLowerCase())
  );

  return (
    <DashboardLayout title="Weekly Food Intake" subtitle="Tell us what you eat so we can create your personalized meal plan">
      <div className="max-w-4xl mx-auto pb-8">
        {/* Progress Header */}
        <div className="bg-surface rounded-xl border border-outline-variant/30 p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <h2 className="text-xl sm:text-headline-md font-bold text-on-surface">
              {dayLabels[currentDay]}
            </h2>
            <div className="flex items-center gap-4">
              <div className="text-left sm:text-right">
                <p className="text-xs text-on-surface-variant">Today</p>
                <p className="text-body-lg font-bold text-primary">{dayCals} kcal</p>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-xs text-on-surface-variant">Weekly Avg</p>
                <p className="text-body-lg font-bold text-secondary">{avgDailyCals} kcal/day</p>
              </div>
            </div>
          </div>
          {/* Day Progress Bar */}
          <div className="flex gap-1.5">
            {dayLabels.map((day, i) => (
              <button
                key={day}
                onClick={() => setCurrentDay(i)}
                className={`flex-1 h-8 rounded-lg text-xs font-bold transition-all ${
                  i === currentDay
                    ? 'bg-primary text-on-primary shadow-md'
                    : isDayComplete(i)
                    ? 'bg-primary/20 text-primary'
                    : 'bg-surface-container-highest text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                {day.slice(0, 3)}
              </button>
            ))}
          </div>
        </div>

        {/* Allergies Section */}
        <div className="bg-surface rounded-xl border border-outline-variant/30 p-6 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <h3 className="text-body-lg font-bold text-on-surface">Allergies & Intolerances</h3>
          </div>
          <p className="text-sm text-on-surface-variant mb-3">
            Foods containing these allergens will be excluded from suggestions.
          </p>
          <div className="relative">
            <input
              type="text"
              value={allergyInput}
              onChange={(e) => { setAllergyInput(e.target.value); setShowAllergySuggestions(true); }}
              onFocus={() => setShowAllergySuggestions(true)}
              onKeyDown={handleAllergyKeyDown}
              placeholder="Type an allergy and press Enter..."
              className="w-full px-4 py-2.5 bg-surface-container-lowest border border-outline-variant/40 rounded-lg text-body-md text-on-surface placeholder:text-outline-variant focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
            />
            {showAllergySuggestions && allergyInput && filteredAllergySuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-outline-variant/40 rounded-lg shadow-lg z-50">
                {filteredAllergySuggestions.map((a) => (
                  <button
                    key={a}
                    onClick={() => addAllergy(a)}
                    className="w-full text-left px-4 py-2 hover:bg-surface-container-low text-body-md text-on-surface"
                  >
                    {a}
                  </button>
                ))}
              </div>
            )}
          </div>
          {allergies.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {allergies.map((a) => (
                <span
                  key={a}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-error-container text-on-error-container rounded-full text-sm font-medium"
                >
                  {a}
                  <button onClick={() => removeAllergy(a)} className="hover:opacity-70">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Free Food Search */}
        <div className="bg-surface rounded-xl border border-outline-variant/30 p-4 md:p-6 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Search className="w-4 h-4 text-primary" />
            <h3 className="text-body-md font-bold text-on-surface">Add Food</h3>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 min-w-0">
              <AutocompleteInput
                placeholder="Search any food..."
                onSelect={openPortion}
                allergies={allergies}
              />
            </div>
            <div className="flex items-center gap-2">
              <select
                value={selectedMeal}
                onChange={(e) => setSelectedMeal(e.target.value as 'breakfast' | 'lunch' | 'dinner')}
                className="px-3 py-2 bg-surface-container-lowest border border-outline-variant/40 rounded-lg text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
              >
                {mealTypes.map((meal) => (
                  <option key={meal.id} value={meal.id}>{meal.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Meal Sections */}
        <div className="space-y-4 mb-6">
          {mealTypes.map((meal) => {
            const entries = getMealEntries(dayData, meal.id);
            const Icon = meal.icon;
            return (
              <div key={meal.id} className="border border-outline-variant/30 rounded-xl overflow-hidden">
                <div className={`flex items-center justify-between p-4 ${meal.bg} border-b border-outline-variant/20`}>
                  <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${meal.color}`} />
                    <h4 className="text-body-md font-bold text-gray-900 capitalize">{meal.id}</h4>
                  </div>
                  <span className="text-sm font-semibold text-gray-600">
                    {Math.round(entries.reduce((sum, s) => sum + s.calories, 0))} kcal
                  </span>
                </div>
                <div className="p-4">
                  {entries.length > 0 ? (
                    <div className="space-y-2">
                      {entries.map((sel, i) => (
                        <FoodChip
                          key={i}
                          selection={sel}
                          onRemove={() => handleRemoveFood(meal.id as 'breakfast' | 'lunch' | 'dinner', i)}
                          onGramsChange={(grams) => handleGramsChange(meal.id as 'breakfast' | 'lunch' | 'dinner', i, grams)}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-on-surface-variant/60 italic">No foods added yet</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Day Summary */}
        <div className="bg-surface rounded-xl border border-outline-variant/30 p-4 mb-6">
          <h4 className="text-body-lg font-bold text-on-surface mb-3">{dayLabels[currentDay]} Summary</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
            {mealTypes.map((meal) => {
              const entries = getMealEntries(dayData, meal.id);
              const cals = Math.round(entries.reduce((sum, f) => sum + f.calories, 0));
              const Icon = meal.icon;
              return (
                <div key={meal.id} className={`${meal.bg} rounded-lg p-3 text-center`}>
                  <Icon className={`w-5 h-5 ${meal.color} mx-auto mb-1`} />
                  <p className="text-xs text-gray-600 capitalize">{meal.id}</p>
                  <p className="text-body-lg font-bold text-gray-900">{cals}</p>
                  <p className="text-xs text-gray-600">kcal</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between gap-4">
          <button
            onClick={() => currentDay > 0 && setCurrentDay(currentDay - 1)}
            disabled={currentDay === 0}
            className="flex items-center gap-2 px-4 md:px-6 py-3 bg-surface-container-highest hover:bg-surface-container-high text-on-surface rounded-lg text-sm md:text-label-md font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Previous Day</span>
            <span className="sm:hidden">Prev</span>
          </button>

          <button
            onClick={() => currentDay < 6 && setCurrentDay(currentDay + 1)}
            disabled={currentDay === 6}
            className="flex items-center gap-2 px-4 md:px-6 py-3 bg-primary hover:bg-primary/90 text-on-primary rounded-lg text-sm md:text-label-md font-bold transition-all shadow-md hover:shadow-lg disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {currentDay === 6 ? 'Complete' : (currentDay < 6 ? <span className="sm:hidden">Next</span> : null)}
            {currentDay === 6 ? 'Complete' : <span className="hidden sm:inline">Next Day</span>}
            {currentDay < 6 && <ChevronRight className="w-4 h-4" />}
          </button>
        </div>

        {/* Generate Plan Button */}
        {allDaysComplete && (
          <div className="mt-6 text-center">
            <a
              href="/generated-meal-plan"
              className="inline-flex items-center gap-2 px-8 py-4 bg-secondary hover:bg-secondary/90 text-on-secondary rounded-xl text-title-md font-bold transition-all shadow-lg hover:shadow-xl"
            >
              <CheckCircle className="w-5 h-5" />
              Generate My Personalized Meal Plan
            </a>
          </div>
        )}
      </div>

      {/* Portion prompt — asks how many grams after a food is picked */}
      {pendingFood && (() => {
        const standard = standardGrams(pendingFood);
        const parsed = parseInt(portionGrams, 10);
        const grams = Number.isFinite(parsed) && parsed > 0 ? parsed : standard;
        const preview = nutritionForGrams(pendingFood, grams);
        const quickGrams = Array.from(new Set([50, 100, 150, 200, standard])).sort((a, b) => a - b);
        const standardLabel = pendingFood.servingSizes?.[0]?.label;

        return (
          <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 sm:p-4">
            <div className="bg-surface sm:rounded-2xl rounded-t-2xl shadow-xl w-full sm:max-w-md max-h-[88vh] overflow-y-auto">
              <div className="flex items-center justify-between p-4 border-b border-outline-variant/50">
                <div className="min-w-0">
                  <h3 className="text-body-lg font-bold text-on-surface truncate">
                    How much {pendingFood.name}?
                  </h3>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    {standardLabel ? `Standard portion: ${standardLabel}` : 'Enter the amount you eat'}
                  </p>
                </div>
                <button
                  onClick={() => setPendingFood(null)}
                  className="p-1.5 hover:bg-surface-container rounded-lg transition-colors shrink-0"
                  aria-label="Cancel"
                >
                  <X className="w-5 h-5 text-on-surface-variant" />
                </button>
              </div>

              <div className="p-4 space-y-4">
                <div>
                  <label className="text-xs font-semibold text-on-surface-variant mb-1.5 block">Grams</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      step={10}
                      autoFocus
                      value={portionGrams}
                      onChange={(e) => setPortionGrams(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddFood(portionMeal, pendingFood, grams);
                        }
                      }}
                      className="flex-1 px-3 py-2.5 bg-surface-container-lowest border border-outline-variant/40 rounded-lg text-lg font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                    />
                    <span className="text-sm font-semibold text-on-surface-variant">g</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {quickGrams.map((g) => (
                    <button
                      key={g}
                      onClick={() => setPortionGrams(String(g))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                        grams === g
                          ? 'bg-primary text-on-primary border-primary'
                          : 'bg-surface-container-low text-on-surface border-outline-variant/40 hover:bg-surface-container'
                      }`}
                    >
                      {g} g
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-4 gap-2 bg-surface-container-low rounded-lg p-3 text-center">
                  <div>
                    <p className="text-body-md font-bold text-primary">{preview.calories}</p>
                    <p className="text-[10px] text-on-surface-variant">kcal</p>
                  </div>
                  <div>
                    <p className="text-body-md font-bold text-on-surface">{preview.protein}g</p>
                    <p className="text-[10px] text-on-surface-variant">Protein</p>
                  </div>
                  <div>
                    <p className="text-body-md font-bold text-on-surface">{preview.carbs}g</p>
                    <p className="text-[10px] text-on-surface-variant">Carbs</p>
                  </div>
                  <div>
                    <p className="text-body-md font-bold text-on-surface">{preview.fat}g</p>
                    <p className="text-[10px] text-on-surface-variant">Fat</p>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-on-surface-variant mb-1.5 block">Add to</label>
                  <select
                    value={portionMeal}
                    onChange={(e) => setPortionMeal(e.target.value as 'breakfast' | 'lunch' | 'dinner')}
                    className="w-full px-3 py-2.5 bg-surface-container-lowest border border-outline-variant/40 rounded-lg text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                  >
                    {mealTypes.map((meal) => (
                      <option key={meal.id} value={meal.id}>{meal.label}</option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => setPendingFood(null)}
                    className="flex-1 h-11 rounded-xl text-label-md font-bold bg-surface-container-highest text-on-surface hover:bg-surface-container-high transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleAddFood(portionMeal, pendingFood, grams)}
                    className="flex-1 h-11 rounded-xl text-label-md font-bold bg-primary text-on-primary hover:bg-primary/90 transition-colors shadow-sm"
                  >
                    Add {grams} g
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </DashboardLayout>
  );
}
