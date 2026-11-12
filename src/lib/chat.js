import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { db } from '../firebase.js';
import { MAX_CHAT_MESSAGE_LENGTH, conversationIdFor } from './chat-contract.js';

function requireOnline() {
  if (navigator.onLine === false) {
    throw Object.assign(new Error('offline'), { code: 'app/offline' });
  }
}

const rowsFrom = (snapshot) => snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));

export function subscribeToConversations(uid, onChange, onError) {
  return onSnapshot(
    query(collection(db, 'conversations'), where('participantIds', 'array-contains', uid)),
    (snapshot) => onChange(rowsFrom(snapshot)),
    onError,
  );
}

export function subscribeToConversation(conversationId, onChange, onError) {
  return onSnapshot(
    doc(db, 'conversations', conversationId),
    (snapshot) => onChange(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null),
    onError,
  );
}

export function subscribeToMessages(conversationId, onChange, onError) {
  return onSnapshot(
    query(collection(db, 'conversations', conversationId, 'messages'), orderBy('createdAt', 'asc')),
    (snapshot) => onChange(rowsFrom(snapshot)),
    onError,
  );
}

export async function openConversation(uid, otherUid) {
  requireOnline();
  const id = conversationIdFor(uid, otherUid);
  const participantIds = [uid, otherUid].sort();
  const conversationRef = doc(db, 'conversations', id);

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(conversationRef);
    if (snapshot.exists()) {
      const current = snapshot.data();
      if (JSON.stringify(current.participantIds) !== JSON.stringify(participantIds)) {
        throw Object.assign(new Error('The conversation data is invalid.'), { code: 'app/invalid-conversation' });
      }
      return;
    }

    transaction.set(conversationRef, {
      participantIds,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastMessage: '',
      lastMessageId: null,
      lastSenderId: null,
    });
  });

  return id;
}

export async function sendChatMessage(conversationId, senderId, value) {
  requireOnline();
  const text = value.trim();
  if (!text || text.length > MAX_CHAT_MESSAGE_LENGTH) {
    throw Object.assign(new Error('Enter a message up to 2000 characters.'), { code: 'app/invalid-chat-message' });
  }

  const conversationRef = doc(db, 'conversations', conversationId);
  const messageRef = doc(collection(db, 'conversations', conversationId, 'messages'));

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(conversationRef);
    if (!snapshot.exists() || !snapshot.data().participantIds?.includes(senderId)) {
      throw Object.assign(new Error('You cannot send a message in this conversation.'), { code: 'app/chat-not-allowed' });
    }

    transaction.set(messageRef, {
      senderId,
      text,
      createdAt: serverTimestamp(),
    });
    transaction.update(conversationRef, {
      updatedAt: serverTimestamp(),
      lastMessage: text,
      lastMessageId: messageRef.id,
      lastSenderId: senderId,
    });
  });
}
