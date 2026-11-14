import test from 'node:test';
import assert from 'node:assert/strict';
import { conversationIdFor } from '../src/lib/chat-contract.js';

test('conversation IDs are stable regardless of participant order', () => {
  assert.equal(conversationIdFor('alice', 'bob'), conversationIdFor('bob', 'alice'));
});

test('conversation IDs safely encode participant IDs', () => {
  assert.equal(conversationIdFor('a~b', 'c'), 'a%7Eb~c');
});

test('a member cannot start a conversation with themself or a missing uid', () => {
  assert.throws(() => conversationIdFor('alice', 'alice'), { code: 'app/invalid-conversation' });
  assert.throws(() => conversationIdFor('', 'bob'), { code: 'app/invalid-conversation' });
});
