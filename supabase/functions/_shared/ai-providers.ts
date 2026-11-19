import { checked, HttpError, type Context } from "./backend.ts";

export type Turn = {
  role: "system" | "user" | "assistant";
  content:
    | string
    | ({ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } })[];
};

type Provider = {
  id?: string | null;
  name: string;
  adapter: string;
  model: string;
  priority?: number;
  enabled?: boolean;
  temperature?: number;
  input_price?: number;
  output_price?: number;
  base_url?: string;
  secret_name?: string;
  supports_vision?: boolean;
};

type CompletionResult = {
  answer: string;
  inputTokens: number | null;
  outputTokens: number | null;
};

type CompletionOptions = {
  providerId?: string;
  adapter?: string;
};

const COMPATIBLE_HOSTS = new Set([
  "api.deepseek.com",
  "api.groq.com",
  "api.mistral.ai",
  "api.x.ai",
  "api.together.xyz",
  "api.fireworks.ai",
  "api.cerebras.ai",
  "api.perplexity.ai",
  "api.sambanova.ai",
  "api.nebius.com",
  "api.siliconflow.com",
  "api.moonshot.ai",
  "api.minimax.io",
  "api.novita.ai",
  "api.hyperbolic.xyz",
]);

const COMPATIBLE_SECRETS = new Set([
  "AI_COMPATIBLE_API_KEY",
  "DEEPSEEK_API_KEY",
  "GROQ_API_KEY",
  "MISTRAL_API_KEY",
  "XAI_API_KEY",
  "TOGETHER_API_KEY",
  "FIREWORKS_API_KEY",
  "CEREBRAS_API_KEY",
  "PERPLEXITY_API_KEY",
  "SAMBANOVA_API_KEY",
  "NEBIUS_API_KEY",
  "SILICONFLOW_API_KEY",
  "MOONSHOT_API_KEY",
  "MINIMAX_API_KEY",
  "NOVITA_API_KEY",
  "HYPERBOLIC_API_KEY",
]);

function encodeBase64(bytes: Uint8Array) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function systemText(messages: Turn[]) {
  return messages
    .filter((message) => message.role === "system")
    .map((message) =>
      typeof message.content === "string"
        ? message.content
        : message.content.filter((part) => part.type === "text").map((part) => part.text).join("\n")
    )
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 18000);
}

async function geminiParts(content: Turn["content"]) {
  if (typeof content === "string") return [{ text: content }];
  const parts: Record<string, unknown>[] = [];
  for (const item of content) {
    if (item.type === "text") {
      parts.push({ text: item.text });
      continue;
    }
    const response = await fetch(item.image_url.url, { signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new HttpError(502, "Could not load the attached image for Gemini");
    const mimeType = (response.headers.get("content-type") || "image/jpeg").split(";")[0];
    if (!mimeType.startsWith("image/")) throw new HttpError(422, "Unsupported image attachment");
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > 12 * 1024 * 1024) {
      throw new HttpError(413, "Image attachments for AI analysis must be 12 MB or smaller");
    }
    parts.push({ inlineData: { mimeType, data: encodeBase64(bytes) } });
  }
  return parts;
}

function openAIContent(content: Turn["content"]) {
  if (typeof content === "string") return content;
  return content.map((part) =>
    part.type === "text"
      ? { type: "text", text: part.text }
      : { type: "image_url", image_url: { url: part.image_url.url } }
  );
}

function openAIMessages(messages: Turn[]) {
  return messages.filter((message) => message.role !== "system").map((message) => ({
    role: message.role,
    content: openAIContent(message.content),
  }));
}

async function anthropicContent(content: Turn["content"]) {
  if (typeof content === "string") return content;
  const blocks: Record<string, unknown>[] = [];
  for (const part of content) {
    if (part.type === "text") {
      blocks.push({ type: "text", text: part.text });
      continue;
    }
    const response = await fetch(part.image_url.url, { signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new HttpError(502, "Could not load the attached image for Claude");
    const mediaType = (response.headers.get("content-type") || "image/jpeg").split(";")[0];
    if (!mediaType.startsWith("image/")) throw new HttpError(422, "Unsupported image attachment");
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > 12 * 1024 * 1024) {
      throw new HttpError(413, "Image attachments for AI analysis must be 12 MB or smaller");
    }
    blocks.push({
      type: "image",
      source: { type: "base64", media_type: mediaType, data: encodeBase64(bytes) },
    });
  }
  return blocks;
}

async function readSSE(
  response: Response,
  onData: (data: string) => Promise<void>,
) {
  const reader = response.body?.getReader();
  if (!reader) throw new HttpError(502, "AI provider returned an unreadable event stream");
  const decoder = new TextDecoder();
  let pending = "";
  const handle = async (line: string) => {
    if (!line.startsWith("data:")) return;
    const data = line.slice(5).trim();
    if (!data || data === "[DONE]") return;
    await onData(data);
  };
  while (true) {
    const { value, done } = await reader.read();
    pending += decoder.decode(value || new Uint8Array(), { stream: !done });
    const lines = pending.split(/\r?\n/);
    pending = lines.pop() || "";
    for (const line of lines) await handle(line);
    if (done) break;
  }
  if (pending.trim()) await handle(pending);
}

function extractOpenAIText(value: unknown) {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return "";
  return value.map((part) => {
    if (typeof part?.text === "string") return part.text;
    if (typeof part?.content === "string") return part.content;
    return "";
  }).join("");
}

async function upstreamFailure(response: Response, providerName: string): Promise<never> {
  const payload = await response.json().catch(() => ({}));
  const message = payload.error?.message || payload.message ||
    providerName + " returned HTTP " + response.status;
  throw new HttpError(response.status, String(message).slice(0, 1200));
}

function providerSecretName(provider: Provider) {
  if (provider.adapter === "gemini") return "GEMINI_API_KEY";
  if (provider.adapter === "openrouter") return "OPENROUTER_API_KEY";
  if (provider.adapter === "openai") return "OPENAI_API_KEY";
  if (provider.adapter === "anthropic") return "ANTHROPIC_API_KEY";
  if (provider.adapter === "compatible") {
    const name = provider.secret_name || "AI_COMPATIBLE_API_KEY";
    if (!COMPATIBLE_SECRETS.has(name)) {
      throw new HttpError(422, "The compatible provider uses an unsupported secret name");
    }
    return name;
  }
  throw new HttpError(422, "Unsupported AI provider adapter: " + provider.adapter);
}

function providerKey(provider: Provider) {
  const name = providerSecretName(provider);
  const key = Deno.env.get(name);
  if (!key) throw new HttpError(503, name + " is not configured in Supabase Edge Function Secrets");
  return key;
}

function compatibleBaseURL(provider: Provider) {
  const raw = provider.base_url || Deno.env.get("AI_COMPATIBLE_BASE_URL") || "";
  if (!raw) throw new HttpError(422, "Set the compatible provider base URL before testing it");
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new HttpError(422, "The compatible provider base URL is invalid");
  }
  if (
    url.protocol !== "https:" ||
    !COMPATIBLE_HOSTS.has(url.hostname) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new HttpError(422, "The compatible provider URL must use an approved HTTPS API host");
  }
  return url.toString().replace(/\/+$/, "");
}

function timeoutFor(operation: string) {
  if (operation === "conversation") return 45000;
  if (operation === "memory extraction" || operation === "connection test") return 15000;
  if (operation === "initiative") return 20000;
  return 30000;
}

function outputLimit(operation: string) {
  if (operation === "conversation") return 850;
  if (operation === "initiative") return 260;
  if (operation === "summary") return 800;
  if (operation === "memory extraction") return 140;
  if (operation === "connection test") return 120;
  return 500;
}

function defaultTemperature(operation: string) {
  if (operation === "conversation") return 0.9;
  if (operation === "initiative") return 0.92;
  if (operation === "memory extraction") return 0.2;
  return 0.55;
}

async function invokeGemini(
  provider: Provider,
  key: string,
  operation: string,
  messages: Turn[],
  streaming: boolean,
  emit: (partial: string) => Promise<void>,
  timeoutMs: number,
  temperature: number,
  maxOutputTokens: number,
): Promise<CompletionResult> {
  const instruction = systemText(messages);
  const contents: { role: "user" | "model"; parts: Record<string, unknown>[] }[] = [];
  for (const message of messages) {
    if (message.role === "system") continue;
    const role = message.role === "assistant" ? "model" : "user";
    const parts = await geminiParts(message.content);
    if (!parts.length) continue;
    const previous = contents[contents.length - 1];
    if (previous?.role === role) previous.parts.push(...parts);
    else contents.push({ role, parts });
  }
  if (!contents.length) throw new HttpError(422, "Gemini request has no conversation content");
  const url = "https://generativelanguage.googleapis.com/v1beta/models/" +
    encodeURIComponent(provider.model) +
    (streaming ? ":streamGenerateContent?alt=sse" : ":generateContent");
  const response = await fetch(url, {
    method: "POST",
    headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify({
      systemInstruction: instruction ? { parts: [{ text: instruction }] } : undefined,
      contents,
      generationConfig: {
        temperature,
        maxOutputTokens,
        thinkingConfig: { thinkingLevel: "LOW" },
      },
    }),
  });
  if (!response.ok) await upstreamFailure(response, provider.name);
  let answer = "";
  let inputTokens: number | null = null;
  let outputTokens: number | null = null;
  if (streaming && (response.headers.get("content-type") || "").includes("text/event-stream")) {
    await readSSE(response, async (data) => {
      const event = JSON.parse(data);
      if (event.error) {
        throw new HttpError(Number(event.error.code) || 502, event.error.message || "Gemini stream failed");
      }
      const delta = (event.candidates?.[0]?.content?.parts || [])
        .map((part: { text?: string }) => part.text || "").join("");
      if (delta) {
        answer += delta;
        await emit(answer);
      }
      inputTokens = event.usageMetadata?.promptTokenCount ?? inputTokens;
      outputTokens = event.usageMetadata?.candidatesTokenCount ?? outputTokens;
    });
  } else {
    const payload = await response.json();
    answer = (payload.candidates?.[0]?.content?.parts || [])
      .map((part: { text?: string }) => part.text || "").join("").trim();
    inputTokens = payload.usageMetadata?.promptTokenCount ?? null;
    outputTokens = payload.usageMetadata?.candidatesTokenCount ?? null;
    if (answer && streaming) await emit(answer);
  }
  if (!answer.trim()) throw new HttpError(502, "Gemini returned an empty response");
  return { answer, inputTokens, outputTokens };
}

async function invokeOpenAICompatible(
  provider: Provider,
  key: string,
  messages: Turn[],
  streaming: boolean,
  emit: (partial: string) => Promise<void>,
  timeoutMs: number,
  temperature: number,
  maxOutputTokens: number,
): Promise<CompletionResult> {
  const baseURL = provider.adapter === "openrouter"
    ? "https://openrouter.ai/api/v1"
    : provider.adapter === "openai"
    ? "https://api.openai.com/v1"
    : compatibleBaseURL(provider);
  const headers: Record<string, string> = {
    Authorization: "Bearer " + key,
    "Content-Type": "application/json",
  };
  if (provider.adapter === "openrouter") headers["X-Title"] = "MYRA";
  const body: Record<string, unknown> = {
    model: provider.model,
    messages: [
      ...(systemText(messages) ? [{ role: "system", content: systemText(messages) }] : []),
      ...openAIMessages(messages),
    ],
    temperature,
    max_tokens: maxOutputTokens,
    stream: streaming,
  };
  if (streaming && ["openai", "openrouter"].includes(provider.adapter)) {
    body.stream_options = { include_usage: true };
  }
  const response = await fetch(baseURL + "/chat/completions", {
    method: "POST",
    headers,
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify(body),
  });
  if (!response.ok) await upstreamFailure(response, provider.name);
  let answer = "";
  let inputTokens: number | null = null;
  let outputTokens: number | null = null;
  if (streaming && (response.headers.get("content-type") || "").includes("text/event-stream")) {
    await readSSE(response, async (data) => {
      const event = JSON.parse(data);
      if (event.error) throw new HttpError(502, event.error.message || provider.name + " stream failed");
      const delta = extractOpenAIText(event.choices?.[0]?.delta?.content);
      if (delta) {
        answer += delta;
        await emit(answer);
      }
      inputTokens = event.usage?.prompt_tokens ?? inputTokens;
      outputTokens = event.usage?.completion_tokens ?? outputTokens;
    });
  } else {
    const payload = await response.json();
    answer = extractOpenAIText(payload.choices?.[0]?.message?.content).trim();
    inputTokens = payload.usage?.prompt_tokens ?? null;
    outputTokens = payload.usage?.completion_tokens ?? null;
    if (answer && streaming) await emit(answer);
  }
  if (!answer.trim()) throw new HttpError(502, provider.name + " returned an empty response");
  return { answer, inputTokens, outputTokens };
}

async function invokeAnthropic(
  provider: Provider,
  key: string,
  messages: Turn[],
  streaming: boolean,
  emit: (partial: string) => Promise<void>,
  timeoutMs: number,
  temperature: number,
  maxOutputTokens: number,
): Promise<CompletionResult> {
  const converted = [];
  for (const message of messages) {
    if (message.role === "system") continue;
    converted.push({ role: message.role, content: await anthropicContent(message.content) });
  }
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify({
      model: provider.model,
      max_tokens: maxOutputTokens,
      temperature,
      system: systemText(messages),
      messages: converted,
      stream: streaming,
    }),
  });
  if (!response.ok) await upstreamFailure(response, provider.name);
  let answer = "";
  let inputTokens: number | null = null;
  let outputTokens: number | null = null;
  if (streaming && (response.headers.get("content-type") || "").includes("text/event-stream")) {
    await readSSE(response, async (data) => {
      const event = JSON.parse(data);
      if (event.type === "error") {
        throw new HttpError(502, event.error?.message || "Claude stream failed");
      }
      if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
        answer += event.delta.text || "";
        if (answer) await emit(answer);
      }
      if (event.type === "message_start") {
        inputTokens = event.message?.usage?.input_tokens ?? inputTokens;
      }
      if (event.type === "message_delta") {
        outputTokens = event.usage?.output_tokens ?? outputTokens;
      }
    });
  } else {
    const payload = await response.json();
    answer = (payload.content || []).filter((part: { type?: string }) => part.type === "text")
      .map((part: { text?: string }) => part.text || "").join("").trim();
    inputTokens = payload.usage?.input_tokens ?? null;
    outputTokens = payload.usage?.output_tokens ?? null;
    if (answer && streaming) await emit(answer);
  }
  if (!answer.trim()) throw new HttpError(502, "Claude returned an empty response");
  return { answer, inputTokens, outputTokens };
}

function normalizeFailure(error: unknown, provider: Provider) {
  if (error instanceof HttpError) return error;
  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
    return new HttpError(504, provider.name + " request timed out");
  }
  return new HttpError(
    502,
    provider.name + " request failed: " +
      (error instanceof Error ? error.message : "Unknown provider error"),
  );
}

async function recordUsage(
  ctx: Context,
  operation: string,
  provider: Provider,
  result: CompletionResult | null,
  error = "",
) {
  const inputPrice = Number(provider.input_price || 0);
  const outputPrice = Number(provider.output_price || 0);
  const cost = result && (inputPrice > 0 || outputPrice > 0)
    ? (Number(result.inputTokens || 0) * inputPrice +
      Number(result.outputTokens || 0) * outputPrice) / 1000000
    : null;
  const logged = await ctx.service.from("usage_logs").insert({
    owner_id: ctx.actor,
    operation,
    provider_id: provider.id || null,
    model: provider.model,
    input_tokens: result?.inputTokens ?? null,
    output_tokens: result?.outputTokens ?? null,
    cost,
    error: error.slice(0, 1200),
  });
  if (logged.error) {
    console.error("[MYRA] Could not record provider usage", {
      provider: provider.name,
      error: logged.error.message,
    });
  }
}

function implicitGemini(): Provider {
  return {
    name: "Google Gemini (automatic fallback)",
    adapter: "gemini",
    model: Deno.env.get("GEMINI_CHAT_MODEL") || "gemini-3.6-flash",
    priority: 1000,
    enabled: true,
    supports_vision: true,
  };
}

export async function completeWithProviders(
  ctx: Context,
  operation: string,
  messages: Turn[],
  onDelta?: (answer: string) => Promise<void>,
  options: CompletionOptions = {},
) {
  const rows = checked(
    await ctx.db.from("providers").select("*").eq("owner_id", ctx.actor).order("priority")
      .order("created_at"),
  ) as Provider[];
  let providers: Provider[] = [];
  if (options.providerId) {
    const selected = rows.find((provider) => provider.id === options.providerId);
    if (!selected) throw new HttpError(404, "AI provider configuration not found");
    providers = [selected];
  } else if (options.adapter) {
    providers = rows.filter((provider) => provider.adapter === options.adapter).slice(0, 1);
    if (!providers.length && options.adapter === "gemini" && Deno.env.get("GEMINI_API_KEY")) {
      providers = [implicitGemini()];
    }
    if (!providers.length) throw new HttpError(404, "No provider is configured for " + options.adapter);
  } else {
    providers = rows.filter((provider) => provider.enabled !== false);
    const hasGeminiConfiguration = rows.some((provider) => provider.adapter === "gemini");
    if (!hasGeminiConfiguration && Deno.env.get("GEMINI_API_KEY")) {
      providers.push(implicitGemini());
    }
  }

  const hasImageInput = messages.some((message) =>
    Array.isArray(message.content) && message.content.some((part) => part.type === "image_url")
  );
  if (hasImageInput) {
    providers = providers.filter((provider) => provider.supports_vision === true);
    if (!providers.length) {
      throw new HttpError(422, "No enabled AI provider is configured to accept image input. Enable vision support on a compatible model.");
    }
  }

  providers.sort((a, b) => Number(a.priority ?? 999) - Number(b.priority ?? 999));
  if (!providers.length) {
    throw new HttpError(
      503,
      "No AI provider is ready. Add a provider and configure its server-side API key in Supabase.",
    );
  }

  const timeoutMs = timeoutFor(operation);
  const maxOutputTokens = outputLimit(operation);
  const streaming = operation === "conversation" && typeof onDelta === "function";
  const failures: string[] = [];
  let lastFailure: HttpError | null = null;

  for (const provider of providers) {
    let streamedAnswer = "";
    const emit = async (partial: string) => {
      streamedAnswer = partial;
      if (onDelta) await onDelta(partial);
    };
    try {
      const key = providerKey(provider);
      const configuredTemperature = Number(provider.temperature);
      const temperature = Number.isFinite(configuredTemperature)
        ? configuredTemperature
        : defaultTemperature(operation);
      let result: CompletionResult;
      if (provider.adapter === "gemini") {
        result = await invokeGemini(
          provider,
          key,
          operation,
          messages,
          streaming,
          emit,
          timeoutMs,
          temperature,
          maxOutputTokens,
        );
      } else if (provider.adapter === "anthropic") {
        result = await invokeAnthropic(
          provider,
          key,
          messages,
          streaming,
          emit,
          timeoutMs,
          temperature,
          maxOutputTokens,
        );
      } else if (["openrouter", "openai", "compatible"].includes(provider.adapter)) {
        result = await invokeOpenAICompatible(
          provider,
          key,
          messages,
          streaming,
          emit,
          timeoutMs,
          temperature,
          maxOutputTokens,
        );
      } else {
        throw new HttpError(422, "Unsupported AI provider adapter: " + provider.adapter);
      }
      await recordUsage(ctx, operation, provider, result);
      console.info("[MYRA] AI request completed", {
        operation,
        provider: provider.name,
        model: provider.model,
        fallback: failures.length > 0,
      });
      return result.answer;
    } catch (error) {
      const failure = normalizeFailure(error, provider);
      await recordUsage(ctx, operation, provider, null, failure.message);
      lastFailure = failure;
      failures.push(provider.name + " (" + provider.model + "): " + failure.message);
      console.warn("[MYRA] AI provider failed; checking the next configured provider", {
        operation,
        provider: provider.name,
        model: provider.model,
        status: failure.status,
        partialOutput: streamedAnswer.length > 0,
        error: failure.message,
      });
      if (streamedAnswer.length > 0 || failure.status === 413 || failure.status === 422) {
        throw failure;
      }
    }
  }

  throw new HttpError(
    lastFailure?.status || 503,
    "All configured AI providers failed. " + failures.join(" | "),
  );
}
