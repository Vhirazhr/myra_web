import { useQuery, useInfiniteQuery, QueryClient } from "@tanstack/react-query";
import { db } from "../lib/supabase";
import type { Row, Values } from "../types/workspace";
export const cache = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 15000 }, mutations: { retry: false } },
});
export function result<T>(r: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (r.error) throw new Error(r.error.message);
  return r.data as NonNullable<T>;
}
export function errorText(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}
export async function rows(table: string, filters: Record<string, string> = {}) {
  const items: Row[] = [];
  for (let offset = 0; ; offset += 200) {
    const data = result(
      await db()
        .from(table)
        .select("*")
        .match(filters)
        .order("created_at", { ascending: false })
        .order("id")
        .range(offset, offset + 199),
    ) as Row[];
    items.push(...data);
    if (data.length < 200) return items;
  }
}
export function useRows(table: string, filters: Record<string, string> = {}, enabled = true) {
  return useQuery({
    queryKey: ["rows", table, filters],
    queryFn: () => rows(table, filters),
    enabled,
  });
}
export async function save(table: string, values: Values, id?: string) {
  return result(
    await (id ? db().from(table).update(values).eq("id", id) : db().from(table).insert(values))
      .select()
      .single(),
  ) as Row;
}
export async function remove(table: string, id: string) {
  result(await db().from(table).delete().eq("id", id).select("id").single());
}
export async function call(action: string, data: Record<string, unknown> = {}) {
  const r = await db().functions.invoke("myra", { body: { action, ...data } });
  if (r.error) {
    let detail = r.error.message;
    try {
      detail = (await r.error.context.json()).error || detail;
    } catch {}
    throw new Error(detail);
  }
  return r.data;
}
export async function upload(
  bucket: string,
  file: File,
  metadata: { characterId?: string; description?: string; tags?: string[]; generationPrompt?: string; origin?: string } = {},
) {
  const {
    data: { user },
    error,
  } = await db().auth.getUser();
  if (error) throw error;
  if (!user) throw new Error("Sign in to upload");
  if (file.size > (bucket === "character-avatars" ? 10 : 50) * 1024 * 1024)
    throw new Error("File exceeds the bucket limit");
  const ext = (file.name.split(".").pop() || "bin")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 10);
  const path = user.id + "/" + crypto.randomUUID() + "." + ext;
  result(await db().storage.from(bucket).upload(path, file, { contentType: file.type }));
  try {
    return await save("media_assets", {
      bucket,
      path,
      name: file.name,
      mime: file.type,
      bytes: file.size,
    });
  } catch (e) {
    await db().storage.from(bucket).remove([path]);
    throw e;
  }
}
export async function discardAsset(asset: Row) {
  result(await db().storage.from(asset.bucket).remove([asset.path]));
  await remove("media_assets", asset.id);
}
export function useSigned(bucket: string, path?: string) {
  return useQuery({
    queryKey: ["signed", bucket, path],
    enabled: !!path,
    queryFn: async () =>
      result(await db().storage.from(bucket).createSignedUrl(path!, 3600)).signedUrl,
    staleTime: 3000000,
  });
}
export const refresh = () => cache.invalidateQueries({ queryKey: ["rows"] });

export function useRecent(table: string, limit: number) {
  return useQuery({
    queryKey: ["rows", table, "recent", limit],
    queryFn: async () =>
      result(
        await db().from(table).select("*").order("created_at", { ascending: false }).limit(limit),
      ) as Row[],
  });
}
export function useHistory(thread: string, search: string) {
  return useInfiniteQuery({
    queryKey: ["rows", "messages", thread, search],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      let q = db().from("messages").select("*").eq("conversation_id", thread);
      if (search.trim()) q = q.ilike("body", "%" + search.trim() + "%");
      return result(
        await q
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .range(pageParam, pageParam + 49),
      ) as Row[];
    },
    getNextPageParam: (last, all) => (last.length === 50 ? all.length * 50 : undefined),
  });
}
