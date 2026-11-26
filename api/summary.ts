/**
 * Vercel serverless function: streams an AI summary of the computed results.
 * Provider: Google Gemini free tier (@google/genai). The key lives only here, in GEMINI_API_KEY.
 * On any failure (no key, quota 429, network) the client falls back to the deterministic template.
 */
import { GoogleGenAI } from '@google/genai';
import { SYSTEM_PROMPT, type SummaryPayload } from '../src/lib/summaryPrompt';

interface Req { method?: string; body?: unknown; headers: Record<string, string | string[] | undefined>; socket?: { remoteAddress?: string } }
interface Res { status: (c: number) => Res; setHeader: (k: string, v: string) => void; write: (s: string) => void; end: (s?: string) => void; json: (o: unknown) => void }

const MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
const MAX_BODY = 30_000; // bytes
const hits = new Map<string, number[]>(); // best-effort per-instance rate limit

function limited(ip: string): boolean {
  const now = Date.now(), win = 60_000, max = 8;
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < win);
  arr.push(now); hits.set(ip, arr);
  return arr.length > max;
}

function valid(p: unknown): p is SummaryPayload {
  const o = p as SummaryPayload;
  return !!o && typeof o === 'object' && !!o.project && Array.isArray(o.checks) && Array.isArray(o.footings) && Array.isArray(o.assumptions);
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }
  const key = process.env.GEMINI_API_KEY;
  if (!key) { res.status(503).json({ error: 'GEMINI_API_KEY not set' }); return; }
  const ip = String(req.headers['x-forwarded-for'] ?? req.socket?.remoteAddress ?? 'x').split(',')[0].trim();
  if (limited(ip)) { res.status(429).json({ error: 'Too many requests' }); return; }
  const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? null);
  if (raw.length > MAX_BODY) { res.status(413).json({ error: 'Payload too large' }); return; }
  let payload: unknown;
  try { payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; } catch { res.status(400).json({ error: 'Bad JSON' }); return; }
  if (!valid(payload)) { res.status(400).json({ error: 'Unexpected payload shape' }); return; }

  try {
    const ai = new GoogleGenAI({ apiKey: key });
    const stream = await ai.models.generateContentStream({
      model: MODEL,
      contents: 'RESULTS:\n```json\n' + JSON.stringify(payload, null, 2) + '\n```',
      config: { systemInstruction: SYSTEM_PROMPT, temperature: 0.1, maxOutputTokens: 1200 },
    });
    res.status(200);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Model', MODEL);
    for await (const chunk of stream) { const t = chunk.text; if (t) res.write(t); }
    res.end();
  } catch (e) {
    const msg = (e as Error).message ?? 'error';
    const code = /429|quota|RESOURCE_EXHAUSTED/i.test(msg) ? 429 : 502;
    res.status(code).json({ error: msg.slice(0, 300) });
  }
}
