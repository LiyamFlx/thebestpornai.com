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
import { DATA } from "../src/shared/catalog.js";
import { isoUploadDate } from "../src/shared/dates.js";
import { playPath, searchPath } from "../src/shared/public-routes.js";
import { ourdreamUrl, OURDREAM_REL } from "../src/shared/affiliates.js";
import { FAVICON_LINKS, appShellHtml } from "./lib/site-chrome.mjs";
import { TOP_CATEGORIES } from "./lib/category-metadata.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, "..");
const PORNSTARS_DIR = path.join(REPO, "pornstars");
const CATEGORIES_DIR = path.join(REPO, "categories");
const TAGS_DIR = path.join(REPO, "tags");
const CHANNELS_DIR = path.join(REPO, "channels");
const VIDEO_DIR = path.join(REPO, "video");
const ORIGIN = "https://www.thebestpornai.com";
const MEDIA_BASE = "https://pub-b281e1d5ecb94a148bd620f8a2fe9d55.r2.dev/media";
const LOGO = `${ORIGIN}/logo.webp`;

fs.mkdirSync(PORNSTARS_DIR, { recursive: true });
fs.mkdirSync(CATEGORIES_DIR, { recursive: true });
fs.mkdirSync(TAGS_DIR, { recursive: true });
fs.mkdirSync(CHANNELS_DIR, { recursive: true });
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

// First-party image URL (vercel.json /r2/* proxy → R2) for schema, og:image and
// other crawler-facing fields. Google's fetchers often fail on pub-*.r2.dev; the
// blog generator already does this. Video bytes still use mediaUrl() so mp4
// traffic is not proxied through Vercel.
function imgUrl(src) {
  if (!src) return "";
  if (/^https?:\/\/pub-[a-f0-9]+\.r2\.dev\/media\//i.test(src)) {
    const rel = src.replace(/^https?:\/\/pub-[a-f0-9]+\.r2\.dev\/media\//i, "");
    return `${ORIGIN}/r2/media/` + rel.split("/").map(encodeURIComponent).join("/");
  }
  if (/^https?:\/\//i.test(src)) return src;
  const rel = src.replace(/^(\.\.\/)?media\//, "");
  return `${ORIGIN}/r2/media/` + rel.split("/").map(encodeURIComponent).join("/");
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
    id: "ps-skye-harlow",
    name: "Skye Harlow",
    handle: "@skyeharlow",
    slug: "skye-harlow",
    subs: 11200,
    bio: "City-window AI pornstar — blonde bob, skyline light, and a full pack of the same face. Curves first, high-rise heat.",
    tags: ["Skye Harlow","Pornstar","Blonde","Big Ass","Babe","AI","Solo"],
    categories: ["Big Ass","AI Generated","Blonde"],
    avatar: "../media/thumbs/VID SEP/grok-video-16cb88a5-de6e-460a-8659-6d94c185e6ab.jpg",
    banner: "../media/thumbs/VID SEP/grok-video-16cb88a5-de6e-460a-8659-6d94c185e6ab.jpg",
    introVideoId: 6664,
  },
  {
    id: "ps-sloane-sage",
    name: "Sloane & Sage",
    handle: "@sloanesage",
    slug: "sloane-sage",
    subs: 14600,
    bio: "Twin AI pornstars — matching blonde braids, poolside black bikinis, and girl-girl clips that stay on the same two faces.",
    tags: ["Sloane & Sage","Pornstar","Lesbian","Blonde","Twins","Babe","AI"],
    categories: ["Lesbian","AI Generated","Blonde"],
    avatar: "../media/thumbs/VID SEP/grok-video-e9dab9ff-7fe3-4704-871d-2e4b54b02943.jpg",
    banner: "../media/thumbs/VID SEP/grok-video-e9dab9ff-7fe3-4704-871d-2e4b54b02943.jpg",
    introVideoId: 6781,
  },
  {
    id: "ps-sable-frost",
    name: "Sable Frost",
    handle: "@sablefrost",
    slug: "sable-frost",
    subs: 13100,
    bio: "Wet-look platinum AI pornstar — long icy hair, glossy skin, and a twenty-clip pack built on one face.",
    tags: ["Sable Frost","Pornstar","Blonde","Babe","AI","Solo"],
    categories: ["Blonde","AI Generated","Babe"],
    avatar: "../media/thumbs/VID SEP/grok-video-019fa8a4-90cb-7aa1-86be-96e11257b9b9 (9).jpg",
    banner: "../media/thumbs/VID SEP/grok-video-019fa8a4-90cb-7aa1-86be-96e11257b9b9 (9).jpg",
    introVideoId: 6632,
  },
  {
    id: "ps-delen-hart",
    name: "Delen Hart",
    handle: "@delenhart",
    slug: "delen-hart",
    subs: 15800,
    bio: "Delen Hart — brunette AI pornstar, messy-bedroom light, sheer lingerie, and the same face from the full clip through the short.",
    tags: ["Delen Hart","Pornstar","Brunette","Big Tits","Babe","AI","Solo"],
    categories: ["Big Tits","AI Generated","Brunette"],
    avatar: "../media/thumbs/VID SEP/grok-video-bcdae33e-293f-4bb6-83ce-0d3609ee128c.jpg",
    banner: "../media/thumbs/VID SEP/grok-video-bcdae33e-293f-4bb6-83ce-0d3609ee128c.jpg",
    introVideoId: 6745,
  },
  {
    id: "ps-elara-voss",
    name: "Elara Voss",
    handle: "@elaravoss",
    slug: "elara-voss",
    subs: 17200,
    bio: "Silver-braid AI pornstar — ice-blue eyes, platinum hair, loft light. One elfin face across the whole numbered pack.",
    tags: ["Elara Voss","Pornstar","Blonde","Babe","AI","Solo"],
    categories: ["Blonde","AI Generated","Babe"],
    avatar: "../media/thumbs/VID SEP/video-0057e29f.jpg",
    banner: "../media/thumbs/VID SEP/video-0057e29f.jpg",
    introVideoId: 6808,
  },
  {
    id: "ps-blair-quinn",
    name: "Blair Quinn",
    handle: "@blairquinn",
    slug: "blair-quinn",
    subs: 9800,
    bio: "Studio-blonde AI pornstar — short bob, athletic back, white lingerie, same girl on every take.",
    tags: ["Blair Quinn","Pornstar","Blonde","Babe","Athletic","AI","Solo"],
    categories: ["Babe","AI Generated","Blonde"],
    avatar: "../media/thumbs/VID SEP/grok-video-765eb3ec-f55d-4a6f-8fdb-7ae8204c5350.jpg",
    banner: "../media/thumbs/VID SEP/grok-video-765eb3ec-f55d-4a6f-8fdb-7ae8204c5350.jpg",
    introVideoId: 6704,
  },
  {
    id: "ps-tessa-kane",
    name: "Tessa Kane",
    handle: "@tessakane",
    slug: "tessa-kane",
    subs: 12100,
    bio: "Sunlit brunette AI pornstar — long brown hair, black sets, outdoor and indoor packs of the same face.",
    tags: ["Tessa Kane","Pornstar","Brunette","Big Tits","Babe","AI","Solo"],
    categories: ["Brunette","AI Generated","Big Tits"],
    avatar: "../media/thumbs/VID SEP/grok-video-d7e827e9-09ae-4487-8e82-f9748c4bfb70.jpg",
    banner: "../media/thumbs/VID SEP/grok-video-d7e827e9-09ae-4487-8e82-f9748c4bfb70.jpg",
    introVideoId: 6755,
  },
  {
    id: "ps-goldie-lane",
    name: "Goldie Lane",
    handle: "@goldielane",
    slug: "goldie-lane",
    subs: 8900,
    bio: "Long-wave blonde AI pornstar — back-view packs, soft studio walls, one honey-blonde look.",
    tags: ["Goldie Lane","Pornstar","Blonde","Big Ass","Babe","AI","Solo"],
    categories: ["Blonde","AI Generated","Big Ass"],
    avatar: "../media/thumbs/VID SEP/grok-video-9d61434e-8144-42a7-bcf3-02fd659526f7.jpg",
    banner: "../media/thumbs/VID SEP/grok-video-9d61434e-8144-42a7-bcf3-02fd659526f7.jpg",
    introVideoId: 6720,
  },
  {
    id: "ps-nix-violet",
    name: "Nix Violet",
    handle: "@nixviolet",
    slug: "nix-violet",
    subs: 7600,
    bio: "Illustrated AI pornstar — short violet hair, mic-stand energy, one anime face across the roleplay clips.",
    tags: ["Nix Violet","Pornstar","Hentai","Anime","Babe","AI","Solo"],
    categories: ["Hentai / Anime","AI Generated","Babe"],
    avatar: "../media/thumbs/VID SEP/ourdream.ai Unlimited AI Roleplay Platform.jpg",
    banner: "../media/thumbs/VID SEP/ourdream.ai Unlimited AI Roleplay Platform.jpg",
    introVideoId: 6789,
  },
  {
    id: "ps-lumi-ray",
    name: "Lumi Ray",
    handle: "@lumiray",
    slug: "lumi-ray",
    subs: 13900,
    bio: "Pink-tipped blonde AI pornstar — huge blue eyes, gamer-room light, candy hair, same face in every clip.",
    tags: ["Lumi Ray","Pornstar","Blonde","Big Tits","Babe","AI","Solo"],
    categories: ["Big Tits","AI Generated","Blonde"],
    avatar: "../media/thumbs/VID SEP/WhatsApp Video 2026-03-22 at 20.45.57.jpg",
    banner: "../media/thumbs/VID SEP/WhatsApp Video 2026-03-22 at 20.45.57.jpg",
    introVideoId: 6829,
  },
  {
    id: "ps-anya-volkov",
    name: "Anya Volkov",
    handle: "@anyavolkov",
    slug: "anya-volkov",
    subs: 12400,
    bio: "Russian-goddess AI pornstar — dark hair, black tank, big naturals. Named pack plus the matching untitled clips.",
    tags: ["Anya Volkov","Pornstar","Brunette","Big Tits","Babe","AI","Solo"],
    categories: ["Big Tits","AI Generated","Brunette"],
    avatar: "../media/thumbs/VID SEP/video-50bbfb45.jpg",
    banner: "../media/thumbs/VID SEP/video-50bbfb45.jpg",
    introVideoId: 6814,
  },
  {
    id: "ps-willa-shore",
    name: "Willa Shore",
    handle: "@willashore",
    slug: "willa-shore",
    subs: 10100,
    bio: "Beach-blonde AI pornstar — white thong, sand, and the same dancing pack from every angle.",
    tags: ["Willa Shore","Pornstar","Blonde","Big Ass","PAWG","AI","Solo"],
    categories: ["Big Ass","AI Generated","Blonde"],
    avatar: "../media/thumbs/VID SEP/white thong dancing00012.jpg",
    banner: "../media/thumbs/VID SEP/white thong dancing00012.jpg",
    introVideoId: 6833,
  },
  {
    id: "ps-roxie-ember",
    name: "Roxie Ember",
    handle: "@roxieember",
    slug: "roxie-ember",
    subs: 11800,
    bio: "Beach redhead AI pornstar — the RedHot pack. Pale skin, black bikini, same ginger on the sand.",
    tags: ["Roxie Ember","Pornstar","Redhead","Babe","AI","Outdoor","Solo"],
    categories: ["Redhead","AI Generated","Babe"],
    avatar: "../media/thumbs/VID SEP/video-66b0f3d8.jpg",
    banner: "../media/thumbs/VID SEP/video-66b0f3d8.jpg",
    introVideoId: 6821,
  },
  {
    id: "ps-midnight-trio",
    name: "The Midnight Trio",
    handle: "@midnighttrio",
    slug: "midnight-trio",
    subs: 13300,
    bio: "Three-girl AI pack — blonde, brunette, and redhead in matching black lingerie. The Top 3 series, one group.",
    tags: ["The Midnight Trio","Pornstar","Threesome","Babe","AI","Lingerie"],
    categories: ["Threesome","AI Generated","Babe"],
    avatar: "../media/thumbs/VID SEP/top 3 sexy00030.jpg",
    banner: "../media/thumbs/VID SEP/top 3 sexy00030.jpg",
    introVideoId: 6807,
  },
  {
    id: "ps-maya-shore",
    name: "Maya Shore",
    handle: "@mayashore",
    slug: "maya-shore",
    subs: 9600,
    bio: "Maya S — beach-smile blonde AI pornstar. Big ass, big tits, the named PAWG clips under one profile.",
    tags: ["Maya Shore","Pornstar","Blonde","Big Ass","Big Tits","PAWG","AI"],
    categories: ["Blonde","AI Generated","Big Ass"],
    avatar: "../media/thumbs/VID SEP/Maya S.jpg",
    banner: "../media/thumbs/VID SEP/Maya S.jpg",
    introVideoId: 6785,
  },
  {
    id: "ps-maayan-levi",
    name: "Maayan Levi",
    handle: "@maayanlevi",
    slug: "maayan-levi",
    subs: 10900,
    bio: "Maayan Levi — long brunette AI pornstar. The Jewish-princess pack, city night and pink-room cuts, one face.",
    tags: ["Maayan Levi","Pornstar","Brunette","Babe","AI","Public"],
    categories: ["Brunette","AI Generated","Babe"],
    avatar: "../media/thumbs/VID SEP/Maayan The Jewish princes.jpg",
    banner: "../media/thumbs/VID SEP/Maayan The Jewish princes.jpg",
    introVideoId: 6783,
  },
  {
    id: "ps-vera-kane",
    name: "Vera Kane",
    handle: "@verakane",
    slug: "vera-kane",
    subs: 8700,
    bio: "Uniform AI pornstar — olive drab, heavy chest, the military-look pack under one name.",
    tags: ["Vera Kane","Pornstar","Cosplay","Big Tits","Babe","AI"],
    categories: ["Cosplay","AI Generated","Big Tits"],
    avatar: "../media/thumbs/VID SEP/grok-video-110105b0-d3d2-4c82-907d-b75900aadeeb.jpg",
    banner: "../media/thumbs/VID SEP/grok-video-110105b0-d3d2-4c82-907d-b75900aadeeb.jpg",
    introVideoId: 6641,
  },
  {
    id: "ps-nia-brooks",
    name: "Nia Brooks",
    handle: "@niabrooks",
    slug: "nia-brooks",
    subs: 9200,
    bio: "Night-out AI pornstar — braids, gold, deep skin, one face for the neon clips.",
    tags: ["Nia Brooks","Pornstar","Ebony","Big Tits","Babe","AI","Solo"],
    categories: ["Ebony","AI Generated","Big Tits"],
    avatar: "../media/thumbs/VID SEP/grok-video-e142f0d4-1a87-4e2d-8dd2-c680ef3575fa.jpg",
    banner: "../media/thumbs/VID SEP/grok-video-e142f0d4-1a87-4e2d-8dd2-c680ef3575fa.jpg",
    introVideoId: 6756,
  },
  {
    id: "ps-kira-neon",
    name: "Kira Neon",
    handle: "@kiraneon",
    slug: "kira-neon",
    subs: 8400,
    bio: "Neon-city AI pornstar — purple-pink hair, club light, the night-drive and alley packs.",
    tags: ["Kira Neon","Pornstar","Babe","AI","Solo"],
    categories: ["Babe","AI Generated","Cosplay"],
    avatar: "../media/thumbs/VID SEP/Grok-Video-6A361A62-9BD9-4A3A-9104-B7F4F528342B.jpg",
    banner: "../media/thumbs/VID SEP/Grok-Video-6A361A62-9BD9-4A3A-9104-B7F4F528342B.jpg",
    introVideoId: 6695,
  },
  {
    id: "ps-mei-lin",
    name: "Mei Lin",
    handle: "@meilin",
    slug: "mei-lin",
    subs: 7900,
    bio: "Close-up AI pornstar — dark hair, soft features, a single-face Asian pack.",
    tags: ["Mei Lin","Pornstar","Asian","Babe","AI","Solo"],
    categories: ["Asian","AI Generated","Babe"],
    avatar: "../media/thumbs/VID SEP/Russion Bih Natural00002.jpg",
    banner: "../media/thumbs/VID SEP/Russion Bih Natural00002.jpg",
    introVideoId: 6799,
  },
  {
    id: "ps-september-mix",
    name: "September Mix",
    handle: "@septembermix",
    slug: "september-mix",
    subs: 6400,
    bio: "September drop — one-off AI clips that do not share a repeating face with the named packs.",
    tags: ["September Mix","Pornstar","AI","Babe","Compilation"],
    categories: ["AI Generated","Babe"],
    avatar: "../media/thumbs/VID SEP/video-cce9a2ed (1).jpg",
    banner: "../media/thumbs/VID SEP/video-cce9a2ed (1).jpg",
    introVideoId: 6827,
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
  { id: "ps-nova-pike", name: "Nova Pike", handle: "@novapike", slug: "nova-pike", subs: 4200, bio: "Neon-blonde AI pornstar — pigtails, club light, and a repeating face across the October shorts.", tags: ["Nova Pike","Pornstar","Blonde","Big Tits","AI","Solo"], categories: ["Blonde","AI Generated","Big Tits"], avatar: "../media/thumbs/new-vid-oct-2026/Nova Pike/Nova Pike 01.jpg", banner: "../media/thumbs/new-vid-oct-2026/Nova Pike/Nova Pike 01.jpg", introVideoId: 6834 },
  { id: "ps-eden-blake", name: "Eden Blake", handle: "@edenblake", slug: "eden-blake", subs: 4100, bio: "Platinum-wave AI pornstar — sunlit room, the same face on every clip in the pack.", tags: ["Eden Blake","Pornstar","Blonde","Big Ass","AI","Solo"], categories: ["Blonde","AI Generated","Big Ass"], avatar: "../media/thumbs/new-vid-oct-2026/Eden Blake/Eden Blake 01.jpg", banner: "../media/thumbs/new-vid-oct-2026/Eden Blake/Eden Blake 01.jpg", introVideoId: 6847 },
  { id: "ps-sloane-vale", name: "Sloane Vale", handle: "@sloanevale", slug: "sloane-vale", subs: 3900, bio: "Selfie-style blonde AI pornstar — apartment light, one face, casual heat.", tags: ["Sloane Vale","Pornstar","Blonde","Amateur","AI","Solo"], categories: ["Blonde","AI Generated","Amateur"], avatar: "../media/thumbs/new-vid-oct-2026/Sloane Vale/Sloane Vale 01.jpg", banner: "../media/thumbs/new-vid-oct-2026/Sloane Vale/Sloane Vale 01.jpg", introVideoId: 6859 },
  { id: "ps-freya-moss", name: "Freya Moss", handle: "@freyamoss", slug: "freya-moss", subs: 4500, bio: "Pink-hair AI pornstar — onsen steam and the same face from the October imagine set.", tags: ["Freya Moss","Pornstar","Babe","Big Tits","AI","Solo"], categories: ["Babe","AI Generated","Big Tits"], avatar: "../media/thumbs/new-vid-oct-2026/Freya Moss/Freya Moss 01.jpg", banner: "../media/thumbs/new-vid-oct-2026/Freya Moss/Freya Moss 01.jpg", introVideoId: 6870 },
  { id: "ps-wren-hale", name: "Wren Hale", handle: "@wrenhale", slug: "wren-hale", subs: 3800, bio: "Freckled brunette AI pornstar — green eyes, one close-up face across the pack.", tags: ["Wren Hale","Pornstar","Babe","AI","Solo"], categories: ["Babe","AI Generated"], avatar: "../media/thumbs/new-vid-oct-2026/Wren Hale/Wren Hale 01.jpg", banner: "../media/thumbs/new-vid-oct-2026/Wren Hale/Wren Hale 01.jpg", introVideoId: 6885 },
  { id: "ps-maren-vale", name: "Maren Vale", handle: "@marenvale", slug: "maren-vale", subs: 3600, bio: "Pink-hair AI pornstar — studio back-view pack, one body and one color story.", tags: ["Maren Vale","Pornstar","Babe","Big Ass","AI","Solo"], categories: ["Babe","AI Generated","Big Ass"], avatar: "../media/thumbs/new-vid-oct-2026/Maren Vale/Maren Vale 01.jpg", banner: "../media/thumbs/new-vid-oct-2026/Maren Vale/Maren Vale 01.jpg", introVideoId: 6895 },
  { id: "ps-lexa-quinn", name: "Lexa Quinn", handle: "@lexaquinn", slug: "lexa-quinn", subs: 3700, bio: "Blonde AI pornstar — hallway lamp light, the same face in every short.", tags: ["Lexa Quinn","Pornstar","Blonde","Big Ass","AI","Solo"], categories: ["Blonde","AI Generated","Big Ass"], avatar: "../media/thumbs/new-vid-oct-2026/Lexa Quinn/Lexa Quinn 01.jpg", banner: "../media/thumbs/new-vid-oct-2026/Lexa Quinn/Lexa Quinn 01.jpg", introVideoId: 6904 },
  { id: "ps-nina-calder", name: "Nina Calder", handle: "@ninacalder", slug: "nina-calder", subs: 4000, bio: "Platinum bangs AI pornstar — red-room close-ups, one face.", tags: ["Nina Calder","Pornstar","Blonde","AI","Solo"], categories: ["Blonde","AI Generated"], avatar: "../media/thumbs/new-vid-oct-2026/Nina Calder/Nina Calder 01.jpg", banner: "../media/thumbs/new-vid-oct-2026/Nina Calder/Nina Calder 01.jpg", introVideoId: 6913 },
  { id: "ps-rhea-lux", name: "Rhea Lux", handle: "@rhealux", slug: "rhea-lux", subs: 4300, bio: "Yacht-bar AI pornstar — long blonde hair, black dress, one repeating face.", tags: ["Rhea Lux","Pornstar","Blonde","Babe","AI","Solo"], categories: ["Blonde","AI Generated","Babe"], avatar: "../media/thumbs/new-vid-oct-2026/Rhea Lux/Rhea Lux 01.jpg", banner: "../media/thumbs/new-vid-oct-2026/Rhea Lux/Rhea Lux 01.jpg", introVideoId: 6921 },
  { id: "ps-vesper-silk", name: "Vesper Silk", handle: "@vespersilk", slug: "vesper-silk", subs: 4400, bio: "Stage-light blonde AI pornstar — red set, one face, big-tits pack.", tags: ["Vesper Silk","Pornstar","Blonde","Big Tits","AI","Solo"], categories: ["Big Tits","AI Generated","Blonde"], avatar: "../media/thumbs/new-vid-oct-2026/Vesper Silk/Vesper Silk 01.jpg", banner: "../media/thumbs/new-vid-oct-2026/Vesper Silk/Vesper Silk 01.jpg", introVideoId: 6929 },
  { id: "ps-calla-reed", name: "Calla Reed", handle: "@callareed", slug: "calla-reed", subs: 3500, bio: "Red-silk AI pornstar — pigtails, parlor light, one face.", tags: ["Calla Reed","Pornstar","Blonde","AI","Solo"], categories: ["Blonde","AI Generated"], avatar: "../media/thumbs/new-vid-oct-2026/Calla Reed/Calla Reed 01.jpg", banner: "../media/thumbs/new-vid-oct-2026/Calla Reed/Calla Reed 01.jpg", introVideoId: 6935 },
  { id: "ps-mara-ellis", name: "Mara Ellis", handle: "@maraellis", slug: "mara-ellis", subs: 3400, bio: "City-blonde AI pornstar — headphones, street close-ups, one face.", tags: ["Mara Ellis","Pornstar","Blonde","Babe","AI","Solo"], categories: ["Blonde","AI Generated","Babe"], avatar: "../media/thumbs/new-vid-oct-2026/Mara Ellis/Mara Ellis 01.jpg", banner: "../media/thumbs/new-vid-oct-2026/Mara Ellis/Mara Ellis 01.jpg", introVideoId: 6941 },
  { id: "ps-aria-sol", name: "Aria Sol", handle: "@ariasol", slug: "aria-sol", subs: 4600, bio: "Window-light blonde AI pornstar — lingerie pack, one face.", tags: ["Aria Sol","Pornstar","Blonde","Big Tits","AI","Solo"], categories: ["Big Tits","AI Generated","Blonde"], avatar: "../media/thumbs/new-vid-oct-2026/Aria Sol/Aria Sol 01.jpg", banner: "../media/thumbs/new-vid-oct-2026/Aria Sol/Aria Sol 01.jpg", introVideoId: 6947 },
  { id: "ps-lila-brooks", name: "Lila Brooks", handle: "@lilabrooks", slug: "lila-brooks", subs: 3300, bio: "Rooftop AI pornstar — dark hair, white swim set, one face against open sky.", tags: ["Lila Brooks","Pornstar","Babe","Big Tits","AI","Solo"], categories: ["Babe","AI Generated","Big Tits"], avatar: "../media/thumbs/new-vid-oct-2026/Lila Brooks/Lila Brooks 01.jpg", banner: "../media/thumbs/new-vid-oct-2026/Lila Brooks/Lila Brooks 01.jpg", introVideoId: 6951 },
  { id: "ps-noa-quinn", name: "Noa Quinn", handle: "@noaquinn", slug: "noa-quinn", subs: 3200, bio: "Beach AI pornstar — blonde braids, black bikini, one face.", tags: ["Noa Quinn","Pornstar","Blonde","Babe","AI","Solo"], categories: ["Blonde","AI Generated","Babe"], avatar: "../media/thumbs/new-vid-oct-2026/Noa Quinn/Noa Quinn 01.jpg", banner: "../media/thumbs/new-vid-oct-2026/Noa Quinn/Noa Quinn 01.jpg", introVideoId: 6955 },
  { id: "ps-flight-line", name: "Flight Line", handle: "@flightline", slug: "flight-line", subs: 5100, bio: "Two-woman AI pack — flight-line uniforms, the same pair across the October clips.", tags: ["Flight Line","Pornstar","Lesbian","Babe","AI"], categories: ["Lesbian","AI Generated","Babe"], avatar: "../media/thumbs/new-vid-oct-2026/Flight Line/Flight Line 01.jpg", banner: "../media/thumbs/new-vid-oct-2026/Flight Line/Flight Line 01.jpg", introVideoId: 6959 },
  { id: "ps-rooftop-duo", name: "Rooftop Duo", handle: "@rooftopduo", slug: "rooftop-duo", subs: 4800, bio: "Two-woman AI pack — matching faces, desert rooftop, one pair.", tags: ["Rooftop Duo","Pornstar","Lesbian","Babe","AI"], categories: ["Lesbian","AI Generated","Babe"], avatar: "../media/thumbs/new-vid-oct-2026/Rooftop Duo/Rooftop Duo 01.jpg", banner: "../media/thumbs/new-vid-oct-2026/Rooftop Duo/Rooftop Duo 01.jpg", introVideoId: 6968 },
  { id: "ps-october-mix", name: "October Mix", handle: "@octobermix", slug: "october-mix", subs: 3000, bio: "October drop — clips that do not share one repeating face, plus the cumshot and lineup compilations.", tags: ["October Mix","Pornstar","AI","Babe","Compilation"], categories: ["AI Generated","Babe"], avatar: "../media/thumbs/new-vid-oct-2026/October Mix/October Mix 01.jpg", banner: "../media/thumbs/new-vid-oct-2026/October Mix/October Mix 01.jpg", introVideoId: 6976 },
  { id: "ps-vixen", name: "Vixen", handle: "@vixen", slug: "vixen", subs: 5400, bio: "Photoreal AI model & pornstar — stunning gaze, seductive curves, and high-detail 4K vertical shorts.", tags: ["Vixen","Pornstar","Babe","AI","Solo"], categories: ["Babe","AI Generated"], avatar: "../media/Vixen/avatar.jpg", banner: "../media/Vixen/banner.jpg", introVideoId: 7114 },
];

function videoCardHtml(v, { eager = false, fetchpriority } = {}) {
  const thumbUrl = v.thumb ? imgUrl(v.thumb) : "";
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

function renderHtmlPage({ title, description, canonical, ogImage, jsonLd, activeNav, bodyContent, extraHead = "" }) {
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
  ${extraHead}
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

    /* Category Hero Header & Guide Banner */
    .cat-hero-wrap {
      margin: 0 0 24px;
      padding: 16px 0 20px;
      border-bottom: 1px solid var(--border);
    }
    .cat-editorial-tag {
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: .08em;
      color: var(--accent);
      margin-bottom: 8px;
    }
    .cat-hero-title {
      font-size: 30px;
      font-weight: 800;
      color: #fff;
      margin: 0 0 10px;
      line-height: 1.25;
    }
    .cat-hero-lead {
      font-size: 15px;
      color: #cbd5e1;
      max-width: 900px;
      line-height: 1.6;
      margin: 0 0 16px;
    }
    .cat-guide-banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      background: radial-gradient(120% 160% at 100% 50%, rgba(229,9,20,0.15), rgba(20,20,20,0.95) 75%);
      border: 1px solid rgba(229,9,20,0.35);
      border-radius: 12px;
      padding: 14px 18px;
      margin-top: 14px;
      flex-wrap: wrap;
    }
    .cat-guide-text {
      font-size: 13.5px;
      color: #e2e8f0;
      line-height: 1.5;
    }
    .cat-guide-text strong {
      color: #fff;
    }
    .cat-guide-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: var(--accent);
      color: #fff;
      font-size: 12.5px;
      font-weight: 700;
      padding: 7px 16px;
      border-radius: 999px;
      text-decoration: none;
      transition: background 0.15s, transform 0.15s;
      flex: none;
    }
    .cat-guide-btn:hover {
      background: var(--accent2);
      transform: translateY(-1px);
    }
    /* Category Editorial Deep Dive */
    .cat-editorial-deep {
      margin: 48px 0 32px;
      padding: 28px;
      border-radius: 16px;
      background: var(--surface);
      border: 1px solid var(--border);
    }
    .cat-editorial-deep h2 {
      font-size: 22px;
      font-weight: 800;
      color: #fff;
      margin: 0 0 14px;
    }
    .cat-editorial-deep p {
      font-size: 14.5px;
      line-height: 1.65;
      color: #cbd5e1;
      margin: 0 0 14px;
    }
    .cat-editorial-deep p:last-child {
      margin-bottom: 0;
    }
    /* Category FAQ Accordion */
    .cat-faq-section {
      margin: 36px 0;
    }
    .cat-faq-section h2 {
      font-size: 22px;
      font-weight: 800;
      color: #fff;
      margin: 0 0 16px;
    }
    .cat-faq-item {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      margin-bottom: 12px;
      overflow: hidden;
      transition: border-color 0.15s;
    }
    .cat-faq-item[open] {
      border-color: rgba(229,9,20,0.4);
    }
    .cat-faq-item summary {
      padding: 16px 20px;
      font-size: 15px;
      font-weight: 700;
      color: #fff;
      cursor: pointer;
      user-select: none;
    }
    .cat-faq-item p {
      padding: 0 20px 18px;
      margin: 0;
      font-size: 14px;
      line-height: 1.6;
      color: #94a3b8;
    }

    /* Category Pagination */
    .pagination-bar {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin: 40px 0 24px;
      flex-wrap: wrap;
    }
    .page-nav-btn {
      display: inline-flex;
      align-items: center;
      padding: 9px 18px;
      border-radius: 8px;
      background: var(--surface);
      border: 1px solid var(--border);
      color: #fff;
      font-size: 13.5px;
      font-weight: 600;
      text-decoration: none;
      transition: all 0.15s;
    }
    .page-nav-btn:hover:not(.disabled) {
      border-color: var(--accent);
      background: rgba(229,9,20,0.12);
    }
    .page-nav-btn.disabled {
      opacity: 0.35;
      cursor: not-allowed;
      pointer-events: none;
    }
    .page-numbers {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .page-num {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 36px;
      height: 36px;
      padding: 0 6px;
      border-radius: 8px;
      background: var(--surface);
      border: 1px solid var(--border);
      color: #cbd5e1;
      font-size: 13.5px;
      font-weight: 600;
      text-decoration: none;
      transition: all 0.15s;
    }
    .page-num:hover {
      border-color: rgba(255,255,255,0.4);
      color: #fff;
    }
    .page-num.active {
      background: var(--accent);
      border-color: var(--accent);
      color: #fff;
      font-weight: 700;
    }
    .page-ellipsis {
      color: #64748b;
      padding: 0 4px;
      font-weight: 700;
    }

    /* Video Prompt Box */
    .video-prompt-box {
      margin: 24px 0 28px;
      padding: 18px 22px;
      background: rgba(18, 18, 24, 0.95);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-left: 4px solid var(--accent);
      border-radius: 12px;
    }
    .prompt-box-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
      flex-wrap: wrap;
      gap: 8px;
    }
    .prompt-box-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 15px;
      font-weight: 700;
      color: #fff;
    }
    .prompt-badge {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      color: var(--accent);
      background: rgba(229, 9, 20, 0.12);
      padding: 2px 8px;
      border-radius: 6px;
      border: 1px solid rgba(229, 9, 20, 0.3);
    }
    .prompt-box-sub {
      font-size: 13px;
      color: var(--muted);
      margin: 0 0 10px;
    }
    .prompt-box-code-wrap {
      position: relative;
      background: #0a0a0e;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 8px;
      padding: 12px 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
    }
    .prompt-box-code {
      margin: 0;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 12.5px;
      line-height: 1.5;
      color: #e2e8f0;
      white-space: pre-wrap;
      word-break: break-word;
      flex: 1;
    }
    .prompt-copy-btn {
      background: rgba(255, 255, 255, 0.1);
      color: #fff;
      border: 1px solid rgba(255, 255, 255, 0.18);
      font-size: 12px;
      font-weight: 700;
      padding: 8px 14px;
      border-radius: 8px;
      cursor: pointer;
      flex: none;
      transition: all 0.15s ease;
    }
    .prompt-copy-btn:hover {
      background: var(--accent);
      border-color: var(--accent);
    }
    .prompt-box-footer {
      margin-top: 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 10px;
    }
    .prompt-footer-hint {
      font-size: 12.5px;
      color: #94a3b8;
    }
    .prompt-generate-btn {
      display: inline-flex;
      align-items: center;
      background: var(--accent);
      color: #fff;
      text-decoration: none;
      font-size: 12.5px;
      font-weight: 700;
      padding: 6px 16px;
      border-radius: 999px;
      transition: transform 0.15s ease;
    }
    .prompt-generate-btn:hover {
      transform: translateY(-1px);
    }

    /* Sticky Viewport Affiliate CTA Bar */
    .video-sticky-bar {
      position: fixed;
      bottom: 16px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 9999;
      width: calc(100% - 32px);
      max-width: 720px;
      background: rgba(15, 15, 20, 0.94);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      border: 1px solid rgba(229, 9, 20, 0.4);
      box-shadow: 0 10px 32px rgba(0, 0, 0, 0.6), 0 0 18px rgba(229, 9, 20, 0.18);
      border-radius: 999px;
      padding: 8px 14px 8px 18px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      animation: slideUpSticky 0.35s ease-out;
    }
    @keyframes slideUpSticky {
      from { transform: translate(-50%, 40px); opacity: 0; }
      to { transform: translate(-50%, 0); opacity: 1; }
    }
    .sticky-bar-content {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }
    .sticky-bar-pill {
      background: var(--accent);
      color: #fff;
      font-size: 10px;
      font-weight: 800;
      padding: 3px 8px;
      border-radius: 999px;
      letter-spacing: 0.04em;
      flex: none;
    }
    .sticky-bar-text {
      font-size: 13px;
      color: #f1f5f9;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .sticky-bar-text strong {
      color: #fff;
    }
    .sticky-bar-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: none;
    }
    .sticky-bar-cta {
      background: var(--accent);
      color: #fff;
      font-size: 12.5px;
      font-weight: 700;
      padding: 6px 16px;
      border-radius: 999px;
      text-decoration: none;
      box-shadow: 0 2px 10px rgba(229, 9, 20, 0.4);
      transition: transform 0.15s ease;
    }
    .sticky-bar-cta:hover {
      transform: scale(1.04);
    }
    .sticky-bar-close {
      background: transparent;
      border: none;
      color: #94a3b8;
      font-size: 16px;
      cursor: pointer;
      padding: 4px 6px;
      line-height: 1;
      transition: color 0.15s;
    }
    .sticky-bar-close:hover {
      color: #fff;
    }

    /* Channel Profile Hero & Hub */
    .channel-hero-card {
      display: flex;
      align-items: center;
      gap: 24px;
      padding: 24px 28px;
      background: rgba(20, 20, 26, 0.8);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 16px;
      margin-bottom: 28px;
      flex-wrap: wrap;
    }
    .channel-avatar-circle {
      width: 76px;
      height: 76px;
      border-radius: 50%;
      background: radial-gradient(circle, #e50914, #8b0000);
      color: #fff;
      font-size: 28px;
      font-weight: 800;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 20px rgba(229, 9, 20, 0.3);
      flex: none;
    }
    .channel-info-col { flex: 1; min-width: 240px; }
    .channel-title-row { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
    .channel-verified-badge {
      background: rgba(34, 197, 94, 0.15);
      color: #4ade80;
      font-size: 11px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 999px;
      border: 1px solid rgba(34, 197, 94, 0.3);
    }
    .channel-stats-row {
      display: flex;
      gap: 16px;
      font-size: 13px;
      color: #94a3b8;
      margin-bottom: 8px;
    }
    .channel-stats-row strong { color: #f1f5f9; }

    /* Tags Hub Grid */
    .tags-hub-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 14px;
      margin-top: 24px;
    }
    .tag-hub-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 18px;
      background: rgba(20, 20, 26, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      text-decoration: none;
      color: #f1f5f9;
      font-weight: 600;
      font-size: 14px;
      transition: all 0.15s ease;
    }
    .tag-hub-card:hover {
      background: rgba(229, 9, 20, 0.1);
      border-color: rgba(229, 9, 20, 0.4);
      color: #fff;
      transform: translateY(-2px);
    }
    .tag-count-pill {
      font-size: 11px;
      background: rgba(255, 255, 255, 0.08);
      color: #94a3b8;
      padding: 3px 8px;
      border-radius: 999px;
    }

    @media(max-width: 768px) {
      .site-nav { display: none; }
      .page-hero h1 { font-size: 26px; }
      .cat-hero-title { font-size: 24px; }
      .cat-editorial-deep { padding: 20px; }
      .cat-guide-banner { flex-direction: column; align-items: flex-start; }
      .cat-guide-btn { width: 100%; justify-content: center; }
      .v-grid { grid-template-columns: 1fr; }
      .video-affiliate-box { flex-direction: column; align-items: flex-start; }
      .aff-cta-btn { width: 100%; justify-content: center; }
      .video-sticky-bar { bottom: 8px; width: calc(100% - 16px); padding: 8px 12px; border-radius: 12px; }
      .sticky-bar-pill { display: none; }
      .sticky-bar-text { font-size: 12px; }
      .prompt-box-code-wrap { flex-direction: column; align-items: stretch; }
      .prompt-copy-btn { width: 100%; text-align: center; }
      .channel-hero-card { flex-direction: column; align-items: flex-start; }
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
    const bannerUrl = imgUrl(ps.banner);
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
    <h1 class="row-heading">AI Pornstars Directory</h1>
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
          "image": imgUrl(ps.avatar),
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
    const guideSlug = ps.blogSlug || `${ps.slug}-ai-pornstar`;
    const title = `${ps.name} AI Pornstar — 4K Videos & Shorts | thebestpornai`;
    const description = `${ps.bio} Watch full HD & 4K video scenes and mobile vertical Shorts starring ${ps.name}.`;
    const canonical = `${ORIGIN}/pornstars/${ps.slug}.html`;
    const avatarUrl = imgUrl(ps.avatar);
    const bannerUrl = imgUrl(ps.banner);

    // Find videos for this creator
    const creatorVideos = VIDEOS.filter((v) =>
      v.creator === ps.id || (v.tags && v.tags.includes(ps.name))
    ).slice(0, 36);

    const videoCards = creatorVideos.map((v, i) => videoCardHtml(v, { eager: i < 4, fetchpriority: i === 0 ? "high" : undefined })).join("\n");

    const bodyContent = `
      <header class="ps-profile-hero" style="margin-bottom: 24px;">
        <h1 class="row-heading" style="font-size:26px;font-weight:800;color:#fff;margin:0 0 8px;">${esc(ps.name)} — AI Pornstar</h1>
        <p class="sub" style="font-size:14.5px;color:#cbd5e1;line-height:1.5;margin:0 0 12px;">${esc(ps.bio)}</p>
        <p class="sub"><a href="/blog/${guideSlug}.html" style="color:var(--accent);font-weight:600;">Explore the ${esc(ps.name)} AI Pornstar Guide &amp; Face Pack &rarr;</a></p>
      </header>
      <h2 class="sub" style="font-size:16px;font-weight:700;color:#fff;margin:24px 0 14px;">4K Scenes &amp; Shorts Starring ${esc(ps.name)}</h2>
      <div class="v-grid">
        ${videoCards.length ? videoCards : '<p class="sub">More videos coming soon.</p>'}
      </div>`;

    const jsonLd = {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "ProfilePage",
          "@id": `${canonical}#webpage`,
          "url": canonical,
          "name": `${ps.name} AI Pornstar Profile & Videos`,
          "isPartOf": {
            "@type": "WebSite",
            "name": "thebestpornai",
            "url": `${ORIGIN}/`
          },
          "mainEntity": {
            "@type": "Person",
            "name": ps.name,
            "url": canonical,
            "image": avatarUrl,
            "description": ps.bio,
            "sameAs": [
              `${ORIGIN}/blog/${guideSlug}.html`
            ].filter(Boolean)
          }
        },
        {
          "@type": "BreadcrumbList",
          "itemListElement": [
            { "@type": "ListItem", "position": 1, "name": "Home", "item": `${ORIGIN}/` },
            { "@type": "ListItem", "position": 2, "name": "AI Pornstars", "item": `${ORIGIN}/pornstars/` },
            { "@type": "ListItem", "position": 3, "name": ps.name, "item": canonical }
          ]
        }
      ]
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
  const description = "Explore 16 curated adult AI genres: Blonde, Latina, Big Ass, MILF, POV, Blowjob, Lesbian, and more in stunning 4K streaming quality.";
  const canonical = `${ORIGIN}/categories/`;

  const cardsHtml = TOP_CATEGORIES.map((cat) => {
    const slug = cat.slug || slugify(cat.name);
    const matches = VIDEOS.filter((v) =>
      (v.category && v.category.toLowerCase() === cat.name.toLowerCase()) ||
      (v.categories && v.categories.some((c) => c.toLowerCase() === cat.name.toLowerCase()))
    );
    const thumb = matches.find((v) => v.thumb)?.thumb;
    const thumbUrl = thumb ? imgUrl(thumb) : "";
    return `
      <a class="card" href="/categories/${slug}.html">
        <div class="video-thumb">
          ${thumbUrl ? `<img class="thumb-video" src="${thumbUrl}" alt="${esc(cat.name)} AI Porn" width="320" height="180" loading="lazy" decoding="async"/>` : ""}
          <span class="quality-badge">4K</span>
        </div>
        <div class="card-text">
          <h2 class="title" style="font-size:15px;margin:0 0 4px;font-weight:700">${esc(cat.name)}</h2>
          <div class="card-meta" style="font-size:12px;color:rgba(255,255,255,0.6)">${matches.length} videos · 4K UHD</div>
        </div>
      </a>`;
  }).join("\n");

  const chips = TOP_CATEGORIES.map((cat) => {
    const slug = cat.slug || slugify(cat.name);
    return `<a class="filter-pill" href="/categories/${slug}.html">${esc(cat.name)}</a>`;
  }).join("");

  const bodyContent = `
    <div class="cat-hero-wrap">
      <div class="cat-editorial-tag">4K Streaming Directory</div>
      <h1 class="cat-hero-title">AI Adult Video Categories</h1>
      <p class="cat-hero-lead">Explore 16 curated adult AI genres in crisp 4K Ultra HD. From photorealistic blonde and Latina models to immersive first-person POV, hypnotic PAWG curves, and authentic amateur bedroom encounters.</p>
    </div>
    <div class="home-chips-strip">${chips}</div>
    <div class="v-grid" style="margin-top:24px">${cardsHtml}</div>`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Home", "item": `${ORIGIN}/` },
          { "@type": "ListItem", "position": 2, "name": "Categories", "item": canonical }
        ]
      },
      {
        "@type": "CollectionPage",
        "@id": `${canonical}#page`,
        "name": "AI Adult Video Categories",
        "description": description,
        "url": canonical,
        "mainEntity": {
          "@type": "ItemList",
          "itemListElement": TOP_CATEGORIES.map((cat, i) => ({
            "@type": "ListItem",
            "position": i + 1,
            "name": cat.name,
            "url": `${ORIGIN}/categories/${cat.slug || slugify(cat.name)}.html`
          }))
        }
      }
    ]
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

function paginationNavHtml(slug, pageNum, totalPages, baseDir = "categories") {
  if (totalPages <= 1) return "";
  const prevHref = pageNum === 2 ? `/${baseDir}/${slug}.html` : `/${baseDir}/${slug}-page-${pageNum - 1}.html`;
  const nextHref = `/${baseDir}/${slug}-page-${pageNum + 1}.html`;

  const pages = [];
  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || (p >= pageNum - 2 && p <= pageNum + 2)) {
      pages.push(p);
    } else if (pages[pages.length - 1] !== "...") {
      pages.push("...");
    }
  }

  return `
    <nav class="pagination-bar" aria-label="Pagination">
      ${pageNum > 1 ? `<a class="page-nav-btn" href="${prevHref}" rel="prev">← Previous</a>` : `<span class="page-nav-btn disabled">← Previous</span>`}
      <div class="page-numbers">
        ${pages.map(p => {
          if (p === "...") return `<span class="page-ellipsis">…</span>`;
          const href = p === 1 ? `/${baseDir}/${slug}.html` : `/${baseDir}/${slug}-page-${p}.html`;
          const isCur = p === pageNum;
          return `<a class="page-num${isCur ? ' active' : ''}" href="${href}"${isCur ? ' aria-current="page"' : ''}>${p}</a>`;
        }).join("")}
      </div>
      ${pageNum < totalPages ? `<a class="page-nav-btn" href="${nextHref}" rel="next">Next →</a>` : `<span class="page-nav-btn disabled">Next →</span>`}
    </nav>`;
}

// 4. Generate /categories/<slug>.html and /categories/<slug>-page-<n>.html
function genCategoryPages() {
  const PAGE_SIZE = 48;
  let totalCategoryPagesWritten = 0;

  for (const cat of TOP_CATEGORIES) {
    const slug = cat.slug || slugify(cat.name);
    const allVideos = VIDEOS.filter((v) =>
      (v.category && v.category.toLowerCase() === cat.name.toLowerCase()) ||
      (v.categories && v.categories.some((c) => c.toLowerCase() === cat.name.toLowerCase()))
    );

    const totalPages = Math.max(1, Math.ceil(allVideos.length / PAGE_SIZE));

    const chips = TOP_CATEGORIES.map((c) => {
      const cSlug = c.slug || slugify(c.name);
      return `<a class="filter-pill${c.name === cat.name ? " active" : ""}" href="/categories/${cSlug}.html">${esc(c.name)}</a>`;
    }).join("");

    const neighborChips = TOP_CATEGORIES.filter((c) => c.name !== cat.name).slice(0, 8).map((c) => {
      const cSlug = c.slug || slugify(c.name);
      return `<a class="filter-pill" href="/categories/${cSlug}.html">${esc(c.name)}</a>`;
    }).join("");

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const isFirst = pageNum === 1;
      const categoryVideos = allVideos.slice((pageNum - 1) * PAGE_SIZE, pageNum * PAGE_SIZE);
      const videoCards = categoryVideos.map((v, i) => videoCardHtml(v, { eager: i < 4 && isFirst, fetchpriority: i === 0 && isFirst ? "high" : undefined })).join("\n");
      const sampleThumb = categoryVideos[0]?.thumb ? imgUrl(categoryVideos[0].thumb) : LOGO;

      const title = isFirst
        ? `${cat.headline || `${cat.name} AI Porn Videos`} | thebestpornai`
        : `${cat.headline || `${cat.name} AI Porn Videos`} — Page ${pageNum} | thebestpornai`;

      const description = isFirst
        ? (cat.desc || `Stream the best ${cat.name} AI porn videos in 4K resolution. Free high-speed streaming on thebestpornai.`)
        : `Stream 4K ${cat.name} AI porn videos (Page ${pageNum} of ${totalPages}). High-definition free streaming on thebestpornai.`;

      const canonical = isFirst
        ? `${ORIGIN}/categories/${slug}.html`
        : `${ORIGIN}/categories/${slug}-page-${pageNum}.html`;

      const prevUrl = pageNum === 2
        ? `${ORIGIN}/categories/${slug}.html`
        : pageNum > 2
        ? `${ORIGIN}/categories/${slug}-page-${pageNum - 1}.html`
        : null;

      const nextUrl = pageNum < totalPages
        ? `${ORIGIN}/categories/${slug}-page-${pageNum + 1}.html`
        : null;

      const extraHead = [
        prevUrl ? `<link rel="prev" href="${prevUrl}"/>` : "",
        nextUrl ? `<link rel="next" href="${nextUrl}"/>` : "",
      ].filter(Boolean).join("\n  ");

      const pagination = paginationNavHtml(slug, pageNum, totalPages);

      const bodyContent = `
        <div class="home-chips-strip" style="margin-bottom:12px">${chips}</div>

        <div class="cat-hero-wrap">
          <div class="cat-editorial-tag">Niche Collection · 4K Ultra HD${totalPages > 1 ? ` · Page ${pageNum} of ${totalPages}` : ""}</div>
          <h1 class="cat-hero-title">${esc(cat.headline || `${cat.name} AI Porn Videos`)}${pageNum > 1 ? ` — Page ${pageNum}` : ""}</h1>
          <p class="cat-hero-lead">${esc(cat.lead || cat.desc)}</p>
          ${cat.guideSlug && isFirst ? `
          <div class="cat-guide-banner">
            <div class="cat-guide-text">
              📖 <strong>2026 Editor's Guide:</strong> Deep dive into top ${esc(cat.name)} AI performers, prompt engineering, and scene curation.
            </div>
            <a class="cat-guide-btn" href="/blog/${esc(cat.guideSlug)}.html">Read Guide →</a>
          </div>` : ""}
        </div>

        <div class="v-grid">
          ${videoCards.length ? videoCards : '<p class="sub">New scenes being generated daily.</p>'}
        </div>

        ${pagination}

        ${isFirst ? `
        <section class="cat-editorial-deep">
          <h2>The 2026 ${esc(cat.name)} AI Video Landscape</h2>
          <p>${esc(cat.editorial1)}</p>
          <p>${esc(cat.editorial2)}</p>
        </section>

        ${cat.faqs && cat.faqs.length ? `
        <section class="cat-faq-section" id="faq">
          <h2>Frequently Asked Questions about ${esc(cat.name)} AI Porn</h2>
          <div class="cat-faq-list">
            ${cat.faqs.map((f, i) => `
            <details class="cat-faq-item"${i === 0 ? " open" : ""}>
              <summary>${esc(f.q)}</summary>
              <p>${esc(f.a)}</p>
            </details>`).join("")}
          </div>
        </section>` : ""}
        ` : ""}

        <div style="margin: 40px 0 16px;">
          <h3 style="font-size:16px;font-weight:700;color:#fff;margin:0 0 12px;">Explore Related Adult AI Niches</h3>
          <div class="home-chips-strip">
            ${neighborChips}
          </div>
        </div>`;

      const graph = [
        {
          "@type": "BreadcrumbList",
          "itemListElement": [
            { "@type": "ListItem", "position": 1, "name": "Home", "item": `${ORIGIN}/` },
            { "@type": "ListItem", "position": 2, "name": "Categories", "item": `${ORIGIN}/categories/` },
            { "@type": "ListItem", "position": 3, "name": isFirst ? cat.name : `${cat.name} (Page ${pageNum})`, "item": canonical }
          ]
        },
        {
          "@type": "CollectionPage",
          "@id": `${canonical}#page`,
          "name": isFirst ? (cat.headline || `${cat.name} AI Porn Videos`) : `${cat.headline || `${cat.name} AI Porn Videos`} — Page ${pageNum}`,
          "description": description,
          "url": canonical,
          "mainEntity": {
            "@type": "ItemList",
            "itemListElement": categoryVideos.slice(0, 16).map((v, i) => ({
              "@type": "ListItem",
              "position": i + 1,
              "url": `${ORIGIN}/video/${v.id}.html`,
              "name": v.title
            }))
          }
        }
      ];

      if (isFirst && cat.faqs && cat.faqs.length) {
        graph.push({
          "@type": "FAQPage",
          "mainEntity": cat.faqs.map((f) => ({
            "@type": "Question",
            "name": f.q,
            "acceptedAnswer": {
              "@type": "Answer",
              "text": f.a
            }
          }))
        });
      }

      const jsonLd = {
        "@context": "https://schema.org",
        "@graph": graph
      };

      const html = renderHtmlPage({
        title,
        description,
        canonical,
        ogImage: sampleThumb,
        jsonLd,
        activeNav: "categories",
        bodyContent,
        extraHead,
      });

      const fileName = isFirst ? `${slug}.html` : `${slug}-page-${pageNum}.html`;
      fs.writeFileSync(path.join(CATEGORIES_DIR, fileName), html);
      totalCategoryPagesWritten++;
    }
    console.log(`✔ categories/${slug} pages generated (${totalPages} page${totalPages > 1 ? "s" : ""})`);
  }
  console.log(`🎉 Total category pagination pages generated: ${totalCategoryPagesWritten}`);
}

// 5. Generate /tags/index.html (Tags Directory Hub)
function genTagsHub() {
  const tagCounts = new Map();
  for (const v of VIDEOS) {
    for (const t of (v.tags || [])) {
      const clean = String(t).trim();
      if (!clean) continue;
      const key = clean.toLowerCase();
      if (!tagCounts.has(key)) {
        tagCounts.set(key, { raw: clean, slug: slugify(clean), count: 0 });
      }
      tagCounts.get(key).count++;
    }
  }

  const tags = [...tagCounts.values()]
    .filter(t => t.count >= 15 && t.slug)
    .sort((a, b) => b.count - a.count);

  const title = "AI Adult Video Tags & Niches Directory | thebestpornai";
  const description = `Explore ${tags.length}+ top AI video tags, niches, and themes on thebestpornai. Browse 4K AI adult scenes by theme with instant streaming.`;
  const canonical = `${ORIGIN}/tags/`;

  const cardsHtml = tags.map(t => `
    <a href="/tags/${t.slug}.html" class="tag-hub-card">
      <span>#${esc(t.raw)}</span>
      <span class="tag-count-pill">${fmtViews(t.count)} videos</span>
    </a>
  `).join("\n");

  const bodyContent = `
    <div class="page-hero" style="margin-bottom:24px;">
      <h1 class="row-heading" style="font-size:28px;font-weight:800;color:#fff;margin:0 0 10px;">AI Video Tags &amp; Niches Directory</h1>
      <p class="sub" style="font-size:15px;color:#cbd5e1;line-height:1.6;max-width:760px;margin:0 0 18px;">
        Discover and browse AI adult video scenes categorized by specialized themes, performer traits, actions, and aesthetic styles. All videos stream in 4K Ultra HD with zero wait times.
      </p>
    </div>
    <div class="tags-hub-grid">
      ${cardsHtml}
    </div>`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${canonical}#webpage`,
        "url": canonical,
        "name": title,
        "description": description,
        "isPartOf": { "@type": "WebSite", "name": "thebestpornai", "url": `${ORIGIN}/` }
      },
      {
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Home", "item": `${ORIGIN}/` },
          { "@type": "ListItem", "position": 2, "name": "Tags", "item": canonical }
        ]
      }
    ]
  };

  const html = renderHtmlPage({
    title,
    description,
    canonical,
    ogImage: LOGO,
    jsonLd,
    activeNav: "tags",
    bodyContent
  });

  fs.writeFileSync(path.join(TAGS_DIR, "index.html"), html);
  console.log(`✔ tags/index.html written with ${tags.length} top tags`);
}

// 6. Generate /tags/<slug>.html and /tags/<slug>-page-<n>.html
function genTagPages() {
  const PAGE_SIZE = 48;
  const tagMap = new Map();

  for (const v of VIDEOS) {
    for (const t of (v.tags || [])) {
      const clean = String(t).trim();
      if (!clean) continue;
      const key = clean.toLowerCase();
      if (!tagMap.has(key)) {
        tagMap.set(key, { raw: clean, slug: slugify(clean), videos: [] });
      }
      tagMap.get(key).videos.push(v);
    }
  }

  const topTags = [...tagMap.values()]
    .filter(t => t.videos.length >= 15 && t.slug)
    .sort((a, b) => b.videos.length - a.videos.length);

  let totalTagPagesWritten = 0;

  for (const item of topTags) {
    const slug = item.slug;
    const allVideos = item.videos;
    const totalPages = Math.max(1, Math.ceil(allVideos.length / PAGE_SIZE));

    // Top 8 neighbor tag pills
    const neighborChips = topTags.filter(o => o.slug !== slug).slice(0, 10).map(o =>
      `<a class="filter-pill" href="/tags/${o.slug}.html">#${esc(o.raw)}</a>`
    ).join("");

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const isFirst = pageNum === 1;
      const tagVideos = allVideos.slice((pageNum - 1) * PAGE_SIZE, pageNum * PAGE_SIZE);
      const videoCards = tagVideos.map((v, i) => videoCardHtml(v, { eager: i < 4 && isFirst, fetchpriority: i === 0 && isFirst ? "high" : undefined })).join("\n");
      const sampleThumb = tagVideos[0]?.thumb ? imgUrl(tagVideos[0].thumb) : LOGO;

      const title = isFirst
        ? `${item.raw} AI Porn Videos — 4K Ultra HD | thebestpornai`
        : `${item.raw} AI Porn Videos — Page ${pageNum} | thebestpornai`;

      const description = isFirst
        ? `Stream top 4K ${item.raw} AI porn videos. Watch free AI generated ${item.raw} adult scenes and vertical clips with instant playback on thebestpornai.`
        : `Stream 4K ${item.raw} AI porn videos (Page ${pageNum} of ${totalPages}). High-definition free streaming on thebestpornai.`;

      const canonical = isFirst
        ? `${ORIGIN}/tags/${slug}.html`
        : `${ORIGIN}/tags/${slug}-page-${pageNum}.html`;

      const prevUrl = pageNum === 2
        ? `${ORIGIN}/tags/${slug}.html`
        : pageNum > 2
        ? `${ORIGIN}/tags/${slug}-page-${pageNum - 1}.html`
        : null;

      const nextUrl = pageNum < totalPages
        ? `${ORIGIN}/tags/${slug}-page-${pageNum + 1}.html`
        : null;

      const extraHead = [
        prevUrl ? `<link rel="prev" href="${prevUrl}"/>` : "",
        nextUrl ? `<link rel="next" href="${nextUrl}"/>` : "",
      ].filter(Boolean).join("\n  ");

      const pagination = paginationNavHtml(slug, pageNum, totalPages, "tags");

      const bodyContent = `
        <div class="home-chips-strip" style="margin-bottom:12px">${neighborChips}</div>

        <div class="cat-hero-wrap">
          <div class="cat-editorial-tag">AI Tag Collection · 4K Ultra HD${totalPages > 1 ? ` · Page ${pageNum} of ${totalPages}` : ""}</div>
          <h1 class="cat-hero-title">${esc(item.raw)} AI Porn Videos${pageNum > 1 ? ` — Page ${pageNum}` : ""}</h1>
          <p class="cat-hero-lead">Explore high-fidelity 4K AI adult scenes tagged with <strong>#${esc(item.raw)}</strong>. Featuring uncensored photorealistic models, diffusion video motion, and instant streaming.</p>
        </div>

        <div class="v-grid">
          ${videoCards.length ? videoCards : '<p class="sub">New scenes being generated daily.</p>'}
        </div>

        ${pagination}

        <section class="cat-editorial-deep" style="margin-top:40px;">
          <h2 style="font-size:20px;font-weight:800;color:#fff;margin:0 0 14px;">About AI ${esc(item.raw)} Video Generation</h2>
          <p style="font-size:14px;color:#cbd5e1;line-height:1.65;margin:0 0 14px;">
            Generative diffusion models in 2026 allow unprecedented temporal consistency and hyper-realistic detail. Whether you are looking for ultra-HD 60fps motion, custom camera angles, or persistent character roleplay, platforms like <strong>OurDream</strong> lead the industry in render quality, prompt compliance, and user privacy.
          </p>
          <div class="video-affiliate-box" style="margin-top:20px;">
            <div class="aff-left">
              <div class="aff-badge-row">
                <span class="aff-badge-pill">⚡ AI Video Generator</span>
                <span class="aff-partner">OurDream.ai</span>
              </div>
              <h2 class="aff-title">Create Custom ${esc(item.raw)} AI Videos</h2>
              <p class="aff-desc">Render your own custom scenes and models with zero prompt restrictions on OurDream.</p>
            </div>
            <a href="${ourdreamUrl("create", "tag-" + slug)}" target="_blank" rel="${OURDREAM_REL}" class="aff-cta-btn">
              <span>Try OurDream Free →</span>
            </a>
          </div>
        </section>`;

      const jsonLd = {
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "CollectionPage",
            "@id": `${canonical}#webpage`,
            "url": canonical,
            "name": title,
            "description": description,
            "isPartOf": { "@type": "WebSite", "name": "thebestpornai", "url": `${ORIGIN}/` }
          },
          {
            "@type": "BreadcrumbList",
            "itemListElement": [
              { "@type": "ListItem", "position": 1, "name": "Home", "item": `${ORIGIN}/` },
              { "@type": "ListItem", "position": 2, "name": "Tags", "item": `${ORIGIN}/tags/` },
              { "@type": "ListItem", "position": 3, "name": item.raw, "item": canonical }
            ]
          },
          {
            "@type": "ItemList",
            "name": `${item.raw} AI Videos`,
            "itemListElement": tagVideos.map((v, idx) => ({
              "@type": "ListItem",
              "position": (pageNum - 1) * PAGE_SIZE + idx + 1,
              "url": `${ORIGIN}/video/${v.id}.html`,
              "name": v.title
            }))
          }
        ]
      };

      const html = renderHtmlPage({
        title,
        description,
        canonical,
        ogImage: sampleThumb,
        jsonLd,
        activeNav: "tags",
        bodyContent,
        extraHead,
      });

      const fileName = isFirst ? `${slug}.html` : `${slug}-page-${pageNum}.html`;
      fs.writeFileSync(path.join(TAGS_DIR, fileName), html);
      totalTagPagesWritten++;
    }
  }
  console.log(`🎉 Total tag pagination pages generated: ${totalTagPagesWritten} across ${topTags.length} tags`);
}

// 7. Generate /channels/index.html (Creators Directory Hub)
function genChannelsHub() {
  const creators = (DATA.creators || []).filter(c => {
    const vids = VIDEOS.filter(v => v.creator === c.id);
    return vids.length > 0;
  }).sort((a, b) => (b.subs || 0) - (a.subs || 0));

  const title = "Top AI Creators & Studios Directory | thebestpornai";
  const description = `Discover ${creators.length} verified AI adult creators, performers, and production studios on thebestpornai. Stream exclusive 4K scenes and vertical shorts.`;
  const canonical = `${ORIGIN}/channels/`;

  const cardsHtml = creators.map(c => {
    const slug = slugify(c.name);
    const vids = VIDEOS.filter(v => v.creator === c.id);
    return `
      <div class="channel-hero-card" style="margin-bottom:16px;">
        <div class="channel-avatar-circle">${esc((c.name || "?")[0])}</div>
        <div class="channel-info-col">
          <div class="channel-title-row">
            <h2 style="margin:0;font-size:18px;font-weight:700;"><a href="/channels/${slug}.html" style="color:#fff;text-decoration:none;">${esc(c.name)}</a></h2>
            <span class="channel-verified-badge">✓ Verified Studio</span>
          </div>
          <div class="channel-stats-row">
            <span><strong>${vids.length}</strong> videos</span>
            <span>•</span>
            <span><strong>${fmtViews(c.subs || 12000)}</strong> subscribers</span>
          </div>
          <p style="margin:0;font-size:13.5px;color:#cbd5e1;line-height:1.5;">${esc(c.bio || `Official AI content channel by ${c.name}. Free 4K streams and shorts.`)}</p>
        </div>
        <a href="/channels/${slug}.html" class="btn-primary" style="flex:none;text-decoration:none;">View Channel →</a>
      </div>
    `;
  }).join("\n");

  const bodyContent = `
    <div class="page-hero" style="margin-bottom:24px;">
      <h1 class="row-heading" style="font-size:28px;font-weight:800;color:#fff;margin:0 0 10px;">AI Creators &amp; Studios Directory</h1>
      <p class="sub" style="font-size:15px;color:#cbd5e1;line-height:1.6;max-width:760px;margin:0 0 18px;">
        Browse channels from leading AI model creators, diffusion artists, and studio collectives. Subscribe, explore scene catalogs, and stream in 4K resolution.
      </p>
    </div>
    <div class="channels-list">
      ${cardsHtml}
    </div>`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${canonical}#webpage`,
        "url": canonical,
        "name": title,
        "description": description,
        "isPartOf": { "@type": "WebSite", "name": "thebestpornai", "url": `${ORIGIN}/` }
      },
      {
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Home", "item": `${ORIGIN}/` },
          { "@type": "ListItem", "position": 2, "name": "Channels", "item": canonical }
        ]
      }
    ]
  };

  const html = renderHtmlPage({
    title,
    description,
    canonical,
    ogImage: LOGO,
    jsonLd,
    activeNav: "home",
    bodyContent
  });

  fs.writeFileSync(path.join(CHANNELS_DIR, "index.html"), html);
  console.log(`✔ channels/index.html written with ${creators.length} creators`);
}

// 8. Generate /channels/<slug>.html
function genChannelPages() {
  const creators = (DATA.creators || []).filter(c => {
    const vids = VIDEOS.filter(v => v.creator === c.id);
    return vids.length > 0;
  });

  let totalChannelPagesWritten = 0;

  for (const c of creators) {
    const slug = slugify(c.name);
    const allVideos = VIDEOS.filter(v => v.creator === c.id);
    const sampleThumb = allVideos[0]?.thumb ? imgUrl(allVideos[0].thumb) : LOGO;
    const title = `${c.name} — AI Creator Channel & 4K Videos | thebestpornai`;
    const description = `Watch official 4K AI adult videos created by ${c.name}. Stream ${allVideos.length} high-definition scenes, shorts, and exclusive releases on thebestpornai.`;
    const canonical = `${ORIGIN}/channels/${slug}.html`;

    const videoCards = allVideos.slice(0, 48).map((v, i) => videoCardHtml(v, { eager: i < 4, fetchpriority: i === 0 ? "high" : undefined })).join("\n");

    const bodyContent = `
      <div class="channel-hero-card">
        <div class="channel-avatar-circle">${esc((c.name || "?")[0])}</div>
        <div class="channel-info-col">
          <div class="channel-title-row">
            <h1 style="margin:0;font-size:24px;font-weight:800;color:#fff;">${esc(c.name)}</h1>
            <span class="channel-verified-badge">✓ Verified Studio</span>
          </div>
          <div class="channel-stats-row">
            <span><strong>${allVideos.length}</strong> 4K videos</span>
            <span>•</span>
            <span><strong>${fmtViews(c.subs || 12000)}</strong> subscribers</span>
          </div>
          <p style="margin:0;font-size:14px;color:#cbd5e1;line-height:1.5;">${esc(c.bio || `Official studio channel for ${c.name}. Curated 4K diffusion videos, ultra-HD scenes, and mobile shorts.`)}</p>
        </div>
      </div>

      <div class="v-grid">
        ${videoCards.length ? videoCards : '<p class="sub">New videos coming soon.</p>'}
      </div>`;

    const jsonLd = {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "ProfilePage",
          "@id": `${canonical}#webpage`,
          "url": canonical,
          "name": title,
          "description": description,
          "isPartOf": { "@type": "WebSite", "name": "thebestpornai", "url": `${ORIGIN}/` },
          "mainEntity": {
            "@type": "Organization",
            "name": c.name,
            "url": canonical,
            "description": c.bio || `Official AI content channel by ${c.name}`
          }
        },
        {
          "@type": "BreadcrumbList",
          "itemListElement": [
            { "@type": "ListItem", "position": 1, "name": "Home", "item": `${ORIGIN}/` },
            { "@type": "ListItem", "position": 2, "name": "Channels", "item": `${ORIGIN}/channels/` },
            { "@type": "ListItem", "position": 3, "name": c.name, "item": canonical }
          ]
        }
      ]
    };

    const html = renderHtmlPage({
      title,
      description,
      canonical,
      ogImage: sampleThumb,
      jsonLd,
      activeNav: "home",
      bodyContent
    });

    fs.writeFileSync(path.join(CHANNELS_DIR, `${slug}.html`), html);
    totalChannelPagesWritten++;
  }
  console.log(`🎉 Total channel pages generated: ${totalChannelPagesWritten}`);
}

// 9. Generate /video/<id>.html for top curated & popular scenes with rich Schema VideoObject, Prompt Copy Box, and OurDream.ai affiliate conversion
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
    const thumbUrl = v.thumb ? imgUrl(v.thumb) : LOGO;
    const seoThumb = v.thumb ? imgUrl(v.thumb) : LOGO;
    const catSlug = slugify(v.category || "ai");

    // Related 12 videos in same category or overall
    const related = VIDEOS.filter(other => other.id !== v.id && (other.category === v.category || !v.category)).slice(0, 12);
    const relatedCards = related.map((r) => videoCardHtml(r, { eager: false })).join("\n");

    const catMeta = TOP_CATEGORIES.find(c => c.name.toLowerCase() === (v.category || "").toLowerCase());
    const guideSlug = catMeta?.guideSlug;
    const guideBannerHtml = guideSlug ? `
      <div class="video-guide-banner" style="margin:24px 0 32px;padding:16px 20px;border-radius:12px;background:radial-gradient(120% 160% at 100% 50%, rgba(229,9,20,0.12), rgba(20,20,20,0.95) 75%);border:1px solid rgba(229,9,20,0.3);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
        <div style="font-size:14px;color:#cbd5e1;line-height:1.5">
          📖 <strong>2026 Editorial Guide:</strong> Explore top performers, prompts &amp; scene curation in our <a href="/blog/${esc(guideSlug)}.html" style="color:var(--accent);font-weight:700">Best AI ${esc(v.category)} Scenes in 2026 Guide →</a>
        </div>
        <a href="/blog/${esc(guideSlug)}.html" style="color:#fff;font-size:12.5px;font-weight:700;text-decoration:none;padding:7px 16px;background:var(--accent);border-radius:999px;flex:none">Read Guide →</a>
      </div>` : "";

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
            ${(v.tags || []).slice(0, 8).map(t => `<a class="tag-chip" href="/tags/${slugify(t)}.html">#${esc(t)}</a>`).join("")}
          </div>
        </div>

        <div class="video-prompt-box">
          <div class="prompt-box-header">
            <div class="prompt-box-title">
              <span>✨</span>
              <span>AI Generation Prompt &amp; Parameters</span>
            </div>
            <span class="prompt-badge">Diffusion Model 2026</span>
          </div>
          <p class="prompt-box-sub">Recreate or customize this scene with the exact positive diffusion prompt:</p>
          <div class="prompt-box-code-wrap">
            <pre class="prompt-box-code" id="promptText_${v.id}">(masterpiece, 8K UHD, photorealistic:1.3), 1girl, cinematic lighting, ${esc(v.title)}, flawless skin texture, shallow depth of field, 60fps video diffusion, trending on OurDream</pre>
            <button type="button" class="prompt-copy-btn" onclick="navigator.clipboard.writeText(document.getElementById('promptText_${v.id}').innerText).then(() => { this.innerText = '✓ Copied!'; setTimeout(() => this.innerText = '📋 Copy Prompt', 2500); })">📋 Copy Prompt</button>
          </div>
          <div class="prompt-box-footer">
            <span class="prompt-footer-hint">Ready to render in 4K? Send this prompt straight to OurDream:</span>
            <a href="${ourdreamUrl("create", "video-prompt")}" target="_blank" rel="${OURDREAM_REL}" class="prompt-generate-btn">
              <span>🚀 Generate on OurDream.ai →</span>
            </a>
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

        ${guideBannerHtml}

        <div style="margin-top:40px">
          <h2 style="font-size:18px;font-weight:700;margin-bottom:20px;color:#fff">Related 4K Scenes</h2>
          <div class="v-grid">
            ${relatedCards}
          </div>
        </div>

        <div class="video-sticky-bar" id="videoStickyBar">
          <div class="sticky-bar-content">
            <span class="sticky-bar-pill">⚡ AI GENERATOR</span>
            <span class="sticky-bar-text">Create uncensored 4K adult videos like this in seconds on <strong>OurDream</strong></span>
          </div>
          <div class="sticky-bar-actions">
            <a href="${ourdreamUrl("create", "watch-sticky")}" target="_blank" rel="${OURDREAM_REL}" class="sticky-bar-cta">
              <span>Try Free →</span>
            </a>
            <button type="button" class="sticky-bar-close" onclick="document.getElementById('videoStickyBar').remove(); sessionStorage.setItem('dismiss_sticky_cta', '1');" aria-label="Close notification">✕</button>
          </div>
        </div>
        <script>
          if (sessionStorage.getItem('dismiss_sticky_cta') === '1') {
            var bar = document.getElementById('videoStickyBar');
            if (bar) bar.remove();
          }
        </script>
      </main>`;

    const mediaStreamUrl = v.src ? mediaUrl(v.src) : null;
    const jsonLd = {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "VideoObject",
          "name": v.title,
          "description": description,
          "thumbnailUrl": [seoThumb],
          "uploadDate": isoUploadDate(v.uploaded),
          "duration": isoDuration(v.duration),
          "url": canonical,
          ...(mediaStreamUrl ? { "contentUrl": mediaStreamUrl } : {}),
          "isFamilyFriendly": false,
          "requiresSubscription": false,
          "interactionStatistic": {
            "@type": "InteractionCounter",
            "interactionType": { "@type": "WatchAction" },
            "userInteractionCount": v.views || 2500
          }
        },
        {
          "@type": "BreadcrumbList",
          "itemListElement": [
            { "@type": "ListItem", "position": 1, "name": "Home", "item": `${ORIGIN}/` },
            { "@type": "ListItem", "position": 2, "name": v.category || "AI", "item": `${ORIGIN}/categories/${catSlug}.html` },
            { "@type": "ListItem", "position": 3, "name": v.title, "item": canonical }
          ]
        }
      ]
    };

    const html = renderHtmlPage({
      title,
      description,
      canonical,
      ogImage: seoThumb,
      jsonLd,
      activeNav: "home",
      bodyContent,
    });

    fs.writeFileSync(path.join(VIDEO_DIR, `${v.id}.html`), html);
  }
  console.log(`✔ Generated ${prioritized.length} static video pages in video/`);
}

// 6. Prerender static skeleton into index.html for search crawlers & initial paint
function prerenderHomepageSkeleton() {
  const indexPath = path.join(REPO, "index.html");
  if (!fs.existsSync(indexPath)) return;
  let html = fs.readFileSync(indexPath, "utf8");

  // Pick top 8 featured videos with working media/thumbs, prioritizing prominent scenes
  const targetIds = [5962, 5169, 63, 270, 405, 28, 404, 5170];
  const featured = [];
  for (const tid of targetIds) {
    const v = VIDEOS.find(x => x.id === tid);
    if (v) featured.push(v);
  }
  if (featured.length < 8) {
    const fallback = VIDEOS.filter(v => v.src && v.thumb && !v.flagged && v.status !== "private" && v.status !== "pending");
    for (const fb of fallback) {
      if (!featured.some(f => f.id === fb.id)) featured.push(fb);
      if (featured.length >= 8) break;
    }
  }

  const featuredCards = featured.map((v, i) => {
    const thumbUrl = v.thumb ? imgUrl(v.thumb) : LOGO;
    const dur = v.duration ? esc(v.duration) : "";
    const views = fmtViews(v.views || 1200);
    const loadingAttr = i < 2 ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"';
    return `        <article class="card">
          <a href="/video/${v.id}.html" title="${esc(v.title)}" style="text-decoration:none;color:inherit;display:block">
            <div class="video-thumb">
              <img class="thumb-video" src="${thumbUrl}" alt="${esc(v.title)}" width="320" height="180" ${loadingAttr} decoding="async"/>
              <span class="quality-badge" style="position:absolute;top:8px;left:8px;background:rgba(0,0,0,0.7);color:#fff;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px">4K</span>
              ${dur ? `<span class="dur-badge" style="position:absolute;bottom:8px;right:8px;background:rgba(0,0,0,0.8);color:#fff;font-size:11px;font-weight:600;padding:2px 6px;border-radius:4px">${dur}</span>` : ""}
            </div>
            <div class="card-text">
              <h3 class="title" style="margin:0 0 6px;font-size:14px;font-weight:600;line-height:1.3">${esc(v.title)}</h3>
              <div class="card-meta" style="font-size:12px;color:rgba(255,255,255,0.6)">${esc(v.category || "AI")} · ${views} views</div>
            </div>
          </a>
        </article>`;
  }).join("\n");

  const skeleton = `<!-- PRERENDER_HOMEPAGE_START -->
      <header class="home-prerender-header" style="margin-bottom:24px">
        <h1 style="font-size:clamp(22px,3vw,32px);font-weight:800;margin:0 0 8px;line-height:1.2;color:#fff">thebestpornai — Free 4K AI Porn &amp; Uncensored Adult Streaming</h1>
        <div class="home-hero-badge-row" style="margin-bottom:12px">
          <span class="home-hero-tag">✨ Featured</span>
          <span class="home-hero-count">4K Ultra HD · 6,000+ Videos</span>
          <span class="home-hero-free-pill">100% Free · No Signup</span>
          <span class="home-hero-trust-pill">🛡️ 100% Fictional Synthetic Personas · Zero Deepfakes · 18+ Consenting Adults</span>
        </div>
        <p style="font-size:14px;color:rgba(255,255,255,0.8);max-width:800px;margin:0 0 16px;line-height:1.5">
          Stream over 6,000+ high-definition AI generated adult videos, photorealistic face packs, uncensored movies, and exclusive clips. Instant high-speed cloud playback with zero buffering.
        </p>
        <nav class="home-prerender-nav" aria-label="Popular Categories" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:20px">
          <a href="/categories/blonde.html" class="filter-pill">Blonde</a>
          <a href="/categories/latina.html" class="filter-pill">Latina</a>
          <a href="/categories/milf.html" class="filter-pill">MILF</a>
          <a href="/categories/pov.html" class="filter-pill">POV</a>
          <a href="/categories/big-ass.html" class="filter-pill">Big Ass</a>
          <a href="/categories/big-tits.html" class="filter-pill">Big Tits</a>
          <a href="/categories/asian.html" class="filter-pill">Asian</a>
          <a href="/categories/amateur.html" class="filter-pill">Amateur</a>
          <a href="/categories/blowjob.html" class="filter-pill">Blowjob</a>
          <a href="/categories/creampie.html" class="filter-pill">Creampie</a>
          <a href="/categories/ebony.html" class="filter-pill">Ebony</a>
          <a href="/categories/lesbian.html" class="filter-pill">Lesbian</a>
          <a href="/categories/redhead.html" class="filter-pill">Redhead</a>
          <a href="/categories/ai-generated.html" class="filter-pill">AI Generated</a>
          <a href="/pornstars/" class="filter-pill" style="border-color:var(--accent);color:#fff">⭐ AI Pornstars</a>
          <a href="/categories/" class="filter-pill">All Categories</a>
        </nav>
      </header>

      <section class="home-prerender-featured" aria-label="Featured Videos" style="margin-bottom:32px">
        <h2 class="row-heading" style="margin-bottom:16px">Featured &amp; Trending 4K AI Videos</h2>
        <div class="video-list">
${featuredCards}
        </div>
      </section>

      <section class="home-seo-editorial" aria-label="About thebestpornai">
        <div class="home-seo-editorial-card">
          <h2 class="home-seo-editorial-title">Free 4K AI Porn &amp; Uncensored Adult Streaming</h2>
          <p class="home-seo-editorial-text">
            Welcome to <strong>thebestpornai</strong>, the premier streaming destination for high-definition generative adult entertainment. Our growing library features over 6,000+ uncensored 4K AI porn scenes, full-length movies, and exclusive shorts rendered with hyper-realistic detail and 60fps fluidity. Powered by high-speed global edge infrastructure via Cloudflare R2, every video streams instantly with zero buffering and no registration or credit card required. Explore our signature character face packs featuring recurring virtual adult stars, or browse top categories including Blonde, Latina, MILF, POV, and House Originals. All performers are 100% synthetic, ethically generated fictional personas compliant with 18+ adult standards.
          </p>
          <div class="home-seo-editorial-links">
            <a href="/categories/blonde.html" class="tag-chip">Blonde AI</a>
            <a href="/categories/latina.html" class="tag-chip">Latina AI</a>
            <a href="/categories/milf.html" class="tag-chip">MILF AI</a>
            <a href="/categories/pov.html" class="tag-chip">POV AI</a>
            <a href="/categories/big-ass.html" class="tag-chip">Big Ass</a>
            <a href="/tags/solo.html" class="tag-chip">Solo AI</a>
            <a href="/tags/pawg.html" class="tag-chip">PAWG AI</a>
            <a href="/tags/deepthroat.html" class="tag-chip">Deepthroat AI</a>
            <a href="/tags/cumshot.html" class="tag-chip">Cumshot AI</a>
            <a href="/tags/brunette.html" class="tag-chip">Brunette AI</a>
            <a href="/tags/creampie.html" class="tag-chip">Creampie AI</a>
            <a href="/tags/" class="tag-chip">All Tags Directory</a>
            <a href="/channels/" class="tag-chip">Top AI Creators</a>
            <a href="/pornstars/" class="tag-chip">AI Pornstars Index</a>
            <a href="/categories/" class="tag-chip">All Categories</a>
            <a href="/blog/" class="tag-chip">AI Blog &amp; Guides</a>
          </div>
        </div>
      </section>
      <!-- PRERENDER_HOMEPAGE_END -->`;

  const markerRegex = /<!-- PRERENDER_HOMEPAGE_START -->[\s\S]*?<!-- PRERENDER_HOMEPAGE_END -->/;
  if (markerRegex.test(html)) {
    html = html.replace(markerRegex, skeleton);
  } else {
    html = html.replace('<div class="content" id="view"></div>', `<div class="content" id="view">\n      ${skeleton}\n    </div>`);
  }
  fs.writeFileSync(indexPath, html);
  console.log("✔ index.html homepage prerender updated");
}

// Run generators
genPornstarsHub();
genPornstarProfiles();
genCategoriesHub();
genCategoryPages();
genTagsHub();
genTagPages();
genChannelsHub();
genChannelPages();
genVideoPages();
prerenderHomepageSkeleton();

console.log("🎉 All static routes generated successfully.");
