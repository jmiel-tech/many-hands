import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase.js';
import { isRepeat, nextDueDate } from './dates.js';

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

export async function createIssue(uid, { title, description, status, dueDate, editorIds }) {
  requireOnline();
  const ref = await addDoc(collection(db, 'issues'), {
    title,
    description,
    status,
    dueDate: dueDate || null,
    ownerId: uid,
    editorIds,
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

// The next task in a repeating series: same work, next due date, unclaimed.
function nextInSeries(uid, task) {
  return {
    issueId: task.issueId,
    title: task.title,
    description: task.description,
    status: 'todo',
    assigneeId: null,
    dueDate: nextDueDate(task.dueDate, task.repeat),
    repeat: task.repeat,
    createdBy: uid,
    createdAt: serverTimestamp(),
  };
}

const isFinishedRepeat = (task) => task.status === 'done' && isRepeat(task.repeat) && Boolean(task.dueDate);

// Returns the new task's id, plus the next due date when it was created already done and repeating.
export async function createTask(uid, { issueId, title, description, status, assigneeId, dueDate, repeat }) {
  requireOnline();
  const values = {
    issueId,
    title,
    description,
    status,
    assigneeId,
    dueDate: dueDate || null,
    repeat: (dueDate && repeat) || null,
    createdBy: uid,
    createdAt: serverTimestamp(),
  };
  const ref = doc(collection(db, 'tasks'));
  if (!isFinishedRepeat(values)) {
    await setDoc(ref, values);
    return { id: ref.id, nextDue: null };
  }
  // Created already done: save it as finished and start the series with the next one.
  const next = nextInSeries(uid, values);
  const batch = writeBatch(db);
  batch.set(ref, { ...values, repeat: null });
  batch.set(doc(collection(db, 'tasks')), next);
  await batch.commit();
  return { id: ref.id, nextDue: next.dueDate };
}

export async function updateTask(id, patch) {
  requireOnline();
  await updateDoc(doc(db, 'tasks', id), patch);
}

// Saves a change to a task the user holds. If that change finishes a repeating task, it also
// creates the next one, in the same batch that turns repeat off on the finished one, which is
// what the rules require. Returns the next one's due date, or null when nothing repeated.
export async function saveTask(uid, task, patch) {
  requireOnline();
  const ref = doc(db, 'tasks', task.id);
  const after = { ...task, ...patch };
  if (!isFinishedRepeat(after)) {
    await updateDoc(ref, patch);
    return null;
  }
  // The rules only accept a follow-up from a task that was already repeating, so when this same
  // save turns repeat on, save that part first.
  if (!isRepeat(task.repeat)) {
    await updateDoc(ref, { ...patch, status: task.status });
  }
  const next = { ...nextInSeries(uid, after), repeatOf: task.id };
  const batch = writeBatch(db);
  batch.update(ref, { ...patch, status: 'done', repeat: null });
  batch.set(doc(collection(db, 'tasks')), next);
  await batch.commit();
  return next.dueDate;
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

// ---- Admin ----

// Deletes an issue and every task on it in one go. Only admins may delete tasks they don't hold.
export async function adminDeleteIssue(issueId, taskIds) {
  requireOnline();
  const batch = writeBatch(db);
  taskIds.forEach((id) => batch.delete(doc(db, 'tasks', id)));
  batch.delete(doc(db, 'issues', issueId));
  await batch.commit();
}

// Removes a member: records the ban, deletes their profile, and frees the tasks they held.
// Their login still exists, but the rules refuse everything they try while the ban is in place.
export async function kickMember(adminUid, member, heldTaskIds) {
  requireOnline();
  const batch = writeBatch(db);
  batch.set(doc(db, 'bans', member.id), {
    name: member.name,
    email: member.email,
    phone: member.phone,
    memberCreatedAt: member.createdAt,
    bannedBy: adminUid,
    createdAt: serverTimestamp(),
  });
  heldTaskIds.forEach((id) => batch.update(doc(db, 'tasks', id), { assigneeId: null }));
  batch.delete(doc(db, 'members', member.id));
  await batch.commit();
}

// Lets a removed person back in and puts their profile back exactly as it was.
// Their old tasks stay Unclaimed: someone else may have taken them since.
export async function unbanMember(ban) {
  requireOnline();
  const batch = writeBatch(db);
  batch.delete(doc(db, 'bans', ban.id));
  // Bans made before profiles were saved have no phone. Those people fill in their profile on next login.
  if (ban.phone) {
    batch.set(doc(db, 'members', ban.id), {
      name: ban.name,
      email: ban.email,
      phone: ban.phone,
      createdAt: ban.memberCreatedAt,
    });
  }
  await batch.commit();
}
