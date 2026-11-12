// Talks to the assistant's one server function (the Worker in worker/). Streams text and collects tool calls.

export class ChatError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

const STATUS_CODES = { 401: 'chat/unauthorized', 403: 'chat/unauthorized', 429: 'chat/rate-limited' };
const IDLE_TIMEOUT_MS = 30000;

// Reads complete SSE lines from the buffer and hands back the unfinished tail.
export function parseSSE(buffer, onRest) {
  const lines = buffer.split('\n');
  onRest(lines.pop());
  const events = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line.startsWith('data:')) continue;
    const data = line.slice(5).trim();
    if (data === '[DONE]') break;
    let event;
    try {
      event = JSON.parse(data);
    } catch {
      continue;
    }
    if (event.error) throw new ChatError('chat/upstream');
    const delta = event.choices?.[0]?.delta;
    if (delta) events.push(delta);
  }
  return events;
}

// Returns { content, toolCalls: [{ id, name, arguments }] }.
export async function streamChat({ endpoint, token, messages, signal, onText }) {
  const inner = new AbortController();
  let timedOut = false;
  let timer;
  const arm = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      timedOut = true;
      inner.abort();
    }, IDLE_TIMEOUT_MS);
  };
  const forward = () => inner.abort();
  signal.addEventListener('abort', forward);
  arm();

  let content = '';
  const calls = [];
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ messages }),
      signal: inner.signal,
    });
    if (!response.ok || !response.body) throw new ChatError(STATUS_CODES[response.status] || 'chat/unavailable');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      arm();
      buffer += decoder.decode(value, { stream: true });
      for (const delta of parseSSE(buffer, (rest) => { buffer = rest; })) {
        if (delta.content) {
          content += delta.content;
          onText(content);
        }
        for (const part of delta.tool_calls || []) {
          const i = part.index ?? calls.length;
          calls[i] ||= { id: '', name: '', arguments: '' };
          if (part.id) calls[i].id = part.id;
          if (part.function?.name) calls[i].name += part.function.name;
          if (part.function?.arguments) calls[i].arguments += part.function.arguments;
        }
      }
    }
  } catch (error) {
    if (timedOut) throw new ChatError('chat/timeout');
    if (signal.aborted) throw new ChatError('chat/stopped');
    if (error instanceof ChatError) throw error;
    throw new ChatError(navigator.onLine === false ? 'app/offline' : 'chat/unavailable');
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', forward);
  }
  const toolCalls = calls.filter(Boolean).map((c, i) => ({ ...c, id: c.id || `call_${Date.now()}_${i}` }));
  return { content, toolCalls };
}
