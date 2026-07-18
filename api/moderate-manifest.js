import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";

/* Approve/remove a pending open-upload in the R2 manifest. Requires a signed-in
   Supabase session — the access token is verified against Supabase's own
   /auth/v1/user endpoint (no local JWT parsing/secret needed). */
export default async function handler(req, res) {
  const allowedOrigins = [
    "https://thebestpornai.com",
    "https://www.thebestpornai.com"
  ];
  const origin = req.headers.origin;
  let isAllowed = false;
  if (origin) {
    isAllowed = allowedOrigins.includes(origin) ||
                /^https?:\/\/localhost(:\d+)?$/.test(origin) ||
                /^https:\/\/.*\.vercel\.app$/.test(origin);
    if (isAllowed) {
      res.setHeader("Access-Control-Allow-Origin", origin);
    }
  } else {
    isAllowed = true;
  }

  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (!isAllowed) return res.status(403).json({ error: "CORS not allowed" });
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;
  const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
  const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
  const R2_ENDPOINT = process.env.R2_ENDPOINT;
  const R2_BUCKET = process.env.R2_BUCKET;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({ error: "Supabase env vars not set on Vercel" });
  }
  if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_ENDPOINT || !R2_BUCKET) {
    return res.status(500).json({ error: "R2 credentials or bucket name are not set on Vercel" });
  }

  // Require a real signed-in moderator: verify the bearer token with Supabase's
  // own auth server rather than trusting the client.
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return res.status(401).json({ error: "sign in required" });

  let moderatorEmail = "";
  try {
    const userRes = await fetch(SUPABASE_URL.replace(/\/$/, "") + "/auth/v1/user", {
      headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + token },
    });
    if (!userRes.ok) return res.status(401).json({ error: "invalid or expired session" });
    const user = await userRes.json();
    moderatorEmail = user?.email || user?.id || "";
    if (!moderatorEmail) return res.status(401).json({ error: "invalid session" });
  } catch (e) {
    return res.status(401).json({ error: "session verification failed" });
  }

  const { id, action } = req.body || {};
  if (!id || (action !== "approve" && action !== "remove")) {
    return res.status(400).json({ error: "id and action ('approve'|'remove') are required" });
  }
  const targetId = Number(id);

  try {
    const s3 = new S3Client({
      region: "auto",
      endpoint: R2_ENDPOINT,
      credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
      forcePathStyle: true,
    });

    let retries = 5;
    let success = false;
    let found = false;
    while (retries > 0 && !success) {
      let existing = [];
      let etag = undefined;
      try {
        const getRes = await s3.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: "manifest.json" }));
        existing = JSON.parse(await getRes.Body.transformToString());
        etag = getRes.ETag;
      } catch (s3Err) {
        if (s3Err.name === "NoSuchKey" || s3Err.code === "NoSuchKey") existing = [];
        else throw s3Err;
      }
      if (!Array.isArray(existing)) existing = [];

      found = existing.some(item => Number(item.id) === targetId);
      if (!found) break; // nothing to do, no point retrying

      const updated = action === "remove"
        ? existing.filter(item => Number(item.id) !== targetId)
        : existing.map(item => Number(item.id) === targetId ? { ...item, status: "published" } : item);

      try {
        const putParams = {
          Bucket: R2_BUCKET,
          Key: "manifest.json",
          Body: JSON.stringify(updated, null, 2),
          ContentType: "application/json",
        };
        if (etag) putParams.IfMatch = etag;
        await s3.send(new PutObjectCommand(putParams));
        success = true;
      } catch (putErr) {
        if (putErr.name === "PreconditionFailed" || putErr.code === "PreconditionFailed" || putErr.$metadata?.httpStatusCode === 412) {
          retries--;
          if (retries === 0) throw new Error("Failed to update manifest.json due to concurrent writes after maximum retries");
          await new Promise(resolve => setTimeout(resolve, Math.random() * 200 + 50));
        } else {
          throw putErr;
        }
      }
    }

    if (!found) return res.status(404).json({ error: "manifest entry not found" });
    return res.status(200).json({ ok: true, id: targetId, action, moderator: moderatorEmail });
  } catch (e) {
    return res.status(500).json({ error: "moderate-manifest error", detail: String(e?.message || e) });
  }
}
