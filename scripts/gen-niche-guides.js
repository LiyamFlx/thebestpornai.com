#!/usr/bin/env node
/**
 * Programmatic SEO Niche Guide Generator
 * Generates static HTML niche guide landing pages for major categories and tags
 * with Schema.org JSON-LD, top video showcases, and affiliate conversion CTAs.
 * 
 * Run: node scripts/gen-niche-guides.js
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { VIDEOS } from "../src/shared/catalog-videos.js";
import { CATEGORIES } from "../src/shared/taxonomy.js";
import { getAffiliateOffer } from "../src/shared/affiliates.js";
import { FAVICON_LINKS, appShellHtml } from "./lib/site-chrome.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, "..");
const BLOG_DIR = path.join(REPO, "blog");
const ORIGIN = "https://www.thebestpornai.com";
const MEDIA_BASE = `${ORIGIN}/r2/media`;

function esc(s) {
  if (s === null || s === undefined) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmtViews(n) {
  const num = Number(n) || 1200;
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return String(num);
}

function mediaUrl(src) {
  if (!src) return "";
  if (src.startsWith("/")) return esc(src);
  if (!/^https?:\/\//i.test(src) && !src.startsWith("blob:")) {
    const rel = src.replace(/^(\.\.\/)?media\//, "");
    const enc = rel.split("/").map(seg => encodeURIComponent(seg).replace(/'/g, "%27")).join("/");
    return esc(`${MEDIA_BASE}/${enc}`);
  }
  return esc(src);
}

const NICHE_CONFIGS = [
  { slug: "best-ai-blonde-porn-scenes-2026", category: "Blonde", title: "Best AI Blonde Porn Scenes & Models in 2026", desc: "Explore top-rated 4K AI blonde video scenes, photoreal models, and high-resolution generative clips." },
  { slug: "best-ai-latina-porn-scenes-2026", category: "Latina", title: "Best AI Latina Porn Scenes & Models in 2026", desc: "Discover high-rated AI Latina scenes, fiery models, and photoreal 4K adult clips." },
  { slug: "best-ai-big-tits-scenes-2026", category: "Big Tits", title: "Top AI Big Tits & Busty Video Scenes in 2026", desc: "Watch high-definition AI busty models, natural cleavage scenes, and 4K generative video." },
  { slug: "best-ai-big-ass-scenes-2026", category: "Big Ass", title: "Best AI Big Ass & PAWG Video Scenes in 2026", desc: "Curated collection of top-tier AI PAWG and big booty videos in 4K resolution." },
  { slug: "best-ai-milf-porn-scenes-2026", category: "MILF", title: "Best AI MILF & Mature Video Scenes in 2026", desc: "Sensual mature AI models and elegant adult scenes in crisp 4K quality." },
  { slug: "best-ai-redhead-porn-scenes-2026", category: "Redhead", title: "Top AI Redhead & Ginger Video Scenes in 2026", desc: "Fiery ginger AI babes, pale skin perfection, and full 4K generative adult clips." },
  { slug: "best-ai-ebony-porn-scenes-2026", category: "Ebony", title: "Best AI Ebony Video Scenes & Models in 2026", desc: "Stunning dark skin perfection, elegant black AI babes, and ultra-HD scenes." },
  { slug: "best-ai-asian-porn-scenes-2026", category: "Asian", title: "Best AI Asian Video Scenes & Models in 2026", desc: "Exquisite Asian AI babes, petite frames, and delicate high-resolution erotic scenes." },
  { slug: "best-ai-hentai-porn-scenes-2026", category: "Hentai", title: "Best AI Hentai & Anime Video Scenes in 2026", desc: "Top 2D/3D anime AI porn scenes, uncensored artwork, and character generators." },
  { slug: "best-ai-pov-porn-scenes-2026", category: "POV", title: "Top First-Person POV AI Video Scenes in 2026", desc: "Immersive 4K first-person perspective AI porn clips putting you directly in the scene." },
  { slug: "best-ai-amateur-porn-scenes-2026", category: "Amateur", title: "Best AI Amateur & Bedroom Videos in 2026", desc: "Authentic, candid-style AI bedroom videos and homemade aesthetic clips in 4K." },
  { slug: "best-ai-bdsm-porn-scenes-2026", category: "BDSM", title: "Top AI BDSM & Kink Video Scenes in 2026", desc: "Demure desires, kink scenes, and high-definition BDSM AI video clips." },
];

export function generateNicheGuides() {
  if (!fs.existsSync(BLOG_DIR)) fs.mkdirSync(BLOG_DIR, { recursive: true });

  let count = 0;
  for (const cfg of NICHE_CONFIGS) {
    const catLower = cfg.category.toLowerCase();
    const matchingVideos = VIDEOS.filter((v) => {
      const c = (v.category || "").toLowerCase();
      const cats = Array.isArray(v.categories) ? v.categories.map((x) => String(x).toLowerCase()) : [];
      const tags = Array.isArray(v.tags) ? v.tags.map((x) => String(x).toLowerCase()) : [];
      return c === catLower || cats.includes(catLower) || tags.includes(catLower);
    }).slice(0, 12);

    const offer = getAffiliateOffer({ category: cfg.category });

    const videoCardsHtml = matchingVideos
      .map((v) => {
        const thumb = mediaUrl(v.thumb);
        const views = fmtViews(v.views || 1400);
        return `
          <a class="niche-vcard" href="/video/${v.id}.html" title="${esc(v.title)}">
            <div class="niche-vthumb">
              ${thumb ? `<img src="${thumb}" alt="${esc(v.title)}" loading="lazy" decoding="async"/>` : ""}
              <span class="niche-badge">4K</span>
              <span class="niche-dur">${esc(v.duration || "0:15")}</span>
            </div>
            <div class="niche-vtitle">${esc(v.title)}</div>
            <div class="niche-vmeta">${esc(v.category || cfg.category)} · ${views} views</div>
          </a>`;
      })
      .join("\n");

    const jsonLd = {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Article",
          "headline": cfg.title,
          "description": cfg.desc,
          "url": `${ORIGIN}/blog/${cfg.slug}.html`,
          "datePublished": "2026-09-01",
          "dateModified": "2026-09-01",
          "author": { "@type": "Organization", "name": "thebestpornai" },
          "publisher": { "@type": "Organization", "name": "thebestpornai", "url": ORIGIN }
        },
        {
          "@type": "FAQPage",
          "mainEntity": [
            {
              "@type": "Question",
              "name": `What makes the best AI ${cfg.category} video generator in 2026?`,
              "acceptedAnswer": {
                "@type": "Answer",
                "text": `The best AI ${cfg.category} platforms provide 4K frame consistency, photorealistic lighting, zero facial distortion, and instant browser streaming.`
              }
            },
            {
              "@type": "Question",
              "name": `Can I generate custom AI ${cfg.category} characters?`,
              "acceptedAnswer": {
                "@type": "Answer",
                "text": `Yes, tools like ${offer.name} allow you to customize hair, body type, lighting, and camera angles for complete creative control.`
              }
            }
          ]
        }
      ]
    };

    const bodyHtml = `
      <article class="niche-guide-page">
        <header class="niche-hero">
          <div class="niche-hero-inner">
            <span class="niche-pill">${esc(cfg.category)} Guide</span>
            <h1>${esc(cfg.title)}</h1>
            <p>${esc(cfg.desc)}</p>
            <div class="niche-cta-row">
              <a href="${offer.url}" target="_blank" rel="noopener sponsored" class="niche-btn-primary">
                Try Top ${esc(cfg.category)} Generator (${offer.name}) →
              </a>
              <a href="/category/${cfg.category.toLowerCase().replace(/\s+/g, "-")}.html" class="niche-btn-ghost">
                Browse All ${esc(cfg.category)} Clips (${matchingVideos.length}+)
              </a>
            </div>
          </div>
        </header>

        <section class="niche-content-wrap">
          <h2>Featured 4K ${esc(cfg.category)} AI Videos</h2>
          <div class="niche-grid">
            ${videoCardsHtml}
          </div>

          <div class="niche-info-card">
            <h3>Why AI ${esc(cfg.category)} Generation is Revolutionizing Adult Content</h3>
            <p>Generative video models in 2026 allow unprecedented temporal consistency and hyper-realistic detail. Whether you are looking for ultra-HD motion, custom camera angles, or personalized character roleplay, platforms like <strong>${offer.name}</strong> lead the industry in quality and privacy.</p>
            <a href="${offer.url}" target="_blank" rel="noopener sponsored" class="niche-card-cta">
              Create Your Custom ${esc(cfg.category)} Character on ${offer.name} →
            </a>
          </div>
        </section>
      </article>
    `;

    const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/>
  <title>${esc(cfg.title)} — thebestpornai</title>
  <meta name="description" content="${esc(cfg.desc)}"/>
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"/>
  <link rel="canonical" href="${ORIGIN}/blog/${cfg.slug}.html"/>
  <meta property="og:type" content="article"/>
  <meta property="og:title" content="${esc(cfg.title)}"/>
  <meta property="og:description" content="${esc(cfg.desc)}"/>
  <meta property="og:url" content="${ORIGIN}/blog/${cfg.slug}.html"/>
  ${FAVICON_LINKS}
  <link rel="stylesheet" href="/app-shell.css"/>
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  <style>
    .niche-guide-page { max-width: 1200px; margin: 0 auto; padding: 20px; color: #fff; }
    .niche-hero { padding: 40px 20px; background: radial-gradient(circle at 50% 0%, rgba(229,9,20,0.18), transparent 70%); text-align: center; border-radius: 16px; margin-bottom: 30px; }
    .niche-pill { display: inline-block; background: rgba(229,9,20,0.2); color: #FF3B3B; padding: 4px 12px; border-radius: 999px; font-size: 13px; font-weight: 600; margin-bottom: 12px; }
    .niche-hero h1 { font-size: 32px; font-weight: 800; margin: 0 0 12px; }
    .niche-hero p { font-size: 16px; color: #a0a0a0; max-width: 700px; margin: 0 auto 24px; }
    .niche-cta-row { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
    .niche-btn-primary { background: #E50914; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 999px; font-weight: 700; transition: background 0.15s; }
    .niche-btn-primary:hover { background: #FF3B3B; }
    .niche-btn-ghost { background: rgba(255,255,255,0.08); color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 999px; font-weight: 600; }
    .niche-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 20px; margin: 24px 0 40px; }
    .niche-vcard { background: #141414; border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; overflow: hidden; text-decoration: none; color: #fff; display: flex; flex-direction: column; }
    .niche-vthumb { position: relative; aspect-ratio: 16/9; background: #000; overflow: hidden; }
    .niche-vthumb img { width: 100%; height: 100%; object-fit: cover; }
    .niche-badge { position: absolute; top: 8px; left: 8px; background: rgba(0,0,0,0.7); color: #E50914; font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 4px; }
    .niche-dur { position: absolute; bottom: 8px; right: 8px; background: rgba(0,0,0,0.8); color: #fff; font-size: 11px; padding: 2px 6px; border-radius: 4px; }
    .niche-vtitle { font-size: 14px; font-weight: 600; padding: 12px 12px 4px; line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .niche-vmeta { font-size: 12px; color: #888; padding: 0 12px 12px; }
    .niche-info-card { background: #181818; border: 1px solid rgba(255,255,255,0.12); padding: 28px; border-radius: 16px; margin-top: 40px; text-align: center; }
    .niche-info-card h3 { font-size: 22px; margin: 0 0 12px; }
    .niche-info-card p { color: #ccc; max-width: 800px; margin: 0 auto 20px; line-height: 1.6; }
    .niche-card-cta { display: inline-block; background: #E50914; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 999px; font-weight: 700; }
  </style>
</head>
<body>
  ${appShellHtml({ activeNav: "blog", bodyContent: bodyHtml })}
</body>
</html>`;

    const outPath = path.join(BLOG_DIR, `${cfg.slug}.html`);
    fs.writeFileSync(outPath, fullHtml, "utf8");
    count++;
    console.log(`[niche-guide] Wrote blog/${cfg.slug}.html (${matchingVideos.length} matching clips)`);
  }

  console.log(`[niche-guide] Successfully generated ${count} programmatic SEO niche guides!`);
}

// Auto-run if executed directly
if (process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) {
  generateNicheGuides();
}
