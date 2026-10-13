import { TalkingHead } from '@met4citizen/talkinghead';
import { synthesizeSpeech } from './speech.js';

const AVATAR_URL = '/avatars/demo/avatar.gltf';

const MAX_TTS_CHUNK = 460;

function chunkForSpeech(text) {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  if (clean.length <= MAX_TTS_CHUNK) return [clean];

  const sentences = clean.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [clean];
  const chunks = [];
  let current = '';

  for (const sentence of sentences) {
    const candidate = `${current} ${sentence}`.trim();
    if (candidate.length <= MAX_TTS_CHUNK) {
      current = candidate;
      continue;
    }

    if (current) chunks.push(current);
    current = sentence.trim();

    while (current.length > MAX_TTS_CHUNK) {
      let cut = current.lastIndexOf(' ', MAX_TTS_CHUNK);
      if (cut < MAX_TTS_CHUNK * 0.6) cut = MAX_TTS_CHUNK;
      chunks.push(current.slice(0, cut).trim());
      current = current.slice(cut).trim();
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

function progressValue(event) {
  if (event?.lengthComputable && event.total > 0) {
    return `${Math.min(100, Math.round((event.loaded / event.total) * 100))}%`;
  }
  if (Number.isFinite(event?.loaded) && event.loaded > 0) {
    return `${Math.round(event.loaded / 1000)}KB`;
  }
  return '…';
}

export class AvatarController {
  constructor({ container, onStatus, onSubtitle }) {
    this.container = container;
    this.onStatus = onStatus;
    this.onSubtitle = onSubtitle;
    this.head = null;
    this.ready = false;
  }

  async initialize() {
    if (this.ready) return;

    this.onStatus('Starting character engine…');
    this.head ??= new TalkingHead(this.container, {
      cameraView: 'upper',
      lipsyncLang: 'en',
      lipsyncModules: [],
    });
    // Resume audio while still inside the user's Start gesture. Browsers may
    // otherwise block playback after asynchronous model loading finishes.
    if (this.head.audioCtx?.state === 'suspended') {
      await this.head.audioCtx.resume();
    }

    await this.head.showAvatar(
      {
        url: AVATAR_URL,
        body: 'F',
        avatarMood: 'neutral',
        lipsyncLang: 'en',
      },
      (event) => {
        this.onStatus(`Loading character ${progressValue(event)}`);
      },
    );

    this.ready = true;
    this.onStatus('Ready');
  }

  async speak(text) {
    if (!this.ready) await this.initialize();
    if (this.head.audioCtx?.state === 'suspended') {
      await this.head.audioCtx.resume();
    }

    const chunks = chunkForSpeech(text);
    for (const chunk of chunks) {
      this.onSubtitle(chunk);
      const data = await synthesizeSpeech(chunk, this.head.audioCtx);
      this.head.speakAudio(data, { lipsyncLang: 'en', isRaw: true });

      await new Promise((resolve) => this.head.speakMarker(resolve));
    }

    this.onSubtitle('');
  }

  pauseWhenHidden() {
    document.addEventListener('visibilitychange', () => {
      if (!this.head) return;
      if (document.visibilityState === 'visible') this.head.start();
      else this.head.stop();
    });
  }
}
