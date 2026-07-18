#!/usr/bin/env node
/**
 * Generate sitemap.xml from the real, crawlable pages.
 *
 * IMPORTANT: the viewer is a hash-routed SPA (#video/5, #category/AI). Search
 * engines treat #fragments as the SAME page, so per-video hash URLs are NOT
 * separately indexable and must NOT go in the sitemap. We list the genuine
 * HTML entry points only. (To make videos individually indexable you'd need
 * real path routes or prerendered pages — a bigger change.)
 *
 * Run:  node scripts/gen-sitemap.js   (writes ./sitemap.xml)
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, "..");
const ORIGIN = "https://www.thebestpornai.com";
const today = new Date().toISOString().slice(0, 10);

// Real HTML pages that exist and should be crawled.
const pages = [
  { loc: "/", changefreq: "daily", priority: "1.0" },
  { loc: "/choose.html", changefreq: "monthly", priority: "0.5" },
  { loc: "/creator/index.html", changefreq: "weekly", priority: "0.6" },
  { loc: "/legal/terms.html", changefreq: "yearly", priority: "0.3" },
  { loc: "/legal/privacy.html", changefreq: "yearly", priority: "0.3" },
  { loc: "/legal/dmca.html", changefreq: "yearly", priority: "0.3" },
  { loc: "/legal/2257.html", changefreq: "yearly", priority: "0.3" },
];

const urls = pages.map(p => `  <url>
    <loc>${ORIGIN}${p.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`).join("\n");

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;

// Write into public/ so Vite copies it to the dist root and Vercel serves it
// at /sitemap.xml (root files outside public/ are NOT copied to the build).
fs.writeFileSync(path.join(REPO, "public", "sitemap.xml"), xml);
console.log(`✔ public/sitemap.xml written with ${pages.length} real pages (served at /sitemap.xml after build).`);
