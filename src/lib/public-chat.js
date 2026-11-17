import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase.js';

// Public chat rooms: every member can read and post. The General room is built in and has no document.
export const GENERAL_ROOM_ID = 'general';
export const GENERAL_ROOM = {
  id: GENERAL_ROOM_ID,
  name: 'General',
  description: 'Anything about the community.',
  createdBy: null,
  builtIn: true,
};
export const MAX_ROOM_NAME_LENGTH = 60;
export const MAX_ROOM_DESCRIPTION_LENGTH = 280;
export const MAX_ROOM_MESSAGE_LENGTH = 2000;

function requireOnline() {
  if (navigator.onLine === false) {
    throw Object.assign(new Error('offline'), { code: 'app/offline' });
  }
}

const createdMillis = (item) => item.createdAt?.toMillis?.() ?? Date.now();
const rowsFrom = (snapshot) => snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));

// Member-made rooms, oldest first. The General room is not included: callers show it first.
export function subscribeToRooms(onChange, onError) {
  return onSnapshot(
    collection(db, 'chatRooms'),
    (snapshot) => onChange(rowsFrom(snapshot).sort((a, b) => createdMillis(a) - createdMillis(b))),
    onError,
  );
}

// Calls onChange with the room, or null when it doesn't exist (anymore).
export function subscribeToRoom(roomId, onChange, onError) {
  if (roomId === GENERAL_ROOM_ID) {
    onChange(GENERAL_ROOM);
    return () => {};
  }
  return onSnapshot(
    doc(db, 'chatRooms', roomId),
    (snapshot) => onChange(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null),
    onError,
  );
}

export function subscribeToRoomMessages(roomId, onChange, onError) {
  return onSnapshot(
    query(collection(db, 'chatRooms', roomId, 'messages'), orderBy('createdAt', 'asc')),
    (snapshot) => onChange(rowsFrom(snapshot)),
    onError,
  );
}

export async function createRoom(uid, { name, description }) {
  requireOnline();
  const ref = await addDoc(collection(db, 'chatRooms'), {
    name: name.trim(),
    description: description.trim(),
    createdBy: uid,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function deleteRoom(roomId) {
  requireOnline();
  await deleteDoc(doc(db, 'chatRooms', roomId));
}

export async function sendRoomMessage(roomId, senderId, value) {
  requireOnline();
  const text = value.trim();
  if (!text || text.length > MAX_ROOM_MESSAGE_LENGTH) {
    throw Object.assign(new Error('Enter a message up to 2000 characters.'), { code: 'app/invalid-chat-message' });
  }
  await addDoc(collection(db, 'chatRooms', roomId, 'messages'), {
    senderId,
    text,
    createdAt: serverTimestamp(),
  });
}

export async function deleteRoomMessage(roomId, messageId) {
  requireOnline();
  await deleteDoc(doc(db, 'chatRooms', roomId, 'messages', messageId));
}
