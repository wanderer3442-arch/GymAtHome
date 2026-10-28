'use client';

import { useState, useEffect, useMemo } from 'react';
import { useStore } from '@/lib/store-context';

// Shared toast implementation lives in ToastNotification - re-exported here so
// existing imports from this module keep working.
export { useToast } from '@/components/ui/ToastNotification';

// --- Streak tracking ------------------------------------------------------
export interface StreakInfo {
  current: number;
  longest: number;
  /** True when yesterday had no activity and today's isn't logged yet. */
  atRisk: boolean;
  daysUntilReset: number;
}

/**
 * Derives the current/longest streak from logged meals + exercises.
 * A day counts as active when at least one meal OR exercise is logged.
 */
export function useStreakInfo(): StreakInfo {
  const { meals, exercises, getMealsForDate, getExercisesForDate } = useStore();

  return useMemo(() => {
    const isActive = (d: Date) => {
      const ds = d.toISOString().split('T')[0];
      return getMealsForDate(ds).length > 0 || getExercisesForDate(ds).length > 0;
    };

    // Current streak: walk back from today. Today not being logged yet does
    // not break the streak - only a fully missed *yesterday* does.
    let current = 0;
    const cursor = new Date();
    if (!isActive(cursor)) cursor.setDate(cursor.getDate() - 1);
    while (isActive(cursor) && current < 3650) {
      current++;
      cursor.setDate(cursor.getDate() - 1);
    }

    // Longest streak over the last 2 years of logged days.
    let longest = 0;
    let run = 0;
    const scan = new Date();
    scan.setDate(scan.getDate() - 730);
    for (let i = 0; i <= 730; i++) {
      if (isActive(scan)) {
        run++;
        if (run > longest) longest = run;
      } else {
        run = 0;
      }
      scan.setDate(scan.getDate() + 1);
    }
    if (current > longest) longest = current;

    const todayActive = isActive(new Date());
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayActive = isActive(yesterday);

    // Streak at risk: yesterday was active, today is not yet.
    const atRisk = yesterdayActive && !todayActive && current > 0;

    return {
      current,
      longest,
      atRisk,
      daysUntilReset: atRisk ? 1 : 0,
    };
  }, [meals, exercises, getMealsForDate, getExercisesForDate]);
}

// --- Hydration reminder ---------------------------------------------------
/** Fallback target when profile calculations aren't available yet. */
export const DEFAULT_HYDRATION_L = 2.5;
/** Remind when hydration is below this fraction of the daily target. */
const HYDRATION_REMINDER_THRESHOLD = 0.5;

export function useHydrationReminder() {
  const { calculations, getWaterForDate, addWater } = useStore();
  const today = new Date().toISOString().split('T')[0];

  const consumedMl = getWaterForDate(today);
  // calculations.hydration is liters/day; fall back to 2.5 L before profile load.
  const targetMl = Math.round(
    ((calculations?.hydration || DEFAULT_HYDRATION_L) * 1000)
  );
  const pct = Math.min(Math.round((consumedMl / targetMl) * 100), 100);
  const shouldRemind =
    targetMl > 0 && consumedMl < targetMl * HYDRATION_REMINDER_THRESHOLD;
  const remainingMl = Math.max(targetMl - consumedMl, 0);

  return {
    consumedMl,
    targetMl,
    pct,
    shouldRemind,
    remainingMl,
    logGlass: () => addWater(250),
  };
}

// Check if Web Notifications API is supported.
// Read-only by design: the Permissions screen is the only place that asks, so
// opening the app never triggers an OS permission dialog.
export function useNotificationPermission() {
  const [permission, setPermission] = useState<NotificationPermission | null>(null);

  useEffect(() => {
    if (!('Notification' in window)) {
      setPermission('denied');
      return;
    }
    setPermission(Notification.permission);
  }, []);

  return permission;
}

// Show system notification if permission granted
export function useSystemNotification() {
  const permission = useNotificationPermission();

  const showNotification = (title: string, options: NotificationOptions = {}) => {
    if (permission === 'granted') {
      new Notification(title, {
        icon: '/favicon.ico',
        ...options,
      });
    }
  };

  return { showNotification, permission };
}