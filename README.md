# ToonLab

**AI-driven character animation experiments**

ToonLab is a Web-first experimental lab for AI-driven animated characters.

Production target: **https://toonlab.verinasci.com**

## P0 experiment

The first milestone validates this loop:

```text
fixed intro → user supplies OpenRouter key → LLM text
                                      ↓
Browser: HeadTTS → audio + visemes → TalkingHead → animated speech
```

1. The user clicks **Start ToonLab**. This user gesture unlocks browser audio.
2. TalkingHead loads the 3D character and HeadTTS initializes WebGPU, with WASM as fallback.
3. The character gives a fixed introduction. No LLM credential is required for this step.
4. The page then unlocks the OpenRouter controls.
5. The user enters an OpenRouter API key. It is stored in that browser's `localStorage`, can be replaced, and can be deleted at any time.
6. The browser sends the prompt and key to `/api/chat`. The key is carried in the `Authorization` header for that request only.
7. The Cloudflare Worker forwards the request to OpenRouter and returns only the generated text plus the selected model ID.
8. HeadTTS generates speech and viseme timing in the browser; TalkingHead renders and lip-syncs the character.

## Architecture

```text
Browser
├── ToonLab UI
├── TalkingHead                  bundled with the site
├── HeadTTS                      bundled main client
├── localStorage                 user-owned OpenRouter key
└── /api/chat ───────────────┐
                             │
Cloudflare Worker            │
└── OpenRouter proxy ◀───────┘
    └── api.openrouter.ai
```

HeadTTS currently loads its isolated inference worker/dictionaries from its pinned jsDelivr package and downloads the Kokoro model needed for browser inference. The UI's third-party libraries themselves are npm dependencies bundled into ToonLab rather than runtime script tags, so they are not independently injected into the page that owns the API key.

## BYOK security boundary

This is an experimental BYOK design, not a general-purpose credential vault.

- The OpenRouter key is stored in browser `localStorage` by explicit user action.
- The Worker must never log, persist, cache, echo, or analyze the key.
- No KV, D1, R2, Durable Object, Queue, Analytics Engine, or server-side secret is used for user keys.
- `/api/chat` responds with `Cache-Control: no-store`.
- Cross-origin browser requests are rejected; localhost remains allowed for development.
- Clearing browser site data also removes the locally stored key.

## Stack

- Vite
- Cloudflare Workers + Static Assets
- `@met4citizen/talkinghead` 1.7.x
- `@met4citizen/headtts` 1.3.x
- Three.js 0.180.x
- OpenRouter Chat Completions API (`openrouter/auto` by default)

## Development

Requires Node.js 22+.

```bash
npm install
npm run dev
```

`npm run dev` builds the frontend and serves the full Worker + Static Assets application through Wrangler.

For frontend-only work with Vite HMR:

```bash
npm run dev:web
```

Build and Worker dry-run validation:

```bash
npm run check
```

Deploy:

```bash
npm run deploy
```

Wrangler is configured with `toonlab.verinasci.com` as the production Custom Domain. The deploying Cloudflare account must own the `verinasci.com` zone.

## Current constraints

- HeadTTS is English-only today.
- P0 is optimized first for desktop Chrome/Edge with WebGPU. WASM fallback is supported but slower.
- The initial avatar is a replaceable reference asset used only to validate the interaction loop; ToonLab's final character art direction remains open.
- The project intentionally has no application database or user account system yet.

## License

MIT
