# ToonLab

**AI-driven character animation experiments · AI 驱动的动画角色实验**

Production target: **https://toonlab.verinasci.com**

## P0 experiment / 首版链路

1. Click **Start ToonLab** to unlock browser audio and load the 3D character.
2. Microsoft Edge Read Aloud generates a fixed introduction; no TTS or LLM key is needed.
3. Save an OpenRouter key in this browser, then enter a prompt.
4. `/api/chat` forwards the prompt to OpenRouter and returns English text.
5. `/api/tts` returns Microsoft MP3 audio and word boundary timings.
6. TalkingHead plays the decoded audio and derives English visemes from timed words.

首版改用微软 **Edge Read Aloud 在线语音**，默认 `en-US-AriaNeural`。无需 Azure Key、HeadTTS / Kokoro 模型下载或 WebGPU 推理。角色渲染、音频播放和口型计算仍在浏览器运行。

## Speech architecture / 语音架构

Browser → same-origin `POST /api/tts` → Cloudflare Worker → Microsoft WebSocket

The Worker collects one short utterance and returns MP3 + `words`, `wtimes`, `wdurations`. Microsoft timing units (100 ns) are converted to milliseconds. The browser decodes MP3 into an AudioBuffer and calls TalkingHead `speakAudio`. The English lip-sync processor is bundled with the frontend, avoiding unresolved runtime imports after Vite builds.

- Browser chunks long text into at most 460 characters; the endpoint accepts at most 500.
- Worker bounds the actual request body at 8 KB and audio at 2 MB.
- Upstream connection timeout: 10 seconds; synthesis timeout: 30 seconds; browser timeout: 45 seconds.
- Completion, failure, cancellation and timeout close the upstream socket.
- This P0 buffers each short utterance before playback; it is not real-time streaming audio.

微软免费接口提供音频和单词时间戳，**不提供 Azure Speech 的原生 viseme 事件**。口型由 TalkingHead 根据英文单词推导，因此当前 P0 仍输出英语。文本会发送到微软，不再是设备端离线合成。该消费端接口并非有 SLA 的 Azure API，协议变化、拒绝访问或限流时会明确报错，允许重试。

Protocol reference: [rany2/edge-tts](https://github.com/rany2/edge-tts). ToonLab independently implements the small protocol adapter; no Python service or additional persistent infrastructure is required.

## BYOK security boundary / Key 安全边界

- OpenRouter keys belong to users and are saved only in browser `localStorage`, with replacement and deletion controls.
- The key is sent only in the `Authorization` header of `/api/chat`, then used for that OpenRouter request.
- `/api/tts` does not send or forward OpenRouter keys; its Microsoft headers are constructed independently.
- The Worker does not log, persist or cache keys or synthesized speech; API responses use `Cache-Control: no-store`.
- Cross-origin browser API calls are rejected; same-origin deployments and localhost development are supported.
- No D1, KV, R2, Queue, Durable Object, account system or server-side user key vault is introduced.
- UI libraries and the English lip-sync processor are bundled with ToonLab, without runtime CDN script injection.

## Development / 开发

Node.js 22+ required.

```bash
npm ci
npm run dev
```

The full Worker + Static Assets app runs through Wrangler. `npm run dev:web` is frontend-only Vite HMR; speech and chat require the Worker routes.

```bash
npm test
npm run check
```

`check` runs protocol / error / credential-isolation tests, Vite build and Wrangler deployment dry-run. Mock protocol tests do not establish that Microsoft's live endpoint accepts a deployment or that browser audio and visible lip sync are correct. After deployment, verify the introduction, a generated reply, retry after an upstream failure, and mobile audio activation.

## Deployment / 部署

```bash
npm run deploy
```

Alternatively, configure the repository Actions secret `CLOUDFLARE_API_TOKEN` and manually run **Deploy to Cloudflare**. The non-secret Cloudflare account ID is pinned in the workflow. The deploying account must own the `verinasci.com` zone for the configured Custom Domain.

## Stack / 技术栈

Vite · Cloudflare Workers + Static Assets · TalkingHead 1.7 · Three.js 0.180 · Microsoft Edge Read Aloud · OpenRouter (`openrouter/auto`).

The initial avatar is a replaceable reference asset. Final character art direction remains open.

## License

MIT
