# ToonLab

**AI-driven character animation experiments**

ToonLab is a Web-first experimental lab for AI-driven animated characters. The first milestone validates a simple end-to-end loop:

```text
LLM text → in-browser TTS → audio + visemes → animated character speech
```

## P0 experience

1. Open `toonlab.verinasci.com`.
2. Click **Start** so the browser can enable audio.
3. The character gives a fixed introduction without any LLM credential.
4. Enter an OpenRouter API key. The key is stored only in the current browser and can be replaced or deleted.
5. Enter a prompt.
6. The browser sends the prompt and key to ToonLab's Cloudflare Worker for that request only.
7. The Worker calls OpenRouter and returns generated text.
8. HeadTTS generates speech plus viseme timing in the browser; TalkingHead renders and lip-syncs the character.

## Architecture

```text
Browser
├── TalkingHead                  3D avatar renderer
├── HeadTTS                      in-browser TTS + visemes
├── localStorage                 user-owned OpenRouter key
└── /api/chat ───────────────┐
                             │
Cloudflare Worker            │
└── OpenRouter proxy ◀───────┘
    └── https://openrouter.ai/api/v1/chat/completions
```

The Worker never stores the user's OpenRouter key. It must not log authorization headers or persist the key to KV, D1, Analytics, caches, or any other backend storage.

## Stack

- TypeScript + Vite
- Cloudflare Workers + Static Assets
- `@met4citizen/talkinghead`
- `@met4citizen/headtts`
- OpenRouter Chat Completions API

## Development

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
```

Deploy to Cloudflare:

```bash
npm run deploy
```

The Wrangler configuration targets the custom domain `toonlab.verinasci.com`.

## Project status

The repository starts with the infrastructure and interaction skeleton. Avatar asset selection and final character art direction remain experimental and should stay replaceable behind the avatar adapter.

## License

MIT
