'use client';

import { CalendarDays, Grid3X3 } from 'lucide-react';
import { localDateKey } from '@/lib/date';
import {
  HEAT_LEGEND,
  RANGE_LABEL,
  heatColorClass,
  heatSummary,
  toMonthGrids,
  toWeeks,
  type HeatDay,
  type HeatKind,
  type HeatRange,
} from '@/lib/heatmap';

interface HeatmapProps {
  days: HeatDay[];
  range: HeatRange;
  onRangeChange: (range: HeatRange) => void;
  kind: HeatKind;
  onKindChange: (kind: HeatKind) => void;
  unit?: string;
  compact?: boolean;
  showSummary?: boolean;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const dayTitle = (day: HeatDay, unit: string) => {
  const date = day.date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  if (day.future) return date;
  if (day.value <= 0) return `${date} — no ${unit}`;
  return `${date} — ${Math.round(day.value * 100)}%`;
};

export default function Heatmap({
  days,
  range,
  onRangeChange,
  kind,
  onKindChange,
  unit = 'activity',
  compact = false,
  showSummary = true,
}: HeatmapProps) {
  const cell = compact ? 'h-7 w-7 text-[10px]' : 'h-9 w-9 text-[11px]';
  const todayKey = localDateKey();

  const legend = (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-on-surface-variant">Less</span>
      {HEAT_LEGEND.map((value) => (
        <span key={value} className={`h-3 w-3 rounded-[3px] ${heatColorClass(value)}`} />
      ))}
      <span className="text-[10px] text-on-surface-variant">More</span>
    </div>
  );

  const controls = (
    <div className="flex items-center gap-2">
      <select
        value={range}
        onChange={(event) => onRangeChange(event.target.value as HeatRange)}
        aria-label="Heatmap range"
        className="h-8 rounded-lg border border-outline-variant/60 bg-surface px-2 text-[11px] font-semibold text-on-surface focus:border-primary focus:outline-none"
      >
        {(['7d', 'month', 'year'] as HeatRange[]).map((value) => (
          <option key={value} value={value}>
            {RANGE_LABEL[value]}
          </option>
        ))}
      </select>
      <div className="inline-flex overflow-hidden rounded-lg border border-outline-variant/60">
        <button
          type="button"
          onClick={() => onKindChange('calendar')}
          aria-label="Calendar view"
          aria-pressed={kind === 'calendar'}
          title="Calendar view"
          className={`flex h-8 w-8 items-center justify-center transition-colors ${
            kind === 'calendar'
              ? 'bg-primary text-on-primary'
              : 'bg-surface text-on-surface-variant hover:bg-surface-container'
          }`}
        >
          <CalendarDays size={14} />
        </button>
        <button
          type="button"
          onClick={() => onKindChange('grid')}
          aria-label="Grid view"
          aria-pressed={kind === 'grid'}
          title="Grid view"
          className={`flex h-8 w-8 items-center justify-center transition-colors ${
            kind === 'grid'
              ? 'bg-primary text-on-primary'
              : 'bg-surface text-on-surface-variant hover:bg-surface-container'
          }`}
        >
          <Grid3X3 size={14} />
        </button>
      </div>
    </div>
  );

  // ── Calendar cells (day numbers, like a wall calendar) ────────────────────
  const calendarCell = (day: HeatDay | null, sizeClass: string) => {
    if (!day) return <span className={sizeClass} aria-hidden />;
    return (
      <span
        key={day.key}
        title={dayTitle(day, unit)}
        className={`flex items-center justify-center font-semibold ${sizeClass} ${
          day.future
            ? 'bg-surface-container/40 text-outline/40'
            : `${heatColorClass(day.value)} ${day.value > 0.67 ? 'text-on-primary' : 'text-on-surface'}`
        } ${day.key === todayKey ? 'ring-2 ring-primary ring-offset-1 ring-offset-surface' : ''}`}
      >
        {day.date.getDate()}
      </span>
    );
  };

  const monthCalendar = (list: HeatDay[]) => {
    const weeks = toWeeks(list);
    return (
      <div className="inline-grid gap-1">
        <div className="grid grid-cols-7 gap-1">
          {WEEKDAYS.map((d) => (
            <span key={d} className="text-center text-[9px] font-semibold uppercase tracking-wide text-on-surface-variant">
              {d.slice(0, 1)}
            </span>
          ))}
        </div>
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-1">
            {week.map((day, di) => calendarCell(day, `${cell} rounded-[5px]`))}
          </div>
        ))}
      </div>
    );
  };

  const yearCalendar = () => {
    const grids = toMonthGrids(days);
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {grids.map(({ month, weeks }) => (
          <div key={month}>
            <p className="mb-1.5 text-[11px] font-bold text-on-surface">
              {new Date(days[0].date.getFullYear(), month, 1).toLocaleDateString('en-US', { month: 'long' })}
            </p>
            <div className="inline-grid gap-[3px]">
              {weeks.map((week, wi) => (
                <div key={wi} className="grid grid-cols-7 gap-[3px]">
                  {week.map((day) => calendarCell(day, 'h-5 w-5 text-[8px] rounded-[3px]'))}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const weekCalendar = () => (
    <div className="flex flex-wrap gap-2">
      {days.map((day) => (
        <div key={day.key} className="flex flex-col items-center gap-1">
          <span className="text-[10px] font-semibold uppercase text-on-surface-variant">
            {day.date.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 3)}
          </span>
          <span
            title={dayTitle(day, unit)}
            className={`flex items-center justify-center font-semibold ${compact ? 'h-9 w-9' : 'h-11 w-11'} rounded-lg ${
              day.future
                ? 'bg-surface-container/40 text-outline/40'
                : `${heatColorClass(day.value)} ${day.value > 0.67 ? 'text-on-primary' : 'text-on-surface'}`
            }`}
          >
            {day.date.getDate()}
          </span>
        </div>
      ))}
    </div>
  );

  const weekGrid = () => (
    <div className="flex flex-wrap gap-2">
      {days.map((day) => (
        <span
          key={day.key}
          title={dayTitle(day, unit)}
          className={`${compact ? 'h-9 w-9' : 'h-11 w-11'} rounded-lg ${heatColorClass(day.value)} ${
            day.key === todayKey ? 'ring-2 ring-primary ring-offset-1 ring-offset-surface' : ''
          }`}
        />
      ))}
    </div>
  );

  // ── GitHub-style grid (no numbers) ────────────────────────────────────────
  const grid = () => {
    const weeks = toWeeks(days);
    const gridCell = range === 'year' ? 'h-3 w-3' : compact ? 'h-6 w-6' : 'h-7 w-7';
    const gridCellH = range === 'year' ? 'h-3' : compact ? 'h-6' : 'h-7';
    return (
      <div className="flex gap-2">
        <div className="flex flex-col gap-[3px]">
          {['Mon', '', 'Wed', '', 'Fri', '', ''].map((d, i) => (
            <span key={i} className={`flex ${gridCellH} items-center text-[9px] leading-none text-on-surface-variant`}>
              {d}
            </span>
          ))}
        </div>
        <div className="overflow-x-auto pb-1">
          <div className="flex gap-[3px]">
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-[3px]">
                {week.map((day, di) =>
                  day ? (
                    <span
                      key={day.key}
                      title={dayTitle(day, unit)}
                      className={`${gridCell} rounded-[3px] ${heatColorClass(day.value)} ${
                        day.key === todayKey ? 'ring-1 ring-primary' : ''
                      }`}
                    />
                  ) : (
                    <span key={`e-${wi}-${di}`} className={`${gridCell}`} aria-hidden />
                  )
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const body = () => {
    if (range === '7d') return kind === 'calendar' ? weekCalendar() : weekGrid();
    if (kind === 'calendar') return range === 'year' ? yearCalendar() : monthCalendar(days);
    return grid();
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {controls}
        {showSummary && (
          <p className="text-[11px] font-medium text-on-surface-variant">{heatSummary(days, unit)}</p>
        )}
      </div>
      <div className="overflow-x-auto">{body()}</div>
      <div className="flex items-center justify-between gap-3 border-t border-outline-variant/50 pt-2.5">
        {legend}
        <span className="text-[10px] text-on-surface-variant">
          {range === 'year' ? '12 months' : range === 'month' ? 'This month' : 'Last 7 days'}
        </span>
      </div>
    </div>
  );
}
