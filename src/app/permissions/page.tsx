'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { App } from '@capacitor/app';
import { Bell, MapPin, Check, ArrowRight, ShieldCheck, Settings } from 'lucide-react';
import {
  completePermissionOnboarding,
  getNotificationPermissionStatus,
  getLocationPermissionStatus,
  requestNotificationPermission,
  requestLocationPermission,
  openAppSettings,
  PermStatus,
} from '@/lib/permissions';

function StatusChip({ status }: { status: PermStatus }) {
  if (status === 'granted') {
    return (
      <span className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-label-md font-bold">
        <Check className="w-3.5 h-3.5" /> Allowed
      </span>
    );
  }
  if (status === 'unsupported') {
    return (
      <span className="shrink-0 px-2.5 py-1 rounded-full bg-surface-container text-on-surface-variant text-label-md font-bold">
        N/A
      </span>
    );
  }
  return (
    <span className="shrink-0 px-2.5 py-1 rounded-full bg-surface-container-high text-on-surface-variant text-label-md font-bold">
      Not allowed
    </span>
  );
}

export default function PermissionsPage() {
  const router = useRouter();
  const [notifStatus, setNotifStatus] = useState<PermStatus>('prompt');
  const [locStatus, setLocStatus] = useState<PermStatus>('prompt');
  const [askingNotif, setAskingNotif] = useState(false);
  const [askingLoc, setAskingLoc] = useState(false);

  useEffect(() => {
    // READ-ONLY: opening this screen (which happens right after profile setup)
    // must never trigger an OS dialog. Dialogs only come from tapping Allow.
    getNotificationPermissionStatus().then(setNotifStatus);
    getLocationPermissionStatus().then(setLocStatus);
    // Returning from Android Settings? Re-read the statuses so the chips flip
    // without restarting the app.
    const sub = App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        getNotificationPermissionStatus().then(setNotifStatus);
        getLocationPermissionStatus().then(setLocStatus);
      }
    });
    return () => {
      sub.then((l) => l.remove());
    };
  }, []);

  const handleAllowNotifications = async () => {
    setAskingNotif(true);
    setNotifStatus(await requestNotificationPermission());
    setAskingNotif(false);
    window.dispatchEvent(new Event('gymathome:permissions-changed'));
  };

  const handleAllowLocation = async () => {
    setAskingLoc(true);
    setLocStatus(await requestLocationPermission());
    setAskingLoc(false);
    // Notification permission is asked at the same moment location is asked —
    // this is the ONLY place the app ever shows an OS permission dialog.
    setAskingNotif(true);
    setNotifStatus(await requestNotificationPermission());
    setAskingNotif(false);
    window.dispatchEvent(new Event('gymathome:permissions-changed'));
  };

  const handleContinue = () => {
    completePermissionOnboarding();
    router.replace('/dashboard');
  };

  return (
    <div className="min-h-screen bg-surface-container-lowest flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-surface rounded-2xl border border-outline-variant shadow-[0_8px_30px_rgba(15,23,42,0.08)] p-6 md:p-8">
        {/* Branding */}
        <div className="flex flex-col items-center text-center mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Gym at Home" className="w-20 h-20 rounded-2xl mb-4" />
          <h1 className="text-headline-lg font-bold text-on-surface">Welcome to Gym at Home</h1>
          <p className="text-body-md text-on-surface-variant mt-1">
            Two quick permissions so reminders and weather work for you.
          </p>
        </div>

        {/* Notifications */}
        <div className="rounded-xl border border-outline-variant bg-surface-container-low p-4 mb-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 shrink-0 rounded-full bg-primary/10 flex items-center justify-center">
              <Bell className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="text-body-md font-bold text-on-surface">Reminders</p>
                <StatusChip status={notifStatus} />
              </div>
              <p className="text-label-md text-on-surface-variant mt-1">
                Streak saves, meal nudges, hydration tips and daily motivation — delivered like a
                personal coach, even when the app is closed.
              </p>
            </div>
          </div>
          {notifStatus === 'denied' ? (
            // Android silently auto-denies re-requests after a block — the OS
            // dialog can only come back via system Settings.
            <button
              onClick={openAppSettings}
              className="mt-3 w-full h-11 border-2 border-outline-variant text-on-surface rounded-lg text-label-md font-bold hover:bg-surface-container transition-all flex items-center justify-center gap-2"
            >
              <Settings className="w-4 h-4" />
              Open Android Settings
            </button>
          ) : notifStatus !== 'unsupported' && notifStatus !== 'granted' && (
            <button
              onClick={handleAllowNotifications}
              disabled={askingNotif}
              className="mt-3 w-full h-11 bg-primary text-on-primary rounded-lg text-label-md font-bold hover:bg-primary/90 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <Bell className="w-4 h-4" />
              {askingNotif ? 'Waiting for permission…' : 'Allow reminders'}
            </button>
          )}
        </div>

        {/* Location */}
        <div className="rounded-xl border border-outline-variant bg-surface-container-low p-4 mb-6">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 shrink-0 rounded-full bg-secondary/10 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-secondary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="text-body-md font-bold text-on-surface">Live weather</p>
                <StatusChip status={locStatus} />
              </div>
              <p className="text-label-md text-on-surface-variant mt-1">
                After you grant permission, the app can receive location updates while it is
                running and use them for weather. Coordinates are sent directly to Open-Meteo
                (open-meteo.com); updates can trigger refreshed requests. Gym at Home does not
                save a location history; Open-Meteo and network providers may process request
                metadata under their own policies.
              </p>
            </div>
          </div>
          {locStatus === 'denied' ? (
            <button
              onClick={openAppSettings}
              className="mt-3 w-full h-11 border-2 border-outline-variant text-on-surface rounded-lg text-label-md font-bold hover:bg-surface-container transition-all flex items-center justify-center gap-2"
            >
              <Settings className="w-4 h-4" />
              Open Android Settings
            </button>
          ) : locStatus !== 'unsupported' && locStatus !== 'granted' && (
            <button
              onClick={handleAllowLocation}
              disabled={askingLoc}
              className="mt-3 w-full h-11 bg-secondary text-on-secondary rounded-lg text-label-md font-bold hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <MapPin className="w-4 h-4" />
              {askingLoc ? 'Waiting for permission…' : 'Allow location'}
            </button>
          )}
        </div>

        {/* Continue */}
        <button
          onClick={handleContinue}
          className="w-full h-12 rounded-lg border-2 border-primary text-primary hover:bg-primary/5 text-label-md font-bold transition-all flex items-center justify-center gap-2"
        >
          Continue to app
          <ArrowRight className="w-4 h-4" />
        </button>
        <p className="flex items-start justify-center gap-1.5 text-[11px] text-on-surface-variant mt-4 text-center">
          <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            Most app data stays on this device. AI and weather requests send limited information
            to external providers as explained in the Privacy Policy. If Android blocked a
            permission, use Open Android Settings → Permissions to re-enable it.
          </span>
        </p>
      </div>
    </div>
  );
}
