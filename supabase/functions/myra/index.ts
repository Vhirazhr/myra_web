import { authorize, checked, endpoint, HttpError, id, required } from "../_shared/backend.ts";
import { completion, generate } from "../_shared/ai.ts";

function encodeBase64(bytes: Uint8Array) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
function decodeBase64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
function pcmToWav(pcm: Uint8Array, sampleRate = 24000) {
  const wav = new Uint8Array(44 + pcm.length);
  const view = new DataView(wav.buffer);
  const write = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) wav[offset + i] = value.charCodeAt(i);
  };
  write(0, "RIFF");
  view.setUint32(4, 36 + pcm.length, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, pcm.length, true);
  wav.set(pcm, 44);
  return wav;
}
function googleVoice(value: unknown) {
  const aliases: Record<string, string> = {
    alloy: "Kore",
    echo: "Puck",
    shimmer: "Aoede",
    ash: "Charon",
    ballad: "Leda",
    coral: "Zephyr",
    sage: "Fenrir",
    verse: "Orus",
  };
  const voices = new Set([
    "Achernar", "Achird", "Algenib", "Algieba", "Alnilam", "Aoede", "Autonoe",
    "Callirrhoe", "Charon", "Despina", "Enceladus", "Erinome", "Fenrir", "Gacrux",
    "Iapetus", "Kore", "Laomedeia", "Leda", "Orus", "Puck", "Pulcherrima",
    "Rasalgethi", "Sadachbia", "Sadaltager", "Schedar", "Sulafat", "Umbriel",
    "Vindemiatrix", "Zephyr",
  ]);
  const name = String(value || "").trim();
  if (voices.has(name)) return name;
  return aliases[name.toLowerCase()] || "Kore";
}
async function geminiRequest(path: string, body: Record<string, unknown>) {
  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/" + path, {
    method: "POST",
    headers: {
      "x-goog-api-key": required("GEMINI_API_KEY"),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new HttpError(
      response.status >= 500 ? 502 : response.status,
      payload.error?.message || "Gemini API HTTP " + response.status,
    );
  }
  return payload;
}
export const handler = endpoint(async (req) => {
  const ctx = await authorize(req), { db, actor, service } = ctx;
  if (!checked(await service.rpc("admit_myra_request", { actor }))) {
    throw new HttpError(429, "Too many requests. Try again in one minute.");
  }
  const b = await req.json();
  if (b.action === "send-media") {
    const assetId = id(b.assetId);
    const conversationId = id(b.conversationId);
    const asset = checked(
      await db.from("media_assets").select("*").eq("id", assetId).eq("owner_id", actor).single(),
    );
    if (!asset.character_id || !["image/", "video/"].some((prefix) => asset.mime.startsWith(prefix))) {
      throw new HttpError(422, "Select a character image or video.");
    }
    if (asset.bucket !== "stories") throw new HttpError(422, "Only Character Media Studio assets can be sent.");
    const thread = checked(
      await db.from("conversations").select("*").eq("id", conversationId).eq("owner_id", actor).single(),
    );
    let allowed = thread.character_id === asset.character_id;
    if (thread.group_id) {
      const member = checked(
        await db.from("group_members").select("character_id").eq("group_id", thread.group_id).eq("character_id", asset.character_id).limit(1),
      );
      allowed = allowed || member.length > 0;
    }
    if (!allowed) throw new HttpError(403, "This character is not part of the selected conversation.");
    const caption = typeof b.caption === "string" ? b.caption.trim().slice(0, 1000) : "";
    const message = checked(
      await service.from("messages").insert({
        owner_id: actor,
        conversation_id: thread.id,
        character_id: asset.character_id,
        role: "assistant",
        body: caption || "I wanted to share this with you ✨",
        attachment: asset.path,
        attachment_bucket: asset.bucket,
        mime: asset.mime,
      }).select("id").single(),
    );
    return { messageId: message.id };
  }
  if (b.action === "generate") return generate(ctx, id(b.id));
  if (b.action === "test-provider") {
    const providerId = id(b.providerId);
    return {
      providerId,
      text: await completion(ctx, "connection test", [{
        role: "user",
        content: "Reply with a short MYRA provider connection confirmation.",
      }], undefined, 0, { providerId }),
    };
  }
  if (b.action === "test-google") {
    return {
      text: await completion(ctx, "connection test", [{
        role: "user",
        content: "Reply with a short MYRA Google AI connection confirmation.",
      }], undefined, 0, { adapter: "gemini" }),
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
      await db.from("messages").select("*,characters(name,personality,communication,background,voice)").eq("owner_id", actor).eq("id", id(b.id))
        .eq("role", "assistant").single(),
    );
    if (m.attachment && m.mime.startsWith("audio/")) return { path: m.attachment };
    const voice = googleVoice(m.characters?.voice);
    const model = Deno.env.get("GEMINI_TTS_MODEL") || "gemini-3.8-flash-tts";
    const generated = await geminiRequest("interactions", {
      model,
      input: "Speak this message naturally as " + (m.characters?.name || "the character") +
        ". Voice direction: " + String(m.characters?.communication || "warm, expressive, conversational") +
        ". Character personality: " + JSON.stringify(m.characters?.personality || {}) +
        ". Background context: " + String(m.characters?.background || "").slice(0, 700) +
        ". Preserve the exact wording; do not add or omit sentences.\n\n" +
        String(m.body || "").slice(0, 4096),
      response_format: { type: "audio" },
      generation_config: { speech_config: [{ voice }] },
    });
    const audioData = generated.output_audio?.data;
    if (!audioData) throw new HttpError(502, "Gemini TTS returned no audio");
    const wav = pcmToWav(decodeBase64(audioData), 24000);
    const path = actor + "/" + m.id + "-" + crypto.randomUUID() + ".wav";
    checked(
      await db.storage.from("voice-media").upload(path, wav, {
        contentType: "audio/wav",
        upsert: false,
      }),
    );
    try {
      checked(
        await service.from("messages").update({
          attachment: path,
          attachment_bucket: "voice-media",
          mime: "audio/wav",
        }).eq("id", m.id).eq("owner_id", actor).select("id").single(),
      );
    } catch (e) {
      await db.storage.from("voice-media").remove([path]);
      throw e;
    }
    return { path };
  }
  if (b.action === "transcribe") {
    const m = checked(
      await db.from("messages").select("id,owner_id,attachment,mime,role").eq("owner_id", actor)
        .eq("id", id(b.id)).single(),
    );
    if (!m.mime.startsWith("audio/")) throw new HttpError(422, "Select an audio attachment");
    const blob = checked(
      await db.storage.from(
        m.role === "assistant" ? "voice-media" : "conversation-media",
      ).download(m.attachment),
    );
    if (blob.size > 20 * 1024 * 1024) {
      throw new HttpError(413, "Audio files over 20 MB cannot be transcribed inline");
    }
    const model = Deno.env.get("GEMINI_CHAT_MODEL") || "gemini-3.6-flash";
    const generated = await geminiRequest("models/" + encodeURIComponent(model) + ":generateContent", {
      contents: [{
        role: "user",
        parts: [
          { text: "Transcribe the spoken audio verbatim. Return only the transcript in its original language. Do not summarize or add commentary." },
          {
            inlineData: {
              mimeType: m.mime,
              data: encodeBase64(new Uint8Array(await blob.arrayBuffer())),
            },
          },
        ],
      }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
    });
    const transcript = (generated.candidates?.[0]?.content?.parts || [])
      .map((part: { text?: string }) => part.text || "").join("").trim();
    if (!transcript) throw new HttpError(502, "Gemini returned an empty transcript");
    checked(
      await service.from("messages").update({ transcript }).eq("id", m.id).eq(
        "owner_id",
        actor,
      ).select("id").single(),
    );
    return { text: transcript };
  }
  if (b.action === "live-token") {
    const character = checked(
      await db.from("characters").select(
        "id,name,age,pronouns,biography,personality,appearance,background,communication,relationship,language,scenario,voice,status",
      ).eq("owner_id", actor).eq("id", id(b.id)).neq("status", "archived").single(),
    );
    const thread = checked(
      await db.from("conversations").select("id,language,mode,relationship_stage")
        .eq("owner_id", actor).eq("character_id", character.id)
        .order("created_at", { ascending: false }).limit(1).maybeSingle(),
    );
    const recent = thread
      ? checked(
        await db.from("messages").select("role,body,character_id,created_at")
          .eq("conversation_id", thread.id).order("created_at", { ascending: false }).limit(12),
      ).reverse()
      : [];
    const memories = thread
      ? checked(
        await db.rpc("recall_memories", {
          thread: thread.id,
          speaker: character.id,
          query_text: "recent relationship, preferences and ongoing topics",
        }),
      ) as { body: string }[]
      : [];
    const instruction = [
      "You are " + character.name + ", a fictional adult companion speaking in a live voice conversation with the user.",
      "Stay faithful to this character profile, personality, appearance, background, communication style, language, scenario and boundaries:",
      JSON.stringify(character).slice(0, 12000),
      "Relationship stage: " + (thread?.relationship_stage || "Best friends") + ".",
      "Conversation style: " + (thread?.mode || "hybrid") + ".",
      "Speak naturally, warmly and spontaneously. Use concise spoken language, not long written paragraphs.",
      "Keep continuity with the recent conversation and relevant memories. Do not invent shared events or user facts.",
      "Respect consent and boundaries. Do not pressure, guilt, threaten, or control the user.",
      "If the relationship is friends-to-lovers or slow-burn, preserve the friendship and allow affection to grow gradually through reciprocal interaction.",
      "Recent conversation:\n" + recent.map((m) =>
        (m.role === "assistant" ? character.name : "User") + ": " + m.body
      ).join("\n").slice(0, 5000),
      "Relevant memories:\n" + memories.map((m) => "- " + m.body).join("\n").slice(0, 4000),
    ].join("\n\n");
    const model = Deno.env.get("GEMINI_LIVE_MODEL") || "gemini-3.8-live";
    const config = {
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: googleVoice(character.voice) } },
        },
      },
      systemInstruction: { parts: [{ text: instruction }] },
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      sessionResumption: {},
    };
    const record = checked(
      await db.from("calls").insert({
        character_id: character.id,
        state: "connecting",
      }).select("id").single(),
    );
    try {
      const now = Date.now();
      const tokenResponse = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/auth_tokens",
        {
          method: "POST",
          headers: {
            "x-goog-api-key": required("GEMINI_API_KEY"),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            uses: 1,
            expireTime: new Date(now + 30 * 60 * 1000).toISOString(),
            newSessionExpireTime: new Date(now + 60 * 1000).toISOString(),
            liveConnectConstraints: {
              model: "models/" + model,
              config,
            },
          }),
          signal: AbortSignal.timeout(20000),
        },
      );
      const payload = await tokenResponse.json();
      if (!tokenResponse.ok || !payload.name) {
        throw new Error(payload.error?.message || "Gemini Live token request failed");
      }
      return { token: payload.name, id: record.id, model };
    } catch (error) {
      checked(
        await db.from("calls").update({
          state: "failed",
          ended_at: new Date().toISOString(),
        }).eq("id", record.id),
      );
      throw error;
    }
  }
  throw new HttpError(404, "Unknown action");
});
if (import.meta.main) Deno.serve(handler);
