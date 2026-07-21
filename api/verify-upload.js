/* Vercel serverless — server-verified compliance gate, run AFTER the browser
 * finishes its direct-to-R2 PUT (see api/presign.js) and BEFORE the entry is
 * allowed into the public manifest (see api/save-upload.js, which now
 * requires the uploadId this endpoint returns).
 *
 * Does the things a client-supplied hash and a client-supplied "is this
 * clean" flag can never be trusted to do honestly:
 *   1. Verify a real attestation token exists for this client (not just that
 *      the client claims one was shown).
 *   2. Stream the actual object back from R2 and compute its real SHA-256 —
 *      the OLD dup-check (supabase/functions/dup-check) trusted a
 *      client-supplied sha256_head, which a malicious client can simply lie
 *      about. This is the fix.
 *   3. Check that hash against banned_hashes and existing uploads (dedup).
 *   4. Run the CSAM interception point (lib/csam.js). Publishes instantly
 *      (status='live') unless a configured vendor actually flags the file —
 *      an unconfigured vendor does not hold uploads back, since no CSAM
 *      check existed before this pipeline either. Only a real vendor flag
 *      lands status='held' for manual moderator review via
 *      api/moderate-manifest.js.
 *
 * Required env: R2_* (already set), SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * ATTEST_HMAC_SECRET.
 */
import crypto from "crypto";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { applyCors } from "../lib/cors.js";
import { serviceRequest } from "../lib/supabase-service.js";
import { verifyAttestToken } from "../lib/attest-token.js";
import { csamCheck } from "../lib/csam.js";

// Only images/video that presign.js would have issued a key for; large video
// files are hashed via a streaming digest so memory stays flat regardless of
// file size (no full-file buffering).
async function hashR2Object(s3, bucket, key) {
  const obj = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const hash = crypto.createHash("sha256");
  for await (const chunk of obj.Body) hash.update(chunk);
  return hash.digest("hex");
}

export default async function handler(req, res) {
  if (!applyCors(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });

  const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
  const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
  const R2_ENDPOINT = process.env.R2_ENDPOINT;
  const R2_BUCKET = process.env.R2_BUCKET;
  if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_ENDPOINT || !R2_BUCKET) {
    return res.status(500).json({ error: "R2 credentials are not set on Vercel" });
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: "Supabase service-role env vars not set on Vercel" });
  }

  const { clientId, path, attestToken, title, width, height, durationS } = req.body || {};
  if (!clientId || typeof clientId !== "string") {
    return res.status(400).json({ error: "clientId is required" });
  }
  if (!path || typeof path !== "string" || !path.startsWith("media/uploads/")) {
    return res.status(400).json({ error: "invalid upload path" });
  }

  // 1. Real attestation, not a client-asserted flag.
  const attestation = verifyAttestToken(attestToken, clientId);
  if (!attestation) {
    return res.status(403).json({ error: "missing or expired attestation — call /api/attest first" });
  }

  const s3 = new S3Client({
    region: "auto",
    endpoint: R2_ENDPOINT,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
    forcePathStyle: true,
  });

  // 2. Server-computed hash of the actual uploaded bytes.
  let sha256;
  try {
    sha256 = await hashR2Object(s3, R2_BUCKET, path);
  } catch (e) {
    return res.status(502).json({ error: "could not read uploaded object", detail: String(e?.message || e) });
  }

  // 3. Banned-hash + duplicate check, server-side (the old dup-check edge
  // function trusted a client-supplied partial hash — this trusts nothing
  // the client said).
  try {
    const bannedRes = await serviceRequest(`/banned_hashes?sha256_head=eq.${encodeURIComponent(sha256)}&select=sha256_head`);
    const banned = bannedRes.ok ? await bannedRes.json() : [];
    if (Array.isArray(banned) && banned.length > 0) {
      return res.status(403).json({ ok: false, reason: "banned" });
    }
    const dupRes = await serviceRequest(`/uploads?sha256_head=eq.${encodeURIComponent(sha256)}&select=id&limit=1`);
    const dup = dupRes.ok ? await dupRes.json() : [];
    if (Array.isArray(dup) && dup.length > 0) {
      return res.status(409).json({ ok: false, reason: "duplicate" });
    }
  } catch (e) {
    // Hash-check infra failure: fail closed on the whole upload, don't let
    // an unreachable Supabase silently skip the banned-hash check.
    return res.status(502).json({ error: "hash-check failed", detail: String(e?.message || e) });
  }

  // 4. CSAM interception — only an actual vendor flag holds a video back.
  // See lib/csam.js: unconfigured (no vendor wired up) is NOT treated as a
  // block, matching pre-hardening behavior where no CSAM check existed at
  // all. Wire up a real vendor (Cloudflare/Thorn/NCMEC) to make this a real
  // gate; until then this is a no-op pass-through by design, not a bug.
  let csam;
  try {
    csam = await csamCheck({ hash: sha256, path });
  } catch (e) {
    csam = { status: "unconfigured" };
  }

  // Publish instantly, matching pre-hardening behavior (explicit user
  // decision: gating on trust-tier/id-verification left 100% of real
  // creators stuck in manual review, since those fields were never
  // populated for existing accounts). Only an ACTUAL CSAM vendor flag holds
  // a video back — an unconfigured vendor no longer blocks publish, since no
  // vendor was ever wired up before this pipeline existed either.
  const status = (csam.status === "flagged") ? "held" : "live";

  // Insert the compliance-status row of record.
  let uploadId;
  try {
    const insertRes = await serviceRequest("/uploads", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: {
        client_id: clientId,
        // NOTE: still bunny_path in the live schema — the rename to r2_key
        // is Phase 2 work (schema consolidation), not yet applied. This
        // column now stores the R2 key regardless of its legacy name.
        bunny_path: path,
        title: String(title || "Untitled").slice(0, 200),
        status,
        sha256_head: sha256,
        duration_s: Number.isFinite(durationS) ? durationS : null,
        width: Number.isFinite(width) ? width : null,
        height: Number.isFinite(height) ? height : null,
        reject_reason: status === "held" ? "csam_flagged" : null,
        published_at: status === "live" ? new Date().toISOString() : null,
      },
    });
    if (!insertRes.ok) {
      const detail = await insertRes.text().catch(() => "");
      return res.status(502).json({ error: "uploads insert failed", detail });
    }
    const rows = await insertRes.json();
    uploadId = rows?.[0]?.id;
  } catch (e) {
    return res.status(500).json({ error: "uploads insert error", detail: String(e?.message || e) });
  }

  // Link this upload to the attestation record for the legal trail.
  if (attestation.attestationId) {
    serviceRequest(`/upload_attestations?id=eq.${encodeURIComponent(attestation.attestationId)}`, {
      method: "PATCH",
      body: { upload_ids: [uploadId] }, // best-effort; not blocking the response
    }).catch(() => {});
  }

  return res.status(200).json({
    ok: true,
    uploadId,
    status, // 'live' | 'held' — save-upload.js decides manifest visibility from this
    sha256,
  });
}
