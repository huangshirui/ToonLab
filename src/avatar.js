import { TalkingHead } from '@met4citizen/talkinghead';
import { synthesizeSpeech } from './speech.js';
import { getCharacter } from './characters.js';

const MAX_TTS_CHUNK = 460;
const SPEECH_GAIN = 1.8;

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

function startSubtitleTimeline(cues, onSubtitle) {
  if (!cues?.length) return () => {};

  const timers = [];
  onSubtitle(cues[0].text);
  for (let index = 1; index < cues.length; index++) {
    const cue = cues[index];
    timers.push(setTimeout(() => onSubtitle(cue.text), Math.max(0, cue.time)));
  }
  return () => timers.forEach(clearTimeout);
}

export class AvatarController {
  constructor({ container, onStatus, onSubtitle }) {
    this.container = container;
    this.onStatus = onStatus;
    this.onSubtitle = onSubtitle;
    this.head = null;
    this.ready = false;
    this.character = null;
    this.renderer = null;
    this.loadPromise = null;
  }

  ensureEngine(renderer = 'talkinghead') {
    if (renderer !== 'talkinghead') {
      throw new Error('This renderer is not available yet.');
    }
    this.head ??= new TalkingHead(this.container, {
      cameraView: 'upper',
      lipsyncLang: 'en',
      lipsyncModules: [],
      mixerGainSpeech: SPEECH_GAIN,
    });
    return this.head;
  }

  async loadCharacter(characterId = 'mpfb-demo', renderer = 'talkinghead') {
    const character = getCharacter(characterId);
    const preset = character?.assets?.[renderer];
    if (!character || !preset) throw new Error('This character and renderer combination is not available.');
    if (this.ready && this.character === characterId && this.renderer === renderer) return;
    if (this.loadPromise && this.character === characterId && this.renderer === renderer) return this.loadPromise;

    if (this.loadPromise) {
      try {
        await this.loadPromise;
      } catch {
        // A failed previous load should not block a new selection.
      }
      if (this.ready && this.character === characterId && this.renderer === renderer) return;
    }

    const head = this.ensureEngine(renderer);
    this.ready = false;
    this.character = characterId;
    this.renderer = renderer;
    this.onStatus('Loading character…');

    const currentCharacter = characterId;
    const currentRenderer = renderer;
    this.loadPromise = head.showAvatar(
      {
        ...preset,
        lipsyncLang: 'en',
      },
      (event) => {
        if (this.character !== currentCharacter || this.renderer !== currentRenderer) return;
        const progress = progressValue(event);
        this.onStatus(progress ? `Loading character ${progress}` : 'Loading character…');
      },
    ).then(() => {
      if (this.character !== currentCharacter || this.renderer !== currentRenderer) return;
      this.ready = true;
      this.onStatus('Ready');
    }).catch((error) => {
      if (this.character === currentCharacter && this.renderer === currentRenderer) {
        this.ready = false;
        this.onStatus('Character unavailable');
      }
      throw error;
    }).finally(() => {
      if (this.character === currentCharacter && this.renderer === currentRenderer) this.loadPromise = null;
    });

    return this.loadPromise;
  }

  async initialize(character = 'mpfb-demo', renderer = 'talkinghead') {
    return this.loadCharacter(character, renderer);
  }

  async activateAudio() {
    const head = this.ensureEngine(this.renderer ?? 'talkinghead');
    if (head.audioCtx?.state === 'suspended') await head.audioCtx.resume();
  }

  async speak(text, { voice, character, renderer } = {}) {
    const targetCharacter = character ?? this.character ?? 'mpfb-demo';
    const targetRenderer = renderer ?? this.renderer ?? 'talkinghead';
    if (!this.ready || this.character !== targetCharacter || this.renderer !== targetRenderer) {
      await this.loadCharacter(targetCharacter, targetRenderer);
    }
    await this.activateAudio();

    const chunks = chunkForSpeech(text);
    for (const chunk of chunks) {
      const data = await synthesizeSpeech(chunk, this.head.audioCtx, undefined, undefined, { voice });
      this.head.speakAudio(data, { lipsyncLang: 'en', isRaw: true });
      const stopSubtitleTimeline = startSubtitleTimeline(data.subtitleCues, this.onSubtitle);
      try {
        await new Promise((resolve) => this.head.speakMarker(resolve));
      } finally {
        stopSubtitleTimeline();
      }
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
