import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
const env = z.object({ url: z.url(), key: z.string().min(16) }).safeParse({
  url: import.meta.env.VITE_SUPABASE_URL,
  key: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
});
function publicKey(key: string) {
  if (key.startsWith("sb_publishable_")) return true;
  try {
    return (
      JSON.parse(atob(key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).role === "anon"
    );
  } catch {
    return false;
  }
}
export const client =
  env.success && publicKey(env.data.key)
    ? createClient(env.data.url, env.data.key, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      })
    : null;
export function db() {
  if (!client)
    throw new Error("Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to connect MYRA.");
  return client;
}
