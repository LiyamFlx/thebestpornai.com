// supabase/functions/finalize-upload/index.ts
import { requireUser, svc, CORS, withCors } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const user = await requireUser(req);
    const { uploadId } = await req.json();
    if (!uploadId) return json({ error: "uploadId required" }, 400);
    const { url, key } = svc();
    const h = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

    const [row] = await fetch(
      `${url}/rest/v1/uploads?id=eq.${uploadId}&select=id,user_id,status`,
      { headers: h },
    ).then((r) => r.json());
    if (!row) return json({ error: "not found" }, 404);
    if (row.user_id !== user.id) return json({ error: "forbidden" }, 403);

    const published_at = new Date().toISOString();
    // OWNER DECISION: no moderation gate — straight to live.
    const upd = await fetch(`${url}/rest/v1/uploads?id=eq.${uploadId}`, {
      method: "PATCH",
      headers: h,
      body: JSON.stringify({ status: "live", published_at }),
    });
    if (!upd.ok) return json({ error: "update failed" }, 500);

    // bump clean_publishes (upsert creator_trust).
    await fetch(`${url}/rest/v1/creator_trust`, {
      method: "POST",
      headers: { ...h, Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({ user_id: user.id, clean_publishes: 1 }),
    });
    return json({ status: "live", published_at }, 200);
  } catch (e) {
    return e instanceof Response ? withCors(e) : json({ error: String(e) }, 500);
  }
});

function json(b: unknown, s: number) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
}
