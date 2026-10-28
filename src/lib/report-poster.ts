/**
 * Gym at Home poster pages.
 * The same rendered pages feed the on-screen preview and the PDF, so the
 * Download Hub is WYSIWYG. Long sections continue onto extra pages instead of
 * shrinking type — the result should be printable and wall-worthy.
 */

import jsPDF from 'jspdf';
import type { ReportModel } from './report-model';
import {
  C,
  CONTENT_BOTTOM,
  CW,
  M,
  PH,
  PW,
  Sheet,
  card,
  donut,
  fillRR,
  font,
  footer,
  hGrad,
  monthCalendar,
  legendSwatches,
  num,
  pill,
  roundRect,
  sectionHeader,
  segmentedBar,
  spaced,
  strokeRR,
  text,
  tile,
  truncate,
  vGrad,
  weekChart,
  weightChart,
} from './report-canvas';

class Flow {
  sheets: Sheet[] = [];
  s: Sheet;
  y: number;

  constructor(
    private model: ReportModel,
    private kicker: string,
    private title: string
  ) {
    this.s = new Sheet('page');
    sectionHeader(this.s, kicker, title, `${model.name} · ${model.periodLabel}`);
    this.sheets.push(this.s);
    this.y = 118;
  }

  ensure(height: number) {
    if (this.y + height <= CONTENT_BOTTOM) return;
    this.s = new Sheet('page');
    sectionHeader(
      this.s,
      this.kicker,
      `${this.title} · continued`,
      `${this.model.name} · ${this.model.periodLabel}`
    );
    this.sheets.push(this.s);
    this.y = 118;
  }

  get ctx() {
    return this.s.ctx;
  }
}

// ─── Cover ──────────────────────────────────────────────────────────────────
let logoPromise: Promise<HTMLImageElement | null> | null = null;

/** Load the app icon once; the poster renderer is otherwise synchronous. */
function loadLogo(): Promise<HTMLImageElement | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (!logoPromise) {
    logoPromise = new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = '/logo.png';
    });
  }
  return logoPromise;
}

function coverPage(m: ReportModel, logo: HTMLImageElement | null): Sheet {
  const s = new Sheet('cover');
  const { ctx } = s;
  const HERO = 340;

  const hero = ctx.createLinearGradient(0, 0, PW, HERO);
  hero.addColorStop(0, '#043024');
  hero.addColorStop(0.42, '#006c49');
  hero.addColorStop(0.76, '#0a9767');
  hero.addColorStop(1, '#1cc488');
  ctx.fillStyle = hero;
  ctx.fillRect(0, 0, PW, HERO);

  // soft light pools
  const pool = (cx: number, cy: number, r: number, color: string) => {
    const g = ctx.createRadialGradient(cx, cy, 1, cx, cy, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, PW, HERO);
  };
  pool(PW - 40, 20, 220, 'rgba(163,230,53,0.30)');
  pool(PW - 120, 300, 170, 'rgba(255,255,255,0.12)');
  pool(20, 360, 190, 'rgba(0,20,12,0.35)');

  // brand row — the real app icon, not a letter mark
  if (logo) {
    ctx.save();
    roundRect(ctx, M, 28, 34, 34, 10);
    ctx.clip();
    ctx.drawImage(logo, M, 28, 34, 34);
    ctx.restore();
    strokeRR(ctx, M, 28, 34, 34, 10, 'rgba(255,255,255,0.40)', 1);
  } else {
    fillRR(ctx, M, 28, 34, 34, 10, 'rgba(255,255,255,0.16)');
    strokeRR(ctx, M, 28, 34, 34, 10, 'rgba(255,255,255,0.40)', 1);
    text(ctx, 'V', M + 17, 50.5, 16, 800, '#ffffff', 'center');
  }
  spaced(ctx, 'GYM AT HOME', M + 44, 43, 9, 800, 'rgba(255,255,255,0.97)', 2);
  text(ctx, 'HEALTH & FITNESS PROTOCOL', M + 44, 55, 6.4, 600, 'rgba(255,255,255,0.62)');

  text(ctx, m.dateLabel, PW - M, 43, 8.5, 700, 'rgba(255,255,255,0.94)', 'right');
  text(ctx, `GAH-${m.reportId}`, PW - M, 55, 7, 500, 'rgba(255,255,255,0.55)', 'right');

  // title block
  spaced(ctx, 'YOUR PERSONAL', M, 122, 9.5, 700, 'rgba(255,255,255,0.60)', 2.6);
  text(ctx, 'Health Protocol', M, 164, 34, 800, '#ffffff');
  text(ctx, m.name, M, 190, 14, 700, '#a7f3d0');

  let cx = M;
  cx +=
    pill(ctx, m.goalLabel, cx, 204, {
      bg: 'rgba(255,255,255,0.18)',
      color: '#ffffff',
      size: 7.4,
      h: 17,
      padX: 8,
    }) + 6;
  cx +=
    pill(ctx, m.periodLabel, cx, 204, {
      bg: 'rgba(255,255,255,0.12)',
      color: 'rgba(255,255,255,0.92)',
      size: 7.4,
      h: 17,
      padX: 8,
    }) + 6;
  cx +=
    pill(ctx, `BMI ${m.bmi}`, cx, 204, {
      bg: 'rgba(163,230,53,0.22)',
      color: '#ecfccb',
      size: 7.4,
      h: 17,
      padX: 8,
    }) + 6;
  pill(ctx, `${m.height} cm · ${m.weight} kg`, cx, 204, {
    bg: 'rgba(0,0,0,0.18)',
    color: 'rgba(255,255,255,0.9)',
    size: 7.4,
    h: 17,
    padX: 8,
  });

  // headline stats
  const stats = [
    { label: 'Calories', value: num(m.targets.calories), sub: 'kcal / day', color: C.brand },
    { label: 'Protein', value: `${m.targets.protein} g`, sub: 'target / day', color: C.blue },
    { label: 'Hydration', value: `${m.targets.hydration} L`, sub: 'per day', color: C.sky },
    { label: 'Weight', value: `${m.weight} kg`, sub: `BMI ${m.bmi} · ${m.bmiLabel}`, color: C.violet },
  ];
  const gap = 9;
  const sw = (CW - gap * 3) / 4;
  stats.forEach((stat, i) => {
    const x = M + i * (sw + gap);
    const y = 288;
    card(ctx, x, y, sw, 74, 13);
    fillRR(ctx, x + 12, y + 13, 5, 5, 2.5, stat.color);
    spaced(ctx, stat.label.toUpperCase(), x + 21, y + 18, 6.6, 700, C.muted, 0.9);
    text(ctx, stat.value, x + 12, y + 44, 15, 800, stat.color);
    text(ctx, truncate(ctx, stat.sub, sw - 24, 6.5, 500), x + 12, y + 58, 6.5, 500, C.faint);
  });

  // macro card
  const macroY = 394;
  card(ctx, M, macroY, CW, 158, 16);
  spaced(ctx, 'MACRO BALANCE', M + 16, macroY + 22, 7.4, 700, C.muted, 1.4);
  text(ctx, 'Daily target', PW - M - 16, macroY + 22, 7.4, 500, C.faint, 'right');

  donut(
    ctx,
    M + 92,
    macroY + 88,
    46,
    15,
    [
      { value: m.macros.carbs, color: C.brand },
      { value: m.macros.protein, color: C.blue },
      { value: m.macros.fat, color: C.amber },
    ]
  );
  text(ctx, num(m.targets.calories), M + 92, macroY + 88, 14, 800, C.ink, 'center');
  text(ctx, 'kcal / day', M + 92, macroY + 100, 6.4, 500, C.faint, 'center');

  const rows = [
    { label: 'Carbs', grams: m.targets.carbs, pct: m.macros.carbs, color: C.brand },
    { label: 'Protein', grams: m.targets.protein, pct: m.macros.protein, color: C.blue },
    { label: 'Fat', grams: m.targets.fat, pct: m.macros.fat, color: C.amber },
  ];
  rows.forEach((row, i) => {
    const ry = macroY + 52 + i * 27;
    fillRR(ctx, M + 172, ry - 7, 8, 8, 2.5, row.color);
    text(ctx, row.label, M + 188, ry, 9.4, 700, C.ink);
    text(ctx, `${row.grams} g`, M + 280, ry, 8.4, 500, C.muted);
    text(ctx, `${row.pct}%`, PW - M - 16, ry, 9.4, 800, row.color, 'right');
  });
  const barY = macroY + 126;
  segmentedBar(
    ctx,
    M + 172,
    barY,
    CW - 190,
    7,
    [
      { value: m.macros.carbs, color: C.brand },
      { value: m.macros.protein, color: C.blue },
      { value: m.macros.fat, color: C.amber },
    ]
  );

  // at a glance
  spaced(ctx, 'AT A GLANCE', M, 588, 7.4, 700, C.muted, 1.6);
  const glance = [
    { label: 'Workouts logged', value: String(m.workoutsLogged), sub: m.periodLabel, color: C.blue },
    { label: 'Average sleep', value: m.avgSleep ? `${m.avgSleep.toFixed(1)} h` : '--', sub: 'target 7–9 h', color: C.violet },
    { label: 'Meals logged', value: String(m.mealsLogged), sub: m.periodLabel, color: C.amber },
    { label: 'Best streak', value: `${m.bestStreak} d`, sub: 'habit consistency', color: C.brand },
  ];
  const gw = (CW - 10) / 2;
  glance.forEach((g, i) => {
    const x = M + (i % 2) * (gw + 10);
    const y = 600 + Math.floor(i / 2) * 64;
    tile(ctx, x, y, gw, 56, g.label, g.value, g.sub, g.color);
  });

  // quote band
  const quoteY = 738;
  fillRR(ctx, M, quoteY, CW, 54, 15, hGrad(ctx, M, PW - M, ['#00392a', '#006c49', '#0fa06d']));
  const q = ctx.createRadialGradient(PW - 60, quoteY, 4, PW - 60, quoteY, 150);
  q.addColorStop(0, 'rgba(163,230,53,0.35)');
  q.addColorStop(1, 'rgba(163,230,53,0)');
  ctx.save();
  roundRect(ctx, M, quoteY, CW, 54, 15);
  ctx.clip();
  ctx.fillStyle = q;
  ctx.fillRect(M, quoteY, CW, 54);
  ctx.restore();
  text(ctx, 'Small days. Big years.', M + 20, quoteY + 25, 14, 800, '#ffffff');
  text(ctx, 'Consistency compounds - Gym at Home has your back.', M + 20, quoteY + 41, 7.4, 500, 'rgba(255,255,255,0.72)');

  return s;
}

// ─── Nutrition ──────────────────────────────────────────────────────────────
function nutritionPages(m: ReportModel): Sheet[] {
  const flow = new Flow(m, 'Nutrition', 'Fuel & energy');

  const chartH = 216;
  card(flow.ctx, M, flow.y, CW, chartH, 16);
  text(flow.ctx, 'Calories · last 7 days', M + 16, flow.y + 25, 11, 700, C.ink);
  text(flow.ctx, `${num(m.avgKcal)} avg / day`, PW - M - 16, flow.y + 25, 8.6, 700, C.brand, 'right');
  weekChart(
    flow.ctx,
    M + 20,
    flow.y + 42,
    CW - 40,
    chartH - 64,
    m.week,
    m.targets.calories,
    Math.ceil((m.weekMax * 1.12) / 100) * 100
  );
  flow.y += chartH + 14;

  const tw = (CW - 20) / 3;
  tile(flow.ctx, M, flow.y, tw, 58, 'Meals logged', String(m.mealsLogged), m.periodLabel, C.brand);
  tile(flow.ctx, M + tw + 10, flow.y, tw, 58, 'Average meal', `${m.avgPerMeal}`, 'kcal per meal', C.amber);
  tile(flow.ctx, M + (tw + 10) * 2, flow.y, tw, 58, 'Average day', num(m.avgKcal), 'kcal per day', C.blue);
  flow.y += 72;

  if (m.includeMacros) {
    card(flow.ctx, M, flow.y, CW, 84, 14);
    text(flow.ctx, 'Macro split', M + 16, flow.y + 22, 10, 700, C.ink);
    text(
      flow.ctx,
      `${m.macros.carbs}% carbs · ${m.macros.protein}% protein · ${m.macros.fat}% fat`,
      PW - M - 16,
      flow.y + 22,
      7.8,
      500,
      C.muted,
      'right'
    );
    segmentedBar(
      flow.ctx,
      M + 16,
      flow.y + 34,
      CW - 32,
      12,
      [
        { value: m.macros.carbs, color: C.brand },
        { value: m.macros.protein, color: C.blue },
        { value: m.macros.fat, color: C.amber },
      ]
    );
    const labels = [
      { label: `Carbs · ${m.targets.carbs} g`, color: C.brand, w: m.macros.carbs },
      { label: `Protein · ${m.targets.protein} g`, color: C.blue, w: m.macros.protein },
      { label: `Fat · ${m.targets.fat} g`, color: C.amber, w: m.macros.fat },
    ];
    let lx = M + 16;
    labels.forEach((l) => {
      fillRR(flow.ctx, lx, flow.y + 58, 6, 6, 2, l.color);
      text(flow.ctx, l.label, lx + 11, flow.y + 63.5, 7.4, 600, C.body);
      lx += flow.ctx.measureText(l.label).width + 34;
    });
    flow.y += 96;
  }

  const rows = m.topFoods;
  const rowH = 23;

  if (!rows.length) {
    flow.ensure(96);
    card(flow.ctx, M, flow.y, CW, 96, 14);
    text(flow.ctx, 'Most logged foods', M + 16, flow.y + 24, 10, 700, C.ink);
    text(flow.ctx, 'No meals logged in this period yet.', PW / 2, flow.y + 58, 8.6, 500, C.faint, 'center');
    flow.y += 108;
  } else {
    let index = 0;
    while (index < rows.length) {
      flow.ensure(150);
      const room = CONTENT_BOTTOM - flow.y - 50;
      const count = Math.max(1, Math.min(rows.length - index, Math.floor(room / rowH)));
      const chunk = rows.slice(index, index + count);
      const h = 44 + chunk.length * rowH + 8;
      card(flow.ctx, M, flow.y, CW, h, 14);
      text(flow.ctx, 'Most logged foods', M + 16, flow.y + 24, 10, 700, C.ink);
      text(
        flow.ctx,
        index === 0 ? m.periodLabel : `${m.periodLabel} · continued`,
        PW - M - 16,
        flow.y + 24,
        7.6,
        500,
        C.muted,
        'right'
      );
      const top = flow.y + 34;
      chunk.forEach((food, i) => {
        const rowY = top + i * rowH;
        if (i % 2 === 0) fillRR(flow.ctx, M + 8, rowY, CW - 16, rowH, 5, 'rgba(0,108,73,0.04)');
        fillRR(flow.ctx, M + 16, rowY + 7, 9, 9, 2.5, index + i < 3 ? C.brand : '#cfe3d9');
        text(flow.ctx, String(index + i + 1), M + 20.5, rowY + 14.2, 6.2, 800, '#ffffff', 'center');
        text(flow.ctx, truncate(flow.ctx, food.name, CW - 190, 8.6, 600), M + 34, rowY + 15, 8.6, 600, C.body);
        text(flow.ctx, `${food.count}×`, PW - M - 84, rowY + 15, 7.8, 700, C.muted, 'right');
        text(flow.ctx, `${num(food.kcal)} kcal`, PW - M - 16, rowY + 15, 7.8, 600, C.faint, 'right');
      });
      flow.y += h + 12;
      index += chunk.length;
    }
  }

  return flow.sheets;
}

// ─── Training ───────────────────────────────────────────────────────────────
function trainingPages(m: ReportModel): Sheet[] {
  const flow = new Flow(m, 'Training', 'Your weekly split');

  const totalSets = m.planDays.reduce((n, d) => n + d.sets, 0);
  const totalExercises = m.planDays.reduce((n, d) => n + d.exercises.length, 0);

  card(flow.ctx, M, flow.y, CW, 56, 14);
  const summary: { label: string; value: string; color: string }[] = [
    { label: 'Training days', value: String(m.planDays.length), color: C.brand },
    { label: 'Exercises', value: String(totalExercises), color: C.blue },
    { label: 'Weekly sets', value: String(totalSets), color: C.amber },
  ];
  summary.forEach((item, i) => {
    const x = M + 18 + i * ((CW - 36) / 3);
    text(flow.ctx, item.value, x, flow.y + 30, 16, 800, item.color);
    spaced(flow.ctx, item.label.toUpperCase(), x, flow.y + 44, 6.6, 700, C.muted, 1.1);
  });
  flow.y += 70;

  if (!m.planDays.length) {
    card(flow.ctx, M, flow.y, CW, 96, 14);
    text(flow.ctx, 'No workout plan saved yet.', PW / 2, flow.y + 46, 9, 500, C.faint, 'center');
    text(flow.ctx, 'Generate one from Exercises or the V chat.', PW / 2, flow.y + 62, 7.6, 500, C.faint, 'center');
    flow.y += 110;
  }

  const maxSets = Math.max(...m.planDays.map((d) => d.sets), 1);
  const gap = 10;
  const colW = (CW - gap) / 2;

  for (let i = 0; i < m.planDays.length; i += 2) {
    const row = m.planDays.slice(i, i + 2);
    const cardH = Math.max(...row.map((d) => 40 + Math.min(d.exercises.length, 7) * 12 + 12));
    flow.ensure(cardH + gap);
    const y = flow.y;
    const ctx = flow.ctx;

    row.forEach((day, c) => {
      const x = M + c * (colW + gap);
      card(ctx, x, y, colW, cardH, 14);

      text(ctx, truncate(ctx, day.day, colW - 100, 10, 700), x + 13, y + 19, 10, 700, C.ink);
      text(ctx, `${day.exercises.length} ex · ${day.sets} sets`, x + colW - 13, y + 18, 6.6, 600, C.muted, 'right');

      let cx2 = x + 13;
      cx2 += pill(ctx, day.focus, cx2, y + 24, {
        bg: 'rgba(0,88,190,0.10)',
        color: C.blue,
        size: 6.2,
        h: 12,
        padX: 6,
      });

      const visible = day.exercises.slice(0, 7);
      visible.forEach((ex, k) => {
        const ey = y + 50 + k * 12;
        text(ctx, truncate(ctx, ex.name, colW - 76, 7.7, 600), x + 13, ey, 7.7, 600, C.body);
        text(
          ctx,
          `${ex.sets}×${ex.reps}${ex.weight ? ` · ${ex.weight}kg` : ''}`,
          x + colW - 13,
          ey,
          6.8,
          600,
          C.faint,
          'right'
        );
      });
      if (day.exercises.length > visible.length) {
        text(ctx, `+${day.exercises.length - visible.length} more`, x + 13, y + 50 + visible.length * 12, 6.8, 600, C.faint);
      }

      const trackW = colW - 26;
      const barY = y + cardH - 9;
      fillRR(ctx, x + 13, barY, trackW, 3, 1.5, '#e9f1ee');
      fillRR(
        ctx,
        x + 13,
        barY,
        Math.max(4, (day.sets / maxSets) * trackW),
        3,
        1.5,
        vGrad(ctx, barY, barY + 3, [C.mint, C.brand])
      );
    });

    flow.y += cardH + gap;
  }

  if (m.includeNotes && m.planDays.length) {
    flow.ensure(84);
    const ctx = flow.ctx;
    const h = 78;
    fillRR(ctx, M, flow.y, CW, h, 14, hGrad(ctx, M, PW - M, ['rgba(18,185,129,0.14)', 'rgba(0,88,190,0.07)']));
    strokeRR(ctx, M, flow.y, CW, h, 14, 'rgba(0,108,73,0.16)', 1);
    spaced(ctx, 'COACH NOTES', M + 16, flow.y + 20, 7, 800, C.brand, 1.5);
    const notes =
      'Warm up 5–10 minutes before every session. Rest 60–90 seconds between sets and leave one rep in the tank. ' +
      'Move up in reps or resistance only when the last set still feels clean.';
    wrapNotes(ctx, notes, M + 16, flow.y + 36, CW - 32, 12);
    flow.y += h + 12;
  }

  return flow.sheets;
}

function wrapNotes(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, maxW: number, lh: number) {
  const words = value.split(' ');
  let line = '';
  let cy = y;
  words.forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxW && line) {
      text(ctx, line, x, cy, 8, 500, C.body);
      line = word;
      cy += lh;
    } else {
      line = next;
    }
  });
  if (line) text(ctx, line, x, cy, 8, 500, C.body);
}

// ─── Body, habits & health ──────────────────────────────────────────────────
function bodyPages(m: ReportModel): Sheet[] {
  const flow = new Flow(m, 'Progress', 'Body & consistency');

  // weight trend
  if (m.sections.body) {
    card(flow.ctx, M, flow.y, CW, 190, 16);
    text(flow.ctx, 'Weight trend', M + 16, flow.y + 24, 11, 700, C.ink);
    const last = m.metrics.length ? m.metrics[m.metrics.length - 1] : null;
    const first = m.metrics.length ? m.metrics[0] : null;
    if (last) {
      text(flow.ctx, `${last.weight.toFixed(1)} kg`, PW - M - 16, flow.y + 24, 14, 800, C.brand, 'right');
      text(flow.ctx, last.date, PW - M - 16, flow.y + 36, 7, 500, C.faint, 'right');
    }
    if (last && first && m.metrics.length > 1) {
      const diff = last.weight - first.weight;
      const color = diff <= 0 ? C.brand : C.amber;
      const label =
        Math.abs(diff) < 0.05
          ? `Holding steady since ${first.date}`
          : `${diff > 0 ? '+' : '-'}${Math.abs(diff).toFixed(1)} kg since ${first.date}`;
      text(flow.ctx, label, M + 16, flow.y + 40, 7.4, 600, color);
    }
    weightChart(flow.ctx, M + 16, flow.y + 56, CW - 32, 106, m.metrics);
    flow.y += 202;
  }

  // health strip — only when it is the sole progress section, otherwise the
  // cover's "at a glance" tiles already carry these numbers.
  if (m.sections.health && !m.sections.body && !m.sections.habits) {
    const tw = (CW - 20) / 3;
    tile(
      flow.ctx,
      M,
      flow.y,
      tw,
      58,
      'Average sleep',
      m.avgSleep ? `${m.avgSleep.toFixed(1)} h` : '--',
      'target 7–9 h',
      C.violet
    );
    tile(flow.ctx, M + tw + 10, flow.y, tw, 58, 'Workouts', String(m.workoutsLogged), m.periodLabel, C.blue);
    tile(
      flow.ctx,
      M + (tw + 10) * 2,
      flow.y,
      tw,
      58,
      'Best streak',
      `${m.bestStreak} d`,
      'habit consistency',
      C.brand
    );
    flow.y += 72;
  }

  // weigh-ins
  if (m.sections.body && m.metrics.length) {
    const rows = m.metrics.slice(-5);
    const rowH = 15;
    const h = 36 + rows.length * rowH + 8;
    flow.ensure(h);
    card(flow.ctx, M, flow.y, CW, h, 14);
    text(flow.ctx, 'Weigh-ins', M + 16, flow.y + 22, 10, 700, C.ink);
    text(flow.ctx, 'Weight', PW - M - 152, flow.y + 22, 7, 700, C.muted, 'right');
    text(flow.ctx, 'BMI', PW - M - 16, flow.y + 22, 7, 700, C.muted, 'right');
    const top = flow.y + 32;
    rows.forEach((row, i) => {
      const ry = top + i * rowH + 11;
      if (i % 2 === 0) {
        fillRR(flow.ctx, M + 8, top + i * rowH + 1, CW - 16, rowH, 4, 'rgba(0,108,73,0.04)');
      }
      text(flow.ctx, row.date, M + 16, ry, 8, 600, C.body);
      text(flow.ctx, `${row.weight.toFixed(1)} kg`, PW - M - 152, ry, 8, 600, C.body, 'right');
      text(flow.ctx, row.bmi, PW - M - 16, ry, 8, 700, Number(row.bmi) > 25 ? C.amber : C.brand, 'right');
    });
    flow.y += h + 12;
  }

  // heatmap — current month only, with day numbers
  if (m.sections.habits) {
    const cell = 30;
    const gap = 4;
    const rows = m.heat.weeks.length;
    const calH = 14 + rows * cell + Math.max(0, rows - 1) * gap;
    const h = 40 + calH + 20;
    flow.ensure(h);
    card(flow.ctx, M, flow.y, CW, h, 16);
    text(flow.ctx, `Consistency · ${m.heat.label}`, M + 16, flow.y + 24, 10, 700, C.ink);
    text(
      flow.ctx,
      `${m.habits.length} habit${m.habits.length === 1 ? '' : 's'} · ${m.heat.activeDays}/${m.heat.days} days active`,
      PW - M - 16,
      flow.y + 24,
      7.4,
      500,
      C.muted,
      'right'
    );
    if (m.habits.length) {
      monthCalendar(flow.ctx, M + 16, flow.y + 36, m.heat, cell, gap);
      const legendX = PW - M - 160;
      legendSwatches(flow.ctx, legendX, flow.y + 48, 9);
      text(flow.ctx, 'Day numbers = calendar days', legendX, flow.y + 76, 6.6, 500, C.faint);
      text(flow.ctx, `${m.bestStreak}-day best streak`, legendX, flow.y + 94, 9, 700, C.brand);
      text(flow.ctx, 'Darker means more habits done', legendX, flow.y + 112, 6.6, 500, C.faint);
      text(flow.ctx, 'Only this month is shown', legendX, flow.y + 126, 6.6, 500, C.faint);
    } else {
      text(flow.ctx, 'No habits tracked yet.', M + 16, flow.y + 80, 8.6, 500, C.faint);
    }
    flow.y += h + 12;
  }

  // habit cards, two per row
  if (m.sections.habits && m.habits.length) {
    const gap = 10;
    const cw = (CW - gap) / 2;
    for (let i = 0; i < m.habits.length; i += 2) {
      flow.ensure(52);
      const row = m.habits.slice(i, i + 2);
      const y = flow.y;
      const ctx = flow.ctx;
      row.forEach((habit, c) => {
        const x = M + c * (cw + gap);
        card(ctx, x, y, cw, 44, 12);
        text(ctx, truncate(ctx, habit.name, cw - 70, 9.2, 700), x + 13, y + 16, 9.2, 700, C.ink);
        text(ctx, `${habit.monthDone}/${habit.monthDays} d`, x + 13, y + 30, 6.8, 500, C.faint);
        text(ctx, `${habit.pct}%`, x + cw - 13, y + 16, 9.2, 800, C.brand, 'right');
        const trackW = cw - 26;
        fillRR(ctx, x + 13, y + 35, trackW, 3.5, 1.75, '#e9f1ee');
        fillRR(
          ctx,
          x + 13,
          y + 35,
          Math.max(4, (habit.pct / 100) * trackW),
          3.5,
          1.75,
          vGrad(ctx, y + 35, y + 38.5, [C.mint, C.brand])
        );
      });
      flow.y += 52;
    }
  }

  return flow.sheets;
}

// ─── Assembly ───────────────────────────────────────────────────────────────
export async function renderReportPoster(m: ReportModel): Promise<string[]> {
  if (typeof document === 'undefined') return [];

  const logo = await loadLogo();
  const sheets: Sheet[] = [coverPage(m, logo)];
  if (m.sections.nutrition) sheets.push(...nutritionPages(m));
  if (m.sections.exercise) sheets.push(...trainingPages(m));
  if (m.sections.body || m.sections.habits || m.sections.health) sheets.push(...bodyPages(m));

  sheets.forEach((sheet, i) => footer(sheet, i + 1, sheets.length, `${m.dateLabel} · GAH-${m.reportId}`));

  // Convert and release each canvas as we go: four A4 bitmaps at 2.5× would
  // otherwise sit in memory at once on phones.
  return sheets.map((sheet) => {
    const url = sheet.canvas.toDataURL('image/jpeg', 0.92);
    sheet.canvas.width = 0;
    sheet.canvas.height = 0;
    return url;
  });
}

export function posterToPdf(images: string[]): jsPDF {
  const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait', compress: true });
  images.forEach((img, i) => {
    if (i > 0) pdf.addPage();
    pdf.addImage(img, 'JPEG', 0, 0, PW, PH);
  });
  return pdf;
}
