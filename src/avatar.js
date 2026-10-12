import { HeadTTS } from '@met4citizen/headtts';
import { TalkingHead } from '@met4citizen/talkinghead';

const AVATAR_URL =
  'https://models.readyplayer.me/64bfa15f0e72c63d7c3934a6.glb' +
  '?morphTargets=ARKit,Oculus+Visemes,mouthOpen,mouthSmile,eyesClosed,eyesLookUp,eyesLookDown' +
  '&textureSizeLimit=1024&textureFormat=png';

const HEADTTS_CDN = 'https://cdn.jsdelivr.net/npm/@met4citizen/headtts@1.3';
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
    this.tts = null;
    this.ready = false;
  }

  async initialize() {
    if (this.ready) return;

    this.onStatus('Starting character engine…');
    this.head = new TalkingHead(this.container, {
      cameraView: 'upper',
      lipsyncLang: 'en',
    });

    // Resume audio while still inside the user's Start gesture. Browsers may
    // otherwise block playback after asynchronous model loading finishes.
    if (this.head.audioCtx?.state === 'suspended') {
      await this.head.audioCtx.resume();
    }

    this.tts = new HeadTTS({
      endpoints: ['webgpu', 'wasm'],
      languages: ['en-us'],
      voices: ['af_bella'],
      audioCtx: this.head.audioCtx,
      // HeadTTS explicitly supports these pinned CDN URLs for its isolated
      // module worker/dictionary resources. The page-owned client code itself
      // remains bundled with ToonLab and is not injected from a runtime CDN.
      workerModule: `${HEADTTS_CDN}/modules/worker-tts.mjs`,
      dictionaryURL: `${HEADTTS_CDN}/dictionaries/`,
    });

    const loading = { character: '…', voice: '…' };
    const renderLoading = () => {
      this.onStatus(`Loading character ${loading.character} · voice ${loading.voice}`);
    };
    renderLoading();

    await Promise.all([
      this.head.showAvatar(
        {
          url: AVATAR_URL,
          body: 'F',
          avatarMood: 'neutral',
          lipsyncLang: 'en',
        },
        (event) => {
          loading.character = progressValue(event);
          renderLoading();
        },
      ),
      this.tts.connect(null, (event) => {
        loading.voice = progressValue(event);
        renderLoading();
      }),
    ]);

    await this.tts.setup({
      voice: 'af_bella',
      language: 'en-us',
      speed: 1,
      audioEncoding: 'wav',
    });

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
      const messages = await this.tts.synthesize({ input: chunk });
      const errorMessage = messages.find((message) => message.type === 'error');
      if (errorMessage) {
        throw new Error(errorMessage.data?.error ?? 'Speech synthesis failed.');
      }

      const audioMessages = messages.filter((message) => message.type === 'audio');
      if (!audioMessages.length) {
        throw new Error('Speech synthesis returned no audio.');
      }

      for (const message of audioMessages) {
        this.head.speakAudio(message.data, {}, (word) => {
          if (word) this.onSubtitle(word);
        });
      }

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
