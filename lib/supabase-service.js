/* Shared service-role Supabase REST helper for Vercel API functions.
 * Mirrors the fetch pattern already used in api/moderate-manifest.js and
 * api/presign.js's persistentRateLimited() — same auth style, one place.
 */
export function serviceEnv() {
  return {
    url: process.env.SUPABASE_URL || "",
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  };
}

export async function serviceRequest(path, { method = "GET", body, headers = {} } = {}) {
  const { url, serviceKey } = serviceEnv();
  if (!url || !serviceKey) throw new Error("Supabase service-role env vars not set");
  const r = await fetch(url.replace(/\/$/, "") + "/rest/v1" + path, {
    method,
    headers: {
      apikey: serviceKey,
      Authorization: "Bearer " + serviceKey,
      "Content-Type": "application/json",
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(8000),
  });
  return r;
}
