# MYRA AI Provider Engine

MYRA uses a server-side multi-provider router for text generation. Gemini, OpenAI, Anthropic, OpenRouter, and approved OpenAI-compatible APIs can be configured as independent providers. Provider API keys are stored only in Supabase Edge Function Secrets.

## Routing responsibilities

| MYRA feature | Provider path |
| --- | --- |
| Chat, roleplay, summaries, story captions, memory extraction, proactive text | Automatic provider router |
| Image understanding | Automatic router, but only providers whose model has **Accept image input** enabled |
| Real-time voice calls | Gemini Live API |
| Generated voice notes | Gemini Interactions API TTS |
| Audio transcription | Gemini multimodal input |
| Character photo/video generation | Google Flow manual workflow; the consumer subscription is not a callable MYRA API |

Text routing is ordered by provider priority (lower number runs first). When a provider fails before producing any streamed text, MYRA tries the next enabled provider. If a stream has already emitted text, MYRA does not silently restart on another provider, preventing duplicated or contradictory replies. Invalid attachment errors (HTTP 413/422) are not retried against other providers.

## Supported providers

| Provider | Adapter | Server-side secret |
| --- | --- | --- |
| Google Gemini | `gemini` | `GEMINI_API_KEY` |
| OpenRouter | `openrouter` | `OPENROUTER_API_KEY` |
| OpenAI | `openai` | `OPENAI_API_KEY` |
| Anthropic Claude | `anthropic` | `ANTHROPIC_API_KEY` |
| DeepSeek | `compatible` | `DEEPSEEK_API_KEY` |
| Groq | `compatible` | `GROQ_API_KEY` |
| Mistral | `compatible` | `MISTRAL_API_KEY` |
| xAI Grok | `compatible` | `XAI_API_KEY` |

OpenAI-compatible adapters are restricted to approved HTTPS API hosts. The configured base URL may include the provider's API path, for example `https://api.groq.com/openai/v1`. The server does not accept arbitrary hosts or secret variable names. Supported additional secret names include `TOGETHER_API_KEY`, `FIREWORKS_API_KEY`, `CEREBRAS_API_KEY`, `PERPLEXITY_API_KEY`, `SAMBANOVA_API_KEY`, `NEBIUS_API_KEY`, `SILICONFLOW_API_KEY`, `MOONSHOT_API_KEY`, `MINIMAX_API_KEY`, `NOVITA_API_KEY`, and `HYPERBOLIC_API_KEY`.

## Configure Gemini's specialized services

1. Create a Gemini API key in [Google AI Studio](https://aistudio.google.com/apikey).
2. Link the Supabase project if needed, then set the key from the project directory:

```cmd
pnpm exec supabase link --project-ref splifnxylqaicneodkaj
pnpm exec supabase secrets set GEMINI_API_KEY=YOUR_GOOGLE_AI_STUDIO_KEY
```

3. Deploy the MYRA Edge Functions after the latest database migrations are applied:

```cmd
pnpm exec supabase functions deploy myra --project-ref splifnxylqaicneodkaj
pnpm exec supabase functions deploy worker --project-ref splifnxylqaicneodkaj
```

Gemini defaults can be overridden with `GEMINI_CHAT_MODEL`, `GEMINI_LIVE_MODEL`, and `GEMINI_TTS_MODEL`. The current chat default is `gemini-3.6-flash`; Live and TTS use their dedicated model IDs.

## Configure the other providers

Create keys in the providers' official dashboards:

- [OpenRouter](https://openrouter.ai/settings/keys)
- [OpenAI](https://platform.openai.com/api-keys)
- [Anthropic](https://console.anthropic.com/settings/keys)
- [DeepSeek](https://platform.deepseek.com/api_keys)
- [Groq](https://console.groq.com/keys)
- [Mistral](https://console.mistral.ai/api-keys/)
- [xAI](https://console.x.ai/)

Set each key as a Supabase Edge Function Secret. Example:

```cmd
pnpm exec supabase secrets set OPENROUTER_API_KEY=YOUR_OPENROUTER_KEY
pnpm exec supabase secrets set OPENAI_API_KEY=YOUR_OPENAI_KEY
pnpm exec supabase secrets set ANTHROPIC_API_KEY=YOUR_ANTHROPIC_KEY
pnpm exec supabase secrets set DEEPSEEK_API_KEY=YOUR_DEEPSEEK_KEY
pnpm exec supabase secrets set GROQ_API_KEY=YOUR_GROQ_KEY
pnpm exec supabase secrets set MISTRAL_API_KEY=YOUR_MISTRAL_KEY
pnpm exec supabase secrets set XAI_API_KEY=YOUR_XAI_KEY
```

Then open **MYRA → AI Engine → Multi-AI Providers** and select **Add missing provider templates**. The Gemini template is enabled first; the other templates start disabled. For each provider:

1. Edit `model` to a model ID available to your provider account. Templates intentionally use `YOUR_MODEL_ID` rather than assuming a model ID that may be retired or unavailable to your account.
2. Confirm the provider's API key is set in Supabase Edge Function Secrets.
3. Enable the provider and choose its priority (lower numbers are attempted first).
4. If the model accepts images, enable **Model accepts image input**.
5. Save the provider, then use **Test connection** on its row.

For DeepSeek, Groq, Mistral, and xAI, the template includes the official API base URL and secret variable name. Do not paste the API key into MYRA's provider form. The form stores only the secret variable name, not its value.

## Usage and cost tracking

MYRA records each provider attempt in `usage_logs`, including the provider/model, operation, token counts when supplied by the upstream API, error details, and estimated cost. Set the provider's input and output prices in USD per one million tokens to calculate estimated costs. Some providers or models do not return token usage on every response, so cost may be unavailable or approximate.

## Privacy and quotas

- Provider API keys are never sent to the browser and must not be committed to Git.
- Each provider has its own rate limits, billing rules, model availability, and data-retention policy. Check the provider's terms before sending private conversations.
- A successful connection test does not mean the provider offers unlimited free usage.
- ChatGPT Plus subscriptions are not API credits. MYRA uses official provider API keys, not browser cookies, copied ChatGPT sessions, or account passwords.

## Google Flow media workflow

Google Flow does not expose the user's Google AI Plus subscription as a callable API endpoint for MYRA. Character Media Studio therefore keeps a supported manual bridge:

1. Select a character and media purpose in Character Media Studio.
2. Copy the generated character-consistent prompt.
3. Open Google Flow and use the character portrait as a reference/ingredient.
4. Generate the photo or video using the Google AI Plus account.
5. Download the result and import it into the character's private MYRA media library.
6. MYRA can then share the imported media in a conversation.

## Deployment and verification

After applying the migration and setting provider secrets:

```cmd
pnpm exec supabase db push --linked
pnpm exec supabase functions deploy myra --project-ref splifnxylqaicneodkaj
pnpm exec supabase functions deploy worker --project-ref splifnxylqaicneodkaj
pnpm install
pnpm typecheck
pnpm build
```

Open **Multi-AI Providers**, add the templates, configure model IDs and secrets, enable providers, and test each connection. The automated CI suite validates TypeScript, Edge Function types, the frontend build, provider ordering, fallback after rate limits, no duplicate retries after partial streaming, vision capability filtering, and secret-name validation. Live provider checks still require valid keys and model IDs configured in the user's Supabase project.
