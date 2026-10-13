import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';
import { toTalkingHeadVisemes } from './visemes.js';

export async function synthesizeSpeech(text, audioCtx, sdk = SpeechSDK, timeoutMs = 30_000, { voice } = {}) {
  if (!text.trim() || text.length > 500) throw new Error('Speech text must contain 1–500 characters.');
  // No OpenRouter credential on this route. Azure resource key stays in Worker.
  const response = await fetch('/api/tts/token', {
    method: 'POST', signal: AbortSignal.timeout(15_000),
  });
  const credentials = await response.json();
  if (!response.ok) throw new Error(credentials.error ?? 'Azure Speech authorization failed.');
  const config = sdk.SpeechConfig.fromAuthorizationToken(credentials.token, credentials.region);
  config.speechSynthesisVoiceName = voice || credentials.voice;
  config.speechSynthesisOutputFormat = sdk.SpeechSynthesisOutputFormat.Riff24Khz16BitMonoPcm;
  // null output disables SDK speaker playback: TalkingHead owns audio playback.
  const synthesizer = new sdk.SpeechSynthesizer(config, null);
  const events = [];
  synthesizer.visemeReceived = (_, event) => {
    events.push({ id: event.visemeId, time: event.audioOffset / 10000 });
  };
  const result = await new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { synthesizer.close(); } catch { /* Already closed. */ }
      if (error) reject(error); else resolve(value);
    };
    const timer = setTimeout(() => finish(new Error('Azure speech synthesis timed out.')), timeoutMs);
    try {
      synthesizer.speakTextAsync(text, value => {
        if (value.reason !== sdk.ResultReason.SynthesizingAudioCompleted || !value.audioData?.byteLength) {
          finish(new Error('Azure speech synthesis failed. Check the resource quota and voice.'));
        } else if (value.audioData.byteLength > 2_000_000) {
          finish(new Error('Azure speech audio is too large.'));
        } else finish(null, value);
      }, () => finish(new Error('Azure speech synthesis failed. Please try again.')));
    } catch { finish(new Error('Could not start Azure speech synthesis.')); }
  });
  const audio = await audioCtx.decodeAudioData(result.audioData.slice(0));
  // TalkingHead 1.7 gates the native viseme path on the presence of words.
  // Empty arrays enable it without invoking word-to-viseme inference.
  return { audio, words: [], wtimes: [], wdurations: [], ...toTalkingHeadVisemes(events, audio.duration * 1000) };
}
