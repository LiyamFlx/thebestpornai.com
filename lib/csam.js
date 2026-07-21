/* CSAM screening interception point.
 *
 * This is deliberately a thin, fail-closed stub: no CSAM vendor is wired up
 * yet (that's a business/legal decision — which service to use: Cloudflare's
 * CSAM Scanning Tool, Thorn, or NCMEC hash-sharing — not something to invent
 * silently). Until CSAM_VENDOR is set, every check returns "unconfigured",
 * and every caller MUST treat "unconfigured" the same as "flagged": never
 * auto-publish, always hold for manual review. An unconfigured check must
 * never look like a passed check.
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

// True only when the result should be trusted as a genuine pass. Kept as a
// named helper (not inlined at every call site) so the fail-closed rule is
// enforced in exactly one place.
export function isCsamClear(result) {
  return result && result.status === "clear";
}
