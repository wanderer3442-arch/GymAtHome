'use client';

import DashboardLayout from '@/components/layout/DashboardLayout';
import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowRight,
  CheckCircle,
  Download,
  Dumbbell,
  FileText,
  Loader2,
  Share2,
  Sparkles,
  Table,
  TrendingUp,
  Utensils,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useStore } from '@/lib/store-context';
import { saveOrShareFile, textToBase64 } from '@/lib/file-export';
import {
  buildCsvRows,
  buildReportModel,
  type ReportInput,
  type ReportSections,
} from '@/lib/report-model';
import { posterToPdf, renderReportPoster } from '@/lib/report-poster';

const timePeriods = ['Last 7 Days', 'Last 30 Days', 'Last 3 Months', 'Year to Date'];

const sectionOptions: { id: keyof ReportSections; label: string; icon: typeof Dumbbell }[] = [
  { id: 'exercise', label: 'Exercise Plan', icon: Dumbbell },
  { id: 'nutrition', label: 'Meal Plan & Macros', icon: Utensils },
  { id: 'health', label: 'Health Statistics', icon: Activity },
  { id: 'body', label: 'Body Metrics', icon: TrendingUp },
  { id: 'habits', label: 'Habits & Consistency', icon: CheckCircle },
];

function CsvSheet({ rows }: { rows: string[][] }) {
  const columns = Math.max(...rows.map((r) => r.length), 1);
  return (
    <div className="mx-auto w-full max-w-[880px] overflow-hidden rounded-lg bg-white ring-1 ring-black/10 shadow-[0_20px_45px_-25px_rgba(0,0,0,0.45)]">
      <div className="flex items-center justify-between border-b border-[#d9e7e0] bg-[#eef7f2] px-4 py-2.5">
        <div className="flex items-center gap-2 text-[11px] font-semibold text-[#0b3b2c]">
          <FileText className="h-3.5 w-3.5" />
          gymathome-protocol.csv
        </div>
        <span className="text-[10px] text-[#5a7a6c]">{rows.length} rows</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left font-mono text-[10.5px] leading-relaxed">
          <tbody>
            {rows.map((row, i) => {
              const isSection =
                row.length === 2 &&
                row[1] === '' &&
                /^[A-Z]/.test(row[0] || '') &&
                row[0] === row[0].toUpperCase();
              if (!row.length) {
                return (
                  <tr key={i}>
                    <td className="h-3 bg-[#fbfdfc]" colSpan={columns + 1} />
                  </tr>
                );
              }
              return (
                <tr
                  key={i}
                  className={
                    isSection
                      ? 'bg-[#e8f4ee] font-bold text-[#006c49]'
                      : i % 2
                        ? 'bg-[#f8fbf9]'
                        : 'bg-white'
                  }
                >
                  <td className="w-9 select-none border-r border-[#edf3f0] px-2 py-1 text-right text-[9px] text-[#a8b8b0]">
                    {i + 1}
                  </td>
                  {Array.from({ length: columns }).map((_, c) => (
                    <td
                      key={c}
                      className="whitespace-nowrap border-r border-[#f1f6f3] px-2.5 py-1 text-[#33463d]"
                    >
                      {row[c] ?? ''}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ExportReportsPage() {
  const {
    profile,
    meals,
    exercises: exerciseLogs,
    bodyMetrics,
    calculations,
    workoutPlan,
    habits,
    sleepLogs,
  } = useStore();

  const [timePeriod, setTimePeriod] = useState('Last 30 Days');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selected, setSelected] = useState<ReportSections>({
    exercise: true,
    nutrition: true,
    health: true,
    body: true,
    habits: true,
  });
  const [format, setFormat] = useState<'pdf' | 'csv'>('pdf');
  const [generating, setGenerating] = useState(false);
  const [exportError, setExportError] = useState('');
  const [includeMacros, setIncludeMacros] = useState(true);
  const [includeNotes, setIncludeNotes] = useState(true);
  const [reportId, setReportId] = useState('');
  const [reportDate, setReportDate] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const [posterImages, setPosterImages] = useState<string[]>([]);
  const [rendering, setRendering] = useState(true);
  const [zoomed, setZoomed] = useState<number | null>(null);

  useEffect(() => {
    setReportId(Date.now().toString(36).toUpperCase().slice(-6));
    setReportDate(
      new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    );
    setHydrated(true);
  }, []);

  const profileComplete = Boolean(
    hydrated &&
      profile?.age &&
      profile?.height &&
      profile?.weight &&
      profile?.gender &&
      profile?.activityLevel &&
      profile?.goal
  );

  const toggleSection = (id: keyof ReportSections) => {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const periodDays =
    timePeriod === 'Last 7 Days'
      ? 7
      : timePeriod === 'Last 30 Days'
        ? 30
        : timePeriod === 'Last 3 Months'
          ? 90
          : Math.max(
              1,
              Math.ceil(
                (Date.now() - new Date(new Date().getFullYear(), 0, 1).getTime()) / 86400000
              )
            );

  const model = useMemo(() => {
    if (!profileComplete) return null;
    const input: ReportInput = {
      profile,
      calculations,
      meals,
      exerciseLogs,
      bodyMetrics,
      sleepLogs,
      habits,
      workoutPlan,
      sections: selected,
      includeMacros,
      includeNotes,
      periodLabel: timePeriod,
      periodDays,
      reportId: reportId || 'DRAFT',
      dateLabel: reportDate,
    };
    return buildReportModel(input);
  }, [
    profileComplete,
    profile,
    calculations,
    meals,
    exerciseLogs,
    bodyMetrics,
    sleepLogs,
    habits,
    workoutPlan,
    selected,
    includeMacros,
    includeNotes,
    timePeriod,
    periodDays,
    reportId,
    reportDate,
  ]);

  // Render the poster once the fonts are ready; the same bitmaps are used for
  // the preview and the PDF so what you see is exactly what downloads.
  useEffect(() => {
    if (!model) {
      setPosterImages([]);
      setRendering(false);
      return;
    }
    let alive = true;
    setRendering(true);
    const timer = setTimeout(async () => {
      try {
        await document.fonts?.ready;
        const images = renderReportPoster(model);
        if (alive) setPosterImages(images);
      } catch {
        if (alive) setPosterImages([]);
      } finally {
        if (alive) setRendering(false);
      }
    }, 120);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [model]);

  const csvRows = useMemo(() => (model ? buildCsvRows(model) : []), [model]);
  const pageCount = posterImages.length;

  const handleExport = async () => {
    if (!profileComplete || !model) {
      setExportError('Complete your profile in Essentials first.');
      return;
    }
    setGenerating(true);
    setExportError('');
    const slug = (profile?.name || 'athlete').trim().toLowerCase().replace(/\s+/g, '-');
    const stamp = new Date().toISOString().split('T')[0];
    try {
      if (format === 'csv') {
        const csv = csvRows
          .map((row) => row.map((cell) => `"${(cell ?? '').replace(/"/g, '""')}"`).join(','))
          .join('\n');
        await saveOrShareFile(`gymathome-protocol-${slug}-${stamp}.csv`, 'text/csv', textToBase64(csv));
      } else {
        const images = posterImages.length ? posterImages : renderReportPoster(model);
        if (!images.length) throw new Error('No pages');
        const pdf = posterToPdf(images);
        const dataUri = pdf.output('datauristring');
        await saveOrShareFile(
          `gymathome-protocol-${slug}-${stamp}.pdf`,
          'application/pdf',
          dataUri.substring(dataUri.indexOf(',') + 1)
        );
      }
    } catch {
      setExportError('Could not save the file. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <DashboardLayout title="Download Hub" subtitle="A printable, poster-style protocol built from your logs">
      <div className="mx-auto max-w-7xl pb-28 lg:pb-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* ── Preview ─────────────────────────────────────────────── */}
          <div className="order-2 lg:order-1 lg:col-span-8 xl:col-span-9">
            <div className="rounded-2xl border border-outline-variant/40 bg-surface-container-low p-3 sm:p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 px-1">
                <div className="flex items-center gap-2.5">
                  <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-primary">
                    {format}
                  </span>
                  <p className="text-xs font-medium text-on-surface-variant">
                    {format === 'pdf'
                      ? pageCount
                        ? `${pageCount} page${pageCount === 1 ? '' : 's'} · A4 poster · print-ready`
                        : 'Preparing your poster…'
                      : `${csvRows.length} rows · spreadsheet`}
                  </p>
                </div>
                <p className="hidden text-[11px] text-outline sm:block">
                  {format === 'pdf' ? 'Every page shown in full — nothing cropped' : 'Exactly what opens in Excel / Sheets'}
                </p>
              </div>

              {!hydrated ? (
                <div className="mx-auto aspect-[1/1.414] w-full max-w-[720px] animate-pulse rounded-lg bg-white p-8 ring-1 ring-black/5">
                  <div className="h-24 rounded-lg bg-surface-container" />
                  <div className="mt-6 space-y-3">
                    <div className="h-4 w-2/3 rounded bg-surface-container" />
                    <div className="h-40 rounded-lg bg-surface-container" />
                    <div className="h-4 w-1/2 rounded bg-surface-container" />
                  </div>
                </div>
              ) : !profileComplete ? (
                <div className="mx-auto flex aspect-[1/1.414] w-full max-w-[720px] flex-col items-center justify-center rounded-lg bg-white px-8 text-center ring-1 ring-black/5">
                  <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                    <FileText className="h-7 w-7 text-primary" />
                  </div>
                  <h3 className="mb-2 text-base font-bold text-on-surface sm:text-lg">
                    Complete your profile to build your report
                  </h3>
                  <p className="mb-6 max-w-sm text-xs leading-relaxed text-on-surface-variant sm:text-sm">
                    Your targets, charts and heatmaps are calculated from your Essentials stats. Fill them
                    in once and the full poster appears here.
                  </p>
                  <Link
                    href="/calculator"
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-xs font-bold text-on-primary transition-colors hover:bg-primary/90 sm:text-sm"
                  >
                    Open Essentials
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              ) : format === 'csv' ? (
                <CsvSheet rows={csvRows} />
              ) : (
                <div className="space-y-5">
                  {posterImages.map((src, i) => (
                    <figure key={i} className="mx-auto w-full max-w-[760px]">
                      <button
                        type="button"
                        onClick={() => setZoomed(i)}
                        className="block w-full cursor-zoom-in overflow-hidden rounded-lg bg-white text-left shadow-[0_24px_50px_-24px_rgba(0,0,0,0.45)] ring-1 ring-black/10 transition-shadow hover:shadow-[0_28px_60px_-24px_rgba(0,0,0,0.55)]"
                        aria-label={`Open page ${i + 1} larger`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          key={`${i}-${src.slice(-24)}`}
                          src={src}
                          alt={`Report page ${i + 1} of ${pageCount}`}
                          className="block h-auto w-full"
                        />
                      </button>
                      <figcaption className="mt-2 flex items-center justify-center gap-2 text-center text-[11px] font-medium text-outline">
                        Page {i + 1} of {pageCount}
                        <span className="hidden text-outline/70 sm:inline">· tap to enlarge</span>
                        <span className="text-outline/70 sm:hidden">· tap to zoom</span>
                      </figcaption>
                    </figure>
                  ))}

                  {!posterImages.length && (
                    <div className="mx-auto flex aspect-[1/1.414] w-full max-w-[760px] flex-col items-center justify-center gap-3 rounded-lg bg-white ring-1 ring-black/5">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      <p className="text-xs text-outline">Rendering your poster…</p>
                    </div>
                  )}

                  {rendering && posterImages.length > 0 && (
                    <div className="sticky bottom-4 mx-auto flex w-fit items-center gap-2 rounded-full bg-on-surface/90 px-4 py-2 text-xs font-medium text-surface shadow-lg">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Updating preview…
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── Settings ────────────────────────────────────────────── */}
          <div className="order-1 lg:order-2 lg:col-span-4 xl:col-span-3">
            <div className="space-y-4 rounded-xl border border-outline-variant/40 bg-surface-container-low p-5 shadow-sm lg:sticky lg:top-24 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto">
              <div className="flex items-center gap-2 rounded-lg bg-primary/5 px-3 py-2.5 text-[11px] leading-snug text-on-surface-variant">
                <Sparkles className="h-4 w-4 shrink-0 text-primary" />
                <span>
                  Vivid A4 pages with your calorie chart, weight trend, weekly split and a 12-week habit
                  heatmap.
                </span>
              </div>

              <div>
                <label className="mb-2 block text-label-md text-on-surface-variant">Format</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setFormat('pdf')}
                    className={`flex flex-col items-center justify-center gap-1 rounded-lg border-2 px-4 py-3 transition-colors ${
                      format === 'pdf'
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-outline-variant/50 text-on-surface-variant hover:border-secondary hover:text-secondary'
                    }`}
                  >
                    <FileText className="h-4 w-4" />
                    <span className="text-label-md font-bold">PDF</span>
                  </button>
                  <button
                    onClick={() => setFormat('csv')}
                    className={`flex flex-col items-center justify-center gap-1 rounded-lg border-2 px-4 py-3 transition-colors ${
                      format === 'csv'
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-outline-variant/50 text-on-surface-variant hover:border-secondary hover:text-secondary'
                    }`}
                  >
                    <Table className="h-4 w-4" />
                    <span className="text-label-md font-bold">CSV</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-label-md text-on-surface-variant">Time period</label>
                <div className="relative">
                  <button
                    onClick={() => setShowDropdown(!showDropdown)}
                    className="flex w-full items-center justify-between rounded-lg border border-outline-variant/50 bg-surface px-4 py-3 text-body-md text-on-surface transition-colors hover:border-secondary"
                  >
                    {timePeriod}
                    <TrendingUp className="h-4 w-4 rotate-90 text-outline" />
                  </button>
                  {showDropdown && (
                    <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-outline-variant/40 bg-surface shadow-lg">
                      {timePeriods.map((period) => (
                        <button
                          key={period}
                          onClick={() => {
                            setTimePeriod(period);
                            setShowDropdown(false);
                          }}
                          className={`block w-full px-4 py-2.5 text-left text-body-sm transition-colors hover:bg-surface-container ${
                            period === timePeriod ? 'bg-primary/5 font-semibold text-primary' : 'text-on-surface'
                          }`}
                        >
                          {period}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4 border-t border-outline-variant/20 pt-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-label-md font-bold text-on-surface">Include Macros</p>
                    <p className="text-xs text-on-surface-variant">Macro split card</p>
                  </div>
                  <button
                    onClick={() => setIncludeMacros(!includeMacros)}
                    className={`relative h-6 w-12 shrink-0 rounded-full transition-colors ${includeMacros ? 'bg-primary' : 'bg-gray-300'}`}
                    aria-label="Include macros"
                  >
                    <div
                      className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${includeMacros ? 'left-7' : 'left-1'}`}
                    />
                  </button>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-label-md font-bold text-on-surface">Coach Notes</p>
                    <p className="text-xs text-on-surface-variant">Warm-up & form cues</p>
                  </div>
                  <button
                    onClick={() => setIncludeNotes(!includeNotes)}
                    className={`relative h-6 w-12 shrink-0 rounded-full transition-colors ${includeNotes ? 'bg-primary' : 'bg-gray-300'}`}
                    aria-label="Include coach notes"
                  >
                    <div
                      className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${includeNotes ? 'left-7' : 'left-1'}`}
                    />
                  </button>
                </div>
              </div>

              <div className="border-t border-outline-variant/20 pt-4">
                <label className="mb-2 block text-label-md text-on-surface-variant">Sections</label>
                <div className="space-y-1">
                  {sectionOptions.map((s) => (
                    <label
                      key={s.id}
                      className="flex cursor-pointer items-center justify-between rounded-lg p-2 transition-colors hover:bg-surface-container"
                    >
                      <div className="flex items-center gap-2">
                        <s.icon className="h-4 w-4 text-outline-variant" />
                        <span className="text-body-md text-on-surface">{s.label}</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={selected[s.id]}
                        onChange={() => toggleSection(s.id)}
                        className="h-4 w-4 rounded text-primary focus:ring-primary"
                      />
                    </label>
                  ))}
                </div>
              </div>

              <div className="border-t border-outline-variant/20 pt-4">
                <button
                  onClick={handleExport}
                  disabled={generating || !profileComplete}
                  className="hidden w-full items-center justify-center gap-2 rounded-lg bg-primary py-4 text-label-md font-bold text-on-primary shadow-md transition-all hover:bg-primary/90 hover:shadow-lg active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 lg:flex"
                >
                  {generating ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Download className="h-5 w-5" />
                  )}
                  {generating
                    ? 'Preparing…'
                    : format === 'pdf'
                      ? 'Download PDF'
                      : 'Download CSV'}
                </button>
                <p className="mt-3 hidden text-center text-xs text-on-surface-variant lg:block">
                  {!profileComplete
                    ? 'Complete your profile in Essentials to enable export'
                    : format === 'pdf'
                      ? `${pageCount || '·'} page${pageCount === 1 ? '' : 's'} · saved or shared from your device`
                      : 'Opens in Excel, Sheets or Numbers'}
                </p>
                <p className="mt-2 flex items-center justify-center gap-1.5 text-center text-[11px] text-outline">
                  <Share2 className="h-3 w-3" />
                  Works offline — no account needed
                </p>
                {exportError && <p className="mt-2 text-center text-xs text-error">{exportError}</p>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile action bar — always one tap away, clear of the chat bubble */}
      <div className="fixed inset-x-3 bottom-3 z-30 flex items-center gap-3 rounded-2xl border border-outline-variant/40 bg-surface/95 py-2 pl-4 pr-16 shadow-[0_16px_40px_-16px_rgba(0,0,0,0.35)] backdrop-blur lg:hidden">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-bold uppercase tracking-[0.12em] text-on-surface">
            {format} · {format === 'pdf' ? `${pageCount || 0} pages` : `${csvRows.length} rows`}
          </p>
          <p className="truncate text-[10px] text-on-surface-variant">
            {format === 'pdf' ? 'A4 · print-ready poster' : 'Excel / Sheets ready'}
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={generating || !profileComplete}
          className="flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-on-primary shadow-sm transition-colors active:scale-95 disabled:opacity-50"
        >
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Download
        </button>
      </div>

      {/* Full-screen page viewer */}
      {zoomed !== null && posterImages[zoomed] && (
        <div
          className="fixed inset-0 z-[60] flex flex-col bg-black/90"
          onClick={() => setZoomed(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`Report page ${zoomed + 1}`}
        >
          <div className="flex items-center justify-between px-4 py-3 text-white">
            <div>
              <p className="text-sm font-semibold">
                Page {zoomed + 1} of {pageCount}
              </p>
              <p className="text-[11px] text-white/60">Tap outside the page to close</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setZoomed((z) => (z === null ? null : Math.max(0, z - 1)));
                }}
                disabled={zoomed === 0}
                className="rounded-full bg-white/10 px-3 py-2 text-xs font-semibold text-white disabled:opacity-30"
              >
                Prev
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setZoomed((z) => (z === null ? null : Math.min(pageCount - 1, z + 1)));
                }}
                disabled={zoomed === pageCount - 1}
                className="rounded-full bg-white/10 px-3 py-2 text-xs font-semibold text-white disabled:opacity-30"
              >
                Next
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setZoomed(null);
                }}
                className="rounded-full bg-white/10 p-2 text-white"
                aria-label="Close preview"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-2 pb-6 sm:p-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={posterImages[zoomed]}
              alt={`Report page ${zoomed + 1}`}
              onClick={(e) => e.stopPropagation()}
              style={{ width: 'max(100%, 700px)', maxWidth: 1000 }}
              className="mx-auto block rounded-lg bg-white"
            />
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
