import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_MESSAGES, MAX_TOOL_CALLS, MAX_TOTAL_CHARS, allowedOrigin, validateBody } from '../src/validate.js';
import { TOOL_NAMES } from '../src/tools.js';

const user = (content = 'hi') => ({ role: 'user', content });

test('accepts a system prompt followed by a user message', () => {
  const { messages, error } = validateBody({ messages: [{ role: 'system', content: 'x' }, user()] });
  assert.equal(error, undefined);
  assert.equal(messages.length, 2);
});
test('strips unknown fields', () => {
  const { messages } = validateBody({ messages: [{ ...user(), name: 'x', tool_calls: [] }] });
  assert.deepEqual(messages, [user()]);
});
test('rejects empty, oversized and malformed bodies', () => {
  assert.ok(validateBody({}).error);
  assert.ok(validateBody({ messages: [] }).error);
  assert.ok(validateBody({ messages: Array(MAX_MESSAGES + 1).fill(user()) }).error);
  assert.ok(validateBody({ messages: [user('x'.repeat(MAX_TOTAL_CHARS / 2)), { role: 'assistant', content: 'x'.repeat(MAX_TOTAL_CHARS / 2) }, user()] }).error);
  assert.ok(validateBody({ messages: [{ role: 'tool', content: 'x' }] }).error);
  assert.ok(validateBody({ messages: [{ role: 'user', content: 5 }] }).error);
});
test('rejects a system message after the first position', () => {
  assert.ok(validateBody({ messages: [user(), { role: 'system', content: 'x' }, user()] }).error);
});
test('requires the last message to come from the user', () => {
  assert.ok(validateBody({ messages: [user(), { role: 'assistant', content: 'x' }] }).error);
});
test('allows only listed origins', () => {
  const list = 'https://jmiel-tech.github.io, http://localhost:5173';
  assert.equal(allowedOrigin('http://localhost:5173', list), 'http://localhost:5173');
  assert.equal(allowedOrigin('https://jmiel-tech.github.io', list), 'https://jmiel-tech.github.io');
  assert.equal(allowedOrigin('https://evil.example', list), null);
  assert.equal(allowedOrigin('https://jmiel-tech.github.io.evil.example', list), null);
  assert.equal(allowedOrigin(null, list), null);
});

const call = (id, name = 'take_task', args = '{"task_id":"t1"}') => ({ id, type: 'function', function: { name, arguments: args } });
const asks = (calls) => ({ role: 'assistant', content: '', tool_calls: calls });
const result = (id, content = '{"ok":true}') => ({ role: 'tool', tool_call_id: id, content });

test('accepts a listed tool call followed by its result', () => {
  const { messages, error } = validateBody({ messages: [user(), asks([call('c1')]), result('c1')] });
  assert.equal(error, undefined);
  assert.equal(messages[1].tool_calls[0].function.name, 'take_task');
  assert.equal(messages[2].tool_call_id, 'c1');
});
test('rejects tools that are not on the list', () => {
  assert.ok(validateBody({ messages: [user(), asks([call('c1', 'delete_issue')]), result('c1')] }).error);
});
test('rejects a tool result without a matching call', () => {
  assert.ok(validateBody({ messages: [user(), result('c9')] }).error);
  assert.ok(validateBody({ messages: [user(), asks([call('c1')]), result('c2')] }).error);
});
test('requires every tool call to be answered before the conversation goes on', () => {
  assert.ok(validateBody({ messages: [user(), asks([call('c1'), call('c2')]), result('c1'), user()] }).error);
  assert.ok(validateBody({ messages: [user(), asks([call('c1')])] }).error);
});
test('rejects too many tool calls or oversized arguments', () => {
  const many = Array.from({ length: MAX_TOOL_CALLS + 1 }, (_, i) => call(`c${i}`));
  assert.ok(validateBody({ messages: [user(), asks(many), ...many.map((c) => result(c.id))] }).error);
  assert.ok(validateBody({ messages: [user(), asks([call('c1', 'add_comment', 'x'.repeat(3000))]), result('c1')] }).error);
});
test('the tool list offered to the model is fixed', () => {
  assert.deepEqual([...TOOL_NAMES].sort(), ['add_comment', 'find_tasks', 'set_my_task_status', 'take_task']);
});
