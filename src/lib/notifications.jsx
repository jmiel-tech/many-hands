import { createContext, useContext, useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase.js';
import { useAuth } from './auth.jsx';
import { useData } from './data.jsx';

const NotificationContext = createContext(null);
export const useNotifications = () => useContext(NotificationContext);

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);

  const addNotification = useCallback((message, type = 'info', duration = 4000) => {
    const id = Date.now();
    setNotifications((prev) => [...prev, { id, message, type }]);

    if (duration > 0) {
      setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
      }, duration);
    }

    return id;
  }, []);

  const removeNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const value = useMemo(
    () => ({
      notifications,
      addNotification,
      removeNotification,
    }),
    [notifications, addNotification, removeNotification],
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

// Hook to trigger notifications based on data changes
export function useNotificationTriggers() {
  const { user } = useAuth();
  const { tasks, members } = useData();
  const { addNotification } = useNotifications();
  const prevTasksRef = useRef(null);
  const prevCommentsRef = useRef({});

  // Notify when assigned a task
  useEffect(() => {
    if (!user || !tasks) return;

    const prevTasks = prevTasksRef.current || [];
    const userTasks = tasks.filter((t) => t.assigneeId === user.uid);

    userTasks.forEach((task) => {
      const wasAssigned = prevTasks.some((t) => t.id === task.id && t.assigneeId === user.uid);
      if (!wasAssigned && task.assigneeId === user.uid) {
        addNotification(`You were assigned a task: ${task.title}`, 'info', 5000);
      }
    });

    prevTasksRef.current = tasks;
  }, [tasks, user, addNotification]);

  // Listen for new comments on user's tasks
  useEffect(() => {
    if (!user || !tasks) return;

    const userTaskIds = tasks.filter((t) => t.assigneeId === user.uid).map((t) => t.id);
    if (userTaskIds.length === 0) return;

    const unsubscribes = userTaskIds.map((taskId) => {
      return onSnapshot(
        query(collection(db, 'comments'), where('taskId', '==', taskId)),
        (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
              const comment = change.doc.data();
              if (comment.authorId !== user.uid) {
                const task = tasks.find((t) => t.id === taskId);
                const author = members.find((m) => m.id === comment.authorId);
                addNotification(
                  `${author?.name || 'Someone'} commented on "${task?.title}"`,
                  'info',
                  5000,
                );
              }
            }
          });
        },
        (error) => console.error('Comment listener error:', error),
      );
    });

    return () => unsubscribes.forEach((unsub) => unsub());
  }, [user, tasks, members, addNotification]);
}

