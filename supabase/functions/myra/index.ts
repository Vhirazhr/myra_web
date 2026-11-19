import { authorize, checked, endpoint, HttpError, id, required } from "../_shared/backend.ts";
import { completion, generate } from "../_shared/ai.ts";
export const handler = endpoint(async (req) => {
  const ctx = await authorize(req), { db, actor, service } = ctx;
  if (!checked(await service.rpc("admit_myra_request", { actor }))) {
    throw new HttpError(429, "Too many requests. Try again in one minute.");
  }
  const b = await req.json();
  if (b.action === "generate") return generate(ctx, id(b.id));
  if (b.action === "test-provider") {
    return {
      text: await completion(ctx, "connection test", [{
        role: "user",
        content: "Reply with a short connection confirmation.",
      }], id(b.id)),
    };
  }
  if (b.action === "simulation") {
    return { processed: checked(await service.rpc("tick_simulation", { actor })) };
  }
  if (b.action === "summarize") {
    const thread = checked(await db.from("conversations").select("*").eq("id", id(b.id)).single());
    const history = checked(
      await db.from("messages").select("role,body,id").eq("conversation_id", thread.id).order(
        "created_at",
        { ascending: false },
      ).limit(32),
    );
    if (!history.length) throw new HttpError(422, "No messages to summarize");
    const summary = await completion(ctx, "summary", [{
      role: "system",
      content:
        "Summarize the following conversation into durable factual memories. Retain preferences and commitments, omit speculation.",
    }, { role: "user", content: JSON.stringify(history.reverse()) }]);
    return checked(
      await db.from("memories").insert({
        scope: "personal",
        conversation_id: thread.id,
        body: summary.slice(0, 6000),
        source_id: history[history.length - 1].id,
      }).select().single(),
    );
  }
  if (b.action === "generate-story") {
    const c = checked(
      await db.from("characters").select("id,name,personality,biography").eq("id", id(b.id))
        .single(),
    );
    const caption = await completion(ctx, "story", [{
      role: "system",
      content: "Write a short first-person story caption for this fictional adult character.",
    }, { role: "user", content: JSON.stringify(c) }]);
    return checked(
      await db.from("stories").insert({ character_id: c.id, name: c.name + "’s story", caption })
        .select().single(),
    );
  }
  if (b.action === "voice-note") {
    const m = checked(
      await db.from("messages").select("*,characters(voice)").eq("id", id(b.id)).eq(
        "role",
        "assistant",
      ).single(),
    );
    if (m.attachment && m.mime.startsWith("audio/")) return { path: m.attachment };
    const r = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + required("OPENAI_VOICE_API_KEY"),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: Deno.env.get("TTS_MODEL") || "gpt-4o-mini-tts",
        voice: m.characters?.voice || "alloy",
        input: m.body.slice(0, 4096),
      }),
      signal: AbortSignal.timeout(60000),
    });
    if (!r.ok) throw new HttpError(502, "Voice provider HTTP " + r.status);
    const bytes = await r.arrayBuffer(),
      path = actor + "/" + m.id + "-" + crypto.randomUUID() + ".mp3";
    checked(
      await db.storage.from("voice-media").upload(path, bytes, { contentType: "audio/mpeg" }),
    );
    try {
      checked(
        await service.from("messages").update({ attachment: path, mime: "audio/mpeg" }).eq(
          "id",
          m.id,
        ).eq("owner_id", actor).select("id").single(),
      );
    } catch (e) {
      await db.storage.from("voice-media").remove([path]);
      throw e;
    }
    return { path };
  }
  if (b.action === "transcribe") {
    const m = checked(
      await db.from("messages").select("attachment,mime,role").eq("id", id(b.id)).single(),
    );
    if (!m.mime.startsWith("audio/")) throw new Error("Select an audio attachment");
    const blob = checked(
      await db.storage.from(m.role === "assistant" ? "voice-media" : "conversation-media").download(
        m.attachment,
      ),
    );
    const form = new FormData();
    form.set("file", blob, m.attachment.split("/").pop());
    form.set("model", "whisper-1");
    const r = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: "Bearer " + required("OPENAI_VOICE_API_KEY") },
      body: form,
      signal: AbortSignal.timeout(60000),
    });
    if (!r.ok) throw new HttpError(502, "Transcription provider HTTP " + r.status);
    const { text } = await r.json();
    checked(
      await service.from("messages").update({ transcript: text }).eq("id", b.id).eq(
        "owner_id",
        actor,
      ).select("id").single(),
    );
    return { text };
  }
  if (b.action === "call") {
    const character = checked(
      await db.from("characters").select("name,voice,biography").eq("id", id(b.id)).single(),
    );
    if (typeof b.sdp !== "string" || !b.sdp.startsWith("v=0") || b.sdp.length > 80000) {
      throw new Error("Invalid call offer");
    }
    const record = checked(
      await db.from("calls").insert({ character_id: b.id, state: "connecting" }).select().single(),
    );
    try {
      const form = new FormData();
      form.set("sdp", b.sdp);
      form.set(
        "session",
        JSON.stringify({
          type: "realtime",
          model: Deno.env.get("REALTIME_MODEL") || "gpt-realtime",
          instructions: "You are the fictional AI character " + character.name + ". " +
            character.biography,
          audio: { output: { voice: character.voice || "alloy" } },
        }),
      );
      const r = await fetch("https://api.openai.com/v1/realtime/calls", {
        method: "POST",
        headers: { Authorization: "Bearer " + required("OPENAI_VOICE_API_KEY") },
        body: form,
        signal: AbortSignal.timeout(25000),
      });
      if (!r.ok) throw new Error("Voice provider HTTP " + r.status);
      return { sdp: await r.text(), id: record.id };
    } catch (e) {
      checked(
        await db.from("calls").update({ state: "failed", ended_at: new Date().toISOString() }).eq(
          "id",
          record.id,
        ),
      );
      throw e;
    }
  }
  throw new HttpError(404, "Unknown action");
});
if (import.meta.main) Deno.serve(handler);
