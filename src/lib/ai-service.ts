import { allFoods } from './food-database';
import { FoodItem } from './types';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';

const GEMINI_MODEL = 'gemini-3.6-flash';

// Cloudflare Worker proxy — key lives server-side, never in the app.
const AI_PROXY_URL = (process.env.NEXT_PUBLIC_AI_PROXY_URL || '').trim().replace(/\/+$/, '');
const APP_CLIENT_SECRET = (process.env.NEXT_PUBLIC_APP_CLIENT_SECRET || '').trim();

function getGeminiKey(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('gemini_api_key');
  }
  return null;
}

export function getCurrentModel(): string {
  return GEMINI_MODEL;
}

export function isApiKeySet(): boolean {
  return !!getGeminiKey() || !!AI_PROXY_URL;
}

export function hasGeminiKey(): boolean {
  return !!getGeminiKey() || !!AI_PROXY_URL;
}

// ─── Gemini API Call ─────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Translate provider/proxy error text into something a human can act on. */
function friendlyAiError(raw: string | undefined, status: number): Error {
  const text = (raw || '').trim();
  if (status === 429 || /resting|quota|rate limit/i.test(text)) {
    return new Error('V is resting right now. Try again in a minute.');
  }
  if (/rejected|overloaded|capacity|unavailable/i.test(text)) {
    return new Error('V is a bit overloaded right now — tap Retry in a moment.');
  }
  if (status >= 500) {
    return new Error('V could not reach the AI just now — tap Retry.');
  }
  return new Error(text || `AI request failed (HTTP ${status}).`);
}

async function callGemini(
  messages: Array<{ role: string; content: any }>,
  maxTokens = 1024,
  onDelta?: (delta: string) => void
): Promise<string> {
  const payload: Record<string, any> = {
    model: GEMINI_MODEL,
    messages,
    max_tokens: maxTokens,
    temperature: 0.7,
  };
  if (onDelta) payload.stream = true;

  let url: string;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (AI_PROXY_URL) {
    url = AI_PROXY_URL;
    if (APP_CLIENT_SECRET) headers['X-App-Client'] = APP_CLIENT_SECRET;
  } else {
    const key = getGeminiKey();
    if (!key) throw new Error('Gemini API key not configured.');
    url = `${GEMINI_API_URL}?key=${key}`;
  }

  /** One complete request + parse. Throws on any failure (retried below). */
  const attemptOnce = async (
    emitDelta?: (delta: string) => void,
    msgs: Array<{ role: string; content: any }> = messages
  ): Promise<{ text: string; finish: string }> => {
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...payload, messages: msgs }),
      });
    } catch {
      throw new Error('Network problem reaching V — check your internet.');
    }

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const raw =
        typeof err?.error === 'string' ? err.error : err?.error?.message || err?.message;
      throw friendlyAiError(raw, response.status);
    }

    // Non-streaming: single JSON response
    if (!emitDelta) {
      const data = await response.json();
      return {
        text: data.choices?.[0]?.message?.content || '',
        finish: data.choices?.[0]?.finish_reason || '',
      };
    }

    // Endpoint ignored stream=true (e.g. a proxy) — fall back to plain JSON
    const ctype = response.headers.get('content-type') || '';
    if (!response.body || !ctype.includes('text/event-stream')) {
      const data = await response.json().catch(() => null);
      const text = data?.choices?.[0]?.message?.content || '';
      if (text) emitDelta(text);
      return { text, finish: data?.choices?.[0]?.finish_reason || '' };
    }

    // Server-sent events: emit each content delta as it arrives (ChatGPT-style)
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let full = '';
    let finish = '';

    const processLine = (line: string) => {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) return;
      const data = trimmed.slice(5).trim();
      if (!data || data === '[DONE]') return;
      try {
        const json = JSON.parse(data);
        const delta: string | undefined = json.choices?.[0]?.delta?.content;
        if (delta) {
          full += delta;
          emitDelta(delta);
        }
        const fr = json.choices?.[0]?.finish_reason;
        if (fr) finish = fr;
      } catch {
        // ignore keep-alive / partial lines
      }
    };

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) processLine(line);
    }
    // Flush the tail — the stream can end WITHOUT a trailing newline, and that
    // final chunk carries the end of the message ("...just let me know!")
    buffer += decoder.decode(); // flush any multibyte char held mid-sequence (emoji)
    if (buffer) processLine(buffer);
    return { text: full, finish };
  };

  // The free proxy throws transient 429/502s and sometimes returns an empty
  // body — spaced retries turn most of those into a real answer instead of the
  // canned fallback. Never retry after tokens streamed (would duplicate text).
  let emitted = false;
  const wrappedDelta = onDelta
    ? (d: string) => {
        emitted = true;
        onDelta(d);
      }
    : undefined;

  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      let res = await attemptOnce(wrappedDelta);
      if (!res.text.trim()) throw new Error('V returned an empty answer — tap Retry.');

      // Stop reason "length" = the model was cut off mid-sentence at the token
      // cap. Ask it to carry on and append, so the bubble shows the full answer
      // instead of ending in the middle of a line. A stream that ends with no
      // finish reason at all is treated the same way when it clearly stops
      // mid-sentence.
      let continuations = 0;
      for (;;) {
        const hitCap = res.finish === 'length';
        const endsClean = /[.!?…)\]}"'’”:*`]\s*$/.test(res.text);
        const silentCut = !res.finish && res.text.length > 300 && !endsClean;
        if ((!hitCap && !silentCut) || continuations >= 3) break;
        continuations++;
        const next = await attemptOnce(wrappedDelta, [
          ...messages,
          { role: 'assistant', content: res.text },
          {
            role: 'user',
            content:
              'Continue exactly where you stopped. Do not repeat anything already written, do not restart the answer, no preamble.',
          },
        ]);
        if (!next.text.trim()) break;
        res = { text: res.text + next.text, finish: next.finish };
      }
      return res.text;
    } catch (e) {
      lastError = e instanceof Error ? e : new Error('Something went wrong.');
      const retryable =
        /resting|overloaded|rejected|empty answer|Network problem|could not reach|HTTP 5\d\d/i.test(
          lastError.message
        );
      if (emitted || !retryable || attempt === 3) break;
      await sleep(attempt === 1 ? 2500 : 7000);
    }
  }
  throw lastError ?? new Error('V could not answer right now.');
}

// ─── Dev Console Helper ──────────────────────────────────────────────────────

if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).__setGymAtHomeApiKey = (key: string) => {
    localStorage.setItem('gemini_api_key', key);
    console.log('✅ Gym at Home Gemini key saved');
  };
  (window as any).__clearGymAtHomeApiKey = () => {
    localStorage.removeItem('gemini_api_key');
    console.log('✅ Gym at Home Gemini key removed');
  };
  (window as any).__getGymAtHomeApiKey = () => {
    const key = localStorage.getItem('gemini_api_key');
    console.log(key ? `Gemini key: ${key.substring(0, 10)}...` : 'No API key set');
    return key;
  };
}

// ─── Food Recognition (Gemini Vision) ────────────────────────────────────────

export interface FoodSuggestion {
  food: FoodItem;
  confidence: number;
  reason: string;
}

export async function detectFoodFromPhoto(base64Image: string): Promise<FoodSuggestion[]> {
  const prompt = `Analyze this food/meal photo. For each food item visible, provide a JSON array.
Return ONLY valid JSON array, no markdown, no explanation.
Each item: { "name": "food name", "confidence": 0.0-1.0, "reason": "brief reason" }
Focus on identifying specific Indian foods if visible.
If no food visible, return empty array [].`;

  const content = [
    { type: 'text', text: prompt },
    { type: 'image_url', image_url: { url: base64Image } },
  ];

  const response = await callGemini([
    { role: 'user', content },
  ], 1024);

  let detected: Array<{ name: string; confidence: number; reason: string }>;
  try {
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    detected = JSON.parse(jsonMatch[0]);
  } catch {
    return [];
  }

  const suggestions: FoodSuggestion[] = [];
  const seenIds = new Set<string>();

  for (const item of detected) {
    if (!item.name || seenIds.has(item.name.toLowerCase())) continue;

    const searchTerm = item.name.toLowerCase();
    const queryWords = searchTerm.split(/[\s,()]+/).filter(Boolean);
    const matches = allFoods
      .filter(f => {
        const name = f.name.toLowerCase();
        if (name.includes(searchTerm) || searchTerm.includes(name)) return true;
        // Word overlap — "Masala Dosa" should still find "Dosa" in the DB
        const nameWords = name.split(/[\s,()]+/).filter(Boolean);
        return queryWords.some(w => w.length > 3 && nameWords.includes(w));
      })
      .slice(0, 3);

    for (const food of matches) {
      if (seenIds.has(food.id)) continue;
      seenIds.add(food.id);
      suggestions.push({
        food,
        confidence: Math.min(item.confidence || 0.7, 1),
        reason: item.reason || `AI identified "${item.name}"`,
      });
    }

    if (matches.length === 0) {
      const fuzzy = allFoods.filter(f => {
        const words = searchTerm.split(' ');
        return words.some(w => w.length > 3 && f.name.toLowerCase().includes(w));
      }).slice(0, 2);

      for (const food of fuzzy) {
        if (seenIds.has(food.id)) continue;
        seenIds.add(food.id);
        suggestions.push({
          food,
          confidence: (item.confidence || 0.5) * 0.7,
          reason: `Similar to ${item.name}`,
        });
      }
    }
  }

  suggestions.sort((a, b) => b.confidence - a.confidence);
  return suggestions.slice(0, 8);
}

// ─── 7-Day Meal Plan Photo Detection ────────────────────────────────────────

export interface DayMealPlan {
  day: string;
  breakfast: string[];
  lunch: string[];
  dinner: string[];
}

export async function detectWeeklyMealPlan(base64Image: string): Promise<DayMealPlan[]> {
  const foodNames = allFoods.map(f => f.name).slice(0, 200).join(', ');

  const prompt = `Analyze this image of a 7-day meal plan or menu.
Return ONLY a valid JSON array, no markdown, no explanation.
Each day should have: { "day": "Monday/Tuesday/...", "breakfast": ["food1", "food2"], "lunch": ["food1", "food2"], "dinner": ["food1", "food2"] }

Use food names from this database when possible: ${foodNames}

If you can't identify a full week, return whatever days/meals you can identify.
If no meal plan visible, return empty array [].`;

  const content = [
    { type: 'text', text: prompt },
    { type: 'image_url', image_url: { url: base64Image } },
  ];

  const response = await callGemini([
    { role: 'user', content },
  ], 2048);

  let detected: DayMealPlan[];
  try {
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    detected = JSON.parse(jsonMatch[0]);
  } catch {
    return [];
  }

  return detected.filter(d => d.day && (d.breakfast?.length || d.lunch?.length || d.dinner?.length));
}

// ─── AI Chatbot ──────────────────────────────────────────────────────────────

export interface ChatContext {
  username?: string;
  profile?: {
    gender?: string | null;
    bmi?: number | null;
    bmr?: number | null;
    tdee?: number | null;
    weight?: number | null;
    height?: number | null;
    age?: number | null;
    activityLevel?: string;
    targetCalories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    hydration?: number;
    healthProblems?: string[];
  } | null;
  recentMeals?: string;
  healthGoal?: string;
  dailyCalories?: number;
  dailyProtein?: number;
  dailyCarbs?: number;
  dailyFat?: number;
  dailyWater?: number;
  waterGoal?: number;
  sleepHours?: number;
  burnedCalories?: number;
  todayWorkout?: string;
  loggedWorkout?: string;
  allergies?: string[];
}

export interface ChatHistoryMessage {
  role: string;
  content: string;
}

export async function getChatResponse(
  userMessage: string,
  context?: ChatContext,
  history?: ChatHistoryMessage[],
  onDelta?: (delta: string) => void,
  imageDataUrl?: string
): Promise<string> {
  const p = context?.profile;
  const goalLabels: Record<string, string> = {
    lose: 'fat loss / weight loss',
    maintain: 'maintain weight / general fitness',
    gain: 'muscle gain',
  };
  const goalText = goalLabels[context?.healthGoal || ''] || context?.healthGoal || 'general fitness';

  const profileBlock = p
    ? `USER PROFILE (personalize every answer with these real numbers):
- Name: ${context?.username || 'User'} (address them by name occasionally)
- Gender: ${p.gender || 'not set'}
- Age: ${p.age || 'N/A'} | Height: ${p.height || 'N/A'} cm | Weight: ${p.weight || 'N/A'} kg
- BMI: ${p.bmi || 'N/A'} | BMR: ${p.bmr || 'N/A'} kcal | TDEE: ${p.tdee || 'N/A'} kcal
- Goal: ${goalText}
- Activity level: ${p.activityLevel || 'moderate'}
- Daily targets: ${p.targetCalories || 'N/A'} kcal | protein ${p.protein || 'N/A'}g | carbs ${p.carbs || 'N/A'}g | fat ${p.fat || 'N/A'}g | water ${p.hydration || 'N/A'}L${context?.waterGoal && context.waterGoal !== p.hydration ? ` (hydration goal: ${context.waterGoal}L)` : ''}`
    : `USER PROFILE: Not set up yet. If they ask for personal numbers, ask them to complete their profile first.`;

  const conditionsBlock = p?.healthProblems?.length
    ? `\nHealth conditions: ${p.healthProblems.join(', ')} — factor these into all exercise/diet advice (see HEALTH CONDITIONS above) and add a medical disclaimer when relevant.`
    : '';
  const allergiesBlock = context?.allergies?.length
    ? `\nAllergies: ${context.allergies.join(', ')} — NEVER recommend foods containing these.`
    : '';

  const todayBlock = `
TODAY'S REAL DATA (from their app logs — use these, don't invent):
- Calories eaten: ${context?.dailyCalories ?? 'not logged'} kcal / target ${p?.targetCalories || 'N/A'} kcal
- Macros eaten: protein ${context?.dailyProtein ?? '—'}g, carbs ${context?.dailyCarbs ?? '—'}g, fat ${context?.dailyFat ?? '—'}g
- Water: ${context?.dailyWater ?? '0'}L / goal ${context?.waterGoal || p?.hydration || 'N/A'}L
- Sleep last night: ${context?.sleepHours ? `${context.sleepHours}h` : 'not logged'}
- Calories burned (exercise): ${context?.burnedCalories ?? '0'} kcal
- Planned workout today: ${context?.todayWorkout || 'no plan for today'}
- Logged exercises today: ${context?.loggedWorkout || 'none yet'}
- Meals logged today: ${context?.recentMeals || 'none yet'}`;

  const systemPrompt = `You are V — the user's gym buddy and go-to fitness friend in "Gym at Home". Under the hood you're a certified AI health & fitness assistant and everything you say is grounded in evidence-based guidelines (WHO, CDC, ACSM, AHA, USDA, ISSN, ICMR-NIN — India's National Institute of Nutrition — and Harvard T.H. Chan School of Public Health) — but you never sound like a textbook.

PERSONALITY — talk like a close friend, not an assistant:
- Warm, casual, conversational. Use contractions (you're, that's, don't) like you're texting a gym buddy.
- Be honest, upbeat, and a little playful. Light humor is welcome — no cringe.
- Use their name now and then. Celebrate wins, hype them up when they stay consistent, and keep them going after an off day — guilt-tripping is never okay.
- Match their energy: quick question = short friendly answer; bigger question = thoughtful but still casual.
- Never corporate, clinical, or robotic. No "As an AI...", "Certainly!", or lecture-mode.

CORE KNOWLEDGE — CITE THESE GUIDELINES:

NUTRITION (USDA DRI / ISSN 2017):
- Protein: 0.8g/kg sedentary → 1.2-1.6g/kg active → 1.6-2.2g/kg muscle gain/fat loss
- Carbs: 3-5g/kg sedentary → 5-7g/kg moderate → 8-12g/kg high intensity athlete
- Fat: 20-35% of total calories (IOM AMDR), minimum 0.5g/kg
- Fiber: 38g/day men, 25g/day women
- Water: 3.7L/day men, 2.7L/day women + 500-1000mL per hour exercise
- Meal timing: 0.4-0.55g protein/kg per meal (20-40g), spread evenly
- Pre-workout (1-3 hrs): easy carbs + moderate protein
- Post-workout (within 2 hrs): protein (20-40g) + carbs (2:1 to 4:1 ratio)
- Vitamin B12: 2.4mcg/day (critical for vegans)
- Iron: 8mg/day men, 18mg/day premenopausal women
- Calcium: 1000mg/day, Vitamin D: 15mcg (600 IU)/day

INDIAN CONTEXT (ICMR-NIN 2020 / Dietary Guidelines for Indians 2024):
- Protein RDA: 0.83 g/kg/day (EAR 0.66); sedentary adults ~54g (men) / ~46g (women). Training targets 1.6-2.2 g/kg still apply — DGI 2024 notes intakes above 1.6 g/kg add no further strength gains
- Plate balance: 50-55% carbs, 10-15% protein, 20-30% fat
- Fiber: 30g/day (~40g per 2000 kcal); Calcium: 1000mg/day
- Limits: sugar <25g/day (<5% of energy), salt <5g/day, cooking oil 25-30g/day
- My Plate for the Day (2000 kcal): cereals/millets 250g, vegetables 400g, fruits 100g, pulses/egg/meat 85g, milk/curd 300mL, nuts & seeds 35g, fats & oils 27g
- Vegetarian watch-outs: B12 deficiency affects 43-67% of Indian children (ICMR-NIN) — flag B12 (curd, eggs, fortified foods, supplement) and iron (dal/leafy greens + vitamin C) for vegetarian users
- Everyday Indian protein: 1 cup cooked dal ~12-15g, paneer 100g ~18g, egg ~6g, curd 100g ~3.5g, milk 250mL ~8g, 1 roti ~3g

EXERCISE (ACSM/CDC/WHO 2020):
- 150 min/week moderate aerobic OR 75 min vigorous OR combination
- 2+ strength training sessions/week, all major muscle groups
- 2-3 flexibility sessions/week
- Progressive overload: increase weight 2.5-5% when top of rep range hit
- Rep ranges: strength 1-5, hypertrophy 6-12, endurance 12+
- Rest: 60-90s between sets (hypertrophy), 3-5min (strength)
- Warm-up: 5-10 min dynamic stretching before
- Cool-down: 5-10 min static stretching after
- Max HR: 220 - age (Tanaka: 208 - 0.7 × age)
- Fat burning zone: 60-70% max HR (Zone 2)
- Deload every 4-8 weeks: reduce weight 40-60%, keep same exercises
- 48-72 hours between training same muscle group

BODY COMPOSITION (WHO/ACSM):
- BMI: <18.5 underweight, 18.5-24.9 normal, 25-29.9 overweight, 30+ obese
- BMR (Mifflin-St Jeor): Men 10×wt+6.25×ht-5×age+5, Women 10×wt+6.25×ht-5×age-161
- TDEE = BMR × Activity (1.2 sedentary, 1.375 light, 1.55 moderate, 1.725 active, 1.9 very active)
- Healthy weight loss: 0.5-1 kg/week (500 kcal deficit)
- Muscle gain: TDEE + 300-500 kcal, 1.6-2.2g protein/kg

SLEEP (NSF/AASM):
- Adults: 7-9 hours, athletes: 8-10 hours
- Cool room (18-20°C), dark, consistent schedule
- No screens 30-60 min before bed, no caffeine after 2 PM

HEALTH CONDITIONS (CDC/ADA/AHA):
- Diabetes: 150 min/week moderate exercise, high fiber, consistent meals
- Hypertension: DASH diet, <2300mg sodium, aerobic exercise reduces BP 5-8 mmHg
- Obesity: Combine diet + exercise, high protein to preserve muscle

SUPPLEMENTS (ISSN/Mayo Clinic):
- Whey protein: 20-40g post-workout or between meals
- Creatine: 3-5g daily monohydrate
- Caffeine: 3-6 mg/kg 30-60 min pre-exercise
- Vitamin D: 1000-2000 IU if deficient

RESPONSE FORMAT — every multi-line answer must be scannable and visually structured (the chat renders your markdown):
1. Start with ONE short friendly line (quick direct answer, acknowledgment, or hype) — no filler
2. Structure the body:
   - A line starting with "## " = section header — always put an emoji in it (e.g. "## 🍽️ Your Meal Plan"). Use when the answer has 2+ parts
   - Wrap key numbers, food names and takeaways in double asterisks for bold (e.g. **1.6g protein/kg**, **don't skip the warm-up**)
   - Lines starting with "- " = bullets; numbered lines (1. 2. 3.) = steps, routines or sequences
   - Emojis as visual markers on key lines: ✅ do, ❌ don't, ⚠️ warning, 💡 tip, 🔥 workout, 🍽️ meal, 💧 water, 😴 sleep, ⏱️ timing
3. End with ONE short closing line — encouragement or an offer to go deeper
4. One-liner questions stay one line — never force structure where it's noise
5. Always cite the source when giving specific numbers
6. Personalize advice using the user's profile and today's real logged data below
7. Never diagnose or replace medical advice
8. If unsure, say "I recommend consulting a healthcare professional"
9. Use metric units (kg, cm, kcal) as default
10. Stay in the friendly-gym-buddy persona (see PERSONALITY) — encouraging, honest, zero lectures
11. Remember the recent conversation history — maintain context across turns
12. When suggesting meals, respect their allergies and health conditions
13. Greet them by name if this is the start of a conversation
14. When the user is Indian, vegetarian, or asks about Indian foods — cite ICMR-NIN numbers alongside global ones and suggest familiar Indian foods (dal, roti, curd, paneer, millets, eggs) instead of Western examples

HTML FORMATTING — for multi-part answers you may use this safe HTML subset (the chat renders it with app styles):
- <strong> bold (use this instead of ** when using HTML), <em> italic
- <ul><li> lists and <ol><li> numbered steps
- <h3> section headings — start with an emoji, e.g. <h3>🍽️ Your Meal Picks</h3>
- <table><thead><tr><th>...</th></tr></thead><tbody><tr><td>...</td></tr></tbody></table> for comparisons, menus and plans — ALWAYS a header row, keep cells short
- <div class="ai-box ai-box-info"> for tips, <div class="ai-box ai-box-good"> for recommendations, <div class="ai-box ai-box-warn"> for warnings/limits
- <br> for line breaks
- NEVER emit script/style tags, event handlers (onclick etc.), iframes or forms — they are stripped anyway
- If the answer contains a table or box, use HTML tags throughout that answer (bold = <strong>, bullets = <ul>); short one-liner answers can stay plain text with **bold** and emoji

MEAL PLAN FLOW — when the user asks for a meal plan, diet plan, or "plan my meals":
1. Do NOT write the full plan immediately. First ask ONE short round of concrete portion questions about how much of each food they actually eat every day — e.g. "How many idlis do you eat for breakfast?", "How many rotis at lunch?", "How much rice (how many katoris) for dinner?", "Tea with sugar — how many cups a day?". Keep it to 3-4 quantity questions in one short paragraph, like a friend asking about your routine.
2. When they answer with quantities (e.g. "2 idlis, 3 rotis, 1 katori rice"), THEN build the plan using EXACTLY those foods and those quantities in every slot — "2 idlis + sambar", never vague words like "a serving". If they already gave quantities up front, skip the questions and build directly.
3. Always END the final plan reply with exactly one line in this format (the chat app turns it into a preview the user can save into their Meal Plan):
JSON: [{"day":"Today","meals":["Breakfast: 2 idlis + sambar","Mid-morning: 1 banana","Lunch: 3 rotis + dal","Snack: 1 cup curd","Dinner: 1 katori rice + mixed veg"]}]
Every meal string MUST start with its slot name and a colon — Breakfast:, Mid-morning:, Lunch:, Snack:, Dinner: — followed by the REAL quantities they told you. Use 4-6 short strings. Put the JSON line last, nothing after it, and keep the human-readable plan above it.
4. If the same message ALSO asks for a workout plan, output the meal JSON line first and then the exercise JSON line directly after it (two plan lines total, nothing else after them).

EXERCISE PLAN FLOW — when the user asks for a workout plan, exercise plan, or weekly gym schedule:
1. Write short day blocks (Monday, Tuesday, …) with 3-6 exercises each and explicit sets x reps, e.g. "Push-Ups — 3×12".
2. END the reply with exactly one line in this format (the chat app turns it into a preview the user can save into their Exercise Plan) — if a meal plan was requested too, this is the SECOND JSON line, placed right after the meal one:
JSON: [{"day":"Monday","exercises":[{"name":"Push-Ups","sets":3,"reps":12}]}]
3. Use plain exercise names (no equipment brands) and put the JSON line(s) last, nothing after them.${profileBlock}${conditionsBlock}${allergiesBlock}${todayBlock}`;

  const messages: Array<{ role: string; content: any }> = [
    { role: 'system', content: systemPrompt },
  ];

  if (history?.length) {
    for (const h of history) {
      if (h.role === 'user' || h.role === 'assistant') {
        // Caps keep the request body well under the proxy's size limit — old
        // formatted answers (tables/boxes) can be several KB each.
        const text = typeof h.content === 'string' ? h.content : '';
        messages.push({ role: h.role, content: text.length > 2500 ? `${text.slice(0, 2500)}…` : text });
      }
    }
  }

  if (imageDataUrl) {
    // Vision turn — text + image in one user message (OpenAI/Gemini multimodal)
    messages.push({
      role: 'user',
      content: [
        { type: 'text', text: userMessage },
        { type: 'image_url', image_url: { url: imageDataUrl } },
      ],
    });
  } else {
    messages.push({ role: 'user', content: userMessage });
  }

  if (hasGeminiKey()) {
    // 8192 tokens so thinking + a full 7-day plan fit without a mid-sentence
    // cut (the proxy lowers thinking effort and allows the same ceiling).
    // onDelta streams each token to the UI (ChatGPT-style) when provided.
    return await callGemini(messages, 8192, onDelta);
  }

  throw new Error('AI not configured. Set a proxy URL or add a Gemini key in Dev Settings.');
}