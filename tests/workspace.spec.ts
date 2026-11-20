import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
const url = process.env.VITE_SUPABASE_URL || "";
if (!url || !["127.0.0.1", "localhost"].includes(new URL(url).hostname))
  throw Error(
    "The fixture provisions disposable accounts on local Supabase. Set VITE_SUPABASE_URL to localhost.",
  );
const options = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
};
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, options);
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
const client = createClient(url, key, options),
  other = createClient(url, key, options);
const users: string[] = [];
const password = randomUUID() + "aA9!";
let email = "",
  owner = "";
function ok<T extends { error: unknown }>(r: T) {
  expect(r.error).toBeNull();
  return r;
}
async function provision(isAdmin: boolean) {
  const email = randomUUID() + "@myra.test";
  const user = ok(await admin.auth.admin.createUser({ email, password, email_confirm: true })).data
    .user!;
  users.push(user.id);
  if (isAdmin) ok(await admin.from("admin_access").insert({ user_id: user.id }));
  return { id: user.id, email };
}
test.beforeAll(async () => {
  const user = await provision(true);
  email = user.email;
  owner = user.id;
  ok(await client.auth.signInWithPassword({ email, password }));
});
test.afterAll(async () => {
  for (const id of users) {
    for (const bucket of [
      "character-avatars",
      "stories",
      "conversation-media",
      "voice-media",
      "universe-covers",
      "character-gallery",
    ]) {
      const list = ok(await admin.storage.from(bucket).list(id)).data || [];
      if (list.length)
        ok(await admin.storage.from(bucket).remove(list.map((o) => id + "/" + o.name)));
    }
    ok(await admin.auth.admin.deleteUser(id));
  }
});
async function login(p: Page, email: string) {
  await p.getByLabel("Email address").fill(email);
  await p.getByLabel("Password", { exact: true }).fill(password);
  await p.getByRole("button", { name: "Enter MYRA" }).click();
}
async function create(p: Page, name: string) {
  await p.getByRole("button", { name: "Create " + name, exact: true }).click();
  return p.getByRole("dialog");
}
async function submit(p: Page, name: string) {
  await p.getByRole("button", { name: "Save " + name, exact: true }).click();
  await expect(p.getByRole("dialog")).toHaveCount(0);
}
async function character(p: Page, name: string) {
  await p.goto("/character-new");
  await p.getByLabel("Character name").fill(name);
  for (let step = 0; step < 7; step++)
    await p.getByRole("button", { name: "Continue", exact: true }).click();
  await p.getByRole("button", { name: "Save character", exact: true }).click();
  await expect(p.getByRole("button", { name, exact: true })).toBeVisible();
}
test("admin workspace persists across refresh and a fresh authenticated session", async ({
  page,
  browser,
}) => {
  let first = "",
    second = "",
    world = "",
    group = "",
    thread = "",
    storyId = "";
  await test.step("1 · protected login and session refresh", async () => {
    await page.goto("/characters");
    await login(page, email);
    await expect(page.getByRole("heading", { name: "All Characters" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "All Characters" })).toBeVisible();
  });
  await test.step("2 · create, edit and persist characters", async () => {
    await character(page, "Aruna");
    await character(page, "Sora");
    const row = page
      .locator("article")
      .filter({ has: page.getByRole("button", { name: "Aruna", exact: true }) });
    await row.getByTitle("Edit character").click();
    await page.getByLabel("Biography").fill("A thoughtful fictional botanist.");
    await submit(page, "character");
    await page.reload();
    await page.getByRole("button", { name: "Aruna", exact: true }).click();
    await expect(page.getByText("A thoughtful fictional botanist.")).toBeVisible();
    await page.getByLabel("Close dialog").click();
    const records = ok(await client.from("characters").select("*")).data!;
    first = records.find((r) => r.name === "Aruna").id;
    second = records.find((r) => r.name === "Sora").id;
  });
  await test.step("3 · universe, roster, lore and timeline", async () => {
    await page.goto("/universe-new");
    await page.getByLabel("Universe name").fill("Garden");
    await page.getByLabel("World rules").fill("Every comet blooms.");
    await page.getByLabel("Character roster").selectOption([first, second]);
    await page.getByRole("button", { name: "Save universe" }).click();
    await expect(page.getByRole("button", { name: "Garden", exact: true })).toBeVisible();
    world = ok(await client.from("universes").select("id").single()).data!.id;
    for (const [route, name, title] of [
      ["lore", "lore entry", "Comet flowers"],
      ["timeline", "timeline event", "First bloom"],
    ]) {
      await page.goto("/" + route);
      const d = await create(page, name);
      await d.getByLabel("Universe", { exact: true }).selectOption(world);
      await d.getByLabel("Title").fill(title);
      if (route === "timeline") await d.getByLabel("Event date").fill("2026-07-01");
      await submit(page, name);
      await expect(page.getByRole("button", { name: title, exact: true })).toBeVisible();
    }
    expect(
      ok(await client.from("universe_characters").select("id").eq("universe_id", world)).data,
    ).toHaveLength(2);
  });
  await test.step("6 · group membership and conversation mode", async () => {
    await page.goto("/groups");
    const d = await create(page, "group");
    await d.getByLabel("Group name").fill("Stargazers");
    await d.getByLabel("Conversation mode").selectOption("Hybrid");
    await d.getByLabel("Character roster").selectOption([first, second]);
    await submit(page, "group");
    await page.reload();
    await expect(page.getByRole("button", { name: "Stargazers", exact: true })).toBeVisible();
    group = ok(await client.from("groups").select("id").eq("mode", "Hybrid").single()).data!.id;
    expect(
      ok(await client.from("group_members").select("id").eq("group_id", group)).data,
    ).toHaveLength(2);
  });
  await test.step("7 · private upload, story publication and social activity", async () => {
    await page.goto("/stories");
    const d = await create(page, "story");
    await d.getByLabel("Story title").fill("First light");
    await d.getByLabel("Author", { exact: true }).selectOption(first);
    await d.getByLabel("Caption").fill("The garden at dawn.");
    await d.getByLabel("Photo or video").setInputFiles({
      name: "dawn.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+yL1sAAAAASUVORK5CYII=",
        "base64",
      ),
    });
    await d.getByLabel("Publication").selectOption("published");
    await submit(page, "story");
    await page.getByRole("button", { name: "First light", exact: true }).click();
    await expect(
      page.getByRole("dialog").getByRole("img", { name: "Uploaded media" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Like", exact: true }).click();
    await expect(page.getByRole("button", { name: "Unlike" })).toBeVisible();
    await page.getByLabel("Reply", { exact: true }).fill("Beautiful.");
    await page.getByRole("button", { name: "Send reply" }).click();
    await expect(page.getByText("Beautiful.", { exact: true })).toBeVisible();
    const s = ok(await client.from("stories").select("*").single()).data!;
    storyId = s.id;
    expect(ok(await client.storage.from("stories").download(s.media)).data!.size).toBeGreaterThan(
      0,
    );
  });
  await test.step("8 · relationship graph and history", async () => {
    await page.goto("/social");
    const d = await create(page, "relationship");
    await d.getByLabel("Character", { exact: true }).selectOption(first);
    await d.getByLabel("Related character").selectOption(second);
    await d.getByLabel("Trust").fill("81");
    await submit(page, "relationship");
    await page.reload();
    await expect(page.locator(".graph-canvas line")).toHaveCount(1);
    expect(
      ok(await client.from("interactions").select("*").eq("kind", "change")).data![0].name,
    ).toContain("81");
  });
  await test.step("10 · fresh browser session reads the same records", async () => {
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    const next = await browser.newPage();
    await next.goto("/stories");
    await login(next, email);
    await expect(next.getByRole("button", { name: "First light", exact: true })).toBeVisible();
    await next.close();
    expect(
      ok(await client.from("story_activity").select("id").eq("story_id", storyId)).data!.length,
    ).toBeGreaterThanOrEqual(3);
  });
});
test("9 · non-admin and second admin cannot access or modify private data", async ({ page }) => {
  const unpriv = await provision(false);
  await page.goto("/dashboard");
  await login(page, unpriv.email);
  await expect(page.getByRole("heading", { name: "Access restricted" })).toBeVisible();
  ok(await other.auth.signInWithPassword({ email: unpriv.email, password }));
  expect(ok(await other.rpc("is_myra_admin")).data).toBe(false);
  expect((await other.from("admin_access").insert({ user_id: unpriv.id })).error).toBeTruthy();
  expect((await other.from("characters").insert({ name: "Denied" })).error).toBeTruthy();
  expect(ok(await other.from("characters").select("*")).data).toEqual([]);
  const second = await provision(true);
  ok(await other.auth.signInWithPassword({ email: second.email, password }));
  expect(ok(await other.from("stories").select("*").eq("owner_id", owner)).data).toEqual([]);
  const record = ok(
    await client.from("characters").insert({ name: "Private fixture" }).select().single(),
  ).data!;
  expect(
    (await other.from("conversations").insert({ name: "Invalid", character_id: record.id })).error,
  ).toBeTruthy();
  expect(
    ok(
      await other.from("characters").update({ name: "Change denied" }).eq("id", record.id).select(),
    ).data,
  ).toEqual([]);
  const anon = createClient(url, key, options);
  expect((await anon.from("characters").select("*")).error).toBeTruthy();
});
test("4–5 · Gemini inference, persisted memory, scoped retrieval and group reply", async ({
  page,
}) => {
  test.skip(
    !process.env.MYRA_E2E_GEMINI && !process.env.MYRA_E2E_MODEL,
    "Set MYRA_E2E_GEMINI and configure GEMINI_API_KEY in the local Edge Function environment.",
  );
  const r = ok(
    await client
      .from("characters")
      .insert({ name: "Mira", biography: "Fictional companion who remembers favorite things." })
      .select()
      .single(),
  ).data!;
  await page.goto("/google-ai");
  await login(page, email);
  await page.getByRole("button", { name: "Test Gemini connection" }).click();
  await expect(page.getByRole("status")).toContainText(/MYRA|Gemini|Google/i, { timeout: 95000 });
  await page.goto("/chat");
  const form = await create(page, "conversation");
  await form.getByLabel("Conversation title").fill("Memory test");
  await form.getByLabel("Character", { exact: true }).selectOption(r.id);
  await form.getByLabel("Language", { exact: true }).fill("English");
  await form.getByRole("button", { name: "Save conversation" }).click();
  await page.getByLabel("Memory for this turn").selectOption("remember");
  await page
    .getByLabel("Message", { exact: true })
    .fill("Please remember this personal preference: my favorite flower is jasmine.");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.locator(".ai-bubble")).toHaveCount(1, { timeout: 95000 });
  const thread = ok(
    await client.from("conversations").select("id").eq("name", "Memory test").single(),
  ).data!.id;
  await expect.poll(async () => {
    const r = await client.from("memories").select("id").not("source_id", "is", null);
    if (r.error) throw r.error;
    return r.data?.length || 0;
  }, { timeout: 30000 }).toBeGreaterThan(0);
  const memories = ok(await client.from("memories").select("*").not("source_id", "is", null)).data!;
  expect(memories.length).toBeGreaterThan(0);
  const later = ok(
    await client
      .from("conversations")
      .insert({ name: "Later session", character_id: r.id, language: "English" })
      .select()
      .single(),
  ).data!;
  const recalled = ok(
    await client.rpc("recall_memories", {
      thread: later.id,
      speaker: r.id,
      query_text: "Which flower do I like?",
    }),
  ).data;
  expect(recalled.some((m: any) => memories.some((n) => m.id === n.id))).toBe(true);
  await page.goto("/chat/" + later.id);
  await page.getByLabel("Message", { exact: true }).fill("Which flower is my favorite?");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.locator(".ai-bubble")).toContainText(/\bjasmin(?:e)?\b/i, { timeout: 95000 });
  await page.reload();
  await expect(page.locator(".ai-bubble")).toHaveCount(1);
  expect(
    ok(await client.from("usage_logs").select("*").eq("operation", "conversation").eq("error", ""))
      .data!.length,
  ).toBeGreaterThanOrEqual(2);
  const companion = ok(
    await client.from("characters").insert({ name: "Rani" }).select().single(),
  ).data!;
  const group = ok(
    await client.rpc("save_roster", {
      target: "groups",
      record_id: null,
      fields: { name: "Garden group", mode: "Natural Chat" },
      members: [r.id, companion.id],
    }),
  ).data;
  const g = ok(
    await client
      .from("conversations")
      .insert({ name: "Group chat", group_id: group })
      .select()
      .single(),
  ).data!;
  await page.goto("/chat/" + g.id);
  await page.getByLabel("Mention participants").selectOption([r.id, companion.id]);
  await page.getByLabel("Message", { exact: true }).fill("Hello Mira and Rani!");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.locator(".ai-bubble")).toHaveCount(2, { timeout: 95000 });
  const source = ok(
    await client
      .from("messages")
      .select("id")
      .eq("conversation_id", g.id)
      .eq("role", "user")
      .single(),
  ).data!;
  const retry = await client.functions.invoke("myra", {
    body: { action: "generate", id: source.id },
  });
  if (retry.error)
    throw new Error(
      "Retry failed: " + ((await retry.error.context?.text()) || retry.error.message),
    );
  expect(retry.data.replies).toHaveLength(2);
  expect(
    ok(await client.from("messages").select("id").eq("source_id", source.id)).data,
  ).toHaveLength(2);
});
test("two browser tabs receive the same realtime character update", async ({ page, context }) => {
  await page.goto("/characters");
  await login(page, email);
  await expect(page.getByText("Live updates", { exact: true })).toBeVisible({ timeout: 40000 });
  const writer = await context.newPage();
  await character(writer, "Realtime Lily");
  await expect(page.getByRole("button", { name: "Realtime Lily", exact: true })).toBeVisible({
    timeout: 10000,
  });
});
test("simulation executes due schedules once, records milestones, pauses and restores a snapshot", async ({
  page,
}) => {
  const c = ok(
    await client
      .from("characters")
      .insert([{ name: "Daylight" }, { name: "Nightfall" }])
      .select(),
  ).data!;
  const r = ok(
    await client
      .from("relationships")
      .insert({ character_id: c[0].id, other_character_id: c[1].id })
      .select()
      .single(),
  ).data!;
  ok(
    await client.from("schedules").insert({
      character_id: c[0].id,
      relationship_id: r.id,
      milestone: true,
      at_time: "00:00",
      name: "Morning visit",
      activity: "Met at the garden.",
      mood: "joyful",
    }),
  );
  await page.goto("/simulation");
  await login(page, email);
  await page.getByLabel("Enable background simulation").check();
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByRole("button", { name: "Run due activities" })).toBeEnabled();
  await page.getByRole("button", { name: "Run due activities" }).click();
  await expect(page.getByText("1 activities recorded", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Run due activities" }).click();
  await expect(page.getByText("0 activities recorded", { exact: true })).toBeVisible();
  expect(
    ok(
      await client
        .from("interactions")
        .select("*")
        .eq("relationship_id", r.id)
        .eq("kind", "milestone"),
    ).data,
  ).toHaveLength(1);
  await page.getByLabel("Enable background simulation").uncheck();
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByRole("button", { name: "Run due activities" })).toBeDisabled();
  await page.goto("/backup");
  await page.getByRole("button", { name: "Create snapshot" }).click();
  await expect(page.getByText("Snapshot created", { exact: true })).toBeVisible();
  ok(await client.from("characters").delete().eq("id", c[0].id));
  await page.getByRole("button", { name: "Restore", exact: true }).first().click();
  await page.getByRole("button", { name: "Confirm restore" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(ok(await client.from("characters").select("id").eq("id", c[0].id)).data).toHaveLength(1);
  expect(
    ok(await client.from("diaries").select("*").eq("character_id", c[0].id)).data![0].mood,
  ).toBe("joyful");
});
test("canonical universe and crossover memory and story feeds stay isolated", async () => {
  const c = ok(
    await client.from("characters").insert({ name: "World traveler" }).select().single(),
  ).data!;
  const worlds = ok(
    await client
      .from("universes")
      .insert([{ name: "Dawn" }, { name: "Dusk" }])
      .select(),
  ).data!;
  const cross = ok(
    await client
      .from("crossovers")
      .insert({
        name: "Between worlds",
        universe_id: worlds[0].id,
        other_universe_id: worlds[1].id,
      })
      .select()
      .single(),
  ).data!;
  const cs = ok(
    await client
      .from("conversations")
      .insert([
        { name: "Dawn chat", character_id: c.id, universe_id: worlds[0].id },
        { name: "Dusk chat", character_id: c.id, universe_id: worlds[1].id },
        { name: "Crossover chat", character_id: c.id, crossover_id: cross.id },
      ])
      .select(),
  ).data!;
  ok(
    await client.from("memories").insert([
      { body: "Dawn canon", scope: "universe", universe_id: worlds[0].id },
      { body: "Dusk canon", scope: "universe", universe_id: worlds[1].id },
      { body: "Crossover canon", scope: "crossover", crossover_id: cross.id },
    ]),
  );
  for (const [i, expected] of ["Dawn canon", "Dusk canon", "Crossover canon"].entries()) {
    expect(
      ok(
        await client.rpc("recall_memories", {
          thread: cs[i].id,
          speaker: c.id,
          query_text: "canon",
        }),
      ).data.map((r: any) => r.body),
    ).toEqual([expected]);
  }
  const live = {
    name: "Dawn sunrise",
    character_id: c.id,
    status: "published",
    audience: "universe",
    universe_id: worlds[0].id,
  };
  ok(
    await client
      .from("stories")
      .insert(
        [
          live,
          { ...live, name: "Past", publish_at: "2020-01-01", expires_at: "2020-01-02" },
          { ...live, name: "Draft", status: "draft" },
        ],
        { defaultToNull: false },
      ),
  );
  expect(
    ok(await client.rpc("story_feed", { for_universe: worlds[0].id })).data.map((r: any) => r.name),
  ).toEqual(["Dawn sunrise"]);
  expect(ok(await client.rpc("story_feed", { for_universe: worlds[1].id })).data).toEqual([]);
});
test("password recovery updates credentials and restricted APIs reject unauthenticated requests", async ({
  page,
}) => {
  const person = await provision(true);
  const link = ok(await admin.auth.admin.generateLink({ type: "recovery", email: person.email }))
    .data.properties!;
  const recovered = ok(
    await other.auth.verifyOtp({ token_hash: link.hashed_token, type: "recovery" }),
  ).data.session!;
  // Simulate the email provider's validated redirect. Supabase Auth issued both tokens.
  const hash = new URLSearchParams({
    type: "recovery",
    access_token: recovered.access_token,
    refresh_token: recovered.refresh_token,
    expires_in: "3600",
    token_type: "bearer",
  });
  await page.goto("/recover#" + hash.toString());
  await page.getByLabel("New password").fill(password + "2");
  await page.getByRole("button", { name: "Save password", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
  expect(
    (await other.auth.signInWithPassword({ email: person.email, password })).error,
  ).toBeTruthy();
  ok(await other.auth.signInWithPassword({ email: person.email, password: password + "2" }));
  const anon = createClient(url, key, options);
  expect(
    (await anon.functions.invoke("myra", { body: { action: "simulation" } })).error,
  ).toBeTruthy();
  expect((await client.functions.invoke("worker", { body: {} })).error).toBeTruthy();
});
test("worker runs due schedules with the browser closed and respects quiet hours", async () => {
  const token = process.env.MYRA_WORKER_TOKEN;
  test.skip(!token, "Set the local worker token to test scheduled execution.");
  const ch = ok(
    await client.from("characters").insert({ name: "Night shift" }).select().single(),
  ).data!;
  const pref = ok(await client.from("settings").select("*").maybeSingle()).data;
  ok(
    await client.from("settings").upsert(
      {
        ...(pref ? { id: pref.id } : {}),
        simulation: true,
        proactive: true,
        quiet_start: "00:00",
        quiet_end: "23:59",
        timezone: "UTC",
      },
      { onConflict: "owner_id" },
    ),
  );
  ok(
    await client
      .from("schedules")
      .insert({ character_id: ch.id, name: "Night journal", at_time: "00:00" }),
  );
  const thread = ok(
    await client
      .from("conversations")
      .insert({
        character_id: ch.id,
        name: "Quiet thread",
        proactive: true,
        created_at: "2020-01-01",
      })
      .select()
      .single(),
  ).data!;
  const tick = async () => {
    const r = await fetch(url + "/functions/v1/worker", {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    expect(r.status).toBe(200);
    return r.json();
  };
  expect((await tick()).activities).toBeGreaterThanOrEqual(1);
  expect((await tick()).activities).toBe(0);
  expect(ok(await client.from("diaries").select("*").eq("character_id", ch.id)).data).toHaveLength(
    1,
  );
  expect(
    ok(await client.from("messages").select("id").eq("conversation_id", thread.id)).data,
  ).toEqual([]);
  if (process.env.MYRA_E2E_MODEL) {
    ok(
      await client
        .from("settings")
        .update({ quiet_end: "00:00", frequency_hours: 1 })
        .eq("owner_id", owner),
    );
    if (!ok(await client.from("providers").select("id").limit(1)).data?.length)
      ok(
        await client.from("providers").insert({
          name: "Worker inference",
          adapter: process.env.MYRA_E2E_ADAPTER || "compatible",
          model: process.env.MYRA_E2E_MODEL,
        }),
      );
    expect((await tick()).initiatives).toBe(1);
    expect((await tick()).initiatives).toBe(0);
    expect(
      ok(await client.from("notifications").select("id").eq("conversation_id", thread.id)).data,
    ).toHaveLength(1);
  }
});


test("responsive shell keeps navigation, search and page motion usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/characters");
  await login(page, email);
  await expect(page.getByRole("heading", { name: "All Characters" })).toBeVisible();
  await expect(page.getByLabel("Search workspace")).toBeVisible();
  await expect(page.getByRole("button", { name: "Open navigation" })).toBeVisible();

  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible();
  await page.getByRole("button", { name: "All Characters", exact: true }).click();
  await expect(page.getByRole("heading", { name: "All Characters" })).toBeVisible();

  const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(mobileOverflow).toBe(false);
  const pageAnimation = await page.locator(".page").first().evaluate((element) => getComputedStyle(element).animationName);
  expect(pageAnimation).toBe("myra-page-in");

  await page.setViewportSize({ width: 768, height: 1024 });
  await expect(page.getByLabel("Search workspace")).toBeVisible();
  const tabletOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(tabletOverflow).toBe(false);

  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.getByLabel("Search workspace")).toBeVisible();
  await expect(page.getByRole("button", { name: "Open navigation" })).toHaveCount(0);
  const desktopOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(desktopOverflow).toBe(false);

  await page.emulateMedia({ reducedMotion: "reduce" });
  const reducedDuration = await page.locator(".page").first().evaluate((element) => getComputedStyle(element).animationDuration);
  expect(parseFloat(reducedDuration)).toBeLessThan(0.001);

  await page.goto("/character-new");
  await expect(page.getByRole("button", { name: "8 Scenario" })).toBeDisabled();
  await page.getByLabel("Character name").fill("Wizard navigation check");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("button", { name: "3 Personality" })).toBeDisabled();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("heading", { name: "All Characters" })).toBeVisible();
});


test("brand logo and image fields use the MYRA visual system", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/character-new");
  await login(page, email);
  await expect(page.getByRole("heading", { name: "Create Character" })).toBeVisible();

  const logo = page.locator(".side-brand .brand-mark");
  await expect(logo).toBeVisible();
  const logoBox = await logo.boundingBox();
  expect(logoBox?.width).toBeGreaterThanOrEqual(48);
  expect(logoBox?.height).toBeGreaterThanOrEqual(48);
  await expect(page.locator(".side-brand .brand-mark img")).toHaveAttribute("src", "/myra-logo.png");

  await expect(page.getByText("Portrait", { exact: true })).toBeVisible();
  await expect(page.locator(".file-picker-dropzone")).toBeVisible();
  const input = page.locator(".file-picker-input").first();
  await expect(input).toBeAttached();
  await input.setInputFiles({
    name: "myra-portrait.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p1sAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await expect(page.getByText("myra-portrait.png")).toBeVisible();
  await expect(page.locator(".file-picker-preview img")).toBeVisible();

  await page.goto("/universe-new");
  await expect(page.getByText("World cover", { exact: true })).toBeVisible();
  await expect(page.locator(".file-picker-dropzone")).toBeVisible();
});


test("conversation settings stays above app chrome and validates fields inline", async ({ page }) => {
  await page.goto("/characters");
  await login(page, email);
  const characterName = "Conversation UX " + randomUUID().slice(0, 6);
  await character(page, characterName);

  await page.goto("/chat");
  const form = await create(page, "conversation");
  await form.getByLabel("Conversation title").fill("Settings UX check");
  await form.getByLabel("Character", { exact: true }).selectOption({ label: characterName });
  await form.getByRole("button", { name: "Save conversation" }).click();
  await expect(page.getByRole("heading", { name: "Settings UX check" })).toBeVisible();

  await page.getByRole("button", { name: "Settings" }).click();
  const dialog = page.getByRole("dialog", { name: "Conversation settings" });
  await expect(dialog).toBeInViewport();
  const title = dialog.getByLabel("Conversation title");
  await title.fill("");
  await dialog.getByRole("button", { name: "Save conversation" }).click();

  await expect(dialog.getByText("Conversation title is required.", { exact: true })).toBeVisible();
  await expect(title).toHaveAttribute("aria-invalid", "true");
  await expect(title).toBeInViewport();
  expect(await title.evaluate((element: HTMLInputElement) => element.validationMessage)).toBe("");

  const proactive = dialog.getByRole("switch", { name: "Allow character-initiated messages" });
  const toggle = await proactive.boundingBox();
  expect(toggle?.width).toBe(42);
  expect(toggle?.height).toBe(24);
});
