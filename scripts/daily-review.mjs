// Daily site health review. Read-only: hits public URLs only, prints a markdown
// report to stdout. Exit code 1 if anything is failing (workflow opens an issue).
const BASE = process.env.SITE || "https://www.thebestpornai.com";
const rows = [];
let failed = 0;

async function check(name, fn) {
  try {
    const detail = await fn();
    rows.push(`| ✅ | ${name} | ${detail || "ok"} |`);
  } catch (e) {
    failed++;
    rows.push(`| ❌ | ${name} | ${e.message} |`);
  }
}
const get = async (path, opts) => {
  const r = await fetch(BASE + path, { redirect: "follow", ...opts });
  if (!r.ok) throw new Error(`${path} → HTTP ${r.status}`);
  return r;
};

await check("Homepage", async () => {
  const t = await (await get("/")).text();
  if (!/<h1/i.test(t)) throw new Error("no <h1> in homepage HTML");
});
await check("Version / deploy", async () => {
  const j = await (await get("/api/version")).json();
  return `sha ${String(j.sha || "?").slice(0, 8)}`;
});
await check("Sitemap index", async () => {
  const t = await (await get("/sitemap-index.xml")).text();
  const n = (t.match(/<loc>/g) || []).length;
  if (!n) throw new Error("no <loc> entries");
  return `${n} sitemaps`;
});
await check("Video sitemap", async () => {
  const t = await (await get("/sitemap-video.xml")).text();
  const n = (t.match(/<video:video>/g) || []).length;
  if (!n) throw new Error("no videos listed");
  return `${n} videos`;
});
await check("robots.txt", async () => {
  const t = await (await get("/robots.txt")).text();
  if (!/Sitemap:/i.test(t)) throw new Error("no Sitemap line");
});
await check("Blog RSS", async () => {
  const t = await (await get("/blog/rss.xml")).text();
  const n = (t.match(/<item>/g) || []).length;
  if (!n) throw new Error("no items");
  return `${n} items`;
});
await check("Engage API rejects bad input cleanly", async () => {
  const r = await fetch(BASE + "/api/engage", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "like", videoId: 0 }),
  });
  if (r.status !== 400) throw new Error(`expected 400, got ${r.status}`);
});
await check("Sample video posters (first 10 in video sitemap)", async () => {
  const t = await (await get("/sitemap-video.xml")).text();
  const urls = [...t.matchAll(/<video:thumbnail_loc>([^<]+)</g)].slice(0, 10).map((m) => m[1]);
  const bad = [];
  for (const u of urls) {
    const r = await fetch(u, { method: "HEAD" });
    if (!r.ok) bad.push(`${r.status} ${u}`);
  }
  if (bad.length) throw new Error(bad.join("; "));
  return `${urls.length} checked`;
});

console.log(`## Daily review ${new Date().toISOString().slice(0, 10)} — ${failed ? failed + " failing" : "all green"}\n`);
console.log("| | Check | Result |\n|---|---|---|");
console.log(rows.join("\n"));
process.exit(failed ? 1 : 0);
