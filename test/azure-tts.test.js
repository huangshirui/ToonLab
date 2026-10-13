import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.js';
import { synthesizeSpeech } from '../src/speech.js';
import { toTalkingHeadVisemes } from '../src/visemes.js';
const env = { AZURE_SPEECH_KEY: 'resource-secret', AZURE_SPEECH_REGION: 'eastasia' };
const request = (init = {}) => new Request('https://toonlab.verinasci.com/api/tts/token', { method: 'POST', ...init });

test('token route validates method, origin and missing resource configuration', async () => {
  for (const [req, config, status] of [
    [request({ method: 'GET' }), env, 405],
    [request({ headers: { Origin: 'https://evil.example' } }), env, 403],
    [request(), {}, 503],
    [request(), { ...env, AZURE_SPEECH_REGION: 'evil.example/path' }, 503],
  ]) {
    const response = await worker.fetch(req, config);
    assert.equal(response.status, status);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
  }
});

test('token exchange uses only resource key and does not expose key or OpenRouter credential', async t => {
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.equal(url, 'https://eastasia.api.cognitive.microsoft.com/sts/v1.0/issueToken');
    assert.equal(init.method, 'POST');
    assert.equal(init.headers['Ocp-Apim-Subscription-Key'], env.AZURE_SPEECH_KEY);
    assert.equal(init.headers.Authorization, undefined);
    return new Response('short-lived-token');
  });
  const response = await worker.fetch(request({ headers: { Authorization: 'Bearer user-openrouter-key' } }), env);
  const data = await response.json();
  assert.equal(data.token, 'short-lived-token');
  assert.equal(data.voice, 'en-US-AriaNeural');
  assert.ok(!JSON.stringify(data).includes(env.AZURE_SPEECH_KEY));
  assert.ok(!JSON.stringify(data).includes('user-openrouter-key'));
});

test('upstream rejection, empty token and network errors return safe errors', async t => {
  for (const mode of ['reject', 'empty', 'throw']) {
    t.mock.method(globalThis, 'fetch', async () => {
      if (mode === 'throw') throw new Error('sensitive-upstream-error');
      return new Response(mode === 'empty' ? '' : 'sensitive-upstream-error', { status: mode === 'reject' ? 401 : 200 });
    });
    const response = await worker.fetch(request(), env);
    assert.equal(response.status, 502);
    assert.ok(!(await response.text()).includes('sensitive-upstream-error'));
    t.mock.restoreAll();
  }
});

test('native viseme timing maps closed lips, rounding and silence without guessed word timings', () => {
  assert.deepEqual(toTalkingHeadVisemes([
    { id: 0, time: 0 }, { id: 21, time: 100 }, { id: 7, time: 200 }, { id: 0, time: 350 },
  ], 500), { visemes: ['PP', 'U'], vtimes: [100, 200], vdurations: [100, 150] });
  assert.throws(() => toTalkingHeadVisemes([], 500));
  assert.throws(() => toTalkingHeadVisemes([{ id: 22, time: 0 }], 500));
  assert.throws(() => toTalkingHeadVisemes([{ id: 21, time: 100 }, { id: 7, time: 50 }], 500));
});

function mockSdk(mode = 'success') {
  const state = { closed: 0 };
  return {
    state,
    SpeechConfig: { fromAuthorizationToken(token, region) {
      assert.equal(token, 'token'); assert.equal(region, 'eastasia'); return state.config = {};
    } },
    SpeechSynthesisOutputFormat: { Riff24Khz16BitMonoPcm: 1 },
    ResultReason: { SynthesizingAudioCompleted: 1 },
    SpeechSynthesizer: class {
      constructor(config, output) { assert.equal(output, null); }
      close() { state.closed++; }
      speakTextAsync(text, success, failure) {
        if (mode === 'timeout') return;
        if (mode === 'throw') throw new Error('secret');
        if (mode === 'failure') return failure('secret');
        if (mode !== 'no-visemes') {
          this.visemeReceived(null, { visemeId: 21, audioOffset: 1000000 });
          this.visemeReceived(null, { visemeId: 7, audioOffset: 2000000 });
          this.visemeReceived(null, { visemeId: 0, audioOffset: 3500000 });
        }
        success({ reason: mode === 'cancel' ? 2 : 1, audioData: new Uint8Array([1, 2]).buffer });
      }
    },
  };
}
function tokenMock(t) {
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.equal(url, '/api/tts/token');
    assert.equal(init.headers, undefined);
    assert.equal(init.body, undefined);
    return Response.json({ token: 'token', region: 'eastasia', voice: 'en-US-AriaNeural' });
  });
}
test('SDK buffers audio once, converts native offsets and closes before TalkingHead playback', async t => {
  tokenMock(t);
  const sdk = mockSdk();
  const audio = { duration: 0.5 };
  const data = await synthesizeSpeech('Hello', { decodeAudioData: async () => audio }, sdk);
  assert.equal(sdk.state.config.speechSynthesisVoiceName, 'en-US-AriaNeural');
  assert.equal(sdk.state.closed, 1);
  assert.equal(data.audio, audio);
  assert.deepEqual(data.vtimes, [100, 200]);
  assert.deepEqual(data.visemes, ['PP', 'U']);
  assert.deepEqual(data.words, []);
});

test('selected voice overrides the Worker default without exposing Azure secrets', async t => {
  tokenMock(t);
  const sdk = mockSdk();
  await synthesizeSpeech(
    'Hello',
    { decodeAudioData: async () => ({ duration: 0.5 }) },
    sdk,
    30_000,
    { voice: 'en-US-GuyNeural' },
  );
  assert.equal(sdk.state.config.speechSynthesisVoiceName, 'en-US-GuyNeural');
});

test('SDK failures, cancellation, missing visemes and timeout fail rather than silently infer mouth shapes', async t => {
  tokenMock(t);
  for (const mode of ['failure', 'throw', 'cancel', 'timeout', 'no-visemes']) {
    const sdk = mockSdk(mode);
    await assert.rejects(synthesizeSpeech('Hello', { decodeAudioData: async () => ({ duration: 0.5 }) }, sdk, 5));
    assert.equal(sdk.state.closed, 1);
  }
});

test('actual TalkingHead speakAudio schedules supplied native visemes', async () => {
  const { TalkingHead } = await import('@met4citizen/talkinghead');
  const head = { speechQueue: [], startSpeaking() {} };
  TalkingHead.prototype.speakAudio.call(head, {
    audio: {}, words: [], wtimes: [], wdurations: [],
    visemes: ['PP', 'U'], vtimes: [100, 200], vdurations: [100, 150],
  }, { lipsyncLang: 'en', isRaw: true });
  assert.equal(head.speechQueue.length, 1);
  assert.equal(head.speechQueue[0].anim.length, 2);
  assert.ok(head.speechQueue[0].anim[0].vs.viseme_PP);
  assert.ok(head.speechQueue[0].anim[1].vs.viseme_U);
});
