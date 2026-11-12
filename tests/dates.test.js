import test from 'node:test';
import assert from 'node:assert/strict';
import { addRepeat, bySoonestDue, formatDue, isOverdue, isRepeat, monthDays, nextDueDate, shiftMonth, todayISO } from '../src/lib/dates.js';

const now = new Date(2026, 10, 11, 23, 30); // Nov 11 2026, late evening local time

test('todayISO uses the local calendar day', () => {
  assert.equal(todayISO(now), '2026-11-11');
  assert.equal(todayISO(new Date(2026, 0, 5)), '2026-01-05');
});

test('formatDue names nearby days', () => {
  assert.equal(formatDue('2026-11-11', now), 'Today');
  assert.equal(formatDue('2026-11-12', now), 'Tomorrow');
  assert.equal(formatDue('2026-11-10', now), 'Yesterday');
});

test('formatDue shows the local date, not the UTC day before', () => {
  const text = formatDue('2026-11-15', now);
  assert.match(text, /15/);
  assert.doesNotMatch(text, /2026/);
});

test('formatDue adds the year when it differs', () => {
  assert.match(formatDue('2027-01-03', now), /2027/);
});

test('isOverdue: past date and not done', () => {
  assert.equal(isOverdue({ dueDate: '2026-11-10', status: 'todo' }, now), true);
  assert.equal(isOverdue({ dueDate: '2026-11-10', status: 'doing' }, now), true);
});

test('isOverdue: false when done, due today or later, or undated', () => {
  assert.equal(isOverdue({ dueDate: '2026-11-10', status: 'done' }, now), false);
  assert.equal(isOverdue({ dueDate: '2026-11-11', status: 'todo' }, now), false);
  assert.equal(isOverdue({ dueDate: null, status: 'todo' }, now), false);
  assert.equal(isOverdue({ status: 'todo' }, now), false);
});

test('isOverdue: issues are overdue until resolved', () => {
  assert.equal(isOverdue({ dueDate: '2026-11-10', status: 'open' }, now), true);
  assert.equal(isOverdue({ dueDate: '2026-11-10', status: 'in_progress' }, now), true);
  assert.equal(isOverdue({ dueDate: '2026-11-10', status: 'resolved' }, now), false);
});

test('bySoonestDue puts dated tasks first, soonest first, and keeps undated order', () => {
  const tasks = [
    { id: 'a' },
    { id: 'b', dueDate: '2026-12-01' },
    { id: 'c', dueDate: null },
    { id: 'd', dueDate: '2026-11-20' },
    { id: 'e' },
  ];
  assert.deepEqual([...tasks].sort(bySoonestDue).map((t) => t.id), ['d', 'b', 'a', 'c', 'e']);
});

test('shiftMonth rolls over years', () => {
  assert.equal(shiftMonth('2026-11', 1), '2026-12');
  assert.equal(shiftMonth('2026-12', 1), '2027-01');
  assert.equal(shiftMonth('2026-01', -1), '2025-12');
});

test('monthDays covers whole Sunday-to-Saturday weeks', () => {
  const days = monthDays('2026-11'); // Nov 1 2026 is a Sunday, Nov 30 a Monday
  assert.equal(days[0], '2026-11-01');
  assert.equal(days.at(-1), '2026-12-05');
  assert.equal(days.length % 7, 0);
  const feb = monthDays('2026-02'); // Feb 1 2026 is a Sunday, Feb 28 a Saturday
  assert.equal(feb[0], '2026-02-01');
  assert.equal(feb.length, 28);
  const march = monthDays('2026-03'); // spans the US daylight-saving change
  assert.equal(march[0], '2026-03-01');
  assert.equal(new Set(march).size, march.length);
  assert.ok(march.includes('2026-03-08') && march.includes('2026-03-09'));
});

// ---- Repeating tasks ----

test('addRepeat steps a day, a week, or two weeks, across month and year ends', () => {
  assert.equal(addRepeat('2026-11-11', 'daily'), '2026-11-12');
  assert.equal(addRepeat('2026-11-28', 'weekly'), '2026-12-05');
  assert.equal(addRepeat('2026-12-25', 'biweekly'), '2027-01-08');
  assert.equal(addRepeat('2026-12-31', 'daily'), '2027-01-01');
});

test('addRepeat monthly keeps the day, or uses the last day of a shorter month', () => {
  assert.equal(addRepeat('2026-11-15', 'monthly'), '2026-12-15');
  assert.equal(addRepeat('2026-12-15', 'monthly'), '2027-01-15');
  assert.equal(addRepeat('2027-01-31', 'monthly'), '2027-02-28');
  assert.equal(addRepeat('2028-01-31', 'monthly'), '2028-02-29');
  assert.equal(addRepeat('2026-03-31', 'monthly'), '2026-04-30');
});

test('addRepeat rejects an unknown repeat', () => {
  assert.throws(() => addRepeat('2026-11-11', 'yearly'));
});

test('nextDueDate counts from the due date, not the day it was finished', () => {
  // Due Saturday the 14th, finished early on the 11th: next is the following Saturday.
  assert.equal(nextDueDate('2026-11-14', 'weekly', now), '2026-11-21');
  // Due today, finished today.
  assert.equal(nextDueDate('2026-11-11', 'weekly', now), '2026-11-18');
});

test('nextDueDate skips past dates when a task was finished very late', () => {
  // Due Oct 14, finished Nov 11: Oct 21, 28 and Nov 4 have passed, so Nov 11 (today) is next.
  assert.equal(nextDueDate('2026-10-14', 'weekly', now), '2026-11-11');
  assert.equal(nextDueDate('2026-08-20', 'monthly', now), '2026-11-20');
  assert.equal(nextDueDate('2026-11-01', 'daily', now), '2026-11-11');
});

test('isRepeat accepts only the listed options', () => {
  assert.ok(isRepeat('weekly'));
  assert.ok(!isRepeat('yearly'));
  assert.ok(!isRepeat(null));
  assert.ok(!isRepeat('toString'));
});
