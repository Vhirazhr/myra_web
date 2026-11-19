import { checked, type Context, required } from "./backend.ts";
type Turn = {
  role: "system" | "user" | "assistant";
  content:
    | string
    | ({ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } })[];
};
const adapters: Record<string, { url: () => string; key: string }> = {
  openai: { url: () => "https://api.openai.com/v1", key: "OPENAI_API_KEY" },
  openrouter: { url: () => "https://openrouter.ai/api/v1", key: "OPENROUTER_API_KEY" },
  compatible: { url: () => required("AI_COMPATIBLE_BASE_URL"), key: "AI_COMPATIBLE_API_KEY" },
};
export async function completion(
  ctx: Context,
  operation: string,
  messages: Turn[],
  providerId?: string,
) {
  let q = ctx.db.from("providers").select("*").eq("owner_id", ctx.actor).order("priority").order(
    "id",
  );
  q = providerId ? q.eq("id", providerId) : q.eq("enabled", true);
  const providers = checked(await q.limit(8));
  if (!providers.length) throw new Error("Configure an AI provider and model first");
  const failures: string[] = [];
  for (const p of providers) {
    let content = "", input: number | null = null, output: number | null = null, err = "";
    try {
      const a = adapters[p.adapter];
      const configuredTemperature = Number(p.temperature ?? 0.7);
      const temperature = operation === "conversation"
        ? Math.max(configuredTemperature, 0.85)
        : operation === "initiative"
        ? Math.max(configuredTemperature, 0.88)
        : configuredTemperature;
      const maxTokens = operation === "conversation"
        ? 1000
        : operation === "initiative"
        ? 240
        : operation === "summary"
        ? 700
        : operation === "memory extraction"
        ? 120
        : 500;
      const res = await fetch(a.url().replace(/\/$/, "") + "/chat/completions", {
        method: "POST",
        headers: { Authorization: "Bearer " + required(a.key), "Content-Type": "application/json" },
        signal: AbortSignal.timeout(60000),
        body: JSON.stringify({
          model: p.model,
          messages,
          temperature,
          max_tokens: maxTokens,
        }),
      });
      if (!res.ok) throw new Error("Provider HTTP " + res.status);
      const data = await res.json();
      content = data.choices?.[0]?.message?.content?.trim() || "";
      if (!content) throw new Error("Provider returned no text");
      input = data.usage?.prompt_tokens ?? null;
      output = data.usage?.completion_tokens ?? null;
    } catch (e) {
      err = e instanceof SyntaxError
        ? "Invalid provider JSON"
        : e instanceof Error
        ? e.message
        : "Provider unavailable";
    }
    checked(
      await ctx.service.from("usage_logs").insert({
        owner_id: ctx.actor,
        operation,
        provider_id: p.id,
        model: p.model,
        input_tokens: input,
        output_tokens: output,
        cost: input !== null && output !== null &&
            (Number(p.input_price) > 0 || Number(p.output_price) > 0)
          ? (input * p.input_price + output * p.output_price) / 1e6
          : null,
        error: err,
      }),
    );
    if (!err) return content;
    failures.push(p.name + " — " + err);
  }
  throw new Error(failures.join(" · "));
}
export async function generate(ctx: Context, sourceId: string) {
  const { db, actor, service } = ctx;
  const source = checked(
    await db.from("messages").select("*").eq("owner_id", actor).eq("id", sourceId).eq(
      "role",
      "user",
    ).single(),
  );
  const thread = checked(
    await db.from("conversations").select("*").eq("id", source.conversation_id).single(),
  );
  const group = thread.group_id
    ? checked(await db.from("groups").select("name,mode").eq("id", thread.group_id).single())
    : null;
  const roster: string[] = group
    ? checked(
      await db.from("group_members").select("character_id").eq("group_id", thread.group_id).order(
        "created_at",
      ),
    ).map((r) => r.character_id)
    : [thread.character_id];
  const cast = source.mentions.length ? roster.filter((x) => source.mentions.includes(x)) : roster;
  if (!cast.length) throw new Error("No participants available for this message");
  if (cast.length > 8) throw new Error("Mention up to eight participants for this turn");
  const prefs = checked(await db.from("settings").select("*").eq("owner_id", actor).limit(1))[0];
  const world = thread.universe_id
    ? checked(
      await db.from("universes").select("name,rules,description").eq("id", thread.universe_id)
        .single(),
    )
    : null;
  const lore = world
    ? checked(
      await db.from("world_entries").select("name,kind,body").eq("universe_id", thread.universe_id)
        .order("created_at", { ascending: false }).limit(12),
    )
    : [];
  const crossover = thread.crossover_id
    ? checked(
      await db.from("crossovers").select("name,description").eq("id", thread.crossover_id).single(),
    )
    : null;
  const replies = [];
  for (const speaker of cast) {
    const existing = checked(
      await db.from("messages").select("id").eq("source_id", source.id).eq("character_id", speaker)
        .limit(1),
    );
    if (existing.length) {
      replies.push(existing[0].id);
      continue;
    }
    const job = "reply/" + source.id + "/" + speaker;
    const token = checked(await service.rpc("claim_ai_job", { actor, job }));
    if (!token) throw new Error("Response already processing. Refresh the conversation.");
    try {
      const profile = checked(
        await db.from("characters").select(
          "name,personality,pronouns,age,biography,background,appearance,relationship,communication,language,scenario",
        ).eq("id", speaker).neq("status", "archived").single(),
      );
      const memory = checked(
        await db.rpc("recall_memories", { thread: thread.id, speaker, query_text: source.body }),
      ) as { body: string }[];
      const past = checked(
        await db.from("messages").select("role,body,character_id,created_at").eq(
          "conversation_id",
          thread.id,
        ).lte("created_at", source.created_at).neq("id", source.id).order("created_at", {
          ascending: false,
        }).limit(24),
      ).reverse();
      const siblings = checked(
        await db.from("messages").select("body,character_id").eq("source_id", source.id).order(
          "created_at",
        ),
      );
      const participants = checked(await db.from("characters").select("id,name").in("id", roster));
      const nameOf = (cid: string) => participants.find((p) => p.id === cid)?.name ?? "User";
      const diary = checked(
        await db.from("diaries").select("name,mood,body").eq("character_id", speaker).order(
          "created_at",
          { ascending: false },
        ).limit(1),
      )[0];
      const relations = group && !world && !crossover
        ? checked(
          await db.from("relationships").select(
            "character_id,other_character_id,kind,trust,history",
          ).eq("owner_id", actor).or(
            "character_id.eq." + speaker + ",other_character_id.eq." + speaker,
          ),
        ).filter((r) => roster.includes(r.character_id) && roster.includes(r.other_character_id))
        : [];
      let turn: Turn["content"] = source.body +
        (siblings.length
          ? "\nGroup replies so far: " +
            siblings.map((m) => nameOf(m.character_id) + ": " + m.body).join("\n")
          : "");
      if (source.transcript) turn += "\nVoice note transcript: " + source.transcript;
      if (source.attachment && source.mime.startsWith("image/")) {
        const url = checked(
          await db.storage.from("conversation-media").createSignedUrl(source.attachment, 120),
        ).signedUrl;
        turn = [{ type: "text", text: turn }, { type: "image_url", image_url: { url } }];
      }
      const responseStyle = thread.mode === "immersion"
        ? "immersive"
        : thread.mode === "learning"
        ? "language-learning"
        : "hybrid";
      const roleplayRules = [
        "CORE IDENTITY: Stay faithful to the selected character's biography, background, appearance, personality, communication style, scenario, boundaries, and relationship setup. These fields are active instructions, not decorative profile text.",
        "HYBRID CONVERSATION: Default to natural, spontaneous chat. Use brief action beats or expressive dialogue when they add emotion, but do not turn every ordinary message into a long narrated scene. Expand into immersive roleplay when the user starts a scene, asks for detail, or the moment genuinely calls for it.",
        "NATURAL VARIATION: Vary openings, sentence rhythm, warmth, humor, and response length. Do not repeat stock greetings, the same catchphrase, or the same question pattern. Do not end every reply with a question. Avoid generic assistant phrases, summaries of what the user just said, and unnecessary disclaimers.",
        "CHARACTER AGENCY: The character may suggest activities, share an in-character thought, bring up a relevant shared memory, or gently initiate a new topic. Never dictate the user's actions, thoughts, feelings, or consent.",
        "RELATIONSHIP PROGRESSION: Treat the selected relationship stage as the last confirmed checkpoint, not a ceiling on subtle emotional development. Let closeness deepen only through repeated, reciprocal signals and meaningful shared moments. Show gradual changes in warmth, attention, vulnerability, and affection when the history supports them. Never jump directly to a confession, assume the user reciprocates, or claim the relationship is official until both have clearly agreed. The user can update the stage in conversation settings to record a milestone.",
        "SLOW BURN: If the relationship setup mentions friends-to-lovers or slow burn, begin with believable friendship. Let affection appear gradually through trust, teasing, concern, vulnerability, and continuity—not by instantly becoming possessive or romantic.",
        "AFFECTION AND BOUNDARIES: Be warm and expressive in the style configured for the character. Clinginess, jealousy, teasing, and affection must remain playful and respectful; never use guilt, pressure, threats, or controlling behavior.",
        "CHAT LENGTH: For casual chat, prefer a few natural sentences. For roleplay scenes, provide vivid but purposeful action and dialogue. Follow the character's configured response-length preference.",
        "CONTINUITY: Use recent messages and relevant memories. Remember promises, ongoing topics, relationship milestones, and preferences. Do not invent personal facts or claim an event happened unless it appears in the conversation or character's fictional setting.",
        "LANGUAGE: Follow the conversation language and the character's preferred language. Use casual Indonesian when configured; preserve distinctive expressions sparingly and naturally.",
        "MODE: " + responseStyle + ". In language-learning mode, gently support the learning goal without losing the character's voice.",
        "GROUP PLAY: When other characters are present, preserve each participant's distinct voice and do not speak for the user.",
      ].join("\n");
      const answer = await completion(ctx, "conversation", [
        {
          role: "system",
          content:
            roleplayRules + "\n\nCHARACTER AND SESSION CONTEXT:\n" +
            JSON.stringify({
              profile,
              relationship_stage: thread.relationship_stage || "Best friends",
              conversation_style: responseStyle,
              language: thread.language,
              group,
              world,
              lore,
              crossover,
              mood: world || crossover ? undefined : diary,
              relationships: relations,
              style: prefs?.system_prompt,
            }).slice(0, 28000),
        },
        ...past.map((m) => ({
          role: m.role as Turn["role"],
          content: (m.character_id ? nameOf(m.character_id) + ": " : "") + m.body,
        })),
        ...(memory.length
          ? [{
            role: "system" as const,
            content:
              "Saved context from previous conversations follows. First-person statements from the user describe the person speaking to you. Use relevant facts naturally; do not recite the memory list.\n" +
              memory.map((m: { body: string }) => "- " + m.body).join("\n").slice(0, 12000),
          }]
          : []),
        { role: "user", content: turn },
      ]);
      let fact = "", scope = "character";
      if (source.memory_mode === "remember") {
        fact = source.body;
        scope = "user";
      }
      if (["private", "automatic"].includes(source.memory_mode)) {
        const extracted = await completion(ctx, "memory extraction", [
          {
            role: "system",
            content:
              "Extract one durable fact explicitly stated by the user for future conversations. Reply with only that fact in a single short sentence. If the user asks a question or states no lasting fact, reply only NONE.",
          },
          { role: "user", content: source.body },
        ]);
        if (!/^NONE[.!]?$/i.test(extracted.trim())) fact = extracted;
        if (source.memory_mode === "private") scope = "thread_only";
      }
      const replyId = checked(
        await service.rpc("finish_ai_reply", {
          actor,
          job,
          token,
          source: source.id,
          speaker,
          answer,
          fact,
          fact_type: scope,
        }),
      );

      // Reuse previously generated media when the user explicitly asks for a photo/video.
      const requestText = (source.body || "").toLowerCase();
      const wantsVideo = /\b(video|vidio|clip|movie|rekaman)\b/.test(requestText);
      const wantsImage = /\b(photo|picture|image|selfie|foto|gambar)\b/.test(requestText);
      if (wantsVideo || wantsImage) {
        const candidates = checked(
          await db.from("media_assets").select("id,bucket,path,mime,name,description,tags")
            .eq("owner_id", actor).eq("character_id", speaker).eq("bucket", "stories")
            .order("created_at", { ascending: false }).limit(50),
        );
        const relevant = candidates
          .filter((asset) => wantsVideo ? asset.mime.startsWith("video/") : asset.mime.startsWith("image/"))
          .map((asset) => {
            const searchable = [asset.name, asset.description, ...(asset.tags || [])].join(" ").toLowerCase();
            const words = requestText.split(/[^a-z0-9]+/).filter((word) => word.length > 3);
            const score = words.reduce((total, word) => total + (searchable.includes(word) ? 2 : 0), 0);
            return { asset, score };
          })
          .sort((a, b) => b.score - a.score)[0]?.asset;
        if (relevant) {
          checked(
            await service.from("messages").update({
              attachment: relevant.path,
              attachment_bucket: relevant.bucket,
              mime: relevant.mime,
            }).eq("id", replyId).eq("owner_id", actor).select("id").single(),
          );
        }
      }
      replies.push(replyId);
    } catch (error) {
      checked(await service.rpc("release_ai_job", { actor, job, token }));
      throw error;
    }
  }
  return { replies };
}
