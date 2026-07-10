// supabase/functions/create-upload/index.ts
import { requireUser, svc, CORS, withCors } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const user = await requireUser(req);
    const { bunny_path, title, tags, sha256_head, duration_s } = await req.json();
    if (!bunny_path) return json({ error: "bunny_path required" }, 400);
    const { url, key } = svc();
    const h = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

    // attestation gate: the user must have attested at least once.
    const att = await fetch(
      `${url}/rest/v1/upload_attestations?user_id=eq.${user.id}&select=id&limit=1`,
      { headers: h },
    ).then((r) => r.json());
    if (!att.length) return json({ error: "attestation required" }, 403);

    // rate limit: max 30 uploads created in the last hour.
    const since = new Date(Date.now() - 3600e3).toISOString();
    const recent = await fetch(
      `${url}/rest/v1/uploads?user_id=eq.${user.id}&created_at=gte.${since}&select=id`,
      { headers: h },
    ).then((r) => r.json());
    if (recent.length >= 30) return json({ error: "rate limit" }, 429);

    const row = {
      user_id: user.id,
      bunny_path,
      title: title || "",
      tags: tags || [],
      sha256_head: sha256_head || null,
      duration_s: duration_s || null,
      status: "processing",
    };
    const ins = await fetch(`${url}/rest/v1/uploads`, {
      method: "POST",
      headers: { ...h, Prefer: "return=representation" },
      body: JSON.stringify(row),
    });
    if (!ins.ok) return json({ error: "insert failed", detail: await ins.text() }, 500);
    const [created] = await ins.json();
    return json({ uploadId: created.id }, 201);
  } catch (e) {
    return e instanceof Response ? withCors(e) : json({ error: String(e) }, 500);
  }
});

function json(b: unknown, s: number) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
}
