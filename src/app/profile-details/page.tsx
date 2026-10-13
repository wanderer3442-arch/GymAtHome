'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, CheckCircle } from 'lucide-react';
import { useStore } from '@/lib/store-context';
import type { Gender } from '@/lib/types';

const genderOptions: { value: Gender; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
];

export default function ProfileDetailsPage() {
  const router = useRouter();
  const { profile, updateProfile, hydrated } = useStore();

  const [name, setName] = useState('');
  const [gender, setGender] = useState<Gender>('male');
  const [age, setAge] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [saved, setSaved] = useState(false);

  // Prefill from the local store once it has hydrated.
  useEffect(() => {
    if (!hydrated) return;
    setName(profile.name || '');
    if (profile.gender) setGender(profile.gender);
    setAge(profile.age ? String(profile.age) : '');
    setHeight(profile.height ? String(profile.height) : '');
    setWeight(profile.weight ? String(profile.weight) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  const ageNum = parseFloat(age);
  const heightNum = parseFloat(height);
  const weightNum = parseFloat(weight);

  const valid =
    name.trim().length > 0 &&
    ageNum >= 5 && ageNum <= 120 &&
    heightNum >= 50 && heightNum <= 250 &&
    weightNum >= 15 && weightNum <= 400;

  const handleContinue = () => {
    if (!valid || saved) return;
    updateProfile({
      name: name.trim(),
      gender,
      age: ageNum,
      height: heightNum,
      weight: weightNum,
    });
    setSaved(true);
    setTimeout(() => {
      if (profile.activityLevel && profile.goal) {
        router.replace('/dashboard');
      } else {
        router.replace('/calculator');
      }
    }, 600);
  };

  const fieldClass =
    'w-full h-12 px-4 rounded-lg border border-outline-variant bg-surface focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-body-md outline-none text-on-surface placeholder:text-on-surface-variant/60';

  return (
    <div className="min-h-screen bg-surface-container-lowest flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Brand */}
        <div className="text-center space-y-3">
          <img src="/logo.png" alt="Gym at Home" className="w-14 h-14 rounded-2xl object-cover mx-auto shadow-md" />
          <div>
            <span className="inline-block px-3 py-1 rounded-full bg-primary-container/60 text-on-primary-container text-label-md font-bold">
              Step 1 of 2 · Profile
            </span>
          </div>
          <h1 className="text-headline-lg font-bold text-on-surface">Tell us about you</h1>
          <p className="text-body-md text-on-surface-variant max-w-sm mx-auto">
            Your details power your calorie, macro and hydration targets. Everything stays on this
            device — no account needed.
          </p>
        </div>

        {/* Form */}
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/40 shadow-[0_10px_15px_-3px_rgba(11,28,48,0.05),0_4px_6px_-2px_rgba(11,28,48,0.025)] p-6 space-y-5">
          <div className="space-y-1">
            <label htmlFor="pd-name" className="text-label-md text-on-surface-variant">
              Name
            </label>
            <input
              id="pd-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="What should we call you?"
              autoComplete="name"
              className={fieldClass}
            />
          </div>

          <div className="space-y-1">
            <label className="text-label-md text-on-surface-variant">Gender</label>
            <div className="flex bg-surface-container-low rounded-lg p-1 border border-outline-variant">
              {genderOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setGender(opt.value)}
                  className={`flex-1 py-2.5 text-label-md rounded-md transition-all ${
                    gender === opt.value
                      ? 'bg-surface text-on-surface shadow-sm font-semibold'
                      : 'text-on-surface-variant hover:bg-surface-variant'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label htmlFor="pd-age" className="text-label-md text-on-surface-variant">
                Age
              </label>
              <input
                id="pd-age"
                type="number"
                inputMode="numeric"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="25"
                className={fieldClass}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="pd-height" className="text-label-md text-on-surface-variant">
                Height (cm)
              </label>
              <input
                id="pd-height"
                type="number"
                inputMode="decimal"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                placeholder="175"
                className={fieldClass}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="pd-weight" className="text-label-md text-on-surface-variant">
                Weight (kg)
              </label>
              <input
                id="pd-weight"
                type="number"
                inputMode="decimal"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="70"
                className={fieldClass}
              />
            </div>
          </div>

          <button
            onClick={handleContinue}
            disabled={!valid || saved}
            className="w-full bg-primary hover:bg-surface-tint disabled:opacity-40 disabled:cursor-not-allowed text-on-primary py-3.5 rounded-lg text-label-lg font-bold transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
          >
            {saved ? <CheckCircle className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
            {saved ? 'Saved!' : 'Continue to Essentials'}
          </button>
        </div>

        <p className="text-center text-xs text-on-surface-variant/70">
          No sign-up, no email — your data never leaves this device.
        </p>
      </div>
    </div>
  );
}
