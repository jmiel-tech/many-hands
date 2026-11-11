import test from 'node:test';
import assert from 'node:assert/strict';
import { filterIssues } from '../src/lib/filter.js';

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
