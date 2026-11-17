import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { useData } from '../lib/data.jsx';
import { friendlyError, useAction } from '../lib/errors.js';
import {
  MAX_ROOM_MESSAGE_LENGTH,
  deleteRoom,
  deleteRoomMessage,
  sendRoomMessage,
  subscribeToRoom,
  subscribeToRoomMessages,
} from '../lib/public-chat.js';
import { Avatar, ConfirmRow, ErrorNote, formatWhen } from '../components/ui.jsx';
import { TopBar } from '../components/Layout.jsx';

function RoomMessage({ roomId, message }) {
  const { user, isAdmin } = useAuth();
  const { nameOf } = useData();
  const [confirming, setConfirming] = useState(false);
  const { busy, error, run } = useAction();
  const mine = message.senderId === user.uid;
  const name = nameOf(message.senderId);

  return (
    <li className={`chat-message room-message${mine ? ' mine' : ''}`}>
      {!mine && (
        <Link to={`/members/${message.senderId}`} className="room-message-avatar" aria-label={name}>
          <Avatar id={message.senderId} name={name} size={32} />
        </Link>
      )}
      <div className="room-message-body">
        <div className="chat-bubble">
          {!mine && <strong className="room-sender">{name}</strong>}
          <p>{message.text}</p>
          <span>{mine ? 'You' : name} · {formatWhen(message.createdAt)}</span>
        </div>
        {(mine || isAdmin) && !confirming && (
          <button type="button" className="textlink small danger room-message-delete" onClick={() => setConfirming(true)}>Delete</button>
        )}
        {confirming && (
          <ConfirmRow
            question={mine ? 'Delete this message for everyone?' : `Remove ${name}'s message as an admin?`}
            busy={busy}
            onConfirm={() => run(() => deleteRoomMessage(roomId, message.id))}
            onCancel={() => setConfirming(false)}
          />
        )}
        <ErrorNote>{error}</ErrorNote>
      </div>
    </li>
  );
}

export default function ChatRoom() {
  const { roomId } = useParams();
  const { user, isAdmin } = useAuth();
  const { nameOf } = useData();
  const navigate = useNavigate();
  const [room, setRoom] = useState(undefined);
  const [messages, setMessages] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [draft, setDraft] = useState('');
  const [confirmingClose, setConfirmingClose] = useState(false);
  const endRef = useRef(null);
  const { busy, error, run } = useAction();
  const closer = useAction();

  useEffect(() => {
    setRoom(undefined);
    setMessages(null);
    setLoadError('');
    const onError = (reason) => {
      console.error(reason);
      setLoadError(friendlyError(reason));
    };
    const stopRoom = subscribeToRoom(roomId, setRoom, onError);
    const stopMessages = subscribeToRoomMessages(roomId, setMessages, onError);
    return () => {
      stopRoom();
      stopMessages();
    };
  }, [roomId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  const post = (event) => {
    event.preventDefault();
    run(async () => {
      await sendRoomMessage(roomId, user.uid, draft);
      setDraft('');
    });
  };

  const closeRoom = () => closer.run(async () => {
    await deleteRoom(roomId);
    navigate('/chat');
  });

  if (loadError || room === null) {
    return (
      <>
        <TopBar><Link to="/chat" className="topbar-back">‹ Chat</Link>Room</TopBar>
        <section className="hero">
          <h1 className="display-sm">This room isn’t available.</h1>
          <p className="muted">{loadError || 'It may have been closed by the person who started it.'}</p>
          <Link to="/chat" className="textlink">Back to chat</Link>
        </section>
      </>
    );
  }

  const canClose = room && !room.builtIn && (room.createdBy === user.uid || isAdmin);
  const roomName = room ? `# ${room.name}` : 'Room';

  return (
    <>
      <TopBar>
        <Link to="/chat" className="topbar-back">‹ Chat</Link>
        <span className="topbar-title">{roomName}</span>
      </TopBar>
      <section className="band band-alt chat-band" aria-label={`Chat room ${room?.name || ''}`}>
        <div className="band-inner chat-inner">
          {room && (
            <div className="room-head">
              <div>
                <h1 className="room-title">{roomName}</h1>
                {room.description && <p className="muted-sm">{room.description}</p>}
                {!room.builtIn && <p className="muted-sm">Started by {room.createdBy === user.uid ? 'you' : nameOf(room.createdBy)}. Everyone in the community can read this room.</p>}
                {room.builtIn && <p className="muted-sm">Everyone in the community can read this room.</p>}
              </div>
              {canClose && !confirmingClose && (
                <button type="button" className="textlink small danger" onClick={() => setConfirmingClose(true)}>Close room</button>
              )}
            </div>
          )}
          {confirmingClose && (
            <ConfirmRow
              question="Close this room for everyone?"
              confirmLabel="Close room"
              busy={closer.busy}
              onConfirm={closeRoom}
              onCancel={() => setConfirmingClose(false)}
            />
          )}
          <ErrorNote>{closer.error}</ErrorNote>
          <div className="chat-log" role="log" aria-label="Room messages" aria-live="polite">
            {messages === null ? (
              <p className="empty">Loading messages…</p>
            ) : messages.length ? (
              <ol className="chat-message-list">
                {messages.map((message) => <RoomMessage key={message.id} roomId={roomId} message={message} />)}
              </ol>
            ) : (
              <p className="empty">No messages yet. Say hello.</p>
            )}
            <div ref={endRef} />
          </div>
          <form className="chat-compose" aria-label="Send a message to the room" onSubmit={post}>
            <label className="sr-only" htmlFor="room-draft">Message</label>
            <textarea
              id="room-draft"
              className="field"
              rows={2}
              required
              maxLength={MAX_ROOM_MESSAGE_LENGTH}
              placeholder={`Message ${roomName}`}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
            <button type="submit" className="pill" disabled={busy || !room || !draft.trim()}>Send</button>
          </form>
          <ErrorNote>{error}</ErrorNote>
        </div>
      </section>
    </>
  );
}
