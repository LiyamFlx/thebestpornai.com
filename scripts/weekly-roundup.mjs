#!/usr/bin/env node
/**
 * Weekly "New on thebestpornai" roundup. Data-driven, no AI text: reads videos
 * uploaded in the last N days from the catalog, groups them by performer, and
 * appends one post to src/blog/writer-posts.json. Skips (exit 0, no change) if
 * there are fewer than MIN new videos, so it never publishes a thin post.
 *
 *   node scripts/weekly-roundup.mjs [--days 7] [--min 8] [--dry-run]
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { VIDEOS } from "../src/shared/catalog-videos.js";
import { DATA } from "../src/shared/catalog.js";
import { POSTS } from "../src/blog/posts.js";

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const JSON_PATH = path.join(REPO, "src/blog/writer-posts.json");
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const DAYS = +arg("--days", 7), MIN = +arg("--min", 8), DRY = process.argv.includes("--dry-run");

const today = new Date().toISOString().slice(0, 10);
const since = new Date(Date.now() - DAYS * 864e5).toISOString().slice(0, 10);
const fresh = VIDEOS.filter((v) => v.status === "published" && v.uploaded > since && v.uploaded <= today);
if (fresh.length < MIN) {
  console.log(`Only ${fresh.length} new videos since ${since} (min ${MIN}) — no post.`);
  process.exit(0);
}

const slug = `new-on-thebestpornai-week-of-${since}`;
if (POSTS.some((p) => p.slug === slug)) { console.log(`${slug} already exists.`); process.exit(0); }

const creators = new Map(DATA.creators.map((c) => [c.id, c]));
const byCreator = new Map();
for (const v of fresh) (byCreator.get(v.creator) || byCreator.set(v.creator, []).get(v.creator)).push(v);
const ranked = [...byCreator.entries()].sort((a, b) => b[1].length - a[1].length);

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const pageFor = (c) => c && fs.existsSync(path.join(REPO, "pornstars", `${c.slug}.html`)) ? `/pornstars/${c.slug}.html` : c ? `/creator/${c.id}` : null;
const cats = new Map();
for (const v of fresh) for (const c of v.categories || []) cats.set(c, (cats.get(c) || 0) + 1);
const catSlug = (c) => c.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
// Only real category pages (performer/mix names also appear in categories[]).
const topCats = [...cats.entries()]
  .filter(([c]) => c !== "AI Generated" && fs.existsSync(path.join(REPO, "categories", `${catSlug(c)}.html`)))
  .sort((a, b) => b[1] - a[1]).slice(0, 6);
const vertical = fresh.filter((v) => v.orientation === "vertical").length;

const rows = ranked.slice(0, 12).map(([id, vids]) => {
  const c = creators.get(id), name = c?.name || id.replace(/^ps-/, "").replace(/-/g, " ");
  const href = pageFor(c);
  return `<tr><td>${href ? `<a href="${href}">${esc(name)}</a>` : esc(name)}</td><td>${vids.length}</td></tr>`;
}).join("\n");

const fmtDate = (d) => new Date(d + "T00:00:00Z").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
const cover = fresh.slice().sort((a, b) => b.id - a.id)[0];
const standout = fresh.slice().sort((a, b) => ((b.likes || 0) * 2 + (b.views || 0)) - ((a.likes || 0) * 2 + (a.views || 0)))[0] || cover;
const standoutCreator = standout ? creators.get(standout.creator) : null;
const standoutCreatorName = standoutCreator?.name || standout?.creator || "Featured Creator";
const standoutHref = standout ? `/video/${standout.id}.html` : "/";
const related = ranked.slice(0, 6).map(([, v]) => v[0].id);

const body = `
<p>${fresh.length} new 4K AI scenes landed on <a href="/">thebestpornai</a> between ${fmtDate(since)} and ${fmtDate(today)}${vertical ? `, including ${vertical} high-definition vertical Shorts` : ""}. Here is where to start.</p>

${standout ? `
<div class="weekly-standout-card" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.12);border-radius:12px;padding:20px;margin:24px 0">
  <div style="font-size:12px;font-weight:700;letter-spacing:0.5px;color:#E50914;text-transform:uppercase;margin-bottom:6px">⭐ Editor's Pick of the Week</div>
  <h3 style="margin:0 0 8px;font-size:18px"><a href="${standoutHref}">${esc(standout.title)}</a></h3>
  <p style="margin:0 0 12px;font-size:14px;color:rgba(255,255,255,0.75)">Starring <strong>${esc(standoutCreatorName)}</strong> · ${standout.category || "Featured"} · 4K Ultra HD</p>
  <a href="${standoutHref}" style="display:inline-block;background:#E50914;color:#fff;text-decoration:none;padding:8px 18px;border-radius:8px;font-size:13px;font-weight:700">▶ Watch Featured Scene</a>
</div>
` : ""}

<h2>New this week by performer</h2>
<table>
<thead><tr><th>Performer</th><th>New videos</th></tr></thead>
<tbody>
${rows}
</tbody>
</table>

${topCats.length ? `<h2>What the new clips cover</h2>
<p>The most common categories in this batch: ${topCats.map(([c, n]) => `<a href="/categories/${catSlug(c)}.html">${esc(c)}</a> (${n})`).join(", ")}.</p>` : ""}

<h2>Keep browsing</h2>
<p>Browse every virtual model in the <a href="/pornstars/">AI Pornstars directory</a>, or explore the <a href="/?sort=latest">latest video releases</a>.</p>
`;

const post = {
  id: Math.max(...POSTS.map((p) => p.id)) + 1,
  slug,
  title: `New on thebestpornai: ${fmtDate(today)} Roundup`,
  category: "News",
  excerpt: `${fresh.length} new AI videos this week${ranked[0] ? `, led by ${creators.get(ranked[0][0])?.name || "new performers"}` : ""}. Who dropped what, and where to start.`,
  microcopy: "Fresh clips, grouped by performer.",
  date: today,
  dateModified: today,
  readMins: 2,
  coverVideoId: cover.id,
  relatedVideoIds: related,
  tags: ["new videos", "weekly roundup", "AI porn", "thebestpornai"],
  body,
};

if (DRY) { console.log(JSON.stringify(post, null, 2)); process.exit(0); }
const list = JSON.parse(fs.readFileSync(JSON_PATH, "utf8"));
list.push(post);
fs.writeFileSync(JSON_PATH, JSON.stringify(list, null, 2) + "\n");
console.log(`Added ${slug} (${fresh.length} videos, ${ranked.length} performers).`);
