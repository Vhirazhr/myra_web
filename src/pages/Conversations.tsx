import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { Button, Card, Badge, Modal } from "../components/ui";
import { Heading, Media, Records } from "../components/Records";
import { FilePicker } from "../components/Editor";
import { Editor } from "../components/Editor";
import { conversation } from "../services/catalog";
import {
  call,
  clearConversationMessages,
  deleteMessage,
  discardAsset,
  errorText,
  refresh,
  remove,
  save,
  upload,
  useRows,
  useHistory,
} from "../services/workspace";
import type { Row } from "../types/workspace";

export function Conversations() {
  const { id } = useParams(),
    navigate = useNavigate();
  const settings = useRows("settings");
  const spec = {
    ...conversation,
    fields: conversation.fields.map((f) =>
      f.key === "language" ? { ...f, initial: settings.data?.[0]?.language || f.initial } : f,
    ),
  };
  if (!id)
    return (
      <Records
        spec={spec}
        title="Conversations"
        section="Communication"
        onOpen={(r) => navigate("/chat/" + r.id)}
        afterCreate={(r) => navigate("/chat/" + r.id)}
      />
    );
  return <Thread key={id} id={id} />;
}
function Thread({ id }: { id: string }) {
  const navigate = useNavigate(),
    threads = useRows("conversations", { id }),
    chars = useRows("characters"),
    reactions = useRows("message_reactions");
  const thread = threads.data?.[0],
    members = useRows("group_members", { group_id: thread?.group_id || "" }, !!thread?.group_id);
  const [memoryMode, setMemoryMode] = useState("automatic"),
    [body, type] = useState(""),
    [file, setFile] = useState<File | null>(null),
    [reply, setReply] = useState<Row | null>(null),
    [mentions, mention] = useState<string[]>([]),
    [search, find] = useState(""),
    [edit, setEdit] = useState(false),
    [notice, notify] = useState(""),
    [recording, setRecording] = useState(false),
    [recordError, setRecordError] = useState("");
  const messages = useHistory(id, search);
  const recorder = useRef<MediaRecorder | null>(null);
  useEffect(
    () => () => {
      const r = recorder.current;
      if (r) {
        r.onstop = null;
        r.stream.getTracks().forEach((t) => t.stop());
      }
    },
    [],
  );
  const action = useMutation({
    mutationFn: (fn: () => Promise<unknown>) => fn(),
    onSettled: () => refresh(),
  });
  const people =
    chars.data?.filter(
      (c) => thread?.character_id === c.id || members.data?.some((m) => m.character_id === c.id),
    ) || [];
  async function send() {
    const text = body.trim();
    if (!text && !file) throw new Error("Write a message or attach a file.");
    const asset = file ? await upload("conversation-media", file) : null;
    let message: Row;
    try {
      message = await save("messages", {
        conversation_id: id,
        role: "user",
        body: text || file!.name,
        attachment: asset?.path || "",
        mime: asset?.mime || "",
        reply_to: reply?.id || null,
        mentions,
        memory_mode: memoryMode,
      });
    } catch (e) {
      if (asset) await discardAsset(asset);
      throw e;
    }
    type("");
    setMemoryMode("automatic");
    setReply(null);
    setFile(null);
    mention([]);
    await refresh();
    await call("generate", { id: message.id });
  }
  async function record() {
    if (recording) {
      recorder.current?.stop();
      return;
    }
    try {
      setRecordError("");
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        throw new Error("Audio recording is not supported in this browser.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const r = new MediaRecorder(stream);
      recorder.current = r;
      const chunks: Blob[] = [];
      r.ondataavailable = (e) => chunks.push(e.data);
      r.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const mime = r.mimeType.split(";")[0];
        setFile(
          new File(chunks, "voice-note." + (mime.includes("mp4") ? "mp4" : "webm"), { type: mime }),
        );
        setRecording(false);
      };
      r.start();
      setRecording(true);
    } catch (e) {
      setRecordError(errorText(e));
    }
  }
  if (!thread)
    return (
      <Card>
        <p className="empty">
          {threads.isLoading
            ? "Loading conversation…"
            : threads.error?.message || "Conversation unavailable."}
        </p>
      </Card>
    );
  const ordered = (messages.data?.pages.flat() || []).reverse();
  const visibleMessages = ordered.filter((message) =>
    message.body.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div className="page">
      <Heading
        section="Communication"
        title={thread.name}
        description={thread.language + " · " + thread.mode}
      >
        <Button secondary onClick={() => navigate("/chat")}>
          All conversations
        </Button>
      </Heading>
      <Card className="thread">
        <div className="table-tools">
          <input
            aria-label="Search messages"
            placeholder="Search messages…"
            value={search}
            onChange={(e) => find(e.target.value)}
          />
          <Button secondary onClick={() => setEdit(true)}>
            Settings
          </Button>
          <Button
            secondary
            disabled={action.isPending || !ordered.length}
            onClick={() =>
              action.mutate(async () => {
                await call("summarize", { id });
                notify("Memory summary saved");
              })
            }
          >
            Summarize memory
          </Button>
          <Button
            secondary
            icon="trash"
            disabled={action.isPending || !ordered.length}
            onClick={() => {
              if (
                !window.confirm(
                  "Delete every message in this conversation? The message history and related attachments will be removed. Characters and conversation settings will remain. This cannot be undone.",
                )
              ) return;
              action.mutate(async () => {
                const count = await clearConversationMessages(id);
                setReply(null);
                notify(count + " messages deleted");
              });
            }}
          >
            Hapus semua pesan
          </Button>
        </div>
        {(messages.error || reactions.error || chars.error) && (
          <p role="alert">{errorText(messages.error || reactions.error || chars.error)}</p>
        )}
        <div className="thread-history">
          {messages.hasNextPage && (
            <Button
              secondary
              disabled={messages.isFetchingNextPage}
              onClick={() => void messages.fetchNextPage()}
            >
              Load older messages
            </Button>
          )}
          {!ordered.length && (
            <p className="empty">
              {messages.isLoading ? "Loading history…" : "Start the conversation."}
            </p>
          )}
          {!!ordered.length && !visibleMessages.length && <p className="empty">No messages match this search.</p>}
          {visibleMessages.map((m) => {
              const parent = ordered.find((p) => p.id === m.reply_to);
              const liked = reactions.data?.find((r) => r.message_id === m.id && r.emoji === "♥");
              return (
                <article key={m.id} className={m.role === "user" ? "user-bubble" : "ai-bubble"}>
                  <small>
                    {chars.data?.find((c) => c.id === m.character_id)?.name || "You"} ·{" "}
                    {new Date(m.created_at).toLocaleString()}
                  </small>
                  {parent && <blockquote>{parent.body}</blockquote>}
                  {m.is_proactive && <small className="proactive-label">Started this chat</small>}
                  <p>{m.body}</p>
                  {m.transcript && <p>{m.transcript}</p>}
                  {m.attachment && (
                    <Media
                      bucket={m.attachment_bucket || (m.role === "assistant" && m.mime?.startsWith("audio/") ? "voice-media" : "conversation-media")}
                      path={m.attachment}
                      mime={m.mime}
                    />
                  )}
                  <div className="message-actions">
                    <button type="button" aria-label="Reply to message" onClick={() => setReply(m)}>Reply</button>
                    <button type="button"
                      aria-label={liked ? "Remove reaction" : "Like message"}
                      aria-pressed={!!liked} disabled={action.isPending}
                      onClick={() =>
                        action.mutate(() =>
                          liked
                            ? remove("message_reactions", liked.id)
                            : save("message_reactions", { message_id: m.id, emoji: "♥" }),
                        )
                      }
                    >
                      {liked ? "♥ 1" : "♡"}
                    </button>
                    {m.role === "user" && (
                      <button type="button" disabled={action.isPending}
                        onClick={() => action.mutate(() => call("generate", { id: m.id }))}>
                        Generate response
                      </button>
                    )}
                    {m.role === "assistant" && !m.attachment && (
                      <button type="button" disabled={action.isPending}
                        onClick={() => action.mutate(() => call("voice-note", { id: m.id }))}>
                        Generate voice note
                      </button>
                    )}
                    {m.mime?.startsWith("audio/") && !m.transcript && (
                      <button type="button" disabled={action.isPending}
                        onClick={() => action.mutate(() => call("transcribe", { id: m.id }))}>
                        Transcribe
                      </button>
                    )}
                    <button
                      type="button"
                      className="message-delete"
                      disabled={action.isPending}
                      onClick={() => {
                        if (
                          !window.confirm(
                            "Delete this message? Replies and dependent messages will also be deleted.",
                          )
                        ) return;
                        action.mutate(async () => {
                          const count = await deleteMessage(id, m.id);
                          setReply(null);
                          notify(
                            count > 1
                              ? "Message and " + (count - 1) + " related messages deleted"
                              : "Message deleted",
                          );
                        });
                      }}
                    >
                      Delete for everyone
                    </button>
                  </div>
                </article>
              );
            })}
        </div>
        <form
          className="composer"
          onSubmit={(e) => {
            e.preventDefault();
            action.mutate(send);
          }}
        >
          {reply && (
            <p>
              Replying to {reply.body.slice(0, 60)}{" "}
              <button type="button" onClick={() => setReply(null)}>
                Cancel reply
              </button>
            </p>
          )}
          {thread.group_id && (
            <label>
              Mention participants
              <select
                multiple
                value={mentions}
                onChange={(e) => mention(Array.from(e.target.selectedOptions, (o) => o.value))}
              >
                {people.map((c) => (
                  <option key={c.id} value={c.id}>
                    @{c.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            Memory for this turn
            <select value={memoryMode} onChange={(e) => setMemoryMode(e.target.value)}>
              <option value="automatic">Extract relevant memories</option>
              <option value="remember">Remember my message for future chats</option>
              <option value="private">Keep memory in this conversation</option>
              <option value="off">Skip memory extraction</option>
            </select>
          </label>
          <label>
            Message
            <textarea value={body} onChange={(e) => type(e.target.value)} maxLength={24000}
              placeholder="Write a message…" />
          </label>
          <div className="wizard-actions">
            <FilePicker
              label="Message attachment"
              bucket="conversation-media"
              accept="image/*,audio/*,video/*"
              file={file}
              onChange={setFile}
              hint="Images, audio or video · Max 50 MB"
            />
            <Button secondary disabled={action.isPending} onClick={record}>
              {recording ? "Stop recording" : "Record audio"}
            </Button>
            <Button type="submit" disabled={action.isPending || recording || (!body.trim() && !file)}>
              {action.isPending ? "Working…" : "Send"}
            </Button>
          </div>
          {(action.error || recordError) && (
            <p className="form-error" role="alert">
              {action.error ? errorText(action.error) : recordError}
            </p>
          )}
          {notice && <p role="status">{notice}</p>}
        </form>
      </Card>
      {edit && (
        <Modal title="Conversation settings" close={() => setEdit(false)}>
          <Editor spec={conversation} row={thread} done={() => setEdit(false)} />
        </Modal>
      )}
    </div>
  );
}
function resampleAudio(input: Float32Array, inputRate: number, outputRate: number) {
  if (inputRate === outputRate) return input;
  const ratio = inputRate / outputRate;
  const length = Math.floor(input.length / ratio);
  const output = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(Math.floor((i + 1) * ratio), input.length);
    let sum = 0;
    for (let j = start; j < end; j++) sum += input[j];
    output[i] = end > start ? sum / (end - start) : 0;
  }
  return output;
}
function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
function base64ToBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
export function CallStudio() {
  const chars = useRows("characters"),
    history = useRows("calls");
  const [id, select] = useState(""),
    [state, status] = useState("idle"),
    [err, fail] = useState(""),
    [muted, mute] = useState(false),
    [transcript, setTranscript] = useState("");
  const socket = useRef<WebSocket | null>(null),
    microphone = useRef<MediaStream | null>(null),
    audioContext = useRef<AudioContext | null>(null),
    inputSource = useRef<MediaStreamAudioSourceNode | null>(null),
    processor = useRef<ScriptProcessorNode | null>(null),
    record = useRef(""),
    connected = useRef(false),
    attempt = useRef(0),
    mutedRef = useRef(false),
    nextPlaybackTime = useRef(0),
    playing = useRef(new Set<AudioBufferSourceNode>());

  async function end(failed = false) {
    attempt.current++;
    const ws = socket.current;
    socket.current = null;
    if (ws) {
      ws.onclose = null;
      ws.onerror = null;
      ws.onmessage = null;
      if (ws.readyState < WebSocket.CLOSING) ws.close();
    }
    processor.current?.disconnect();
    processor.current = null;
    inputSource.current?.disconnect();
    inputSource.current = null;
    microphone.current?.getTracks().forEach((track) => track.stop());
    microphone.current = null;
    for (const source of playing.current) {
      try { source.stop(); } catch {}
    }
    playing.current.clear();
    const context = audioContext.current;
    audioContext.current = null;
    if (context && context.state !== "closed") {
      try { await context.close(); } catch {}
    }
    nextPlaybackTime.current = 0;
    const saved = record.current;
    record.current = "";
    const wasConnected = connected.current;
    connected.current = false;
    mutedRef.current = false;
    mute(false);
    status("idle");
    if (saved) {
      try {
        await save(
          "calls",
          {
            state: failed || !wasConnected ? "failed" : "ended",
            ended_at: new Date().toISOString(),
          },
          saved,
        );
        await refresh();
      } catch (error) {
        fail(errorText(error));
      }
    }
  }
  useEffect(() => () => { void end(); }, []);

  async function start() {
    const current = ++attempt.current;
    status("connecting");
    fail("");
    setTranscript("");
    connected.current = false;
    mutedRef.current = false;
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Microphone access requires HTTPS or localhost.");
      }
      const media = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      if (current !== attempt.current) {
        media.getTracks().forEach((track) => track.stop());
        return;
      }
      microphone.current = media;
      const result = await call("live-token", { id });
      if (current !== attempt.current) {
        await save("calls", { state: "ended", ended_at: new Date().toISOString() }, result.id);
        return;
      }
      record.current = result.id;
      const context = new AudioContext();
      audioContext.current = context;
      await context.resume();
      const wsUrl =
        "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?access_token=" +
        encodeURIComponent(result.token);
      const ws = new WebSocket(wsUrl);
      socket.current = ws;

      const startMicrophoneStream = () => {
        if (processor.current || !microphone.current || !audioContext.current) return;
        const ctx = audioContext.current;
        const source = ctx.createMediaStreamSource(microphone.current);
        const node = ctx.createScriptProcessor(4096, 1, 1);
        const silent = ctx.createGain();
        silent.gain.value = 0;
        node.onaudioprocess = (event) => {
          if (mutedRef.current || ws.readyState !== WebSocket.OPEN) return;
          const samples = resampleAudio(
            event.inputBuffer.getChannelData(0),
            ctx.sampleRate,
            16000,
          );
          if (!samples.length) return;
          const pcm = new Int16Array(samples.length);
          for (let i = 0; i < samples.length; i++) {
            const sample = Math.max(-1, Math.min(1, samples[i]));
            pcm[i] = sample < 0 ? sample * 32768 : sample * 32767;
          }
          ws.send(JSON.stringify({
            realtimeInput: {
              audio: {
                mimeType: "audio/pcm;rate=16000",
                data: bytesToBase64(new Uint8Array(pcm.buffer)),
              },
            },
          }));
        };
        source.connect(node);
        node.connect(silent);
        silent.connect(ctx.destination);
        inputSource.current = source;
        processor.current = node;
      };

      const playAudio = (encoded: string) => {
        const ctx = audioContext.current;
        if (!ctx) return;
        const bytes = base64ToBytes(encoded);
        const sampleCount = Math.floor(bytes.length / 2);
        if (!sampleCount) return;
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        const buffer = ctx.createBuffer(1, sampleCount, 24000);
        const channel = buffer.getChannelData(0);
        for (let i = 0; i < sampleCount; i++) channel[i] = view.getInt16(i * 2, true) / 32768;
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        const when = Math.max(ctx.currentTime + 0.015, nextPlaybackTime.current);
        source.start(when);
        nextPlaybackTime.current = when + buffer.duration;
        playing.current.add(source);
        source.onended = () => playing.current.delete(source);
      };

      ws.onopen = () => {
        ws.send(JSON.stringify({
          setup: {
            model: "models/" + result.model,
          },
        }));
      };
      ws.onmessage = async (event) => {
        try {
          const raw = typeof event.data === "string" ? event.data : await event.data.text();
          const message = JSON.parse(raw);
          if (message.error) {
            throw new Error(message.error.message || "Gemini Live returned an error");
          }
          if (message.setupComplete) {
            connected.current = true;
            status("connected");
            await save(
              "calls",
              { state: "connected", started_at: new Date().toISOString() },
              result.id,
            );
            await refresh();
            startMicrophoneStream();
            ws.send(JSON.stringify({
              clientContent: {
                turns: [{
                  role: "user",
                  parts: [{ text: "Start this voice conversation with a natural, in-character greeting. Keep it warm and brief." }],
                }],
                turnComplete: true,
              },
            }));
          }
          const server = message.serverContent;
          if (server?.interrupted) {
            for (const source of playing.current) {
              try { source.stop(); } catch {}
            }
            playing.current.clear();
            nextPlaybackTime.current = 0;
          }
          const inputText = server?.inputTranscription?.text;
          const outputText = server?.outputTranscription?.text;
          if (inputText) setTranscript("You: " + inputText);
          if (outputText) setTranscript("Character: " + outputText);
          for (const part of server?.modelTurn?.parts || []) {
            const audio = part.inlineData?.data || part.inline_data?.data;
            if (audio) playAudio(audio);
          }
        } catch (error) {
          fail(errorText(error));
          void end(true);
        }
      };
      ws.onerror = () => {
        fail("Gemini Live connection failed. Check the API key, Live API access, and network connection.");
        if (current === attempt.current) void end(true);
      };
      ws.onclose = () => {
        if (current === attempt.current) void end(true);
      };
    } catch (error) {
      fail(errorText(error));
      await end(true);
    }
  }

  return (
    <div className="page">
      <Heading
        section="Communication"
        title="Voice calls"
        description="Talk to your character in real time with Gemini Live. The Google API key stays on the Supabase backend; the browser receives a short-lived session token."
      />
      <Card className="wizard-form">
        <label>
          Character
          <select value={id} onChange={(event) => select(event.target.value)} disabled={state !== "idle"}>
            <option value="">Select…</option>
            {chars.data?.map((character) => (
              <option key={character.id} value={character.id}>{character.name}</option>
            ))}
          </select>
        </label>
        <div className="wizard-actions">
          {state === "idle" ? (
            <Button disabled={!id} onClick={() => void start()}>
              Start Gemini Live call
            </Button>
          ) : (
            <>
              <Badge>{state}</Badge>
              <Button
                secondary
                onClick={() => {
                  mutedRef.current = !mutedRef.current;
                  mute(mutedRef.current);
                }}
              >
                {muted ? "Unmute microphone" : "Mute microphone"}
              </Button>
              <Button onClick={() => void end()}>End call</Button>
            </>
          )}
        </div>
        {transcript && <p className="media-notice">{transcript}</p>}
        {err && <p role="alert">{err}</p>}
      </Card>
      <Card className="wizard-form">
        <h2>Call history</h2>
        {!history.data?.length && <p>No calls recorded.</p>}
        {history.data?.map((item) => (
          <p key={item.id}>
            {chars.data?.find((character) => character.id === item.character_id)?.name} · {item.state} ·{" "}
            {new Date(item.created_at).toLocaleString()}
          </p>
        ))}
      </Card>
    </div>
  );
}
