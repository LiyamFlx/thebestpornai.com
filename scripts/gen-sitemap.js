#!/usr/bin/env node
/**
 * Generate sitemap.xml and sitemap-video.xml from real crawlable pages.
 *
 * IMPORTANT: search engines treat #fragments as the SAME page, so per-video
 * hash URLs are NOT separately indexable. We list genuine static video landing
 * pages (/video/<id>.html), blog posts, categories, and author profile routes.
 *
 * Run:  node scripts/gen-sitemap.js   (writes ./public/sitemap.xml and ./public/sitemap-video.xml)
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { POSTS } from "../src/blog/posts.js";
import { isRedirectedSlug } from "../src/blog/redirects.js";
import { VIDEOS } from "../src/shared/catalog-videos.js";
import { isoUploadDate } from "../src/shared/dates.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, "..");
const ORIGIN = "https://www.thebestpornai.com";
const MEDIA_BASE = "https://pub-b281e1d5ecb94a148bd620f8a2fe9d55.r2.dev/media";
const today = new Date().toISOString().slice(0, 10);

function mediaUrl(src) {
  if (!src) return "";
  if (/^https?:\/\//i.test(src)) return src;
  const rel = src.replace(/^(\.\.\/)?media\//, "");
  const path_ = rel.split("/").map(encodeURIComponent).join("/");
  return MEDIA_BASE.replace(/\/$/, "") + "/" + path_;
}

function xmlEsc(s) {
  if (!s) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const pages = [
  { loc: "/", changefreq: "daily", priority: "1.0", lastmod: today },
  { loc: "/choose.html", changefreq: "monthly", priority: "0.4", lastmod: today },
  { loc: "/blog/", changefreq: "weekly", priority: "0.9", lastmod: today },
  { loc: "/The-Best-Porn-AI-in-2026", changefreq: "weekly", priority: "1.0", lastmod: today },
  { loc: "/author/anna-k.html", changefreq: "monthly", priority: "0.5", lastmod: today },
  { loc: "/guides/how-ai-porn-generators-work/", changefreq: "monthly", priority: "0.7", lastmod: today },
  { loc: "/blog/rss.xml", changefreq: "weekly", priority: "0.3", lastmod: today },
  { loc: "/legal/terms.html", changefreq: "yearly", priority: "0.3", lastmod: "2026-07-04" },
  { loc: "/legal/privacy.html", changefreq: "yearly", priority: "0.3", lastmod: "2026-07-04" },
  { loc: "/legal/dmca.html", changefreq: "yearly", priority: "0.3", lastmod: "2026-07-04" },
  { loc: "/legal/2257.html", changefreq: "yearly", priority: "0.3", lastmod: "2026-07-04" },
  { loc: "/pornstars/", changefreq: "weekly", priority: "0.9", lastmod: today },
  { loc: "/pornstars/mia-nympo.html", changefreq: "weekly", priority: "0.8", lastmod: today },
  { loc: "/pornstars/sabrina-ass.html", changefreq: "weekly", priority: "0.8", lastmod: today },
  { loc: "/pornstars/marsha-banks.html", changefreq: "weekly", priority: "0.8", lastmod: today },
  { loc: "/categories/", changefreq: "weekly", priority: "0.9", lastmod: today },
  { loc: "/categories/blonde.html", changefreq: "weekly", priority: "0.8", lastmod: today },
  { loc: "/categories/latina.html", changefreq: "weekly", priority: "0.8", lastmod: today },
  { loc: "/categories/big-ass.html", changefreq: "weekly", priority: "0.8", lastmod: today },
  { loc: "/categories/big-tits.html", changefreq: "weekly", priority: "0.8", lastmod: today },
  { loc: "/categories/milf.html", changefreq: "weekly", priority: "0.8", lastmod: today },
  { loc: "/categories/amateur.html", changefreq: "weekly", priority: "0.8", lastmod: today },
  { loc: "/categories/anal.html", changefreq: "weekly", priority: "0.8", lastmod: today },
  { loc: "/categories/blowjob.html", changefreq: "weekly", priority: "0.8", lastmod: today },
  { loc: "/categories/pov.html", changefreq: "weekly", priority: "0.8", lastmod: today },
  { loc: "/categories/redhead.html", changefreq: "weekly", priority: "0.8", lastmod: today },
  { loc: "/categories/ebony.html", changefreq: "weekly", priority: "0.8", lastmod: today },
  { loc: "/categories/asian.html", changefreq: "weekly", priority: "0.8", lastmod: today },
  { loc: "/categories/babe.html", changefreq: "weekly", priority: "0.8", lastmod: today },
  { loc: "/categories/lesbian.html", changefreq: "weekly", priority: "0.8", lastmod: today },
  { loc: "/categories/creampie.html", changefreq: "weekly", priority: "0.8", lastmod: today },
];

// Every editorial post
for (const post of POSTS) {
  if (isRedirectedSlug(post.slug)) continue;
  pages.push({
    loc: `/blog/${post.slug}.html`,
    changefreq: "monthly",
    priority: "0.8",
    lastmod: post.dateModified || post.date || today,
  });
}

// Every static video landing page
const videoDir = path.join(REPO, "video");
const videoSitemapEntries = [];

if (fs.existsSync(videoDir)) {
  const videoFiles = fs.readdirSync(videoDir).filter((f) => f.endsWith(".html"));
  for (const vf of videoFiles) {
    pages.push({
      loc: `/video/${vf}`,
      changefreq: "weekly",
      priority: "0.7",
      lastmod: today,
    });

    const id = parseInt(vf.replace(".html", ""), 10);
    const v = VIDEOS.find((item) => item.id === id);
    if (v) {
      const loc = `${ORIGIN}/video/${vf}`;
      const thumbLoc = v.thumb ? mediaUrl(v.thumb) : `${ORIGIN}/logo.png`;
      const contentLoc = v.src ? mediaUrl(v.src) : loc;
      const playerLoc = `${ORIGIN}/v/${v.id}`;
      const title = v.title || `AI Video #${v.id}`;
      const desc = v.desc || `Watch ${title} in 4K on thebestpornai.`;
      const pubDate = isoUploadDate(v.uploaded);

      videoSitemapEntries.push(`  <url>
    <loc>${loc}</loc>
    <video:video>
      <video:thumbnail_loc>${xmlEsc(thumbLoc)}</video:thumbnail_loc>
      <video:title>${xmlEsc(title)}</video:title>
      <video:description>${xmlEsc(desc)}</video:description>
      <video:content_loc>${xmlEsc(contentLoc)}</video:content_loc>
      <video:player_loc>${xmlEsc(playerLoc)}</video:player_loc>
      <video:publication_date>${pubDate}</video:publication_date>
      <video:family_friendly>no</video:family_friendly>
    </video:video>
  </url>`);
    }
  }
}

const urls = pages
  .map(
    (p) => `  <url>
    <loc>${ORIGIN}${p.loc}</loc>
    <lastmod>${p.lastmod}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`
  )
  .join("\n");

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;

const videoXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
${videoSitemapEntries.join("\n")}
</urlset>
`;

fs.writeFileSync(path.join(REPO, "public", "sitemap.xml"), xml);
console.log(`✔ public/sitemap.xml written with ${pages.length} URLs.`);

fs.writeFileSync(path.join(REPO, "public", "sitemap-video.xml"), videoXml);
console.log(`✔ public/sitemap-video.xml written with ${videoSitemapEntries.length} Video Sitemap entries.`);
