import { completeWithProviders } from "./ai-providers.ts";
import { checked, HttpError, type Context, required } from "./backend.ts";
type Turn = {
  role: "system" | "user" | "assistant";
  content:
    | string
    | ({ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } })[];
};
function encodeBase64(bytes: Uint8Array) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
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
    if (!response.ok) throw new Error("Could not load the attached image for Gemini");
    const mimeType = (response.headers.get("content-type") || "image/jpeg").split(";")[0];
    if (!mimeType.startsWith("image/")) throw new Error("Unsupported image attachment");
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > 12 * 1024 * 1024) {
      throw new Error("Image attachments for AI analysis must be 12 MB or smaller");
    }
    parts.push({ inlineData: { mimeType, data: encodeBase64(bytes) } });
  }
  return parts;
}
export async function completion(
  ctx: Context,
  operation: string,
  messages: Turn[],
  onDelta?: (answer: string) => Promise<void>,
  _internalAttempt = 0,
  options: { providerId?: string; adapter?: string } = {},
) {
  return completeWithProviders(ctx, operation, messages, onDelta, options);
}

type MemoryTask = {
  id: string;
  owner_id: string;
  source_message_id: string;
  memory_mode: "automatic" | "remember" | "private";
  attempts: number;
};

export async function processMemoryTasks(db: Context["db"], batchSize = 2) {
  const tasks = checked(
    await db.rpc("claim_memory_tasks", { batch_size: batchSize }),
  ) as MemoryTask[];
  let completed = 0;
  for (const task of tasks) {
    try {
      const source = checked(
        await db.from("messages").select("body").eq("id", task.source_message_id)
          .eq("owner_id", task.owner_id).single(),
      );
      let fact = "";
      if (task.memory_mode !== "remember") {
        fact = await completion(
          { db, service: db, actor: task.owner_id },
          "memory extraction",
          [
            {
              role: "system",
              content:
                "Extract one durable fact explicitly stated by the user for future conversations. Reply with only that fact in a single short sentence. If the user asks a question or states no lasting fact, reply only NONE.",
            },
            { role: "user", content: source.body },
          ],
        );
      }
      checked(await db.rpc("finish_memory_task", { task_id: task.id, fact }));
      completed++;
    } catch (error) {
      const retryable = !(error instanceof HttpError) ||
        [429, 502, 503, 504].includes(error.status);
      const retry = retryable && task.attempts < 4;
      const delaySeconds = Math.min(60 * (2 ** Math.max(0, task.attempts - 1)), 900);
      const message = error instanceof Error ? error.message : "Memory processing failed";
      const update = await db.from("memory_tasks").update({
        status: retry ? "pending" : "failed",
        available_at: new Date(Date.now() + delaySeconds * 1000).toISOString(),
        last_error: message.slice(0, 1000),
        updated_at: new Date().toISOString(),
      }).eq("id", task.id).eq("status", "processing").select("id").maybeSingle();
      if (update.error) {
        console.error("[MYRA] Could not update memory task status", update.error.message);
      }
      console.error("[MYRA] Memory task failed", {
        task: task.id,
        attempt: task.attempts,
        retry,
        error: message,
      });
    }
  }
  return completed;
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
      await db.from("messages").select("id,body,is_streaming").eq("source_id", source.id)
        .eq("character_id", speaker).limit(1),
    );
    if (existing.length && !existing[0].is_streaming) {
      replies.push(existing[0].id);
      continue;
    }
    const job = "reply/" + source.id + "/" + speaker;
    const claim = await service.rpc("claim_ai_job", { actor, job });
    if (claim.error) throw new Error(claim.error.message);
    if (!claim.data) {
      // The first request may have completed between the initial read and the claim.
      const completed = checked(await db.from("messages").select("id")
        .eq("source_id", source.id).eq("character_id", speaker).eq("is_streaming", false).limit(1));
      if (completed.length) {
        replies.push(completed[0].id);
        continue;
      }
      throw new HttpError(409, "A response is still being generated for this message.");
    }
    const token = claim.data;
    let streamedReplyId: string | null = null;
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
        }).limit(16),
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
      const requestText = (source.body || "").toLowerCase();
      const wantsVideo = /\b(video|vidio|clip|klip|movie|rekaman)\b/.test(requestText);
      const wantsImage = /\b(pict|photo|picture|image|selfie|foto|gambar|potret)\b/.test(requestText);
      let mediaAsset: {
        id: string;
        bucket: string;
        path: string;
        mime: string;
        name: string;
        description: string;
      } | null = null;
      if (wantsVideo || wantsImage) {
        const candidates = checked(
          await db.from("media_assets").select("id,bucket,path,mime,name,description,tags")
            .eq("owner_id", actor).eq("character_id", speaker).eq("bucket", "stories")
            .order("created_at", { ascending: false }).limit(50),
        );
        mediaAsset = candidates
          .filter((asset) => wantsVideo ? asset.mime.startsWith("video/") : asset.mime.startsWith("image/"))
          .map((asset) => {
            const searchable = [asset.name, asset.description, ...(asset.tags || [])].join(" ").toLowerCase();
            const words: string[] = requestText.split(/[^a-z0-9]+/).filter((word: string) => word.length > 3);
            const score = words.reduce(
              (total: number, word: string) => total + (searchable.includes(word) ? 2 : 0),
              0,
            );
            return { asset, score };
          })
          .sort((a, b) => b.score - a.score)[0]?.asset || null;
      }
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
        "MEDIA HONESTY: If the user asks for a photo or video, only say it is attached when session context confirms a matching saved media asset will be attached. If none is available, be honest and do not pretend to send a file.",
        "GROUP PLAY: When other characters are present, preserve each participant's distinct voice and do not speak for the user.",
      ].join("\n");
      let lastPersistedLength = 0;
      let lastPersistedAt = 0;
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
              media_request: wantsVideo ? "video" : wantsImage ? "image" : null,
              media_available: Boolean(mediaAsset),
              media_asset_description: mediaAsset
                ? { name: mediaAsset.name, description: mediaAsset.description, mime: mediaAsset.mime }
                : null,
              style: prefs?.system_prompt,
            }).slice(0, 18000),
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
              memory.map((m: { body: string }) => "- " + m.body).join("\n").slice(0, 8000),
          }]
          : []),
        { role: "user", content: turn },
      ], async (partial) => {
        const now = Date.now();
        if (
          !streamedReplyId ||
          partial.length - lastPersistedLength >= 120 ||
          now - lastPersistedAt >= 750
        ) {
          if (!streamedReplyId) {
            const started = await service.rpc("start_ai_reply", {
              actor,
              job,
              token,
              source: source.id,
              speaker,
            });
            if (started.error) throw new Error(started.error.message);
            streamedReplyId = started.data as string;
          }
          const updated = await service.rpc("update_ai_reply", {
            actor,
            job,
            token,
            reply: streamedReplyId,
            answer: partial,
          });
          if (updated.error) throw new Error(updated.error.message);
          lastPersistedLength = partial.length;
          lastPersistedAt = now;
        }
      });
      const replyId = checked(
        await service.rpc("finish_ai_reply", {
          actor,
          job,
          token,
          source: source.id,
          speaker,
          answer,
          fact: "",
          fact_type: source.memory_mode || "off",
        }),
      );
      const edgeRuntime = (globalThis as unknown as {
        EdgeRuntime?: { waitUntil(promise: Promise<unknown>): void };
      }).EdgeRuntime;
      if (source.memory_mode && source.memory_mode !== "off" && edgeRuntime) {
        edgeRuntime.waitUntil(
          processMemoryTasks(service, 1).catch((error) => {
            console.error("[MYRA] Background memory processing failed", {
              error: error instanceof Error ? error.message : "Unknown memory worker error",
            });
          }),
        );
      }

      if (mediaAsset) {
        checked(
          await service.from("messages").update({
            attachment: mediaAsset.path,
            attachment_bucket: mediaAsset.bucket,
            mime: mediaAsset.mime,
          }).eq("id", replyId).eq("owner_id", actor).select("id").single(),
        );
      }
      replies.push(replyId);
    } catch (error) {
      if (streamedReplyId) {
        const discarded = await service.from("messages").delete().eq("id", streamedReplyId)
          .eq("owner_id", actor).eq("is_streaming", true);
        if (discarded.error) {
          console.error("[MYRA] Could not remove incomplete streamed reply", discarded.error.message);
        }
      }
      checked(await service.rpc("release_ai_job", { actor, job, token }));
      throw error;
    }
  }
  return { replies };
}
