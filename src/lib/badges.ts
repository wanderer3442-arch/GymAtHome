import { Badge } from './types';

export type BadgeDef = Pick<Badge, 'id' | 'name' | 'description' | 'icon' | 'condition'>;

/** One badge that levels up as the streak grows (never a new badge per tier). */
export const STREAK_BADGE_ID = 'streak';

export interface StreakTier {
  days: number;
  name: string;
  description: string;
  icon: string;
}

export const STREAK_TIERS: StreakTier[] = [
  { days: 3, name: 'Spark', description: '3 days of logging in a row', icon: '\uD83C\uDF31' },
  { days: 7, name: 'Week Warrior', description: '7 days of logging in a row', icon: '\uD83D\uDD25' },
  { days: 14, name: 'Fortnight Force', description: '14 days of logging in a row', icon: '\u26A1' },
  { days: 30, name: 'Monthly Machine', description: '30 days of logging in a row', icon: '\uD83C\uDFC5' },
  { days: 60, name: 'Iron Habit', description: '60 days of logging in a row', icon: '\uD83D\uDCAA' },
  { days: 100, name: 'Century Club', description: '100 days of logging in a row', icon: '\uD83D\uDCAF' },
  { days: 365, name: 'Year of Discipline', description: '365 days of logging in a row', icon: '\uD83D\uDC51' },
];

/** Highest tier reached for a streak length, or -1 below the first tier. */
export function streakTierIndex(days: number): number {
  let index = -1;
  STREAK_TIERS.forEach((tier, i) => {
    if (days >= tier.days) index = i;
  });
  return index;
}

/** Single source of truth for all badge metadata. Unlock logic lives in store-context. */
export const BADGE_CATALOG: BadgeDef[] = [
  {
    id: 'first_meal',
    name: 'First Bite',
    description: 'Logged your first meal',
    icon: '\uD83C\uDF1F',
    condition: 'first_meal',
  },
  {
    id: 'first_workout',
    name: 'First Rep',
    description: 'Completed your first workout',
    icon: '\u26A1',
    condition: 'first_workout',
  },
  {
    id: STREAK_BADGE_ID,
    name: STREAK_TIERS[0].name,
    description: STREAK_TIERS[0].description,
    icon: STREAK_TIERS[0].icon,
    condition: 'streak',
  },
  {
    id: 'water_7',
    name: 'Hydration Hero',
    description: 'Tracked water intake for 7 days',
    icon: '\uD83D\uDCA7',
    condition: 'water_7',
  },
  {
    id: 'protein_5',
    name: 'Protein Pro',
    description: 'Hit protein target 5 days in 30',
    icon: '\uD83E\uDD69',
    condition: 'protein_5',
  },
  {
    id: 'workouts_10',
    name: 'Gym Warrior',
    description: 'Completed 10 workouts',
    icon: '\uD83C\uDFCB\uFE0F',
    condition: 'workouts_10',
  },
  {
    id: 'meals_100',
    name: 'Meal Master',
    description: 'Logged 100 meals',
    icon: '\uD83C\uDF7D\uFE0F',
    condition: 'meals_100',
  },
  {
    id: 'workouts_50',
    name: 'Iron Legend',
    description: 'Completed 50 workouts',
    icon: '\uD83D\uDCAA',
    condition: 'workouts_50',
  },
];
