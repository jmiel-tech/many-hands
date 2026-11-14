import test from 'node:test';
import assert from 'node:assert/strict';
import { hasUnsavedChanges } from '../src/lib/forms.js';

const blankIssue = { title: '', description: '', status: 'open', dueDate: '' };
const savedTask = { issueId: 'i1', title: 'Bring tables', description: 'Two folding tables', status: 'doing', assigneeId: 'u1', dueDate: '2026-11-20' };

test('an untouched form has no changes', () => {
  assert.equal(hasUnsavedChanges(blankIssue, { ...blankIssue }), false);
  assert.equal(hasUnsavedChanges(savedTask, { ...savedTask }), false);
});

test('typing a title into a new form is a change', () => {
  assert.equal(hasUnsavedChanges(blankIssue, { ...blankIssue, title: 'Coat drive' }), true);
});

test('editing an existing value is a change', () => {
  assert.equal(hasUnsavedChanges(savedTask, { ...savedTask, description: 'Three folding tables' }), true);
});

test('changing a non-text field is a change', () => {
  assert.equal(hasUnsavedChanges(blankIssue, { ...blankIssue, status: 'resolved' }), true);
  assert.equal(hasUnsavedChanges(savedTask, { ...savedTask, assigneeId: '' }), true);
  assert.equal(hasUnsavedChanges(savedTask, { ...savedTask, issueId: 'i2' }), true);
});

test('clearing an existing due date is a change', () => {
  assert.equal(hasUnsavedChanges(savedTask, { ...savedTask, dueDate: '' }), true);
});

test('typing and then erasing text is not a change', () => {
  assert.equal(hasUnsavedChanges(blankIssue, { ...blankIssue, title: '' }), false);
});

test('whitespace-only edits are not a change, since saving trims them', () => {
  assert.equal(hasUnsavedChanges(blankIssue, { ...blankIssue, title: '   ' }), false);
  assert.equal(hasUnsavedChanges(savedTask, { ...savedTask, title: 'Bring tables  ' }), false);
});

test('empty, null and undefined count as the same empty value', () => {
  assert.equal(hasUnsavedChanges({ dueDate: null, assigneeId: undefined }, { dueDate: '', assigneeId: '' }), false);
});

test('missing arguments do not crash', () => {
  assert.equal(hasUnsavedChanges(), false);
  assert.equal(hasUnsavedChanges(undefined, { title: 'x' }), true);
});
