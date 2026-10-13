# ToonLab agent guide

## Purpose
ToonLab is a Web-first experiment for AI-driven animated characters. Keep the project small and measurable. Prefer a working end-to-end experiment over framework or platform abstraction.

## Current P0 contract
- Browser renders the avatar, plays audio and performs lip-sync. Use the official Azure Speech SDK in the browser with native VisemeReceived events. The Worker issues short-lived tokens at `/api/tts/token` using an Azure Speech F0 resource.
- `/api/tts/token` never forwards OpenRouter credentials. Store AZURE_SPEECH_KEY only as a Worker Secret; never return it. Tokens stay in browser memory only. Do not log, persist or cache tokens or speech. Close the SDK synthesizer on success, failure or timeout. Do not use Edge Read Aloud or fall back to inferred word-based mouth shapes.
- OpenRouter is BYOK. The API key is owned by the user and stored only in browser `localStorage`.
- The browser sends the key only in the request `Authorization` header to `/api/chat`.
- The Cloudflare Worker may use the key only for the corresponding OpenRouter request. Never log, persist, cache, echo, or place it in analytics, D1, KV, R2, Queues, Durable Objects, or error payloads.
- Keep the avatar/TTS implementation behind `AvatarController` so the renderer and speech engine can be replaced later.

## Engineering rules
- Do not add backend persistence without a demonstrated experiment need.
- Do not commit secrets or personal API keys.
- Keep `/api/chat` same-origin and preserve `Cache-Control: no-store`.
- Treat third-party runtime JavaScript as part of the credential threat model. Main UI code and libraries should be built and served by ToonLab rather than injected from arbitrary runtime script tags.
- Run `npm run check` before merging code that changes the Worker or frontend build.
