import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase.js';

const DataContext = createContext(null);
export const useData = () => useContext(DataContext);

// Everyone can read an issue; the owner and anyone the owner granted can edit it and add tasks.
// Everyone can read an issue; the owner, anyone the owner granted, or everyone if editableByAll, can edit it and add tasks.
export const canEditIssue = (issue, uid) => Boolean(issue)
  && (issue.ownerId === uid || issue.editableByAll === true || (issue.editorIds || []).includes(uid));

const createdMillis = (item) => item.createdAt?.toMillis?.() ?? Date.now();
const oldestFirst = (a, b) => createdMillis(a) - createdMillis(b);
const toRows = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort(oldestFirst);

// A community is small, so live listeners on the three shared collections keep every screen simple and current.
export function DataProvider({ children }) {
  const [members, setMembers] = useState(null);
  const [issues, setIssues] = useState(null);
  const [tasks, setTasks] = useState(null);

  useEffect(() => {
    const onError = (error) => console.error(error);
    const listeners = [
      onSnapshot(collection(db, 'members'), (s) => setMembers(toRows(s)), onError),
      onSnapshot(collection(db, 'issues'), (s) => setIssues(toRows(s).reverse()), onError),
      onSnapshot(collection(db, 'tasks'), (s) => setTasks(toRows(s)), onError),
    ];
    return () => listeners.forEach((stop) => stop());
  }, []);

  const value = useMemo(() => {
    const memberById = new Map((members || []).map((m) => [m.id, m]));
    return {
      loading: !members || !issues || !tasks,
      members: members ? [...members].sort((a, b) => a.name.localeCompare(b.name)) : [],
      issues: issues || [],
      tasks: tasks || [],
      memberById,
      tasksFor: (issueId) => (tasks || []).filter((t) => t.issueId === issueId),
      nameOf: (id) => memberById.get(id)?.name || 'A former member',
    };
  }, [members, issues, tasks]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

// Comments load per task, so comments left behind by a deleted task never show up anywhere.
export function useComments(taskId) {
  const [comments, setComments] = useState(null);
  useEffect(() => {
    setComments(null);
    return onSnapshot(
      query(collection(db, 'comments'), where('taskId', '==', taskId)),
      (s) => setComments(toRows(s)),
      (error) => console.error(error),
    );
  }, [taskId]);
  return comments;
}

export function useOnline() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return online;
}
