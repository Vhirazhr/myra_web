import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { Button, Card, Badge } from "./ui";
import type { Field, Spec, Row, Values } from "../types/workspace";
import { displayName } from "../services/catalog";
import { db } from "../lib/supabase";
import {
  discardAsset,
  errorText,
  refresh,
  result,
  save,
  upload,
  useRows,
} from "../services/workspace";

export const traitNames = [
  "Romantic",
  "Jealous",
  "Clingy",
  "Funny",
  "Cold",
  "Shy",
  "Protective",
  "Playful",
  "Introverted",
  "Extroverted",
  "Confident",
];
function dateValue(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
function initialValues(spec: Spec, row?: Row): Values {
  return Object.fromEntries(
    spec.fields.map((f) => {
      let v = row?.[f.key] ?? f.initial;
      if (f.key === "target") v = row?.group_id ? "group" : "character";
      if (f.type === "datetime-local")
        v = dateValue(
          v ? new Date(v) : new Date(Date.now() + (f.key === "expires_at" ? 86400000 : 0)),
        );
      if (f.type === "traits" && !v) v = Object.fromEntries(traitNames.map((t) => [t, 50]));
      return [f.key, v ?? (f.type === "multi" ? [] : f.type === "check" ? false : "")];
    }),
  );
}
function Choices({ field, value, change }: { field: Field; value: any; change: (x: any) => void }) {
  const records = useRows(field.table!);
  if (records.isError) return <span role="alert">{errorText(records.error)}</span>;
  const multiple = field.type === "multi";
  return (
    <select
      aria-label={field.label}
      multiple={multiple}
      required={field.required}
      value={value}
      onChange={(e) =>
        change(multiple ? Array.from(e.target.selectedOptions, (o) => o.value) : e.target.value)
      }
    >
      {!multiple && <option value="">{records.isLoading ? "Loading…" : "Select…"}</option>}
      {records.data?.map((r) => (
        <option value={r.id} key={r.id}>
          {displayName(r)}
        </option>
      ))}
    </select>
  );
}
const wizardSteps = [
  "Identity",
  "Appearance",
  "Personality",
  "Relationship",
  "Communication",
  "Voice",
  "Background",
  "Scenario",
];
const wizardKeys = [
  ["name", "age", "gender", "pronouns", "biography", "portrait"],
  ["appearance"],
  ["personality"],
  ["relationship"],
  ["language", "communication"],
  ["voice"],
  ["background"],
  ["scenario", "status"],
];
export function Editor({
  spec,
  row,
  done,
  wizard = false,
}: {
  spec: Spec;
  row?: Row;
  done: (row?: Row) => void;
  wizard?: boolean;
}) {
  const [values, setValues] = useState(() => initialValues(spec, row)),
    [files, setFiles] = useState<Record<string, File>>({}),
    [step, setStep] = useState(0);
  const rosterTable = spec.table === "groups" ? "group_members" : "universe_characters";
  const parent = spec.table === "groups" ? "group_id" : "universe_id";
  const hasRoster = spec.fields.some((f) => f.type === "multi");
  const roster = useRows(rosterTable, { [parent]: row?.id || "" }, !!row && hasRoster);
  const [rosterTouched, setRosterTouched] = useState(false);
  const current: Values = {
    ...values,
    ...(row && hasRoster && !rosterTouched
      ? { members: (roster.data || []).map((r) => r.character_id) }
      : {}),
  };
  const update = (key: string, value: any) => {
    if (key === "members") setRosterTouched(true);
    setValues((v) => ({ ...v, [key]: value }));
  };
  const cancel = () => {
    setValues(initialValues(spec, row));
    setFiles({});
    setRosterTouched(false);
    done();
  };
  const persist = useMutation({
    mutationFn: async (draft: boolean) => {
      const fields: Values = { ...spec.fixed };
      const assets: Row[] = [];
      try {
        for (const f of spec.fields) {
          let val = current[f.key];
          if (f.when && current[f.when[0]] !== f.when[1]) {
            fields[f.key] = null;
            continue;
          }
          if (f.type === "file") {
            if (files[f.key]) {
              const asset = await upload(f.bucket!, files[f.key]);
              assets.push(asset);
              val = asset.path;
              if (f.key === "media") fields.mime = asset.mime;
            }
          }
          if (f.required && !String(val ?? "").trim()) throw new Error(f.label + " is required");
          if (f.type === "number") {
            val = z.coerce
              .number()
              .min(f.min ?? 0)
              .max(f.max ?? Number.MAX_SAFE_INTEGER)
              .parse(val);
          }
          if (f.type === "datetime-local" && val) val = new Date(String(val)).toISOString();
          if (typeof val === "string") val = val.trim();
          fields[f.key] =
            val === "" && ["ref", "date", "time", "datetime-local"].includes(f.type || "")
              ? null
              : val;
        }
        if (spec.table === "characters" && draft) fields.status = "draft";
        if (spec.table === "conversations") {
          delete fields.target;
          if (fields.crossover_id && fields.universe_id)
            throw new Error("Choose either a universe or a crossover.");
        }
        if (spec.table === "relationships" && fields.character_id === fields.other_character_id)
          throw new Error("Select two different characters.");
        if (spec.table === "stories" && String(fields.expires_at) <= String(fields.publish_at))
          throw new Error("Expiration must follow publication.");
        if (hasRoster) {
          const members = fields.members;
          delete fields.members;
          const id = result(
            await db().rpc("save_roster", {
              target: spec.table,
              record_id: row?.id ?? null,
              fields,
              members,
            }),
          );
          return { id, ...fields } as Row;
        }
        return await save(spec.table, fields, row?.id);
      } catch (e) {
        await Promise.allSettled(assets.map(discardAsset));
        throw e;
      }
    },
    onSuccess: (r) => {
      // Do not keep the Save button pending while every workspace query refetches.
      // The row has already been committed; refresh cached lists in the background.
      void refresh().catch(() => undefined);
      done(r);
    },
  });
  function field(f: Field) {
    if (f.when && current[f.when[0]] !== f.when[1]) return null;
    const value = current[f.key],
      change = (v: any) => update(f.key, v);
    if (f.type === "traits")
      return (
        <div className="trait-editor span2" key={f.key}>
          {traitNames.map((t) => (
            <label key={t}>
              <span>
                <b>{t}</b>
                <small>{(value as Record<string, number>)[t] ?? 50}%</small>
              </span>
              <input
                type="range"
                value={(value as Record<string, number>)[t] ?? 50}
                onChange={(e) => change({ ...(value as object), [t]: Number(e.target.value) })}
              />
            </label>
          ))}
        </div>
      );
    return (
      <label
        key={f.key}
        className={["area", "multi", "file"].includes(f.type || "") ? "span2" : ""}
      >
        {f.label}
        {f.type === "ref" || f.type === "multi" ? (
          <Choices field={f} value={value ?? ""} change={change} />
        ) : f.type === "file" ? (
          <>
            <input type="file" accept={f.accept} onChange={(e) => {
              const selected = e.target.files?.[0];
              if (selected) setFiles((v) => ({ ...v, [f.key]: selected }));
            }} />
            {row?.[f.key] && <small className="field-hint">
              An existing file is saved. Choose another file only if you want to replace it.
            </small>}
          </>
        ) : f.type === "area" ? (
          <textarea
            value={String(value ?? "")}
            required={f.required}
            onChange={(e) => change(e.target.value)}
          />
        ) : f.type === "select" ? (
          <select value={String(value)} onChange={(e) => change(e.target.value)}>
            {f.options?.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        ) : f.type === "check" ? (
          <input type="checkbox" checked={!!value} onChange={(e) => change(e.target.checked)} />
        ) : (
          <input
            type={f.type || "text"}
            required={f.required}
            min={f.min}
            max={f.max}
            step={f.step}
            value={String(value ?? "")}
            onChange={(e) => change(e.target.value)}
          />
        )}
      </label>
    );
  }
  return (
    <>
      <form
        className="editor-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (wizard && step < 7) setStep(step + 1);
          else persist.mutate(false);
        }}
      >
        {wizard && (
          <div className="wizard-steps">
            {wizardSteps.map((s, i) => (
              <button
                type="button"
                key={s}
                className={i === step ? "active" : ""}
                onClick={() => setStep(i)}
              >
                <span>{i + 1}</span>
                <small>{s}</small>
              </button>
            ))}
          </div>
        )}
        <div className={wizard ? "wizard-layout" : ""}>
          <Card className="wizard-form">
            {wizard && (
              <div className="step-heading">
                <span>Step {step + 1} of 8</span>
                <h2>{wizardSteps[step]}</h2>
              </div>
            )}
            <fieldset disabled={persist.isPending} className="form-grid">
              {spec.fields.filter((f) => !wizard || wizardKeys[step].includes(f.key)).map(field)}
            </fieldset>
            {(persist.isError || roster.isError) && (
              <p role="alert" className="form-error">
                {errorText(persist.error || roster.error)}
              </p>
            )}
            <div className="wizard-actions">
              {wizard && step > 0 && (
                <Button secondary disabled={persist.isPending} onClick={() => setStep(step - 1)}>Back</Button>
              )}
              <Button secondary disabled={persist.isPending} onClick={cancel}>Cancel</Button>
              {wizard && (
                <Button secondary disabled={persist.isPending} onClick={() => persist.mutate(true)}>
                  Save draft & exit
                </Button>
              )}
              <Button
                type="submit"
                disabled={persist.isPending || (hasRoster && !!row && !roster.isSuccess)}
              >
                {persist.isPending
                  ? "Saving…"
                  : wizard && step < 7
                    ? "Continue"
                    : "Save " + spec.singular}
              </Button>
            </div>
          </Card>
          {wizard && (
            <Card className="preview-panel">
              <p className="eyebrow">Character preview</p>
              <h2>{String(values.name || "Untitled character")}</h2>
              <p>
                {[values.age, values.pronouns, values.relationship].filter(Boolean).join(" · ")}
              </p>
              <p>{String(values.biography)}</p>
              <Badge>{String(values.status)}</Badge>
            </Card>
          )}
        </div>
      </form>
    </>
  );
}
