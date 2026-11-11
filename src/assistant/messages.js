import { friendlyError } from '../lib/errors.js';

const CHAT_MESSAGES = {
  'chat/unauthorized': 'Your sign-in expired. Try again, or log out and back in.',
  'chat/rate-limited': "You've asked a lot this hour. Try again a bit later.",
  'chat/timeout': 'The assistant took too long to answer.',
  'chat/unavailable': "The assistant isn't available right now.",
  'chat/upstream': 'The assistant ran into a problem partway through.',
};

// Chat-specific wording first, then the app's usual messages (offline, permission denied, and so on).
export const chatError = (error) => CHAT_MESSAGES[error?.code] || friendlyError(error);
