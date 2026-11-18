import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';

const request = (body, extraHeaders = {}) => new Request('https://many-hands-chat.example.workers.dev/support-email', {
  method: 'POST',
  headers: {
    Origin: 'http://127.0.0.1:5173',
    'CF-Connecting-IP': '203.0.113.8',
    'Content-Type': 'application/json',
    ...extraHeaders,
  },
  body: JSON.stringify(body),
});

test('support email sends through Resend with a safe reply-to address', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  let sent;
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://api.resend.com/emails');
    sent = { headers: options.headers, body: JSON.parse(options.body) };
    return Response.json({ id: 'email-id' }, { status: 200 });
  };
  const kv = {
    async get() { return null; },
    async put() {},
  };

  const response = await worker.fetch(request({
    email: 'member@example.com',
    subject: 'Login help',
    message: 'I cannot sign in.',
  }), {
    ALLOWED_ORIGINS: 'http://127.0.0.1:5173',
    RATE_LIMIT: kv,
    RESEND_API_KEY: 'test-secret',
    SUPPORT_FROM_EMAIL: 'Many Hands <support@example.com>',
  });

  assert.equal(response.status, 200);
  assert.equal(sent.headers.Authorization, 'Bearer test-secret');
  assert.deepEqual(sent.body, {
    from: 'Many Hands <support@example.com>',
    to: ['jamielke@svsu.edu'],
    reply_to: 'member@example.com',
    subject: 'Many Hands support: Login help',
    text: 'I cannot sign in.',
  });
});

test('support email is rate limited by client IP', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => {
    throw new Error('Email must not be sent after the limit is reached.');
  };
  const kv = {
    async get() { return '5'; },
    async put() {},
  };

  const response = await worker.fetch(request({
    email: 'member@example.com',
    subject: 'Login help',
    message: 'I cannot sign in.',
  }), {
    ALLOWED_ORIGINS: 'http://127.0.0.1:5173',
    RATE_LIMIT: kv,
    RESEND_API_KEY: 'test-secret',
    SUPPORT_FROM_EMAIL: 'Many Hands <support@example.com>',
  });

  assert.equal(response.status, 429);
});
