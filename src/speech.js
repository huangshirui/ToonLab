export async function synthesizeSpeech(text, audioCtx) {
  // Deliberately no OpenRouter Authorization header on the speech route.
  const response = await fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
    signal: AbortSignal.timeout(45_000),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? 'Microsoft speech synthesis failed.');
  const bytes = Uint8Array.from(atob(data.audio), character => character.charCodeAt(0));
  const audio = await audioCtx.decodeAudioData(bytes.buffer);
  return { audio, words: data.words, wtimes: data.wtimes, wdurations: data.wdurations };
}
