'use client';

import Link from 'next/link';
import {
  ShieldCheck,
  HardDrive,
  Sparkles,
  Mail,
  EyeOff,
  Bell,
  MapPin,
  Wifi,
  Settings,
  ArrowRight,
} from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';

const permissions = [
  {
    icon: Bell,
    name: 'Notifications',
    android: 'POST_NOTIFICATIONS · SCHEDULE_EXACT_ALARM',
    body: 'Streak reminders, meal and hydration nudges, and motivation messages. They are scheduled on your phone — not pushed from a server. Asked once, right after you tap Save on the Essentials step, and never when the app opens. If Android also offers "Allow exact alarms", that only makes those reminders fire on time.',
  },
  {
    icon: MapPin,
    name: 'Location (approximate or precise)',
    android: 'ACCESS_COARSE_LOCATION · ACCESS_FINE_LOCATION',
    body: 'One reading is used only to look up the current temperature so hydration and heat advice match your weather. The coordinates are not stored as a location history and are never sent to our servers. Asked at the same moment as notifications, and asked again only if you tap Allow yourself.',
  },
  {
    icon: Wifi,
    name: 'Internet access',
    android: 'INTERNET',
    body: 'Needed for the AI chat, the weather lookup and AI meal/workout plans. Android grants this at install, so you will not see a dialog for it.',
  },
  {
    icon: Settings,
    name: 'Reminder reliability',
    android: 'RECEIVE_BOOT_COMPLETED · WAKE_LOCK',
    body: 'Keeps the reminders you scheduled alive after a phone restart and lets them fire while the screen is off. Nothing is collected — no dialog is shown for these.',
  },
];

const sections = [
  {
    icon: HardDrive,
    title: 'Your data stays on your device',
    body: 'Gym at Home stores everything locally — your account, workouts, meals, health metrics and preferences. There is no user database on our servers, and app backups to the cloud are disabled. Removing the app removes your data.',
  },
  {
    icon: EyeOff,
    title: 'No tracking, no ads, no selling',
    body: 'We do not use advertising, analytics or tracking SDKs, and we never sell or share your personal information. Your password is stored only on your device, hashed with PBKDF2.',
  },
  {
    icon: Sparkles,
    title: 'AI features (Groq)',
    body: 'When you chat with the AI assistant and request a plan, the text you type (plus your profile numbers you have filled in) is sent through our proxy to Groq to generate a reply. That prompt may include health details you type. We do not store these conversations, and Groq processes the request to generate the response.',
  },
  {
    icon: ShieldCheck,
    title: 'What we can see',
    body: 'We have no access to your account, your logs or your files. We cannot recover your data for you, so export reports matter if you want a backup.',
  },
];

export default function PrivacyPage() {
  return (
    <DashboardLayout title="Privacy Policy" subtitle="How your information is handled">
      <div className="max-w-3xl mx-auto pb-10 space-y-5">
        <div className="bg-surface rounded-2xl border border-outline-variant p-6">
          <div className="flex items-center gap-2 text-on-surface mb-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <h2 className="text-headline-sm font-semibold">Privacy Policy</h2>
          </div>
          <p className="text-body-md text-on-surface-variant">
            Effective October 27, 2026 · Applies to the Gym at Home mobile app.
          </p>
        </div>

        {sections.map((s) => (
          <div key={s.title} className="bg-surface rounded-2xl border border-outline-variant p-6 space-y-2">
            <div className="flex items-center gap-2 text-on-surface">
              <s.icon className="w-5 h-5 text-primary" />
              <h3 className="text-body-lg font-semibold">{s.title}</h3>
            </div>
            <p className="text-body-md text-on-surface-variant leading-relaxed">{s.body}</p>
          </div>
        ))}

        {/* Permissions — what we ask for and the exact reason */}
        <div className="bg-surface rounded-2xl border border-outline-variant p-6 space-y-4">
          <div className="flex items-center gap-2 text-on-surface">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <h3 className="text-body-lg font-semibold">Permissions we ask for — and why</h3>
          </div>
          <p className="text-body-md text-on-surface-variant leading-relaxed">
            Nothing is requested when the app launches or while you fill in your profile. Android
            only shows a permission dialog when you take the action that needs it, and you can
            decline — the app keeps working, just without that extra feature.
          </p>

          <div className="space-y-3">
            {permissions.map((p) => (
              <div
                key={p.name}
                className="flex gap-3 rounded-xl border border-outline-variant/60 bg-surface-container-lowest p-3"
              >
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <p.icon className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0 space-y-1">
                  <p className="text-body-md font-semibold text-on-surface">{p.name}</p>
                  <p className="text-[11px] font-mono text-on-surface-variant/80 break-words">
                    {p.android}
                  </p>
                  <p className="text-body-md text-on-surface-variant leading-relaxed">{p.body}</p>
                </div>
              </div>
            ))}
          </div>

          <p className="text-body-md text-on-surface-variant leading-relaxed">
            We never request the camera, photos, microphone, contacts, SMS or call logs — the app
            contains no code that reads them. You can review or revoke any permission at any time
            in Android <span className="font-medium text-on-surface">Settings → Apps → Gym at Home → Permissions</span>.
          </p>

          <Link
            href="/permissions"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-on-primary text-label-md font-bold hover:bg-primary/90 transition-colors"
          >
            Manage permissions
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="bg-surface rounded-2xl border border-outline-variant p-6 space-y-2">
          <div className="flex items-center gap-2 text-on-surface">
            <Mail className="w-5 h-5 text-primary" />
            <h3 className="text-body-lg font-semibold">Contact</h3>
          </div>
          <p className="text-body-md text-on-surface-variant leading-relaxed">
            Questions about privacy or your data? Email{' '}
            <a href="mailto:gymathome.app@gmail.com" className="text-primary font-medium underline underline-offset-2">
              gymathome.app@gmail.com
            </a>
            .
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
