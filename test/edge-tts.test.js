import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { collectSpeech, escapeXml, gec, parseFrame } from '../worker/edge-tts.js';
import worker from '../worker/index.js';
import { synthesizeSpeech } from '../src/speech.js';

class Socket extends EventTarget {
  sent = [];
  accept() {}
  send(message) { this.sent.push(message); }
  close() { this.closed = true; }
  emit(data) { const event = new Event('message'); event.data = data; this.dispatchEvent(event); }
}
const frame = (path, body = '') => `Path:${path}\r\n\r\n${body}`;
function audioFrame(bytes) {
  const header = new TextEncoder().encode('Path:audio\r\nContent-Type:audio/mpeg\r\n');
  const buffer = new Uint8Array(2 + header.length + bytes.length);
  new DataView(buffer.buffer).setUint16(0, header.length);
  buffer.set(header, 2); buffer.set(bytes, header.length + 2);
  return buffer.buffer;
}

test('GEC hashes a five-minute Windows epoch bucket without number precision loss', async () => {
  const now = 1770000000000;
  const seconds = BigInt(now / 1000) + 11644473600n;
  const ticks = (seconds - seconds % 300n) * 10000000n;
  const expected = createHash('sha256').update(`${ticks}6A5AA1D4EAFF4E9FB37E23D68491D6F4`).digest('hex').toUpperCase();
  assert.equal(await gec(now), expected);
  assert.equal(await gec(now + 1000), expected);
});

test('frames strip the two-byte length prefix and reject malformed frames', () => {
  assert.deepEqual([...parseFrame(audioFrame([1, 2, 3])).body], [1, 2, 3]);
  assert.equal(parseFrame(frame('turn.end')).path, 'turn.end');
  assert.throws(() => parseFrame(new Uint8Array([0, 99]).buffer));
  assert.throws(() => parseFrame('bad header'));
  assert.equal(escapeXml("<>&\u0000'\""), '&lt;&gt;&amp; &apos;&quot;');
});

test('speech collects audio and converts every WordBoundary to milliseconds', async () => {
  const socket = new Socket();
  const result = collectSpeech(socket, 'A & B', new AbortController().signal);
  assert.match(socket.sent[0], /"wordBoundaryEnabled":"true"/);
  assert.match(socket.sent[1], /A &amp; B/);
  socket.emit(audioFrame([1, 2, 3]));
  socket.emit(frame('audio.metadata', JSON.stringify({ Metadata: [
    { Type: 'WordBoundary', Data: { Offset: 1000000, Duration: 2000000, text: { Text: 'A' } } },
    { Type: 'WordBoundary', Data: { Offset: 3000000, Duration: 1000000, text: { Text: '&amp;' } } },
  ] })));
  socket.emit(frame('turn.end'));
  const data = await result;
  assert.deepEqual(data.words, ['A', '&']);
  assert.deepEqual(data.wtimes, [100, 300]);
  assert.deepEqual(data.wdurations, [200, 100]);
  assert.equal(data.audio, 'AQID');
  assert.ok(socket.closed);
});

test('missing timing, malformed metadata, disconnect, cancellation and timeout close sockets', async () => {
  for (const action of ['empty', 'invalid', 'close', 'abort', 'timeout']) {
    const socket = new Socket();
    const controller = new AbortController();
    const promise = collectSpeech(socket, 'test', controller.signal, 5);
    const rejected = assert.rejects(promise);
    if (action === 'empty') socket.emit(frame('turn.end'));
    if (action === 'invalid') socket.emit(frame('audio.metadata', '{'));
    if (action === 'close') socket.dispatchEvent(new Event('close'));
    if (action === 'abort') controller.abort();
    await rejected;
    assert.ok(socket.closed);
  }
});

test('/api/tts rejects invalid method, origin, text and actual oversized body', async () => {
  for (const [init, expected] of [
    [{ method: 'GET' }, 405],
    [{ method: 'POST', headers: { Origin: 'https://evil.example' }, body: '{}' }, 403],
    [{ method: 'POST', body: 'invalid' }, 400],
    [{ method: 'POST', body: '{}' }, 400],
    [{ method: 'POST', body: JSON.stringify({ text: 'a'.repeat(501) }) }, 400],
    [{ method: 'POST', body: 'a'.repeat(8193) }, 413],
  ]) {
    const response = await worker.fetch(new Request('https://toonlab.verinasci.com/api/tts', init), {});
    assert.equal(response.status, expected);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
  }
});

test('browser speech never sends an OpenRouter credential and decodes MP3', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.equal(url, '/api/tts');
    assert.deepEqual(init.headers, { 'Content-Type': 'application/json' });
    return Response.json({ audio: 'AQID', words: ['Hi'], wtimes: [100], wdurations: [200] });
  });
  const audio = {};
  const result = await synthesizeSpeech('Hi', { decodeAudioData: async bytes => {
    assert.deepEqual([...new Uint8Array(bytes)], [1, 2, 3]); return audio;
  } });
  assert.equal(result.audio, audio);
  assert.deepEqual(result.wtimes, [100]);
});

test('/api/tts returns speech and never forwards inbound credentials to Microsoft', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.equal(new URL(url).hostname, 'speech.platform.bing.com');
    assert.equal(init.headers.Authorization, undefined);
    const socket = new Socket();
    socket.send = function (message) {
      this.sent.push(message);
      if (this.sent.length === 2) queueMicrotask(() => {
        this.emit(audioFrame([1, 2]));
        this.emit(frame('audio.metadata', JSON.stringify({ Metadata: [{ Type: 'WordBoundary', Data: { Offset: 0, Duration: 1000000, text: { Text: 'Hello' } } }] })));
        this.emit(frame('turn.end'));
      });
    };
    return { webSocket: socket };
  });
  const response = await worker.fetch(new Request('https://preview.example/api/tts', {
    method: 'POST', headers: { Origin: 'https://preview.example', Authorization: 'Bearer private-test-key' }, body: JSON.stringify({ text: 'Hello' }),
  }), {});
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.deepEqual(data.words, ['Hello']);
  assert.ok(!JSON.stringify(data).includes('private-test-key'));
});

test('/api/tts hides upstream errors and never returns partial speech', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('internal upstream details'); });
  const response = await worker.fetch(new Request('https://toonlab.verinasci.com/api/tts', {
    method: 'POST', body: JSON.stringify({ text: 'Hello' }),
  }), {});
  assert.equal(response.status, 502);
  assert.ok(!(await response.text()).includes('internal upstream details'));
});
