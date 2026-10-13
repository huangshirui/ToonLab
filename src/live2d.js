const FRAME_SRC = '/live2d-frame.html';
const REQUEST_TIMEOUT_MS = 20_000;

export class Live2DRenderer {
  constructor(container) {
    this.container = container;
    this.frame = null;
    this.port = null;
    this.readyPromise = null;
    this.requestId = 0;
    this.pending = new Map();
  }

  ensureFrame() {
    if (this.readyPromise) return this.readyPromise;

    const frame = document.createElement('iframe');
    frame.src = FRAME_SRC;
    frame.title = 'Live2D character';
    frame.className = 'live2d-frame';
    frame.setAttribute('sandbox', 'allow-scripts');
    frame.setAttribute('aria-hidden', 'true');
    frame.referrerPolicy = 'no-referrer';
    Object.assign(frame.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      border: '0',
      background: 'transparent',
      display: 'none',
    });
    this.container.append(frame);
    this.frame = frame;

    this.readyPromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Live2D renderer timed out while starting.')), REQUEST_TIMEOUT_MS);

      frame.addEventListener('load', () => {
        const channel = new MessageChannel();
        this.port = channel.port1;
        this.port.onmessage = (event) => this.handleMessage(event.data);
        this.port.start();

        const onReady = (message) => {
          if (message?.type !== 'ready') return;
          this.port.removeEventListener('message', onReady);
          clearTimeout(timer);
          resolve();
        };
        this.port.addEventListener('message', onReady);
        frame.contentWindow.postMessage({ type: 'toonlab-live2d-connect' }, '*', [channel.port2]);
      }, { once: true });
    }).catch((error) => {
      this.readyPromise = null;
      throw error;
    });

    return this.readyPromise;
  }

  handleMessage(message) {
    if (!message?.replyTo) return;
    const pending = this.pending.get(message.replyTo);
    if (!pending) return;
    this.pending.delete(message.replyTo);
    clearTimeout(pending.timer);
    if (message.ok) pending.resolve(message.value);
    else pending.reject(new Error(message.error || 'Live2D renderer failed.'));
  }

  async request(type, payload = {}) {
    await this.ensureFrame();
    const id = `l2d-${++this.requestId}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Live2D ${type} timed out.`));
      }, REQUEST_TIMEOUT_MS);
      this.pending.set(id, { resolve, reject, timer });
      this.port.postMessage({ id, type, ...payload });
    });
  }

  async load(preset) {
    await this.request('load', {
      modelUrl: preset.url,
      mouthParameter: preset.mouthParameter,
      scale: preset.scale,
      y: preset.y,
    });
  }

  async playLipSync(events, durationMs) {
    await this.request('lipSync', { events, durationMs });
  }

  stopLipSync() {
    if (this.port) this.port.postMessage({ type: 'stopLipSync' });
  }

  setVisible(visible) {
    if (!this.frame) return;
    this.frame.style.display = visible ? 'block' : 'none';
    this.frame.setAttribute('aria-hidden', String(!visible));
  }

  setActive(active) {
    if (this.port) this.port.postMessage({ type: active ? 'resume' : 'pause' });
  }
}
