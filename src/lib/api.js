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

// Deletes your own profile and puts your unfinished tasks back to Unclaimed, in one go.
// Finished tasks keep your ID so the record of who did them stays. Your issues and comments stay too.
export async function deleteOwnProfile(uid, unfinishedTaskIds) {
  requireOnline();
  const batch = writeBatch(db);
  unfinishedTaskIds.forEach((id) => batch.update(doc(db, 'tasks', id), { assigneeId: null, status: 'todo' }));
  batch.delete(doc(db, 'members', uid));
  await batch.commit();
}

export async function createIssue(uid, { title, description, status, dueDate }) {
  requireOnline();
  const ref = await addDoc(collection(db, 'issues'), {
    title,
    description,
    status,
    dueDate: dueDate || null,
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
  const ref = await addDoc(collection(db, 'comments'), {
    taskId,
    authorId: uid,
    text,
    createdAt: serverTimestamp(),
  });
  return ref.id;
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
