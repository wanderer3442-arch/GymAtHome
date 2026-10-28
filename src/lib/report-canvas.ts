/**
 * Canvas primitives for the Gym at Home poster.
 * Everything is drawn in A4 points on a 2.5× bitmap, so the PDF stays sharp.
 */

import type { ReportHeat } from './report-model';

export const PW = 595.28; // A4 width, pt
export const PH = 841.89; // A4 height, pt
export const SCALE = 2.5; // ≈187 dpi
export const M = 40;
export const CW = PW - M * 2;
export const CONTENT_BOTTOM = PH - 62;
export const FONT = 'Inter, "Segoe UI", system-ui, -apple-system, Roboto, sans-serif';

export type Ctx = CanvasRenderingContext2D;

export const C = {
  ink: '#081827',
  body: '#2b4353',
  muted: '#647889',
  faint: '#94a6b3',
  line: '#e2ebef',
  wash: '#f4f9f7',
  paper: '#ffffff',
  brand: '#006c49',
  brandDark: '#003c2a',
  brandDeep: '#05271d',
  mint: '#12b981',
  lime: '#a3e635',
  blue: '#0058be',
  sky: '#0ea5e9',
  violet: '#7c3aed',
  amber: '#e29100',
  coral: '#f26b5e',
  red: '#ba1a1a',
};

export const HEAT = ['#e7f0eb', '#c4e7d7', '#8ad6b3', '#3cbf8a', '#006c49'];

// ─── Shapes ─────────────────────────────────────────────────────────────────
export function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

export function fillRR(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string | CanvasGradient
) {
  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
}

export function strokeRR(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  stroke: string,
  lineWidth = 1
) {
  roundRect(ctx, x, y, w, h, r);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

export function card(ctx: Ctx, x: number, y: number, w: number, h: number, r = 14, fill: string = C.paper) {
  ctx.save();
  ctx.shadowColor = 'rgba(6, 38, 26, 0.10)';
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 7;
  fillRR(ctx, x, y, w, h, r, fill);
  ctx.restore();
  strokeRR(ctx, x, y, w, h, r, 'rgba(6, 38, 26, 0.06)', 1);
}

export function blob(ctx: Ctx, cx: number, cy: number, r: number, fill: string) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

// ─── Text ───────────────────────────────────────────────────────────────────
export function font(ctx: Ctx, size: number, weight = 500) {
  ctx.font = `${weight} ${size}px ${FONT}`;
}

export function text(
  ctx: Ctx,
  value: string,
  x: number,
  y: number,
  size: number,
  weight = 500,
  color: string = C.ink,
  align: CanvasTextAlign = 'left'
) {
  font(ctx, size, weight);
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.fillText(value, x, y);
  ctx.textAlign = 'left';
}

export function spaced(
  ctx: Ctx,
  value: string,
  x: number,
  y: number,
  size: number,
  weight: number,
  color: string,
  spacing = 1.2,
  align: CanvasTextAlign = 'left'
) {
  const anyCtx = ctx as Ctx & { letterSpacing?: string };
  const previous = anyCtx.letterSpacing;
  try {
    anyCtx.letterSpacing = `${spacing}px`;
  } catch {
    // older engines ignore it — spacing is cosmetic
  }
  text(ctx, value, x, y, size, weight, color, align);
  try {
    anyCtx.letterSpacing = previous || '0px';
  } catch {
    // ignore
  }
}

export function wrap(ctx: Ctx, value: string, maxWidth: number): string[] {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth || !line) line = candidate;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

export function wrapText(
  ctx: Ctx,
  value: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  size: number,
  weight: number,
  color: string
): number {
  font(ctx, size, weight);
  ctx.fillStyle = color;
  const lines = wrap(ctx, value, maxWidth);
  lines.forEach((line, i) => ctx.fillText(line, x, y + i * lineHeight));
  return y + (lines.length - 1) * lineHeight;
}

export function truncate(
  ctx: Ctx,
  value: string,
  maxWidth: number,
  size = 9,
  weight = 500
): string {
  font(ctx, size, weight);
  if (ctx.measureText(value).width <= maxWidth) return value;
  let cut = value;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxWidth) cut = cut.slice(0, -1);
  return `${cut.trimEnd()}…`;
}

export function pill(
  ctx: Ctx,
  label: string,
  x: number,
  y: number,
  options: { size?: number; bg: string; color: string; padX?: number; h?: number; weight?: number }
): number {
  const size = options.size ?? 7.5;
  const padX = options.padX ?? 7;
  const h = options.h ?? 15;
  font(ctx, size, options.weight ?? 700);
  const w = ctx.measureText(label).width + padX * 2;
  fillRR(ctx, x, y, w, h, h / 2, options.bg);
  text(ctx, label, x + w / 2, y + h / 2 + size * 0.36, size, options.weight ?? 700, options.color, 'center');
  return w;
}

export const num = (n: number) => Math.round(n).toLocaleString('en-US');

// ─── Gradient helpers ───────────────────────────────────────────────────────
export function vGrad(ctx: Ctx, y0: number, y1: number, stops: string[]): CanvasGradient {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  stops.forEach((color, i) => g.addColorStop(i / (stops.length - 1), color));
  return g;
}

export function hGrad(ctx: Ctx, x0: number, x1: number, stops: string[]): CanvasGradient {
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  stops.forEach((color, i) => g.addColorStop(i / (stops.length - 1), color));
  return g;
}

// ─── Sheet ──────────────────────────────────────────────────────────────────
export class Sheet {
  canvas: HTMLCanvasElement;
  ctx: Ctx;
  y = 0;

  constructor(public kind: 'cover' | 'page') {
    this.canvas = document.createElement('canvas');
    this.canvas.width = Math.round(PW * SCALE);
    this.canvas.height = Math.round(PH * SCALE);
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available');
    ctx.scale(SCALE, SCALE);
    ctx.textBaseline = 'alphabetic';
    this.ctx = ctx;
    this.paintBase();
  }

  private paintBase() {
    const { ctx } = this;
    ctx.fillStyle = C.paper;
    ctx.fillRect(0, 0, PW, PH);

    const mint = ctx.createRadialGradient(PW * 0.88, -80, 20, PW * 0.88, -80, 430);
    mint.addColorStop(0, 'rgba(18,185,129,0.18)');
    mint.addColorStop(1, 'rgba(18,185,129,0)');
    ctx.fillStyle = mint;
    ctx.fillRect(0, 0, PW, PH);

    const blue = ctx.createRadialGradient(-60, PH * 0.92, 10, -60, PH * 0.92, 400);
    blue.addColorStop(0, 'rgba(0,88,190,0.10)');
    blue.addColorStop(1, 'rgba(0,88,190,0)');
    ctx.fillStyle = blue;
    ctx.fillRect(0, 0, PW, PH);
  }
}

// ─── Chrome ─────────────────────────────────────────────────────────────────
export function sectionHeader(sheet: Sheet, kicker: string, title: string, meta: string) {
  const { ctx } = sheet;
  spaced(ctx, kicker.toUpperCase(), M, 52, 8, 800, C.brand, 2.2);
  text(ctx, title, M, 84, 25, 800, C.ink);
  if (meta) text(ctx, meta, PW - M, 84, 8.5, 500, C.muted, 'right');
  fillRR(ctx, M, 95, 66, 4, 2, hGrad(ctx, M, M + 66, [C.brand, C.mint]));
  sheet.y = 118;
}

export function footer(sheet: Sheet, index: number, total: number, meta: string) {
  const { ctx } = sheet;
  const y = PH - 40;
  ctx.fillStyle = hGrad(ctx, M, PW - M, ['rgba(0,108,73,0.30)', 'rgba(0,88,190,0.08)']);
  ctx.fillRect(M, y - 15, CW, 1);
  text(ctx, 'GYM AT HOME', M, y, 6.8, 800, C.brand);
  text(ctx, 'Personal health protocol', M + 52, y, 6.8, 500, C.faint);
  text(ctx, meta, PW / 2, y, 6.8, 500, C.faint, 'center');
  text(ctx, `${index} / ${total}`, PW - M, y, 6.8, 700, C.muted, 'right');
}

// ─── Charts ─────────────────────────────────────────────────────────────────
export function weekChart(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  week: { day: string; kcal: number }[],
  target: number,
  max: number
) {
  const axisW = 30;
  const plotX = x + axisW;
  const plotW = w - axisW;
  const baseY = y + h;
  const plotH = h - 20;

  for (let i = 0; i <= 3; i++) {
    const gy = baseY - plotH * (i / 3);
    ctx.strokeStyle = 'rgba(8,24,39,0.07)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    ctx.moveTo(plotX, gy);
    ctx.lineTo(plotX + plotW, gy);
    ctx.stroke();
    ctx.setLineDash([]);
    if (i === 0 || i === 3) text(ctx, num((max * i) / 3), plotX - 6, gy + 2.4, 6, 600, C.faint, 'right');
  }
  ctx.setLineDash([]);

  const hasData = week.some((d) => d.kcal > 0);
  if (target > 0) {
    const ty = baseY - Math.min(1, target / max) * plotH;
    ctx.strokeStyle = 'rgba(242,107,94,0.85)';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(plotX, ty);
    ctx.lineTo(plotX + plotW, ty);
    ctx.stroke();
    ctx.setLineDash([]);
    text(ctx, `target ${num(target)}`, plotX + plotW, ty - 5, 7, 700, C.coral, 'right');
  }

  const slot = plotW / week.length;
  week.forEach((d, i) => {
    const bw = Math.min(34, slot * 0.56);
    const bx = plotX + slot * i + (slot - bw) / 2;
    const ratio = max > 0 ? Math.min(1, d.kcal / max) : 0;
    const bh = Math.max(d.kcal > 0 ? 4 : 2, ratio * plotH);
    if (d.kcal > 0) {
      fillRR(ctx, bx, baseY - bh, bw, bh, 4, vGrad(ctx, baseY - bh, baseY, ['#3ddc9a', C.brand]));
      text(ctx, num(d.kcal), bx + bw / 2, baseY - bh - 6, 7.5, 700, C.ink, 'center');
    } else {
      fillRR(ctx, bx, baseY - bh, bw, bh, 2, '#e8f0ec');
    }
    text(ctx, d.day, bx + bw / 2, baseY + 13, 7.5, 700, C.muted, 'center');
  });

  if (!hasData) {
    text(ctx, 'No meals logged in the last 7 days', plotX + plotW / 2, y + plotH / 2, 8.5, 500, C.faint, 'center');
  }
}

export function donut(
  ctx: Ctx,
  cx: number,
  cy: number,
  radius: number,
  thickness: number,
  segments: { value: number; color: string }[]
) {
  let angle = -Math.PI / 2;
  segments.forEach((seg) => {
    const sweep = (Math.max(0, seg.value) / 100) * Math.PI * 2;
    if (sweep <= 0) return;
    const gap = Math.min(0.03, sweep * 0.15);
    ctx.beginPath();
    ctx.arc(cx, cy, radius, angle + gap / 2, angle + sweep - gap / 2);
    ctx.arc(cx, cy, radius - thickness, angle + sweep - gap / 2, angle + gap / 2, true);
    ctx.closePath();
    ctx.fillStyle = seg.color;
    ctx.fill();
    angle += sweep;
  });
}

export function weightChart(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  metrics: { date: string; weight: number }[]
) {
  const points = metrics.filter((m) => m.weight > 0);
  if (points.length < 2) {
    ctx.setLineDash([4, 4]);
    strokeRR(ctx, x, y, w, h, 10, 'rgba(8,24,39,0.14)');
    ctx.setLineDash([]);
    text(
      ctx,
      points.length ? 'Log one more weigh-in to see the trend' : 'No body metrics logged in this period',
      x + w / 2,
      y + h / 2,
      8.5,
      500,
      C.faint,
      'center'
    );
    return;
  }

  const values = points.map((p) => p.weight);
  const min = Math.min(...values) - 1;
  const max = Math.max(...values) + 1;
  const axisW = 26;
  const plotX = x + axisW;
  const plotW = w - axisW;
  const px = (i: number) => plotX + (i / (points.length - 1)) * plotW;
  const py = (v: number) => y + h - ((v - min) / (max - min)) * h;

  for (let i = 0; i <= 2; i++) {
    const gy = y + h - (h * i) / 2;
    ctx.strokeStyle = 'rgba(8,24,39,0.07)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    ctx.moveTo(plotX, gy);
    ctx.lineTo(plotX + plotW, gy);
    ctx.stroke();
    ctx.setLineDash([]);
    text(ctx, (min + ((max - min) * i) / 2).toFixed(1), plotX - 6, gy + 2.4, 6, 600, C.faint, 'right');
  }

  ctx.beginPath();
  ctx.moveTo(px(0), y + h);
  points.forEach((p, i) => ctx.lineTo(px(i), py(p.weight)));
  ctx.lineTo(px(points.length - 1), y + h);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, 'rgba(0,108,73,0.30)');
  g.addColorStop(1, 'rgba(0,108,73,0)');
  ctx.fillStyle = g;
  ctx.fill();

  ctx.beginPath();
  points.forEach((p, i) => (i ? ctx.lineTo(px(i), py(p.weight)) : ctx.moveTo(px(i), py(p.weight))));
  ctx.strokeStyle = C.brand;
  ctx.lineWidth = 2.2;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();

  points.forEach((p, i) => {
    blob(ctx, px(i), py(p.weight), 3.1, '#ffffff');
    ctx.beginPath();
    ctx.arc(px(i), py(p.weight), 3.1, 0, Math.PI * 2);
    ctx.strokeStyle = C.brand;
    ctx.lineWidth = 1.6;
    ctx.stroke();
  });
}

export function heatmap(
  ctx: Ctx,
  x: number,
  y: number,
  cols: { date: string; value: number }[][],
  size = 13,
  gap = 3
) {
  const step = size + gap;
  cols.forEach((col, ci) =>
    col.forEach((cell, ri) => {
      if (cell.value < 0) return;
      const v = cell.value;
      const color = v <= 0 ? HEAT[0] : v < 0.34 ? HEAT[1] : v < 0.67 ? HEAT[2] : v < 1 ? HEAT[3] : HEAT[4];
      fillRR(ctx, x + ci * step, y + ri * step, size, size, 3, color);
    })
  );
  text(ctx, 'M', x - 9, y + size * 0.75, 6, 600, C.faint, 'right');
  text(ctx, 'W', x - 9, y + step * 2 + size * 0.75, 6, 600, C.faint, 'right');
  text(ctx, 'F', x - 9, y + step * 4 + size * 0.75, 6, 600, C.faint, 'right');
}

/**
 * Calendar-month habit heatmap: 7 columns (Mon→Sun), day numbers inside each
 * cell. This is what the PDF prints — only the current month, never 12 weeks.
 */
export function monthCalendar(
  ctx: Ctx,
  x: number,
  y: number,
  heat: ReportHeat,
  cell = 34,
  gap = 4
) {
  const step = cell + gap;
  const labels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  labels.forEach((label, i) => {
    text(ctx, label, x + i * step + cell / 2, y + 6, 6, 700, C.faint, 'center');
  });
  const top = y + 14;
  heat.weeks.forEach((week, wi) => {
    week.forEach((day, di) => {
      if (!day) return;
      const cx = x + di * step;
      const cy = top + wi * step;
      const color = day.future
        ? '#f3f7f5'
        : day.value <= 0
          ? HEAT[0]
          : day.value < 0.34
            ? HEAT[1]
            : day.value < 0.67
              ? HEAT[2]
              : day.value < 1
                ? HEAT[3]
                : HEAT[4];
      fillRR(ctx, cx, cy, cell, cell, 5, color);
      const ink = day.future ? '#c3d2cc' : day.value >= 0.67 ? '#ffffff' : C.body;
      text(ctx, String(day.day), cx + cell / 2, cy + cell / 2 + 2.6, 7.2, 700, ink, 'center');
    });
  });
}

export function legendSwatches(ctx: Ctx, x: number, y: number, size = 9) {
  text(ctx, 'Less', x, y + size * 0.8, 6.5, 600, C.faint);
  let cx = x + 20;
  HEAT.forEach((color) => {
    fillRR(ctx, cx, y, size, size, 2, color);
    cx += size + 3;
  });
  text(ctx, 'More', cx + 1, y + size * 0.8, 6.5, 600, C.faint);
  return cx + 26 - x;
}

export function segmentedBar(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  segments: { value: number; color: string }[]
) {
  let cx = x;
  segments.forEach((seg, i) => {
    const sw = Math.max(2, (seg.value / 100) * w);
    const r = i === 0 || i === segments.length - 1 ? h / 2 : 1;
    fillRR(ctx, cx, y, Math.max(2, sw - (i < segments.length - 1 ? 2 : 0)), h, r, seg.color);
    cx += sw;
  });
}

export function tile(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  value: string,
  sub: string,
  color: string
) {
  card(ctx, x, y, w, h, 12);
  fillRR(ctx, x + 12, y + 12, 4, h - 24, 2, color);
  spaced(ctx, label.toUpperCase(), x + 24, y + 20, 7, 700, C.muted, 1.1);
  text(ctx, value, x + 24, y + 38, 15, 800, color);
  text(ctx, sub, x + 24, y + 50, 7, 500, C.faint);
}
