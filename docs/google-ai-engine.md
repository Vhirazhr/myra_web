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
