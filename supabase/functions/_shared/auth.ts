// supabase/functions/_shared/auth.ts
// Shared helpers for the upload edge functions.

export async function requireUser(req: Request): Promise<{ id: string }> {
  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) throw new Response("unauthorized", { status: 401 });
  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const r = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anon, Authorization: auth } });
  if (!r.ok) throw new Response("unauthorized", { status: 401 });
  const u = await r.json();
  return { id: u.id };
}

export function svc() {
  return { url: Deno.env.get("SUPABASE_URL")!, key: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")! };
}

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Wrap a thrown Response so it still carries CORS headers.
export function withCors(r: Response): Response {
  const h = new Headers(r.headers);
  Object.entries(CORS).forEach(([k, v]) => h.set(k, v));
  return new Response(r.body, { status: r.status, headers: h });
}
