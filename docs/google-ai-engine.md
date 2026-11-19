# MYRA Google AI Engine

MYRA uses one Google AI Studio API key for server-side Gemini services. The key is stored only in Supabase Edge Function Secrets.

## Services

| Feature | Google service | Default model |
| --- | --- | --- |
| Chat, roleplay, memory extraction, summaries, proactive messages | Gemini Developer API | `gemini-3.6-flash` |
| Real-time voice calls | Gemini Live API | `gemini-3.8-live` |
| Generated voice notes | Gemini Interactions API TTS | `gemini-3.8-flash-tts` |
| Audio transcription | Gemini multimodal input | `gemini-3.6-flash` |
| Character photos and videos | Google Flow using the user's Google AI Plus account | Flow UI, not a callable MYRA API |

## Configure the single API key

1. Create a Gemini API key in [Google AI Studio](https://aistudio.google.com/apikey).
2. From the project directory, link the Supabase project if needed and set the secret:

```cmd
pnpm exec supabase link --project-ref splifnxylqaicneodkaj
pnpm exec supabase secrets set GEMINI_API_KEY=YOUR_GOOGLE_AI_STUDIO_KEY
```

3. Deploy both Edge Functions:

```cmd
pnpm exec supabase functions deploy myra --remote=splifnxylqaicneodkaj
pnpm exec supabase functions deploy worker --remote=splifnxylqaicneodkaj
```

4. Pull the latest frontend and build:

```cmd
git pull origin main
pnpm install
pnpm build
```

5. Open MYRA -> AI Engine -> Google AI Engine -> **Test Gemini connection**.

The default model IDs can be overridden using server-side Edge Function secrets:
- `GEMINI_CHAT_MODEL`
- `GEMINI_LIVE_MODEL`
- `GEMINI_TTS_MODEL`

The Gemini API key must never be added to `.env.local` as a `VITE_*` variable, committed to GitHub, or sent to the browser. MYRA creates a short-lived, single-use Gemini Live session token on the backend for each call.

## Google Flow media workflow

Google Flow does not expose the user's Google AI Plus subscription as a callable API endpoint for MYRA. The Character Media Studio therefore keeps a supported manual bridge:

1. Select a character and media purpose in Character Media Studio.
2. Copy the generated character-consistent prompt.
3. Open Google Flow and use the character portrait as a reference/ingredient.
4. Generate the photo or video using the Google AI Plus account.
5. Download the result and import it into the character's private MYRA media library.
6. MYRA can then share the imported media in a conversation.

## Free-tier and privacy notes

- Gemini API Free has model-specific request/token quotas, rate limits, and regional/eligibility restrictions. A successful API key does not guarantee unlimited free use.
- Google documents that content sent through the unpaid Gemini API tier may be used to improve Google products. Avoid sending highly sensitive personal conversations through the free tier.
- Google AI Plus is a consumer subscription for Google's supported apps and does not automatically grant API quota or make Flow callable from MYRA.
- Live API sessions and TTS are subject to their own model availability and quota limits. Check Google AI Studio's current usage dashboard if requests are rate-limited.

## Chat latency and memory processing

Conversation responses use Gemini's SSE streaming endpoint and are persisted incrementally to the assistant message so Supabase Realtime can display partial text. The prompt context and output budget are capped to reduce latency. Memory extraction is queued after the reply is committed; it does not delay the chat response. The Edge Function attempts a background drain, and the scheduled worker retries transient failures with backoff. Explicit `remember` requests are saved without a second model call.

## Gemini primary and text failover policy

Gemini remains the primary provider for chat, image/video workflows, and voice. For conversation requests only, transient Gemini overload, gateway, service-unavailable, and timeout failures are retried once before the request is reported as unavailable. Quota/rate-limit responses are only retried when the upstream message indicates a transient rate-limit or overload condition; invalid credentials, permission errors, and malformed requests are not retried.

GPT is reserved as a text-only fallback. It must not receive image/video generation or voice requests. ChatGPT Plus plan usage is not currently wired into this remote-hosted, private MYRA deployment: OpenAI's published token-sharing path is for open-source and locally hosted tools, while remotely hosted apps must request access through the official partner interest process. Do not use browser cookies, copied ChatGPT sessions, or account passwords as a substitute. Enable GPT fallback only after OpenAI grants the required access and the official OAuth/token-sharing flow is implemented.

Mobile and web clients continue to use the same Supabase conversations and messages; the AI provider is selected server-side and does not create separate chat histories.


## Multi-provider text routing

MYRA routes text generation through \`supabase/functions/_shared/ai-providers.ts\`. Configure provider rows in **AI Engine → Multi-AI Providers**. Lower priority numbers are attempted first. If a provider fails before producing output, the next enabled provider is attempted. A partial streamed response is never silently restarted on another model, preventing duplicate or contradictory text in the same assistant message.

Supported adapters:
- \`gemini\`: Google Gemini Developer API.
- \`openai\`: OpenAI Chat Completions API.
- \`anthropic\`: Anthropic Messages API.
- \`openrouter\`: OpenRouter Chat Completions API.
- \`compatible\`: approved OpenAI-compatible API hosts (DeepSeek, Groq, Mistral, xAI, Together, Fireworks, Cerebras, Perplexity, SambaNova, Nebius, SiliconFlow, Moonshot, MiniMax, Novita, Hyperbolic).

Only store the secret variable name in the provider row, never the API key. Set actual key values with Supabase Edge Function Secrets. Supported secret names include:

\`\`\`sh
pnpm exec supabase secrets set OPENROUTER_API_KEY=...
pnpm exec supabase secrets set OPENAI_API_KEY=...
pnpm exec supabase secrets set ANTHROPIC_API_KEY=...
pnpm exec supabase secrets set DEEPSEEK_API_KEY=...
pnpm exec supabase secrets set GROQ_API_KEY=...
pnpm exec supabase secrets set MISTRAL_API_KEY=...
pnpm exec supabase secrets set XAI_API_KEY=...
pnpm exec supabase secrets set TOGETHER_API_KEY=...
pnpm exec supabase secrets set FIREWORKS_API_KEY=...
\`\`\`

For a compatible adapter, set the base URL to the provider's official HTTPS API root and select the matching secret variable name. The backend enforces an allowlist of hostnames to prevent arbitrary server-side requests. Do not paste API keys into the dashboard, provider name, model, base URL, or Git repository.

Chat, summaries, story captions, memory extraction, and proactive text messages use the shared provider router. Voice calls, voice note generation, and transcription remain on their specialized Gemini endpoints in this phase. Google Flow media generation remains a manual workflow and is not treated as a callable API. Provider usage and estimated cost are recorded per request when token usage and price settings are available.

Before enabling a provider, configure its API key in Supabase, add a provider row, choose its model ID, set priority, then test it by sending a normal MYRA chat message. A missing key or unsupported model will be recorded as a provider failure and the next eligible provider will be tried.
