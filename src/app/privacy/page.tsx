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
    body: 'After you grant location permission, the app can receive location updates while it is running and use them for weather. It sends the coordinates directly to Open-Meteo (open-meteo.com); updates may cause refreshed weather requests. The app does not save a location history. Open-Meteo and network providers may process request metadata, including IP address and coordinates in the request URL, under their own policies.',
  },
  {
    icon: Wifi,
    name: 'Internet access',
    android: 'INTERNET',
    body: 'Needed for AI requests and weather lookups. Android grants this at install, so you will not see a dialog for it.',
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
    title: 'Most app data stays on your device',
    body: 'Your profile, workouts, meals, health metrics, preferences, profile photo and chat history are stored on your device. The app has no user account database or app-owned cloud sync, and Android app backups are disabled. AI prompts and weather requests are exceptions: the information described below leaves your device. Delete All Data erases Gym at Home data stored on this device; it cannot erase information already processed by an external provider. Uninstalling the Android app removes its device-local app data.',
  },
  {
    icon: EyeOff,
    title: 'No advertising or analytics SDKs',
    body: 'The app does not include advertising or analytics SDKs. There is no account or password. To provide AI and weather features, the app sends limited information to the service providers described below; those transfers mean information does leave your device.',
  },
  {
    icon: Sparkles,
    title: 'AI features',
    body: 'When you use an AI feature, your request is sent through our Cloudflare Worker proxy to the AI provider configured for that service (Groq or Google Gemini). A chat request can include your message, your name, profile details such as age, sex, height, weight and goals, health conditions and allergies, relevant daily meal/workout/water/sleep logs, and up to 10 recent chat messages. If you submit a CSV through chat, its contents are included. The Worker uses the connecting IP address for rate limiting and forwards the request to the configured AI provider. The app and Worker code do not save prompts or replies to an app-owned server database; chat history is saved locally on your device. The AI provider processes requests under its own terms and privacy practices, which may permit limited retention for service operation or abuse prevention. Clearing local chat or deleting local app data does not delete information already sent to a provider.',
  },
  {
    icon: MapPin,
    title: 'Weather (Open-Meteo)',
    body: 'After you grant location permission, the app can receive location updates while it is running and use them for weather. It sends your coordinates directly to Open-Meteo (open-meteo.com); updates may trigger refreshed requests. The app does not persist a location history. Open-Meteo and network providers may process request metadata, including IP address and coordinates, under their own policies. You can deny location; other app features remain available.',
  },
  {
    icon: ShieldCheck,
    title: 'Data deletion and access',
    body: 'We do not have a user database from which to retrieve your locally stored profile, logs or files. The AI proxy uses your IP address for rate limiting and relays AI requests, but does not write prompts or replies to an app-owned database. External providers may independently process or retain request data under their policies. Export reports if you want a copy of locally stored data.',
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
            Effective October 29, 2026 · Applies to the Gym at Home mobile app.
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
