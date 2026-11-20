import { completeWithProviders } from "./ai-providers.ts";
import type { Context } from "./backend.ts";

function assertEquals(actual: unknown, expected: unknown, label: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(label + ": expected " + JSON.stringify(expected) + ", received " + JSON.stringify(actual));
  }
}

function assertIncludes(actual: string, expected: string, label: string) {
  if (!actual.includes(expected)) throw new Error(label + ": expected text to include " + expected);
}

function mockContext(rows: Record<string, unknown>[]) {
  const usage: Record<string, unknown>[] = [];
  const query: any = {
    select() { return this; },
    eq() { return this; },
    order() { return this; },
    then(resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) {
      return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
    },
  };
  const db: any = {
    from(table: string) {
      if (table !== "providers") throw new Error("Unexpected client table: " + table);
      return query;
    },
  };
  const service: any = {
    from(table: string) {
      if (table !== "usage_logs") throw new Error("Unexpected service table: " + table);
      return {
        async insert(row: Record<string, unknown>) {
          usage.push(row);
          return { data: row, error: null };
        },
      };
    },
  };
  return {
    ctx: { db, service, actor: "00000000-0000-4000-8000-000000000001" } as unknown as Context,
    usage,
  };
}

function withEnv(values: Record<string, string>, run: () => Promise<void>) {
  return async () => {
    const previous = Object.fromEntries(Object.keys(values).map((key) => [key, Deno.env.get(key)]));
    for (const [key, value] of Object.entries(values)) Deno.env.set(key, value);
    try {
      await run();
    } finally {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) Deno.env.delete(key);
        else Deno.env.set(key, value);
      }
    }
  };
}

Deno.test("automatic routing sorts providers and falls back after a rate limit", withEnv({
  OPENROUTER_API_KEY: "test-openrouter",
  OPENAI_API_KEY: "test-openai",
}, async () => {
  const { ctx, usage } = mockContext([
    { id: "openai", name: "OpenAI", adapter: "openai", model: "mock-openai", priority: 2, enabled: true },
    { id: "openrouter", name: "OpenRouter", adapter: "openrouter", model: "mock/openrouter", priority: 1, enabled: true },
  ]);
  const originalFetch = globalThis.fetch;
  const attempts: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    attempts.push(url);
    if (url.startsWith("https://openrouter.ai/")) {
      return new Response(JSON.stringify({ error: { message: "rate limit" } }), {
        status: 429,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response(JSON.stringify({
      choices: [{ message: { content: "fallback worked" } }],
      usage: { prompt_tokens: 12, completion_tokens: 5 },
    }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  try {
    const answer = await completeWithProviders(ctx, "summary", [{ role: "user", content: "hello" }]);
    assertEquals(answer, "fallback worked", "fallback answer");
    assertEquals(attempts, [
      "https://openrouter.ai/api/v1/chat/completions",
      "https://api.openai.com/v1/chat/completions",
    ], "provider order");
    assertEquals(usage.length, 2, "usage records");
    assertIncludes(String(usage[0].error), "rate limit", "first provider error");
    assertEquals(usage[1].input_tokens, 12, "successful input token count");
  } finally {
    globalThis.fetch = originalFetch;
  }
}));

Deno.test("automatic routing does not restart after a streamed answer begins", withEnv({
  OPENROUTER_API_KEY: "test-openrouter",
  OPENAI_API_KEY: "test-openai",
}, async () => {
  const { ctx, usage } = mockContext([
    { id: "openrouter", name: "OpenRouter", adapter: "openrouter", model: "mock/openrouter", priority: 1, enabled: true },
    { id: "openai", name: "OpenAI", adapter: "openai", model: "mock-openai", priority: 2, enabled: true },
  ]);
  const originalFetch = globalThis.fetch;
  const attempts: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    attempts.push(String(input));
    return new Response(
      'data: {"choices":[{"delta":{"content":"partial answer"}}]}\n\n' +
      'data: {"error":{"message":"stream stopped"}}\n\n',
      { status: 200, headers: { "content-type": "text/event-stream" } },
    );
  }) as typeof fetch;
  try {
    let failed = false;
    try {
      await completeWithProviders(
        ctx,
        "conversation",
        [{ role: "user", content: "hello" }],
        async () => undefined,
      );
    } catch (error) {
      failed = true;
      assertIncludes(error instanceof Error ? error.message : String(error), "stream stopped", "stream error");
    }
    assertEquals(failed, true, "stream should fail");
    assertEquals(attempts.length, 1, "no duplicate provider attempt");
    assertEquals(usage.length, 1, "failed provider usage record");
  } finally {
    globalThis.fetch = originalFetch;
  }
}));

Deno.test("image requests skip providers without explicit vision support", async () => {
  const { ctx } = mockContext([
    { id: "openai", name: "OpenAI text model", adapter: "openai", model: "mock-openai", priority: 1, enabled: true, supports_vision: false },
  ]);
  let failed = false;
  try {
    await completeWithProviders(ctx, "summary", [{
      role: "user",
      content: [
        { type: "text", text: "Describe this image" },
        { type: "image_url", image_url: { url: "https://example.invalid/image.png" } },
      ],
    }]);
  } catch (error) {
    failed = true;
    assertIncludes(error instanceof Error ? error.message : String(error), "No enabled AI provider", "vision guard");
  }
  assertEquals(failed, true, "image should be rejected without vision provider");
});

Deno.test("compatible adapters reject unapproved secret variable names", withEnv({
  OPENAI_API_KEY: "test-openai",
}, async () => {
  const { ctx, usage } = mockContext([
    {
      id: "unsafe",
      name: "Unsafe compatible provider",
      adapter: "compatible",
      model: "mock-model",
      priority: 1,
      enabled: true,
      base_url: "https://api.deepseek.com/v1",
      secret_name: "SUPABASE_SERVICE_ROLE_KEY",
    },
  ]);
  let failed = false;
  try {
    await completeWithProviders(ctx, "summary", [{ role: "user", content: "hello" }]);
  } catch (error) {
    failed = true;
    assertIncludes(error instanceof Error ? error.message : String(error), "unsupported secret name", "secret allowlist");
  }
  assertEquals(failed, true, "unsafe secret name should be rejected");
  assertEquals(usage.length, 1, "configuration failure should be logged");
}));


Deno.test("compatible adapters reject arbitrary hosts and nonstandard ports", withEnv({
  DEEPSEEK_API_KEY: "test-deepseek",
}, async () => {
  for (const baseURL of [
    "https://attacker.example/v1",
    "https://api.deepseek.com:8443/v1",
  ]) {
    const { ctx, usage } = mockContext([
      {
        id: "compatible",
        name: "Compatible provider",
        adapter: "compatible",
        model: "mock-model",
        priority: 1,
        enabled: true,
        base_url: baseURL,
        secret_name: "DEEPSEEK_API_KEY",
      },
    ]);
    let failed = false;
    try {
      await completeWithProviders(ctx, "summary", [{ role: "user", content: "hello" }]);
    } catch (error) {
      failed = true;
      assertIncludes(
        error instanceof Error ? error.message : String(error),
        "approved HTTPS API host",
        "compatible URL allowlist",
      );
    }
    assertEquals(failed, true, "unsafe compatible URL should be rejected");
    assertEquals(usage.length, 1, "rejected URL should be logged");
  }
}));

Deno.test("invalid templates, mismatched secrets and provider 422s fall through to OpenAI", withEnv({
  GROQ_API_KEY: "test-groq", DEEPSEEK_API_KEY: "test-deepseek", OPENAI_API_KEY: "test-openai",
}, async () => {
  const { ctx, usage } = mockContext([
    { name: "Unconfigured", adapter: "openai", model: "YOUR_MODEL_ID", priority: 1 },
    { name: "Mismatched host", adapter: "compatible", secret_name: "GROQ_API_KEY", base_url: "https://api.deepseek.com/v1", model: "chat", priority: 2 },
    { name: "DeepSeek", adapter: "compatible", secret_name: "DEEPSEEK_API_KEY", base_url: "https://api.deepseek.com/v1", model: "unavailable", priority: 3 },
    { name: "OpenAI", adapter: "openai", model: "gpt-5-mini", priority: 4 },
  ]);
  const requests: { url: string; body: Record<string, unknown> }[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    requests.push({ url: String(input), body: JSON.parse(String(init?.body)) });
    if (String(input).includes("deepseek.com")) {
      return Response.json({ error: { message: "Unsupported model for test-deepseek" } }, { status: 422 });
    }
    return Response.json({ choices: [{ message: { content: "ok" } }] });
  };
  try {
    assertEquals(await completeWithProviders(ctx, "connection test", [{ role: "user", content: "hi" }]), "ok", "fallback");
    assertEquals(requests.map((x) => x.url), ["https://api.deepseek.com/v1/chat/completions", "https://api.openai.com/v1/chat/completions"], "outbound requests");
    assertEquals(requests[0].body.max_tokens, 120, "compatible token parameter");
    assertEquals(requests[1].body.max_completion_tokens, 1024, "reasoning budget");
    assertEquals("temperature" in requests[1].body || "max_tokens" in requests[1].body, false, "reasoning parameters");
    assertEquals(usage.length, 4, "usage attempts");
    assertIncludes(String(usage[0].error), "Enter a model ID", "template validation");
    assertIncludes(String(usage[1].error), "api.groq.com", "secret host binding");
    assertEquals(usage[2].error, "Unsupported model for [redacted]", "sanitized upstream error");
  } finally {
    globalThis.fetch = original;
  }
}));

Deno.test("Gemini server model and explicit overrides send version-compatible requests", withEnv({
  GEMINI_API_KEY: "test-gemini", GEMINI_CHAT_MODEL: "models/gemini-2.5-flash",
}, async () => {
  const original = globalThis.fetch;
  const requests: { url: string; config: Record<string, unknown> }[] = [];
  globalThis.fetch = async (input, init) => {
    requests.push({ url: String(input), config: JSON.parse(String(init?.body)).generationConfig });
    return Response.json({ candidates: [{ content: { parts: [{ thought: true, text: "thought" }, { text: "reply" }] } }] });
  };
  try {
    for (const model of ["GEMINI_CHAT_MODEL", "models/gemini-3-flash-preview"]) {
      const { ctx, usage } = mockContext([{ id: "g", name: "Gemini", adapter: "gemini", model }]);
      assertEquals(await completeWithProviders(ctx, "connection test", [{ role: "user", content: "hi" }], undefined, { providerId: "g" }), "reply", "visible reply");
      assertIncludes(requests.at(-1)!.url, "/models/" + usage[0].model + ":generateContent", "logged effective model");
    }
    assertIncludes(requests[0].url, "/models/gemini-2.5-flash:", "server setting");
    assertEquals(requests[0].config.thinkingConfig, undefined, "Gemini 2.x compatibility");
    assertEquals(requests[1].config.thinkingConfig, { thinkingLevel: "LOW" }, "Gemini 3 override");
  } finally {
    globalThis.fetch = original;
  }
}));

Deno.test("Claude accepts the highest temperature from the provider editor", withEnv({
  ANTHROPIC_API_KEY: "test-anthropic",
}, async () => {
  const { ctx } = mockContext([{ id: "c", name: "Claude", adapter: "anthropic", model: "claude", temperature: 2 }]);
  const original = globalThis.fetch;
  globalThis.fetch = async (_input, init) => {
    assertEquals(JSON.parse(String(init?.body)).temperature, 1, "Anthropic temperature");
    return Response.json({ content: [{ type: "text", text: "ok" }] });
  };
  try {
    assertEquals(await completeWithProviders(ctx, "connection test", [{ role: "user", content: "hi" }], undefined, { providerId: "c" }), "ok", "reply");
  } finally {
    globalThis.fetch = original;
  }
}));

Deno.test("Groq and OpenRouter use their own endpoints and server keys", withEnv({
  GROQ_API_KEY: "test-groq", OPENROUTER_API_KEY: "test-openrouter",
}, async () => {
  const original = globalThis.fetch;
  const requests: { url: string; authorization: string | null }[] = [];
  globalThis.fetch = async (input, init) => {
    requests.push({ url: String(input), authorization: new Headers(init?.headers).get("authorization") });
    return Response.json({ choices: [{ message: { content: "ok" } }] });
  };
  try {
    const { ctx } = mockContext([
      { id: "groq", name: "Groq", adapter: "compatible", model: "chat", base_url: "https://api.groq.com/openai/v1", secret_name: "GROQ_API_KEY" },
      { id: "router", name: "OpenRouter", adapter: "openrouter", model: "vendor/chat" },
    ]);
    for (const providerId of ["groq", "router"]) {
      await completeWithProviders(ctx, "connection test", [{ role: "user", content: "hi" }], undefined, { providerId });
    }
    assertEquals(requests, [
      { url: "https://api.groq.com/openai/v1/chat/completions", authorization: "Bearer test-groq" },
      { url: "https://openrouter.ai/api/v1/chat/completions", authorization: "Bearer test-openrouter" },
    ], "provider destinations");
  } finally {
    globalThis.fetch = original;
  }
}));

Deno.test("invalid local attachments stop before trying the next vision provider", withEnv({
  GEMINI_API_KEY: "test-gemini", OPENAI_API_KEY: "test-openai",
}, async () => {
  const { ctx, usage } = mockContext([
    { name: "Gemini", adapter: "gemini", model: "gemini-2.5-flash", priority: 1, supports_vision: true },
    { name: "OpenAI", adapter: "openai", model: "vision", priority: 2, supports_vision: true },
  ]);
  const original = globalThis.fetch;
  const attempts: string[] = [];
  globalThis.fetch = async (input) => {
    attempts.push(String(input));
    return new Response("invalid attachment", { headers: { "content-type": "text/plain" } });
  };
  try {
    const image = "https://example.invalid/object";
    const error = await completeWithProviders(ctx, "conversation", [{
      role: "user", content: [{ type: "image_url", image_url: { url: image } }],
    }]).catch((error: Error) => error.message);
    assertEquals(error, "Unsupported image attachment", "attachment failure");
    assertEquals(attempts, [image], "outbound requests");
    assertEquals(usage.length, 1, "provider attempts");
  } finally {
    globalThis.fetch = original;
  }
}));
