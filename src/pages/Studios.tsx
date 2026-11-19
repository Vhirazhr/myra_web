import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Button, Card, Modal, Badge, Icon, type IconName } from "../components/ui";
import { Records, Media, Heading } from "../components/Records";
import { Editor } from "../components/Editor";
import { character, preferences, story, relationship } from "../services/catalog";
import {
  call,
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
    position = (i: number) => ({
      x: 50 + 35 * Math.cos((2 * Math.PI * i) / nodes.length),
      y: 50 + 35 * Math.sin((2 * Math.PI * i) / nodes.length),
    });
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
                {relationships.data?.map((r) => {
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
    [tab, select] = useState("All"),
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
          <select aria-label="Story author" value={author} onChange={(e) => choose(e.target.value)}>
            <option value="">Select author…</option>
            {chars.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <Button
            secondary
            disabled={!author || generate.isPending}
            onClick={() => generate.mutate()}
          >
            Generate AI draft
          </Button>
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
export function Dashboard({ page }: { page: string }) {
  const metrics = useQuery({
      queryKey: ["rows", "metrics"],
      queryFn: async () =>
        result(await db().rpc("workspace_metrics")) as Record<string, number | null>,
    }),
    usage = useRecent("usage_logs", 12),
    audit = useRecent("audit_logs", 8);
  const navigate = useNavigate();
  const icons: IconName[] = [
    "users",
    "globe",
    "message",
    "group",
    "message",
    "spark",
    "brain",
    "chart",
    "database",
    "mic",
  ];
  const activity = useQuery({
    queryKey: ["rows", "character-activity"],
    queryFn: async () =>
      result(await db().rpc("character_activity_counts")) as {
        character_id: string;
        name: string;
        messages: number;
      }[],
  });
  const trend = useQuery({
    queryKey: ["rows", "usage-days"],
    queryFn: async () =>
      result(await db().rpc("usage_by_day")) as { day: string; requests: number; tokens: number }[],
  });
  const peak = Math.max(1, ...(trend.data || []).map((d) => d.requests));
  return (
    <div className="page">
      <Heading
        section="Overview"
        title={
          page === "dashboard"
            ? "Dashboard"
            : page === "analytics"
              ? "Analytics"
              : "AI Usage & Costs"
        }
        description="Activity across your companion universe."
      >
        <Button icon="plus" onClick={() => navigate("/character-new")}>
          Create character
        </Button>
      </Heading>
      {metrics.error && <p role="alert">{metrics.error.message}</p>}
      <div className="metrics">
        {Object.entries(metrics.data || {}).map(([k, v], i) => (
          <Card key={k}>
            <div className="metric-icon">
              <Icon name={icons[i % icons.length]} />
            </div>
            <div>
              <p>{k}</p>
              <h2>
                {v === null
                  ? "—"
                  : Number(v).toLocaleString(undefined, { maximumFractionDigits: 5 })}
              </h2>
            </div>
          </Card>
        ))}
      </div>
      <div className="dash-grid">
        <Card className="usage-chart">
          <h3>AI usage overview</h3>
          <p>Requests over the last seven days</p>
          <div className="usage-days">
            {trend.data?.map((d) => (
              <div key={d.day}>
                <small>{d.requests}</small>
                <i style={{ height: (d.requests / peak) * 68 + "px" }} />
                <time>{d.day.slice(5)}</time>
              </div>
            ))}
          </div>
          <h3>Recent AI requests</h3>
          {!usage.data?.length && <p className="empty">No provider requests recorded.</p>}
          {usage.data?.slice(0, 12).map((r) => (
            <div className="event-row" key={r.id}>
              <strong>{r.model}</strong>
              <span>
                {r.operation} ·{" "}
                {r.error || (r.input_tokens ?? "—") + " in / " + (r.output_tokens ?? "—") + " out"}
              </span>
            </div>
          ))}
        </Card>
        <Card className="active-card">
          <h3>Most active characters</h3>
          {activity.data?.map((r) => (
            <div className="event-row" key={r.character_id}>
              <strong>{r.name}</strong>
              <span>{r.messages} messages</span>
            </div>
          ))}
          {!activity.data?.length && <p className="empty">No character messages yet.</p>}
        </Card>
        <Card className="events-card">
          <h3>Recent changes</h3>
          {!audit.data?.length && <p className="empty">No changes recorded.</p>}
          {audit.data?.slice(0, 8).map((r) => (
            <div className="event-row" key={r.id}>
              <span>
                {r.operation} · {r.entity}
              </span>
              <small>{new Date(r.created_at).toLocaleString()}</small>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
export function Library({ page }: { page: string }) {
  const assets = useRows("media_assets"),
    [bucket, setBucket] = useState("character-gallery"),
    [file, choose] = useState<File | null>(null);
  const add = useMutation({
    mutationFn: async () => {
      if (file) await upload(bucket, file);
    },
    onSuccess: async () => {
      choose(null);
      await refresh();
    },
  });
  return (
    <div className="page">
      <Heading
        section="Stories & Media"
        title={
          page === "gallery"
            ? "Gallery manager"
            : page === "storage"
              ? "Storage manager"
              : "Media library"
        }
      />
      <Card className="wizard-form">
        <form
          className="form-grid"
          onSubmit={(e) => {
            e.preventDefault();
            add.mutate();
          }}
        >
          <label>
            Collection
            <select value={bucket} onChange={(e) => setBucket(e.target.value)}>
              {[
                "character-gallery",
                "character-avatars",
                "universe-covers",
                "conversation-media",
                "stories",
                "voice-media",
              ].map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
          </label>
          <label>
            Media file
            <input type="file" onChange={(e) => choose(e.target.files?.[0] || null)} />
          </label>
          <Button type="submit" disabled={!file || add.isPending}>
            Upload
          </Button>
        </form>
      </Card>
      {(add.error || assets.error) && <p role="alert">{errorText(add.error || assets.error)}</p>}
      <div className="story-grid">
        {assets.data
          ?.filter((a) => page !== "gallery" || a.bucket === "character-gallery")
          .map((a) => (
            <Card className="wizard-form" key={a.id}>
              <Media bucket={a.bucket} path={a.path} mime={a.mime} />
              <h3>{a.name}</h3>
              <small>
                {a.bucket} · {(a.bytes / 1024).toFixed(1)} KB
              </small>
            </Card>
          ))}
      </div>
      {!assets.data?.length && <p className="empty">No uploaded media.</p>}
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
          Create snapshot
        </Button>
      </Heading>
      <Card className="wizard-form">
        {!backups.data?.length && <p>No snapshots yet.</p>}
        {backups.data?.map((r) => (
          <div className="setting-row" key={r.id}>
            <span>
              {new Date(r.created_at).toLocaleString()} · {r.bytes} bytes
            </span>
            <Button secondary onClick={() => confirm(r.id)}>
              Restore
            </Button>
          </div>
        ))}
      </Card>
      {restore && (
        <Modal title="Restore missing records?" close={() => confirm("")}>
          <Button disabled={change.isPending} onClick={() => change.mutate()}>
            Confirm restore
          </Button>
        </Modal>
      )}
      {notice && <p role="status">{notice}</p>}
      {(change.error || backups.error) && (
        <p role="alert">{errorText(change.error || backups.error)}</p>
      )}
    </div>
  );
}
