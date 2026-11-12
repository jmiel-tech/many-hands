// Due dates are calendar days stored as 'YYYY-MM-DD', so they never shift with time zones.

const pad = (n) => String(n).padStart(2, '0');

export function toISODate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export const todayISO = (now = new Date()) => toISODate(now);

// new Date('2026-11-15') would be midnight UTC, which is the day before in the Americas.
export function parseLocal(iso) {
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

export const isISODate = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
export const isMonthKey = (value) => typeof value === 'string' && /^\d{4}-\d{2}$/.test(value);

// Month keys are 'YYYY-MM'. Date handles month and year rollover.
export function shiftMonth(key, delta) {
  const [y, m] = key.split('-').map(Number);
  return toISODate(new Date(y, m - 1 + delta, 1)).slice(0, 7);
}

// Every day shown on a month calendar: whole weeks, Sunday to Saturday.
export function monthDays(key) {
  const [y, m] = key.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const last = new Date(y, m, 0);
  const start = new Date(y, m - 1, 1 - first.getDay());
  const end = new Date(y, m - 1, last.getDate() + (6 - last.getDay()));
  const days = [];
  for (let d = start; d <= end; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
    days.push(toISODate(d));
  }
  return days;
}

// ---- Repeating tasks ----

// The order here is the order the form shows them in.
export const REPEAT_OPTIONS = {
  daily: 'Every day',
  weekly: 'Every week',
  biweekly: 'Every 2 weeks',
  monthly: 'Every month',
};

export const isRepeat = (value) => Object.hasOwn(REPEAT_OPTIONS, value);

// One step forward. A monthly date keeps its day, or the month's last day when it's shorter:
// Jan 31 → Feb 28 (or 29 in a leap year).
export function addRepeat(iso, repeat) {
  const [y, m, d] = iso.split('-').map(Number);
  if (repeat === 'monthly') {
    const lastDay = new Date(y, m + 1, 0).getDate();
    return toISODate(new Date(y, m, Math.min(d, lastDay)));
  }
  const days = { daily: 1, weekly: 7, biweekly: 14 }[repeat];
  if (!days) throw new Error(`Unknown repeat: ${repeat}`);
  return toISODate(new Date(y, m - 1, d + days));
}

// The next due date counts from the old due date, so the schedule doesn't drift when someone
// finishes early or late. If the task ran so late that the next date has already passed,
// skip ahead to the first one that's today or later.
export function nextDueDate(iso, repeat, now = new Date()) {
  const today = todayISO(now);
  let next = addRepeat(iso, repeat);
  while (next < today) next = addRepeat(next, repeat);
  return next;
}
