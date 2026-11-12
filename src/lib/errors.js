import { useCallback, useState } from 'react';

const MESSAGES = {
  'auth/email-already-in-use': 'That email already has an account. Each email can only be used once.',
  'auth/invalid-email': "That doesn't look like an email address.",
  'auth/weak-password': 'That password is too weak. Use at least 8 characters.',
  'auth/wrong-password': "That email and password don't match. Check them and try again.",
  'auth/invalid-credential': "That email and password don't match. Check them and try again.",
  'auth/user-not-found': "That email and password don't match. Check them and try again.",
  'auth/too-many-requests': 'Too many tries. Wait a few minutes, then try again.',
  'auth/network-request-failed': "Can't reach the server. Check your connection and try again.",
  'auth/user-token-expired': 'You need to log in again.',
  'permission-denied': "You don't have permission to do that.",
  unavailable: "Can't reach the server. Check your connection and try again.",
  'app/offline': "You're offline. This works again once you're back online.",
  'app/already-taken': 'Someone else just took this task.',
  'app/invalid-conversation': 'This conversation could not be opened.',
  'app/invalid-chat-message': 'Enter a message up to 2000 characters.',
  'app/chat-not-allowed': "You can't send messages in this conversation.",
};

export function friendlyError(error) {
  return MESSAGES[error?.code] || error?.friendly || 'Something went wrong. Please try again.';
}

// Runs an async action and tracks its busy and error state for the button that started it.
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = useCallback(async (action) => {
    setBusy(true);
    setError('');
    try {
      return await action();
    } catch (e) {
      console.error(e);
      setError(friendlyError(e));
      return undefined;
    } finally {
      setBusy(false);
    }
  }, []);
  return { busy, error, setError, run };
}
