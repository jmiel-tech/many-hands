import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../firebase.js';

// Firestore queues writes while offline and their promises never settle, which would
// leave buttons spinning. Fail straight away instead, so two people can't both "take" a task.
function requireOnline() {
  if (navigator.onLine === false) {
    throw Object.assign(new Error('offline'), { code: 'app/offline' });
  }
}

export async function saveNewMember(uid, { name, email, phone }) {
  await setDoc(doc(db, 'members', uid), { name, email, phone, createdAt: serverTimestamp() });
}

export async function updateMember(uid, patch) {
  requireOnline();
  await updateDoc(doc(db, 'members', uid), patch);
}

export async function createIssue(uid, { title, description, status }) {
  requireOnline();
  const ref = await addDoc(collection(db, 'issues'), {
    title,
    description,
    status,
    ownerId: uid,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateIssue(id, patch) {
  requireOnline();
  await updateDoc(doc(db, 'issues', id), patch);
}

export async function deleteIssue(id) {
  requireOnline();
  await deleteDoc(doc(db, 'issues', id));
}

export async function createTask(uid, { issueId, title, description, status, assigneeId, dueDate }) {
  requireOnline();
  const ref = await addDoc(collection(db, 'tasks'), {
    issueId,
    title,
    description,
    status,
    assigneeId,
    dueDate: dueDate || null,
    createdBy: uid,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateTask(id, patch) {
  requireOnline();
  await updateDoc(doc(db, 'tasks', id), patch);
}

export async function takeTask(id, uid) {
  requireOnline();
  try {
    await updateDoc(doc(db, 'tasks', id), { assigneeId: uid });
  } catch (e) {
    // The rules only let this fail when someone else claimed it first.
    if (e.code === 'permission-denied') {
      throw Object.assign(new Error('taken'), { code: 'app/already-taken' });
    }
    throw e;
  }
}

export async function deleteTask(id) {
  requireOnline();
  await deleteDoc(doc(db, 'tasks', id));
}

export async function addComment(uid, taskId, text) {
  requireOnline();
  await addDoc(collection(db, 'comments'), {
    taskId,
    authorId: uid,
    text,
    createdAt: serverTimestamp(),
  });
}

export async function updateComment(id, text) {
  requireOnline();
  await updateDoc(doc(db, 'comments', id), { text });
}

export async function deleteComment(id) {
  requireOnline();
  await deleteDoc(doc(db, 'comments', id));
}
