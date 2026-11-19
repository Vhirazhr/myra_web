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
