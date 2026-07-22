/* CSAM screening interception point.
 *
 * No CSAM vendor is wired up yet (that's a business/legal decision — which
 * service to use: Cloudflare's CSAM Scanning Tool, Thorn, or NCMEC
 * hash-sharing — not something to invent silently). Until CSAM_VENDOR is
 * set, every check returns "unconfigured".
 *
 * Current policy (api/verify-upload.js): "unconfigured" does NOT block
 * publish — matches pre-hardening behavior, where no CSAM check existed at
 * all. Only an actual vendor "flagged" result holds a video back. This was
 * an explicit user decision after the stricter fail-closed default (treating
 * "unconfigured" as "flagged") left 100% of real uploads stuck in manual
 * review. Once a real vendor is wired up, "clear" vs "flagged" from that
 * vendor becomes the meaningful signal.
 */

export async function csamCheck({ hash, path }) {
  const vendor = process.env.CSAM_VENDOR || "";
  if (!vendor) {
    return { status: "unconfigured", vendor: null };
  }

  // Real vendor integrations go here once one is chosen and credentialed.
  // Each branch must return {status:'clear'|'flagged', vendor}.
  switch (vendor) {
    default:
      // Unknown/misconfigured CSAM_VENDOR value — fail closed, do not guess.
      return { status: "unconfigured", vendor };
  }
}
