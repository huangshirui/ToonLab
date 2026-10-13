import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';
import { toTalkingHeadVisemes } from './visemes.js';

const SUBTITLE_MAX_CHARS = 72;

function splitSubtitleText(text, maxChars = SUBTITLE_MAX_CHARS) {
  const words = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  if (!words.length) return [];

  const segments = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars || !current) {
      current = candidate;
    } else {
      segments.push(current);
      current = word;
    }
  }
  if (current) segments.push(current);
  return segments;
}

export function buildSubtitleCues(text, boundaries = [], durationMs = 0, maxChars = SUBTITLE_MAX_CHARS) {
  const cleanText = text.replace(/\s+/g, ' ').trim();
  if (!cleanText) return [];

  const validBoundaries = boundaries
    .filter((item) => Number.isFinite(item?.time) && Number.isFinite(item?.textOffset))
    .sort((a, b) => a.textOffset - b.textOffset);

  if (validBoundaries.length) {
    const cues = [];
    let segmentStart = 0;
    let segmentTime = Math.max(0, validBoundaries[0].time);

    for (let index = 1; index < validBoundaries.length; index++) {
      const boundary = validBoundaries[index];
      if (boundary.textOffset - segmentStart < maxChars) continue;

      const cueText = cleanText.slice(segmentStart, boundary.textOffset).trim();
      if (cueText) cues.push({ time: segmentTime, text: cueText });
      segmentStart = boundary.textOffset;
      segmentTime = Math.max(0, boundary.time);
    }

    const finalText = cleanText.slice(segmentStart).trim();
    if (finalText) cues.push({ time: segmentTime, text: finalText });
    if (cues.length) return cues;
  }

  const segments = splitSubtitleText(cleanText, maxChars);
  if (segments.length <= 1 || durationMs <= 0) {
    return segments.map((segment) => ({ time: 0, text: segment }));
  }

  const totalChars = segments.reduce((sum, segment) => sum + segment.length, 0);
  let elapsedChars = 0;
  return segments.map((segment) => {
    const cue = {
      time: Math.round((elapsedChars / totalChars) * durationMs),
      text: segment,
    };
    elapsedChars += segment.length;
    return cue;
  });
}

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
  // null output disables SDK speaker playback: the active avatar renderer owns audio playback.
  const synthesizer = new sdk.SpeechSynthesizer(config, null);
  const events = [];
  const wordBoundaries = [];
  synthesizer.visemeReceived = (_, event) => {
    events.push({ id: event.visemeId, time: event.audioOffset / 10000 });
  };
  synthesizer.wordBoundary = (_, event) => {
    wordBoundaries.push({
      time: event.audioOffset / 10000,
      textOffset: event.textOffset,
      wordLength: event.wordLength,
    });
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
  const durationMs = audio.duration * 1000;
  // TalkingHead 1.7 gates the native viseme path on the presence of words.
  // Empty arrays enable it without invoking word-to-viseme inference.
  return {
    audio,
    durationMs,
    azureVisemes: events.map(({ id, time }) => ({ id, time })),
    words: [],
    wtimes: [],
    wdurations: [],
    subtitleCues: buildSubtitleCues(text, wordBoundaries, durationMs),
    ...toTalkingHeadVisemes(events, durationMs),
  };
}
