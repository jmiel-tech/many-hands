import test from 'node:test';
import assert from 'node:assert/strict';
import { issueHealth, groupTasks } from '../src/lib/health.js';

const tasks = (assigned, unassigned) => [
  ...Array(assigned).fill({ assigneeId: 'a', status: 'todo' }),
  ...Array(unassigned).fill({ assigneeId: null, status: 'todo' }),
];

test('Orphaned when an issue has no tasks', () => {
  assert.equal(issueHealth([]).label, 'Orphaned');
});
test('Covered when every task has an assignee', () => {
  assert.equal(issueHealth(tasks(3, 0)).label, 'Covered');
});
test('Thin when some are unassigned', () => {
  assert.equal(issueHealth(tasks(3, 1)).label, 'Thin');
  assert.equal(issueHealth(tasks(2, 2)).label, 'Thin');
});
test('At risk when most are unassigned', () => {
  assert.equal(issueHealth(tasks(1, 2)).label, 'At risk');
  assert.equal(issueHealth(tasks(0, 2)).label, 'At risk');
});
test('groups unclaimed first, then by status', () => {
  const g = groupTasks([
    { assigneeId: null, status: 'doing' },
    { assigneeId: 'a', status: 'todo' },
    { assigneeId: 'a', status: 'doing' },
    { assigneeId: 'a', status: 'done' },
  ]);
  assert.deepEqual([g.unclaimed.length, g.todo.length, g.doing.length, g.done.length], [1, 1, 1, 1]);
});
