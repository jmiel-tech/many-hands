
import test, { before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import {
  doc,
  collection,
  getDoc,
  getDocs,
  setDoc,
  query,
  where,
  serverTimestamp,
  runTransaction,
} from 'firebase/firestore';

let env;

// These fictional member documents exist only in the local Firestore rules-test emulator.
// The suite does not read or write a configured/live Firebase project.
const conversationId = 'alice~bob';
const conversationPath = `conversations/${conversationId}`;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-many-hands',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
    },
  });
});

after(async () => {
  if (env) await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();

  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();

    for (const uid of ['alice', 'bob', 'charlie']) {
      await setDoc(doc(db, 'members', uid), {
        name: uid,
        email: `${uid}@example.com`,
        phone: '(555) 555-5555',
        createdAt: new Date(),
      });
    }
  });
});

function userDb(uid) {
  return env.authenticatedContext(uid).firestore();
}

async function createConversation(db) {
  await setDoc(doc(db, conversationPath), {
    participantIds: ['alice', 'bob'],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastMessage: '',
    lastMessageId: null,
    lastSenderId: null,
  });
}

async function sendMessage(db, senderId, text) {
  const conversationRef = doc(db, conversationPath);
  const messageRef = doc(collection(db, conversationPath, 'messages'));
  await runTransaction(db, async (transaction) => {
    await transaction.get(conversationRef);
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

test('Alice can create a conversation with Bob', async () => {
  await assertSucceeds(createConversation(userDb('alice')));
});

test('a registered member can create a conversation after reading the missing document', async () => {
  const db = userDb('alice');
  await assertSucceeds(runTransaction(db, async (transaction) => {
    const ref = doc(db, conversationPath);
    const snapshot = await transaction.get(ref);
    if (snapshot.exists()) throw new Error('Expected a new conversation');
    transaction.set(ref, {
      participantIds: ['alice', 'bob'],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastMessage: '',
      lastMessageId: null,
      lastSenderId: null,
    });
  }));
});

test('Alice can read her conversation', async () => {
  await createConversation(userDb('alice'));

  await assertSucceeds(
    getDoc(doc(userDb('alice'), conversationPath))
  );
});

test('Bob can list his conversation and receive its messages', async () => {
  const alice = userDb('alice');
  await createConversation(alice);
  await sendMessage(alice, 'alice', 'Hello Bob!');

  const bob = userDb('bob');
  const conversations = await assertSucceeds(
    getDocs(query(collection(bob, 'conversations'), where('participantIds', 'array-contains', 'bob')))
  );
  const messages = await assertSucceeds(
    getDocs(collection(bob, conversationPath, 'messages'))
  );

  if (conversations.size !== 1 || messages.size !== 1 || messages.docs[0].data().text !== 'Hello Bob!') {
    throw new Error('Bob did not receive the conversation and message');
  }
});

test('Charlie cannot read Alice and Bob conversation', async () => {
  await createConversation(userDb('alice'));

  await assertFails(
    getDoc(doc(userDb('charlie'), conversationPath))
  );
});

test('Charlie cannot read Alice and Bob messages', async () => {
  const alice = userDb('alice');
  await createConversation(alice);
  await sendMessage(alice, 'alice', 'Private message');

  await assertFails(
    getDocs(collection(userDb('charlie'), conversationPath, 'messages'))
  );
});

test('Unauthenticated users cannot read conversations', async () => {
  await createConversation(userDb('alice'));

  await assertFails(
    getDoc(doc(env.unauthenticatedContext().firestore(), conversationPath))
  );
});

test('a conversation cannot include a UID without a registered member document', async () => {
  await assertFails(setDoc(doc(userDb('alice'), 'conversations/alice~unknown'), {
    participantIds: ['alice', 'unknown'],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastMessage: '',
    lastMessageId: null,
    lastSenderId: null,
  }));
});

test('Alice can send a message to Bob', async () => {
  const db = userDb('alice');
  await createConversation(db);

  const messageRef = doc(collection(db, conversationPath, 'messages'));

  await assertSucceeds(runTransaction(db, async (transaction) => {
    await transaction.get(doc(db, conversationPath));

    transaction.set(messageRef, {
      senderId: 'alice',
      text: 'Hello Bob!',
      createdAt: serverTimestamp(),
    });

    transaction.update(doc(db, conversationPath), {
      updatedAt: serverTimestamp(),
      lastMessage: 'Hello Bob!',
      lastMessageId: messageRef.id,
      lastSenderId: 'alice',
    });
  }));
});
