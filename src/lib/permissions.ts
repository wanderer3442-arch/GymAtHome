'use client';

import { registerPlugin } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

/**
 * First-run permission onboarding.
 *
 * The app's reminders (streak saves, meal nudges, hydration, motivation) and
 * live weather (GPS) both need OS permissions. Instead of surprise dialogs
 * mid-use, we ask once up front on a branded screen before the user enters
 * the dashboard. Nothing here throws - denied permissions degrade gracefully
 * (no notifications, manual weather input).
 */

export const PERMISSIONS_DONE_KEY = 'gymathome.permissions.onboarded';

export type PermStatus = 'granted' | 'denied' | 'prompt' | 'unsupported';

export function hasCompletedPermissionOnboarding(): boolean {
  try {
    return localStorage.getItem(PERMISSIONS_DONE_KEY) === '1';
  } catch {
    return true; // storage blocked -> don't trap the user in the gate
  }
}

export function completePermissionOnboarding(): void {
  try {
    localStorage.setItem(PERMISSIONS_DONE_KEY, '1');
  } catch {
    // best-effort
  }
}

function isNative(): boolean {
  try {
    return typeof window !== 'undefined' && 'Capacitor' in window &&
      (window as any).Capacitor?.isNativePlatform?.() === true;
  } catch {
    return false;
  }
}

/** Current notification permission without prompting. */
export async function getNotificationPermissionStatus(): Promise<PermStatus> {
  try {
    if (isNative()) {
      const res = await LocalNotifications.checkPermissions();
      return res.display as PermStatus;
    }
    if (typeof Notification !== 'undefined') {
      return Notification.permission as PermStatus;
    }
    return 'unsupported';
  } catch {
    return 'unsupported';
  }
}

/** Ask for notification permission (native dialog). Safe to call when granted. */
export async function requestNotificationPermission(): Promise<PermStatus> {
  try {
    if (isNative()) {
      const current = await LocalNotifications.checkPermissions();
      if (current.display === 'granted') return 'granted';
      const res = await LocalNotifications.requestPermissions();
      return res.display as PermStatus;
    }
    if (typeof Notification !== 'undefined' && Notification.permission !== 'denied') {
      const res = await Notification.requestPermission();
      return res as PermStatus;
    }
    return getNotificationPermissionStatus();
  } catch {
    return 'denied';
  }
}

/** Current location permission without prompting (no GPS read, no dialog). */
export async function getLocationPermissionStatus(): Promise<PermStatus> {
  try {
    if (typeof navigator === 'undefined' || !navigator.permissions?.query) {
      return 'prompt';
    }
    const res = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
    return res.state as PermStatus;
  } catch {
    return 'prompt';
  }
}

/**
 * Ask for location via one quick GPS read. On Android the WebView surfaces
 * the system location dialog from this call; the result is only used for
 * weather, never stored with a timestamp.
 */
export function requestLocationPermission(): Promise<PermStatus> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      resolve('unsupported');
      return;
    }
    // Already granted? getCurrentPosition resolves instantly without a dialog.
    navigator.geolocation.getCurrentPosition(
      () => resolve('granted'),
      (err) => resolve(err.code === 1 ? 'denied' : 'granted'), // code 1 = permission denied; timeout/position-unavailable still implies granted
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 60_000 }
    );
  });
}

// Tiny native plugin (android/.../AppSettingsPlugin.java) that jumps to this
// app's page in Android Settings. Capacitor has no built-in API for this, and
// WebView code cannot deep-link to settings screens on its own.
const AppSettings = registerPlugin<{ open(): Promise<void> }>('AppSettings');

/**
 * Open Android's "App info" screen for this app.
 *
 * Once the user denies a permission (especially "Don't allow" / "Don't ask
 * again"), Android silently auto-denies every future requestPermission() call
 * — no dialog can be shown from app code again. System Settings is the only
 * place a blocked permission can be flipped, so this is the real "change
 * permission" path on Android. No-op on web.
 */
export async function openAppSettings(): Promise<void> {
  try {
    await AppSettings.open();
  } catch {
    // Web build / plugin unavailable — nothing to open.
  }
}
