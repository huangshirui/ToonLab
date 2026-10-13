import { TalkingHead } from '@met4citizen/talkinghead';
import { synthesizeSpeech } from './speech.js';

const CHARACTER_PRESETS = {
  'mpfb-demo': {
    url: '/avatars/demo/avatar.gltf',
    body: 'F',
  },
};
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
  return '';
}

export class AvatarController {
  constructor({ container, onStatus, onSubtitle }) {
    this.container = container;
    this.onStatus = onStatus;
    this.onSubtitle = onSubtitle;
    this.head = null;
    this.ready = false;
    this.character = null;
    this.loadPromise = null;
  }

  ensureEngine() {
    this.head ??= new TalkingHead(this.container, {
      cameraView: 'upper',
      lipsyncLang: 'en',
      lipsyncModules: [],
    });
    return this.head;
  }

  async loadCharacter(character = 'mpfb-demo') {
    const preset = CHARACTER_PRESETS[character];
    if (!preset) throw new Error('This character is not available.');
    if (this.ready && this.character === character) return;
    if (this.loadPromise && this.character === character) return this.loadPromise;

    if (this.loadPromise) {
      try {
        await this.loadPromise;
      } catch {
        // A failed previous load should not block a new selection.
      }
      if (this.ready && this.character === character) return;
    }

    const head = this.ensureEngine();
    this.ready = false;
    this.character = character;
    this.onStatus('Loading character…');

    const currentCharacter = character;
    this.loadPromise = head.showAvatar(
      {
        url: preset.url,
        body: preset.body,
        avatarMood: 'neutral',
        lipsyncLang: 'en',
      },
      (event) => {
        if (this.character !== currentCharacter) return;
        const progress = progressValue(event);
        this.onStatus(progress ? `Loading character ${progress}` : 'Loading character…');
      },
    ).then(() => {
      if (this.character !== currentCharacter) return;
      this.ready = true;
      this.onStatus('Ready');
    }).catch((error) => {
      if (this.character === currentCharacter) {
        this.ready = false;
        this.onStatus('Character unavailable');
      }
      throw error;
    }).finally(() => {
      if (this.character === currentCharacter) this.loadPromise = null;
    });

    return this.loadPromise;
  }

  async initialize(character = 'mpfb-demo') {
    return this.loadCharacter(character);
  }

  async activateAudio() {
    const head = this.ensureEngine();
    if (head.audioCtx?.state === 'suspended') await head.audioCtx.resume();
  }

  async speak(text, { voice, character } = {}) {
    const targetCharacter = character ?? this.character ?? 'mpfb-demo';
    if (!this.ready || this.character !== targetCharacter) await this.loadCharacter(targetCharacter);
    await this.activateAudio();

    const chunks = chunkForSpeech(text);
    for (const chunk of chunks) {
      this.onSubtitle(chunk);
      const data = await synthesizeSpeech(chunk, this.head.audioCtx, undefined, undefined, { voice });
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
