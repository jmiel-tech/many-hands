import test from 'node:test';
import assert from 'node:assert/strict';
import { filterIssues, filterMembers } from '../src/lib/filter.js';

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

// ---- Member search ----
const members = [
  { id: 'a', name: 'Ana Lopez', email: 'ana@example.com', phone: '(989) 555-1234' },
  { id: 'b', name: 'Ben Carter', email: 'bcarter@svsu.edu', phone: '(517) 555-9876' },
  { id: 'c', name: 'Chris Ana', email: 'chris@example.org', phone: '(313) 222-0000' },
];
const memberIds = (list) => list.map((m) => m.id);

test('member search: blank search returns everyone', () => {
  assert.deepEqual(memberIds(filterMembers(members, '')), ['a', 'b', 'c']);
  assert.deepEqual(memberIds(filterMembers(members, '   ')), ['a', 'b', 'c']);
  assert.deepEqual(memberIds(filterMembers(members)), ['a', 'b', 'c']);
});
test('member search: matches names case-insensitively', () => {
  assert.deepEqual(memberIds(filterMembers(members, 'BEN')), ['b']);
  assert.deepEqual(memberIds(filterMembers(members, 'ana')), ['a', 'c']);
});
test('member search: matches emails', () => {
  assert.deepEqual(memberIds(filterMembers(members, 'svsu.edu')), ['b']);
  assert.deepEqual(memberIds(filterMembers(members, 'Example.COM')), ['a']);
});
test('member search: matches phone numbers as stored', () => {
  assert.deepEqual(memberIds(filterMembers(members, '(989) 555-1234')), ['a']);
});
test('member search: matches phone numbers by digits, ignoring punctuation', () => {
  assert.deepEqual(memberIds(filterMembers(members, '9895551234')), ['a']);
  assert.deepEqual(memberIds(filterMembers(members, '555-98')), ['b']);
  assert.deepEqual(memberIds(filterMembers(members, '555')), ['a', 'b']);
});
test('member search: every word must match', () => {
  assert.deepEqual(memberIds(filterMembers(members, 'ana example.org')), ['c']);
  assert.deepEqual(memberIds(filterMembers(members, 'ana 989')), ['a']);
});
test('member search: no match returns an empty list', () => {
  assert.deepEqual(memberIds(filterMembers(members, 'zelda')), []);
  assert.deepEqual(memberIds(filterMembers(members, '000-1111')), []);
});
test('member search: punctuation-only words do not match everyone by digits', () => {
  assert.deepEqual(memberIds(filterMembers(members, '()')), []);
});
test('member search: missing fields do not crash', () => {
  assert.deepEqual(memberIds(filterMembers([{ id: 'x', name: 'Solo' }], 'solo')), ['x']);
  assert.deepEqual(memberIds(filterMembers([{ id: 'y' }], '555')), []);
});
