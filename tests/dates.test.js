import test from 'node:test';
import assert from 'node:assert/strict';
import { bySoonestDue, formatDue, isOverdue, todayISO } from '../src/lib/dates.js';

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
