import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { useData } from '../lib/data.jsx';
import { sendChatMessage, subscribeToConversation, subscribeToMessages } from '../lib/chat.js';
import { friendlyError, useAction } from '../lib/errors.js';
import { Avatar, ErrorNote, formatWhen } from '../components/ui.jsx';
import { TopBar } from '../components/Layout.jsx';
import { MAX_CHAT_MESSAGE_LENGTH } from '../lib/chat-contract.js';

export default function Conversation() {
  const { conversationId } = useParams();
  const { user } = useAuth();
  const { nameOf } = useData();
  const [conversation, setConversation] = useState(undefined);
  const [messages, setMessages] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [draft, setDraft] = useState('');
  const endRef = useRef(null);
  const { busy, error, run } = useAction();

  useEffect(() => {
    setConversation(undefined);
    setMessages(null);
    setLoadError('');
    const onError = (reason) => {
      console.error(reason);
      setLoadError(friendlyError(reason));
    };
    const stopConversation = subscribeToConversation(conversationId, setConversation, onError);
    const stopMessages = subscribeToMessages(conversationId, setMessages, onError);
    return () => {
      stopConversation();
      stopMessages();
    };
  }, [conversationId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  const otherId = conversation?.participantIds?.find((id) => id !== user.uid);
  const otherName = otherId ? nameOf(otherId) : 'Community member';
  const post = (event) => {
    event.preventDefault();
    run(async () => {
      await sendChatMessage(conversationId, user.uid, draft);
      setDraft('');
    });
  };

  if (loadError || conversation === null) {
    return (
      <>
        <TopBar><Link to="/messages" className="topbar-back">‹ Messages</Link>Conversation</TopBar>
        <section className="hero">
          <h1 className="display-sm">This conversation isn’t available.</h1>
          <p className="muted">{loadError || 'It may have been removed or you may not be a participant.'}</p>
          <Link to="/messages" className="textlink">Back to messages</Link>
        </section>
      </>
    );
  }

  return (
    <>
      <TopBar>
        <Link to="/messages" className="topbar-back">‹ Messages</Link>
        <span className="topbar-title">{conversation ? otherName : 'Conversation'}</span>
      </TopBar>
      <section className="band band-alt chat-band" aria-label={`Conversation with ${otherName}`}>
        <div className="band-inner chat-inner">
          {otherId && (
            <div className="chat-member">
              <Avatar id={otherId} name={otherName} size={40} />
              <strong>{otherName}</strong>
            </div>
          )}
          <div className="chat-log" role="log" aria-label="Chat history" aria-live="polite">
            {messages === null ? (
              <p className="empty">Loading messages…</p>
            ) : messages.length ? (
              <ol className="chat-message-list">
                {messages.map((message) => {
                  const mine = message.senderId === user.uid;
                  return (
                    <li key={message.id} className={`chat-message${mine ? ' mine' : ''}`}>
                      <div className="chat-bubble">
                        <p>{message.text}</p>
                        <span>{mine ? 'You' : otherName} · {formatWhen(message.createdAt)}</span>
                      </div>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="empty">No messages yet. Send the first one.</p>
            )}
            <div ref={endRef} />
          </div>
          <form className="chat-compose" aria-label="Send a message" onSubmit={post}>
            <label className="sr-only" htmlFor="chat-draft">Message</label>
            <textarea
              id="chat-draft"
              className="field"
              rows={2}
              required
              maxLength={MAX_CHAT_MESSAGE_LENGTH}
              placeholder={`Message ${otherName}`}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
            <button type="submit" className="pill" disabled={busy || !conversation || !draft.trim()}>Send</button>
          </form>
          <ErrorNote>{error}</ErrorNote>
        </div>
      </section>
    </>
  );
}
