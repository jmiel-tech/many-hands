// Due dates are calendar days stored as 'YYYY-MM-DD', so they never shift with time zones.

const pad = (n) => String(n).padStart(2, '0');

export function toISODate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export const todayISO = (now = new Date()) => toISODate(now);

// new Date('2026-11-15') would be midnight UTC, which is the day before in the Americas.
function parseLocal(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// Works for tasks and issues: a done task or a resolved issue is never overdue.
const FINISHED = new Set(['done', 'resolved']);

export function isOverdue(item, now = new Date()) {
  return Boolean(item.dueDate) && item.dueDate < todayISO(now) && !FINISHED.has(item.status);
}

export function formatDue(iso, now = new Date()) {
  const date = parseLocal(iso);
  const today = parseLocal(todayISO(now));
  const days = Math.round((date - today) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  const options = { weekday: 'short', month: 'short', day: 'numeric' };
  if (date.getFullYear() !== today.getFullYear()) options.year = 'numeric';
  return date.toLocaleDateString([], options);
}

// Dated tasks first, soonest first. Undated tasks keep their order, since Array.sort is stable.
export function bySoonestDue(a, b) {
  if (a.dueDate && b.dueDate) return a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0;
  if (a.dueDate) return -1;
  if (b.dueDate) return 1;
  return 0;
}
