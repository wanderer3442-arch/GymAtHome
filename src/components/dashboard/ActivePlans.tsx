'use client';

import { UtensilsCrossed, Dumbbell, TrendingUp, ChevronRight } from 'lucide-react';
import Link from 'next/link';

interface Plan {
  id: string;
  type: 'meal' | 'exercise';
  title: string;
  progress: number;
  total: number;
  subtitle: string;
}

const activePlans: Plan[] = [
  {
    id: 'meal-plan-1',
    type: 'meal',
    title: 'High Protein Meal Plan',
    progress: 5,
    total: 7,
    subtitle: 'Day 5 of 7',
  },
  {
    id: 'exercise-plan-1',
    type: 'exercise',
    title: 'Strength Training Program',
    progress: 3,
    total: 5,
    subtitle: 'Week 3 of 8',
  },
];

const typeIcons = {
  meal: <UtensilsCrossed className="w-5 h-5" />,
  exercise: <Dumbbell className="w-5 h-5" />,
};

const typeColors = {
  meal: 'bg-tertiary/10 text-tertiary',
  exercise: 'bg-primary/10 text-primary',
};

export default function ActivePlans() {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-headline-md font-semibold text-on-surface">Active Plans</h2>
        <Link href="/meal-plan" className="text-sm text-secondary hover:text-secondary/80 font-medium flex items-center gap-1">
          View All <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="space-y-3">
        {activePlans.map((plan) => (
          <Link
            key={plan.id}
            href={plan.type === 'meal' ? '/meal-plan' : '/exercise-plan'}
            className="block p-4 rounded-xl bg-surface-container hover:bg-surface-container-high transition-colors"
          >
            <div className="flex items-start gap-3">
              <div className={`p-2.5 rounded-lg ${typeColors[plan.type]}`}>
                {typeIcons[plan.type]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-on-surface truncate">{plan.title}</p>
                <p className="text-xs text-on-surface-variant mt-0.5">{plan.subtitle}</p>
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-on-surface-variant">Progress</span>
                    <span className="text-xs font-medium text-on-surface">
                      {plan.progress}/{plan.total}
                    </span>
                  </div>
                  <div className="h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        plan.type === 'meal' ? 'bg-tertiary' : 'bg-primary'
                      }`}
                      style={{ width: `${plan.total > 0 ? Math.min((plan.progress / plan.total) * 100, 100) : 0}%` }}
                    />
                  </div>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-on-surface-variant shrink-0 mt-1" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
