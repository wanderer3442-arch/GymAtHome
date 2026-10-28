'use client';

import { useNotificationEngine } from '@/lib/notification-engine';

/**
 * Headless mount for the Zomato-style notification timing engine.
 * Renders nothing - it only schedules moment-based reminders (streak rescue,
 * meal windows, hydration pacing, hot-weather nudges) with quiet hours,
 * a daily cap, and a 45-minute minimum gap.
 */
export default function NotificationEngine() {
  useNotificationEngine();
  return null;
}
