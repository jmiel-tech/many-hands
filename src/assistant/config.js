// The one switch for the whole assistant. Set VITE_ENABLE_ASSISTANT=true (and the Worker URL below) to turn it on.
// Anything else, or a missing URL, turns it off: no button, no chat code loaded.
// Both values are public. The model API key lives only in the Worker as a secret (see worker/).
export const CHAT_ENDPOINT = (import.meta.env.VITE_CHAT_ENDPOINT || '').trim();
export const ASSISTANT_ENABLED = import.meta.env.VITE_ENABLE_ASSISTANT === 'true' && CHAT_ENDPOINT !== '';
