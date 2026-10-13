'use client';

import DashboardLayout from '@/components/layout/DashboardLayout';
import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Scale, Flame, Save, CheckCircle } from 'lucide-react';
import { useStore } from '@/lib/store-context';

type ActivityLevel = '1.2' | '1.375' | '1.55' | '1.725' | '1.9';

const activityLevels: { value: ActivityLevel; label: string; multiplier: string }[] = [
  { value: '1.2', label: 'Sedentary (little or no exercise)', multiplier: '1.2' },
  { value: '1.375', label: 'Lightly active (1-3 days/week)', multiplier: '1.375' },
  { value: '1.55', label: 'Moderately active (3-5 days/week)', multiplier: '1.55' },
  { value: '1.725', label: 'Very active (6-7 days/week)', multiplier: '1.725' },
  { value: '1.9', label: 'Extra active (very hard exercise)', multiplier: '1.9' },
];

const activityToLevel: Record<string, ActivityLevel> = {
  sedentary: '1.2',
  light: '1.375',
  moderate: '1.55',
  very_active: '1.725',
  extra_active: '1.9',
};

const levelToActivity: Record<string, string> = {
  '1.2': 'sedentary',
  '1.375': 'light',
  '1.55': 'moderate',
  '1.725': 'very_active',
  '1.9': 'extra_active',
};

const goalOptions: { value: 'lose' | 'maintain' | 'gain'; label: string; hint: string }[] = [
  { value: 'lose', label: 'Lose Weight', hint: 'Fat loss — target ~500 kcal/day deficit (USDA)' },
  { value: 'maintain', label: 'Maintain Weight', hint: 'Stay at your current weight & body comp' },
  { value: 'gain', label: 'Build Muscle', hint: 'Bulk — target +300 kcal/day surplus (ACSM)' },
];

export default function CalculatorPage() {
  const { profile, updateProfile, setIsProfileSet } = useStore();
  const router = useRouter();
  const [saved, setSaved] = useState(false);

  const [gender, setGender] = useState<'male' | 'female'>(profile.gender === 'female' ? 'female' : 'male');
  const [age, setAge] = useState(profile.age ? String(profile.age) : '');
  const [height, setHeight] = useState(profile.height ? String(profile.height) : '');
  const [weight, setWeight] = useState(profile.weight ? String(profile.weight) : '');
  const [activity, setActivity] = useState<ActivityLevel>(profile.activityLevel ? (activityToLevel[profile.activityLevel] || '1.55') : '1.55');
  const [goal, setGoal] = useState<'lose' | 'maintain' | 'gain'>(profile.goal || 'maintain');

  const results = useMemo(() => {
    const ageNum = parseFloat(age);
    const heightNum = parseFloat(height);
    const weightNum = parseFloat(weight);
    const activityNum = parseFloat(activity);

    if (!ageNum || !heightNum || !weightNum) return null;

    // BMR (Mifflin-St Jeor)
    let bmr: number;
    if (gender === 'male') {
      bmr = 10 * weightNum + 6.25 * heightNum - 5 * ageNum + 5;
    } else {
      bmr = 10 * weightNum + 6.25 * heightNum - 5 * ageNum - 161;
    }

    // TDEE
    const tdee = bmr * activityNum;

    // BMI
    const heightM = heightNum / 100;
    const bmi = weightNum / (heightM * heightM);
    let bmiCategory = '';
    if (bmi < 18.5) bmiCategory = 'Underweight';
    else if (bmi < 25) bmiCategory = 'Normal';
    else if (bmi < 30) bmiCategory = 'Overweight';
    else bmiCategory = 'Obese';

    // Macros (30% protein, 45% carbs, 25% fats)
    const protein = Math.round((tdee * 0.30) / 4);
    const carbs = Math.round((tdee * 0.45) / 4);
    const fats = Math.round((tdee * 0.25) / 9);

    return {
      tdee: Math.round(tdee),
      bmr: Math.round(bmr),
      bmi: parseFloat(bmi.toFixed(1)),
      bmiCategory,
      protein,
      carbs,
      fats,
    };
  }, [gender, age, height, weight, activity]);

  return (
    <DashboardLayout title="Essentials" subtitle="Step 2 of 2 — calculate your foundational health metrics.">
      <div className="max-w-7xl mx-auto space-y-6 pb-8">
        {/* Header */}
        <header className="mb-2">
          <h1 className="text-headline-lg md:text-headline-lg font-bold text-on-surface mb-2">
            Essentials Calculator
          </h1>
          <p className="text-body-lg text-on-surface-variant max-w-2xl">
            Calculate your foundational health metrics to establish baseline targets for your
            fitness journey.
          </p>
        </header>

        {/* Bento Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Input Section */}
          <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-6">
            {/* Step 1: Physique Data */}
            <div className="bg-surface-container-lowest rounded-xl p-6 border border-surface-container-highest shadow-[0_10px_15px_-3px_rgba(11,28,48,0.05),0_4px_6px_-2px_rgba(11,28,48,0.025)]">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold text-label-md">
                  1
                </div>
                <h2 className="text-headline-md font-semibold text-on-surface">Physique Data</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-label-md text-on-surface-variant">Gender</label>
                  <div className="flex bg-surface-container-low rounded-lg p-1 border border-outline-variant">
                    <button
                      onClick={() => setGender('male')}
                      className={`flex-1 py-2 text-label-md rounded-md transition-all ${
                        gender === 'male'
                          ? 'bg-surface text-on-surface shadow-sm font-semibold'
                          : 'text-on-surface-variant hover:bg-surface-variant'
                      }`}
                    >
                      Male
                    </button>
                    <button
                      onClick={() => setGender('female')}
                      className={`flex-1 py-2 text-label-md rounded-md transition-all ${
                        gender === 'female'
                          ? 'bg-surface text-on-surface shadow-sm font-semibold'
                          : 'text-on-surface-variant hover:bg-surface-variant'
                      }`}
                    >
                      Female
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-label-md text-on-surface-variant">Age (years)</label>
                  <input
                    type="number"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    className="w-full h-12 px-4 rounded-lg border border-outline-variant bg-surface focus:border-secondary focus:ring-2 focus:ring-secondary/20 transition-all text-body-md outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-label-md text-on-surface-variant">Height (cm)</label>
                  <input
                    type="number"
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                    className="w-full h-12 px-4 rounded-lg border border-outline-variant bg-surface focus:border-secondary focus:ring-2 focus:ring-secondary/20 transition-all text-body-md outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-label-md text-on-surface-variant">Weight (kg)</label>
                  <input
                    type="number"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    className="w-full h-12 px-4 rounded-lg border border-outline-variant bg-surface focus:border-secondary focus:ring-2 focus:ring-secondary/20 transition-all text-body-md outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Step 2: Activity Factor */}
            <div className="bg-surface-container-lowest rounded-xl p-6 border border-surface-container-highest shadow-[0_10px_15px_-3px_rgba(11,28,48,0.05),0_4px_6px_-2px_rgba(11,28,48,0.025)]">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-full bg-surface-container-highest text-on-surface flex items-center justify-center font-bold text-label-md">
                  2
                </div>
                <h2 className="text-headline-md font-semibold text-on-surface">Activity Factor</h2>
              </div>
              <div className="space-y-3">
                {activityLevels.map((level) => (
                  <label
                    key={level.value}
                    className={`flex items-start p-4 rounded-lg border cursor-pointer transition-colors ${
                      activity === level.value
                        ? 'border-primary bg-surface-container-low'
                        : 'border-outline-variant hover:bg-surface-container-lowest'
                    }`}
                  >
                    <input
                      type="radio"
                      name="activity"
                      value={level.value}
                      checked={activity === level.value}
                      onChange={(e) => setActivity(e.target.value as ActivityLevel)}
                      className="mt-1 w-4 h-4 text-primary focus:ring-primary border-outline"
                    />
                    <div className="ml-3">
                      <span className="block text-body-md font-bold text-on-surface">
                        {level.label}
                      </span>
                      <span className="block text-label-md text-on-surface-variant mt-1">
                        Multiplier: {level.multiplier}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Step 3: Goal */}
            <div className="bg-surface-container-lowest rounded-xl p-6 border border-surface-container-highest shadow-[0_10px_15px_-3px_rgba(11,28,48,0.05),0_4px_6px_-2px_rgba(11,28,48,0.025)]">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-full bg-surface-container-highest text-on-surface flex items-center justify-center font-bold text-label-md">
                  3
                </div>
                <h2 className="text-headline-md font-semibold text-on-surface">Your Goal</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {goalOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setGoal(opt.value)}
                    className={`p-4 rounded-lg border text-left transition-colors ${
                      goal === opt.value
                        ? 'border-primary bg-surface-container-low'
                        : 'border-outline-variant hover:bg-surface-container-lowest'
                    }`}
                  >
                    <span className={`block text-body-md font-bold ${goal === opt.value ? 'text-primary' : 'text-on-surface'}`}>
                      {opt.label}
                    </span>
                    <span className="block text-label-md text-on-surface-variant mt-1">{opt.hint}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Results Section */}
          <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-6">
            {/* Target TDEE Card */}
            <div className="bg-primary rounded-2xl p-6 text-on-primary shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 blur-xl" />
              <h3 className="text-label-md text-primary-fixed-dim uppercase tracking-wider mb-2 relative z-10">
                Target TDEE
              </h3>
              <div className="flex items-baseline gap-2 relative z-10">
                <span className="text-display-lg font-bold">{results?.tdee?.toLocaleString() ?? '—'}</span>
                <span className="text-body-md opacity-80">kcal/day</span>
              </div>
              <p className="text-label-md mt-4 opacity-90 relative z-10">
                {goal === 'lose'
                  ? `Fat loss target: ~${(results ? Math.max(0, results.tdee - 500) : 0).toLocaleString()} kcal/day (TDEE − 500, USDA).`
                  : goal === 'gain'
                  ? `Muscle gain target: ~${(results ? results.tdee + 300 : 0).toLocaleString()} kcal/day (TDEE + 300, ACSM).`
                  : `Maintenance calories based on Mifflin-St Jeor formula + ${activityLevels.find((l) => l.value === activity)?.label.split('(')[0].trim()}.`}
              </p>
            </div>

            {/* BMI + BMR Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-surface-container-lowest rounded-xl p-4 border border-surface-container-highest shadow-[0_10px_15px_-3px_rgba(11,28,48,0.05),0_4px_6px_-2px_rgba(11,28,48,0.025)] flex flex-col justify-between">
                <div className="flex items-center gap-2 text-on-surface-variant mb-2">
                  <Scale className="w-5 h-5" />
                  <span className="text-label-md">BMI</span>
                </div>
                <span className="text-stat-value font-bold text-on-surface">{results?.bmi ?? '—'}</span>
                <span
                  className={`inline-block mt-2 px-2 py-1 text-xs font-bold rounded-full w-max ${
                    results?.bmiCategory === 'Normal'
                      ? 'bg-primary/20 text-primary'
                      : results?.bmiCategory === 'Overweight'
                      ? 'bg-tertiary/20 text-tertiary'
                      : 'bg-error/20 text-error'
                  }`}
                >
                  {results?.bmiCategory ?? '—'}
                </span>
              </div>
              <div className="bg-surface-container-lowest rounded-xl p-4 border border-surface-container-highest shadow-[0_10px_15px_-3px_rgba(11,28,48,0.05),0_4px_6px_-2px_rgba(11,28,48,0.025)] flex flex-col justify-between">
                <div className="flex items-center gap-2 text-on-surface-variant mb-2">
                  <Flame className="w-5 h-5" />
                  <span className="text-label-md">BMR</span>
                </div>
                <span className="text-stat-value font-bold text-on-surface">{results?.bmr?.toLocaleString() ?? '—'}</span>
                <span className="text-label-md text-on-surface-variant mt-2">Resting kcal</span>
              </div>
            </div>

            {/* Macro Split Card */}
            <div className="bg-surface-container-lowest rounded-xl p-6 border border-surface-container-highest shadow-[0_10px_15px_-3px_rgba(11,28,48,0.05),0_4px_6px_-2px_rgba(11,28,48,0.025)]">
              <h3 className="text-headline-md font-semibold text-on-surface mb-4">
                Macro Split (Maintenance)
              </h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-label-md mb-1">
                    <span className="text-on-surface font-bold">Protein (30%)</span>
                    <span className="text-on-surface-variant">{results?.protein ?? '—'}g</span>
                  </div>
                  <div className="w-full bg-surface-container-highest rounded-full h-2">
                    <div className="bg-secondary h-2 rounded-full" style={{ width: '30%' }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-label-md mb-1">
                    <span className="text-on-surface font-bold">Carbs (45%)</span>
                    <span className="text-on-surface-variant">{results?.carbs ?? '—'}g</span>
                  </div>
                  <div className="w-full bg-surface-container-highest rounded-full h-2">
                    <div className="bg-tertiary-container h-2 rounded-full" style={{ width: '45%' }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-label-md mb-1">
                    <span className="text-on-surface font-bold">Fats (25%)</span>
                    <span className="text-on-surface-variant">{results?.fats ?? '—'}g</span>
                  </div>
                  <div className="w-full bg-surface-container-highest rounded-full h-2">
                    <div className="bg-error h-2 rounded-full" style={{ width: '25%' }} />
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  if (!results) return;
                  updateProfile({
                    gender,
                    age: parseFloat(age) as any,
                    height: parseFloat(height) as any,
                    weight: parseFloat(weight) as any,
                    activityLevel: levelToActivity[activity] as any,
                    goal,
                  });
                  setIsProfileSet(true);
                  setSaved(true);
                  setTimeout(() => {
                    setSaved(false);
                    router.push('/dashboard');
                  }, 1000);
                }}
                className="w-full mt-6 bg-primary hover:bg-surface-tint text-on-primary py-3 rounded-lg text-label-md font-bold transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
              >
                {saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                {saved ? 'Saved!' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
