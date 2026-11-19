import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Badge, Button, Card } from "../components/ui";
import { Heading, Media } from "../components/Records";
import {
  call,
  discardAsset,
  errorText,
  refresh,
  upload,
  useRows,
} from "../services/workspace";
import type { Row } from "../types/workspace";

const FLOW_URL = "https://labs.google/fx/tools/flow";
type Purpose = "selfie" | "portrait" | "daily" | "outfit" | "cinematic" | "video";

const purposeCopy: Record<Purpose, { label: string; direction: string; ratio: string }> = {
  selfie: {
    label: "Casual selfie",
    direction: "A natural smartphone selfie, relaxed expression, believable indoor or outdoor lighting, intimate eye-level framing.",
    ratio: "vertical 9:16",
  },
  portrait: {
    label: "Character portrait",
    direction: "A polished head-and-shoulders portrait, expressive eyes, natural skin texture, soft flattering light, clean composition.",
    ratio: "portrait 4:5",
  },
  daily: {
    label: "Daily activity",
    direction: "A candid slice-of-life moment showing the character doing an everyday activity, documentary-style realism and natural body language.",
    ratio: "vertical 9:16",
  },
  outfit: {
    label: "Outfit photo",
    direction: "A full-body fashion photograph that clearly shows the outfit, realistic fabric texture, natural proportions, confident but relaxed pose.",
    ratio: "vertical 9:16",
  },
  cinematic: {
    label: "Cinematic scene",
    direction: "A cinematic still with intentional composition, atmospheric lighting, realistic depth, subtle film texture and expressive storytelling.",
    ratio: "landscape 16:9",
  },
  video: {
    label: "Short video",
    direction: "Create a coherent 6–8 second video. Preserve the same face, hairstyle, age, outfit and body proportions in every frame. Use subtle natural movement, stable camera motion and no sudden scene changes.",
    ratio: "vertical 9:16",
  },
};

export function CharacterMediaStudio() {
  const characters = useRows("characters");
  const conversations = useRows("conversations");
  const groupMembers = useRows("group_members");
  const [characterId, setCharacterId] = useState("");
  const [purpose, setPurpose] = useState<Purpose>("selfie");
  const [extra, setExtra] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("selfie, casual, daily");
  const [file, setFile] = useState<File | null>(null);
  const [conversationId, setConversationId] = useState("");
  const [caption, setCaption] = useState("");
  const [notice, setNotice] = useState("");
  const character = characters.data?.find((item) => item.id === characterId) || characters.data?.[0];
  const assets = useRows("media_assets", { character_id: character?.id || "" }, !!character?.id);
  const characterAssets = (assets.data || []).filter((asset) => asset.bucket === "stories");
  const relatedConversations = useMemo(
    () =>
      conversations.data?.filter(
        (thread) =>
          thread.character_id === character?.id ||
          (!!thread.group_id &&
            groupMembers.data?.some(
              (member) =>
                member.group_id === thread.group_id && member.character_id === character?.id,
            )),
      ) || [],
    [conversations.data, groupMembers.data, character?.id],
  );

  useEffect(() => {
    if (!characterId && characters.data?.[0]) setCharacterId(characters.data[0].id);
  }, [characterId, characters.data]);

  useEffect(() => {
    if (!relatedConversations.some((thread) => thread.id === conversationId)) {
      setConversationId(relatedConversations[0]?.id || "");
    }
  }, [conversationId, relatedConversations]);

  const prompt = useMemo(() => {
    if (!character) return "Create a character first to build a consistent media prompt.";
    const scene = purposeCopy[purpose];
    const identity = [
      character.appearance,
      character.biography,
      character.background,
    ].filter(Boolean).join(" ");
    return [
      "Create a high-quality visual of the same fictional adult character described below.",
      "CHARACTER IDENTITY: " + character.name + (character.age ? ", age " + character.age : "") + ".",
      identity ? "IDENTITY AND APPEARANCE: " + identity : "Use the supplied character reference image as the primary identity reference.",
      "PERSONALITY AND EXPRESSION: " + JSON.stringify(character.personality || {}) + ".",
      "SCENE DIRECTION: " + scene.direction,
      "ASPECT RATIO: " + scene.ratio + ".",
      "CONSISTENCY RULES: preserve the exact same face, eye shape, hairstyle, skin tone, age, body proportions and distinctive features from the reference image. Do not redesign the character. Keep anatomy, hands, clothing and lighting realistic. No captions, watermarks, logos or text.",
      extra.trim() ? "ADDITIONAL DIRECTION: " + extra.trim() : "",
      purpose === "video"
        ? "VIDEO NOTES: one continuous shot, natural movement, stable identity between frames, no morphing or face drift."
        : "IMAGE NOTES: one finished image, crisp details, natural texture and coherent lighting.",
      "Use the character portrait as an image/ingredient reference in Google Flow before generating.",
    ].filter(Boolean).join("\n\n");
  }, [character, purpose, extra]);

  const add = useMutation({
    mutationFn: async () => {
      if (!character) throw new Error("Create a character first.");
      if (!file) throw new Error("Choose an image or video exported from Google Flow.");
      const allowedTypes = ["image/png","image/jpeg","image/webp","image/gif","video/mp4","video/webm"];
      if (!allowedTypes.includes(file.type)) throw new Error("Use PNG, JPG, WEBP, GIF, MP4 or WEBM files.");
      if (file.size > 50 * 1024 * 1024) throw new Error("The file must be 50 MB or smaller.");
      return upload("stories", file, {
        characterId: character.id,
        description: description.trim(),
        tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean),
        generationPrompt: prompt,
        origin: "google-flow",
      });
    },
    onSuccess: async () => {
      setFile(null);
      setDescription("");
      setNotice("Media saved to this character's private library.");
      await refresh();
    },
  });

  const send = useMutation({
    mutationFn: async (asset: Row) => {
      if (!conversationId) throw new Error("Choose a conversation for this character.");
      return call("send-media", {
        assetId: asset.id,
        conversationId,
        caption: caption.trim() || "I wanted to share this with you ✨",
      });
    },
    onSuccess: async () => {
      setNotice("Media sent to the selected conversation.");
      await refresh();
    },
  });

  const remove = useMutation({
    mutationFn: async (asset: Row) => {
      if (!window.confirm("Delete this media file permanently?")) return false;
      await discardAsset(asset);
      return true;
    },
    onSuccess: async (deleted) => {
      if (!deleted) return;
      setNotice("Media deleted.");
      await refresh();
    },
  });

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      setNotice("Prompt copied. Open Google Flow and paste it into the prompt box.");
    } catch {
      setNotice("Clipboard access is unavailable. Select and copy the prompt manually.");
    }
  }

  return (
    <div className="page">
      <Heading
        section="Stories & Media"
        title="Character Media Studio"
        description="Create prompts for Google Flow, import finished media, and let characters share it in chat."
      >
        <Button secondary onClick={() => window.open(FLOW_URL, "_blank", "noopener,noreferrer")}>
          Open Google Flow
        </Button>
      </Heading>

      <div className="media-bridge-banner">
        <div>
          <Badge tone="green">Google AI Plus workflow</Badge>
          <h2>Your subscription creates the media. MYRA stores and shares it.</h2>
          <p>
            Flow does not expose your Plus subscription as a callable MYRA API. Generate in Flow,
            download the result, then import it here. MYRA can then attach matching media to a
            character's replies.
          </p>
        </div>
        <div className="media-bridge-credit">
          <strong>Google Flow</strong>
          <span>Use the credits and limits displayed in your own Google account.</span>
        </div>
      </div>

      <div className="media-studio-grid">
        <Card className="wizard-form">
          <div className="media-section-head">
            <div>
              <p className="eyebrow">01 · Prompt builder</p>
              <h2>Build a consistent character prompt</h2>
            </div>
            <Badge>Copy & paste</Badge>
          </div>
          <label>
            Character
            <select
              value={character?.id || ""}
              onChange={(event) => setCharacterId(event.target.value)}
              disabled={!characters.data?.length}
            >
              {characters.data?.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </label>
          <label>
            Media type
            <select value={purpose} onChange={(event) => setPurpose(event.target.value as Purpose)}>
              {Object.entries(purposeCopy).map(([key, item]) => (
                <option key={key} value={key}>{item.label}</option>
              ))}
            </select>
          </label>
          <label>
            Extra scene direction
            <textarea
              rows={3}
              value={extra}
              onChange={(event) => setExtra(event.target.value)}
              placeholder="Example: at a cozy coffee shop on a rainy afternoon..."
            />
          </label>
          <label>
            Generated prompt
            <textarea className="media-prompt" rows={11} readOnly value={prompt} />
          </label>
          <div className="wizard-actions">
            <Button disabled={!character} onClick={() => void copyPrompt()}>Copy prompt</Button>
          </div>
          <p className="media-help">
            In Flow, add the character portrait as a reference/ingredient, paste the prompt, generate,
            then download the finished image or video.
          </p>
        </Card>

        <Card className="wizard-form">
          <div className="media-section-head">
            <div>
              <p className="eyebrow">02 · Import result</p>
              <h2>Save generated media to MYRA</h2>
            </div>
            <Badge tone="green">Private storage</Badge>
          </div>
          <label>
            File from Google Flow
            <input
              key={file?.name || "empty"}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
            />
          </label>
          {file && (
            <div className="media-file-choice">
              <span>{file.name}</span>
              <small>{(file.size / 1024 / 1024).toFixed(2)} MB · {file.type}</small>
            </div>
          )}
          <label>
            Description / scene
            <input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="A selfie at a coffee shop"
            />
          </label>
          <label>
            Search tags (comma separated)
            <input
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              placeholder="selfie, coffee shop, casual"
            />
          </label>
          <div className="media-upload-note">
            <strong>Storage limit: 50 MB per file</strong>
            <span>Supported: PNG, JPG, WEBP, GIF, MP4 and WEBM.</span>
          </div>
          <Button disabled={!file || !character || add.isPending} onClick={() => add.mutate()}>
            {add.isPending ? "Uploading…" : "Upload to character library"}
          </Button>
          {add.error && <p className="form-error" role="alert">{errorText(add.error)}</p>}
          {notice && <p className="media-notice" role="status">{notice}</p>}
        </Card>
      </div>

      <Card className="wizard-form media-library-panel">
        <div className="media-section-head">
          <div>
            <p className="eyebrow">03 · Character library</p>
            <h2>{character ? character.name + "'s media" : "Character media"}</h2>
            <p>Media stored here can be selected automatically when this character is asked for a photo or video.</p>
          </div>
          <Badge tone="green">{assets.isLoading ? "Loading…" : characterAssets.length + " assets"}</Badge>
        </div>
        <div className="media-send-toolbar">
          <label>
            Send to conversation
            <select
              value={conversationId}
              onChange={(event) => setConversationId(event.target.value)}
              disabled={!relatedConversations.length}
            >
              {relatedConversations.map((thread) => (
                <option key={thread.id} value={thread.id}>{thread.name}</option>
              ))}
            </select>
          </label>
          <label>
            Message caption
            <input
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
              placeholder="A short message from the character..."
            />
          </label>
        </div>
        {(assets.error || characters.error || conversations.error) && (
          <p className="form-error" role="alert">
            {errorText(assets.error || characters.error || conversations.error)}
          </p>
        )}
        {assets.isLoading ? (
          <p className="empty">Loading character media…</p>
        ) : assets.data?.length ? (
          <div className="media-asset-grid">
            {characterAssets.map((asset) => (
              <article className="media-asset-card" key={asset.id}>
                <div className="media-asset-preview">
                  <Media bucket={asset.bucket} path={asset.path} mime={asset.mime} />
                </div>
                <div className="media-asset-copy">
                  <strong>{asset.name}</strong>
                  <small>{asset.mime.startsWith("video/") ? "Video" : "Image"} · {(asset.bytes / 1024 / 1024).toFixed(2)} MB</small>
                  {asset.description && <p>{asset.description}</p>}
                  {!!asset.tags?.length && <div className="media-tags">{asset.tags.map((tag: string) => <span key={tag}>{tag}</span>)}</div>}
                  <div className="wizard-actions">
                    <Button
                      disabled={!conversationId || send.isPending}
                      onClick={() => send.mutate(asset)}
                    >
                      Send in chat
                    </Button>
                    <Button
                      secondary
                      disabled={remove.isPending}
                      onClick={() => remove.mutate(asset)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="empty">
            {character ? "No media for this character yet. Generate something in Flow and import it above." : "Create a character to begin."}
          </p>
        )}
        {send.error && <p className="form-error" role="alert">{errorText(send.error)}</p>}
        {remove.error && <p className="form-error" role="alert">{errorText(remove.error)}</p>}
      </Card>
    </div>
  );
}
