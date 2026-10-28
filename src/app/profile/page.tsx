'use client';

import DashboardLayout from '@/components/layout/DashboardLayout';
import { useState, useMemo, useEffect, useRef } from 'react';
import {
  User,
  Calendar,
  Edit,
  Target,
  TrendingUp,
  Activity,
  Save,
  CheckCircle,
  Award,
  Trash2,
  TriangleAlert,
  X,
  Camera,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useStore, GYMATHOME_STORE_KEY } from '@/lib/store-context';
import { localDateKey } from '@/lib/date';
import { estimateExerciseCalories } from '@/lib/calculations';
import { resizeImageToDataUrl } from '@/lib/photo';
import { useBackHandler } from '@/lib/back-handler';

export default function ProfilePage() {
  const {
    profile,
    updateProfile,
    calculations,
    meals,
    exercises,
    bodyMetrics,
    getMealsForDate,
    getExercisesForDate,
    badges,
    checkBadges,
    isProfileSet,
    setIsProfileSet,
  } = useStore();

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(profile.name || '');
  const [editAge, setEditAge] = useState(profile.age ? String(profile.age) : '');
  const [editHeight, setEditHeight] = useState(profile.height ? String(profile.height) : '');
  const [editWeight, setEditWeight] = useState(profile.weight ? String(profile.weight) : '');
  const [editGender, setEditGender] = useState(profile.gender || 'male');
  const [editGoal, setEditGoal] = useState(profile.goal || 'maintain');
  const [editActivity, setEditActivity] = useState(profile.activityLevel || 'moderate');
  const [saved, setSaved] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const photoInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      updateProfile({ photo: dataUrl });
    } catch {
      // Unsupported/corrupt image - ignore, old photo stays.
    }
  };

  useBackHandler(showDeleteModal, () => setShowDeleteModal(false));

  const totalWorkouts = exercises.length;
  const totalMealsLogged = meals.length;

  const totalCaloriesBurned = useMemo(() => {
    return exercises.reduce((sum, ex) => sum + estimateExerciseCalories(ex), 0);
  }, [exercises]);

  const streak = useMemo(() => {
    let count = 0;
    const d = new Date();
    for (let i = 0; i < 30; i++) {
      const dateStr = localDateKey(d);
      if (getMealsForDate(dateStr).length > 0 || getExercisesForDate(dateStr).length > 0) {
        count++;
      } else if (i > 0) {
        break;
      }
      d.setDate(d.getDate() - 1);
    }
    return count;
  }, [meals, exercises]);

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

  // Check for new badges on mount
  useEffect(() => {
    checkBadges();
  }, []);

  const handleSave = () => {
    updateProfile({
      name: editName.trim() || profile.name,
      gender: editGender,
      age: parseFloat(editAge) || 25,
      height: parseFloat(editHeight) || 175,
      weight: parseFloat(editWeight) || 70,
      activityLevel: editActivity,
      goal: editGoal,
    });
    setIsProfileSet(true);
    setEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const bmiCategory = calculations?.bmiCategory || 'N/A';

  return (
    <DashboardLayout title="User Profile" subtitle="Your health and fitness journey">
      <div className="max-w-7xl mx-auto space-y-6 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile Card */}
          <div className="bg-surface rounded-xl border border-outline-variant p-6">
            <div className="text-center">
              <div className="relative w-24 h-24 mx-auto mb-3">
                <div className="w-24 h-24 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center ring-2 ring-primary/20">
                  {profile.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={profile.photo}
                      alt="Profile photo"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-12 h-12 text-primary" />
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  title={profile.photo ? 'Change photo' : 'Add photo'}
                  aria-label={profile.photo ? 'Change profile photo' : 'Add profile photo'}
                  className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-md hover:bg-primary/90 active:scale-95 transition-all"
                >
                  <Camera className="w-4 h-4" />
                </button>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoSelect}
                />
              </div>
              {profile.photo && (
                <button
                  type="button"
                  onClick={() => updateProfile({ photo: null })}
                  className="text-xs text-on-surface-variant hover:text-error transition-colors mb-2"
                >
                  Remove photo
                </button>
              )}
              {editing ? (
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="text-headline-md font-semibold text-on-surface text-center w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-1 outline-none focus:border-primary"
                />
              ) : (
                <h2 className="text-headline-md font-semibold text-on-surface">{profile.name || 'User'}</h2>
              )}
            </div>

            <div className="mt-6 space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="w-4 h-4 text-on-surface-variant" />
                <span className="text-on-surface-variant">Age: {editing ? editAge : (profile.age || 'Not set')} years</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Activity className="w-4 h-4 text-on-surface-variant" />
                <span className="text-on-surface-variant capitalize">
                  {editing ? editActivity.replace('_', ' ') : (profile.activityLevel?.replace('_', ' ') || 'Not set')}
                </span>
              </div>
            </div>

            {editing ? (
              <div className="flex gap-2 mt-6">
                <button
                  onClick={handleSave}
                  className="flex-1 h-10 bg-primary text-on-primary rounded-lg text-label-md font-bold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                >
                  {saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                  {saved ? 'Saved!' : 'Save'}
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="flex-1 h-10 bg-surface-container text-on-surface-variant rounded-lg text-label-md hover:bg-surface-container-high transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setEditName(profile.name || '');
                  setEditing(true);
                }}
                className="w-full mt-6 h-10 border border-secondary text-secondary rounded-lg text-label-md font-medium hover:bg-secondary/5 transition-colors flex items-center justify-center gap-2"
              >
                <Edit className="w-4 h-4" />
                Edit Profile
              </button>
            )}
          </div>

          {/* Health Metrics */}
          <div className="lg:col-span-2 bg-surface rounded-xl border border-outline-variant p-6">
            <h2 className="text-headline-md font-semibold text-on-surface mb-4">Health Metrics</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-surface-container rounded-lg text-center">
                <p className="text-2xl font-bold text-on-surface">
                  {editing ? editWeight : (profile.weight || '--')}
                </p>
                <p className="text-sm text-on-surface-variant">Weight (kg)</p>
              </div>
              <div className="p-4 bg-surface-container rounded-lg text-center">
                <p className="text-2xl font-bold text-on-surface">
                  {editing ? editHeight : (profile.height || '--')}
                </p>
                <p className="text-sm text-on-surface-variant">Height (cm)</p>
              </div>
              <div className="p-4 bg-surface-container rounded-lg text-center">
                <p className="text-2xl font-bold text-on-surface">{calculations?.bmi || '—'}</p>
                <p className="text-sm text-on-surface-variant">BMI</p>
                <span className={`inline-block mt-1 px-2 py-0.5 text-xs font-bold rounded-full ${
                  bmiCategory === 'Normal' ? 'bg-primary/20 text-primary'
                    : bmiCategory === 'Overweight' ? 'bg-tertiary/20 text-tertiary'
                    : 'bg-error/20 text-error'
                }`}>
                  {bmiCategory}
                </span>
              </div>
              <div className="p-4 bg-surface-container rounded-lg text-center">
                <p className="text-2xl font-bold text-on-surface">{calculations?.bmr || '—'}</p>
                <p className="text-sm text-on-surface-variant">BMR (kcal)</p>
              </div>
              <div className="p-4 bg-surface-container rounded-lg text-center">
                <p className="text-2xl font-bold text-on-surface">{calculations?.tdee || '—'}</p>
                <p className="text-sm text-on-surface-variant">TDEE (kcal)</p>
              </div>
              <div className="p-4 bg-surface-container rounded-lg text-center">
                <p className="text-2xl font-bold text-on-surface">{calculations?.targetCalories || '—'}</p>
                <p className="text-sm text-on-surface-variant">Target (kcal)</p>
              </div>
              <div className="p-4 bg-surface-container rounded-lg text-center">
                <p className="text-2xl font-bold text-on-surface">{calculations?.hydration || '—'}L</p>
                <p className="text-sm text-on-surface-variant">Hydration</p>
              </div>
              <div className="p-4 bg-surface-container rounded-lg text-center">
                <p className="text-2xl font-bold text-primary capitalize">
                  {editing ? editGoal : (profile.goal || '--')}
                </p>
                <p className="text-sm text-on-surface-variant">Goal</p>
              </div>
            </div>
          </div>

          {/* Macro Targets */}
          <div className="lg:col-span-2 bg-surface rounded-xl border border-outline-variant p-6">
            <h2 className="text-headline-md font-semibold text-on-surface mb-4">Macro Targets</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
              <div className="p-4 bg-surface-container rounded-lg text-center">
                <p className="text-2xl font-bold text-secondary">{calculations?.protein || '—'}g</p>
                <p className="text-sm text-on-surface-variant">Protein</p>
              </div>
              <div className="p-4 bg-surface-container rounded-lg text-center">
                <p className="text-2xl font-bold text-tertiary">{calculations?.carbs || '—'}g</p>
                <p className="text-sm text-on-surface-variant">Carbs</p>
              </div>
              <div className="p-4 bg-surface-container rounded-lg text-center">
                <p className="text-2xl font-bold text-error">{calculations?.fat || '—'}g</p>
                <p className="text-sm text-on-surface-variant">Fat</p>
              </div>
            </div>
          </div>

          {/* Profile Settings */}
          {editing && (
            <div className="lg:col-span-3 bg-surface rounded-xl border border-outline-variant p-6">
              <h2 className="text-headline-md font-semibold text-on-surface mb-4">Edit Settings</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-label-md text-on-surface-variant">Gender</label>
                  <div className="flex bg-surface-container-low rounded-lg p-1 border border-outline-variant">
                    {(['male', 'female', 'other'] as const).map((g) => (
                      <button
                        key={g}
                        onClick={() => setEditGender(g)}
                        className={`flex-1 py-2 text-label-md rounded-md transition-all capitalize ${
                          editGender === g
                            ? 'bg-surface text-on-surface shadow-sm font-semibold'
                            : 'text-on-surface-variant hover:bg-surface-variant'
                        }`}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-label-md text-on-surface-variant">Age</label>
                  <input
                    type="number"
                    value={editAge}
                    onChange={(e) => setEditAge(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-outline-variant bg-surface text-body-md outline-none focus:border-primary"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-label-md text-on-surface-variant">Height (cm)</label>
                  <input
                    type="number"
                    value={editHeight}
                    onChange={(e) => setEditHeight(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-outline-variant bg-surface text-body-md outline-none focus:border-primary"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-label-md text-on-surface-variant">Weight (kg)</label>
                  <input
                    type="number"
                    value={editWeight}
                    onChange={(e) => setEditWeight(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-outline-variant bg-surface text-body-md outline-none focus:border-primary"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-label-md text-on-surface-variant">Goal</label>
                  <div className="flex bg-surface-container-low rounded-lg p-1 border border-outline-variant">
                    {(['lose', 'maintain', 'gain'] as const).map((g) => (
                      <button
                        key={g}
                        onClick={() => setEditGoal(g)}
                        className={`flex-1 py-2 text-label-md rounded-md transition-all capitalize ${
                          editGoal === g
                            ? 'bg-surface text-on-surface shadow-sm font-semibold'
                            : 'text-on-surface-variant hover:bg-surface-variant'
                        }`}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-label-md text-on-surface-variant">Activity Level</label>
                  <select
                    value={editActivity}
                    onChange={(e) => setEditActivity(e.target.value as any)}
                    className="w-full h-10 px-3 rounded-lg border border-outline-variant bg-surface text-body-md outline-none focus:border-primary"
                  >
                    <option value="sedentary">Sedentary</option>
                    <option value="light">Light</option>
                    <option value="moderate">Moderate</option>
                    <option value="very_active">Very Active</option>
                    <option value="extra_active">Extra Active</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Activity Summary */}
          <div className="bg-surface rounded-xl border border-outline-variant p-6">
            <h2 className="text-headline-md font-semibold text-on-surface mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              Activity Summary
            </h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-surface-container rounded-lg">
                <span className="text-sm text-on-surface-variant">Total Workouts</span>
                <span className="text-lg font-bold text-on-surface">{totalWorkouts}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-surface-container rounded-lg">
                <span className="text-sm text-on-surface-variant">Meals Logged</span>
                <span className="text-lg font-bold text-on-surface">{totalMealsLogged}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-surface-container rounded-lg">
                <span className="text-sm text-on-surface-variant">Est. Calories Burned</span>
                <span className="text-lg font-bold text-on-surface">{totalCaloriesBurned.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-surface-container rounded-lg">
                <span className="text-sm text-on-surface-variant">Current Streak</span>
                <span className="text-lg font-bold text-primary">{streak} days</span>
              </div>
            </div>
          </div>

          {/* Body Metrics History */}
          <div className="bg-surface rounded-xl border border-outline-variant p-6">
            <h2 className="text-headline-md font-semibold text-on-surface mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Body Metrics History
            </h2>
            <div className="space-y-3">
              {bodyMetrics.length === 0 ? (
                <p className="text-sm text-on-surface-variant text-center py-4 italic">
                  No body metrics logged yet. Use the Logger to track your weight.
                </p>
              ) : (
                [...bodyMetrics]
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .slice(0, 5)
                  .map((metric, index) => (
                    <div
                      key={metric.date}
                      className={`p-3 rounded-lg ${index === 0 ? 'bg-primary/5 border border-primary/20' : 'bg-surface-container'}`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-on-surface-variant">
                          {new Date(metric.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                        {index === 0 && (
                          <span className="text-xs text-success font-medium">Latest</span>
                        )}
                      </div>
                      <div className="flex gap-4">
                        <div>
                          <p className="text-sm font-medium text-on-surface">{metric.weight} kg</p>
                          <p className="text-xs text-on-surface-variant">Weight</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-on-surface">{metric.height} cm</p>
                          <p className="text-xs text-on-surface-variant">Height</p>
                        </div>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>

          {/* Weight Trend Chart */}
          <div className="bg-surface rounded-xl border border-outline-variant p-6">
            <h2 className="text-headline-md font-semibold text-on-surface mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Weight Trend
            </h2>
            {weightChartData.length < 2 ? (
              <p className="text-sm text-on-surface-variant text-center py-8 italic">
                Log at least 2 weight entries to see your trend chart.
              </p>
            ) : (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={weightChartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#006c49" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#006c49" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-outline-variant)" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--color-on-surface-variant)' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--color-on-surface-variant)' }} domain={['dataMin - 2', 'dataMax + 2']} />
                    <Tooltip
                      contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-outline-variant)', borderRadius: 8 }}
                      labelStyle={{ color: 'var(--color-on-surface-variant)' }}
                      formatter={(value: any) => [`${value} kg`, 'Weight']}
                    />
                    <Area type="monotone" dataKey="weight" stroke="#006c49" strokeWidth={2} fill="url(#weightGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Achievements / Badges */}
          <div className="lg:col-span-3 bg-surface rounded-xl border border-outline-variant p-6">
            <h2 className="text-headline-md font-semibold text-on-surface mb-4 flex items-center gap-2">
              <Award className="w-5 h-5 text-primary" />
              Achievements
            </h2>
            {badges.length === 0 ? (
              <p className="text-sm text-on-surface-variant text-center py-6 italic">
                No achievements yet. Keep logging meals, workouts, and water to earn badges!
              </p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {badges.map((badge) => (
                  <div
                    key={badge.id}
                    className="p-4 bg-primary/5 border border-primary/20 rounded-xl text-center"
                  >
                    <div className="text-3xl mb-2">{badge.icon}</div>
                    <p className="text-label-md font-semibold text-on-surface">{badge.name}</p>
                    <p className="text-xs text-on-surface-variant mt-1">{badge.description}</p>
                    {badge.unlockedAt && (
                      <p className="text-xs text-primary mt-2 font-medium">
                        {new Date(badge.unlockedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Danger zone — local data deletion */}
        <div className="bg-surface rounded-xl border border-error/40 p-6 mt-6">
          <h2 className="text-headline-md font-semibold text-on-surface mb-2 flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-error" />
            Delete All Data
          </h2>
          <p className="text-sm text-on-surface-variant mb-1">
            Permanently erases every workout, meal, health metric, badge and preference stored on this
            device, including your profile. This cannot be undone.
          </p>
          <p className="text-sm text-on-surface-variant mb-4">
            Want a backup first?{' '}
            <a href="/export-reports" className="text-primary font-medium underline underline-offset-2">
              Export your data
            </a>
            .
          </p>
          <button
            onClick={() => {
              setDeleteConfirmText('');
              setShowDeleteModal(true);
            }}
            className="px-4 py-2.5 rounded-lg border border-error text-error text-sm font-semibold hover:bg-error/5 active:scale-98 transition"
          >
            Delete all data…
          </button>
        </div>

        {/* Delete confirmation modal */}
        {showDeleteModal && (
          <div
            className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 sm:p-4"
            onClick={() => setShowDeleteModal(false)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-account-title"
          >
            <div
              className="bg-surface rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-6 border border-outline-variant shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-full bg-error-container">
                    <TriangleAlert className="w-5 h-5 text-error" />
                  </div>
                  <h3 id="delete-account-title" className="text-lg font-semibold text-on-surface">
                    Delete all data?
                  </h3>
                </div>
                <button
                  onClick={() => setShowDeleteModal(false)}
                  aria-label="Close"
                  className="p-1.5 rounded-lg hover:bg-surface-container"
                >
                  <X className="w-5 h-5 text-on-surface-variant" />
                </button>
              </div>

              <p className="text-sm text-on-surface-variant mb-4">
                Your profile and all data on this device will be erased immediately &mdash; profile,
                workouts, meals, metrics and badges. This cannot be recovered.
              </p>

              <label htmlFor="delete-confirm" className="block text-sm text-on-surface mb-2">
                Type <span className="font-bold">DELETE</span> to confirm
              </label>
              <input
                id="delete-confirm"
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="DELETE"
                autoCapitalize="characters"
                autoComplete="off"
                className="w-full px-4 py-3 rounded-lg border border-outline-variant bg-surface-container-low text-on-surface placeholder:text-on-surface-variant/60 focus:border-error"
              />

              <div className="flex gap-3 mt-5">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-1 px-4 py-3 rounded-lg border border-outline-variant text-on-surface text-sm font-semibold hover:bg-surface-container"
                >
                  Cancel
                </button>
                <button
                  disabled={deleteConfirmText.trim() !== 'DELETE'}
                  onClick={() => {
                    try {
                      localStorage.removeItem(GYMATHOME_STORE_KEY);
                      Object.keys(localStorage)
                        .filter((k) => k.startsWith('gymathome_store_'))
                        .forEach((k) => localStorage.removeItem(k));
                      Object.keys(localStorage)
                        .filter((k) => k.startsWith('gymathome_chat_count_'))
                        .forEach((k) => localStorage.removeItem(k));
                      localStorage.removeItem('gymathome_chat_history');
                    } catch {
                      // best-effort wipe
                    }
                    setShowDeleteModal(false);
                    window.location.href = '/';
                  }}
                  className="flex-1 px-4 py-3 rounded-lg bg-error text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110"
                >
                  Delete forever
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
