#!/usr/bin/env node
/**
 * Generate sitemap.xml from the real, crawlable pages — including the blog.
 *
 * IMPORTANT: the viewer is a hash-routed SPA (#video/5, #category/AI). Search
 * engines treat #fragments as the SAME page, so per-video hash URLs are NOT
 * separately indexable and must NOT go in the sitemap. We list genuine HTML
 * entry points only (home, legal, choose, blog hub, every blog post).
 *
 * Run:  node scripts/gen-sitemap.js   (writes ./public/sitemap.xml)
 * Also invoked from package.json build (after gen-blog-posts).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { POSTS } from "../src/blog/posts.js";
import { isRedirectedSlug } from "../src/blog/redirects.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, "..");
const ORIGIN = "https://www.thebestpornai.com";
const today = new Date().toISOString().slice(0, 10);

const pages = [
  { loc: "/", changefreq: "daily", priority: "1.0", lastmod: today },
  { loc: "/choose.html", changefreq: "monthly", priority: "0.4", lastmod: today },
  { loc: "/blog/", changefreq: "weekly", priority: "0.9", lastmod: today },
  { loc: "/The-Best-Porn-AI-in-2026", changefreq: "weekly", priority: "1.0", lastmod: today },
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

// Every editorial post — primary indexable content surface for organic reach.
for (const post of POSTS) {
  if (isRedirectedSlug(post.slug)) continue;
  pages.push({
    loc: `/blog/${post.slug}.html`,
    changefreq: "monthly",
    priority: "0.8",
    lastmod: post.dateModified || post.date || today,
  });
}

// Every static video landing page — rank individual scene queries on Google/Bing
const videoDir = path.join(REPO, "video");
if (fs.existsSync(videoDir)) {
  const videoFiles = fs.readdirSync(videoDir).filter(f => f.endsWith(".html"));
  for (const vf of videoFiles) {
    pages.push({
      loc: `/video/${vf}`,
      changefreq: "weekly",
      priority: "0.7",
      lastmod: today,
    });
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

// Write into public/ so Vite copies it to dist root (served at /sitemap.xml).
fs.writeFileSync(path.join(REPO, "public", "sitemap.xml"), xml);
console.log(`✔ public/sitemap.xml written with ${pages.length} URLs (home, legal, blog hub + ${POSTS.length} posts, RSS).`);
