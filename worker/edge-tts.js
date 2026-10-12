// Edge Read Aloud protocol, checked against rany2/edge-tts (LGPL-3.0).
// Independent implementation; this consumer endpoint is not Azure Speech.
const TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const VERSION = '143.0.3650.75';
export const VOICE = 'en-US-AriaNeural';
export const MAX_TEXT_LENGTH = 500;
const MAX_AUDIO_BYTES = 2_000_000;
const decoder = new TextDecoder();

export async function gec(now = Date.now()) {
  const seconds = BigInt(Math.floor(now / 1000)) + 11644473600n;
  const ticks = (seconds - seconds % 300n) * 10000000n;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${ticks}${TOKEN}`));
  return Array.from(new Uint8Array(digest), x => x.toString(16).padStart(2, '0')).join('').toUpperCase();
}

export function escapeXml(text) {
  return text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ' ')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function unescapeXml(text) {
  return text.replace(/&(amp|lt|gt|quot|apos);/g, (_, name) => ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" })[name]);
}

export function parseFrame(data) {
  const binary = typeof data !== 'string';
  const bytes = binary ? new Uint8Array(data) : null;
  if (binary && bytes.length < 2) throw new Error('Invalid speech frame.');
  const length = binary ? new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint16(0) : data.indexOf('\r\n\r\n');
  if (length < 0 || (binary && length + 2 > bytes.length)) throw new Error('Invalid speech frame.');
  const header = binary ? decoder.decode(bytes.subarray(2, 2 + length)) : data.slice(0, length);
  const headers = Object.fromEntries(header.split('\r\n').filter(Boolean).map(line => {
    const i = line.indexOf(':');
    if (i < 0) throw new Error('Invalid speech headers.');
    return [line.slice(0, i).toLowerCase(), line.slice(i + 1).trim()];
  }));
  return { path: headers.path, body: binary ? bytes.slice(2 + length) : data.slice(length + 4) };
}

export function collectSpeech(socket, text, signal, timeoutMs = 30_000) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const words = [], wtimes = [], wdurations = [];
    let size = 0, settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      socket.removeEventListener('message', message);
      socket.removeEventListener('close', closed);
      socket.removeEventListener('error', closed);
      try { socket.close(1000, 'Done'); } catch { /* Already closed. */ }
      if (error) return reject(error);
      if (!size || !words.length) return reject(new Error('Speech returned no audio or word timings.'));
      const audio = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) { audio.set(chunk, offset); offset += chunk.length; }
      // Small, bounded chunks keep memory use manageable. No speech is cached.
      let binary = '';
      for (let i = 0; i < audio.length; i += 8192) binary += String.fromCharCode(...audio.subarray(i, i + 8192));
      resolve({ audio: btoa(binary), words, wtimes, wdurations, voice: VOICE, encoding: 'mp3' });
    };
    const abort = () => finish(new Error('Speech request cancelled.'));
    const closed = () => finish(new Error('Speech connection closed before completion.'));
    const message = (event) => {
      try {
        const frame = parseFrame(event.data);
        if (frame.path === 'audio' && frame.body instanceof Uint8Array) {
          size += frame.body.length;
          if (size > MAX_AUDIO_BYTES) throw new Error('Speech audio is too large.');
          chunks.push(frame.body);
        } else if (frame.path === 'audio.metadata') {
          for (const item of JSON.parse(frame.body).Metadata ?? []) {
            if (item.Type !== 'WordBoundary') continue;
            const { Offset, Duration, text: word } = item.Data;
            if (!Number.isFinite(Offset) || Offset < 0 || !Number.isFinite(Duration) || Duration <= 0 || typeof word?.Text !== 'string') {
              throw new Error('Invalid speech timing.');
            }
            if (words.length >= 2000) throw new Error('Too many speech timings.');
            words.push(unescapeXml(word.Text));
            wtimes.push(Offset / 10000); // Microsoft's 100ns ticks → milliseconds.
            wdurations.push(Duration / 10000);
          }
        } else if (frame.path === 'turn.end') finish();
      } catch { finish(new Error('Invalid speech response.')); }
    };
    const timer = setTimeout(() => finish(new Error('Speech timed out.')), timeoutMs);
    socket.addEventListener('message', message);
    socket.addEventListener('close', closed);
    socket.addEventListener('error', closed);
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) { abort(); return; }
    try {
      socket.accept();
      const timestamp = new Date().toString();
      socket.send(`X-Timestamp:${timestamp}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n${JSON.stringify({ context: { synthesis: { audio: { metadataoptions: { sentenceBoundaryEnabled: 'false', wordBoundaryEnabled: 'true' }, outputFormat: 'audio-24khz-48kbitrate-mono-mp3' } } } })}\r\n`);
      const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'><voice name='${VOICE}'><prosody pitch='+0Hz' rate='+0%' volume='+0%'>${escapeXml(text)}</prosody></voice></speak>`;
      socket.send(`X-RequestId:${crypto.randomUUID().replaceAll('-', '')}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${timestamp}Z\r\nPath:ssml\r\n\r\n${ssml}`);
    } catch { finish(new Error('Could not start speech.')); }
  });
}

export async function synthesize(text, signal) {
  const url = new URL('https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1');
  url.search = new URLSearchParams({ TrustedClientToken: TOKEN, ConnectionId: crypto.randomUUID().replaceAll('-', ''), 'Sec-MS-GEC': await gec(), 'Sec-MS-GEC-Version': `1-${VERSION}` }).toString();
  const response = await fetch(url, {
    headers: { Upgrade: 'websocket', Origin: 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold', 'User-Agent': `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0`, Cookie: `muid=${crypto.randomUUID().replaceAll('-', '').toUpperCase()};` },
    signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
  });
  if (!response.webSocket) {
    await response.body?.cancel();
    throw new Error('Microsoft speech service is unavailable.');
  }
  return collectSpeech(response.webSocket, text, signal);
}
