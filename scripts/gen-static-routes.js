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
import { isoUploadDate } from "../src/shared/dates.js";
import { playPath, searchPath } from "../src/shared/public-routes.js";
import { ourdreamUrl, OURDREAM_REL } from "../src/shared/affiliates.js";
import { FAVICON_LINKS, appShellHtml } from "./lib/site-chrome.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, "..");
const PORNSTARS_DIR = path.join(REPO, "pornstars");
const CATEGORIES_DIR = path.join(REPO, "categories");
const VIDEO_DIR = path.join(REPO, "video");
const ORIGIN = "https://www.thebestpornai.com";
const MEDIA_BASE = "https://pub-b281e1d5ecb94a148bd620f8a2fe9d55.r2.dev/media";
const LOGO = `${ORIGIN}/logo.png`;

fs.mkdirSync(PORNSTARS_DIR, { recursive: true });
fs.mkdirSync(CATEGORIES_DIR, { recursive: true });
fs.mkdirSync(VIDEO_DIR, { recursive: true });

function isoDuration(dur) {
  if (!dur) return "PT2M30S";
  const parts = String(dur).split(":").map(Number);
  if (parts.length === 2) {
    const [m, s] = parts;
    return `PT${m || 0}M${s || 0}S`;
  }
  if (parts.length === 3) {
    const [h, m, s] = parts;
    return `PT${h || 0}H${m || 0}M${s || 0}S`;
  }
  return "PT2M30S";
}

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
  {
    id: "ps-yuna-blackveil",
    name: "Yuna Blackveil",
    handle: "@yunablackveil",
    slug: "yuna-blackveil",
    subs: 6200,
    bio: "2D AI pornstar — long black hair, hentai-style close-ups, and unapologetic bedroom scenes. Illustrated heat with a single, repeatable face.",
    tags: ["Yuna Blackveil", "Pornstar", "Hentai", "Anime", "Big Tits", "Babe", "AI", "Solo"],
    categories: ["Babe", "AI Generated", "Hentai"],
    avatar: "../media/Yuna Blackveil/avatar.jpg",
    banner: "../media/Yuna Blackveil/banner.jpg",
    introVideoId: 5962,
  },
  {
    id: "ps-violet-rush",
    name: "Violet Rush",
    handle: "@violetrush",
    slug: "violet-rush",
    subs: 8100,
    bio: "Neon-city AI pornstar — lavender hair, pink floral dress, and night-drive energy. Photoreal clips built around one look you can binge.",
    tags: ["Violet Rush", "Pornstar", "Latina", "Babe", "AI", "Solo", "Big Tits"],
    categories: ["Babe", "AI Generated", "Latina"],
    avatar: "../media/Violet Rush/avatar.jpg",
    banner: "../media/Violet Rush/banner.jpg",
    introVideoId: 5968,
  },
  {
    id: "ps-elle-hart",
    name: "Elle Hart",
    handle: "@ellehart",
    slug: "elle-hart",
    subs: 7400,
    bio: "Photoreal blonde AI pornstar — huge natural tits, studio heat, and slow body-forward scenes. Soft face, heavy chest, same girl on repeat.",
    tags: ["Elle Hart", "Pornstar", "Blonde", "Big Tits", "Babe", "AI", "Solo"],
    categories: ["Big Tits", "AI Generated", "Blonde"],
    avatar: "../media/Elle Hart/avatar.jpg",
    banner: "../media/Elle Hart/banner.jpg",
    introVideoId: 5973,
  },
  {
    id: "ps-red-velvet",
    name: "Red Velvet",
    handle: "@redvelvet",
    slug: "red-velvet",
    subs: 18200,
    bio: "High-glam platinum AI pornstar — glossy skin, icy blonde hair, and cinematic close-ups. The velvet finish on a repeatable face.",
    tags: ["Red Velvet", "Pornstar", "Blonde", "Babe", "AI", "Solo", "Big Tits"],
    categories: ["Blonde", "AI Generated", "Babe"],
    avatar: "../media/Red Velvet/avatar.jpg",
    banner: "../media/Red Velvet/banner.jpg",
    introVideoId: 4455,
  },
  {
    id: "ps-lola-voss",
    name: "Lola Voss",
    handle: "@lolavoss",
    slug: "lola-voss",
    subs: 22100,
    bio: "Short-platinum AI pornstar — collar, leash, and unapologetic bimbo heat. Built for hard rewatch, not soft fade-ins.",
    tags: ["Lola Voss", "Pornstar", "Blonde", "Big Tits", "Babe", "AI", "Solo"],
    categories: ["Blonde", "AI Generated", "Big Tits"],
    avatar: "../media/Lola Voss/avatar.jpg",
    banner: "../media/Lola Voss/banner.jpg",
    introVideoId: 515,
  },
  {
    id: "ps-pinky-hart",
    name: "Pinky Hart",
    handle: "@pinkyhart",
    slug: "pinky-hart",
    subs: 14800,
    bio: "Candy-pink bob, pale skin, and studio-pink AI pornstar energy. Huge naturals, one look, a full numbered pack.",
    tags: ["Pinky Hart", "Pornstar", "Babe", "Big Tits", "AI", "Solo"],
    categories: ["Babe", "AI Generated", "Big Tits"],
    avatar: "../media/Pinky Hart/avatar.jpg",
    banner: "../media/Pinky Hart/banner.jpg",
    introVideoId: 316,
  },
  {
    id: "ps-aphrodite-dynamites",
    name: "Aphrodite Dynamites",
    handle: "@aphroditedynamites",
    slug: "aphrodite-dynamites",
    subs: 16900,
    bio: "Public-risk Latina AI pornstar — gold chains, white lace, and no indoor filter. Exhibition heat with a single, sticky face.",
    tags: ["Aphrodite Dynamites", "Pornstar", "Latina", "Babe", "AI", "Public", "Big Tits"],
    categories: ["Latina", "AI Generated", "Babe"],
    avatar: "../media/Aphrodite Dynamites/avatar.jpg",
    banner: "../media/Aphrodite Dynamites/banner.jpg",
    introVideoId: 2193,
  },
  {
    id: "ps-emily-vale",
    name: "Emily Vale",
    handle: "@emilyvale",
    slug: "emily-vale",
    subs: 11300,
    bio: "Dancer-first AI pornstar — brunette waves, black set, slow body work in a sunlit room. Named pack: Emily’s amazing dance.",
    tags: ["Emily Vale", "Pornstar", "Latina", "Babe", "AI", "Solo", "Amateur"],
    categories: ["Babe", "AI Generated", "Amateur"],
    avatar: "../media/Emily Vale/avatar.jpg",
    banner: "../media/Emily Vale/banner.jpg",
    introVideoId: 4259,
  },
  {
    id: "ps-noor-dubai",
    name: "Noor Dubai",
    handle: "@noordubai",
    slug: "noor-dubai",
    subs: 15700,
    bio: "Tan, dark-wave AI pornstar from the Chocolate of Dubai pack — black micro-bikini, gold hoops, one luxury look on loop.",
    tags: ["Noor Dubai", "Pornstar", "Babe", "Big Tits", "AI", "Solo", "Latina"],
    categories: ["Babe", "AI Generated", "Big Tits"],
    avatar: "../media/Noor Dubai/avatar.jpg",
    banner: "../media/Noor Dubai/banner.jpg",
    introVideoId: 5049,
  },
  {
    id: "ps-helena-brooks",
    name: "Helena Brooks",
    handle: "@helenabrooks",
    slug: "helena-brooks",
    subs: 19100,
    bio: "Blonde-bob AI MILF — huge natural tits, bedroom light, grown-woman pace. The mature pack the catalog already numbered.",
    tags: ["Helena Brooks", "Pornstar", "MILF", "Blonde", "Big Tits", "Babe", "AI"],
    categories: ["MILF", "AI Generated", "Big Tits"],
    avatar: "../media/Helena Brooks/avatar.jpg",
    banner: "../media/Helena Brooks/banner.jpg",
    introVideoId: 355,
  },
  {
    id: "ps-barbi-lane",
    name: "Barbi Lane",
    handle: "@barbilane",
    slug: "barbi-lane",
    subs: 13400,
    bio: "Long-blonde AI pornstar — huge naturals, window light, and the Barbi Slut / Big Naturals pack. Same face, stacked clips.",
    tags: ["Barbi Lane", "Pornstar", "Blonde", "Big Tits", "Babe", "AI", "Solo"],
    categories: ["Big Tits", "AI Generated", "Blonde"],
    avatar: "../media/Barbi Lane/avatar.jpg",
    banner: "../media/Barbi Lane/banner.jpg",
    introVideoId: 6146,
  },
  {
    id: "ps-dakota-j",
    name: "Dakota J",
    handle: "@dakotaj",
    slug: "dakota-j",
    subs: 9800,
    bio: "Amateur BBW AI pornstar — brunette waves, outdoor heat, and a numbered Dakota J pack.",
    tags: ["Dakota J", "Pornstar", "BBW", "Babe", "Big Tits", "AI", "Amateur"],
    categories: ["Babe", "AI Generated", "Amateur"],
    avatar: "../media/Dakota J/avatar.jpg",
    banner: "../media/Dakota J/banner.jpg",
    introVideoId: 6201,
  },
  {
    id: "ps-sara-katz",
    name: "Sara Katz",
    handle: "@sarakatz",
    slug: "sara-katz",
    subs: 8700,
    bio: "Curly redhead AI pornstar — close-up heat and a named Sara Katz series.",
    tags: ["Sara Katz", "Pornstar", "Redhead", "Babe", "AI", "Amateur"],
    categories: ["Redhead", "AI Generated", "Babe"],
    avatar: "../media/Sara Katz/avatar.jpg",
    banner: "../media/Sara Katz/banner.jpg",
    introVideoId: 6224,
  },
  {
    id: "ps-lana-wilde",
    name: "Lana Wilde",
    handle: "@lanawilde",
    slug: "lana-wilde",
    subs: 10200,
    bio: "Party-blonde AI pornstar from the Blond Going Wilde pack — messy glam, high energy, same face on repeat.",
    tags: ["Lana Wilde", "Pornstar", "Blonde", "Babe", "AI", "Solo"],
    categories: ["Blonde", "AI Generated", "Babe"],
    avatar: "../media/Lana Wilde/avatar.jpg",
    banner: "../media/Lana Wilde/banner.jpg",
    introVideoId: 6234,
  },
  {
    id: "ps-piper-belle",
    name: "Piper Belle",
    handle: "@piperbelle",
    slug: "piper-belle",
    subs: 9100,
    bio: "Hotel-blonde AI pornstar — the Perfect Little Girl numbered pack. Soft smile, same look, lots of clips.",
    tags: ["Piper Belle", "Pornstar", "Blonde", "Babe", "AI", "Solo"],
    categories: ["Blonde", "AI Generated", "Babe"],
    avatar: "../media/Piper Belle/avatar.jpg",
    banner: "../media/Piper Belle/banner.jpg",
    introVideoId: 6260,
  },
  {
    id: "ps-ruby-voss",
    name: "Ruby Voss",
    handle: "@rubyvoss",
    slug: "ruby-voss",
    subs: 8900,
    bio: "Straight-red AI pornstar — pale skin, heavy chest, Grok redhead session clips built around one face.",
    tags: ["Ruby Voss", "Pornstar", "Redhead", "Big Tits", "Babe", "AI", "Solo"],
    categories: ["Redhead", "AI Generated", "Big Tits"],
    avatar: "../media/Ruby Voss/avatar.jpg",
    banner: "../media/Ruby Voss/banner.jpg",
    introVideoId: 6283,
  },
  {
    id: "ps-anna-vance",
    name: "Anna Vance",
    handle: "@annavance",
    slug: "anna-vance",
    subs: 17400,
    bio: "High-fashion AI supermodel — brunette waves, flawless studio lighting, and endless bedroom poses. High-definition series on repeat.",
    tags: ["Anna Vance", "Pornstar", "Babe", "AI", "Solo", "Supermodel", "Brunette"],
    categories: ["Babe", "AI Generated", "Amateur"],
    avatar: "../media/thumbs/new batch 5/Anna Super Model00001.jpg",
    banner: "../media/thumbs/new batch 5/Anna Super Model00001.jpg",
    introVideoId: 4935,
  },
  {
    id: "ps-kaya-sky",
    name: "Kaya Sky",
    handle: "@kayasky",
    slug: "kaya-sky",
    subs: 13800,
    bio: "NYC skyline AI babe — outdoor sunset views, rooftop heat, and intimate multi-angle scenes high above the city.",
    tags: ["Kaya Sky", "Pornstar", "Babe", "Lesbian", "AI", "Public", "Rooftop"],
    categories: ["Babe", "AI Generated", "Lesbian"],
    avatar: "../media/thumbs/new-batch-2026-08-26/nyc-rooftop-threesome/NYC-Rooftop-Threesome__Clip-1.jpg",
    banner: "../media/thumbs/new-batch-2026-08-26/nyc-rooftop-threesome/NYC-Rooftop-Threesome__Clip-1.jpg",
    introVideoId: 6294,
  },
  {
    id: "ps-bella-bloom",
    name: "Bella Bloom",
    handle: "@bellabloom",
    slug: "bella-bloom",
    subs: 11900,
    bio: "Petite AI bombshell — captivating eyes, soft facial features, and intimate solo bedroom clips with a single recurring face.",
    tags: ["Bella Bloom", "Pornstar", "Babe", "AI", "Solo", "Amateur"],
    categories: ["Babe", "AI Generated"],
    avatar: "../media/thumbs/all mp4 porn /the most pretty girl.jpg",
    banner: "../media/thumbs/all mp4 porn /the most pretty girl.jpg",
    introVideoId: 3574,
  },
  {
    id: "ps-sienna-west",
    name: "Sienna West",
    handle: "@siennawest",
    slug: "sienna-west",
    subs: 14200,
    bio: "Stacked AI beauty — demure charm, huge natural tits, and slow-motion bedroom teases.",
    tags: ["Sienna West", "Pornstar", "Big Tits", "Babe", "AI", "Solo", "PAWG"],
    categories: ["Big Tits", "AI Generated", "Babe"],
    avatar: "../media/thumbs/batch-1/Amazing Demure Desires Big naturals1.jpg",
    banner: "../media/thumbs/batch-1/Amazing Demure Desires Big naturals1.jpg",
    introVideoId: 190,
  },
  {
    id: "ps-jenny-cross",
    name: "Jenny Cross",
    handle: "@jennycross",
    slug: "jenny-cross",
    subs: 10600,
    bio: "PAWG AI dancer — legendary rooftop curves, bubble butt close-ups, and outdoor twerk energy.",
    tags: ["Jenny Cross", "Pornstar", "Big Ass", "PAWG", "Babe", "AI", "Solo"],
    categories: ["Big Ass", "AI Generated", "PAWG"],
    avatar: "../media/thumbs/new batch 6/Jenny Butt Perfect Ass rooftop.jpg",
    banner: "../media/thumbs/new batch 6/Jenny Butt Perfect Ass rooftop.jpg",
    introVideoId: 5082,
  },
  {
    id: "ps-scarlett-flame",
    name: "Scarlett Flame",
    handle: "@scarlettflame",
    slug: "scarlett-flame",
    subs: 16500,
    bio: "Fiery redhead AI star — pale skin, intense gaze, and uninhibited passion in full 4K resolution.",
    tags: ["Scarlett Flame", "Pornstar", "Redhead", "Babe", "AI", "Solo"],
    categories: ["Redhead", "AI Generated", "Babe"],
    avatar: "../media/thumbs/Redhead getting fuck COMPILATION/REDHED COMPLITION00001.jpg",
    banner: "../media/thumbs/Redhead getting fuck COMPILATION/REDHED COMPLITION00001.jpg",
    introVideoId: 1380,
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

function videoCardHtml(v, { eager = false, fetchpriority } = {}) {
  const thumbUrl = v.thumb ? mediaUrl(v.thumb) : "";
  const dur = v.duration ? `<span class="card-dur">${esc(v.duration)}</span>` : "";
  const views = fmtViews(v.views || 1200);
  const loading = eager ? "eager" : "lazy";
  const fpAttr = fetchpriority ? ` fetchpriority="${fetchpriority}"` : "";
  return `
    <a class="card" href="/video/${v.id}.html" title="${esc(v.title)}">
      <div class="video-thumb">
        ${thumbUrl ? `<img class="thumb-video" src="${thumbUrl}" alt="" width="320" height="180" loading="${loading}"${fpAttr} decoding="async"/>` : ""}
        <span class="quality-badge">4K</span>
        ${dur ? `<span class="dur-badge">${dur.replace(/<[^>]+>/g, "")}</span>` : ""}
        <span class="play-badge">▶</span>
      </div>
      <div class="title">${esc(v.title)}</div>
      <div class="card-meta">${esc(v.category || "AI")} · ${views} views</div>
    </a>`;
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
  <meta name="theme-color" content="#0A0A0A"/>
  <meta name="rating" content="RTA-5042-1996-1400-1577-RTA"/>
  <link rel="preconnect" href="https://pub-b281e1d5ecb94a148bd620f8a2fe9d55.r2.dev" crossorigin/>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
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
  ${FAVICON_LINKS}
  <link rel="stylesheet" href="/app-shell.css"/>
  <style>
    :root {
      --bg: #0A0A0A;
      --surface: #141414;
      --surface2: #1E1E1E;
      --border: rgba(255,255,255,0.10);
      --accent: #E50914;
      --accent2: #FF3B3B;
      --text: #FFFFFF;
      --muted: #A0A0A0;
      --radius: 14px;
    }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      margin: 0;
      line-height: 1.5;
    }
    .btn-primary {
      background: var(--accent);
      color: #fff;
      text-decoration: none;
      padding: 8px 16px;
      border-radius: 999px;
      font-size: 13px;
      font-weight: 600;
      transition: background 0.15s;
    }
    .btn-primary:hover { background: var(--accent2); }
    .page-hero {
      padding: 48px 20px;
      background: radial-gradient(circle at 50% 0%, rgba(229,9,20,0.12), transparent 70%);
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
      border-radius: var(--radius);
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
      background: rgba(229,9,20,0.92);
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
    /* Video Detail Page styles */
    .video-view-wrap { max-width: 1000px; margin: 0 auto; padding: 24px 20px; }
    .video-player-hero {
      position: relative;
      aspect-ratio: 16 / 9;
      background: #000;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 12px 36px rgba(0,0,0,0.6);
      border: 1px solid var(--border);
      margin-bottom: 24px;
    }
    .video-player-hero img,
    .video-player-hero video {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
      background: #000;
    }
    .video-hero-overlay {
      position: absolute;
      inset: 0;
      background: linear-gradient(0deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 50%, rgba(0,0,0,0.4) 100%);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 20px;
    }
    .video-top-badges { display: flex; align-items: center; gap: 8px; }
    .quality-pill {
      background: var(--accent);
      color: #fff;
      font-size: 11px;
      font-weight: 800;
      padding: 3px 8px;
      border-radius: 4px;
      letter-spacing: .05em;
    }
    .duration-pill {
      background: rgba(0,0,0,0.75);
      color: #fff;
      font-size: 11px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 4px;
    }
    .video-play-center {
      align-self: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      text-decoration: none;
      color: #fff;
    }
    .big-play-btn {
      width: 72px;
      height: 72px;
      border-radius: 50%;
      background: var(--accent);
      color: #fff;
      font-size: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 0 30px rgba(229,9,20,0.45);
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .video-play-center:hover .big-play-btn {
      transform: scale(1.1);
      box-shadow: 0 0 45px rgba(229,9,20,0.55);
    }
    .video-play-label {
      font-size: 15px;
      font-weight: 700;
      text-shadow: 0 2px 8px rgba(0,0,0,0.8);
    }
    .video-info-box { margin-bottom: 24px; }
    .video-page-title { font-size: 26px; font-weight: 800; color: #fff; margin: 0 0 10px; line-height: 1.3; }
    .video-meta-row { display: flex; align-items: center; gap: 10px; color: var(--muted); font-size: 13.5px; margin-bottom: 16px; flex-wrap: wrap; }
    .video-desc { font-size: 14.5px; color: #cbd5e1; line-height: 1.6; margin: 0 0 16px; }
    .video-tags-list { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 24px; }
    .tag-chip {
      background: var(--surface2);
      border: 1px solid var(--border);
      color: #cbd5e1;
      font-size: 12px;
      font-weight: 600;
      padding: 5px 12px;
      border-radius: 999px;
      text-decoration: none;
      transition: border-color 0.15s, color 0.15s;
    }
    .tag-chip:hover { border-color: var(--accent); color: #fff; }

    /* Video Affiliate Conversion Card */
    .video-affiliate-box {
      margin: 28px 0;
      padding: 20px 24px;
      border-radius: 16px;
      background: radial-gradient(120% 160% at 100% 50%, rgba(229,9,20,0.16), rgba(20,20,20,0.96) 65%);
      border: 1px solid rgba(229,9,20,0.35);
      box-shadow: 0 10px 30px rgba(0,0,0,0.4);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
      flex-wrap: wrap;
    }
    .aff-left { flex: 1; min-width: 260px; }
    .aff-badge-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
    .aff-badge-pill {
      background: var(--accent);
      color: #fff;
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: .05em;
      padding: 2px 7px;
      border-radius: 4px;
    }
    .aff-partner { font-size: 12px; font-weight: 700; color: #fff; }
    .aff-title { font-size: 17px; font-weight: 800; color: #fff; margin: 0 0 6px; }
    .aff-desc { font-size: 13px; color: var(--muted); line-height: 1.45; margin: 0; }
    .aff-cta-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: var(--accent);
      color: #fff;
      font-size: 13px;
      font-weight: 800;
      padding: 10px 22px;
      border-radius: 999px;
      text-decoration: none;
      box-shadow: 0 4px 16px rgba(229,9,20,0.35);
      transition: transform 0.15s, box-shadow 0.15s;
      flex: none;
    }
    .aff-cta-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 22px rgba(229,9,20,0.45);
    }

    @media(max-width: 768px) {
      .site-nav { display: none; }
      .page-hero h1 { font-size: 26px; }
      .v-grid { grid-template-columns: 1fr; }
      .video-affiliate-box { flex-direction: column; align-items: flex-start; }
      .aff-cta-btn { width: 100%; justify-content: center; }
    }
  </style>
  <script type="application/ld+json">
${JSON.stringify(jsonLd, null, 2)}
  </script>
</head>
<body>
  ${appShellHtml(activeNav, bodyContent)}
</body>
</html>`;
}

// 1. Generate /pornstars/index.html
function genPornstarsHub() {
  const title = "AI Pornstars Directory — Verified 4K Virtual Personas | thebestpornai";
  const description = "Discover the internet's most popular AI pornstars including Mia Nympo, Sabrina Ass, and Marsha Banks. Stream full-length scenes and 4K vertical Shorts.";
  const canonical = `${ORIGIN}/pornstars/`;

  const cardsHtml = PORNSTARS.map((ps) => {
    const bannerUrl = mediaUrl(ps.banner);
    return `
      <a class="card" href="/pornstars/${ps.slug}.html">
        <div class="video-thumb">
          <img class="thumb-video" src="${bannerUrl}" alt="" width="320" height="180" loading="lazy" decoding="async"/>
        </div>
        <div class="title">${esc(ps.name)}</div>
        <div class="card-meta">${esc((ps.bio || "").slice(0, 90))}${(ps.bio || "").length > 90 ? "…" : ""}</div>
      </a>`;
  }).join("\n");

  const bodyContent = `
    <h3 class="row-heading">Pornstars</h3>
    <p class="sub">Intro + Shorts packs — tap a star to open their page</p>
    <div class="v-grid">${cardsHtml}</div>`;

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

    const videoCards = creatorVideos.map((v, i) => videoCardHtml(v, { eager: i < 4, fetchpriority: i === 0 ? "high" : undefined })).join("\n");

    const bodyContent = `
      <h3 class="row-heading">${esc(ps.name)}</h3>
      <p class="sub">${esc(ps.bio)}</p>
      <div class="v-grid">
        ${videoCards.length ? videoCards : '<p class="sub">More videos coming soon.</p>'}
      </div>`;

    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "Person",
      "name": ps.name,
      "url": canonical,
      "image": avatarUrl,
      "description": ps.bio,
      "sameAs": [
        ps.blogSlug ? `${ORIGIN}/blog/${ps.blogSlug}.html` : `${ORIGIN}/pornstars/${ps.slug}.html`
      ].filter(Boolean),
      "subjectOf": creatorVideos.slice(0, 12).map((v) => ({
        "@type": "WebPage",
        "name": v.title,
        "url": `${ORIGIN}/video/${v.id}.html`
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
    const matches = VIDEOS.filter((v) =>
      (v.category && v.category.toLowerCase() === cat.name.toLowerCase()) ||
      (v.categories && v.categories.some((c) => c.toLowerCase() === cat.name.toLowerCase()))
    );
    const thumb = matches.find((v) => v.thumb)?.thumb;
    const thumbUrl = thumb ? mediaUrl(thumb) : "";
    return `
      <a class="card" href="/categories/${slug}.html">
        <div class="video-thumb">
          ${thumbUrl ? `<img class="thumb-video" src="${thumbUrl}" alt="" width="320" height="180" loading="lazy" decoding="async"/>` : ""}
        </div>
        <div class="title">${esc(cat.name)}</div>
        <div class="card-meta">${matches.length} videos</div>
      </a>`;
  }).join("\n");

  const chips = TOP_CATEGORIES.map((cat) =>
    `<a class="filter-pill" href="/categories/${slugify(cat.name)}.html">${esc(cat.name)}</a>`
  ).join("");

  const bodyContent = `
    <h3 class="row-heading">Categories</h3>
    <p class="sub">Browse scenes by niche</p>
    <div class="home-chips-strip">${chips}</div>
    <div class="v-grid">${cardsHtml}</div>`;

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

    const videoCards = categoryVideos.map((v, i) => videoCardHtml(v, { eager: i < 4, fetchpriority: i === 0 ? "high" : undefined })).join("\n");
    const sampleThumb = categoryVideos[0]?.thumb ? mediaUrl(categoryVideos[0].thumb) : LOGO;

    const chips = TOP_CATEGORIES.map((c) =>
      `<a class="filter-pill${c.name === cat.name ? " active" : ""}" href="/categories/${slugify(c.name)}.html">${esc(c.name)}</a>`
    ).join("");

    const bodyContent = `
      <div class="home-chips-strip">${chips}</div>
      <h3 class="row-heading">${esc(cat.name)}</h3>
      <p class="sub">${esc(cat.desc)}</p>
      <div class="v-grid">
        ${videoCards.length ? videoCards : '<p class="sub">New scenes being generated daily.</p>'}
      </div>`;

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
          "url": `${ORIGIN}/video/${v.id}.html`,
          "name": v.title
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

// 5. Generate /video/<id>.html for top curated & popular scenes with rich Schema VideoObject and OurDream.ai affiliate conversion
function genVideoPages() {
  const byId = new Map(VIDEOS.map((v) => [v.id, v]));
  const seenIds = new Set();
  const prioritized = [];

  function add(v) {
    if (!v || !v.src || seenIds.has(v.id)) return;
    seenIds.add(v.id);
    prioritized.push(v);
  }

  // Generate static landing pages for ALL catalog videos
  for (const v of VIDEOS) {
    add(v);
  }

  console.log(`Generating static landing pages for ${prioritized.length} top videos...`);

  for (const v of prioritized) {
    const title = `${v.title} — 4K AI Porn Video | thebestpornai`;
    const description = v.desc || `Watch ${v.title} in 4K Ultra HD on thebestpornai. Free AI adult video stream featuring ${v.category || 'curated'} scenes with instant playback and no signups.`;
    const canonical = `${ORIGIN}/video/${v.id}.html`;
    const thumbUrl = v.thumb ? mediaUrl(v.thumb) : LOGO;
    const catSlug = slugify(v.category || "ai");

    // Related 6 videos in same category or overall
    const related = VIDEOS.filter(other => other.id !== v.id && (other.category === v.category || !v.category)).slice(0, 6);
    const relatedCards = related.map((r) => videoCardHtml(r, { eager: false })).join("\n");

    const bodyContent = `
      <main class="video-view-wrap">
        <div class="video-player-hero">
          ${v.src
            ? `<video controls playsinline preload="metadata" width="960" height="540" poster="${esc(thumbUrl)}" title="${esc(v.title)}">
            <source src="${esc(mediaUrl(v.src))}" type="video/mp4"/>
          </video>`
            : (thumbUrl
              ? `<img src="${thumbUrl}" alt="${esc(v.title)}" width="960" height="540" loading="eager" fetchpriority="high" decoding="async"/>`
              : `<div class="v-ph"></div>`)}
        </div>
        <p class="sub" style="margin:12px 0 0">
          <a href="${playPath(v)}" style="color:var(--accent);font-weight:700">Open in full player</a>
          · 4K Ultra HD${v.duration ? ` · ${esc(v.duration)}` : ""} · 100% Free
        </p>

        <div class="video-info-box">
          <h1 class="video-page-title">${esc(v.title)}</h1>
          <div class="video-meta-row">
            <span><strong>${fmtViews(v.views || 2400)}</strong> views</span>
            <span>•</span>
            <span>Published ${esc(v.uploaded || "Recently")}</span>
            <span>•</span>
            <span>Category: <a href="/categories/${catSlug}.html" style="color:var(--accent);text-decoration:none;font-weight:700">${esc(v.category || "AI")}</a></span>
          </div>
          ${v.desc ? `<p class="video-desc">${esc(v.desc)}</p>` : ""}
          <div class="video-tags-list">
            ${(v.categories || [v.category]).filter(Boolean).map(c => `<a class="tag-chip" href="/categories/${slugify(c)}.html">${esc(c)}</a>`).join("")}
            ${(v.tags || []).slice(0, 8).map(t => `<a class="tag-chip" href="${searchPath(t)}">#${esc(t)}</a>`).join("")}
          </div>
        </div>

        <div class="video-affiliate-box">
          <div class="aff-left">
            <div class="aff-badge-row">
              <span class="aff-badge-pill">⚡ AI Video Generator</span>
              <span class="aff-partner">OurDream.ai</span>
            </div>
            <h2 class="aff-title">Want to create adult videos like this?</h2>
            <p class="aff-desc">This scene was generated using <strong>OurDream.ai</strong>. Try the #1 rated uncensored AI generator to create your own custom photoreal models, deepfakes, and 4K scenes in seconds.</p>
          </div>
          <a href="${ourdreamUrl("create", "video-landing")}" target="_blank" rel="${OURDREAM_REL}" class="aff-cta-btn">
            <span>Try OurDream.ai Free →</span>
          </a>
        </div>

        <div style="margin-top:40px">
          <h3 style="font-size:18px;font-weight:700;margin-bottom:20px;color:#fff">Related 4K Scenes</h3>
          <div class="v-grid">
            ${relatedCards}
          </div>
        </div>
      </main>`;

    const mediaStreamUrl = v.src ? mediaUrl(v.src) : null;
    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "VideoObject",
      "name": v.title,
      "description": description,
      "thumbnailUrl": [thumbUrl],
      "uploadDate": isoUploadDate(v.uploaded),
      "duration": isoDuration(v.duration),
      "url": canonical,
      "embedUrl": canonical,
      ...(mediaStreamUrl ? { "contentUrl": mediaStreamUrl } : {}),
      "isFamilyFriendly": "false",
      "interactionStatistic": {
        "@type": "InteractionCounter",
        "interactionType": { "@type": "WatchAction" },
        "userInteractionCount": v.views || 2500
      }
    };

    const html = renderHtmlPage({
      title,
      description,
      canonical,
      ogImage: thumbUrl,
      jsonLd,
      activeNav: "home",
      bodyContent,
    });

    fs.writeFileSync(path.join(VIDEO_DIR, `${v.id}.html`), html);
  }
  console.log(`✔ Generated ${prioritized.length} static video pages in video/`);
}

// Run generators
genPornstarsHub();
genPornstarProfiles();
genCategoriesHub();
genCategoryPages();
genVideoPages();

console.log("🎉 All static routes generated successfully.");
