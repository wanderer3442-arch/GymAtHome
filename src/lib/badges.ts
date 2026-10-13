import { Badge } from './types';

export type BadgeDef = Pick<Badge, 'id' | 'name' | 'description' | 'icon' | 'condition'>;

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
    id: 'streak_7',
    name: '7-Day Streak',
    description: 'Logged meals or exercises for 7 consecutive days',
    icon: '\uD83D\uDD25',
    condition: 'streak_7',
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
