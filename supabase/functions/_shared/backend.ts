import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.95.3";
export type DB = SupabaseClient;
export function required(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(name + " is not configured");
  return value;
}
export function backend(token?: string) {
  return createClient(
    required("SUPABASE_URL"),
    required(token ? "SUPABASE_ANON_KEY" : "SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: token ? { headers: { Authorization: "Bearer " + token } } : undefined,
    },
  );
}
export function checked<T>(r: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (r.error) throw new Error(r.error.message);
  return r.data as NonNullable<T>;
}
export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
export function endpoint(handler: (req: Request) => Promise<unknown>) {
  return async (req: Request) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    try {
      if (req.method !== "POST") throw new HttpError(405, "Use POST");
      return Response.json(await handler(req), { headers: cors });
    } catch (e) {
      return Response.json({ error: e instanceof Error ? e.message : "Request failed" }, {
        status: e instanceof HttpError ? e.status : 400,
        headers: cors,
      });
    }
  };
}
export async function authorize(req: Request) {
  const token = req.headers.get("Authorization")?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) throw new HttpError(401, "Sign in required");
  const db = backend(token);
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, "Session expired");
  if (!checked(await db.rpc("is_myra_admin"))) {
    throw new HttpError(403, "Administrator access required");
  }
  return { db, actor: data.user.id, service: backend() };
}
export type Context = Awaited<ReturnType<typeof authorize>>;
export function id(value: unknown) {
  if (
    typeof value !== "string" ||
    !/^\w{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value)
  ) throw new HttpError(422, "Invalid record ID");
  return value;
}
