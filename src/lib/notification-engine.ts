'use client';

import { useEffect, useRef, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { useStore } from '@/lib/store-context';
import { useStreakInfo, DEFAULT_HYDRATION_L } from '@/lib/use-streak';
import { showToast } from '@/components/ui/ToastNotification';
import { peekCachedTemperature } from '@/lib/weather';
import type { MealEntry } from '@/lib/types';

// ─── Zomato-style notification timing engine ─────────────────────────────
// Moment-based triggers (not arbitrary schedules): each rule only produces a
// candidate when the user's actual state warrants it - streak at risk, meal
// window passed without a log, hydration behind pace, hot weather - plus an
// engagement layer: daily morning motivation, badge-tease when close to an
// unlock, streak-milestone congratulations, and an end-of-day celebration.
//
// Guardrails keep it non-spammy (the reason Zomato can send often without
// feeling pushy):
//   • Quiet hours: 22:00 - 07:00 nothing goes out
//   • Daily cap: 12 notifications/day (priority-weighted selection)
//   • 4 compulsory daily greetings (good morning + "had your meal?" asks)
//   • Install day is completely silent — no notification on first launch
//   • Minimum gap: 45 minutes between any two
//   • Per-rule dedupe: each key fires at most once/day (hydration max 2)
//
// Delivery: Web Notification API when permission is granted, in-app toast as
// fallback (Android WebView often disallows `new Notification()` - the toast
// path is what will show on the phone while the app is open).

// --- Tuning ---------------------------------------------------------------
const QUIET_HOURS_START = 22; // [22:00, 24:00) ∪ [00:00, 07:00) = silent
const QUIET_HOURS_END = 7;
// 12 fits a 07:00-22:00 day at the 45-min gap while leaving room for the four
// compulsory greetings (they sort mid-priority and are never the ones cut).
const DAILY_CAP = 12;
const HYDRATION_MAX_PER_DAY = 2;
const MIN_GAP_MS = 45 * 60 * 1000;
const LOG_STORAGE_KEY = 'gymathome.notif.log';
// Read by the Permissions screen — the engine itself never asks.
const BOOTSTRAP_KEY = 'gymathome.notif.bootstrap';

// Priority: lower wins when several rules are due in the same tick.
// Milestones/motivation/celebration are the engagement layer - they outrank
// nags; hydration yields first when the day fills up.
const PRIORITY = {
  milestone: 0,
  motivation: 1,
  streak: 2,
  workout: 3,
  meal: 4,
  celebration: 5,
  badge: 6,
  weather: 7,
  hydration: 8,
} as const;

/** Milestone streaks worth a congratulation. */
const STREAK_MILESTONES = [3, 7, 14, 30, 50, 100];

/** Rotation source for the daily motivational line. */
const MOTIVATION_QUOTES = [
  "The version of you you're chasing is built exactly like this - one logged day at a time.",
  "Comfort zones don't build legends. Day {streak} and counting.",
  'Small daily wins, massive yearly changes. Keep stacking them.',
  "You don't need motivation to start - you need to start, and the motivation shows up.",
  'Discipline beats inspiration. Today you proved it again.',
  "Your future self is watching you right now through memories.",
  "One more logged workout is one more reason you won't go back.",
];

/** Returns the nearest unearned countable badge if it's genuinely close. */
function nearestBadgeTease(ctx: NotifContext): { name: string; icon: string; remaining: number; unit: string } | null {
  const unlocked = new Set(ctx.unlockedBadgeIds ?? []);
  const options: Array<{
    id: string; name: string; icon: string; remaining: number; unit: string; maxSlack: number;
  }> = [
    { id: 'streak_7', name: '7-Day Streak', icon: '🔥', remaining: 7 - ctx.streak, unit: 'days', maxSlack: 2 },
    { id: 'workouts_10', name: 'Gym Warrior', icon: '🏋️', remaining: 10 - (ctx.totalExercises ?? 0), unit: 'workouts', maxSlack: 2 },
    { id: 'workouts_50', name: 'Iron Legend', icon: '💪', remaining: 50 - (ctx.totalExercises ?? 0), unit: 'workouts', maxSlack: 5 },
    { id: 'meals_100', name: 'Meal Master', icon: '🍽️', remaining: 100 - (ctx.totalMeals ?? 0), unit: 'meals', maxSlack: 10 },
  ];
  const close = options
    .filter((o) => !unlocked.has(o.id) && o.remaining > 0 && o.remaining <= o.maxSlack)
    .sort((a, b) => a.remaining - b.remaining);
  if (close.length === 0) return null;
  const b = close[0];
  return { name: b.name, icon: b.icon, remaining: b.remaining, unit: b.unit };
}

/** A "complete" day: workout done, or most meals logged + hydration on pace. */
function dayComplete(ctx: NotifContext): boolean {
  if (ctx.exerciseCount > 0) return true;
  return (
    ctx.meals.length >= 2 &&
    ctx.targetWaterMl > 0 &&
    ctx.waterMl >= ctx.targetWaterMl * 0.5
  );
}

// --- Types ----------------------------------------------------------------
export interface NotifContext {
  now: Date;
  name: string | null;
  streak: number;
  streakAtRisk: boolean;
  meals: MealEntry[];
  exerciseCount: number;
  waterMl: number;
  targetWaterMl: number;
  targetCalories: number;
  /** Celsius from the weather cache; null when nothing fresh is cached. */
  weatherTempC: number | null;
  /** Any meal/exercise logged today (or `false` when unknown for "tomorrow"). */
  todayActive?: boolean;
  /** Any meal/exercise logged yesterday. */
  yesterdayActive?: boolean;
  /** All-time exercise entries (badge progress). */
  totalExercises?: number;
  /** All-time meal entries (badge progress). */
  totalMeals?: number;
  /** Ids of already-unlocked badges (badge tease skips earned ones). */
  unlockedBadgeIds?: string[];
}

export interface NotifMessage {
  /** Dedupe key, unique per rule (per slot for hydration). */
  key: string;
  priority: number;
  title: string;
  body: string;
}

interface DayRecord {
  keys: string[];
  lastAt: number;
  /** Keys scheduled ahead (system alarms) -> planned fire time (ms). */
  planned?: Record<string, number>;
}
type NotifLog = Record<string, DayRecord>;

/** Planned entry produced by planSchedule(). */
export interface PlannedNotification {
  key: string;
  dateKey: string;
  at: Date;
  msg: NotifMessage;
}

// --- Time helpers ---------------------------------------------------------
function hourFraction(now: Date): number {
  return now.getHours() + now.getMinutes() / 60;
}

function inWindow(h: number, start: number, end: number): boolean {
  return h >= start && h < end;
}

/** Same date-key convention as the store (UTC ISO date part). */
function dateKeyOf(now: Date): string {
  return now.toISOString().split('T')[0];
}

/**
 * First-install day: NO notification may pop on the day the app was installed
 * (user request). The install date is stamped once; while today is still that
 * date the engine plans for tomorrow only and delivers nothing. Day 2 onward
 * everything runs normally.
 */
function isInstallDay(now: Date): boolean {
  const todayKey = dateKeyOf(now);
  try {
    let boot = localStorage.getItem(BOOTSTRAP_KEY);
    if (!boot) {
      localStorage.setItem(BOOTSTRAP_KEY, todayKey);
      boot = todayKey;
    }
    return boot === todayKey;
  } catch {
    return false; // storage blocked -> behave like a normal day
  }
}

// --- Rules ----------------------------------------------------------------
/** Priority for any rule key. */
function prioOf(key: string): number {
  if (key.startsWith('milestone:')) return PRIORITY.milestone;
  if (key === 'morning_motivation') return PRIORITY.motivation;
  if (key === 'streak_risk') return PRIORITY.streak;
  if (key === 'workout_evening') return PRIORITY.workout;
  if (key === 'day_celebration') return PRIORITY.celebration;
  if (key === 'badge_tease') return PRIORITY.badge;
  if (key === 'weather_hot') return PRIORITY.weather;
  if (key.startsWith('hydration:')) return PRIORITY.hydration;
  if (key === 'greet_night') return 9; // cut first when the cap fills up
  return PRIORITY.meal; // greet_* meal check-ins
}

/** Message copy for a single rule key (no window/condition checks). */
function buildMessage(key: string, ctx: NotifContext): NotifMessage | null {
  const who = ctx.name ? `${ctx.name}, ` : '';
  const priority = prioOf(key);

  if (key.startsWith('milestone:')) {
    const n = key.slice('milestone:'.length);
    return {
      key,
      priority,
      title: `🎉 ${n}-day streak, ${ctx.name ?? 'champion'}!`,
      body: `${n} days in a row of showing up. Most people never get here - you're officially unstoppable.`,
    };
  }
  if (key === 'morning_motivation') {
    const dayIndex = Math.floor(Date.now() / 86_400_000);
    const quote = MOTIVATION_QUOTES[dayIndex % MOTIVATION_QUOTES.length];
    const streakLine = ctx.streak > 0 ? ` 🔥 Day ${ctx.streak} and counting.` : '';
    return {
      key,
      priority,
      title: `💪 Good morning${ctx.name ? `, ${ctx.name}` : ''}!`,
      body: `${quote}${streakLine}`,
    };
  }
  if (key === 'day_celebration') {
    const parts: string[] = [];
    if (ctx.exerciseCount > 0) parts.push('workout logged');
    if (ctx.meals.length >= 2) parts.push(`${ctx.meals.length} meals tracked`);
    if (ctx.targetWaterMl > 0 && ctx.waterMl >= ctx.targetWaterMl * 0.5)
      parts.push('hydration on pace');
    return {
      key,
      priority,
      title: `🏆 Day complete${ctx.name ? `, ${ctx.name}` : ''}!`,
      body: `${parts.join(', ')} - that's a win. Tomorrow's streak is already waiting to be earned.`,
    };
  }
  if (key === 'badge_tease') {
    const badge = nearestBadgeTease(ctx);
    if (!badge) return null;
    return {
      key,
      priority,
      title: `${badge.icon} ${badge.remaining} ${badge.unit} to ${badge.name}`,
      body: `So close you can taste it. ${badge.remaining === 1 ? 'One more session' : badge.remaining + ' more sessions'} unlocks it - take a look.`,
    };
  }

  switch (key) {
    case 'streak_risk':
      return {
        key,
        priority,
        title: `🔥 Your ${ctx.streak}-day streak is on the line!`,
        body: `${who}one meal or workout log today keeps the chain alive - 30 seconds is all it takes. Don't let day ${ctx.streak + 1} slip away.`,
      };
    case 'workout_evening':
      return {
        key,
        priority,
        title: `💪 ${ctx.streak}-day streak, no workout yet today`,
        body: `${who}tonight's session locks in day ${ctx.streak + 1}. Even 10 minutes counts - open Exercise Plan and take a look.`,
      };
    // The four compulsory greetings: greeting + "had your meal?" ask, daily.
    case 'greet_breakfast':
      return {
        key,
        priority,
        title: `☀️ Good morning${ctx.name ? `, ${ctx.name}` : ''}!`,
        body: `Had your breakfast yet? Even 2-3 eggs or a bowl of poha counts - log it in 30 seconds and the day is yours 🍳${
          ctx.streak > 0 ? ` (Day ${ctx.streak} streak!)` : ''
        }`,
      };
    case 'greet_lunch':
      return {
        key,
        priority,
        title: `🌤️ Good afternoon${ctx.name ? `, ${ctx.name}` : ''}!`,
        body: `Had your lunch? Rice, roti, dal - whatever was on the plate, tell the Health Logger about it 🍚 (30 seconds, promise).`,
      };
    case 'greet_evening':
      return {
        key,
        priority,
        title: `🌇 Good evening${ctx.name ? `, ${ctx.name}` : ''}!`,
        body: `Evening snack or workout time? Either way - log it and keep the day honest 💪 What did you have?`,
      };
    case 'greet_dinner':
      return {
        key,
        priority,
        title: `🌙 Dinner time${ctx.name ? `, ${ctx.name}` : ''}!`,
        body: `Had your dinner? A quick log closes the day strong and tomorrow's streak starts right here ✅`,
      };
    case 'greet_night':
      return {
        key,
        priority,
        title: `🌙 Good night${ctx.name ? `, ${ctx.name}` : ''}!`,
        body: ctx.streak > 0
          ? `Day ${ctx.streak} done. Sleep well - muscle grows while you rest, and tomorrow is day ${ctx.streak + 1} 😴`
          : `Sleep well - tomorrow we start a fresh streak. Breakfast log at 8, deal? 😴`,
      };
    case 'weather_hot':
      return {
        key,
        priority,
        title: `☀️ ${Math.round(ctx.weatherTempC ?? 0)}°C out there!`,
        body: 'Heat drains you faster - aim for an extra glass of water today, and keep your workout indoors if you can.',
      };
    default:
      if (key.startsWith('hydration:')) {
        return {
          key,
          priority,
          title: '💧 Hydration check',
          body: `${who}you're at ${ctx.waterMl} of ${ctx.targetWaterMl} ml - one glass now puts you back on pace. Muscles are ~75% water, after all.`,
        };
      }
      return null;
  }
}

function buildCandidates(ctx: NotifContext, h: number): NotifMessage[] {
  const out: NotifMessage[] = [];
  const push = (key: string) => {
    const msg = buildMessage(key, ctx);
    if (msg) out.push(msg);
  };

  // 1. Morning streak rescue (08:00 - 11:00) - only when actually at risk.
  if (inWindow(h, 8, 11) && ctx.streakAtRisk && ctx.streak > 0) {
    push('streak_risk');
  }

  // 2. Evening workout tease (18:00 - 20:30) - FOMO on losing the streak.
  if (inWindow(h, 18, 20.5) && ctx.exerciseCount === 0 && ctx.streak >= 1) {
    push('workout_evening');
  }

  // 3. Four compulsory daily greetings: greeting + "had your meal?" ask.
  // They fire every day regardless of logging state (engagement, not nagging).
  if (inWindow(h, 7.5, 10)) push('greet_breakfast');
  if (inWindow(h, 13, 15)) push('greet_lunch');
  if (inWindow(h, 17, 18.5)) push('greet_evening');
  if (inWindow(h, 19.5, 21.2)) push('greet_dinner');

  // 4. Weather moment: hot day hydration nudge (11:00 - 17:00).
  if (inWindow(h, 11, 17) && ctx.weatherTempC != null && ctx.weatherTempC >= 30) {
    push('weather_hot');
  }

  // 5. Hydration pacing (every 2h slot, 09:00 - 19:00, only if < 50% of target).
  if (
    inWindow(h, 9, 20) &&
    ctx.targetWaterMl > 0 &&
    ctx.waterMl < ctx.targetWaterMl * 0.5
  ) {
    const slot = 9 + 2 * Math.floor((h - 9) / 2); // 9, 11, 13, 15, 17, 19
    push(`hydration:${slot}`);
  }

  // 5. Morning motivation (07:00 - 08:00) - daily engagement hook, always valid.
  if (inWindow(h, 7, 8)) {
    push('morning_motivation');
  }

  // 6. Badge tease (16:00 - 18:00) - only when a badge is genuinely close.
  if (inWindow(h, 16, 18) && nearestBadgeTease(ctx)) {
    push('badge_tease');
  }

  // 7. Day celebration (21:00 - 21:54) - reward for a complete day.
  if (inWindow(h, 21, 21.9) && dayComplete(ctx)) {
    push('day_celebration');
  }

  // 8. Night greeting (21:30 - 21:58) - warm close of the day, lowest priority.
  if (inWindow(h, 21.5, 21.97)) {
    push('greet_night');
  }

  return out;
}

// --- Selection (pure - unit-testable) -------------------------------------
/**
 * Picks at most one notification to send right now, honouring quiet hours,
 * the daily cap, per-rule dedupe, and the hydration per-day limit.
 * `sentKeys` are the keys already sent today.
 */
export function selectNotification(
  ctx: NotifContext,
  sentKeys: string[]
): NotifMessage | null {
  const h = hourFraction(ctx.now);

  // Quiet hours hard block.
  if (h >= QUIET_HOURS_START || h < QUIET_HOURS_END) return null;
  if (sentKeys.length >= DAILY_CAP) return null;

  const sent = new Set(sentKeys);
  let candidates = buildCandidates(ctx, h).filter((c) => !sent.has(c.key));

  const hydrationSent = sentKeys.filter((k) => k.startsWith('hydration:')).length;
  if (hydrationSent >= HYDRATION_MAX_PER_DAY) {
    candidates = candidates.filter((c) => !c.key.startsWith('hydration:'));
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.priority - b.priority || a.key.localeCompare(b.key));
  return candidates[0];
}

// --- Date-aware rule validity (planner + reconcile) -----------------------
function dateKeyMinusDays(dateKey: string, days: number): string {
  const d = new Date(`${dateKey}T12:00:00`);
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

/**
 * Is the notification identified by `key` still worth sending on `dateKey`?
 * Uses current state as an approximation of future state (data is local-only,
 * so it can only change while the app is open - reconcile runs then).
 * `unknownIsKeep` (reconcile): keep entries whose condition can't be
 * re-evaluated (e.g. weather cache expired) instead of cancelling them.
 */
export function ruleStillValid(
  key: string,
  ctx: NotifContext,
  dateKey: string,
  todayKey: string,
  unknownIsKeep = false
): boolean {
  const isToday = dateKey === todayKey;
  const todayActive = ctx.todayActive ?? (ctx.meals.length > 0 || ctx.exerciseCount > 0);

  if (key === 'streak_risk') {
    if (isToday) {
      return (ctx.yesterdayActive ?? ctx.streakAtRisk) && !todayActive && ctx.streak > 0;
    }
    // Tomorrow only makes sense if today's log survives.
    return todayActive && ctx.streak > 0;
  }
  if (key === 'workout_evening') {
    const exercised = isToday ? ctx.exerciseCount > 0 : false;
    return !exercised && ctx.streak >= 1;
  }
  if (key.startsWith('greet_')) return true; // compulsory daily greetings
  if (key === 'weather_hot') {
    if (ctx.weatherTempC == null) return unknownIsKeep;
    return ctx.weatherTempC >= 30;
  }
  if (key.startsWith('hydration:')) {
    if (!isToday) return ctx.targetWaterMl > 0; // tomorrow starts at 0
    return ctx.targetWaterMl > 0 && ctx.waterMl < ctx.targetWaterMl * 0.5;
  }
  if (key === 'morning_motivation') return true;
  if (key === 'badge_tease') return nearestBadgeTease(ctx) != null;
  if (key === 'day_celebration') return dayComplete(ctx);
  return unknownIsKeep;
}

// --- Planner (pure) -------------------------------------------------------
const WINDOW_ENDS_H: Record<string, number> = {
  streak_risk: 11,
  greet_breakfast: 10,
  greet_lunch: 15,
  greet_evening: 18.5,
  greet_dinner: 21.2,
  greet_night: 21.97,
  weather_hot: 17,
  workout_evening: 20.5,
  morning_motivation: 8,
  badge_tease: 18,
  day_celebration: 21.9,
};

function windowStartOf(key: string): number {
  if (key.startsWith('hydration:')) return parseInt(key.split(':')[1], 10);
  if (key === 'streak_risk') return 8;
  if (key === 'greet_breakfast') return 7.5;
  if (key === 'greet_lunch') return 13;
  if (key === 'greet_evening') return 17;
  if (key === 'greet_dinner') return 19.5;
  if (key === 'greet_night') return 21.5;
  if (key === 'weather_hot') return 11;
  if (key === 'workout_evening') return 18;
  if (key === 'morning_motivation') return 7;
  if (key === 'badge_tease') return 16;
  if (key === 'day_celebration') return 21;
  return 0;
}
function windowEndOf(key: string): number {
  if (key.startsWith('hydration:')) return windowStartOf(key) + 1;
  return WINDOW_ENDS_H[key] ?? 0;
}

function hourAt(dateKey: string, h: number): Date {
  const d = new Date(`${dateKey}T00:00:00`);
  d.setHours(Math.floor(h), Math.round((h % 1) * 60), 0, 0);
  return d;
}

/** Every plannable rule key (milestone is event-driven and excluded). */
const ALL_PLAN_KEYS = [
  'morning_motivation',
  'greet_breakfast',
  'streak_risk',
  'hydration:9',
  'hydration:11',
  'weather_hot',
  'greet_lunch',
  'hydration:13',
  'hydration:15',
  'badge_tease',
  'greet_evening',
  'workout_evening',
  'greet_dinner',
  'hydration:17',
  'hydration:19',
  'day_celebration',
  'greet_night',
];

/**
 * Plans notifications for the rest of `now`'s day plus tomorrow, applying the
 * same guardrails as the live tick (quiet hours, daily cap, 45-min gap,
 * per-rule dedupe, hydration max 2). Selection is priority-weighted so the
 * engagement layer (motivation, celebration) and evening windows are never
 * crowded out by morning rules; times are then assigned chronologically.
 */
export function planSchedule(
  ctx: NotifContext,
  log: NotifLog,
  now: Date,
  skipToday = false
): PlannedNotification[] {
  const todayKey = dateKeyOf(now);
  const tomorrowKey = dateKeyMinusDays(todayKey, -1);
  const out: PlannedNotification[] = [];

  const planDay = (dateKey: string, isToday: boolean): void => {
    const dayLog = log[dateKey];
    const sentKeys = dayLog?.keys ?? [];
    const sentSet = new Set(sentKeys);
    const sentCount = sentKeys.length;
    const hydrationSent = sentKeys.filter((k) => k.startsWith('hydration:')).length;
    // Gap base: last actual send today (planned entries were purged upstream).
    let lastAt =
      isToday && dayLog?.lastAt && dayLog.lastAt <= now.getTime() ? dayLog.lastAt : 0;

    // Phase 1: valid candidates with preferred fire times.
    interface Cand {
      key: string;
      preferredMs: number;
      endMs: number;
      priority: number;
    }
    const cands: Cand[] = [];
    for (const key of ALL_PLAN_KEYS) {
      if (sentSet.has(key)) continue;
      if (!ruleStillValid(key, ctx, dateKey, todayKey, false)) continue;
      if (key.startsWith('hydration:') && hydrationSent >= HYDRATION_MAX_PER_DAY) continue;
      const preferredMs = Math.max(
        hourAt(dateKey, windowStartOf(key)).getTime(),
        // Never fire within the first few minutes — opening the app must not
        // immediately pop a notification.
        now.getTime() + 5 * 60_000
      );
      const endMs = hourAt(dateKey, windowEndOf(key)).getTime();
      if (preferredMs >= endMs) continue; // window already past
      cands.push({ key, preferredMs, endMs, priority: prioOf(key) });
    }

    // Phase 2: priority-weighted selection up to the remaining daily cap.
    cands.sort((a, b) => a.priority - b.priority || a.preferredMs - b.preferredMs);
    const chosen = cands.slice(0, Math.max(0, DAILY_CAP - sentCount));

    // Phase 3: schedule chronologically, enforcing the 45-min gap.
    chosen.sort((a, b) => a.preferredMs - b.preferredMs);
    for (const c of chosen) {
      const atMs = Math.max(c.preferredMs, lastAt > 0 ? lastAt + MIN_GAP_MS : 0);
      if (atMs >= c.endMs) continue; // gap-shift pushed it out of its window
      const msg = buildMessage(c.key, ctx);
      if (!msg) continue;
      lastAt = atMs;
      out.push({ key: c.key, dateKey, at: new Date(atMs), msg });
    }
  };

  planDay(tomorrowKey, false);
  if (!skipToday) planDay(todayKey, true);
  out.sort((a, b) => a.at.getTime() - b.at.getTime());
  return out;
}

// --- Persistent log -------------------------------------------------------
function loadLog(): NotifLog {
  try {
    const raw = localStorage.getItem(LOG_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as NotifLog) : {};
  } catch {
    return {};
  }
}

function saveLog(log: NotifLog): void {
  try {
    localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(log));
  } catch {
    // Storage unavailable (private mode) - dedupe degrades to in-memory-less,
    // worst case a rule can repeat across sessions. Not worth crashing over.
  }
}

/** Drop records older than 48h so the log stays tiny. */
function pruneLog(log: NotifLog): NotifLog {
  const cutoff = Date.now() - 48 * 60 * 60 * 1000;
  const out: NotifLog = {};
  for (const [key, record] of Object.entries(log)) {
    if (!record || typeof record.lastAt !== 'number') continue;
    const hasRecentPlanned = Object.values(record.planned ?? {}).some(
      (at) => at >= cutoff
    );
    if (record.lastAt >= cutoff || hasRecentPlanned) {
      out[key] = record;
    }
  }
  return out;
}

// --- Delivery -------------------------------------------------------------
const CHANNEL_ID = 'gymathome-reminders';
// Branding: status-bar silhouette, round logo large icon, brand-green accent.
const BRAND_GREEN = '#006C49';
const NOTIF_ICONS = {
  smallIcon: 'ic_gymathome_stat',
  largeIcon: 'gymathome_logo_round',
  iconColor: BRAND_GREEN,
} as const;
/** Exact-alarm permission cache (Android 12+); inexact fallback when false. */
let exactOk = false;
let setupDone = false;
/**
 * True only after the user actually granted POST_NOTIFICATIONS.
 * @capacitor/local-notifications 8.3+ makes `schedule()` request the OS dialog
 * by itself, so every call that can reach the system (channel + schedule) is
 * gated on this. Without it the dialog pops on app launch / profile setup.
 */
let permGranted = false;

function isNative(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/** Stable 31-bit FNV-1a hash -> Android notification id for dateKey:key. */
function idFor(dateKey: string, key: string): number {
  const s = `${dateKey}:${key}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 2147483647;
}

/** Reads the granted state without ever prompting the OS. */
async function readPermission(): Promise<boolean> {
  try {
    const p = await LocalNotifications.checkPermissions();
    permGranted = p.display === 'granted';
  } catch {
    permGranted = false;
  }
  return permGranted;
}

/**
 * One-time native setup: heads-up channel + exact-alarm check.
 * Returns false (and touches nothing) until the user grants notifications.
 * IMPORTANT: this never requests the OS permission — that prompt is shown
 * exactly once, from the Permissions screen (together with location).
 */
async function ensureNativeSetup(): Promise<boolean> {
  if (!isNative()) return false;
  if (setupDone) return permGranted;
  // Check BEFORE creating the channel or scheduling anything: the plugin's
  // schedule() triggers the POST_NOTIFICATIONS dialog on its own.
  if (!(await readPermission())) return false;
  try {
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: 'Gym at Home Reminders',
      description: 'Streak, meal, hydration and motivation reminders',
      importance: 4, // HIGH -> heads-up banner like Zomato
      visibility: 1, // show on lock screen
      vibration: true,
    });
  } catch {
    // Non-fatal: default channel still works.
  }
  try {
    const s = await LocalNotifications.checkExactNotificationSetting();
    exactOk = s.exact_alarm === 'granted';
  } catch {
    exactOk = false; // inexact alarm: fires within ~15 min of target
  }
  setupDone = true;
  return true;
}

/** Schedule one notification into the Android system tray at `at`. */
async function scheduleNative(dateKey: string, msg: NotifMessage, at: Date): Promise<boolean> {
  // Re-read first: if the user revoked access, schedule() would re-open the
  // permission dialog. Skip instead — delivered on a later tick if granted.
  if (!(await readPermission())) return false;
  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: idFor(dateKey, msg.key),
          title: msg.title,
          body: msg.body,
          channelId: CHANNEL_ID,
          foreground: true, // heads-up even while app is open
          autoCancel: true,
          group: 'gymathome',
          ...NOTIF_ICONS,
          schedule: { at, allowWhileIdle: true },
          isExactNotification: exactOk,
          extra: { key: msg.key, dateKey },
        },
      ],
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Deliver now (or at `at`): native system tray first; web Notification;
 * in-app toast only as last resort while visible. Returns true when surfaced.
 */
async function deliverAt(dateKey: string, msg: NotifMessage, at: Date): Promise<boolean> {
  if (isNative()) return scheduleNative(dateKey, msg, at);
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(msg.title, {
        body: msg.body,
        icon: '/favicon.ico',
        tag: 'gymathome-reminder',
      });
      return true;
    } catch {
      // Fall through to toast.
    }
  }
  if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
    showToast(`${msg.title} ${msg.body}`, 'info', 6000);
    return true;
  }
  return false;
}

// --- Plan / reconcile (native) -------------------------------------------
/** Remove not-yet-fired planned entries from the log (they were cancelled). */
function purgeFuture(log: NotifLog): NotifLog {
  const now = Date.now();
  for (const rec of Object.values(log)) {
    if (!rec.planned) continue;
    for (const [key, at] of Object.entries(rec.planned)) {
      if (at > now) {
        rec.keys = rec.keys.filter((k) => k !== key);
        delete rec.planned[key];
      }
    }
  }
  return log;
}

/**
 * Fold planned entries whose fire time has passed into `lastAt` - they fired
 * (or were missed) while the app was closed, and the gap guard must count
 * them. Past planned keys stay in `keys` (dedupe) but leave `planned`.
 */
function foldPastPlanned(rec: DayRecord, nowMs: number): void {
  if (!rec.planned) return;
  for (const [key, at] of Object.entries(rec.planned)) {
    if (at <= nowMs) {
      if (at > rec.lastAt) rec.lastAt = at;
      delete rec.planned[key];
    }
  }
}

/**
 * Cancel pending system notifications whose condition no longer holds (e.g.
 * the user just logged lunch, so the 14:00 lunch nudge is pointless).
 */
async function reconcile(base: NotifContext): Promise<void> {
  if (!isNative()) return;
  try {
    const { notifications } = await LocalNotifications.getPending();
    if (notifications.length === 0) return;
    const log = pruneLog(loadLog());
    const todayKey = dateKeyOf(new Date());
    const nowMs = Date.now();
    const toCancel: number[] = [];
    for (const n of notifications) {
      const extra = (n.extra ?? {}) as { key?: string; dateKey?: string };
      const { key, dateKey } = extra;
      if (!key || !dateKey) {
        toCancel.push(n.id);
        continue;
      }
      const rawAt = n.schedule?.at;
      const atMs = rawAt instanceof Date ? rawAt.getTime() : 0;
      const past = atMs > 0 && atMs < nowMs - 5 * 60_000;
      const valid = ruleStillValid(key, base, dateKey, todayKey, true);
      if (past || !valid) {
        toCancel.push(n.id);
        const rec = log[dateKey];
        if (rec?.planned && !past) delete rec.planned[key]; // keep key in `keys`
      }
    }
    if (toCancel.length > 0) {
      await LocalNotifications.cancel({ notifications: toCancel.map((id) => ({ id })) });
      saveLog(log);
    }
  } catch {
    // Never let reconcile break the tick.
  }
}

/**
 * Replan: cancel everything pending, purge stale plan records, then schedule
 * the rest of today + tomorrow into the Android alarm manager. Alarms fire
 * with the app closed (and survive reboot via the plugin's restore receiver).
 */
async function runPlan(base: NotifContext): Promise<void> {
  if (!isNative()) return;
  try {
    if (!(await ensureNativeSetup())) return; // no permission yet — arm nothing
    await LocalNotifications.cancelAll();
    const log = purgeFuture(pruneLog(loadLog()));
    const now = new Date();
    // Install day: arm tomorrow's alarms only — nothing pops today.
    const planned = planSchedule(base, log, now, isInstallDay(now));
    if (planned.length === 0) {
      saveLog(log);
      return;
    }
    await LocalNotifications.schedule({
      notifications: planned.map((p) => ({
        id: idFor(p.dateKey, p.key),
        title: p.msg.title,
        body: p.msg.body,
        channelId: CHANNEL_ID,
        foreground: true,
        autoCancel: true,
        group: 'gymathome',
        ...NOTIF_ICONS,
        schedule: { at: p.at, allowWhileIdle: true },
        isExactNotification: exactOk,
        extra: { key: p.key, dateKey: p.dateKey },
      })),
    });
    for (const p of planned) {
      const rec = (log[p.dateKey] ??= { keys: [], lastAt: 0 });
      if (!rec.keys.includes(p.key)) rec.keys.push(p.key);
      (rec.planned ??= {})[p.key] = p.at.getTime();
    }
    saveLog(log);
  } catch {
    // Planning is best-effort; the live tick still covers due-now cases.
  }
}

// --- Milestone celebrations (event-driven) --------------------------------
const MILESTONES_STORAGE_KEY = 'gymathome.notif.milestones';

function loadCelebratedMilestones(): number[] {
  try {
    const raw = localStorage.getItem(MILESTONES_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as number[]) : [];
  } catch {
    return [];
  }
}

function markMilestoneCelebrated(n: number): void {
  try {
    const list = loadCelebratedMilestones();
    if (!list.includes(n)) list.push(n);
    localStorage.setItem(MILESTONES_STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Best-effort: worst case it re-celebrates after storage clears.
  }
}

// --- Hook -----------------------------------------------------------------
const TICK_MS = 60_000;

export function useNotificationEngine(): void {
  const {
    hydrated,
    profile,
    calculations,
    meals: allMeals,
    exercises: allExercises,
    badges,
    getMealsForDate,
    getExercisesForDate,
    getWaterForDate,
  } = useStore();
  const streak = useStreakInfo();

  const today = dateKeyOf(new Date());
  const yesterdayKey = dateKeyMinusDays(today, 1);
  const ctx: NotifContext | null = hydrated
    ? {
        now: new Date(),
        name: profile.name,
        streak: streak.current,
        streakAtRisk: streak.atRisk,
        meals: getMealsForDate(today),
        exerciseCount: getExercisesForDate(today).length,
        waterMl: getWaterForDate(today),
        targetWaterMl: Math.round((calculations?.hydration || DEFAULT_HYDRATION_L) * 1000),
        targetCalories: calculations?.targetCalories || 0,
        weatherTempC: peekCachedTemperature(),
        todayActive:
          getMealsForDate(today).length > 0 || getExercisesForDate(today).length > 0,
        yesterdayActive:
          getMealsForDate(yesterdayKey).length > 0 ||
          getExercisesForDate(yesterdayKey).length > 0,
        totalExercises: allExercises.length,
        totalMeals: allMeals.length,
        unlockedBadgeIds: badges.map((b) => b.id),
      }
    : null;

  // Latest context readable from interval callbacks.
  const ctxRef = useRef<NotifContext | null>(null);
  ctxRef.current = ctx;

  const runCheck = useCallback(async () => {
    const base = ctxRef.current;
    if (!base) return;
    // Native app: delivery is the job of the pre-armed system alarms. Never
    // deliver from the live tick while the app is open — otherwise opening or
    // backgrounding the app fires a notification at the user.
    if (
      isNative() &&
      typeof document !== 'undefined' &&
      document.visibilityState === 'visible'
    ) {
      return;
    }
    try {
      if (!(await ensureNativeSetup())) return; // silent until permission granted
      await reconcile(base);
      const now = new Date();
      const todayKey = dateKeyOf(now);
      if (isInstallDay(now)) return; // silent install day — nothing delivers today
      const log = pruneLog(loadLog());
      const record: DayRecord = (log[todayKey] ??= { keys: [], lastAt: 0 });
      foldPastPlanned(record, now.getTime());

      // Milestone celebration: earned moment - bypasses windows and the gap
      // guard (but respects quiet hours, the daily cap, and global dedupe).
      const todayActive =
        base.todayActive ?? (base.meals.length > 0 || base.exerciseCount > 0);
      const milestone =
        todayActive && STREAK_MILESTONES.includes(base.streak) ? base.streak : 0;
      const h = hourFraction(now);
      const inQuiet = h >= QUIET_HOURS_START || h < QUIET_HOURS_END;
      if (
        milestone > 0 &&
        !inQuiet &&
        record.keys.length < DAILY_CAP &&
        !loadCelebratedMilestones().includes(milestone)
      ) {
        const mkey = `milestone:${milestone}`;
        const msg = buildMessage(mkey, base);
        if (msg && (await deliverAt(todayKey, msg, new Date(now.getTime() + 1000)))) {
          record.keys.push(mkey);
          record.lastAt = now.getTime();
          markMilestoneCelebrated(milestone);
          saveLog(log);
        }
      }

      // Cadence guard: minimum gap between ANY two sent notifications.
      if (record.lastAt > 0 && now.getTime() - record.lastAt < MIN_GAP_MS) {
        saveLog(log);
        return;
      }

      const msg = selectNotification({ ...base, now }, record.keys);
      if (!msg) {
        saveLog(log);
        return;
      }

      // Only record when actually delivered - otherwise retry next tick.
      if (!(await deliverAt(todayKey, msg, new Date(now.getTime() + 1000)))) return;

      log[todayKey] = { ...record, keys: [...record.keys, msg.key], lastAt: now.getTime() };
      saveLog(log);
    } catch {
      // The engine must never break the app.
    }
  }, []);

  const runPlanNow = useCallback(() => {
    const base = ctxRef.current;
    if (base) void runPlan(base);
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    const start = async () => {
      await ensureNativeSetup(); // channel + exact alarm only — no permission prompt
      runPlanNow(); // arm system alarms; nothing is delivered on launch
    };
    void start();

    const interval = window.setInterval(() => void runCheck(), TICK_MS);
    // Returning to the app only re-arms future alarms — it never pops anything.
    const onVisibility = () => runPlanNow();
    document.addEventListener('visibilitychange', onVisibility);
    // The Permissions screen fires this after the user grants access, so alarms
    // get armed immediately instead of waiting for the next app launch.
    const onPermissionsChanged = () => runPlanNow();
    window.addEventListener('gymathome:permissions-changed', onPermissionsChanged);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('gymathome:permissions-changed', onPermissionsChanged);
    };
  }, [hydrated, runCheck, runPlanNow]);
}
