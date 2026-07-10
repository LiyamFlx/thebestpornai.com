// supabase/functions/dup-check/index.ts
import { requireUser, svc, CORS, withCors } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    await requireUser(req);
    const { sha256_head } = await req.json();
    if (!sha256_head) return json({ error: "sha256_head required" }, 400);
    const { url, key } = svc();
    const h = { apikey: key, Authorization: `Bearer ${key}` };
    const ban = await fetch(
      `${url}/rest/v1/banned_hashes?sha256_head=eq.${sha256_head}&select=reason`,
      { headers: h },
    ).then((r) => r.json());
    if (ban.length) return json({ duplicate: true, reason: "banned" }, 409);
    const dup = await fetch(
      `${url}/rest/v1/uploads?sha256_head=eq.${sha256_head}&select=id`,
      { headers: h },
    ).then((r) => r.json());
    if (dup.length) return json({ duplicate: true, reason: "exists" }, 409);
    return json({ duplicate: false }, 200);
  } catch (e) {
    return e instanceof Response ? withCors(e) : json({ error: String(e) }, 500);
  }
});

function json(b: unknown, s: number) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
}
