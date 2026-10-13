import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.js';

const endpoint = 'https://toonlab.verinasci.com/api/chat';
const baseBody = JSON.stringify({ prompt: 'Hello', model: 'openrouter/free' });
const env = {
  DEMO_CODE: 'toonlab-demo',
  OPENROUTER_DEMO_API_KEY: 'server-openrouter-key',
};

function request(headers = {}, body = baseBody) {
  return new Request(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body,
  });
}

function mockOpenRouter(t, expectedKey, expectedModel = 'openrouter/free') {
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.equal(url, 'https://openrouter.ai/api/v1/chat/completions');
    assert.equal(init.headers.Authorization, `Bearer ${expectedKey}`);
    assert.equal(JSON.parse(init.body).model, expectedModel);
    return Response.json({
      model: 'test/model',
      choices: [{ message: { content: 'Hello from ToonLab.' } }],
    });
  });
}

test('user API key is forwarded to OpenRouter', async t => {
  mockOpenRouter(t, 'user-key');
  const response = await worker.fetch(request({ Authorization: 'Bearer user-key' }), {});
  assert.equal(response.status, 200);
  assert.equal((await response.json()).text, 'Hello from ToonLab.');
});

test('worker falls back to openrouter/free when model is omitted', async t => {
  mockOpenRouter(t, 'user-key');
  const response = await worker.fetch(
    request({ Authorization: 'Bearer user-key' }, JSON.stringify({ prompt: 'Hello' })),
    {},
  );
  assert.equal(response.status, 200);
});

test('valid demo code swaps in the Worker-side OpenRouter key', async t => {
  mockOpenRouter(t, env.OPENROUTER_DEMO_API_KEY);
  const response = await worker.fetch(request({ 'X-ToonLab-Demo-Code': env.DEMO_CODE }), env);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).model, 'test/model');
});

test('invalid or unconfigured demo access is rejected without calling OpenRouter', async () => {
  const invalid = await worker.fetch(request({ 'X-ToonLab-Demo-Code': 'wrong-code' }), env);
  assert.equal(invalid.status, 401);

  const unconfigured = await worker.fetch(request({ 'X-ToonLab-Demo-Code': env.DEMO_CODE }), {});
  assert.equal(unconfigured.status, 503);
});

test('client cannot send demo code and user key together', async () => {
  const response = await worker.fetch(request({
    Authorization: 'Bearer user-key',
    'X-ToonLab-Demo-Code': env.DEMO_CODE,
  }), env);
  assert.equal(response.status, 400);
});

test('chat requires one OpenRouter credential', async () => {
  const response = await worker.fetch(request(), env);
  assert.equal(response.status, 401);
});
