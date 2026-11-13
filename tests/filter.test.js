import test from 'node:test';
import assert from 'node:assert/strict';
import { filterIssues, sortIssues } from '../src/lib/filter.js';

const issues = [
  { id: 1, title: 'Fix the park benches', description: 'Two are broken', status: 'open' },
  { id: 2, title: 'Food drive', description: 'Collect cans at the park', status: 'in_progress' },
  { id: 3, title: 'Paint the fence', description: '', status: 'resolved' },
];
const ids = (list) => list.map((i) => i.id);

test('active view hides resolved issues by default', () => {
  assert.deepEqual(ids(filterIssues(issues)), [1, 2]);
});
test('resolved view shows only resolved issues', () => {
  assert.deepEqual(ids(filterIssues(issues, { view: 'resolved' })), [3]);
});
test('all view shows everything', () => {
  assert.deepEqual(ids(filterIssues(issues, { view: 'all' })), [1, 2, 3]);
});
test('search matches title or description, case-insensitive', () => {
  assert.deepEqual(ids(filterIssues(issues, { view: 'all', search: 'PARK' })), [1, 2]);
});
test('every search word must match', () => {
  assert.deepEqual(ids(filterIssues(issues, { view: 'all', search: 'park cans' })), [2]);
});
test('blank search ignores whitespace', () => {
  assert.deepEqual(ids(filterIssues(issues, { view: 'all', search: '   ' })), [1, 2, 3]);
});
test('missing description does not crash', () => {
  assert.deepEqual(ids(filterIssues([{ id: 4, title: 'X', status: 'open' }], { search: 'x' })), [4]);
});

// Sorting. createdAt mimics a Firestore Timestamp.
const at = (ms) => ({ toMillis: () => ms });
const sortable = [
  { id: 'a', title: 'banana drive', status: 'resolved', dueDate: '2026-12-01', createdAt: at(100) },
  { id: 'b', title: 'Apple picking', status: 'open', dueDate: null, createdAt: at(300) },
  { id: 'c', title: 'cleanup', status: 'in_progress', dueDate: '2026-11-20', createdAt: at(200) },
  { id: 'd', title: 'Item 10', status: 'open', dueDate: '2026-11-20', createdAt: at(400) },
  { id: 'e', title: 'Item 9', status: 'open', createdAt: at(50) },
];

test('newest first is the default sort', () => {
  assert.deepEqual(ids(sortIssues(sortable)), ['d', 'b', 'c', 'a', 'e']);
});
test('oldest first reverses creation order', () => {
  assert.deepEqual(ids(sortIssues(sortable, 'oldest')), ['e', 'a', 'c', 'b', 'd']);
});
test('due date puts soonest first, ties newest first, undated last', () => {
  assert.deepEqual(ids(sortIssues(sortable, 'due')), ['d', 'c', 'a', 'b', 'e']);
});
test('title sort ignores case and orders numbers naturally', () => {
  assert.deepEqual(ids(sortIssues(sortable, 'title')), ['b', 'a', 'c', 'e', 'd']);
});
test('status sort goes open, in progress, resolved', () => {
  assert.deepEqual(ids(sortIssues(sortable, 'status')), ['d', 'b', 'e', 'c', 'a']);
});
test('an issue still waiting for its server timestamp counts as newest', () => {
  const pending = { id: 'p', title: 'New', status: 'open', createdAt: null };
  assert.equal(sortIssues([...sortable, pending])[0].id, 'p');
});
test('unknown sort key falls back to newest first', () => {
  assert.deepEqual(ids(sortIssues(sortable, 'nope')), ids(sortIssues(sortable)));
});
test('sorting does not reorder the original array', () => {
  const copy = [...sortable];
  sortIssues(sortable, 'title');
  assert.deepEqual(sortable, copy);
});
