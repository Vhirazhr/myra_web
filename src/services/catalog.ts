import type { Field, Spec } from "../types/workspace";
export const text = (key: string, label: string, required = false): Field => ({
  key,
  label,
  required,
});
const area = (key: string, label: string): Field => ({ key, label, type: "area" });
const choose = (key: string, label: string, options: string[]): Field => ({
  key,
  label,
  type: "select",
  options,
  initial: options[0],
});
const ref = (key: string, label: string, table: string, required = true): Field => ({
  key,
  label,
  table,
  required,
  type: "ref",
});
const number = (
  key: string,
  label: string,
  initial: number,
  min: number,
  max: number,
  step = "1",
): Field => ({ key, label, type: "number", initial, min, max, step });
const file = (key: string, label: string, bucket: string, accept: string): Field => ({
  key,
  label,
  type: "file",
  bucket,
  accept,
});
const time = (key: string, label: string, type: "datetime-local" | "date" | "time"): Field => ({
  key,
  label,
  type,
  required: true,
});
const roster: Field = {
  key: "members",
  label: "Character roster",
  type: "multi",
  table: "characters",
};
export const character: Spec = {
  table: "characters",
  singular: "character",
  fields: [
    text("name", "Character name", true),
    number("age", "Age", 24, 18, 120),
    text("gender", "Gender"),
    text("pronouns", "Pronouns"),
    area("biography", "Biography"),
    file("portrait", "Portrait", "character-avatars", "image/*"),
    area("appearance", "Appearance and visual style"),
    { key: "personality", label: "Personality spectrum", type: "traits" },
    text("relationship", "Relationship type"),
    text("language", "Preferred language"),
    area("communication", "Communication style, response length and emoji use"),
    text("voice", "Voice assignment"),
    area("background", "Background and interests"),
    area("scenario", "Roleplay scenario and boundaries"),
    choose("status", "Status", ["active", "draft", "archived"]),
  ],
};
export const universe: Spec = {
  table: "universes",
  singular: "universe",
  fields: [
    text("name", "Universe name", true),
    text("genre", "Genre"),
    area("description", "World description"),
    area("rules", "World rules"),
    file("cover", "World cover", "universe-covers", "image/*"),
    roster,
  ],
};
const world = (kind: string, singular: string): Spec => ({
  table: "world_entries",
  singular,
  fixed: { kind },
  fields: [
    ref("universe_id", "Universe", "universes"),
    text("name", "Title", true),
    area("body", "Details"),
    ...(kind === "event" ? [time("event_date", "Event date", "date")] : []),
  ],
});
export const group: Spec = {
  table: "groups",
  singular: "group",
  fields: [
    text("name", "Group name", true),
    area("description", "Group description"),
    choose("mode", "Conversation mode", ["Hybrid", "Natural Chat", "Cinematic Roleplay"]),
    roster,
  ],
};
export const relationship: Spec = {
  table: "relationships",
  singular: "relationship",
  label: "kind",
  fields: [
    ref("character_id", "Character", "characters"),
    ref("other_character_id", "Related character", "characters"),
    choose("kind", "Relationship type", ["friends", "romantic", "rivals", "family"]),
    number("trust", "Trust", 50, 0, 100),
    area("history", "Relationship history"),
  ],
};
export const conversation: Spec = {
  table: "conversations",
  singular: "conversation",
  fields: [
    text("name", "Conversation title", true),
    choose("target", "Participants", ["character", "group"]),
    { ...ref("character_id", "Character", "characters"), when: ["target", "character"] },
    { ...ref("group_id", "Group", "groups"), when: ["target", "group"] },
    ref("universe_id", "Universe context", "universes", false),
    ref("crossover_id", "Crossover context", "crossovers", false),
    { ...text("language", "Language", true), initial: "Indonesian" },
    choose("mode", "Conversation style", ["hybrid", "natural", "learning", "immersion"]),
    choose("relationship_stage", "Relationship stage", [
      "Best friends",
      "Growing closer",
      "Developing feelings",
      "Romantic partners",
    ]),
    { key: "proactive", label: "Allow character-initiated messages", type: "check" },
  ],
};
const scopeRefs = [
  ["character", "character_id", "Character", "characters"],
  ["personal", "conversation_id", "Conversation", "conversations"],
  ["group", "group_id", "Group", "groups"],
  ["social", "relationship_id", "Relationship", "relationships"],
  ["universe", "universe_id", "Universe", "universes"],
  ["crossover", "crossover_id", "Crossover", "crossovers"],
];
export const memory: Spec = {
  table: "memories",
  singular: "memory",
  label: "body",
  fields: [
    choose("scope", "Memory scope", ["user", ...scopeRefs.map((r) => r[0])]),
    ...scopeRefs.map(([scope, key, label, t]): Field => ({
      ...ref(key, label, t),
      when: ["scope", scope],
    })),
    { ...area("body", "Memory"), required: true },
    number("importance", "Importance", 5, 1, 10),
  ],
};
export const story: Spec = {
  table: "stories",
  singular: "story",
  fields: [
    text("name", "Story title", true),
    ref("character_id", "Author", "characters"),
    area("caption", "Caption"),
    file("media", "Photo or video", "stories", "image/*,video/*"),
    choose("status", "Publication", ["draft", "published", "archived"]),
    choose("audience", "Audience", ["private", "group", "universe"]),
    { ...ref("group_id", "Audience group", "groups"), when: ["audience", "group"] },
    { ...ref("universe_id", "Audience universe", "universes"), when: ["audience", "universe"] },
    time("publish_at", "Publish at", "datetime-local"),
    time("expires_at", "Expires at", "datetime-local"),
  ],
};
const check = (key: string, label: string): Field => ({ key, label, type: "check" });
export const preferences: Spec = {
  table: "settings",
  singular: "settings",
  fields: [
    check("simulation", "Enable background simulation"),
    { ...check("notifications", "Enable notifications"), initial: true },
    check("proactive", "Enable proactive messaging"),
    { ...text("timezone", "IANA time zone", true), initial: "Asia/Jakarta" },
    { ...time("quiet_start", "Quiet hours start", "time"), initial: "22:00" },
    { ...time("quiet_end", "Quiet hours end", "time"), initial: "07:00" },
    number("frequency_hours", "Proactive interval (hours)", 24, 1, 720),
    { ...text("language", "Default language", true), initial: "Indonesian" },
    area("system_prompt", "Response behavior and boundaries"),
    number("memory_limit", "Memories per request", 12, 1, 40),
  ],
};

export const aiProvider: Spec = {
  table: "providers",
  singular: "AI provider",
  label: "name",
  description: "Provider credentials are configured as Supabase Edge Function secrets; this form stores only the secret variable name.",
  fields: [
    text("name", "Provider name", true),
    choose("adapter", "Provider adapter", ["gemini", "openrouter", "openai", "anthropic", "compatible"]),
    text("model", "Model ID", true),
    number("priority", "Priority (lower runs first)", 1, 1, 50),
    check("enabled", "Enabled for automatic fallback"),
    number("temperature", "Temperature", 0.7, 0, 2),
    text("base_url", "API base URL (compatible providers only)"),
    text("secret_name", "Supabase secret variable name"),
    number("input_price", "Input price per 1M tokens (USD)", 0, 0, 1000),
    number("output_price", "Output price per 1M tokens (USD)", 0, 0, 1000),
  ],
};
export const catalog: Record<string, Spec> = {
  characters: character,
  universes: universe,
  groups: group,
  lore: world("lore", "lore entry"),
  timeline: world("event", "timeline event"),
  locations: world("location", "location"),
  crossover: {
    table: "crossovers",
    singular: "crossover",
    fields: [
      text("name", "Session name", true),
      ref("universe_id", "Origin universe", "universes"),
      ref("other_universe_id", "Guest universe", "universes"),
      area("description", "Session premise"),
    ],
  },
  relationships: relationship,
  interactions: {
    table: "interactions",
    singular: "interaction",
    fields: [
      ref("relationship_id", "Relationship", "relationships"),
      text("name", "Title", true),
      choose("kind", "Type", ["interaction", "milestone"]),
      area("body", "What happened"),
    ],
  },
  schedules: {
    table: "schedules",
    singular: "schedule",
    fields: [
      ref("character_id", "Character", "characters"),
      text("name", "Schedule name", true),
      time("at_time", "Local time", "time"),
      area("activity", "Activity"),
      text("mood", "Mood"),
      ref("relationship_id", "Social relationship", "relationships", false),
      check("milestone", "Record relationship milestone"),
      { ...check("enabled", "Enabled"), initial: true },
    ],
  },
  activities: {
    table: "diaries",
    singular: "diary entry",
    fields: [
      ref("character_id", "Character", "characters"),
      text("name", "Activity", true),
      area("body", "Diary"),
      text("mood", "Mood"),
    ],
  },
  events: {
    table: "events",
    singular: "event",
    fields: [
      ref("character_id", "Character", "characters"),
      text("name", "Event name", true),
      area("body", "Details"),
      time("due_at", "Scheduled for", "datetime-local"),
    ],
  },
  notifications: {
    table: "notifications",
    singular: "notification",
    fields: [
      text("name", "Title", true),
      area("body", "Message"),
      time("due_at", "Deliver at", "datetime-local"),
    ],
  },
  memory,
  stories: story,
  "story-scheduler": story,
  logs: conversation,
};
export function displayName(r: Record<string, unknown>) {
  return String(r.name || r.body || r.kind || r.model || r.id);
}
