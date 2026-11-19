import { backend, checked, endpoint, HttpError, required } from "../_shared/backend.ts";
import { completion, processMemoryTasks } from "../_shared/ai.ts";
const b64 = (s: Uint8Array) =>
  btoa(Array.from(s, (c) => String.fromCharCode(c)).join("")).replace(/=/g, "").replace(/\+/g, "-")
    .replace(/\//g, "_");
const encode = (s: string) => b64(new TextEncoder().encode(s));
async function firebase() {
  const account = JSON.parse(required("FIREBASE_SERVICE_ACCOUNT_JSON"));
  const now = Math.floor(Date.now() / 1000), aud = "https://oauth2.googleapis.com/token";
  const data = encode(JSON.stringify({ alg: "RS256", typ: "JWT" })) + "." +
    encode(
      JSON.stringify({
        iss: account.client_email,
        scope: "https://www.googleapis.com/auth/firebase.messaging",
        aud,
        iat: now,
        exp: now + 3600,
      }),
    );
  const pem = account.private_key.replace(/-----[^-]+-----|\s/g, "");
  const key = await crypto.subtle.importKey(
    "pkcs8",
    Uint8Array.from(atob(pem), (c) => c.charCodeAt(0)),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(data));
  const r = await fetch(aud, {
    method: "POST",
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: data + "." + b64(new Uint8Array(sig)),
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error("Firebase OAuth HTTP " + r.status);
  return { token: (await r.json()).access_token, project: account.project_id };
}
export const handler = endpoint(async (req) => {
  if (req.headers.get("Authorization") !== "Bearer " + required("MYRA_WORKER_TOKEN")) {
    throw new HttpError(401, "Worker authentication required");
  }
  const db = backend(), now = new Date(), results = { activities: 0, initiatives: 0, delivered: 0, memories: 0 };
  results.memories = await processMemoryTasks(db, 2);
  const prefs = checked(
    await db.from("settings").select("*").or("simulation.eq.true,proactive.eq.true"),
  );
  for (const p of prefs) {
    const actor = p.owner_id;
    if (
      !checked(await db.from("admin_access").select("user_id").eq("user_id", actor).maybeSingle())
    ) continue;
    if (p.simulation) results.activities += checked(await db.rpc("tick_simulation", { actor }));
    const local = new Intl.DateTimeFormat("en-GB", {
      timeZone: p.timezone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(now);
    const start = p.quiet_start.slice(0, 5),
      end = p.quiet_end.slice(0, 5),
      quiet = start > end ? local >= start || local < end : local >= start && local < end;
    if (!p.proactive || quiet) continue;
    const threads = checked(
      await db.from("conversations").select("*").eq("owner_id", actor).eq("proactive", true).not(
        "character_id",
        "is",
        null,
      ).order("last_proactive_at", { nullsFirst: true }).limit(4),
    );
    for (const t of threads) {
      const recent = checked(
        await db.from("messages").select("role,body,created_at,is_proactive").eq(
          "conversation_id",
          t.id,
        ).order("created_at", { ascending: false }).limit(12),
      ).reverse();
      const last = recent[recent.length - 1];
      // Do not cold-message an empty thread or send another nudge before the user replies.
      if (!last || last.is_proactive || !recent.some((m) => m.role === "user")) continue;
      const since = Math.max(
        Date.parse(t.last_proactive_at || t.created_at),
        Date.parse(last.created_at || t.created_at),
      );
      if (now.getTime() - since < p.frequency_hours * 3600000) continue;
      const job = "initiative/" + t.id + "/" + since,
        token = checked(await db.rpc("claim_ai_job", { actor, job }));
      if (!token) continue;
      try {
        const speaker = checked(
          await db.from("characters").select(
            "name,personality,pronouns,age,biography,background,appearance,relationship,communication,language,scenario,status",
          ).eq("id", t.character_id).single(),
        );
        if (speaker.status === "archived") {
          await db.rpc("release_ai_job", { actor, job, token });
          continue;
        }
        const memories = checked(
          await db.rpc("recall_memories", {
            thread: t.id,
            speaker: t.character_id,
            query_text: last.body || "",
          }),
        );
        const body = await completion({ db, service: db, actor }, "initiative", [{
          role: "system",
          content: [
            "You are writing the character's first message in an existing one-to-one conversation.",
            "Stay fully in the character's configured voice, language, personality, background, communication style, scenario, and relationship setup.",
            "Use hybrid companion style: sound like a real spontaneous chat message, not a long story narration. A tiny action beat is fine if it feels natural.",
            "Start with a specific, fresh reason to reach out or naturally continue a shared topic. Use recent chat and memories when relevant; never pretend the user said something they did not say.",
            "Vary the opening. Do not repeat recent greetings, generic 'how are you?' check-ins, or the same catchphrase. Do not mention automation, schedules, prompts, or being an AI.",
            "Be warm and expressive without guilt, pressure, possessiveness, or demands for an immediate reply. Respect quiet hours and the user's independence.",
            "Respect the current relationship stage. If it is Best friends or the setup is friends-to-lovers/slow-burn, initiate as a close friend; use only subtle affection when supported by reciprocal history. Never force a confession or assume the user is a partner.",
            "Send one concise message, usually 1-3 sentences, that gives the user an easy and natural opening to respond. Do not add a label or stage metadata.",
          ].join("\n"),
        }, {
          role: "user",
          content: JSON.stringify({
            character: speaker,
            relationship_stage: t.relationship_stage || "Best friends",
            conversation_style: t.mode || "hybrid",
            language: t.language,
            local_time: local,
            recent_messages: recent.map((m) => ({
              role: m.role,
              body: m.body,
              created_at: m.created_at,
            })),
            memories: memories.map((m: { body: string }) => m.body),
          }).slice(0, 18000),
        }]);
        checked(
          await db.rpc("finish_initiative", {
            actor,
            thread: t.id,
            speaker: t.character_id,
            job,
            token,
            body,
          }),
        );
        results.initiatives++;
      } catch (e) {
        await db.rpc("release_ai_job", { actor, job, token });
        console.error("Initiative failed", e instanceof Error ? e.message : "error");
      }
    }
  }
  if (!Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON")) return { ...results, push: "unconfigured" };
  const notices = checked(await db.rpc("claim_notifications", { batch_size: 20 }));
  if (notices.length) {
    const f = await firebase();
    for (const n of notices) {
      try {
        for (const device of checked(await db.rpc("pending_devices", { notice: n.id }))) {
          const r = await fetch(
            "https://fcm.googleapis.com/v1/projects/" + encodeURIComponent(f.project) +
              "/messages:send",
            {
              method: "POST",
              headers: { Authorization: "Bearer " + f.token, "Content-Type": "application/json" },
              body: JSON.stringify({
                message: {
                  token: device.token,
                  notification: { title: n.name, body: n.body },
                  data: { notification_id: n.id },
                },
              }),
              signal: AbortSignal.timeout(15000),
            },
          );
          if (!r.ok) throw new Error("Firebase delivery HTTP " + r.status);
          checked(await db.rpc("mark_delivered", { notice: n.id, device: device.id }));
        }
        checked(
          await db.from("notifications").update({
            sent_at: new Date().toISOString(),
            delivery_error: null,
          }).eq("id", n.id),
        );
        results.delivered++;
      } catch (e) {
        checked(
          await db.from("notifications").update({
            delivery_error: e instanceof Error ? e.message : "Delivery failed",
          }).eq("id", n.id),
        );
      }
    }
  }
  return results;
});
if (import.meta.main) Deno.serve(handler);
