export interface Env {
  GEMINI_API_KEY?: string;
  GROQ_API_KEY?: string;
  GROQ_MODEL?: string;
  AI_PROVIDER?: string;
  APP_CLIENT_SECRET: string;
}

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_GEMINI_MODEL = 'gemini-3.6-flash';
const DEFAULT_GROQ_MODEL = 'llama-3.3-70b-versatile';

// Groq free tier is the primary limiter now. Window is per isolate (best-effort).
const RPM_LIMIT = 12;
let windowStart = 0;
let windowCount = 0;

const MAX_BODY_BYTES = 128 * 1024;
const MAX_MESSAGES = 60;
const MAX_CONTENT_CHARS = 32000;
const MAX_IMAGE_CHARS = 2_000_000;
const ALLOWED_ROLES = new Set(['system', 'user', 'assistant']);

// Origins allowed to call the proxy (Capacitor WebView + local dev).
const ALLOWED_ORIGINS = new Set([
  'https://localhost',
  'http://localhost',
  'capacitor://localhost',
  'http://localhost:3000',
  'https://localhost:3000',
]);

function corsHeaders(origin: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-App-Client',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

interface ChatMessage {
  role: string;
  content: unknown;
}

function sanitizeMessages(raw: unknown): ChatMessage[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: ChatMessage[] = [];
  for (const item of raw.slice(0, MAX_MESSAGES)) {
    if (!item || typeof item !== 'object') continue;
    const m = item as { role?: unknown; content?: unknown };
    const role = typeof m.role === 'string' && ALLOWED_ROLES.has(m.role) ? m.role : 'user';
    let content: unknown;
    if (typeof m.content === 'string') {
      content = m.content.slice(0, MAX_CONTENT_CHARS);
    } else if (Array.isArray(m.content)) {
      const parts: unknown[] = [];
      for (const part of m.content) {
        if (!part || typeof part !== 'object') continue;
        const p = part as { type?: unknown; text?: unknown; image_url?: { url?: unknown } };
        if (p.type === 'text') {
          parts.push({ type: 'text', text: String(p.text ?? '').slice(0, MAX_CONTENT_CHARS) });
        } else if (p.type === 'image_url') {
          const url = String(p.image_url?.url ?? '');
          if (url) parts.push({ type: 'image_url', image_url: { url: url.slice(0, MAX_IMAGE_CHARS) } });
        }
      }
      if (parts.length === 0) continue;
      content = parts;
    } else {
      continue;
    }
    out.push({ role, content });
  }
  return out.length > 0 ? out : null;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin');
    const cors = corsHeaders(origin);

    const json = (body: unknown, status: number): Response =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json', ...cors },
      });

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    if (origin && !ALLOWED_ORIGINS.has(origin)) {
      return json({ error: 'Forbidden' }, 403);
    }

    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405);
    }

    const client = request.headers.get('X-App-Client');
    if (!env.APP_CLIENT_SECRET || !client || client !== env.APP_CLIENT_SECRET) {
      return json({ error: 'Forbidden' }, 403);
    }

    if (!env.GEMINI_API_KEY && !env.GROQ_API_KEY) {
      return json({ error: 'Server misconfigured' }, 500);
    }

    // Groq is the primary provider now; Gemini stays as a fallback so an
    // existing deployment keeps working until GROQ_API_KEY is set.
    const provider: 'groq' | 'gemini' =
      env.AI_PROVIDER === 'gemini' || env.AI_PROVIDER === 'groq'
        ? env.AI_PROVIDER
        : env.GROQ_API_KEY
          ? 'groq'
          : 'gemini';
    const apiKey = provider === 'groq' ? env.GROQ_API_KEY : env.GEMINI_API_KEY;
    if (!apiKey) {
      return json({ error: 'Server misconfigured' }, 500);
    }
    const model =
      provider === 'groq' ? env.GROQ_MODEL || DEFAULT_GROQ_MODEL : DEFAULT_GEMINI_MODEL;

    const now = Date.now();
    if (now - windowStart >= 60_000) {
      windowStart = now;
      windowCount = 0;
    }
    windowCount += 1;
    if (windowCount > RPM_LIMIT) {
      return json({ error: 'V is resting right now. Try again in a minute.' }, 429);
    }

    const contentLength = Number(request.headers.get('content-length') || 0);
    if (contentLength > MAX_BODY_BYTES) {
      return json({ error: 'Request too large' }, 413);
    }

    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) {
      return json({ error: 'Request too large' }, 413);
    }

    let body: {
      messages?: unknown;
      max_tokens?: unknown;
      temperature?: unknown;
      reasoning_effort?: unknown;
    } | null = null;
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }

    const messages = body ? sanitizeMessages(body.messages) : null;
    if (!messages) {
      return json({ error: 'Invalid request: messages required' }, 400);
    }

    const maxTokens =
      typeof body!.max_tokens === 'number'
        ? Math.min(Math.max(Math.floor(body!.max_tokens), 1), 8192)
        : 2048;
    const temperature =
      typeof body!.temperature === 'number'
        ? Math.min(Math.max(body!.temperature, 0), 2)
        : 0.7;
    // Gemini 3 spends "thinking" tokens before it writes, and those count
    // against max_tokens. At the old 2048 cap a long plan could burn the whole
    // budget reasoning and the bubble stopped mid-sentence ("…kcal/day (+").
    // Low effort leaves room for the answer; still adjustable per request.
    const effort =
      typeof body!.reasoning_effort === 'string' &&
      ['minimal', 'low', 'medium', 'high'].includes(body!.reasoning_effort)
        ? body!.reasoning_effort
        : 'low';

    let upstream: Response;
    try {
      const payload: Record<string, unknown> = {
        model,
        messages,
        max_tokens: maxTokens,
        temperature,
      };
      // Gemini always reasons; Groq only accepts the knob on gpt-oss models.
      if (provider === 'gemini' || model.startsWith('openai/gpt-oss')) {
        payload.reasoning_effort = effort;
      }
      upstream = await fetch(provider === 'groq' ? GROQ_URL : GEMINI_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
      });
    } catch {
      return json({ error: 'AI service unreachable. Try again shortly.' }, 502);
    }

    // Never relay upstream error bodies (they can leak key/config details).
    if (!upstream.ok) {
      if (upstream.status === 429) {
        return json({ error: 'V is resting right now. Try again in a minute.' }, 429);
      }
      if (upstream.status === 400) {
        return json({ error: 'AI rejected the request.' }, 400);
      }
      return json({ error: 'AI service unavailable. Try again shortly.' }, 502);
    }

    const data = await upstream.text();
    return new Response(data, {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  },
} satisfies {
  fetch(request: Request, env: Env, ctx: unknown): Promise<Response>;
};
