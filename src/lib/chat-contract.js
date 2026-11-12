export const MAX_CHAT_MESSAGE_LENGTH = 2000;

export function conversationIdFor(uidA, uidB) {
  if (typeof uidA !== 'string' || !uidA.trim() || typeof uidB !== 'string' || !uidB.trim() || uidA === uidB) {
    throw Object.assign(new Error('A conversation needs two different members.'), { code: 'app/invalid-conversation' });
  }
  return [uidA, uidB]
    .sort()
    .map((uid) => encodeURIComponent(uid).replace(/~/g, '%7E'))
    .join('~');
}
