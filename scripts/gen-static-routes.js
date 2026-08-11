#!/usr/bin/env node
/**
 * Generate static, crawlable SEO landing pages for:
 *   - pornstars/index.html          AI Pornstars Directory
 *   - pornstars/<slug>.html         Dedicated Pornstar Profile Pages (Mia Nympo, Sabrina Ass, Marsha Banks)
 *   - categories/index.html         Categories Hub
 *   - categories/<slug>.html        Top Category Pages (Blonde, Latina, Big Ass, MILF, POV, etc.)
 *
 * Each page includes complete Schema.org JSON-LD (Person / CollectionPage / ItemList / VideoObject),
 * OpenGraph, Twitter cards, and rich semantic HTML for maximum Google ranking & organic traffic.
 *
 * Run:  node scripts/gen-static-routes.js
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { VIDEOS } from "../src/shared/catalog-videos.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, "..");
const PORNSTARS_DIR = path.join(REPO, "pornstars");
const CATEGORIES_DIR = path.join(REPO, "categories");
const ORIGIN = "https://www.thebestpornai.com";
const MEDIA_BASE = "https://pub-b281e1d5ecb94a148bd620f8a2fe9d55.r2.dev/media";
const LOGO = `${ORIGIN}/logo.png`;

fs.mkdirSync(PORNSTARS_DIR, { recursive: true });
fs.mkdirSync(CATEGORIES_DIR, { recursive: true });

function esc(s) {
  if (s === null || s === undefined) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function mediaUrl(src) {
  if (!src) return "";
  if (/^https?:\/\//i.test(src)) return src;
  const rel = src.replace(/^(\.\.\/)?media\//, "");
  const path_ = rel.split("/").map(encodeURIComponent).join("/");
  return MEDIA_BASE.replace(/\/$/, "") + "/" + path_;
}

function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function fmtViews(n) {
  n = Number(n) || 0;
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(n);
}

const PORNSTARS = [
  {
    id: "ps-mia-nympo",
    name: "Mia Nympo",
    handle: "@mianympo",
    slug: "mia-nympo",
    subs: 12800,
    bio: "AI pornstar sensation — blonde, bold, and built for repeat viewing. Featuring full-length intro scenes and ultra-realistic 4K vertical Shorts.",
    tags: ["Mia Nympo", "Pornstar", "Blonde", "Babe", "AI", "Solo"],
    categories: ["Babe", "AI Generated", "Blonde"],
    avatar: "../media/Mia Nympo PornStar/Mia Nympo6.avif",
    banner: "../media/Mia Nympo PornStar/Mia Nympo7.avif",
    introVideoId: 5168,
    blogSlug: "ai-pornstar-profiles-mia-nympo-case-study",
  },
  {
    id: "ps-sabrina-ass",
    name: "Sabrina Ass",
    handle: "@sabrinaass",
    slug: "sabrina-ass",
    subs: 9400,
    bio: "AI pornstar powerhouse — legendary curves, PAWG perfection, and unapologetic big-ass scenes. Uncut 4K videos and viral TikTok-style Shorts.",
    tags: ["Sabrina Ass", "Pornstar", "Big Ass", "Babe", "AI", "Solo", "PAWG"],
    categories: ["Big Ass", "AI Generated", "Latina"],
    avatar: "../media/Sabrina Ass/Sabrina.avif",
    banner: "../media/Sabrina Ass/Sabrina 2.avif",
    introVideoId: 5248,
    blogSlug: "sabrina-ass-ai-pornstar-profile-intro-shorts",
  },
  {
    id: "ps-marsha-banks",
    name: "Marsha Banks",
    handle: "@marshabanks",
    slug: "marsha-banks",
    subs: 15600,
    bio: "AI mature star — confident elegance, irresistible MILF energy, and slow-burn sensual heat. Exclusive full scenes and cinematic close-ups.",
    tags: ["Marsha Banks", "Pornstar", "MILF", "Babe", "AI", "Solo", "Romantic"],
    categories: ["MILF", "AI Generated", "Mature"],
    avatar: "../media/Marsha Banks/Marsha Banks.avif",
    banner: "../media/Marsha Banks/Marsha Banks pool.avif",
    introVideoId: 5257,
    blogSlug: "marsha-banks-ai-pornstar-profile-intro-shorts",
  },
];

const TOP_CATEGORIES = [
  { name: "Blonde", desc: "Stunning AI blonde beauties, natural babes, and high-energy blonde scenes in 4K." },
  { name: "Latina", desc: "Passionate AI Latina models, curvy perfection, and spicy erotic clips." },
  { name: "Big Ass", desc: "Top-tier PAWG and big booty AI scenes featuring hypnotic twerk and doggystyle angles." },
  { name: "Big Tits", desc: "Huge natural boobs, cleavage close-ups, and busty AI babes in HD clarity." },
  { name: "MILF", desc: "Experienced mature women and confident AI MILFs embracing pure desire." },
  { name: "Amateur", desc: "Authentic, candid-style AI bedroom videos and homemade aesthetic clips." },
  { name: "Anal", desc: "Intense backdoor action, close-ups, and tight anal penetration scenes." },
  { name: "Blowjob", desc: "Passionate oral pleasure, deepthroat clips, and wet blowjob scenes." },
  { name: "POV", desc: "First-person perspective immersive adult scenes that put you directly in the action." },
  { name: "Redhead", desc: "Fiery ginger models, pale skin, and uninhibited AI redhead passion." },
  { name: "Ebony", desc: "Gorgeous black AI models, dark skin perfection, and sensual curves." },
  { name: "Asian", desc: "Exquisite Asian AI babes, petite frames, and delicate erotic scenes." },
  { name: "Babe", desc: "Gorgeous modern AI supermodels and flawless solo aesthetic clips." },
  { name: "Lesbian", desc: "Sensual female-on-female romance, passionate kissing, and dual orgasms." },
  { name: "Creampie", desc: "Uncensored internal finishes, dripping climax shots, and intense breeding clips." },
];

function sharedHeaderHtml(activeNav = "") {
  return `
  <header class="site-header">
    <div class="site-header-inner">
      <a class="site-brand" href="/" aria-label="thebestpornai home">
        <span class="site-brand-badge">4K</span>
        <span class="site-brand-text">thebestporn<strong>ai</strong></span>
      </a>
      <nav class="site-nav" aria-label="Primary">
        <a class="site-nav-link ${activeNav === 'home' ? 'active' : ''}" href="/">Home</a>
        <a class="site-nav-link ${activeNav === 'pornstars' ? 'active' : ''}" href="/pornstars/">AI Pornstars</a>
        <a class="site-nav-link ${activeNav === 'categories' ? 'active' : ''}" href="/categories/">Categories</a>
        <a class="site-nav-link ${activeNav === 'blog' ? 'active' : ''}" href="/blog/">Editorial &amp; Guides</a>
      </nav>
      <div class="site-header-actions">
        <a class="btn-primary" href="/#search">Search 5,000+ Videos</a>
      </div>
    </div>
  </header>`;
}

function sharedFooterHtml() {
  return `
  <footer class="site-footer">
    <div class="site-footer-inner">
      <div class="site-footer-brand">
        <span class="site-brand-text">thebestporn<strong>ai</strong></span>
        <p class="site-footer-tagline">Curated AI Adult Entertainment &amp; High-Definition Streaming.</p>
        <p class="site-footer-compliance">18+ Only. All models are 100% synthetically generated AI personas.</p>
      </div>
      <div class="site-footer-links">
        <div class="site-footer-col">
          <strong>Explore</strong>
          <a href="/">Home Viewer</a>
          <a href="/pornstars/">AI Pornstars</a>
          <a href="/categories/">All Categories</a>
          <a href="/blog/">Editorial Blog</a>
        </div>
        <div class="site-footer-col">
          <strong>Legal &amp; Trust</strong>
          <a href="/legal/terms.html">Terms of Service</a>
          <a href="/legal/privacy.html">Privacy Policy</a>
          <a href="/legal/dmca.html">DMCA Notice</a>
          <a href="/legal/2257.html">18 U.S.C. 2257</a>
        </div>
      </div>
    </div>
  </footer>`;
}

function videoCardHtml(v) {
  const thumbUrl = v.thumb ? mediaUrl(v.thumb) : "";
  const dur = v.duration ? `<span class="card-dur">${esc(v.duration)}</span>` : "";
  const views = fmtViews(v.views || 1200);
  return `
    <article class="v-card">
      <a class="v-card-media" href="/#video/${v.id}" title="${esc(v.title)}">
        ${thumbUrl ? `<img src="${thumbUrl}" alt="${esc(v.title)}" loading="lazy" decoding="async"/>` : `<div class="v-ph"></div>`}
        ${dur}
        <span class="v-play-btn" aria-hidden="true">▶</span>
      </a>
      <div class="v-card-body">
        <h3 class="v-card-title"><a href="/#video/${v.id}">${esc(v.title)}</a></h3>
        <div class="v-card-meta">
          <span>${esc(v.category || "AI")}</span>
          <span>·</span>
          <span>${views} views</span>
        </div>
      </div>
    </article>`;
}

function renderHtmlPage({ title, description, canonical, ogImage, jsonLd, activeNav, bodyContent }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/>
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}"/>
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"/>
  <link rel="canonical" href="${canonical}"/>
  <meta property="og:type" content="website"/>
  <meta property="og:site_name" content="thebestpornai"/>
  <meta property="og:title" content="${esc(title)}"/>
  <meta property="og:description" content="${esc(description)}"/>
  <meta property="og:url" content="${canonical}"/>
  <meta property="og:image" content="${ogImage || LOGO}"/>
  <meta name="twitter:card" content="summary_large_image"/>
  <meta name="twitter:title" content="${esc(title)}"/>
  <meta name="twitter:description" content="${esc(description)}"/>
  <meta name="twitter:image" content="${ogImage || LOGO}"/>
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png"/>
  <link rel="icon" type="image/png" sizes="64x64" href="/favicon-64.png"/>
  <link rel="stylesheet" href="/assets/blog.css"/>
  <style>
    :root {
      --bg: #0b0c10;
      --surface: #13151b;
      --surface2: #1a1d26;
      --border: rgba(255,255,255,0.08);
      --accent: #ff2d55;
      --accent2: #9b51e0;
      --text: #f0f2f5;
      --muted: #8c93a0;
    }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      line-height: 1.5;
    }
    .site-header {
      position: sticky;
      top: 0;
      z-index: 100;
      background: rgba(11,12,16,0.92);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--border);
    }
    .site-header-inner {
      max-width: 1200px;
      margin: 0 auto;
      padding: 12px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }
    .site-brand {
      display: flex;
      align-items: center;
      gap: 8px;
      text-decoration: none;
      color: #fff;
      font-weight: 700;
      font-size: 18px;
    }
    .site-brand-badge {
      background: linear-gradient(135deg, var(--accent), var(--accent2));
      color: #fff;
      font-size: 11px;
      font-weight: 800;
      padding: 2px 6px;
      border-radius: 4px;
    }
    .site-brand-text strong { color: var(--accent); }
    .site-nav {
      display: flex;
      align-items: center;
      gap: 20px;
    }
    .site-nav-link {
      color: var(--muted);
      text-decoration: none;
      font-size: 14px;
      font-weight: 500;
      transition: color 0.15s;
    }
    .site-nav-link:hover, .site-nav-link.active { color: #fff; }
    .btn-primary {
      background: linear-gradient(135deg, var(--accent), var(--accent2));
      color: #fff;
      text-decoration: none;
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      transition: opacity 0.15s;
    }
    .btn-primary:hover { opacity: 0.9; }
    .page-hero {
      padding: 48px 20px;
      background: radial-gradient(circle at 50% 0%, rgba(155,81,224,0.15), transparent 70%);
      text-align: center;
      border-bottom: 1px solid var(--border);
    }
    .page-hero-inner { max-width: 800px; margin: 0 auto; }
    .page-hero h1 { font-size: 36px; margin: 0 0 12px; font-weight: 800; color: #fff; }
    .page-hero p { font-size: 16px; color: var(--muted); margin: 0 0 20px; }
    .main-wrap { max-width: 1200px; margin: 0 auto; padding: 40px 20px; }
    .v-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 20px;
    }
    .v-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      transition: transform 0.2s, border-color 0.2s;
    }
    .v-card:hover {
      transform: translateY(-3px);
      border-color: rgba(255,255,255,0.2);
    }
    .v-card-media {
      position: relative;
      aspect-ratio: 16 / 9;
      background: #000;
      display: block;
      overflow: hidden;
    }
    .v-card-media img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform 0.3s;
    }
    .v-card:hover .v-card-media img { transform: scale(1.04); }
    .card-dur {
      position: absolute;
      bottom: 8px;
      right: 8px;
      background: rgba(0,0,0,0.8);
      color: #fff;
      font-size: 11px;
      font-weight: 600;
      padding: 2px 6px;
      border-radius: 4px;
    }
    .v-play-btn {
      position: absolute;
      inset: 0;
      margin: auto;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: rgba(255,45,85,0.9);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      opacity: 0;
      transform: scale(0.85);
      transition: opacity 0.2s, transform 0.2s;
    }
    .v-card:hover .v-play-btn { opacity: 1; transform: scale(1); }
    .v-card-body { padding: 14px; flex: 1; display: flex; flex-direction: column; }
    .v-card-title {
      font-size: 14px;
      font-weight: 600;
      margin: 0 0 8px;
      line-height: 1.35;
    }
    .v-card-title a { color: #fff; text-decoration: none; }
    .v-card-title a:hover { color: var(--accent); }
    .v-card-meta {
      margin-top: auto;
      font-size: 12px;
      color: var(--muted);
      display: flex;
      gap: 6px;
    }
    .ps-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 16px;
      overflow: hidden;
      text-decoration: none;
      color: inherit;
      display: flex;
      flex-direction: column;
      transition: transform 0.2s, border-color 0.2s;
    }
    .ps-card:hover { transform: translateY(-4px); border-color: var(--accent); }
    .ps-card-banner { height: 120px; background-size: cover; background-position: center; position: relative; }
    .ps-card-avatar {
      width: 72px;
      height: 72px;
      border-radius: 50%;
      border: 3px solid var(--surface);
      margin: -36px 0 0 16px;
      background-size: cover;
      background-position: center;
      position: relative;
    }
    .ps-card-info { padding: 16px; flex: 1; }
    .ps-card-name { font-size: 18px; font-weight: 700; color: #fff; margin: 0 0 4px; }
    .ps-card-bio { font-size: 13px; color: var(--muted); margin: 0 0 12px; line-height: 1.4; }
    .site-footer {
      border-top: 1px solid var(--border);
      background: #08090c;
      padding: 48px 20px;
      margin-top: 60px;
    }
    .site-footer-inner {
      max-width: 1200px;
      margin: 0 auto;
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: 32px;
    }
    .site-footer-brand { max-width: 380px; }
    .site-footer-tagline { font-size: 14px; color: var(--muted); margin: 12px 0 6px; }
    .site-footer-compliance { font-size: 12px; color: #666; margin: 0; }
    .site-footer-links { display: flex; gap: 48px; }
    .site-footer-col { display: flex; flex-direction: column; gap: 8px; font-size: 13px; }
    .site-footer-col strong { color: #fff; margin-bottom: 6px; }
    .site-footer-col a { color: var(--muted); text-decoration: none; }
    .site-footer-col a:hover { color: #fff; }
    @media(max-width: 768px) {
      .site-nav { display: none; }
      .page-hero h1 { font-size: 26px; }
      .v-grid { grid-template-columns: 1fr; }
    }
  </style>
  <script type="application/ld+json">
${JSON.stringify(jsonLd, null, 2)}
  </script>
</head>
<body>
  ${sharedHeaderHtml(activeNav)}
  ${bodyContent}
  ${sharedFooterHtml()}
</body>
</html>`;
}

// 1. Generate /pornstars/index.html
function genPornstarsHub() {
  const title = "AI Pornstars Directory — Verified 4K Virtual Personas | thebestpornai";
  const description = "Discover the internet's most popular AI pornstars including Mia Nympo, Sabrina Ass, and Marsha Banks. Stream full-length scenes and 4K vertical Shorts.";
  const canonical = `${ORIGIN}/pornstars/`;

  const cardsHtml = PORNSTARS.map((ps) => {
    const avatarUrl = mediaUrl(ps.avatar);
    const bannerUrl = mediaUrl(ps.banner);
    return `
      <a class="ps-card" href="/pornstars/${ps.slug}.html">
        <div class="ps-card-banner" style="background-image: url('${bannerUrl}')"></div>
        <div class="ps-card-avatar" style="background-image: url('${avatarUrl}')"></div>
        <div class="ps-card-info">
          <h2 class="ps-card-name">${esc(ps.name)}</h2>
          <p class="ps-card-bio">${esc(ps.bio)}</p>
          <span class="btn-primary" style="display:inline-block;padding:6px 12px;font-size:12px">View Profile &amp; Videos</span>
        </div>
      </a>`;
  }).join("\n");

  const bodyContent = `
    <section class="page-hero">
      <div class="page-hero-inner">
        <h1>Verified AI Pornstars</h1>
        <p>Top synthetic creators, face packs, and virtual adult performers with dedicated full scenes and viral Shorts.</p>
      </div>
    </section>
    <main class="main-wrap">
      <div class="v-grid" style="grid-template-columns: repeat(auto-fill, minmax(320px, 1fr))">
        ${cardsHtml}
      </div>
    </main>`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": "AI Pornstars Directory",
    "description": description,
    "url": canonical,
    "mainEntity": {
      "@type": "ItemList",
      "itemListElement": PORNSTARS.map((ps, i) => ({
        "@type": "ListItem",
        "position": i + 1,
        "item": {
          "@type": "Person",
          "name": ps.name,
          "url": `${ORIGIN}/pornstars/${ps.slug}.html`,
          "image": mediaUrl(ps.avatar),
          "description": ps.bio
        }
      }))
    }
  };

  const html = renderHtmlPage({
    title,
    description,
    canonical,
    jsonLd,
    activeNav: "pornstars",
    bodyContent,
  });

  fs.writeFileSync(path.join(PORNSTARS_DIR, "index.html"), html);
  console.log("✔ pornstars/index.html generated");
}

// 2. Generate /pornstars/<slug>.html
function genPornstarProfiles() {
  for (const ps of PORNSTARS) {
    const title = `${ps.name} — AI Pornstar Profile, 4K Videos &amp; Shorts | thebestpornai`;
    const description = `${ps.bio} Watch full HD & 4K video scenes and mobile vertical Shorts starring ${ps.name}.`;
    const canonical = `${ORIGIN}/pornstars/${ps.slug}.html`;
    const avatarUrl = mediaUrl(ps.avatar);
    const bannerUrl = mediaUrl(ps.banner);

    // Find videos for this creator
    const creatorVideos = VIDEOS.filter((v) =>
      v.creator === ps.id || (v.tags && v.tags.includes(ps.name))
    ).slice(0, 36);

    const videoCards = creatorVideos.map(videoCardHtml).join("\n");

    const bodyContent = `
      <section class="page-hero" style="background-image: linear-gradient(rgba(11,12,16,0.8), rgba(11,12,16,0.95)), url('${bannerUrl}'); background-size: cover; background-position: center;">
        <div class="page-hero-inner">
          <img src="${avatarUrl}" alt="${esc(ps.name)}" style="width:100px;height:100px;border-radius:50%;border:3px solid var(--accent);margin-bottom:16px;object-fit:cover;"/>
          <h1>${esc(ps.name)}</h1>
          <p>${esc(ps.bio)}</p>
          <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
            <a class="btn-primary" href="/#video/${ps.introVideoId}">Watch Intro Scene</a>
            ${ps.blogSlug ? `<a class="btn-primary" style="background:var(--surface2);border:1px solid var(--border)" href="/blog/${ps.blogSlug}.html">Read Case Study</a>` : ''}
          </div>
        </div>
      </section>
      <main class="main-wrap">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">
          <h2 style="font-size:20px;font-weight:700;margin:0">Featured Videos &amp; Scenes (${creatorVideos.length})</h2>
          <a class="btn-primary" style="font-size:12px" href="/#creator/${ps.id}">Open in App Viewer</a>
        </div>
        <div class="v-grid">
          ${videoCards.length ? videoCards : '<p style="color:var(--muted)">More videos coming soon.</p>'}
        </div>
      </main>`;

    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "Person",
      "name": ps.name,
      "url": canonical,
      "image": avatarUrl,
      "description": ps.bio,
      "sameAs": [
        `${ORIGIN}/blog/${ps.blogSlug}.html`
      ],
      "subjectOf": creatorVideos.slice(0, 12).map((v) => ({
        "@type": "VideoObject",
        "name": v.title,
        "description": `Watch ${v.title} starring AI model ${ps.name} on thebestpornai.`,
        "thumbnailUrl": [v.thumb ? mediaUrl(v.thumb) : avatarUrl],
        "uploadDate": v.uploaded || "2026-05-01",
        "contentUrl": `${ORIGIN}/#video/${v.id}`
      }))
    };

    const html = renderHtmlPage({
      title,
      description,
      canonical,
      ogImage: avatarUrl,
      jsonLd,
      activeNav: "pornstars",
      bodyContent,
    });

    fs.writeFileSync(path.join(PORNSTARS_DIR, `${ps.slug}.html`), html);
    console.log(`✔ pornstars/${ps.slug}.html generated`);
  }
}

// 3. Generate /categories/index.html
function genCategoriesHub() {
  const title = "AI Porn Categories — Browse All 4K Adult Niches | thebestpornai";
  const description = "Explore 40+ curated AI adult categories: Blonde, Latina, Big Ass, MILF, POV, Blowjob, Lesbian, and more in stunning 4K streaming quality.";
  const canonical = `${ORIGIN}/categories/`;

  const cardsHtml = TOP_CATEGORIES.map((cat) => {
    const slug = slugify(cat.name);
    const count = VIDEOS.filter((v) =>
      (v.category && v.category.toLowerCase() === cat.name.toLowerCase()) ||
      (v.categories && v.categories.some((c) => c.toLowerCase() === cat.name.toLowerCase()))
    ).length;

    return `
      <a class="ps-card" href="/categories/${slug}.html" style="padding:20px">
        <h2 style="font-size:18px;font-weight:700;margin:0 0 6px;color:#fff">${esc(cat.name)}</h2>
        <p style="font-size:13px;color:var(--muted);margin:0 0 12px;flex:1">${esc(cat.desc)}</p>
        <span style="font-size:12px;color:var(--accent);font-weight:600">${count} Videos →</span>
      </a>`;
  }).join("\n");

  const bodyContent = `
    <section class="page-hero">
      <div class="page-hero-inner">
        <h1>AI Adult Categories</h1>
        <p>Explore thousands of generated adult scenes sorted by your favorite kinks, niches, and performer types.</p>
      </div>
    </section>
    <main class="main-wrap">
      <div class="v-grid" style="grid-template-columns: repeat(auto-fill, minmax(280px, 1fr))">
        ${cardsHtml}
      </div>
    </main>`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": "AI Adult Categories",
    "description": description,
    "url": canonical,
    "mainEntity": {
      "@type": "ItemList",
      "itemListElement": TOP_CATEGORIES.map((cat, i) => ({
        "@type": "ListItem",
        "position": i + 1,
        "name": cat.name,
        "url": `${ORIGIN}/categories/${slugify(cat.name)}.html`
      }))
    }
  };

  const html = renderHtmlPage({
    title,
    description,
    canonical,
    jsonLd,
    activeNav: "categories",
    bodyContent,
  });

  fs.writeFileSync(path.join(CATEGORIES_DIR, "index.html"), html);
  console.log("✔ categories/index.html generated");
}

// 4. Generate /categories/<slug>.html
function genCategoryPages() {
  for (const cat of TOP_CATEGORIES) {
    const slug = slugify(cat.name);
    const title = `${cat.name} AI Porn Videos — Best 4K ${cat.name} Scenes | thebestpornai`;
    const description = `Stream the best ${cat.name} AI porn videos in 4K resolution. ${cat.desc} Free high-speed streaming on thebestpornai.`;
    const canonical = `${ORIGIN}/categories/${slug}.html`;

    const categoryVideos = VIDEOS.filter((v) =>
      (v.category && v.category.toLowerCase() === cat.name.toLowerCase()) ||
      (v.categories && v.categories.some((c) => c.toLowerCase() === cat.name.toLowerCase()))
    ).slice(0, 36);

    const videoCards = categoryVideos.map(videoCardHtml).join("\n");
    const sampleThumb = categoryVideos[0]?.thumb ? mediaUrl(categoryVideos[0].thumb) : LOGO;

    const bodyContent = `
      <section class="page-hero">
        <div class="page-hero-inner">
          <h1>${esc(cat.name)} AI Porn Videos</h1>
          <p>${esc(cat.desc)}</p>
          <a class="btn-primary" href="/#category/${encodeURIComponent(cat.name)}">Open Category in Video Player</a>
        </div>
      </section>
      <main class="main-wrap">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">
          <h2 style="font-size:20px;font-weight:700;margin:0">Popular ${esc(cat.name)} Scenes (${categoryVideos.length})</h2>
          <a class="btn-primary" style="font-size:12px" href="/#category/${encodeURIComponent(cat.name)}">Play All</a>
        </div>
        <div class="v-grid">
          ${videoCards.length ? videoCards : '<p style="color:var(--muted)">New scenes being generated daily.</p>'}
        </div>
      </main>`;

    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "name": `${cat.name} AI Porn Videos`,
      "description": description,
      "url": canonical,
      "mainEntity": {
        "@type": "ItemList",
        "itemListElement": categoryVideos.slice(0, 12).map((v, i) => ({
          "@type": "ListItem",
          "position": i + 1,
          "item": {
            "@type": "VideoObject",
            "name": v.title,
            "description": `Watch ${v.title} in the ${cat.name} category on thebestpornai.`,
            "thumbnailUrl": [v.thumb ? mediaUrl(v.thumb) : sampleThumb],
            "uploadDate": v.uploaded || "2026-05-01",
            "contentUrl": `${ORIGIN}/#video/${v.id}`
          }
        }))
      }
    };

    const html = renderHtmlPage({
      title,
      description,
      canonical,
      ogImage: sampleThumb,
      jsonLd,
      activeNav: "categories",
      bodyContent,
    });

    fs.writeFileSync(path.join(CATEGORIES_DIR, `${slug}.html`), html);
    console.log(`✔ categories/${slug}.html generated`);
  }
}

// Run generators
genPornstarsHub();
genPornstarProfiles();
genCategoriesHub();
genCategoryPages();

console.log("🎉 All static routes generated successfully.");
