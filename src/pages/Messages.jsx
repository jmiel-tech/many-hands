import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { useData } from '../lib/data.jsx';
import { subscribeToConversations } from '../lib/chat.js';
import { friendlyError } from '../lib/errors.js';
import { Avatar, ErrorNote, formatWhen } from '../components/ui.jsx';
import { TopBar } from '../components/Layout.jsx';

const latestFirst = (a, b) => (b.updatedAt?.toMillis?.() ?? 0) - (a.updatedAt?.toMillis?.() ?? 0);

export default function Messages() {
  const { user } = useAuth();
  const { nameOf } = useData();
  const [conversations, setConversations] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setConversations(null);
    setError('');
    return subscribeToConversations(
      user.uid,
      setConversations,
      (reason) => {
        console.error(reason);
        setError(friendlyError(reason));
      },
    );
  }, [user.uid]);

  return (
    <>
      <TopBar>Messages</TopBar>
      <section className="hero enter">
        <h1 className="display">Messages.</h1>
        <p className="lede">Private conversations with community members.</p>
      </section>
      <section className="band band-alt band-fill" aria-label="Your conversations">
        <div className="band-inner messages-list">
          <ErrorNote>{error}</ErrorNote>
          {conversations === null ? (
            !error && <p className="empty">Loading conversations…</p>
          ) : conversations.length ? (
            [...conversations].sort(latestFirst).map((conversation) => {
              const otherId = Array.isArray(conversation.participantIds)
                ? conversation.participantIds.find((id) => id !== user.uid)
                : null;
              return (
                <Link key={conversation.id} to={`/messages/${conversation.id}`} className="conversation-link">
                  <Avatar id={otherId} name={nameOf(otherId)} size={48} />
                  <span className="conversation-copy">
                    <strong>{nameOf(otherId)}</strong>
                    <span className="conversation-preview">{conversation.lastMessage || 'Start a conversation'}</span>
                  </span>
                  <span className="conversation-time">{formatWhen(conversation.updatedAt)}</span>
                </Link>
              );
            })
          ) : (
            <p className="empty">No conversations yet. Open a member profile and choose Message to start one.</p>
          )}
        </div>
      </section>
    </>
  );
}
