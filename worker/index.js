import { MAX_TEXT_LENGTH, synthesize } from './edge-tts.js';

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'openrouter/auto';
const MAX_PROMPT_LENGTH = 2000;
const MAX_KEY_LENGTH = 512;

const SYSTEM_PROMPT = [
  'You are the voice of ToonLab, an experimental animated character.',
  'For this P0 experiment, always reply in natural spoken English because the current lip-sync processor supports English only.',
  'If the user asks for another spoken language, briefly explain that the current demo voice is English-only and continue in English.',
  'Keep the response concise: normally one to three sentences and under 100 words.',
  'Return plain conversational text only. Do not use markdown headings, lists, code blocks, or URLs unless the user explicitly needs them.',
].join(' ');

function json(data, init = {}) {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Cache-Control', 'no-store');
  return new Response(JSON.stringify(data), { ...init, headers });
}

function getBearerToken(request) {
  const header = request.headers.get('Authorization') ?? '';
  if (!header.startsWith('Bearer ')) return '';
  return header.slice(7).trim();
}

function isAllowedOrigin(request) {
  const origin = request.headers.get('Origin');
  if (!origin) return true;
  if (origin === new URL(request.url).origin) return true;
  if (origin === 'https://toonlab.verinasci.com') return true;
  try {
    const url = new URL(origin);
    return (url.hostname === 'localhost' || url.hostname === '127.0.0.1') && ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}

async function handleTts(request) {
  if (!isAllowedOrigin(request)) return json({ error: 'Origin not allowed.' }, { status: 403 });
  let body;
  try {
    // Bound the actual body, including chunked requests without Content-Length.
    const reader = request.body?.getReader();
    if (!reader) return json({ error: 'Text is required.' }, { status: 400 });
    const chunks = [];
    let length = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        length += value.length;
        if (length > 8192) {
          await reader.cancel();
          return json({ error: 'Request body is too large.' }, { status: 413 });
        }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    body = JSON.parse(await new Blob(chunks).text());
  } catch { return json({ error: 'Invalid JSON request.' }, { status: 400 }); }
  const text = typeof body?.text === 'string' ? body.text.trim() : '';
  if (!text || text.length > MAX_TEXT_LENGTH) {
    return json({ error: `Text must contain 1–${MAX_TEXT_LENGTH} characters.` }, { status: 400 });
  }
  try {
    return json(await synthesize(text, request.signal));
  } catch {
    return json({ error: 'Microsoft TTS is unavailable or timed out. Please try again.' }, { status: 502 });
  }
}

function extractText(content) {
  if (typeof content === 'string') return content.trim();
  if (!Array.isArray(content)) return '';
  return content
    .filter((part) => part?.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text)
    .join('')
    .trim();
}

async function readOpenRouterError(response) {
  try {
    const payload = await response.json();
    if (typeof payload?.error?.message === 'string') return payload.error.message;
    if (typeof payload?.message === 'string') return payload.message;
  } catch {
    // Use the generic status below.
  }
  return `OpenRouter request failed with status ${response.status}.`;
}

async function handleChat(request) {
  if (!isAllowedOrigin(request)) {
    return json({ error: 'Origin not allowed.' }, { status: 403 });
  }

  const apiKey = getBearerToken(request);
  if (!apiKey || apiKey.length > MAX_KEY_LENGTH) {
    return json({ error: 'A valid OpenRouter API key is required.' }, { status: 401 });
  }

  const contentLength = Number(request.headers.get('Content-Length') ?? 0);
  if (contentLength > 16_384) {
    return json({ error: 'Request body is too large.' }, { status: 413 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON request.' }, { status: 400 });
  }

  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
  const model = typeof body?.model === 'string' && body.model.trim() ? body.model.trim() : DEFAULT_MODEL;

  if (!prompt) return json({ error: 'Prompt is required.' }, { status: 400 });
  if (prompt.length > MAX_PROMPT_LENGTH) {
    return json({ error: `Prompt must be ${MAX_PROMPT_LENGTH} characters or fewer.` }, { status: 400 });
  }
  if (model.length > 160 || !/^[a-zA-Z0-9._:/~+-]+$/.test(model)) {
    return json({ error: 'Invalid model identifier.' }, { status: 400 });
  }

  let upstream;
  try {
    upstream = await fetch(OPENROUTER_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://toonlab.verinasci.com',
        'X-Title': 'ToonLab',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        max_tokens: 220,
        temperature: 0.7,
      }),
      signal: AbortSignal.timeout(45_000),
    });
  } catch (error) {
    const message = error?.name === 'TimeoutError' ? 'OpenRouter timed out.' : 'Could not reach OpenRouter.';
    return json({ error: message }, { status: 502 });
  }

  if (!upstream.ok) {
    return json({ error: await readOpenRouterError(upstream) }, { status: upstream.status });
  }

  let payload;
  try {
    payload = await upstream.json();
  } catch {
    return json({ error: 'OpenRouter returned an unreadable response.' }, { status: 502 });
  }

  const text = extractText(payload?.choices?.[0]?.message?.content);
  if (!text) {
    return json({ error: 'OpenRouter returned an empty response.' }, { status: 502 });
  }

  return json({
    text: text.slice(0, 1400),
    model: payload?.model ?? model,
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/health' && request.method === 'GET') {
      return json({ ok: true, service: 'toonlab', version: '0.1.0' });
    }

    if (url.pathname === '/api/chat') {
      if (request.method !== 'POST') {
        return json({ error: 'Method not allowed.' }, { status: 405, headers: { Allow: 'POST' } });
      }
      return handleChat(request);
    }

    if (url.pathname === '/api/tts') {
      if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, { status: 405, headers: { Allow: 'POST' } });
      return handleTts(request);
    }

    if (url.pathname.startsWith('/api/')) {
      return json({ error: 'Not found.' }, { status: 404 });
    }

    return env.ASSETS.fetch(request);
  },
};
