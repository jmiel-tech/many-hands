import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { useData } from '../lib/data.jsx';
import { friendlyError, useAction } from '../lib/errors.js';
import {
  GENERAL_ROOM,
  MAX_ROOM_DESCRIPTION_LENGTH,
  MAX_ROOM_NAME_LENGTH,
  createRoom,
  subscribeToRooms,
} from '../lib/public-chat.js';
import { Avatar, ErrorNote, Icons } from '../components/ui.jsx';
import { TopBar } from '../components/Layout.jsx';

function RoomLink({ room, subtitle }) {
  return (
    <Link to={`/chat/${room.id}`} className="conversation-link">
      <Avatar id={room.id} name={room.name} size={48} />
      <span className="conversation-copy">
        <strong># {room.name}</strong>
        <span className="conversation-preview">{room.description || subtitle}</span>
      </span>
      <Icons.chevron />
    </Link>
  );
}

function NewRoomForm() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const { busy, error, run } = useAction();

  if (!open) {
    return (
      <button type="button" className="pill pill-sm room-new-button" onClick={() => setOpen(true)}>Start a new room</button>
    );
  }

  const submit = (event) => {
    event.preventDefault();
    run(async () => {
      const id = await createRoom(user.uid, { name, description });
      navigate(`/chat/${id}`);
    });
  };

  return (
    <form className="room-form" aria-label="Start a new room" onSubmit={submit}>
      <label className="field-label" htmlFor="room-name">Room name</label>
      <input id="room-name" className="field" type="text" required maxLength={MAX_ROOM_NAME_LENGTH} placeholder="e.g. Park cleanup crew" value={name} onChange={(e) => setName(e.target.value)} />
      <label className="field-label" htmlFor="room-description">What's it for? (optional)</label>
      <input id="room-description" className="field" type="text" maxLength={MAX_ROOM_DESCRIPTION_LENGTH} value={description} onChange={(e) => setDescription(e.target.value)} />
      <div className="row-gap">
        <button type="submit" className="pill pill-sm" disabled={busy || !name.trim()}>Create room</button>
        <button type="button" className="textlink" onClick={() => setOpen(false)}>Cancel</button>
      </div>
      <ErrorNote>{error}</ErrorNote>
    </form>
  );
}

export default function Chat() {
  const { nameOf } = useData();
  const [rooms, setRooms] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setRooms(null);
    setError('');
    return subscribeToRooms(setRooms, (reason) => {
      console.error(reason);
      setError(friendlyError(reason));
    });
  }, []);

  return (
    <>
      <TopBar>Chat</TopBar>
      <section className="hero enter">
        <h1 className="display">Community chat.</h1>
        <p className="lede">Public rooms everyone in the community can read and join. For private talks, use Messages.</p>
      </section>
      <section className="band band-alt band-fill" aria-label="Chat rooms">
        <div className="band-inner messages-list">
          <RoomLink room={GENERAL_ROOM} />
          <ErrorNote>{error}</ErrorNote>
          {rooms === null ? (
            !error && <p className="empty">Loading rooms…</p>
          ) : (
            rooms.map((room) => (
              <RoomLink key={room.id} room={room} subtitle={`Started by ${nameOf(room.createdBy)}`} />
            ))
          )}
          <NewRoomForm />
        </div>
      </section>
    </>
  );
}
