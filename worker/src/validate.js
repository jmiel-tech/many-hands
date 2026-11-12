// Pure helpers, kept apart from the Worker entry so they can be unit tested in Node.
import { TOOL_NAMES } from './tools.js';

export const MODEL = 'deepseek/deepseek-v4.1-flash-1017'; // OpenRouter slug. Check openrouter.ai/models before changing it.
export const MAX_TOKENS = 800;
export const MAX_MESSAGES = 30;
export const MAX_TOTAL_CHARS = 24000;
export const MAX_MESSAGE_CHARS = 16000;
export const RATE_LIMIT_PER_HOUR = 30;

export const MAX_TOOL_CALLS = 4;
const MAX_ID_CHARS = 100;
const MAX_ARGS_CHARS = 2400;

const ROLES = new Set(['system', 'user', 'assistant', 'tool']);
const isId = (v) => typeof v === 'string' && v.length > 0 && v.length <= MAX_ID_CHARS;

// Only the listed tools, with a string of JSON arguments. Anything else is rejected, not passed on.
function cleanToolCalls(calls) {
  if (!Array.isArray(calls) || calls.length === 0 || calls.length > MAX_TOOL_CALLS) return null;
  const clean = [];
  for (const c of calls) {
    const name = c?.function?.name;
    const args = c?.function?.arguments;
    if (!isId(c.id) || !TOOL_NAMES.has(name) || typeof args !== 'string' || args.length > MAX_ARGS_CHARS) return null;
    clean.push({ id: c.id, type: 'function', function: { name, arguments: args } });
  }
  return clean;
}

// Returns { messages } when the body is acceptable, or { error } with a short reason.
export function validateBody(body) {
  const messages = body?.messages;
  if (!Array.isArray(messages) || messages.length === 0) return { error: 'messages must be a non-empty array' };
  if (messages.length > MAX_MESSAGES) return { error: `at most ${MAX_MESSAGES} messages` };
  let total = 0;
  const clean = [];
  const openCalls = new Set();
  for (const [i, m] of messages.entries()) {
    if (!m || typeof m.content !== 'string' || !ROLES.has(m.role)) return { error: 'each message needs a role and text content' };
    if (m.role === 'system' && i !== 0) return { error: 'only the first message may be a system message' };
    if (m.content.length > MAX_MESSAGE_CHARS) return { error: 'a message is too long' };
    total += m.content.length;
    if (m.role === 'tool') {
      if (!isId(m.tool_call_id) || !openCalls.has(m.tool_call_id)) return { error: 'a tool result must answer an earlier tool call' };
      openCalls.delete(m.tool_call_id);
      clean.push({ role: 'tool', tool_call_id: m.tool_call_id, content: m.content });
      continue;
    }
    if (openCalls.size) return { error: 'every tool call needs a result before the conversation continues' };
    if (m.role === 'assistant' && m.tool_calls !== undefined) {
      const calls = cleanToolCalls(m.tool_calls);
      if (!calls) return { error: 'tool calls must use the listed tools' };
      for (const c of calls) {
        openCalls.add(c.id);
        total += c.function.arguments.length;
      }
      clean.push({ role: 'assistant', content: m.content, tool_calls: calls });
      continue;
    }
    clean.push({ role: m.role, content: m.content });
  }
  if (total > MAX_TOTAL_CHARS) return { error: 'the conversation is too long' };
  if (openCalls.size) return { error: 'every tool call needs a result' };
  const lastRole = clean[clean.length - 1].role;
  if (lastRole !== 'user' && lastRole !== 'tool') return { error: 'the last message must be from the user or a tool result' };
  return { messages: clean };
}

export function allowedOrigin(origin, allowList) {
  if (!origin) return null;
  const allowed = String(allowList || '').split(',').map((s) => s.trim()).filter(Boolean);
  return allowed.includes(origin) ? origin : null;
}

export function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

export const hourBucket = (now = Date.now()) => Math.floor(now / 3600000);
export const secondsToNextHour = (now = Date.now()) => Math.ceil((3600000 - (now % 3600000)) / 1000);
