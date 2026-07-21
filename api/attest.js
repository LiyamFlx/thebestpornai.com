/* Vercel serverless — record a consent/rights attestation and issue a
 * short-lived signed token proving it happened. Called by the creator studio
 * BEFORE any upload bytes are sent, per the compliance pipeline's core rule:
 * attestation must precede upload, not follow it.
 *
 * Anonymous-capable (no Supabase sign-in required, matching api/presign.js's
 * "open uploads" design) — keyed by client_id instead of auth.uid(). The
 * client's only proof of attestation is the returned token; the underlying
 * upload_attestations row is not readable by the anon client (see
 * supabase/migrations/20260721000000_upload_attestation_hardening.sql).
 */
import crypto from "crypto";
import { applyCors } from "../lib/cors.js";
import { serviceRequest } from "../lib/supabase-service.js";
import { issueAttestToken } from "../lib/attest-token.js";

// Store a salted hash of the IP for the legal record, never the raw address —
// enough to support "was this the same network" abuse investigation without
// keeping PII at rest longer than necessary.
function hashIp(ip) {
  const salt = process.env.ATTEST_HMAC_SECRET || "";
  return crypto.createHash("sha256").update(salt + "|" + ip).digest("hex");
}

// Fast local rate limiter — same shape as api/presign.js's, catches bursts
// within a warm instance before touching Supabase.
const _hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const windowMs = 60_000, max = 10;
  const rec = _hits.get(ip) || { n: 0, t: now };
  if (now - rec.t > windowMs) { rec.n = 0; rec.t = now; }
  rec.n++; _hits.set(ip, rec);
  return rec.n > max;
}

export default async function handler(req, res) {
  if (!applyCors(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });

  if (!process.env.ATTEST_HMAC_SECRET) {
    return res.status(500).json({ error: "ATTEST_HMAC_SECRET not set on Vercel" });
  }

  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
  if (rateLimited(ip)) return res.status(429).json({ error: "too many attestations, slow down" });

  const { clientId, confirmed, statements } = req.body || {};
  if (!clientId || typeof clientId !== "string" || clientId.length > 200) {
    return res.status(400).json({ error: "clientId is required" });
  }
  // `confirmed` must be an explicit true from a real consent UI (age/rights/
  // model-release checkboxes) — this endpoint does not itself render or
  // enforce that UI, it only refuses to issue a token without the flag, so a
  // caller can't skip straight to a token without the client-side gate.
  if (confirmed !== true) {
    return res.status(400).json({ error: "attestation not confirmed" });
  }

  let attestationId;
  try {
    const r = await serviceRequest("/upload_attestations", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: {
        client_id: clientId,
        upload_ids: [],
        ip_hash: hashIp(ip),
        // `statements` is a free-form record of what was shown/checked
        // (age confirmation, content-rights confirmation, etc.) — stored for
        // the legal record, not interpreted here.
        ...(statements ? { attested_statements: statements } : {}),
      },
    });
    if (!r.ok) {
      const detail = await r.text().catch(() => "");
      return res.status(502).json({ error: "attestation write failed", detail });
    }
    const rows = await r.json();
    attestationId = rows?.[0]?.id;
  } catch (e) {
    return res.status(500).json({ error: "attestation write error", detail: String(e?.message || e) });
  }

  const token = issueAttestToken({ clientId, attestationId });
  return res.status(200).json({ ok: true, token, attestationId });
}
