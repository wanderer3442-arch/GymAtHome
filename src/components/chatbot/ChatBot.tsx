'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Send,
  X,
  MessageCircle,
  Bot,
  Minimize2,
  Flag,
  Trash2,
  Check,
  ArrowUpRight,
  UtensilsCrossed,
  Dumbbell,
} from 'lucide-react';
import DOMPurify from 'dompurify';
import { getChatResponse, hasGeminiKey } from '@/lib/ai-service';
import { findResponse, getFollowUps } from '@/lib/chatbot-responses';
import { sumMealNutrition, estimateExerciseCalories } from '@/lib/calculations';
import { PLAN_DAY_NAMES } from '@/lib/exercise-planner';
import { useStore } from '@/lib/store-context';
import { savePlanToPreferences, ParsedPlanDay } from '@/lib/meal-plan-import';
import { mergeAiExercisePlan, AiExercisePlanDay } from '@/lib/exercise-plan-import';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/ToastNotification';
import { useBackHandler } from '@/lib/back-handler';
import ui from './chat-ui.module.css';

interface PlanBlock {
  kind: 'meal' | 'exercise';
  plan: { day: string; lines: string[] }[];
  saved?: boolean;
}

interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  followUps?: string[];
  /** One turn can carry a meal plan and a workout plan at the same time. */
  plans?: PlanBlock[];
  /** Legacy single-card fields kept for history saved by older builds. */
  plan?: { day: string; lines: string[] }[];
  planKind?: 'meal' | 'exercise';
  /** True once the card's plan has been written to Meal / Exercise Plan. */
  saved?: boolean;
}

/** Cards to render for a message (new list first, old single card second). */
function planBlocksOf(msg: Message): PlanBlock[] {
  if (msg.plans?.length) return msg.plans;
  if (msg.plan?.length) {
    return [{ kind: msg.planKind ?? 'meal', plan: msg.plan, saved: msg.saved }];
  }
  return [];
}

/** The block of a given kind inside one message, if any. */
function planBlockOf(msg: Message | undefined, kind: PlanBlock['kind']): PlanBlock | null {
  if (!msg) return null;
  const found = msg.plans?.find((p) => p.kind === kind);
  if (found) return found;
  if (msg.plan?.length && (msg.planKind ?? 'meal') === kind) {
    return { kind, plan: msg.plan, saved: msg.saved };
  }
  return null;
}

interface ChatHistoryMessage {
  role: string;
  content: string;
}

interface ChatBotProps {
  mode?: 'floating' | 'inline';
  onClose?: () => void;
}

// ─── Answer renderer ────────────────────────────────────────────────────────
// Inline **bold** support
function renderInline(text: string, keyPrefix: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4 ? (
      <strong key={`${keyPrefix}-${i}`} className="font-bold">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <span key={`${keyPrefix}-${i}`}>{part}</span>
    )
  );
}

// AI answers containing HTML tags (tables, callout boxes) render through
// DOMPurify — scripts/handlers/styles can never pass. Leftover markdown
// (**bold**, ## headers) is pre-converted so mixed responses look clean.
const HTML_TAG_RE =
  /<(table|thead|tbody|tr|th|td|div|strong|em|b|i|u|ul|ol|li|h[1-6]|p|br|span|a|sub|sup|code)\b[\s\S]*>/i;

function renderHtml(content: string) {
  const withMarkdown = content
    .replace(/^##\s+(.+)$/gm, '<h3>$1</h3>')
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  const html = DOMPurify.sanitize(withMarkdown, {
    ALLOWED_TAGS: [
      'strong', 'em', 'b', 'i', 'u', 'ul', 'ol', 'li', 'h3', 'h4', 'p', 'br',
      'table', 'thead', 'tbody', 'tr', 'th', 'td', 'div', 'span', 'a', 'sub', 'sup', 'code',
    ],
    ALLOWED_ATTR: ['class', 'href', 'target', 'rel'],
  });
  return <div className="ai-html" dangerouslySetInnerHTML={{ __html: html }} />;
}

// Per-line structure for plain-text answers (real AI text or canned fallback):
// "#" headings, bullets, numbered steps, short "Label:" sub-headings, bold
// "Label:" prefixes and **bold** inline. HTML answers go through the sanitizer
// instead — both paths share the same visual language, so every user sees the
// same structured output even when the live AI is unavailable.
function renderLabel(text: string, keyPrefix: string) {
  const m = text.match(/^([A-Z][A-Za-z0-9/&%.,'’ -]{1,32}:)\s+(.+)$/);
  if (!m) return renderInline(text, keyPrefix);
  return (
    <>
      <strong className="font-bold">{m[1]}</strong> {renderInline(m[2], keyPrefix)}
    </>
  );
}

function renderContent(content: string) {
  if (HTML_TAG_RE.test(content)) return renderHtml(content);
  return content.split('\n').map((line, i) => {
    const trimmed = line.trim();
    if (trimmed === '') return <span key={i} className="block h-2" />;

    const heading = trimmed.match(/^#{1,6}\s+(.+)$/);
    if (heading) {
      return (
        <span key={i} className={`${ui.answerHeading}`}>
          {renderInline(heading[1], `h${i}`)}
        </span>
      );
    }

    // Short "Section:" lines become styled sub-headings (canned answers use
    // this shape everywhere: "Training:", "Recovery:", "Muscle Gain ...:").
    if (
      trimmed.length <= 72 &&
      /:$/.test(trimmed) &&
      !/[.!?]$/.test(trimmed) &&
      /^([A-Z0-9]|[^\u0000-\u007F])/.test(trimmed)
    ) {
      return (
        <span key={i} className={`${ui.answerHeading}`}>
          {renderInline(trimmed, `s${i}`)}
        </span>
      );
    }

    const bullet = trimmed.match(/^[-*•◦▪]\s+(.+)$/);
    if (bullet) {
      return (
        <span key={i} className="block pl-4 -indent-4 leading-relaxed">
          <span className="text-primary font-bold">•</span>{' '}
          {renderLabel(bullet[1], `b${i}`)}
        </span>
      );
    }
    if (/^\d+[.)]\s+/.test(trimmed)) {
      return (
        <span key={i} className="block pl-5 -indent-5 leading-relaxed">
          {renderLabel(trimmed, `n${i}`)}
        </span>
      );
    }
    return (
      <span key={i} className="block leading-relaxed">
        {renderLabel(trimmed, `t${i}`)}
      </span>
    );
  });
}

const AI_REPORT_HREF = `/report-problem?cat=${encodeURIComponent('AI chatbot issue')}&sub=${encodeURIComponent('Issue with an AI response')}`;

// Per-person, per-day AI message allowance.
const FREE_DAILY_LIMIT = 5;

// Suggestions pinned above the composer.
const QUICK_PROMPTS: { label: string; prompt: string }[] = [
  { label: 'Plan my meals', prompt: 'Create a meal plan for today with my portions' },
  { label: '4-day workout', prompt: 'Create a 4-day home workout plan' },
  { label: 'My progress', prompt: 'Analyze my progress' },
];

// ─── Chat persistence ───────────────────────────────────────────────────────
const CHAT_HISTORY_KEY = 'gymathome_chat_history';
const CHAT_HISTORY_MAX = 10; // last N messages kept in storage
const CHAT_COUNT_PREFIX = 'gymathome_chat_count_'; // + YYYY-MM-DD (matches data-wipe cleanup)

function defaultGreeting(name?: string | null): Message {
  return {
    id: 1,
    role: 'assistant',
    content: name
      ? `Hey ${name}! V here 👋 — good to see you! What are we working on today?`
      : "Hey! I'm V 👋 — your gym buddy around here. What's on your mind today?",
    timestamp: '10:30 AM',
    followUps: ['Analyze my progress', 'Suggest a meal', 'Give me exercise tips'],
  };
}

function todayKey(): string {
  return new Date().toISOString().split('T')[0];
}

function loadDailyCount(): number {
  try {
    return parseInt(localStorage.getItem(CHAT_COUNT_PREFIX + todayKey()) || '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveDailyCount(count: number): void {
  try {
    localStorage.setItem(CHAT_COUNT_PREFIX + todayKey(), String(count));
    // Drop stale counts from previous days
    Object.keys(localStorage)
      .filter((k) => k.startsWith(CHAT_COUNT_PREFIX) && k !== CHAT_COUNT_PREFIX + todayKey())
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    // best-effort
  }
}

function loadChatHistory(): Message[] | null {
  try {
    const raw = localStorage.getItem(CHAT_HISTORY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? (parsed as Message[]) : null;
  } catch {
    return null;
  }
}

function saveChatHistory(msgs: Message[]): void {
  try {
    const safe = msgs.slice(-CHAT_HISTORY_MAX);
    localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(safe));
  } catch {
    // best-effort
  }
}

/**
 * Every JSON array embedded in a reply, found by bracket matching (string-aware).
 * Plans are appended as `JSON: [...]` lines and a single answer can carry two —
 * a meal plan AND a workout plan. A greedy regex would span both and fail to
 * parse either, which is why the scanner is used instead.
 */
function jsonArraysIn(content: string): unknown[] {
  const found: unknown[] = [];
  for (let i = 0; i < content.length; i++) {
    if (content[i] !== '[') continue;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let j = i; j < content.length; j++) {
      const ch = content[j];
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === '\\') escaped = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') inString = true;
      else if (ch === '[') depth += 1;
      else if (ch === ']') {
        depth -= 1;
        if (depth === 0) {
          try {
            found.push(JSON.parse(content.slice(i, j + 1)));
          } catch {
            // not valid JSON — ignore this bracket pair
          }
          i = j;
          break;
        }
      }
    }
  }
  return found;
}

// Helper to create a meal plan message from AI response
function parseMealPlanResponse(content: string): { day: string; meals: string[] }[] {
  for (const data of jsonArraysIn(content)) {
    if (!Array.isArray(data)) continue;
    // Strict shape check — a random JSON array inside an answer is not a plan.
    const days = data
      .filter(
        (d: any) =>
          d && typeof d.day === 'string' && Array.isArray(d.meals) && d.meals.length > 0
      )
      .map((day: any) => ({
        day: day.day as string,
        meals: day.meals.map((m: any) => String(m)),
      }));
    if (days.length) return days;
  }
  return [];
}

// Helper to create exercise plan from AI response
function parseExercisePlanResponse(content: string): { day: string; exercises: { name: string; sets: number; reps: number }[] }[] {
  for (const data of jsonArraysIn(content)) {
    if (!Array.isArray(data)) continue;
    const days = data
      .filter((d: any) => d && Array.isArray(d.exercises) && d.exercises.length > 0)
      .map((day: any) => ({
        day: typeof day.day === 'string' ? day.day : 'Day',
        exercises: day.exercises.map((ex: any) => ({
          name: ex?.exerciseName || ex?.name || 'Exercise',
          sets: Number(ex?.sets) || 3,
          reps: Number(ex?.reps) || 10,
        })),
      }));
    if (days.length) return days;
  }
  return [];
}

/** "Breakfast: 2 idlis + sambar (420 kcal)" → slot / items / kcal. */
function splitMealLine(line: string) {
  const kcalMatch = line.match(/[（(]?\s*(\d{2,4})\s*kcal\s*[)）]?/i);
  let rest = line;
  let kcal: string | null = null;
  if (kcalMatch) {
    kcal = kcalMatch[1];
    rest = line
      .replace(kcalMatch[0], '')
      .replace(/\s{2,}/g, ' ')
      .replace(/[\s·,–-]+$/, '')
      .trim();
  }
  const m = rest.match(/^([^:：]{2,24})[:：]\s*(.+)$/);
  return {
    slot: m ? m[1].trim() : null,
    items: (m ? m[2] : rest).trim(),
    kcal,
  };
}

/** Compact plan preview card shown as an attachment under the answer. */
function PlanCard({
  plan,
  kind,
  saved,
  onSave,
  onOpen,
}: {
  plan: { day: string; lines: string[] }[];
  kind?: 'meal' | 'exercise';
  saved?: boolean;
  onSave: () => void;
  onOpen: () => void;
}) {
  const isExercise = kind === 'exercise';
  const count = plan.reduce((n, d) => n + d.lines.length, 0);
  const sub = isExercise
    ? `${plan.length} day${plan.length === 1 ? '' : 's'} · ${count} exercise${count === 1 ? '' : 's'}`
    : plan.length > 1
      ? `${plan.length} days · ${count} meals`
      : `${plan[0]?.day || 'Today'} · ${count} meal${count === 1 ? '' : 's'}`;

  return (
    <section className={ui.plan}>
      <header className={ui.planHead}>
        <span className={ui.planIcon}>
          {isExercise ? <Dumbbell size={17} /> : <UtensilsCrossed size={17} />}
        </span>
        <div className={ui.planTitle}>
          <h4>{isExercise ? 'Workout plan preview' : 'Meal plan preview'}</h4>
          <p className={ui.planSub}>{sub}</p>
        </div>
        <span className={`${ui.badge} ${saved ? ui.badgeSaved : ''}`}>
          {saved ? 'Saved' : 'Not saved'}
        </span>
      </header>

      <div className={ui.planBody}>
        {plan.map((day, di) => {
          const multiDay = plan.length > 1;

          // Multi-day plans collapse to one summary line per day so the card
          // never swallows the whole conversation.
          if (multiDay) {
            const kcal = day.lines.reduce((sum, line) => {
              const k = line.match(/(\d{2,4})\s*kcal/i);
              return sum + (k ? parseInt(k[1], 10) : 0);
            }, 0);
            const sets = day.lines.reduce((sum, line) => {
              const m = line.match(/—\s*(\d+)\s*×\s*(\d+)/);
              return sum + (m ? parseInt(m[1], 10) : 0);
            }, 0);
            const detail = isExercise
              ? `${day.lines.length} exercise${day.lines.length === 1 ? '' : 's'}${sets ? ` · ${sets} sets` : ''}`
              : `${day.lines.length} meal${day.lines.length === 1 ? '' : 's'}${kcal ? ` · ${kcal.toLocaleString()} kcal` : ''}`;
            return (
              <div className={ui.exRow} key={`${day.day}-${di}`}>
                <span className={ui.dayName}>{day.day}</span>
                <span className={ui.exSets}>{detail}</span>
              </div>
            );
          }

          return (
            <div key={`${day.day}-${di}`}>
              {day.lines.map((line, li) => {
                if (isExercise) {
                  const m = line.match(/^(.*?)\s+—\s+(\d+)\s*×\s*(\d+)\s*$/);
                  return (
                    <div className={ui.exRow} key={li}>
                      <span className={ui.exName}>{m ? m[1] : line}</span>
                      {m && (
                        <span className={ui.exSets}>
                          {m[2]} × {m[3]}
                        </span>
                      )}
                    </div>
                  );
                }
                const row = splitMealLine(line);
                return (
                  <div className={`${ui.planRow} ${row.slot ? '' : ui.planRowWide}`} key={li}>
                    {row.slot && <span className={ui.slot}>{row.slot}</span>}
                    <span className={ui.items}>{row.items}</span>
                    {row.kcal && <span className={ui.kcal}>{row.kcal}</span>}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <div className={ui.planFoot}>
        <button
          type="button"
          className={`${ui.btn} ${ui.btnPrimary}`}
          onClick={onSave}
          disabled={saved}
        >
          <Check size={15} />
          {saved
            ? isExercise
              ? 'Saved to Exercise Plan'
              : 'Saved to Meal Plan'
            : isExercise
              ? 'Save to Exercise Plan'
              : 'Save to Meal Plan'}
        </button>
        <button type="button" className={`${ui.btn} ${ui.btnGhost}`} onClick={onOpen}>
          Open
          <ArrowUpRight size={14} />
        </button>
      </div>
    </section>
  );
}

export default function ChatBot({ mode = 'floating', onClose }: ChatBotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      role: 'assistant',
      content: "Hey! I'm V 👋 — your gym buddy around here. What's on your mind today?",
      timestamp: '10:30 AM',
      followUps: ['Analyze my progress', 'Suggest a meal', 'Give me exercise tips'],
    },
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const [dailyCount, setDailyCount] = useState(0);
  const messagesRef = useRef<HTMLDivElement>(null);
  const historyLoadedRef = useRef(false);
  // Last prompt text — the "Retry" chip re-sends it instead of sending the
  // literal word "retry" to the AI.
  const lastPromptRef = useRef<string>('');
  // True once the first streamed token lands — hides the typing dots
  const firstTokenRef = useRef(false);
  const { profile, meals, calculations, workoutPlan, foodPreferences, setFoodPreferences, setWorkoutPlan } = useStore();
  const router = useRouter();
  const { showToast } = useToast();

  // Restore persisted conversation + today's message count once on mount
  useEffect(() => {
    const stored = loadChatHistory();
    if (stored) setMessages(stored);
    setDailyCount(loadDailyCount());
    historyLoadedRef.current = true;
  }, []);

  // Persist the conversation so history survives app restarts
  // (debounced — streaming updates messages on every token)
  useEffect(() => {
    if (!historyLoadedRef.current) return;
    const t = setTimeout(() => saveChatHistory(messages), 400);
    return () => clearTimeout(t);
  }, [messages]);

  // Greet by name once the profile is known
  useEffect(() => {
    if (!profile?.name) return;
    setMessages(prev =>
      prev.map(m =>
        m.id === 1 && m.role === 'assistant'
          ? { ...m, content: `Hey ${profile.name}! V here 👋 — good to see you! What are we working on today?` }
          : m
      )
    );
  }, [profile?.name]);

  // Build personalized context for AI (real data only)
  const chatContext = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const todayMeals = meals.filter(m => m.loggedAt.startsWith(today));
    const nutrition = sumMealNutrition(todayMeals);
    const todayExercises = workoutPlan?.exercises?.filter((e: any) => e.day === new Date().getDay()) || [];
    const todayWaterL = meals.length > 0 ? 2.0 : 0; // approximate
    const todaySleep = 7; // approximate - would come from store
    const burnedCalories = todayExercises.reduce((sum: number, e: any) => sum + estimateExerciseCalories(e), 0);

    const todayDayName = PLAN_DAY_NAMES[(new Date().getDay() + 6) % 7];
    const plannedToday = workoutPlan?.exercises?.filter((e: any) => e.day === todayDayName) || [];
    const fmtExercise = (e: { exerciseName: string; sets: number; reps: number; weight?: number; duration?: number }) =>
      e.duration && e.sets === 1 && e.reps === 1
        ? `${e.exerciseName} ${e.duration}min`
        : `${e.exerciseName} ${e.sets}x${e.reps}${e.weight !== undefined ? ` @${e.weight}kg` : ''}`;

    return {
      username: profile?.name || undefined,
      profile: profile
        ? {
            gender: profile.gender,
            bmi: calculations?.bmi || null,
            bmr: calculations?.bmr || null,
            tdee: calculations?.tdee || null,
            weight: profile.weight,
            height: profile.height,
            age: profile.age,
            activityLevel: profile.activityLevel || 'moderate',
            targetCalories: calculations?.targetCalories,
            protein: calculations?.protein,
            carbs: calculations?.carbs,
            fat: calculations?.fat,
            hydration: calculations?.hydration,
            healthProblems: profile.healthProblems?.length ? profile.healthProblems : undefined,
          }
        : null,
      recentMeals: todayMeals.map(m => m.foodName).join(', ') || undefined,
      healthGoal: profile?.goal || undefined,
      dailyCalories: nutrition.calories || undefined,
      dailyProtein: nutrition.protein || undefined,
      dailyCarbs: nutrition.carbs || undefined,
      dailyFat: nutrition.fat || undefined,
      dailyWater: todayWaterL || undefined,
      waterGoal: calculations?.hydration || undefined,
      sleepHours: todaySleep || undefined,
      burnedCalories: burnedCalories || undefined,
      todayWorkout: plannedToday.map(fmtExercise).join('; ') || undefined,
      loggedWorkout: todayExercises.map(fmtExercise).join('; ') || undefined,
      allergies: foodPreferences.allergies?.length ? foodPreferences.allergies : undefined,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, meals, calculations, workoutPlan, foodPreferences]);

  useBackHandler(mode === 'floating' && isOpen, () => setIsOpen(false));

  // Follow the conversation. `isOpen` is in the list because the sheet (and
  // its scroll container) only mounts when the launcher is tapped — without it
  // the first open would start at the top of the history.
  useEffect(() => {
    const el = messagesRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: isTyping ? 'auto' : 'smooth' });
  }, [messages, isTyping, isOpen]);

  // Jump (without animation) once the sheet has laid out — fonts and the plan
  // cards can settle a frame later and leave the newest message half hidden.
  useEffect(() => {
    if (mode === 'floating' && !isOpen) return;
    const el = messagesRef.current;
    if (!el) return;
    const jump = () => {
      el.scrollTop = el.scrollHeight;
    };
    jump();
    const raf = requestAnimationFrame(jump);
    const t = window.setTimeout(jump, 220);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t);
    };
  }, [isOpen, mode]);

  const stamp = () =>
    new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  const pushAssistant = (content: string, followUps: string[] = []) => {
    setMessages(prev => [
      ...prev,
      { id: Date.now() + 1, role: 'assistant', content, timestamp: stamp(), followUps },
    ]);
  };

  /** Newest message that carries a plan of this kind. */
  const lastPlanMessage = (kind: PlanBlock['kind']) =>
    [...messages]
      .reverse()
      .find(m => m.role === 'assistant' && planBlockOf(m, kind));

  /** Flip the saved flag on one card without touching the other kind. */
  const markPlanSaved = (msgId: number, kind: PlanBlock['kind']) => {
    setMessages(prev =>
      prev.map(m => {
        if (m.id !== msgId) return m;
        const blocks = planBlocksOf(m).map(b => (b.kind === kind ? { ...b, saved: true } : b));
        return {
          ...m,
          plans: blocks.length ? blocks : m.plans,
          saved: (m.planKind ?? 'meal') === kind ? true : m.saved,
          followUps: (m.followUps ?? []).filter(
            f => !new RegExp(`^save.*${kind}`, 'i').test(f)
          ),
        };
      })
    );
  };

  /** Write a meal plan card into the Meal Plan page and mark it saved. */
  const saveMealPlan = (msg?: Message) => {
    const block = planBlockOf(msg, 'meal');
    if (!msg || !block) {
      pushAssistant(
        "I don't have a meal plan to save yet — ask me for one (for example “Create a weight-gain meal plan with my portions”) and I'll build it first.",
        ['Create a meal plan']
      );
      return;
    }

    const days: ParsedPlanDay[] = block.plan.map(d => ({ day: d.day, meals: d.lines }));
    const result = savePlanToPreferences(days, foodPreferences);
    setFoodPreferences(result.prefs);
    showToast(`🍽️ Added ${result.added} foods to your Meal Plan`, 'success');

    markPlanSaved(msg.id, 'meal');
    setMessages(prev => [
      ...prev,
      {
        id: Date.now() + 1,
        role: 'assistant',
        content:
          `✅ Saved **${result.added}** food${result.added === 1 ? '' : 's'} across **${result.days}** day${result.days === 1 ? '' : 's'} to your Meal Plan.` +
          (result.unmatched > 0
            ? `\n${result.unmatched} item${result.unmatched === 1 ? '' : 's'} weren't in the food database — they're listed by name with 0 kcal until you log them.`
            : '') +
          `\n\nOpen **Meal Plan** to see it.`,
        timestamp: stamp(),
        followUps: ['Open Meal Plan'],
      },
    ]);
  };

  /** Write a workout plan card into the Exercise Plan page and mark it saved. */
  const saveExercisePlan = (msg?: Message) => {
    const block = planBlockOf(msg, 'exercise');
    if (!msg || !block) {
      pushAssistant(
        "I don't have a workout plan to save yet — ask me for one (for example “Build me a 4-day home workout plan”) and I'll write it first.",
        ['Create a workout plan']
      );
      return;
    }

    // Card lines look like "Push-Ups — 3 × 12"; rebuild the structured days.
    const days: AiExercisePlanDay[] = block.plan.map(d => ({
      day: d.day,
      exercises: d.lines.map(line => {
        const m = line.match(/^(.*?)\s+—\s+(\d+)\s*×\s*(\d+)\s*$/);
        return m
          ? { name: m[1], sets: parseInt(m[2], 10), reps: parseInt(m[3], 10) }
          : { name: line, sets: 3, reps: 10 };
      }),
    }));

    const result = mergeAiExercisePlan(days, workoutPlan, { goal: profile?.goal ?? null });
    setWorkoutPlan(result.plan);
    showToast(`💪 Added ${result.added} exercises to your Exercise Plan`, 'success');

    markPlanSaved(msg.id, 'exercise');
    setMessages(prev => [
      ...prev,
      {
        id: Date.now() + 1,
        role: 'assistant',
        content:
          `✅ Saved **${result.added}** exercise${result.added === 1 ? '' : 's'} across **${result.days}** day${result.days === 1 ? '' : 's'} to your Exercise Plan.` +
          (result.matched < result.added
            ? `\n${result.added - result.matched} weren't in the built-in library, so they'll show by name only.`
            : '') +
          `\n\nOpen **Exercise Plan** to see it.`,
        timestamp: stamp(),
        followUps: ['Open Exercise Plan'],
      },
    ]);
  };

  const openPlanPage = (kind: 'meal' | 'exercise') => {
    if (mode === 'floating') setIsOpen(false);
    router.push(kind === 'exercise' ? '/exercise-plan' : '/meal-plan');
  };

  const handleSend = async (text?: string) => {
    if (isTyping) return;

    let sendText = text || message.trim();

    // "Retry" chip → resend the previous prompt (a failed turn must not force
    // the user to retype anything).
    if (sendText.trim().toLowerCase() === 'retry' && lastPromptRef.current) {
      sendText = lastPromptRef.current;
    } else if (
      sendText &&
      !/^(save plan|save to meal plan|add to meal plan|open meal plan|save to exercise plan|save workout plan|open exercise plan)$/i.test(sendText.trim())
    ) {
      lastPromptRef.current = sendText;
    }
    if (!sendText) return;

    // "Save plan" / "Open Meal Plan" are local actions: no AI call, no daily
    // limit cost. Saving copies the parsed plan straight into the Meal Plan page.
    const localAction = sendText.trim().toLowerCase();
    const timestampNow = stamp();

    if (localAction === 'open meal plan') {
      setMessage('');
      openPlanPage('meal');
      return;
    }

    if (localAction === 'save plan' || localAction === 'save to meal plan' || localAction === 'add to meal plan') {
      setMessage('');
      setMessages(prev => [
        ...prev,
        { id: Date.now(), role: 'user', content: sendText, timestamp: timestampNow },
      ]);
      saveMealPlan(lastPlanMessage('meal'));
      return;
    }

    if (localAction === 'open exercise plan') {
      setMessage('');
      openPlanPage('exercise');
      return;
    }

    if (localAction === 'save to exercise plan' || localAction === 'save workout plan') {
      setMessage('');
      setMessages(prev => [
        ...prev,
        { id: Date.now(), role: 'user', content: sendText, timestamp: timestampNow },
      ]);
      saveExercisePlan(lastPlanMessage('exercise'));
      return;
    }

    const currentCount = dailyCount;
    if (currentCount >= FREE_DAILY_LIMIT) {
      const limitMessage: Message = {
        id: messages.length + 1,
        role: 'assistant',
        content: `Whoa — you hit today's ${FREE_DAILY_LIMIT}-message limit! Even gym buddies need a rest day 😅 Come back tomorrow and we'll keep going.`,
        timestamp: timestampNow,
        followUps: ['Workout tips', 'Health tips'],
      };
      setMessages(prev => [...prev, limitMessage]);
      return;
    }

    const now = new Date();
    const timestamp = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    const userMessage: Message = {
      id: messages.length + 1,
      role: 'user',
      content: sendText,
      timestamp,
    };

    setMessages(prev => [...prev, userMessage]);
    setMessage('');
    setIsTyping(true);

    // Count against the daily limit (persisted per day)
    const newCount = currentCount + 1;
    setDailyCount(newCount);
    saveDailyCount(newCount);

    let aiMsgId: number | null = null; // reply bubble — created on first visible text
    try {
      let response: string;
      let followUps: string[] = [];

      // ── ChatGPT-style reveal ──────────────────────────────────────────────
      // Raw tokens land in `raw`, the machine-readable JSON tail is held back,
      // and a frame loop prints the visible text a few characters at a time.
      // Long answers therefore type themselves out line by line instead of
      // appearing as one block (some proxies deliver the whole body at once).
      aiMsgId = Date.now() + 1;
      let raw = '';
      let full = '';
      let shown = 0;
      let bubbleAdded = false;
      let paintRaf = 0;
      let paintDone: (() => void) | null = null;

      const addBubble = () => {
        if (bubbleAdded) return;
        bubbleAdded = true;
        firstTokenRef.current = true; // hide the typing dots
        setMessages(prev => [
          ...prev,
          { id: aiMsgId as number, role: 'assistant', content: '', timestamp },
        ]);
      };

      const paint = () => {
        paintRaf = 0;
        if (shown < full.length) {
          shown = Math.min(full.length, shown + 6); // ~360 chars/sec at 60fps
          const slice = full.slice(0, shown);
          setMessages(prev => prev.map(m => (m.id === aiMsgId ? { ...m, content: slice } : m)));
        }
        if (shown < full.length) {
          paintRaf = requestAnimationFrame(paint);
        } else if (paintDone) {
          const done = paintDone;
          paintDone = null;
          done();
        }
      };

      const pump = () => {
        if (!paintRaf) paintRaf = requestAnimationFrame(paint);
      };

      /** Resolve once every visible character is on screen (safety net 4s). */
      const revealDone = () =>
        new Promise<void>((resolve) => {
          if (shown >= full.length) {
            resolve();
            return;
          }
          paintDone = resolve;
          window.setTimeout(() => {
            if (paintDone) {
              const done = paintDone;
              paintDone = null;
              done();
            }
          }, 4000);
          pump();
        });

      /** Strip the machine tail before it can ever be printed. */
      const visiblePart = () => {
        const i = raw.search(/\n?\s*(?:JSON:\s*)?\[\s*\{\s*"day"/);
        return i >= 0 ? raw.slice(0, i) : raw;
      };

      if (hasGeminiKey()) {
        const history: ChatHistoryMessage[] = messages
          .slice(-10)
          .map(m => ({ role: m.role, content: m.content }));

        firstTokenRef.current = false;
        response = await getChatResponse(sendText, chatContext, history, (delta) => {
          raw += delta;
          full = visiblePart();
          addBubble();
          pump();
        });
      } else {
        response = findResponse(sendText);
      }
      followUps = getFollowUps(sendText);

      // Parse every plan block in the reply. A single answer can carry both a
      // meal plan and a workout plan ("plan my meals and give me a gym split"),
      // and each one becomes its own saveable card.
      const mealPlan = parseMealPlanResponse(response);
      const exercisePlan = parseExercisePlanResponse(response);

      const planBlocks: PlanBlock[] = [];
      if (mealPlan.length) {
        planBlocks.push({ kind: 'meal', plan: mealPlan.map(d => ({ day: d.day, lines: d.meals })) });
      }
      if (exercisePlan.length) {
        planBlocks.push({
          kind: 'exercise',
          plan: exercisePlan.map(d => ({
            day: d.day,
            lines: d.exercises.map(e => `${e.name} — ${e.sets ?? 3} × ${e.reps ?? 10}`),
          })),
        });
      }

      if (planBlocks.length) {
        followUps = [
          ...planBlocks.map(b => (b.kind === 'exercise' ? 'Save to Exercise Plan' : 'Save to Meal Plan')),
          ...followUps.filter(f => !/^save /i.test(f)),
        ];
      }

      // The machine-readable tail never reaches the screen.
      response = response
        .replace(/\n?\s*(?:JSON:\s*)?\[\s*\{\s*"day"[\s\S]*\]\s*$/, '')
        .trimEnd();

      // Type out whatever is left at reading pace, then attach chips + preview.
      full = response;
      raw = response;
      addBubble();
      await revealDone();
      if (paintRaf) {
        cancelAnimationFrame(paintRaf);
        paintRaf = 0;
      }

      // One bubble, one card per plan kind — never a chain of extra bubbles.
      setMessages(prev =>
        prev.map(m =>
          m.id === aiMsgId
            ? {
                ...m,
                content: response,
                followUps,
                plans: planBlocks.length ? planBlocks : undefined,
                plan: planBlocks[0]?.plan,
                planKind: planBlocks[0]?.kind,
              }
            : m
        )
      );

    } catch (error) {
      console.error('Chat AI error:', error);
      // A failed turn must not burn one of the 5 daily messages — refund it so
      // Retry costs nothing extra.
      try {
        const refunded = Math.max(0, loadDailyCount() - 1);
        setDailyCount(refunded);
        saveDailyCount(refunded);
      } catch {
        // best-effort
      }
      const fallback = findResponse(sendText);
      const followUps = ['Retry', ...getFollowUps(sendText)];

      if (aiMsgId !== null) {
        // Keep whatever streamed before the connection died; otherwise explain.
        // If the bubble was never created (error before the first token), add it.
        const errorText = `⚠️ ${error instanceof Error ? error.message : 'Something went wrong.'}\n\n${fallback}`;
        const mid = aiMsgId;
        setMessages(prev => {
          if (!prev.some(m => m.id === mid)) {
            return [...prev, { id: mid, role: 'assistant', content: errorText, timestamp, followUps }];
          }
          return prev.map(m =>
            m.id === mid
              ? {
                  ...m,
                  content: m.content
                    ? `${m.content}\n\n⚠️ The answer was interrupted — tap Retry to finish.`
                    : errorText,
                  followUps,
                }
              : m
          );
        });
      } else {
        setMessages(prev => [
          ...prev,
          { id: messages.length + 2, role: 'assistant', content: `⚠️ ${error instanceof Error ? error.message : 'Something went wrong.'}\n\n${fallback}`, timestamp, followUps },
        ]);
      }
    } finally {
      setIsTyping(false);
    }
  };

  // Wipe the conversation (and its stored history) back to the greeting
  const handleClearChat = () => {
    setMessages([defaultGreeting(profile?.name)]);
    setMessage('');
    try {
      localStorage.removeItem(CHAT_HISTORY_KEY);
    } catch {
      // best-effort
    }
  };

  const online = hasGeminiKey();
  const closeChat = onClose ?? (() => setIsOpen(false));
  const showClose = mode === 'floating' || Boolean(onClose);

  const surface = (
    <div className={ui.shell}>
      {/* Header */}
      <header className={ui.header}>
        <div className={ui.headAvatar} aria-hidden="true">
          <Bot size={19} />
        </div>
        <div className={ui.headText}>
          <h1 className={ui.headTitle}>V</h1>
          <p className={ui.headSub}>
            <span className={ui.dot} data-online={online} />
            {online ? 'Gemini AI' : 'Offline'} · {dailyCount}/{FREE_DAILY_LIMIT} today
          </p>
        </div>
        <div className={ui.headActions}>
          <button
            type="button"
            onClick={handleClearChat}
            title="Clear chat history"
            aria-label="Clear chat history"
            className={ui.iconBtn}
          >
            <Trash2 size={18} />
          </button>
          {showClose && (
            <button type="button" onClick={closeChat} aria-label="Close chat" className={ui.iconBtn}>
              <X size={18} />
            </button>
          )}
        </div>
      </header>

      {/* Messages */}
      <div className={ui.messages} ref={messagesRef}>
        <div className={ui.thread}>
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`${ui.row} ${msg.role === 'user' ? ui.rowMe : ''} ${msg.plan && msg.plan.length > 0 ? ui.rowPlan : ''}`}
            >
              {msg.role === 'assistant' && (
                <div className={ui.avatar} aria-hidden="true">
                  <Bot size={17} />
                </div>
              )}

              <div className={ui.stack}>
                {msg.content && (
                  <div className={`${ui.bubble} ${msg.role === 'user' ? ui.bubbleMe : ''}`}>
                    {renderContent(msg.content)}
                  </div>
                )}

                {planBlocksOf(msg).map(block => (
                  <PlanCard
                    key={`${msg.id}-${block.kind}`}
                    plan={block.plan}
                    kind={block.kind}
                    saved={block.saved}
                    onSave={() =>
                      block.kind === 'exercise' ? saveExercisePlan(msg) : saveMealPlan(msg)
                    }
                    onOpen={() => openPlanPage(block.kind)}
                  />
                ))}

                <div className={ui.meta}>
                  <span>{msg.timestamp}</span>
                  {msg.role === 'assistant' && (
                    <Link
                      href={AI_REPORT_HREF}
                      aria-label="Report this AI response"
                      className={ui.metaBtn}
                    >
                      <Flag size={12} />
                    </Link>
                  )}
                </div>

                {msg.followUps && msg.followUps.length > 0 && (
                  <div className={`${ui.chips} ${isTyping ? ui.chipsDisabled : ''}`}>
                    {msg.followUps.map((followUp, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleSend(followUp)}
                        className={`${ui.chip} ${/^save /i.test(followUp) ? ui.chipPrimary : ''}`}
                      >
                        {followUp}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {isTyping && !firstTokenRef.current && (
            <div className={ui.row}>
              <div className={ui.avatar} aria-hidden="true">
                <Bot size={17} />
              </div>
              <div className={ui.stack}>
                <div className={`${ui.bubble} ${ui.typing}`}>
                  <i />
                  <i />
                  <i />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Composer */}
      <footer className={ui.composer}>
        <div className={ui.composerInner}>
          <div className={ui.tray}>
            <div className={ui.tiles}>
              {QUICK_PROMPTS.map((q) => (
                <button
                  key={q.label}
                  type="button"
                  className={ui.tile}
                  onClick={() => handleSend(q.prompt)}
                  disabled={isTyping}
                >
                  {q.label}
                </button>
              ))}
            </div>
          </div>

          <div className={ui.inputRow}>
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ask V anything..."
              aria-label="Message V"
              className={ui.input}
            />
            <button
              type="button"
              onClick={() => handleSend()}
              disabled={!message.trim() || isTyping}
              aria-label="Send message"
              className={ui.send}
            >
              <Send size={18} />
            </button>
          </div>

          <p className={ui.hint}>
            <span>
              <b>{FREE_DAILY_LIMIT}</b> messages a day · saved plans don’t count
            </span>
            <span className={ui.hintWarn}>V can make mistakes</span>
          </p>
        </div>
      </footer>
    </div>
  );

  // Inline mode — the page supplies the height.
  if (mode === 'inline') {
    return <div className="h-full min-h-0">{surface}</div>;
  }

  // Floating mode — launcher button + full-screen sheet.
  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? 'Minimise chat' : 'Open chat with V'}
        className={`fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 w-12 h-12 sm:w-14 sm:h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 ${isOpen ? 'bg-on-surface text-surface-container' : 'bg-gradient-to-br from-primary to-primary-light text-on-primary hover:scale-110'}`}
      >
        {isOpen ? (
          <Minimize2 className="w-5 h-5 sm:w-6 sm:h-6" />
        ) : (
          <div className="relative">
            <MessageCircle className="w-5 h-5 sm:w-6 sm:h-6" />
            <div className="absolute -top-1 -right-1 w-2.5 h-2.5 sm:w-3 sm:h-3 bg-tertiary rounded-full animate-pulse" />
          </div>
        )}
      </button>

      {isOpen && (
        <div
          className={`fixed inset-0 sm:inset-4 md:inset-8 z-50 overflow-hidden sm:rounded-2xl shadow-elevated border-0 sm:border sm:border-outline-variant/20 ${ui.window}`}
        >
          {surface}
        </div>
      )}
    </>
  );
}
