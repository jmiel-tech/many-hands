// Many Hands chat proxy (Cloudflare Worker).
// Browser -> this Worker (Firebase ID token) -> OpenRouter (secret key) -> SSE stream back to the browser.
import { createRemoteJWKSet, jwtVerify } from 'jose';
import {
  MAX_TOKENS,
  MODEL,
  RATE_LIMIT_PER_HOUR,
  allowedOrigin,
  corsHeaders,
  hourBucket,
  secondsToNextHour,
  validateBody,
} from './validate.js';
import { TOOLS } from './tools.js';

const JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'),
);
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

function json(status, body, cors, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors, ...extra },
  });
}

async function verifyUser(request, projectId) {
  const header = request.headers.get('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return null;
  try {
    // jose checks the signature, exp, nbf and iat; we pin issuer, audience and algorithm.
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
      algorithms: ['RS256'],
    });
    return typeof payload.sub === 'string' && payload.sub ? payload.sub : null;
  } catch {
    return null;
  }
}

// Fixed one-hour window per user. KV is eventually consistent, so this is a soft cap, which is fine for abuse control.
async function overLimit(kv, uid) {
  const key = `rl:${uid}:${hourBucket()}`;
  const count = Number((await kv.get(key)) || 0);
  if (count >= RATE_LIMIT_PER_HOUR) return true;
  await kv.put(key, String(count + 1), { expirationTtl: 3900 });
  return false;
}

export default {
  async fetch(request, env) {
    const origin = allowedOrigin(request.headers.get('Origin'), env.ALLOWED_ORIGINS);
    if (!origin) return new Response('Forbidden', { status: 403 });
    const cors = corsHeaders(origin);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return json(405, { error: 'Method not allowed' }, cors);
    if (!env.OPENROUTER_API_KEY || !env.RATE_LIMIT || !env.FIREBASE_PROJECT_ID) {
      return json(500, { error: 'The assistant is not set up yet.' }, cors);
    }

    const uid = await verifyUser(request, env.FIREBASE_PROJECT_ID);
    if (!uid) return json(401, { error: 'Not signed in' }, cors);

    let body;
    try {
      body = await request.json();
    } catch {
      return json(400, { error: 'Body must be JSON' }, cors);
    }
    const { messages, error } = validateBody(body);
    if (error) return json(400, { error }, cors);

    if (await overLimit(env.RATE_LIMIT, uid)) {
      return json(429, { error: 'Too many requests' }, cors, { 'Retry-After': String(secondsToNextHour()) });
    }

    const upstream = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': env.SITE_URL || 'https://github.com',
        'X-Title': 'Many Hands',
      },
      // The tool list is fixed here. The browser runs a tool only after the member confirms it.
      body: JSON.stringify({ model: MODEL, messages, tools: TOOLS, tool_choice: 'auto', stream: true, max_tokens: MAX_TOKENS }),
    });

    if (!upstream.ok || !upstream.body) {
      // Never pass OpenRouter's error body through: it can echo request details.
      const status = upstream.status === 429 ? 429 : 502;
      return json(status, { error: status === 429 ? 'The model is busy' : 'Upstream error' }, cors);
    }

    return new Response(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        ...cors,
      },
    });
  },
};
