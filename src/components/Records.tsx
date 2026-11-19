import { useState, type ReactNode } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Button, Card, Modal, Icon } from "./ui";
import { Editor } from "./Editor";
import { displayName } from "../services/catalog";
import { call, errorText, refresh, remove, save, useRows, useSigned } from "../services/workspace";
import type { Row, Spec } from "../types/workspace";
export function Heading({
  section,
  title,
  description,
  children,
}: {
  section: string;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{section}</p>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {children}
    </div>
  );
}
export function Media({
  bucket,
  path,
  mime = "",
}: {
  bucket: string;
  path: string;
  mime?: string;
}) {
  const url = useSigned(bucket, path);
  if (!path) return null;
  if (url.error) return <small role="alert">{url.error.message}</small>;
  if (!url.data) return <small>Loading media…</small>;
  if (mime.startsWith("video")) return <video className="asset-preview" controls src={url.data} />;
  if (mime.startsWith("audio")) return <audio controls src={url.data} />;
  return <img alt="Uploaded media" className="asset-preview" src={url.data} />;
}
export function Records({
  title,
  section,
  spec,
  afterCreate,
  onOpen,
  children,
  actions,
  filter,
  description,
}: {
  title: string;
  section: string;
  spec: Spec;
  afterCreate?: (row: Row) => void;
  onOpen?: (row: Row) => void;
  children?: ReactNode;
  actions?: (row: Row) => ReactNode;
  filter?: (row: Row) => boolean;
  description?: string;
}) {
  const navigate = useNavigate(),
    data = useRows(spec.table, (spec.fixed as Record<string, string>) || {});
  const [editing, edit] = useState<Row | "new" | null>(null),
    [deleting, del] = useState<Row | null>(null),
    [query, search] = useState(() => new URLSearchParams(window.location.search).get("q") || ""),
    [status, byStatus] = useState("all"),
    [notice, notify] = useState(""),
    [inspecting, inspect] = useState<Row | null>(null);
  const chars = useRows("characters"),
    worlds = useRows("universes"),
    groups = useRows("groups");
  const cast = useRows("universe_characters", {}, ["universes", "characters"].includes(spec.table)),
    members = useRows("group_members", {}, spec.table === "groups"),
    health = useRows("usage_logs", {}, spec.table === "providers");
  const [worldFilter, setWorld] = useState("");
  const worldNames = (id: string) =>
    (cast.data || [])
      .filter((x) => x.character_id === id)
      .map((x) => worlds.data?.find((w) => w.id === x.universe_id)?.name)
      .filter(Boolean)
      .join(", ");
  const layout =
    spec.table === "universes"
      ? "universe-grid"
      : spec.table === "stories"
        ? "story-grid"
        : spec.table === "providers"
          ? "provider-grid"
          : spec.table === "world_entries" && spec.fixed?.kind === "event"
            ? "timeline-list"
            : "record-list";
  const lookup = (id: string) =>
    [...(chars.data || []), ...(worlds.data || []), ...(groups.data || [])].find((r) => r.id === id)
      ?.name;
  const mutate = useMutation({
    mutationFn: async (task: () => Promise<unknown>) => await task(),
    onSuccess: async () => {
      del(null);
      await refresh();
    },
  });
  function create() {
    if (spec.table === "characters") navigate("/character-new");
    else if (spec.table === "universes") navigate("/universe-new");
    else edit("new");
  }
  const filtered =
    data.data?.filter(
      (r) =>
        (!filter || filter(r)) &&
        (!worldFilter ||
          cast.data?.some((m) => m.character_id === r.id && m.universe_id === worldFilter)) &&
        (status === "all" || r.status === status) &&
        [
          displayName(r),
          r.caption,
          r.description,
          r.scope,
          lookup(r.character_id),
          lookup(r.other_character_id),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query.toLowerCase()),
    ) || [];
  return (
    <div className="page">
      <Heading section={section} title={title} description={description}>
        {!spec.readOnly && (
          <Button icon="plus" onClick={create}>
            Create {spec.singular}
          </Button>
        )}
      </Heading>
      {children}
      {spec.table === "characters" && (
        <div className="stats-strip">
          {[
            ["Total characters", data.data?.length],
            ...["active", "draft", "archived"].map((k) => [
              k,
              data.data?.filter((c) => c.status === k).length,
            ]),
          ].map(([k, n], i) => (
            <div key={k}>
              <span className={"stat-dot s" + i} />
              <b>{n ?? "—"}</b>
              <small>{k}</small>
            </div>
          ))}
        </div>
      )}
      <Card>
        <div className="table-tools">
          <div className="search-box">
            <Icon name="search" />
            <input
              aria-label="Search records"
              placeholder={"Search " + title.toLowerCase() + "…"}
              value={query}
              onChange={(e) => search(e.target.value)}
            />
          </div>
          {spec.table === "characters" && (
            <select
              aria-label="Filter universe"
              value={worldFilter}
              onChange={(e) => setWorld(e.target.value)}
            >
              <option value="">All universes</option>
              {worlds.data?.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          )}
          {spec.fields.some((f) => f.key === "status") && (
            <select
              aria-label="Filter status"
              value={status}
              onChange={(e) => byStatus(e.target.value)}
            >
              <option value="all">All statuses</option>
              {spec.fields
                .find((f) => f.key === "status")
                ?.options?.map((o) => (
                  <option key={o}>{o}</option>
                ))}
            </select>
          )}
          <span className="result-count">{filtered.length} results</span>
        </div>
        {data.isPending ? (
          <p className="empty">Loading records…</p>
        ) : data.isError ? (
          <p role="alert" className="form-error">
            {errorText(data.error)}
          </p>
        ) : !filtered.length ? (
          <p className="empty">No matching {title.toLowerCase()}.</p>
        ) : (
          <div className={layout}>
            {filtered.map((r) => (
              <article
                className={
                  layout === "record-list"
                    ? ""
                    : layout === "timeline-list"
                      ? "timeline-event"
                      : "card studio-card"
                }
                key={r.id}
              >
                {spec.table === "stories" && r.media && (
                  <div className="story-media">
                    <Media bucket="stories" path={r.media} mime={r.mime} />
                  </div>
                )}
                {spec.table === "universes" && (
                  <div className="universe-image">
                    {r.cover ? (
                      <Media bucket="universe-covers" path={r.cover} />
                    ) : (
                      <Icon name="globe" size={44} />
                    )}
                  </div>
                )}
                {layout === "timeline-list" && (
                  <>
                    <time>{r.event_date}</time>
                    <i />
                  </>
                )}
                <div className="record-main">
                  {r.portrait && <Media bucket="character-avatars" path={r.portrait} />}

                  <div>
                    <button
                      className="record-title"
                      onClick={() => (onOpen ? onOpen(r) : inspect(r))}
                    >
                      {String(spec.label ? r[spec.label] : displayName(r))}
                    </button>
                    <small>
                      {[
                        lookup(r.character_id),
                        lookup(r.other_character_id),
                        lookup(r.universe_id),
                        r.mode,
                        r.scope,
                        r.status,
                        r.model,
                        r.event_date,
                      ]
                        .filter(Boolean)
                        .join(" · ") || new Date(r.created_at).toLocaleDateString()}
                    </small>
                    {spec.table === "characters" && (
                      <small>
                        {[r.pronouns, r.relationship, worldNames(r.id)].filter(Boolean).join(" · ")}
                      </small>
                    )}
                    {spec.table === "universes" && (
                      <small>
                        {r.genre} · {cast.data?.filter((m) => m.universe_id === r.id).length || 0}{" "}
                        characters
                      </small>
                    )}
                    {spec.table === "groups" && (
                      <small>
                        {members.data?.filter((m) => m.group_id === r.id).length || 0} members
                      </small>
                    )}
                    {spec.table === "providers" && (
                      <small>
                        {(() => {
                          const last = health.data?.find((l) => l.provider_id === r.id);
                          return last
                            ? (last.error || "Last request succeeded") +
                                " · " +
                                new Date(last.created_at).toLocaleString()
                            : "Not tested yet";
                        })()}
                      </small>
                    )}
                    {(r.description || r.caption || r.history) && (
                      <p>{r.description || r.caption || r.history}</p>
                    )}
                  </div>
                </div>
                <div className="row-actions">
                  {actions?.(r)}
                  {spec.table === "providers" && (
                    <Button
                      secondary
                      disabled={mutate.isPending}
                      onClick={() =>
                        mutate.mutate(async () => {
                          const v = await call("test-provider", { id: r.id });
                          notify(v.text);
                        })
                      }
                    >
                      Test connection
                    </Button>
                  )}
                  {spec.table === "characters" && (
                    <>
                      <button
                        title="Duplicate"
                        onClick={() =>
                          mutate.mutate(async () => {
                            const fields = Object.fromEntries(
                              spec.fields.map((f) => [f.key, r[f.key]]),
                            );
                            await save("characters", {
                              ...fields,
                              name: r.name + " (copy)",
                              status: "draft",
                            });
                          })
                        }
                      >
                        <Icon name="copy" />
                      </button>
                      <button
                        title="Archive"
                        onClick={() =>
                          mutate.mutate(() => save("characters", { status: "archived" }, r.id))
                        }
                      >
                        <Icon name="clock" />
                      </button>
                    </>
                  )}
                  {!spec.readOnly && (
                    <>
                      <button title={"Edit " + spec.singular} onClick={() => edit(r)}>
                        <Icon name="edit" />
                      </button>
                      <button title={"Delete " + spec.singular} onClick={() => del(r)}>
                        <Icon name="trash" />
                      </button>
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </Card>
      {mutate.error && (
        <p role="alert" className="form-error">
          {errorText(mutate.error)}
        </p>
      )}
      {notice && (
        <p role="status" className="notice">
          {notice}
        </p>
      )}
      {editing && (
        <Modal
          title={(editing === "new" ? "Create " : "Edit ") + spec.singular}
          close={() => edit(null)}
        >
          <Editor
            spec={spec}
            row={editing === "new" ? undefined : editing}
            done={(r) => {
              edit(null);
              if (r) {
                notify("Saved " + spec.singular);
                if (editing === "new") afterCreate?.(r);
              }
            }}
          />
        </Modal>
      )}
      {deleting && (
        <Modal title={"Delete " + spec.singular + "?"} close={() => del(null)}>
          <p>Delete {displayName(deleting)} and its dependent records?</p>
          <div className="wizard-actions">
            <Button secondary onClick={() => del(null)}>
              Cancel
            </Button>
            <Button
              disabled={mutate.isPending}
              onClick={() => mutate.mutate(() => remove(spec.table, deleting.id))}
            >
              Confirm delete
            </Button>
          </div>
        </Modal>
      )}
      {inspecting && (
        <Modal title={displayName(inspecting)} close={() => inspect(null)}>
          <dl className="details">
            {spec.fields
              .filter((f) => inspecting[f.key] != null && inspecting[f.key] !== "")
              .map((f) => (
                <div key={f.key}>
                  <dt>{f.label}</dt>
                  <dd>
                    {f.type === "file" ? (
                      <Media bucket={f.bucket!} path={inspecting[f.key]} mime={inspecting.mime} />
                    ) : typeof inspecting[f.key] === "object" ? (
                      Object.entries(inspecting[f.key])
                        .map(([k, v]) => k + " " + v)
                        .join(" · ")
                    ) : (
                      String(lookup(inspecting[f.key]) || inspecting[f.key])
                    )}
                  </dd>
                </div>
              ))}
          </dl>
        </Modal>
      )}
    </div>
  );
}
