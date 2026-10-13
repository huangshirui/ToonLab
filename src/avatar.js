import { TalkingHead } from '../.talkinghead-runtime/talkinghead.mjs';
import { synthesizeSpeech } from './speech.js';
import { getCharacter } from './characters.js';
import { Live2DRenderer } from './live2d.js';

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
    this.live2d = null;
    this.live2dAudioCtx = null;
    this.live2dSpeechGain = null;
    this.ready = false;
    this.character = null;
    this.renderer = null;
    this.loadPromise = null;
  }

  ensureTalkingHead() {
    this.head ??= new TalkingHead(this.container, {
      cameraView: 'upper',
      lipsyncLang: 'en',
      lipsyncModules: [],
      mixerGainSpeech: SPEECH_GAIN,
    });
    return this.head;
  }

  ensureLive2D() {
    this.live2d ??= new Live2DRenderer(this.container);
    return this.live2d;
  }

  ensureLive2DAudio() {
    if (!this.live2dAudioCtx) {
      this.live2dAudioCtx = new AudioContext();
      this.live2dSpeechGain = this.live2dAudioCtx.createGain();
      this.live2dSpeechGain.gain.value = SPEECH_GAIN;
      this.live2dSpeechGain.connect(this.live2dAudioCtx.destination);
    }
    return this.live2dAudioCtx;
  }

  setRendererVisibility(renderer) {
    const talkingHeadCanvas = this.head?.renderer?.domElement;
    if (talkingHeadCanvas) talkingHeadCanvas.style.display = renderer === 'talkinghead' ? '' : 'none';
    this.live2d?.setVisible(renderer === 'live2d');
    if (renderer === 'talkinghead') {
      this.head?.start();
      this.live2d?.setActive(false);
    } else if (renderer === 'live2d') {
      this.head?.stop();
      this.live2d?.setActive(true);
    }
  }

  async loadCharacter(characterId = 'mpfb-demo', renderer = 'talkinghead') {
    const character = getCharacter(characterId);
    const preset = character?.assets?.[renderer];
    if (!character || !preset) throw new Error('This character and renderer combination is not available.');
    if (!['talkinghead', 'live2d'].includes(renderer)) throw new Error('This renderer is not available yet.');
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

    this.ready = false;
    this.character = characterId;
    this.renderer = renderer;
    this.onStatus('Loading character…');

    const currentCharacter = characterId;
    const currentRenderer = renderer;

    if (renderer === 'live2d') {
      const live2d = this.ensureLive2D();
      this.setRendererVisibility(renderer);
      this.loadPromise = live2d.load(preset).then(() => {
        if (this.character !== currentCharacter || this.renderer !== currentRenderer) return;
        this.ready = true;
        this.setRendererVisibility(renderer);
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

    const head = this.ensureTalkingHead();
    this.setRendererVisibility(renderer);
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
      this.setRendererVisibility(renderer);
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
    if ((this.renderer ?? 'talkinghead') === 'live2d') {
      const audioCtx = this.ensureLive2DAudio();
      if (audioCtx.state === 'suspended') await audioCtx.resume();
      return;
    }

    const head = this.ensureTalkingHead();
    if (head.audioCtx?.state === 'suspended') await head.audioCtx.resume();
  }

  playLive2DAudio(audio) {
    const audioCtx = this.ensureLive2DAudio();
    return new Promise((resolve, reject) => {
      try {
        const source = audioCtx.createBufferSource();
        source.buffer = audio;
        source.connect(this.live2dSpeechGain);
        source.onended = resolve;
        source.start();
      } catch (error) {
        reject(error);
      }
    });
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
      if (targetRenderer === 'live2d') {
        const audioCtx = this.ensureLive2DAudio();
        const data = await synthesizeSpeech(chunk, audioCtx, undefined, undefined, { voice });
        await this.live2d.playLipSync(data.azureVisemes, data.durationMs);
        const stopSubtitleTimeline = startSubtitleTimeline(data.subtitleCues, this.onSubtitle);
        try {
          await this.playLive2DAudio(data.audio);
        } finally {
          this.live2d.stopLipSync();
          stopSubtitleTimeline();
        }
        continue;
      }

      const head = this.ensureTalkingHead();
      const data = await synthesizeSpeech(chunk, head.audioCtx, undefined, undefined, { voice });
      head.speakAudio(data, { lipsyncLang: 'en', isRaw: true });
      const stopSubtitleTimeline = startSubtitleTimeline(data.subtitleCues, this.onSubtitle);
      try {
        await new Promise((resolve) => head.speakMarker(resolve));
      } finally {
        stopSubtitleTimeline();
      }
    }

    this.onSubtitle('');
  }

  pauseWhenHidden() {
    document.addEventListener('visibilitychange', () => {
      const visible = document.visibilityState === 'visible';
      if (this.head) {
        if (visible && this.renderer === 'talkinghead') this.head.start();
        else this.head.stop();
      }
      if (this.live2d) this.live2d.setActive(visible && this.renderer === 'live2d');
    });
  }
}
