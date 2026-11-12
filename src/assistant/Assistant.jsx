import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { auth } from '../firebase.js';
import { COMMUNITY_NAME } from '../firebase.config.js';
import { useAuth } from '../lib/auth.jsx';
import { useData, useOnline } from '../lib/data.jsx';
import { Modal, firstName } from '../components/ui.jsx';
import { CHAT_ENDPOINT } from './config.js';
import { ChatError, streamChat } from './client.js';
import { buildSystemPrompt, requestMessages } from './prompt.js';
import { READ_TOOLS, WRITE_TOOLS, findTasks, parseArgs, planAction, runAction, undoAction } from './tools.js';
import { chatError } from './messages.js';
import ActionCard from './ActionCard.jsx';
import Markdown from './Markdown.jsx';
import { ArrowUp, Sparkle, Stop } from './icons.jsx';
import './assistant.css';

const STORE = 'mh-assistant';
const MAX_ROUNDS = 3; // model calls per message, so a lookup can be followed by an answer
const SUGGESTIONS = ['What needs a volunteer?', 'Show my tasks', 'Which issues are at risk?'];

function loadChat() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORE) || 'null');
    if (saved && Array.isArray(saved.messages) && saved.actions && typeof saved.actions === 'object') {
      for (const action of Object.values(saved.actions)) {
        if (action.status === 'working') {
          action.status = 'failed';
          action.error = 'This was interrupted. Open the task to check whether it went through.';
        }
        if (action.status === 'undoing') action.status = 'done';
      }
      return saved;
    }
  } catch {
    // Storage can be blocked or hold something old; start fresh.
  }
  return { messages: [], actions: {} };
}

function saveChat(state) {
  try {
    if (state.messages.length) sessionStorage.setItem(STORE, JSON.stringify(state));
    else sessionStorage.removeItem(STORE);
  } catch {
    // The chat still works in memory.
  }
}

// Puts a tool result straight after its call (and any results already there), so calls and results stay paired.
function withToolResult(messages, callId, result) {
  if (messages.some((m) => m.role === 'tool' && m.tool_call_id === callId)) return messages;
  const at = messages.findIndex((m) => m.role === 'assistant' && m.tool_calls?.some((c) => c.id === callId));
  if (at < 0) return messages;
  let end = at + 1;
  while (end < messages.length && messages[end].role === 'tool') end++;
  const reply = { role: 'tool', tool_call_id: callId, content: JSON.stringify(result) };
  return [...messages.slice(0, end), reply, ...messages.slice(end)];
}

export default function Assistant() {
  const { user, member } = useAuth();
  const { members, issues, tasks, nameOf } = useData();
  const online = useOnline();
  const { pathname } = useLocation();
  const page = pathname.replace(/\/(tasks\/.*|edit|new)$/, '');

  const initial = useMemo(loadChat, []);
  const [open, setOpen] = useState(false);
  const [messages, setMessagesState] = useState(initial.messages);
  const [actions, setActionsState] = useState(initial.actions);
  const [live, setLive] = useState('');
  const [draft, setDraft] = useState('');
  const [phase, setPhase] = useState('idle'); // idle | waiting | streaming
  const [error, setError] = useState('');

  // Refs hold the latest values for async work, so a slow reply never writes over newer state.
  const messagesRef = useRef(messages);
  const actionsRef = useRef(actions);
  const liveRef = useRef('');
  const dataRef = useRef(null);
  dataRef.current = { uid: user.uid, meName: member.name, members, issues, tasks, nameOf };
  const abortRef = useRef(null);
  const inputRef = useRef(null);
  const logRef = useRef(null);
  const fabRef = useRef(null);

  const setMessages = useCallback((next) => {
    messagesRef.current = typeof next === 'function' ? next(messagesRef.current) : next;
    setMessagesState(messagesRef.current);
  }, []);
  const setActions = useCallback((next) => {
    actionsRef.current = typeof next === 'function' ? next(actionsRef.current) : next;
    setActionsState(actionsRef.current);
  }, []);
  const patchAction = useCallback((id, patch) => {
    setActions((all) => ({ ...all, [id]: { ...all[id], ...patch } }));
  }, [setActions]);
  const showLive = (text) => {
    liveRef.current = text;
    setLive(text);
  };

  useEffect(() => {
    if (phase === 'idle') saveChat({ messages, actions });
  }, [messages, actions, phase]);

  useEffect(() => () => abortRef.current?.abort(), []);

  // Follow new text down, unless the reader has scrolled up to look at something.
  useLayoutEffect(() => {
    const scroller = logRef.current?.closest('dialog');
    if (!scroller) return;
    const gap = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
    if (gap < 200 || phase === 'waiting') scroller.scrollTop = scroller.scrollHeight;
  }, [messages, actions, live, phase, error, open]);

  const grow = () => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    // scrollHeight leaves out the 1px borders, so add them back; scroll only once it hits the cap.
    const full = el.scrollHeight + 2;
    el.style.height = `${Math.min(full, 160)}px`;
    el.style.overflowY = full > 160 ? 'auto' : 'hidden';
  };
  useLayoutEffect(grow, [draft, open]);

  // After an alternative fills in a draft, put focus back in the message box with the cursor at the end.
  // (On open, the dialog itself focuses the box because it carries a real autofocus attribute.)
  const focusInputRef = useRef(false);
  const attachInput = useCallback((el) => {
    inputRef.current = el;
    el?.setAttribute('autofocus', '');
  }, []);
  useEffect(() => {
    if (!focusInputRef.current) return;
    focusInputRef.current = false;
    const el = inputRef.current;
    el?.focus();
    el?.setSelectionRange(el.value.length, el.value.length);
  }, [open, draft]);

  const converse = useCallback(async (history) => {
    const controller = new AbortController();
    abortRef.current = controller;
    setError('');
    setPhase('waiting');
    let hist = history;
    try {
      if (!navigator.onLine) throw new ChatError('app/offline');
      for (let round = 0; round < MAX_ROUNDS; round++) {
        const d = dataRef.current;
        const system = buildSystemPrompt({ communityName: COMMUNITY_NAME, ...d });
        const token = await auth.currentUser.getIdToken();
        const { content, toolCalls } = await streamChat({
          endpoint: CHAT_ENDPOINT,
          token,
          messages: requestMessages(system, hist),
          signal: controller.signal,
          onText: (text) => {
            setPhase('streaming');
            showLive(text);
          },
        });
        showLive('');

        const reply = { role: 'assistant', content };
        if (toolCalls.length) {
          reply.tool_calls = toolCalls.map((c) => ({ id: c.id, type: 'function', function: { name: c.name, arguments: c.arguments || '{}' } }));
        } else if (!content.trim()) {
          reply.content = "I don't have an answer for that.";
        }
        hist = [...hist, reply];
        if (!toolCalls.length) break;

        const ctx = dataRef.current;
        const proposed = {};
        let lookedUp = false;
        let awaiting = false;
        for (const call of toolCalls) {
          if (READ_TOOLS.has(call.name)) {
            hist = withToolResult(hist, call.id, findTasks(parseArgs(call.arguments) || {}, ctx));
            lookedUp = true;
          } else if (WRITE_TOOLS.has(call.name)) {
            const plan = planAction(call.name, call.arguments, ctx);
            proposed[call.id] = { ...plan, name: call.name, args: call.arguments };
            if (plan.status === 'refused') hist = withToolResult(hist, call.id, { ok: false, refused: plan.reason });
            else awaiting = true;
          } else {
            hist = withToolResult(hist, call.id, { ok: false, error: 'Unknown tool.' });
          }
        }
        setActions((all) => ({ ...all, ...proposed }));
        setMessages(hist);
        // Stop at a Confirm card; carry on only when a lookup needs an answer written around it.
        if (awaiting || !lookedUp) break;
        setPhase('waiting');
      }
      setMessages(hist);
    } catch (e) {
      if (e.code === 'chat/stopped') {
        if (liveRef.current.trim()) hist = [...hist, { role: 'assistant', content: liveRef.current }];
      } else {
        console.error(e);
        setError(chatError(e));
      }
      showLive('');
      setMessages(hist);
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setPhase('idle');
    }
  }, [setActions, setMessages]);

  const busy = phase !== 'idle';
  const working = Object.values(actions).some((a) => a.status === 'working' || a.status === 'undoing');

  const send = (text) => {
    const content = text.trim();
    if (!content || busy || working || !online) return;
    // A new message moves on from any change still waiting for Confirm, so it counts as cancelled.
    let hist = messagesRef.current;
    const cancelled = {};
    for (const [id, a] of Object.entries(actionsRef.current)) {
      if (a.status !== 'pending') continue;
      cancelled[id] = { ...a, status: 'cancelled' };
      hist = withToolResult(hist, id, { ok: false, cancelled: true });
    }
    setActions((all) => ({ ...all, ...cancelled }));
    hist = [...hist, { role: 'user', content }];
    setDraft('');
    setMessages(hist);
    converse(hist);
    inputRef.current?.focus();
  };

  const confirm = async (id) => {
    const action = actionsRef.current[id];
    if (!action || action.status !== 'pending') return;
    patchAction(id, { status: 'working' });
    try {
      const outcome = await runAction(action, dataRef.current);
      patchAction(id, { status: 'done', undo: outcome.undo, done: outcome.done, error: '' });
      setMessages((m) => withToolResult(m, id, { ok: true, result: outcome.done }));
    } catch (e) {
      console.error(e);
      const message = chatError(e);
      patchAction(id, { status: 'failed', error: message });
      setMessages((m) => withToolResult(m, id, { ok: false, error: message }));
    }
  };

  const cancel = (id) => {
    patchAction(id, { status: 'cancelled' });
    setMessages((m) => withToolResult(m, id, { ok: false, cancelled: true }));
  };

  const undo = async (id) => {
    const action = actionsRef.current[id];
    if (!action || action.status !== 'done') return;
    patchAction(id, { status: 'undoing', error: '' });
    try {
      await undoAction(action);
      patchAction(id, { status: 'undone' });
      // A note only the model sees, so it knows the change was reversed.
      setMessages((m) => [...m, { role: 'user', hidden: true, content: `[Note: I pressed Undo on "${action.summary}". That change has been reversed.]` }]);
    } catch (e) {
      console.error(e);
      patchAction(id, { status: 'done', error: chatError(e) });
    }
  };

  const applyAlternative = (alternative) => {
    focusInputRef.current = true;
    setDraft(alternative.draft);
  };

  const stop = () => {
    abortRef.current?.abort();
    inputRef.current?.focus();
  };

  const newChat = () => {
    if (working) return;
    abortRef.current?.abort();
    setMessages([]);
    setActions({});
    setError('');
    showLive('');
    inputRef.current?.focus();
  };

  const close = () => {
    setOpen(false);
    requestAnimationFrame(() => fabRef.current?.focus());
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send(draft);
    }
  };

  const shown = messages.filter((m) => m.role !== 'tool' && !m.hidden);
  const empty = shown.length === 0 && !busy && !error;
  const last = messages[messages.length - 1];
  const canRetry = last && (last.role === 'user' || last.role === 'tool');

  return (
    <>
      <button
        key={page}
        ref={fabRef}
        type="button"
        className="chat-fab"
        aria-haspopup="dialog"
        aria-label="Open the assistant"
        onClick={() => setOpen(true)}
      >
        <Sparkle />
      </button>

      {open && (
        <Modal title="Assistant" variant="panel" closeLabel="Close" onClose={close}>
          <div className="assistant">
            <div className="assistant-tools">
              <button type="button" className="textlink small" onClick={newChat} disabled={empty || working}>New chat</button>
            </div>

            <div
              ref={logRef}
              className="assistant-log"
              role="log"
              aria-live="polite"
              aria-label="Conversation with the assistant"
              aria-busy={phase === 'streaming'}
            >
              {empty && (
                <div className="assistant-empty enter">
                  <span className="assistant-spark"><Sparkle width="34" height="34" /></span>
                  <h2 className="headline-sm">Hi, {firstName(member.name)}.</h2>
                  <p className="sub">Ask what needs a volunteer, take a task, update yours, or leave a comment. You'll confirm every change.</p>
                  <div className="chips">
                    {SUGGESTIONS.map((s) => (
                      <button key={s} type="button" className="chip" onClick={() => send(s)} disabled={!online}>{s}</button>
                    ))}
                  </div>
                </div>
              )}

              {shown.map((m, i) => (
                <div key={i} className="turn">
                  {m.role === 'user' ? (
                    <div className="bubble bubble-user">
                      <span className="sr-only">You said: </span>
                      <p className="preline">{m.content}</p>
                    </div>
                  ) : (
                    <>
                      {m.content?.trim() && (
                        <div className="bubble bubble-bot">
                          <span className="sr-only">Assistant said: </span>
                          <Markdown text={m.content} />
                        </div>
                      )}
                      {m.tool_calls?.map((c) => actions[c.id] && (
                        <ActionCard
                          key={c.id}
                          action={actions[c.id]}
                          online={online}
                          onConfirm={() => confirm(c.id)}
                          onCancel={() => cancel(c.id)}
                          onUndo={() => undo(c.id)}
                          onAlternative={applyAlternative}
                          onOpenTask={() => setOpen(false)}
                        />
                      ))}
                    </>
                  )}
                </div>
              ))}

              {live && (
                <div className="bubble bubble-bot">
                  <Markdown text={live} />
                </div>
              )}
              {phase === 'waiting' && (
                <div className="bubble bubble-bot typing" role="status" aria-label="The assistant is thinking">
                  <span /><span /><span />
                </div>
              )}
              {error && (
                <div className="error-note chat-error" role="alert">
                  <span>{error}</span>
                  {canRetry && (
                    <button type="button" className="textlink small" onClick={() => converse(messagesRef.current)} disabled={!online || busy}>Try again</button>
                  )}
                </div>
              )}
            </div>

            <form
              className="composer"
              onSubmit={(e) => {
                e.preventDefault();
                send(draft);
              }}
            >
              {!online && <p className="composer-note" role="status">You're offline. The assistant works again once you're back online.</p>}
              <div className="composer-row">
                <label htmlFor="assistant-input" className="sr-only">Message the assistant</label>
                <textarea
                  id="assistant-input"
                  ref={attachInput}
                  className="composer-input"
                  rows={1}
                  placeholder={online ? 'Ask about tasks, or ask me to do something' : 'Offline'}
                  value={draft}
                  maxLength={4000}
                  disabled={!online}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={onKeyDown}
                />
                {busy ? (
                  <button type="button" className="send" onClick={stop} aria-label="Stop answering">
                    <Stop />
                  </button>
                ) : (
                  <button type="submit" className="send" disabled={!draft.trim() || !online || working} aria-label="Send">
                    <ArrowUp />
                  </button>
                )}
              </div>
            </form>
          </div>
        </Modal>
      )}
    </>
  );
}
