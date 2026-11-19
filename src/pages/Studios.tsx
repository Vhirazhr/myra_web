import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Button, Card, Modal, Badge, Icon, type IconName } from "../components/ui";
import { Records, Media, Heading } from "../components/Records";
import { Editor } from "../components/Editor";
import { character, preferences, story, relationship } from "../services/catalog";
import {
  call,
  discardAsset,
  errorText,
  refresh,
  save,
  remove,
  upload,
  useRows,
  useRecent,
  result,
} from "../services/workspace";
import { db } from "../lib/supabase";
import type { Row } from "../types/workspace";

export function CharacterLab({ page }: { page: string }) {
  const chars = useRows("characters"),
    [id, choose] = useState("");
  const row = chars.data?.find((r) => r.id === id) || chars.data?.[0];
  const navigate = useNavigate();
  const keys: Record<string, string[]> = {
    personality: ["personality", "communication", "relationship"],
    appearance: ["portrait", "appearance"],
    voice: ["voice"],
    "voice-notes": ["voice"],
  };
  const label =
    page === "appearance"
      ? "Appearance Studio"
      : page === "personality"
        ? "Personality Lab"
        : "Voice Studio";
  const launch = useMutation({
    mutationFn: async () => {
      const r = await save("conversations", {
        name: row!.name + " · Studio",
        character_id: row!.id,
        language: row!.language || "Indonesian",
      });
      await refresh();
      navigate("/chat/" + r.id);
    },
  });
  return (
    <div className="page">
      <Heading section="Character Studio" title={label}>
        <select
          aria-label="Select character"
          value={row?.id || ""}
          onChange={(e) => choose(e.target.value)}
        >
          {chars.data?.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </Heading>
      {row ? (
        <div className="lab-layout">
          <Editor
            key={row.id + page}
            row={row}
            spec={{
              ...character,
              singular: "changes",
              fields: character.fields.filter((f) => keys[page]?.includes(f.key)),
            }}
            done={() => void refresh()}
          />
          <Card className="wizard-form">
            <h2>{row.name}</h2>
            <p>{row.biography}</p>
            {row.portrait && <Media bucket="character-avatars" path={row.portrait} />}
            <Button disabled={launch.isPending} onClick={() => launch.mutate()}>
              Test in conversation
            </Button>
            {launch.error && <p role="alert">{launch.error.message}</p>}
          </Card>
        </div>
      ) : (
        <Card>
          <p className="empty">
            {chars.error?.message || "Create a character to open this studio."}
          </p>
        </Card>
      )}
    </div>
  );
}

export function Social() {
  const relationships = useRows("relationships"),
    chars = useRows("characters");
  const nodes = chars.data || [],
    position = (i: number) => nodes.length === 1
      ? { x: 50, y: 50 }
      : {
          x: 50 + 35 * Math.cos((2 * Math.PI * i) / nodes.length),
          y: 50 + 35 * Math.sin((2 * Math.PI * i) / nodes.length),
        };
  return (
    <Records section="Social System" title="Social graph" spec={relationship}>
      <Card className="graph-card">
        <div className="graph-canvas">
          {nodes.length === 0 ? (
            <p className="empty">Add characters to see their connections.</p>
          ) : (
            <>
              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                aria-label="Character relationships"
              >
                {relationships.data?.filter((r) =>
                  nodes.some((c) => c.id === r.character_id) &&
                  nodes.some((c) => c.id === r.other_character_id),
                ).map((r) => {
                  const a = position(nodes.findIndex((c) => c.id === r.character_id)),
                    b = position(nodes.findIndex((c) => c.id === r.other_character_id));
                  return (
                    <line
                      key={r.id}
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      stroke={r.kind === "romantic" ? "#f3a9c4" : "#a68ae8"}
                      strokeWidth=".6"
                    >
                      <title>
                        {r.kind} · {r.trust}
                      </title>
                    </line>
                  );
                })}
              </svg>
              {nodes.map((c, i) => (
                <div
                  className="graph-node"
                  style={{ left: position(i).x + "%", top: position(i).y + "%" }}
                  key={c.id}
                >
                  <Badge>{c.name}</Badge>
                </div>
              ))}
            </>
          )}
        </div>
      </Card>
    </Records>
  );
}
function StoryView({ row, close }: { row: Row; close: () => void }) {
  const activity = useRows("story_activity", { story_id: row.id }),
    [reply, setReply] = useState(""),
    [reaction, setReaction] = useState("✨");
  const action = useMutation({
    mutationFn: async (kind: string) => {
      if (kind === "like") {
        const like = activity.data?.find((a) => a.kind === "like");
        if (like) {
          await remove("story_activity", like.id);
          return;
        }
      }
      await save("story_activity", {
        story_id: row.id,
        kind,
        body: kind === "reply" ? reply : kind === "reaction" ? reaction : "",
      });
      setReply("");
    },
    onSettled: () => refresh(),
  });
  const [viewError, viewFail] = useState("");
  useEffect(() => {
    if (
      row.status !== "published" ||
      Date.parse(row.publish_at) > Date.now() ||
      Date.parse(row.expires_at) <= Date.now()
    )
      return;
    void (async () => {
      const r = await db().from("story_activity").insert({ kind: "view", story_id: row.id });
      if (r.error && r.error.code !== "23505") viewFail(r.error.message);
      else await refresh();
    })();
  }, [row]);
  return (
    <Modal title={row.name} close={close}>
      {row.media && <Media bucket="stories" path={row.media} mime={row.mime} />}
      <p>{row.caption}</p>
      <p>
        {row.audience} · {activity.data?.filter((a) => a.kind === "view").length || 0} views
      </p>
      <div className="wizard-actions">
        <Button secondary disabled={action.isPending} onClick={() => action.mutate("like")}>
          {activity.data?.some((a) => a.kind === "like") ? "Unlike" : "Like"}
        </Button>
        <select
          aria-label="Story reaction"
          value={reaction}
          onChange={(e) => setReaction(e.target.value)}
        >
          {["✨", "♥", "😂", "👏"].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <Button secondary onClick={() => action.mutate("reaction")}>
          React
        </Button>
      </div>
      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          action.mutate("reply");
        }}
      >
        <label>
          Reply
          <input required value={reply} onChange={(e) => setReply(e.target.value)} />
        </label>
        <Button type="submit" disabled={action.isPending}>
          Send reply
        </Button>
      </form>
      {activity.data
        ?.filter((a) => ["reply", "reaction"].includes(a.kind))
        .map((a) => (
          <p key={a.id}>{a.body}</p>
        ))}
      {(viewError || action.error || activity.error) && (
        <p role="alert">{viewError || errorText(action.error || activity.error)}</p>
      )}
    </Modal>
  );
}
export function Stories({ scheduler = false }: { scheduler?: boolean }) {
  const [view, open] = useState<Row | null>(null),
    [tab, select] = useState(scheduler ? "Scheduled" : "All"),
    [author, choose] = useState(""),
    [audience, setAudience] = useState("");
  const chars = useRows("characters"),
    groups = useRows("groups"),
    worlds = useRows("universes"),
    all = useRows("stories");
  const [clock, setClock] = useState(Date.now);
  useEffect(() => {
    const upcoming = (all.data || [])
      .flatMap((r) => [Date.parse(r.publish_at), Date.parse(r.expires_at)])
      .filter((t) => t > Date.now());
    if (!upcoming.length) return;
    const timer = window.setTimeout(
      () => setClock(Date.now()),
      Math.min(2147483647, Math.max(1, Math.min(...upcoming) - Date.now() + 5)),
    );
    return () => clearTimeout(timer);
  }, [all.data, clock]);
  const feed = useQuery({
    queryKey: ["rows", "story-feed", audience, clock],
    enabled: !!audience,
    queryFn: async () =>
      result(
        await db().rpc("story_feed", {
          for_group: audience.startsWith("g:") ? audience.slice(2) : null,
          for_universe: audience.startsWith("u:") ? audience.slice(2) : null,
        }),
      ) as Row[],
  });
  const generate = useMutation({
    mutationFn: () => call("generate-story", { id: author }),
    onSuccess: () => refresh(),
  });
  const classify = (r: Row) =>
    r.status === "archived" || Date.parse(r.expires_at) <= Date.now()
      ? "Archive"
      : r.status === "draft"
        ? "Drafts"
        : Date.parse(r.publish_at) > Date.now()
          ? "Scheduled"
          : "Published";
  return (
    <>
      <Records
        section="Stories & Media"
        title={scheduler ? "Story scheduler" : "Story Studio"}
        description={scheduler
          ? "Review upcoming stories and their publication times. Scheduled stories are shown first."
          : "Create, review and publish character stories across private, group and universe feeds."}
        spec={story}
        onOpen={open}
        filter={(r) =>
          (!audience || !!feed.data?.some((s) => s.id === r.id)) &&
          (tab === "All" || classify(r) === tab)
        }
        actions={(r) => <Badge>{classify(r)}</Badge>}
      >
        <div className="tabs">
          {["All", "Published", "Scheduled", "Drafts", "Archive"].map((t) => (
            <button key={t} className={tab === t ? "active" : ""} onClick={() => select(t)}>
              {t}
            </button>
          ))}
        </div>
        <div className="table-tools">
          <select
            aria-label="Audience feed"
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
          >
            <option value="">All studio records</option>
            <option value="private">Private feed</option>
            {groups.data?.map((g) => (
              <option key={g.id} value={"g:" + g.id}>
                Group · {g.name}
              </option>
            ))}
            {worlds.data?.map((u) => (
              <option key={u.id} value={"u:" + u.id}>
                Universe · {u.name}
              </option>
            ))}
          </select>
          {feed.error && <p role="alert">{feed.error.message}</p>}
          {!scheduler && (
            <>
              <select aria-label="Story author" value={author} onChange={(e) => choose(e.target.value)}>
                <option value="">Select author…</option>
                {chars.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <Button secondary disabled={!author || generate.isPending} onClick={() => generate.mutate()}>
                {generate.isPending ? "Generating…" : "Generate AI draft"}
              </Button>
            </>
          )}
        </div>
        {generate.error && <p role="alert">{generate.error.message}</p>}
      </Records>
      {view && <StoryView row={view} close={() => open(null)} />}
    </>
  );
}
export function Settings({ page, title }: { page: string; title: string }) {
  const settings = useRows("settings"),
    [notice, notify] = useState("");
  const fields: Record<string, string[]> = {
    simulation: ["simulation", "timezone"],
    proactive: [
      "proactive",
      "frequency_hours",
      "quiet_start",
      "quiet_end",
      "timezone",
      "notifications",
    ],
    language: ["language"],
    context: ["memory_limit"],
    response: ["system_prompt"],
  };
  const run = useMutation({
    mutationFn: () => call("simulation"),
    onSuccess: async (r) => {
      notify(r.processed + " activities recorded");
      await refresh();
    },
  });
  return (
    <div className="page">
      <Heading
        title={title}
        section={page === "simulation" ? "Life Simulation" : "Configuration"}
        description={page === "proactive"
          ? "Control when your characters may start a conversation. Both the global setting and the individual conversation opt-in must be enabled."
          : undefined}
      />
      {page === "proactive" && (
        <Card className="wizard-form">
          <h3>How character-initiated messages work</h3>
          <p>
            Enable proactive messaging here, then open the character conversation and enable
            “Allow character-initiated messages” in its Settings. The cloud worker checks for due
            messages every five minutes once the Supabase Cron schedule is configured. Quiet hours
            and the interval below are respected. A character will not send another unsolicited
            message until you reply to the previous one.
          </p>
        </Card>
      )}
      {settings.isError ? (
        <p role="alert">{settings.error.message}</p>
      ) : (
        settings.isSuccess && (
          <Editor
            key={settings.data[0]?.id || "new"}
            spec={{
              ...preferences,
              fields: preferences.fields.filter((f) =>
                (fields[page] || preferences.fields.map((f) => f.key)).includes(f.key),
              ),
            }}
            row={settings.data[0]}
            done={(r) => {
              if (r) notify("Settings saved");
            }}
          />
        )
      )}
      {page === "simulation" && (
        <Card className="wizard-form">
          <h3>Simulation activity</h3>
          <p>
            Last backend tick ·{" "}
            {settings.data?.[0]?.last_tick
              ? new Date(settings.data[0].last_tick).toLocaleString()
              : "No recorded tick"}
          </p>
          <Button
            disabled={!settings.data?.[0]?.simulation || run.isPending}
            onClick={() => run.mutate()}
          >
            Run due activities
          </Button>
        </Card>
      )}
      {notice && <p role="status">{notice}</p>}
      {run.error && <p role="alert">{run.error.message}</p>}
    </div>
  );
}
export function GoogleAIEngine() {
  const test = useMutation({
    mutationFn: () => call("test-google"),
  });
  return (
    <div className="page">
      <Heading
        section="AI Engine"
        title="Google AI Engine"
        description="One Google API key powers Gemini chat, memory extraction, proactive messages, voice notes, transcription, and Gemini Live calls."
      />
      <Card className="wizard-form">
        <Badge tone="green">Google ecosystem</Badge>
        <h2>Connect Gemini API</h2>
        <p>
          Create a Gemini API key in Google AI Studio, then save it as a server-side Supabase
          Edge Function secret. Do not put it in VITE_ variables, frontend code, or GitHub.
        </p>
        <pre><code>pnpm exec supabase secrets set GEMINI_API_KEY=YOUR_GOOGLE_AI_STUDIO_KEY</code></pre>
        <p>
          The default chat model is gemini-3.6-flash. Gemini Live uses gemini-3.8-live.
          Voice notes use gemini-3.8-flash-tts. These defaults can be overridden with
          server-side model secrets if needed.
        </p>
        <div className="wizard-actions">
          <Button disabled={test.isPending} onClick={() => test.mutate()}>
            {test.isPending ? "Testing…" : "Test Gemini connection"}
          </Button>
        </div>
        {test.data?.text && <p role="status">{test.data.text}</p>}
        {test.error && <p className="form-error" role="alert">{errorText(test.error)}</p>}
      </Card>
      <Card className="wizard-form">
        <h2>MYRA service routing</h2>
        <div className="event-row"><strong>Chat, personality and memory</strong><span>Gemini API Free tier · gemini-3.6-flash</span></div>
        <div className="event-row"><strong>Voice call</strong><span>Gemini Live · short-lived session tokens</span></div>
        <div className="event-row"><strong>Voice notes</strong><span>Gemini TTS · gemini-3.8-flash-tts</span></div>
        <div className="event-row"><strong>Audio transcription</strong><span>Gemini multimodal understanding</span></div>
        <div className="event-row"><strong>Character photos and videos</strong><span>Google Flow with your Google AI Plus subscription</span></div>
        <p className="media-help">
          Flow remains a manual Google AI Plus workflow: build a character prompt here, generate
          in Flow, download the result, and import it into Character Media Studio. Flow does not
          expose the Plus subscription as a callable MYRA API.
        </p>
        <p className="media-help">
          The Gemini API Free tier has model-specific quotas and rate limits. Google may use
          free-tier submitted content to improve its products. Check the current Google AI Studio
          limits before using MYRA with private or sensitive conversations.
        </p>
      </Card>
    </div>
  );
}
export function Dashboard({ page }: { page: string }) {
  const metrics = useQuery({
      queryKey: ["rows", "metrics"],
      queryFn: async () => result(await db().rpc("workspace_metrics")) as Record<string, number | null>,
    }),
    usage = useRecent("usage_logs", 12),
    audit = useRecent("audit_logs", 8);
  const navigate = useNavigate();
  const activity = useQuery({
    queryKey: ["rows", "character-activity"],
    queryFn: async () => result(await db().rpc("character_activity_counts")) as {
      character_id: string; name: string; messages: number;
    }[],
  });
  const trend = useQuery({
    queryKey: ["rows", "usage-days"],
    queryFn: async () => result(await db().rpc("usage_by_day")) as {
      day: string; requests: number; tokens: number;
    }[],
  });
  const icons: IconName[] = ["users","globe","message","group","message","spark","brain","chart","database","mic"];
  const totalRequests = (trend.data || []).reduce((sum, day) => sum + day.requests, 0);
  const totalTokens = (trend.data || []).reduce((sum, day) => sum + day.tokens, 0);
  const peak = Math.max(1, ...(trend.data || []).map((day) => day.requests));
  const metricValue = (key: string, value: number | null) => {
    if (value === null) return "—";
    if (key === "Estimated USD") return "$" + Number(value).toFixed(4);
    if (key === "Storage MB") return Number(value).toLocaleString(undefined, { maximumFractionDigits: 1 }) + " MB";
    if (key === "Voice minutes") return Number(value).toFixed(1) + " min";
    return Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 });
  };
  if (page === "usage") {
    const estimatedCost = metrics.data?.["Estimated USD"];
    return (
      <div className="page">
        <Heading section="AI Engine" title="AI Usage & Costs"
          description="Usage recorded by MYRA over the last seven days. Cost is shown only when the usage logger has a price estimate.">
          <Button secondary onClick={() => navigate("/google-ai")}>Google AI settings</Button>
        </Heading>
        {metrics.error && <p role="alert">{errorText(metrics.error)}</p>}
        <div className="metrics">
          <Card><div className="metric-icon"><Icon name="spark" /></div>
            <div><p>Requests · last 7 days</p><h2>{trend.isPending ? "—" : totalRequests.toLocaleString()}</h2></div>
          </Card>
          <Card><div className="metric-icon"><Icon name="chart" /></div>
            <div><p>Tokens · last 7 days</p><h2>{trend.isPending ? "—" : totalTokens.toLocaleString()}</h2></div>
          </Card>
          <Card><div className="metric-icon"><Icon name="database" /></div>
            <div><p>Estimated spend · lifetime</p>
              <h2>{metrics.isPending ? "—" : estimatedCost == null ? "Not available" : "$" + Number(estimatedCost).toFixed(4)}</h2>
            </div>
          </Card>
        </div>
        <div className="dash-grid usage-dashboard">
          <Card className="usage-chart">
            <h3>Daily AI requests</h3><p>Requests recorded for each of the last seven days</p>
            {trend.isPending ? <p className="empty">Loading usage trend…</p> : trend.error
              ? <p role="alert" className="form-error">{errorText(trend.error)}</p>
              : trend.data?.length ? <div className="usage-days">
                {trend.data.map((day) => (
                  <div key={day.day} title={day.requests + " requests · " + day.tokens + " tokens"}>
                    <small>{day.requests.toLocaleString()}</small>
                    <i style={{ height: (day.requests / peak) * 92 + "px" }} />
                    <time>{new Date(day.day + "T00:00:00").toLocaleDateString(undefined, { weekday: "short" })}</time>
                  </div>
                ))}
              </div> : <p className="empty">No usage recorded in the last seven days.</p>}
            <h3>Recent AI requests</h3>
            {usage.isPending && <p className="empty">Loading recent requests…</p>}
            {usage.error && <p role="alert">{errorText(usage.error)}</p>}
            {!usage.isPending && !usage.error && !usage.data?.length && <p className="empty">No AI requests recorded yet.</p>}
            {usage.data?.map((request) => (
              <div className="event-row usage-request" key={request.id}>
                <div><strong>{request.model || "Unknown model"}</strong>
                  <small>{request.operation || "AI request"} · {new Date(request.created_at).toLocaleString()}</small>
                </div>
                <span>{request.error ? "Failed: " + request.error :
                  (request.input_tokens ?? "—") + " in / " + (request.output_tokens ?? "—") + " out"}</span>
              </div>
            ))}
          </Card>
          <Card className="events-card usage-notes">
            <h3>About cost estimates</h3>
            <p>MYRA shows the cost estimate stored by its usage logger. A missing estimate does not mean the request was free.</p>
            <p>Model pricing and quotas can change. Check Google AI Studio for the current limits on your account.</p>
            <Button secondary onClick={() => navigate("/google-ai")}>Open Google AI Engine</Button>
          </Card>
        </div>
      </div>
    );
  }
  return (
    <div className="page">
      <Heading section="Overview" title="Dashboard"
        description="A quick view of your characters, conversations and workspace activity.">
        <Button secondary onClick={() => navigate("/usage")}>View AI usage</Button>
        <Button icon="plus" onClick={() => navigate("/character-new")}>Create character</Button>
      </Heading>
      {metrics.error && <p role="alert">{errorText(metrics.error)}</p>}
      {metrics.isPending ? <p className="empty">Loading workspace metrics…</p> : (
        <div className="metrics">
          {Object.entries(metrics.data || {}).map(([key, value], index) => (
            <Card key={key}><div className="metric-icon"><Icon name={icons[index % icons.length]} /></div>
              <div><p>{key}</p><h2>{metricValue(key, value)}</h2></div>
            </Card>
          ))}
        </div>
      )}
      <div className="dash-grid dashboard-overview">
        <Card className="usage-chart">
          <h3>AI usage overview</h3><p>Requests over the last seven days</p>
          {trend.isPending ? <p className="empty">Loading usage trend…</p> : trend.error
            ? <p role="alert">{errorText(trend.error)}</p>
            : trend.data?.length ? <div className="usage-days">{trend.data.map((day) => (
              <div key={day.day} title={day.requests + " requests · " + day.tokens + " tokens"}>
                <small>{day.requests}</small><i style={{ height: (day.requests / peak) * 68 + "px" }} />
                <time>{day.day.slice(5)}</time>
              </div>
            ))}</div> : <p className="empty">No usage recorded yet.</p>}
          <Button secondary onClick={() => navigate("/usage")}>View detailed usage</Button>
        </Card>
        <Card className="active-card">
          <h3>Most active characters</h3>
          {activity.isPending && <p className="empty">Loading character activity…</p>}
          {activity.error && <p role="alert">{errorText(activity.error)}</p>}
          {activity.data?.map((character) => (
            <div className="event-row" key={character.character_id}>
              <strong>{character.name}</strong><span>{character.messages.toLocaleString()} messages</span>
            </div>
          ))}
          {!activity.isPending && !activity.error && !activity.data?.length && <p className="empty">No character messages yet.</p>}
        </Card>
        <Card className="events-card">
          <h3>Recent changes</h3>
          {audit.isPending && <p className="empty">Loading recent changes…</p>}
          {audit.error && <p role="alert">{errorText(audit.error)}</p>}
          {audit.data?.map((entry) => (
            <div className="event-row" key={entry.id}>
              <span>{entry.operation} · {entry.entity}</span><small>{new Date(entry.created_at).toLocaleString()}</small>
            </div>
          ))}
          {!audit.isPending && !audit.error && !audit.data?.length && <p className="empty">No changes recorded yet.</p>}
        </Card>
      </div>
    </div>
  );
}
export function Library({ page }: { page: string }) {
  const assets = useRows("media_assets");
  const [bucket, setBucket] = useState("character-gallery");
  const [filterBucket, setFilterBucket] = useState("all");
  const [file, choose] = useState<File | null>(null);
  const buckets = ["character-gallery","character-avatars","universe-covers","conversation-media","stories","voice-media"];
  const add = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Choose a file to upload.");
      const target = page === "gallery" ? "character-gallery" : bucket;
      const imageOnly = ["character-gallery","character-avatars","universe-covers"].includes(target);
      if (imageOnly && !file.type.startsWith("image/")) throw new Error("Choose an image for this collection.");
      if (target === "voice-media" && !file.type.startsWith("audio/")) throw new Error("Choose an audio file for this collection.");
      if (file.size > (target === "character-avatars" ? 10 : 50) * 1024 * 1024)
        throw new Error(target === "character-avatars" ? "Avatar files must be 10 MB or smaller." : "Files must be 50 MB or smaller.");
      await upload(target, file);
    },
    onSuccess: async () => { choose(null); await refresh(); },
  });
  const deleteAsset = useMutation({
    mutationFn: async (asset: Row) => {
      if (!window.confirm("Delete " + asset.name + " permanently?")) return false;
      await discardAsset(asset);
      return true;
    },
    onSuccess: async (deleted) => { if (deleted) await refresh(); },
  });
  const visibleAssets = (assets.data || []).filter((asset) =>
    page === "gallery" ? asset.bucket === "character-gallery" :
      filterBucket === "all" || asset.bucket === filterBucket,
  );
  return (
    <div className="page">
      <Heading section="Stories & Media" title={page === "gallery" ? "Gallery manager" : "Media library"}
        description={page === "gallery"
          ? "Upload and manage images in the character gallery."
          : "Upload, filter and remove files in your private MYRA media collections."} />
      <Card className="wizard-form">
        <form className="form-grid" onSubmit={(event) => { event.preventDefault(); add.mutate(); }}>
          {page !== "gallery" && <label>Save uploads to
            <select value={bucket} onChange={(event) => setBucket(event.target.value)}>
              {buckets.map((name) => <option key={name}>{name}</option>)}
            </select>
          </label>}
          <label>Media file
            <input key={file?.name || "empty"} type="file" accept="image/*,audio/*,video/*"
              onChange={(event) => choose(event.target.files?.[0] || null)} />
          </label>
          <Button type="submit" disabled={!file || add.isPending}>
            {add.isPending ? "Uploading…" : "Upload " + (page === "gallery" ? "image" : "to library")}
          </Button>
        </form>
      </Card>
      {page !== "gallery" && <div className="table-tools media-library-tools">
        <label>Filter collection
          <select value={filterBucket} onChange={(event) => setFilterBucket(event.target.value)}>
            <option value="all">All collections</option>
            {buckets.map((name) => <option key={name}>{name}</option>)}
          </select>
        </label>
        <span className="result-count">{visibleAssets.length} files</span>
      </div>}
      {(add.error || assets.error || deleteAsset.error) && <p role="alert">{errorText(add.error || assets.error || deleteAsset.error)}</p>}
      {assets.isPending ? <p className="empty">Loading media library…</p> : visibleAssets.length ? (
        <div className="story-grid media-library-grid">
          {visibleAssets.map((asset) => (
            <Card className="wizard-form library-asset-card" key={asset.id}>
              <Media bucket={asset.bucket} path={asset.path} mime={asset.mime} />
              <h3>{asset.name}</h3>
              <small>{asset.bucket} · {(asset.bytes / 1024).toFixed(1)} KB</small>
              <Button secondary disabled={deleteAsset.isPending} ariaLabel={"Delete " + asset.name}
                onClick={() => deleteAsset.mutate(asset)}>Delete file</Button>
            </Card>
          ))}
        </div>
      ) : <p className="empty">{page === "gallery" ? "No gallery images yet." : "No media files in this collection yet."}</p>}
    </div>
  );
}
export function Backup() {
  const backups = useQuery({
    queryKey: ["rows", "backups"],
    queryFn: async () => result(await db().rpc("list_myra_backups")) as Row[],
  });
  const [restore, confirm] = useState(""),
    [notice, notify] = useState("");
  const change = useMutation({
    mutationFn: async () => {
      if (restore) {
        const count = result(await db().rpc("restore_myra_backup", { backup_id: restore }));
        notify(count + " missing records restored");
        confirm("");
      } else {
        result(await db().rpc("create_myra_backup"));
        notify("Snapshot created");
      }
      await refresh();
    },
  });
  return (
    <div className="page">
      <Heading
        title="Backup & Restore"
        section="System"
        description="Snapshots restore missing workspace records. Existing rows are preserved. Media files stay in Supabase Storage."
      >
        <Button disabled={change.isPending} onClick={() => change.mutate()}>
          {change.isPending && !restore ? "Creating snapshot…" : "Create snapshot"}
        </Button>
      </Heading>
      <Card className="wizard-form">
        {backups.isPending && <p className="empty">Loading snapshots…</p>}
        {!backups.isPending && !backups.data?.length && <p className="empty">No snapshots yet.</p>}
        {backups.data?.map((r) => (
          <div className="setting-row" key={r.id}>
            <span>
              {new Date(r.created_at).toLocaleString()} · {r.bytes < 1024 ? r.bytes + " B" : (r.bytes / 1024).toFixed(1) + " KB"}
            </span>
            <Button secondary disabled={change.isPending} onClick={() => confirm(r.id)}>
              Restore
            </Button>
          </div>
        ))}
      </Card>
      {restore && (
        <Modal title="Restore missing records?" close={() => confirm("")}>
          <p>This snapshot only adds records that are currently missing. Existing records are not overwritten, and media files in Storage are not included.</p>
          <div className="wizard-actions">
            <Button secondary disabled={change.isPending} onClick={() => confirm("")}>Cancel</Button>
            <Button disabled={change.isPending} onClick={() => change.mutate()}>
              {change.isPending ? "Restoring…" : "Restore missing records"}
            </Button>
          </div>
        </Modal>
      )}
      {notice && <p role="status">{notice}</p>}
      {(change.error || backups.error) && (
        <p role="alert">{errorText(change.error || backups.error)}</p>
      )}
    </div>
  );
}
