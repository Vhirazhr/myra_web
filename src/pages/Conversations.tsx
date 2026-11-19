import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { Button, Card, Badge, Modal } from "../components/ui";
import { Heading, Media, Records } from "../components/Records";
import { Editor } from "../components/Editor";
import { conversation } from "../services/catalog";
import {
  call,
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
  const recorder = useRef<MediaRecorder | null>(null),
    input = useRef<HTMLInputElement>(null);
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
    if (input.current) input.current.value = "";
    await refresh();
    await call("generate", { id: message.id });
  }
  async function record() {
    if (recording) {
      recorder.current?.stop();
      return;
    }
    try {
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
            disabled={action.isPending}
            onClick={() =>
              action.mutate(async () => {
                await call("summarize", { id });
                notify("Memory summary saved");
              })
            }
          >
            Summarize memory
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
          {ordered
            .filter((m) => m.body.toLowerCase().includes(search.toLowerCase()))
            .map((m) => {
              const parent = ordered.find((p) => p.id === m.reply_to);
              const liked = reactions.data?.find((r) => r.message_id === m.id && r.emoji === "♥");
              return (
                <article key={m.id} className={m.role === "user" ? "user-bubble" : "ai-bubble"}>
                  <small>
                    {chars.data?.find((c) => c.id === m.character_id)?.name || "You"} ·{" "}
                    {new Date(m.created_at).toLocaleString()}
                  </small>
                  {parent && <blockquote>{parent.body}</blockquote>}
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
                    <button onClick={() => setReply(m)}>Reply</button>
                    <button
                      aria-label="React to message"
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
                      <button
                        disabled={action.isPending}
                        onClick={() => action.mutate(() => call("generate", { id: m.id }))}
                      >
                        Request response
                      </button>
                    )}
                    {m.role === "assistant" && !m.attachment && (
                      <button
                        disabled={action.isPending}
                        onClick={() => action.mutate(() => call("voice-note", { id: m.id }))}
                      >
                        Generate voice note
                      </button>
                    )}
                    {m.mime?.startsWith("audio/") && !m.transcript && (
                      <button onClick={() => action.mutate(() => call("transcribe", { id: m.id }))}>
                        Transcribe
                      </button>
                    )}
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
            <textarea value={body} onChange={(e) => type(e.target.value)} maxLength={24000} />
          </label>
          <div className="wizard-actions">
            <input
              aria-label="Message attachment"
              ref={input}
              type="file"
              accept="image/*,audio/*,video/*"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            <Button secondary onClick={record}>
              {recording ? "Stop recording" : "Record audio"}
            </Button>
            <Button type="submit" disabled={action.isPending || recording}>
              {action.isPending ? "Working…" : "Send"}
            </Button>
          </div>
          {file && <Badge>{file.name}</Badge>}
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
export function CallStudio() {
  const chars = useRows("characters"),
    history = useRows("calls");
  const [id, select] = useState(""),
    [state, status] = useState("idle"),
    [err, fail] = useState(""),
    [muted, mute] = useState(false);
  const pc = useRef<RTCPeerConnection | null>(null),
    stream = useRef<MediaStream | null>(null),
    audio = useRef<HTMLAudioElement>(null),
    record = useRef(""),
    connected = useRef(false),
    attempt = useRef(0);
  async function end(failed = false) {
    attempt.current++;
    const connection = pc.current;
    pc.current = null;
    if (connection) {
      connection.onconnectionstatechange = null;
      connection.close();
    }
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    const saved = record.current;
    record.current = "";
    status("idle");
    mute(false);
    if (saved) {
      try {
        await save(
          "calls",
          {
            state: failed || !connected.current ? "failed" : "ended",
            ended_at: new Date().toISOString(),
          },
          saved,
        );
        await refresh();
      } catch (e) {
        fail(errorText(e));
      }
    }
  }
  useEffect(
    () => () => {
      void end();
    },
    [],
  );
  async function start() {
    const current = ++attempt.current;
    status("connecting");
    fail("");
    connected.current = false;
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (current !== attempt.current) {
        media.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = media;
      const connection = new RTCPeerConnection();
      pc.current = connection;
      connection.ontrack = (e) => {
        if (audio.current) {
          audio.current.srcObject = e.streams[0];
          void audio.current.play();
        }
      };
      media.getTracks().forEach((t) => connection.addTrack(t, media));
      connection.createDataChannel("oai-events");
      const offer = await connection.createOffer();
      await connection.setLocalDescription(offer);
      const res = await call("call", { id, sdp: offer.sdp });
      if (current !== attempt.current) {
        await save("calls", { state: "ended", ended_at: new Date().toISOString() }, res.id);
        return;
      }
      record.current = res.id;
      connection.onconnectionstatechange = async () => {
        if (connection.connectionState === "connected") {
          connected.current = true;
          status("connected");
          await save("calls", { state: "connected", started_at: new Date().toISOString() }, res.id);
          await refresh();
        }
        if (
          connection.connectionState === "failed" ||
          connection.connectionState === "disconnected"
        )
          void end(true);
      };
      await connection.setRemoteDescription({ type: "answer", sdp: res.sdp });
    } catch (e) {
      fail(errorText(e));
      await end(true);
    }
  }
  return (
    <div className="page">
      <Heading
        section="Communication"
        title="Voice calls"
        description="Start a live voice conversation with an AI character."
      />
      <Card className="wizard-form">
        <label>
          Character
          <select value={id} onChange={(e) => select(e.target.value)}>
            <option value="">Select…</option>
            {chars.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <audio ref={audio} autoPlay />
        <div className="wizard-actions">
          {state === "idle" ? (
            <Button disabled={!id} onClick={start}>
              Start call
            </Button>
          ) : (
            <>
              <Badge>{state}</Badge>
              <Button
                secondary
                onClick={() => {
                  stream.current?.getAudioTracks().forEach((t) => (t.enabled = muted));
                  mute(!muted);
                }}
              >
                {muted ? "Unmute" : "Mute"}
              </Button>
              <Button onClick={() => void end()}>End call</Button>
            </>
          )}
        </div>
        {err && <p role="alert">{err}</p>}
      </Card>
      <Card className="wizard-form">
        <h2>Call history</h2>
        {!history.data?.length && <p>No calls recorded.</p>}
        {history.data?.map((r) => (
          <p key={r.id}>
            {chars.data?.find((c) => c.id === r.character_id)?.name} · {r.state} ·{" "}
            {new Date(r.created_at).toLocaleString()}
          </p>
        ))}
      </Card>
    </div>
  );
}
