/* ============================================================
   SHARED CATALOG — single source of truth for the video catalog.
   Imported as an ES module by each app's main.js (viewer / creator / manager)
   via `import {...} from "../shared/catalog.js"`, bundled together by Vite.

   Defines globals used across all pages: MEDIA_BASE, mediaUrl(), DATA.
   Edit the catalog HERE ONLY — no more 4-file sync. After editing, upload
   catalog.js to Bunny storage and purge the Pull Zone cache (see CLAUDE.md).
   ============================================================ */

import { CATEGORIES } from "./taxonomy.js";

const MEDIA_BASE = "https://pub-b281e1d5ecb94a148bd620f8a2fe9d55.r2.dev/media";

/* HTML-escape a value for safe interpolation into innerHTML template strings.
   Use for ALL dynamic/user/catalog text rendered via innerHTML (titles, comments,
   names, search input, etc.) to prevent stored/reflected XSS. Returns "" for
   null/undefined so missing fields render blank instead of "undefined". */
const _escCache = new Map();
function esc(s){
  if(s === null || s === undefined) return "";
  const str = String(s);
  const cached = _escCache.get(str);
  if (cached !== undefined) return cached;
  const res = str
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
  if (_escCache.size < 5000) _escCache.set(str, res);
  return res;
}

/* ---------- shared helpers (identical across all pages; defined once here) ---------- */

/* O(1) Creator Map lookup cache */
let _creatorMap = null;
function getCreatorMap(){
  if(!_creatorMap || _creatorMap.size !== DATA.creators.length){
    _creatorMap = new Map(DATA.creators.map(c => [c.id, c]));
  }
  return _creatorMap;
}

/* Look up a creator's display name by id. */
function creatorName(id){ const c = getCreatorMap().get(id); return c ? c.name : "Unknown"; }

/* Whether a creator has the verified badge. */
function creatorVerified(id){ const c = getCreatorMap().get(id); return !!(c && c.verified); }

/* Format a number compactly: 1.2M / 3.4K / 567. */
function fmt(n){ return n>=1000000 ? (n/1000000).toFixed(1)+"M" : n>=1000 ? (n/1000).toFixed(1)+"K" : ""+n; }

/* Transient toast notification. Expects a #toast element on the page.
   Supports an optional interactive action button (e.g. "View in Library"). */
let _toastTimer;
function toast(msg, actionLabel, actionFn){
  const t=document.getElementById("toast"); if(!t) return;
  if(actionLabel && typeof actionFn === "function"){
    t.innerHTML = `<span>${esc(msg)}</span><button type="button" class="toast-act-btn">${esc(actionLabel)} →</button>`;
    const btn = t.querySelector(".toast-act-btn");
    if(btn) btn.onclick = (e) => {
      e.stopPropagation();
      actionFn();
      t.classList.remove("show");
    };
  } else {
    t.textContent=msg;
  }
  t.classList.add("show");
  clearTimeout(_toastTimer); _toastTimer=setTimeout(()=>t.classList.remove("show"), actionLabel ? 3800 : 2400);
}

/* Rewrite a "../media/x.mp4" path to the CDN when MEDIA_BASE is set and HTML-escape it. */
const _mediaUrlCache = new Map();
function mediaUrl(src){
  if(!src) return "";
  const cached = _mediaUrlCache.get(src);
  if(cached !== undefined) return cached;

  let result = src;
  if (/:/.test(src) && !/^https?:\/\//i.test(src) && !/^blob:/i.test(src) && !/^data:image\//i.test(src)) {
    result = "";
  } else if(src.startsWith("/")) {
    result = esc(src);
  } else if(!/^https?:\/\//i.test(src) && !src.startsWith("blob:") && !src.startsWith("data:")) {
    if(MEDIA_BASE) {
      const rel = src.replace(/^(\.\.\/)?media\//, "");
      const path = rel.split("/").map(seg => encodeURIComponent(seg).replace(/'/g, "%27")).join("/");
      result = MEDIA_BASE.replace(/\/$/,"") + "/" + path;
    }
    result = esc(result);
  } else {
    result = esc(result);
  }

  if(_mediaUrlCache.size < 10000) _mediaUrlCache.set(src, result);
  return result;
}

/* Extract YouTube ID from common URL formats. Shared so videoCard etc can use it everywhere. */
function ytId(url){
  if(!url) return null;
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

const DATA = {
  user: { id:"u1", name:"Alex", handle:"@alex", avatar:"A", subscriptions:42, role:"viewer" },

  creators: [
    { id:"c1",  name:"House Originals", handle:"@house",     subs:1240000, verified:true },
    { id:"c2",  name:"Maya Chen",       handle:"@maya",      subs:84000,   verified:true },
    { id:"c3",  name:"DevTalks",        handle:"@devtalks",  subs:31000,  verified:false },
    { id:"c4",  name:"Alex",            handle:"@alex",      subs:1240,   verified:false },
    { id:"c5",  name:"Nova AI",         handle:"@novaai",    subs:210000, verified:true },
    { id:"c6",  name:"Latina Heat",     handle:"@latinaheat",subs:96000,  verified:true },
    { id:"c7",  name:"Ember Studio",    handle:"@emberstudio",subs:58000, verified:false },
    { id:"c8",  name:"Velvet Dreams",   handle:"@velvetdreams",subs:143000,verified:true },
    { id:"c9",  name:"Riley Storm",     handle:"@rileystorm",subs:22000,  verified:false },
    { id:"c10", name:"Golden Hour AI",  handle:"@goldenhourai",subs:67000,verified:false },
    { id:"c11", name:"Jade Collective", handle:"@jadecollective",subs:39000,verified:false },
    { id:"c12", name:"Scarlet Muse",    handle:"@scarletmuse",subs:118000,verified:true },
    { id:"c13", name:"Bunny Lane",      handle:"@bunnylane", subs:29000,  verified:false },
    { id:"c14", name:"Studio Aurora",   handle:"@studioaurora",subs:75000,verified:true },
    { id:"c15", name:"Foxglove",        handle:"@foxglove",  subs:14000,  verified:false },
    { id:"c16", name:"Ivory & Co",      handle:"@ivoryco",   subs:52000,  verified:false },
    // Pornstars (kind:"pornstar") — face packs with intro + shorts. See creator page.
    {
      id: "ps-mia-nympo",
      kind: "pornstar",
      name: "Mia Nympo",
      handle: "@mianympo",
      slug: "mia-nympo",
      subs: 12800,
      verified: true,
      bio: "AI pornstar pack — intro scene plus vertical Shorts. Blonde, bold, built for rewatch.",
      tags: ["Mia Nympo", "Pornstar", "Blonde", "Babe", "AI", "Solo"],
      categories: ["Babe", "AI Generated"],
      // avatar/banner paths relative to media/; filled for R2 via mediaUrl()
      avatar: "../media/Mia Nympo PornStar/Mia Nympo6.avif",
      banner: "../media/Mia Nympo PornStar/Mia Nympo7.avif",
      introVideoId: 5168, // Mia Nympo — Intro
    },
    {
      id: "ps-sabrina-ass",
      kind: "pornstar",
      name: "Sabrina Ass",
      handle: "@sabrinaass",
      slug: "sabrina-ass",
      subs: 9400,
      verified: true,
      bio: "AI pornstar pack — full intro plus vertical Shorts. Curves first, zero apology.",
      tags: ["Sabrina Ass", "Pornstar", "Big Ass", "Babe", "AI", "Solo", "PAWG"],
      categories: ["Big Ass", "AI Generated"],
      avatar: "../media/Sabrina Ass/Sabrina.avif",
      banner: "../media/Sabrina Ass/Sabrina 2.avif",
      introVideoId: 5248, // Sabrina Ass — Intro
    },
    {
      id: "ps-marsha-banks",
      kind: "pornstar",
      name: "Marsha Banks",
      handle: "@marshabanks",
      slug: "marsha-banks",
      subs: 15600,
      verified: true,
      bio: "AI pornstar pack — slow-burn energy, full intro, and vertical Shorts. Soft heat with a spine.",
      tags: ["Marsha Banks", "Pornstar", "MILF", "Babe", "AI", "Solo", "Romantic"],
      categories: ["MILF", "AI Generated"],
      avatar: "../media/Marsha Banks/Marsha Banks.avif",
      banner: "../media/Marsha Banks/Marsha Banks pool.avif",
      introVideoId: 5257, // Marsha Banks — Intro
    },
    {
      id: "ps-yuna-blackveil",
      kind: "pornstar",
      name: "Yuna Blackveil",
      handle: "@yunablackveil",
      slug: "yuna-blackveil",
      subs: 6200,
      verified: true,
      bio: "2D AI pornstar pack — long black hair, hentai bedroom scenes, one repeatable illustrated face.",
      tags: ["Yuna Blackveil", "Pornstar", "Hentai", "Anime", "Big Tits", "Babe", "AI", "Solo"],
      categories: ["Babe", "AI Generated"],
      avatar: "../media/Yuna Blackveil/avatar.jpg",
      banner: "../media/Yuna Blackveil/banner.jpg",
      introVideoId: 5962,
    },
    {
      id: "ps-violet-rush",
      kind: "pornstar",
      name: "Violet Rush",
      handle: "@violetrush",
      slug: "violet-rush",
      subs: 8100,
      verified: true,
      bio: "Neon-city AI pornstar pack — lavender hair, pink floral dress, night-drive photoreal clips.",
      tags: ["Violet Rush", "Pornstar", "Latina", "Babe", "AI", "Solo", "Big Tits"],
      categories: ["Babe", "AI Generated"],
      avatar: "../media/Violet Rush/avatar.jpg",
      banner: "../media/Violet Rush/banner.jpg",
      introVideoId: 5968,
    },
    {
      id: "ps-elle-hart",
      kind: "pornstar",
      name: "Elle Hart",
      handle: "@ellehart",
      slug: "elle-hart",
      subs: 7400,
      verified: true,
      bio: "Photoreal blonde AI pornstar pack — huge natural tits, studio heat, same face on every clip.",
      tags: ["Elle Hart", "Pornstar", "Blonde", "Big Tits", "Babe", "AI", "Solo"],
      categories: ["Big Tits", "AI Generated"],
      avatar: "../media/Elle Hart/avatar.jpg",
      banner: "../media/Elle Hart/banner.jpg",
      introVideoId: 5973,
    },
    {
      id: "ps-red-velvet",
      kind: "pornstar",
      name: "Red Velvet",
      handle: "@redvelvet",
      slug: "red-velvet",
      subs: 18200,
      verified: true,
      bio: "High-glam platinum AI pornstar pack — glossy skin, icy blonde, cinematic close-ups.",
      tags: ["Red Velvet", "Pornstar", "Blonde", "Babe", "AI", "Solo", "Big Tits"],
      categories: ["Blonde", "AI Generated"],
      avatar: "../media/Red Velvet/avatar.jpg",
      banner: "../media/Red Velvet/banner.jpg",
      introVideoId: 4455,
    },
    {
      id: "ps-lola-voss",
      kind: "pornstar",
      name: "Lola Voss",
      handle: "@lolavoss",
      slug: "lola-voss",
      subs: 22100,
      verified: true,
      bio: "Short-platinum AI pornstar pack — collar, leash, bimbo heat, numbered clips.",
      tags: ["Lola Voss", "Pornstar", "Blonde", "Big Tits", "Babe", "AI", "Solo"],
      categories: ["Blonde", "AI Generated"],
      avatar: "../media/Lola Voss/avatar.jpg",
      banner: "../media/Lola Voss/banner.jpg",
      introVideoId: 515,
    },
    {
      id: "ps-pinky-hart",
      kind: "pornstar",
      name: "Pinky Hart",
      handle: "@pinkyhart",
      slug: "pinky-hart",
      subs: 14800,
      verified: true,
      bio: "Candy-pink bob AI pornstar pack — pale skin, studio pink, huge naturals.",
      tags: ["Pinky Hart", "Pornstar", "Babe", "Big Tits", "AI", "Solo"],
      categories: ["Babe", "AI Generated"],
      avatar: "../media/Pinky Hart/avatar.jpg",
      banner: "../media/Pinky Hart/banner.jpg",
      introVideoId: 316,
    },
    {
      id: "ps-aphrodite-dynamites",
      kind: "pornstar",
      name: "Aphrodite Dynamites",
      handle: "@aphroditedynamites",
      slug: "aphrodite-dynamites",
      subs: 16900,
      verified: true,
      bio: "Public-risk Latina AI pornstar pack — gold chains, white lace, exhibition heat.",
      tags: ["Aphrodite Dynamites", "Pornstar", "Latina", "Babe", "AI", "Public", "Big Tits"],
      categories: ["Latina", "AI Generated"],
      avatar: "../media/Aphrodite Dynamites/avatar.jpg",
      banner: "../media/Aphrodite Dynamites/banner.jpg",
      introVideoId: 2193,
    },
    {
      id: "ps-emily-vale",
      kind: "pornstar",
      name: "Emily Vale",
      handle: "@emilyvale",
      slug: "emily-vale",
      subs: 11300,
      verified: true,
      bio: "Dancer-first brunette AI pornstar pack — Emily’s amazing dance, sunlit room, slow body work.",
      tags: ["Emily Vale", "Pornstar", "Latina", "Babe", "AI", "Solo", "Amateur"],
      categories: ["Babe", "AI Generated"],
      avatar: "../media/Emily Vale/avatar.jpg",
      banner: "../media/Emily Vale/banner.jpg",
      introVideoId: 4259,
    },
    {
      id: "ps-noor-dubai",
      kind: "pornstar",
      name: "Noor Dubai",
      handle: "@noordubai",
      slug: "noor-dubai",
      subs: 15700,
      verified: true,
      bio: "Chocolate of Dubai AI pornstar pack — dark waves, tan, black micro-bikini, one luxury look.",
      tags: ["Noor Dubai", "Pornstar", "Babe", "Big Tits", "AI", "Solo"],
      categories: ["Babe", "AI Generated"],
      avatar: "../media/Noor Dubai/avatar.jpg",
      banner: "../media/Noor Dubai/banner.jpg",
      introVideoId: 5049,
    },
    {
      id: "ps-helena-brooks",
      kind: "pornstar",
      name: "Helena Brooks",
      handle: "@helenabrooks",
      slug: "helena-brooks",
      subs: 19100,
      verified: true,
      bio: "Blonde-bob AI MILF pack — huge natural tits, bedroom light, numbered mature scenes.",
      tags: ["Helena Brooks", "Pornstar", "MILF", "Blonde", "Big Tits", "Babe", "AI"],
      categories: ["MILF", "AI Generated"],
      avatar: "../media/Helena Brooks/avatar.jpg",
      banner: "../media/Helena Brooks/banner.jpg",
      introVideoId: 355,
    },
    {
      id: "ps-barbi-lane",
      kind: "pornstar",
      name: "Barbi Lane",
      handle: "@barbilane",
      slug: "barbi-lane",
      subs: 13400,
      verified: true,
      bio: "Long-blonde AI pornstar pack — huge naturals, Barbi Slut / Big Naturals series.",
      tags: ["Barbi Lane", "Pornstar", "Blonde", "Big Tits", "Babe", "AI", "Solo"],
      categories: ["Big Tits", "AI Generated"],
      avatar: "../media/Barbi Lane/avatar.jpg",
      banner: "../media/Barbi Lane/banner.jpg",
      introVideoId: 6146,
    },
    {
      id: "ps-dakota-j",
      kind: "pornstar",
      name: "Dakota J",
      handle: "@dakotaj",
      slug: "dakota-j",
      subs: 9800,
      verified: true,
      bio: "Amateur BBW AI pornstar pack — brunette, outdoor, numbered Dakota J clips.",
      tags: ["Dakota J", "Pornstar", "BBW", "Babe", "Big Tits", "AI", "Amateur"],
      categories: ["Babe", "AI Generated"],
      avatar: "../media/Dakota J/avatar.jpg",
      banner: "../media/Dakota J/banner.jpg",
      introVideoId: 6201,
    },
    {
      id: "ps-sara-katz",
      kind: "pornstar",
      name: "Sara Katz",
      handle: "@sarakatz",
      slug: "sara-katz",
      subs: 8700,
      verified: true,
      bio: "Curly redhead AI pornstar pack — named Sara Katz series.",
      tags: ["Sara Katz", "Pornstar", "Redhead", "Babe", "AI", "Amateur"],
      categories: ["Redhead", "AI Generated"],
      avatar: "../media/Sara Katz/avatar.jpg",
      banner: "../media/Sara Katz/banner.jpg",
      introVideoId: 6224,
    },
    {
      id: "ps-lana-wilde",
      kind: "pornstar",
      name: "Lana Wilde",
      handle: "@lanawilde",
      slug: "lana-wilde",
      subs: 10200,
      verified: true,
      bio: "Party-blonde AI pornstar pack — Blond Going Wilde numbered clips.",
      tags: ["Lana Wilde", "Pornstar", "Blonde", "Babe", "AI", "Solo"],
      categories: ["Blonde", "AI Generated"],
      avatar: "../media/Lana Wilde/avatar.jpg",
      banner: "../media/Lana Wilde/banner.jpg",
      introVideoId: 6234,
    },
    {
      id: "ps-piper-belle",
      kind: "pornstar",
      name: "Piper Belle",
      handle: "@piperbelle",
      slug: "piper-belle",
      subs: 9100,
      verified: true,
      bio: "Hotel-blonde AI pornstar pack — Perfect Little Girl numbered series.",
      tags: ["Piper Belle", "Pornstar", "Blonde", "Babe", "AI", "Solo"],
      categories: ["Blonde", "AI Generated"],
      avatar: "../media/Piper Belle/avatar.jpg",
      banner: "../media/Piper Belle/banner.jpg",
      introVideoId: 6260,
    },
    {
      id: "ps-ruby-voss",
      kind: "pornstar",
      name: "Ruby Voss",
      handle: "@rubyvoss",
      slug: "ruby-voss",
      subs: 8900,
      verified: true,
      bio: "Straight-red AI pornstar pack — Grok redhead session, pale skin, heavy chest.",
      tags: ["Ruby Voss", "Pornstar", "Redhead", "Big Tits", "Babe", "AI", "Solo"],
      categories: ["Redhead", "AI Generated"],
      avatar: "../media/Ruby Voss/avatar.jpg",
      banner: "../media/Ruby Voss/banner.jpg",
      introVideoId: 6283,
    },
    {
      id: "ps-anna-vance",
      kind: "pornstar",
      name: "Anna Vance",
      handle: "@annavance",
      slug: "anna-vance",
      subs: 17400,
      verified: true,
      bio: "High-fashion AI supermodel — brunette waves, flawless studio lighting, and endless bedroom poses.",
      tags: ["Anna Vance", "Pornstar", "Babe", "AI", "Solo", "Supermodel"],
      categories: ["Babe", "AI Generated"],
      avatar: "../media/thumbs/new batch 5/Anna Super Model00001.jpg",
      banner: "../media/thumbs/new batch 5/Anna Super Model00001.jpg",
      introVideoId: 4935,
    },
    {
      id: "ps-kaya-sky",
      kind: "pornstar",
      name: "Kaya Sky",
      handle: "@kayasky",
      slug: "kaya-sky",
      subs: 13800,
      verified: true,
      bio: "NYC skyline AI babe — outdoor sunset views, rooftop heat, and intimate multi-angle scenes.",
      tags: ["Kaya Sky", "Pornstar", "Babe", "Lesbian", "AI", "Rooftop"],
      categories: ["Babe", "AI Generated"],
      avatar: "../media/thumbs/new-batch-2026-08-26/nyc-rooftop-threesome/NYC-Rooftop-Threesome__Clip-1.jpg",
      banner: "../media/thumbs/new-batch-2026-08-26/nyc-rooftop-threesome/NYC-Rooftop-Threesome__Clip-1.jpg",
      introVideoId: 6294,
    },
    {
      id: "ps-bella-bloom",
      kind: "pornstar",
      name: "Bella Bloom",
      handle: "@bellabloom",
      slug: "bella-bloom",
      subs: 11900,
      verified: true,
      bio: "Petite AI bombshell — captivating eyes, soft facial features, and intimate solo bedroom clips.",
      tags: ["Bella Bloom", "Pornstar", "Babe", "AI", "Solo"],
      categories: ["Babe", "AI Generated"],
      avatar: "../media/thumbs/all mp4 porn /the most pretty girl.jpg",
      banner: "../media/thumbs/all mp4 porn /the most pretty girl.jpg",
      introVideoId: 3574,
    },
    {
      id: "ps-sienna-west",
      kind: "pornstar",
      name: "Sienna West",
      handle: "@siennawest",
      slug: "sienna-west",
      subs: 14200,
      verified: true,
      bio: "Stacked AI beauty — demure charm, huge natural tits, and slow-motion bedroom teases.",
      tags: ["Sienna West", "Pornstar", "Big Tits", "Babe", "AI", "Solo"],
      categories: ["Big Tits", "AI Generated"],
      avatar: "../media/thumbs/batch-1/Amazing Demure Desires Big naturals1.jpg",
      banner: "../media/thumbs/batch-1/Amazing Demure Desires Big naturals1.jpg",
      introVideoId: 190,
    },
    {
      id: "ps-jenny-cross",
      kind: "pornstar",
      name: "Jenny Cross",
      handle: "@jennycross",
      slug: "jenny-cross",
      subs: 10600,
      verified: true,
      bio: "PAWG AI dancer — legendary rooftop curves, bubble butt close-ups, and outdoor twerk energy.",
      tags: ["Jenny Cross", "Pornstar", "Big Ass", "PAWG", "Babe", "AI"],
      categories: ["Big Ass", "AI Generated"],
      avatar: "../media/thumbs/new batch 6/Jenny Butt Perfect Ass rooftop.jpg",
      banner: "../media/thumbs/new batch 6/Jenny Butt Perfect Ass rooftop.jpg",
      introVideoId: 5082,
    },
    {
      id: "ps-scarlett-flame",
      kind: "pornstar",
      name: "Scarlett Flame",
      handle: "@scarlettflame",
      slug: "scarlett-flame",
      subs: 16500,
      verified: true,
      bio: "Fiery redhead AI star — pale skin, intense gaze, and uninhibited passion in full 4K resolution.",
      tags: ["Scarlett Flame", "Pornstar", "Redhead", "Babe", "AI", "Solo"],
      categories: ["Redhead", "AI Generated"],
      avatar: "../media/thumbs/Redhead getting fuck COMPILATION/REDHED COMPLITION00001.jpg",
      banner: "../media/thumbs/Redhead getting fuck COMPILATION/REDHED COMPLITION00001.jpg",
      introVideoId: 1380,
    },
  ],

  // Homepage rows / sidebar / filter bar taxonomy — sourced from taxonomy.js
  // (single source of truth, shared with the creator wizard and search).
  categories: CATEGORIES,

  videos: [
    { id:1, title:"Blonde Office Twerk", creator:"c3", type:"ugc", category:"Blonde", views:14312, likes:222, dislikes:5, comments:0, favorites:0, duration:"0:26", uploaded:"2026-05-04", src:"../media/to upload/Blonde Office Twerk video by ttt-ai on DeviantArt.mp4", status:"published", flagged:false, orientation:"vertical" },
    { id:2, title:"HUge TITS PINK00005", creator:"c1", type:"original", category:"Big Tits", views:12033, likes:136, dislikes:16, comments:3, favorites:0, duration:"0:10", uploaded:"2026-04-03", src:"../media/to upload/HUge TITS PINK00005.mp4", status:"published", flagged:false, orientation:"vertical" },
    { id:3, title:"Naked surfer G2159", creator:"c4", type:"ugc", category:"Gay", views:10222, likes:136, dislikes:10, comments:1, favorites:0, duration:"0:20", uploaded:"2026-06-21", src:"../media/to upload/Naked surfer -G2159 video by The-Satin-Pause on DeviantArt.mp4", status:"published", flagged:false },
    { id:4, title:"Perfect Pussy Twerk", creator:"c1", type:"original", category:"Babe", views:10533, likes:264, dislikes:5, comments:1, favorites:0, duration:"0:15", uploaded:"2026-01-18", src:"../media/to upload/Perfect Pussy Twerk .mp4", status:"published", flagged:false },
    { id:5, title:"Perfect doggy cumming00001", creator:"c3", type:"ugc", category:"Anal", views:11208, likes:119, dislikes:10, comments:4, favorites:0, duration:"0:09", uploaded:"2026-03-18", src:"../media/to upload/Perfect doggy cumming00001.mp4", status:"published", flagged:false },
    { id:6, title:"Sexy by SexyGirls2", creator:"c2", type:"ugc", category:"Asian", views:14589, likes:247, dislikes:13, comments:2, favorites:0, duration:"0:30", uploaded:"2026-01-18", src:"../media/Sexy by SexyGirls2 on DeviantArt (4).mp4", status:"published", flagged:false },
    { id:7, title:"Solo beach walk G2630", creator:"c1", type:"original", category:"POV", views:10478, likes:257, dislikes:4, comments:3, favorites:0, duration:"0:27", uploaded:"2026-03-15", src:"../media/to upload/Solo beach walk -G2630 video by The-Satin-Pause on DeviantArt (7).mp4", status:"published", flagged:false },
    { id:8, title:"Solo beach walk", creator:"c4", type:"ugc", category:"Amateur", views:10508, likes:220, dislikes:5, comments:1, favorites:0, duration:"0:27", uploaded:"2026-01-19", src:"../media/to upload/Solo beach walk.mp4", status:"published", flagged:false },
    { id:9, title:"Sunscreen G2718", creator:"c4", type:"ugc", category:"Blowjob", views:10520, likes:107, dislikes:4, comments:4, favorites:0, duration:"0:29", uploaded:"2026-01-04", src:"../media/to upload/Sunscreen -G2718 video by The-Satin-Pause on DeviantArt.mp4", status:"published", flagged:false },
    { id:10, title:"Surrender to nature G2538", creator:"c2", type:"ugc", category:"Amateur", views:13332, likes:250, dislikes:14, comments:3, favorites:0, duration:"0:20", uploaded:"2026-01-22", src:"../media/to upload/Surrender to nature -G2538 video by The-Satin-Pause on DeviantArt.mp4", status:"published", flagged:true },
    { id:11, title:"All", creator:"c3", type:"ugc", category:"POV", views:12415, likes:188, dislikes:9, comments:3, favorites:0, duration:"0:06", uploaded:"2026-05-26", src:"../media/to upload/all.mp4", status:"published", flagged:false },
    { id:12, title:"Amazing 18", creator:"c1", type:"original", category:"18-25", views:12576, likes:153, dislikes:13, comments:0, favorites:0, duration:"0:22", uploaded:"2026-06-23", src:"../media/to upload/amazing 18.mp4", status:"published", flagged:false },
    { id:13, title:"Amazing big natural", creator:"c4", type:"ugc", category:"Big Tits", views:12949, likes:234, dislikes:2, comments:0, favorites:0, duration:"0:20", uploaded:"2026-04-12", src:"../media/to upload/amazing big natural.mp4", status:"published", flagged:false },
    { id:14, title:"Anazing girls on the beach", creator:"c1", type:"original", category:"Lesbian", views:13225, likes:118, dislikes:4, comments:1, favorites:0, duration:"0:30", uploaded:"2026-06-08", src:"../media/to upload/anazing girls on the beach.mp4", status:"published", flagged:false },
    { id:15, title:"Beauty girl", creator:"c4", type:"ugc", category:"Beauty", views:14843, likes:137, dislikes:17, comments:4, favorites:0, duration:"0:26", uploaded:"2026-03-05", src:"../media/to upload/beauty girl.mp4", status:"published", flagged:false },
    { id:16, title:"Big natural", creator:"c3", type:"ugc", category:"Big Tits", views:10979, likes:183, dislikes:19, comments:1, favorites:0, duration:"0:22", uploaded:"2026-02-03", src:"../media/to upload/big natural.mp4", status:"published", flagged:false },
    { id:17, title:"Blond girl having fun", creator:"c2", type:"ugc", category:"Blonde", views:12997, likes:284, dislikes:4, comments:4, favorites:0, duration:"0:10", uploaded:"2026-02-09", src:"../media/to upload/blond girl having fun.mp4", status:"published", flagged:false },
    { id:18, title:"Blond", creator:"c2", type:"ugc", category:"Blonde", views:12441, likes:188, dislikes:5, comments:2, favorites:0, duration:"0:22", uploaded:"2026-02-23", src:"../media/to upload/blond.mp4", status:"published", flagged:false },
    { id:19, title:"Blondy ai", creator:"c1", type:"original", category:"Blonde", views:11521, likes:164, dislikes:9, comments:3, favorites:0, duration:"0:18", uploaded:"2026-04-13", src:"../media/to upload/blondy ai.mp4", status:"published", flagged:false },
    { id:20, title:"Comming gitls", creator:"c4", type:"ugc", category:"Amateur", views:13890, likes:146, dislikes:19, comments:0, favorites:0, duration:"0:20", uploaded:"2026-02-15", src:"../media/to upload/comming gitls.mp4", status:"published", flagged:false },
    { id:21, title:"AI Generated Clip (1)", creator:"c3", type:"ugc", category:"AI Generated", views:10390, likes:157, dislikes:7, comments:4, favorites:0, duration:"0:20", uploaded:"2026-02-18", src:"../media/to upload/grok-video-356eddc7-87b2-4217-9418-ddc9ff6d900a (1).mp4", status:"published", flagged:true },
    { id:22, title:"AI Generated Clip (12)", creator:"c3", type:"ugc", category:"AI Generated", views:11067, likes:109, dislikes:8, comments:4, favorites:0, duration:"0:10", uploaded:"2026-04-05", src:"../media/to upload/grok-video-db383327-45a9-4339-a5a5-22973570fb5c (12).mp4", status:"published", flagged:false },
    { id:23, title:"Redhead", creator:"c3", type:"ugc", category:"Straight", views:14855, likes:190, dislikes:7, comments:0, favorites:0, duration:"0:20", uploaded:"2026-04-15", src:"../media/to upload/redhead.mp4", status:"published", flagged:false },
    { id:24, title:"Robo sex ai", creator:"c3", type:"ugc", category:"AI Generated", views:10632, likes:150, dislikes:17, comments:2, favorites:0, duration:"0:10", uploaded:"2026-04-27", src:"../media/to upload/robo-sex ai.mp4", status:"published", flagged:false },
    { id:25, title:"Robo sex", creator:"c1", type:"original", category:"AI Generated", views:12736, likes:289, dislikes:2, comments:2, favorites:0, duration:"0:10", uploaded:"2026-02-23", src:"../media/to upload/robo-sex.mp4", status:"published", flagged:false },
    { id:26, title:"Sexy milf", creator:"c1", type:"original", category:"Babe", views:14478, likes:180, dislikes:11, comments:2, favorites:0, duration:"0:20", uploaded:"2026-05-12", src:"../media/to upload/sexy milf.mp4", status:"published", flagged:false },
    { id:27, title:"She is comming", creator:"c3", type:"ugc", category:"Amateur", views:10944, likes:118, dislikes:15, comments:2, favorites:0, duration:"0:20", uploaded:"2026-06-08", src:"../media/to upload/she is comming.mp4", status:"published", flagged:false },
    { id:28, title:"Suger daddy", creator:"c2", type:"ugc", category:"Babe", views:14907, likes:262, dislikes:4, comments:1, favorites:0, duration:"0:10", uploaded:"2026-05-16", src:"../media/to upload/suger-daddy.mp4", status:"published", flagged:false },
    { id:29, title:"The best sexy cyber", creator:"c1", type:"original", category:"AI Generated", views:10800, likes:236, dislikes:5, comments:2, favorites:0, duration:"0:06", uploaded:"2026-02-23", src:"../media/to upload/the best sexy cyber.mp4", status:"published", flagged:false },
    { id:30, title:"Threesome girls", creator:"c3", type:"ugc", category:"Threesome", views:12257, likes:136, dislikes:11, comments:2, favorites:0, duration:"0:06", uploaded:"2026-01-08", src:"../media/to upload/threesome girls.mp4", status:"published", flagged:true },
    { id:31, title:"Threesome girls2", creator:"c4", type:"ugc", category:"Threesome", views:11349, likes:198, dislikes:11, comments:4, favorites:0, duration:"0:06", uploaded:"2026-05-27", src:"../media/to upload/threesome girls2.mp4", status:"published", flagged:true },
    { id:32, title:"Cumshot Mix 01", creator:"c4", type:"ugc", category:"Blowjob", categories:["Blowjob"], views:11419, likes:271, dislikes:6, comments:4, favorites:0, duration:"0:05", uploaded:"2026-02-02", src:"../media/all mp4 porn /comshot compilation00001.mp4", tags:["Deepthroat", "Cumshot", "Big Tits"], status:"published", flagged:true, orientation:"vertical" },
    { id:33, title:"Best Cumshots 02", creator:"c1", type:"ugc", category:"Blowjob", categories:["Blowjob"], views:12337, likes:274, dislikes:5, comments:4, favorites:0, duration:"0:05", uploaded:"2026-01-19", src:"../media/all mp4 porn /comshot compilation00002.mp4", tags:["Blowjob", "Deepthroat", "Cumshot"], status:"published", flagged:false, orientation:"vertical" },
    { id:34, title:"Cum Compilation 03", creator:"c2", type:"ugc", category:"Cumshot", categories:["Cumshot"], views:14064, likes:223, dislikes:6, comments:4, favorites:0, duration:"0:10", uploaded:"2026-03-18", src:"../media/all mp4 porn /comshot compilation00003.mp4", tags:["Handjob", "Facial", "Big Tits"], status:"published", flagged:false, orientation:"vertical" },
    { id:35, title:"Best Cumshots 04", creator:"c4", type:"ugc", category:"Amateur", categories:["Amateur"], views:11765, likes:103, dislikes:3, comments:0, favorites:0, duration:"0:05", uploaded:"2026-05-07", src:"../media/all mp4 porn /comshot compilation00004.mp4", tags:["Compilation", "POV", "Cumshot"], status:"published", flagged:false, orientation:"vertical" },
    { id:36, title:"Cumshot Mix 05", creator:"c3", type:"ugc", category:"Facial", categories:["Facial"], views:12453, likes:238, dislikes:5, comments:0, favorites:0, duration:"0:05", uploaded:"2026-05-10", src:"../media/all mp4 porn /comshot compilation00005.mp4", tags:["Big Tits", "POV", "Facial"], status:"published", flagged:false, orientation:"vertical" },
    { id:37, title:"Cum Tribute 06", creator:"c1", type:"ugc", category:"Compilation", categories:["Compilation"], views:14405, likes:119, dislikes:8, comments:1, favorites:0, duration:"0:25", uploaded:"2026-04-14", src:"../media/all mp4 porn /comshot compilation00006.mp4", tags:["Blowjob", "Handjob", "Amateur"], status:"published", flagged:true, orientation:"vertical" },
    { id:38, title:"Hot Load Comp 07", creator:"c1", type:"ugc", category:"Amateur", categories:["Amateur"], views:13158, likes:116, dislikes:2, comments:0, favorites:0, duration:"0:05", uploaded:"2026-01-09", src:"../media/all mp4 porn /comshot compilation00007.mp4", tags:["POV", "Handjob", "Big Tits"], status:"published", flagged:false, orientation:"vertical" },
    { id:39, title:"Cumshot Compilation 08", creator:"c1", type:"ugc", category:"POV", categories:["POV"], views:14633, likes:132, dislikes:4, comments:0, favorites:0, duration:"0:10", uploaded:"2026-04-12", src:"../media/all mp4 porn /comshot compilation00008.mp4", tags:["Amateur", "Big Tits", "Facial"], status:"published", flagged:false, orientation:"vertical" },
    { id:40, title:"Cum Tribute 09", creator:"c3", type:"ugc", category:"Cumshot", categories:["Cumshot"], views:11027, likes:122, dislikes:10, comments:0, favorites:0, duration:"0:11", uploaded:"2026-02-15", src:"../media/all mp4 porn /comshot compilation00009.mp4", tags:["Compilation", "Amateur", "Blowjob"], status:"published", flagged:false, orientation:"vertical" },
    { id:41, title:"Facial Finale 10", creator:"c2", type:"ugc", category:"Facial", categories:["Facial"], views:12552, likes:229, dislikes:4, comments:1, favorites:0, duration:"0:05", uploaded:"2026-02-03", src:"../media/all mp4 porn /comshot compilation00010.mp4", tags:["Handjob", "Amateur", "POV"], status:"published", flagged:false, orientation:"vertical" },
    { id:42, title:"Cum Compilation 11", creator:"c2", type:"ugc", category:"Cumshot", categories:["Cumshot"], views:10984, likes:148, dislikes:9, comments:4, favorites:0, duration:"0:10", uploaded:"2026-03-20", src:"../media/all mp4 porn /comshot compilation00011.mp4", tags:["Big Tits", "Facial", "Handjob"], status:"published", flagged:false, orientation:"vertical" },
    { id:43, title:"Hot Load Comp 12", creator:"c1", type:"ugc", category:"Amateur", categories:["Amateur"], views:12276, likes:266, dislikes:4, comments:3, favorites:0, duration:"0:10", uploaded:"2026-01-16", src:"../media/all mp4 porn /comshot compilation00012.mp4", tags:["Cumshot", "Big Tits", "Deepthroat"], status:"published", flagged:false, orientation:"vertical" },
    { id:44, title:"Cum Compilation 13", creator:"c1", type:"ugc", category:"Cumshot", categories:["Cumshot"], views:14606, likes:287, dislikes:13, comments:0, favorites:0, duration:"0:05", uploaded:"2026-01-19", src:"../media/all mp4 porn /comshot compilation00013.mp4", tags:["Compilation", "Big Tits", "Blowjob"], status:"published", flagged:false, orientation:"vertical" },
    { id:45, title:"Cumshot Mix 14", creator:"c1", type:"ugc", category:"Amateur", categories:["Amateur"], views:11125, likes:170, dislikes:9, comments:2, favorites:0, duration:"0:05", uploaded:"2026-03-20", src:"../media/all mp4 porn /comshot compilation00014.mp4", tags:["Cumshot", "Blowjob", "Deepthroat"], status:"published", flagged:false, orientation:"vertical" },
    { id:46, title:"Best Cumshots 15", creator:"c2", type:"ugc", category:"Facial", categories:["Facial"], views:11441, likes:153, dislikes:17, comments:2, favorites:0, duration:"0:10", uploaded:"2026-06-09", src:"../media/all mp4 porn /comshot compilation00015.mp4", tags:["Big Tits", "Handjob", "Compilation"], status:"published", flagged:false, orientation:"vertical" },
    { id:47, title:"Hot Load Comp 16", creator:"c3", type:"ugc", category:"Cumshot", categories:["Cumshot"], views:13510, likes:247, dislikes:12, comments:2, favorites:0, duration:"0:05", uploaded:"2026-06-28", src:"../media/all mp4 porn /comshot compilation00017.mp4", tags:["Compilation", "POV", "Blowjob"], status:"published", flagged:true, orientation:"vertical" },
    { id:48, title:"Hot Load Comp 17", creator:"c2", type:"ugc", category:"Compilation", categories:["Compilation"], views:14570, likes:281, dislikes:11, comments:2, favorites:0, duration:"0:10", uploaded:"2026-06-08", src:"../media/all mp4 porn /comshot compilation00019.mp4", tags:["Facial", "POV", "Deepthroat"], status:"published", flagged:false },
    { id:49, title:"Cum Compilation 18", creator:"c3", type:"ugc", category:"Facial", categories:["Facial"], views:14200, likes:195, dislikes:3, comments:0, favorites:0, duration:"0:05", uploaded:"2026-03-16", src:"../media/all mp4 porn /comshot compilation00020.mp4", tags:["Compilation", "Handjob", "Amateur"], status:"published", flagged:false, orientation:"vertical" },
    { id:50, title:"Cum Tribute 19", creator:"c1", type:"ugc", category:"POV", categories:["POV"], views:11127, likes:142, dislikes:8, comments:1, favorites:0, duration:"0:05", uploaded:"2026-03-07", src:"../media/all mp4 porn /comshot compilation00022.mp4", tags:["POV", "Handjob", "Cumshot"], status:"published", flagged:false, orientation:"vertical" },
    { id:51, title:"Cum Tribute 20", creator:"c3", type:"ugc", category:"POV", categories:["POV"], views:11899, likes:175, dislikes:19, comments:3, favorites:0, duration:"0:05", uploaded:"2026-02-14", src:"../media/all mp4 porn /comshot compilation00023.mp4", tags:["POV", "Blowjob", "Deepthroat"], status:"published", flagged:false, orientation:"vertical" },
    { id:52, title:"Best Cumshots 21", creator:"c4", type:"ugc", category:"POV", categories:["POV"], views:14619, likes:117, dislikes:2, comments:1, favorites:0, duration:"0:10", uploaded:"2026-01-05", src:"../media/all mp4 porn /comshot compilation00024.mp4", tags:["Deepthroat", "Big Tits", "Compilation"], status:"published", flagged:false, orientation:"vertical" },
    { id:53, title:"Facial Finale 22", creator:"c2", type:"ugc", category:"Amateur", categories:["Amateur"], views:14559, likes:180, dislikes:5, comments:0, favorites:0, duration:"0:05", uploaded:"2026-06-21", src:"../media/all mp4 porn /comshot compilation00025.mp4", tags:["Big Tits", "POV", "Blowjob"], status:"published", flagged:false, orientation:"vertical" },
    { id:54, title:"Ass Appreciation", creator:"c4", type:"ugc", category:"Big Ass", categories:["Big Ass"], views:10220, likes:269, dislikes:7, comments:4, favorites:0, duration:"0:06", uploaded:"2026-01-25", src:"../media/all mp4 porn /Amazing Ass1.mp4", tags:["Doggy", "POV", "Big Ass"], status:"published", flagged:false, orientation:"vertical" },
    { id:55, title:"Twerk Queen", creator:"c1", type:"ugc", category:"POV", categories:["POV"], views:14789, likes:127, dislikes:13, comments:3, favorites:0, duration:"0:06", uploaded:"2026-06-09", src:"../media/all mp4 porn /Amazing Ass2.mp4", tags:["Booty", "Doggy", "Curvy"], status:"published", flagged:false },
    { id:56, title:"Perfect Curves", creator:"c1", type:"ugc", category:"Amateur", categories:["Amateur"], views:10884, likes:150, dislikes:19, comments:0, favorites:0, duration:"0:06", uploaded:"2026-05-25", src:"../media/all mp4 porn /Amazing Ass3.mp4", tags:["Twerk", "Curvy", "Thick"], status:"published", flagged:false, orientation:"vertical" },
    { id:57, title:"Booty Bounce", creator:"c4", type:"ugc", category:"Big Ass", categories:["Big Ass"], views:11701, likes:211, dislikes:20, comments:1, favorites:0, duration:"0:06", uploaded:"2026-02-02", src:"../media/all mp4 porn /Amazing Ass4.mp4", tags:["Twerk", "Thick", "Big Ass"], status:"published", flagged:false, orientation:"vertical" },
    { id:58, title:"Big Booty Babe", creator:"c4", type:"ugc", category:"POV", categories:["POV"], views:12166, likes:207, dislikes:16, comments:2, favorites:0, duration:"0:06", uploaded:"2026-01-10", src:"../media/all mp4 porn /Amazing Ass5.mp4", tags:["Thick", "POV", "Twerk"], status:"published", flagged:false, orientation:"vertical" },
    { id:59, title:"Booty Heaven", creator:"c4", type:"ugc", category:"Amateur", categories:["Amateur"], views:14037, likes:228, dislikes:12, comments:3, favorites:0, duration:"0:06", uploaded:"2026-02-22", src:"../media/all mp4 porn /Amazing Ass6.mp4", tags:["POV", "Amateur", "Doggy"], status:"published", flagged:false, orientation:"vertical" },
    { id:60, title:"Bubble Butt", creator:"c1", type:"ugc", category:"Big Ass", categories:["Big Ass"], views:12885, likes:228, dislikes:3, comments:0, favorites:0, duration:"0:06", uploaded:"2026-04-14", src:"../media/all mp4 porn /Amazing Ass7.mp4", tags:["Doggy", "Booty", "Curvy"], status:"published", flagged:false, orientation:"vertical" },
    { id:61, title:"Backshots", creator:"c3", type:"ugc", category:"POV", categories:["POV"], views:13101, likes:156, dislikes:5, comments:0, favorites:0, duration:"0:06", uploaded:"2026-01-05", src:"../media/all mp4 porn /Amazing Ass8.mp4", tags:["Twerk", "Doggy", "Big Ass"], status:"published", flagged:false, orientation:"vertical" },
    { id:62, title:"Perfect Booty", creator:"c1", type:"ugc", category:"Amateur", categories:["Amateur"], views:14806, likes:181, dislikes:18, comments:0, favorites:0, duration:"0:06", uploaded:"2026-02-19", src:"../media/all mp4 porn /Amazing Ass9.mp4", tags:["Big Ass", "Curvy", "Thick"], status:"published", flagged:false },
    { id:63, title:"Phat Ass Babe", creator:"c2", type:"ugc", category:"Big Ass", categories:["Big Ass"], views:14964, likes:142, dislikes:12, comments:4, favorites:0, duration:"0:06", uploaded:"2026-02-28", src:"../media/all mp4 porn /Amazing Ass10.mp4", tags:["Curvy", "Doggy", "Twerk"], status:"published", flagged:false },
    { id:64, title:"Peachy Keen", creator:"c2", type:"ugc", category:"POV", categories:["POV"], views:10225, likes:245, dislikes:12, comments:1, favorites:0, duration:"0:06", uploaded:"2026-06-21", src:"../media/all mp4 porn /Amazing Ass11.mp4", tags:["Twerk", "Booty", "Thick"], status:"published", flagged:false },
    { id:65, title:"Amazing Ass POV", creator:"c2", type:"ugc", category:"Amateur", categories:["Amateur"], views:11005, likes:268, dislikes:8, comments:0, favorites:0, duration:"0:06", uploaded:"2026-01-17", src:"../media/all mp4 porn /Amazing Ass12.mp4", tags:["Thick", "Babe", "Twerk"], status:"published", flagged:false, orientation:"vertical" },
    { id:66, title:"Thick & Juicy", creator:"c4", type:"ugc", category:"Big Ass", categories:["Big Ass"], views:13326, likes:202, dislikes:10, comments:1, favorites:0, duration:"0:06", uploaded:"2026-06-03", src:"../media/all mp4 porn /Amazing Ass13.mp4", tags:["Thick", "Twerk", "Booty"], status:"published", flagged:false, orientation:"vertical" },
    { id:67, title:"Ass Worship", creator:"c2", type:"ugc", category:"POV", categories:["POV"], views:11868, likes:232, dislikes:14, comments:0, favorites:0, duration:"0:06", uploaded:"2026-01-09", src:"../media/all mp4 porn /Amazing Ass14.mp4", tags:["Doggy", "POV", "Amateur"], status:"published", flagged:false, orientation:"vertical" },
    { id:68, title:"Big Ass Compilation", creator:"c4", type:"ugc", category:"Amateur", categories:["Amateur"], views:13127, likes:146, dislikes:11, comments:1, favorites:0, duration:"0:06", uploaded:"2026-01-12", src:"../media/all mp4 porn /Amazing Ass15.mp4", tags:["Big Ass", "Doggy", "POV"], status:"published", flagged:false, orientation:"vertical" },
    { id:69, title:"Booty Call", creator:"c1", type:"ugc", category:"Big Ass", categories:["Big Ass"], views:12960, likes:207, dislikes:19, comments:2, favorites:0, duration:"0:06", uploaded:"2026-06-10", src:"../media/all mp4 porn /Amazing Ass18.mp4", tags:["Curvy", "Amateur", "Twerk"], status:"published", flagged:false, orientation:"vertical" },
    { id:70, title:"Thicc Goddess", creator:"c1", type:"ugc", category:"POV", categories:["POV"], views:11669, likes:270, dislikes:4, comments:0, favorites:0, duration:"0:06", uploaded:"2026-04-18", src:"../media/all mp4 porn /Amazing Ass19.mp4", tags:["POV", "Babe", "Big Ass"], status:"published", flagged:false, orientation:"vertical" },
    { id:71, title:"Ass-tastic", creator:"c1", type:"ugc", category:"Amateur", categories:["Amateur"], views:10866, likes:229, dislikes:10, comments:3, favorites:0, duration:"0:06", uploaded:"2026-01-28", src:"../media/all mp4 porn /Amazing Ass20.mp4", tags:["Amateur", "Curvy", "Doggy"], status:"published", flagged:false, orientation:"vertical" },
    { id:72, title:"Booty Goals", creator:"c4", type:"ugc", category:"Big Ass", categories:["Big Ass"], views:14906, likes:176, dislikes:9, comments:0, favorites:0, duration:"0:06", uploaded:"2026-06-04", src:"../media/all mp4 porn /Amazing Ass21.mp4", tags:["Thick", "Doggy", "Twerk"], status:"published", flagged:false, orientation:"vertical" },
  ],

  comments: [
    { id:"m1", video:1, user:"Maya Chen",  text:"This is incredible quality!", time:"2h" },
    { id:"m2", video:1, user:"DevTalks",   text:"Loved the pacing on this one.", time:"5h" },
    { id:"m3", video:1, user:"Alex",       text:"House Originals never miss.", time:"1d" },
    { id:"m4", video:2, user:"Alex",       text:"Great vibe 🎵", time:"3h" },
    { id:"m5", video:3, user:"Maya Chen",  text:"spam link here buy now", time:"1h", flagged:true },
  ],

  revenue: { total:18420, ads:7200, premium:6100, subscriptions:3400, tips:920, affiliate:800, sponsors:1200,
    history:[ {m:"Jan",v:9200},{m:"Feb",v:10100},{m:"Mar",v:11800},{m:"Apr",v:13400},{m:"May",v:15600},{m:"Jun",v:18420} ] },

  analytics: {
    views7d:[4200,5100,4800,6300,7100,6800,8200],
    retention:[100,82,71,63,55,49,44,41,38,36],
    countries:[ {c:"United States",p:38},{c:"India",p:14},{c:"Germany",p:9},{c:"Brazil",p:7},{c:"France",p:6},{c:"Other",p:26} ],
    devices:[ {c:"Mobile",p:58},{c:"Desktop",p:31},{c:"TV",p:8},{c:"Tablet",p:3} ],
    traffic:[ {c:"Recommendations",p:44},{c:"Search",p:22},{c:"External",p:16},{c:"Direct",p:11},{c:"Channels",p:7} ],
  },

  system: {
    dau:84200, mau:1240000, uptime:"99.98%", uploadsToday:312,
    moderationQueue:14, storageTB:48.2, processingQueue:6, errors:3,
    bandwidthTB:128, cdnCost:4120,
  },

  users: [
    { id:"u1", name:"Alex", email:"alex@mail.com", role:"creator", status:"active", subs:"Premium", joined:"2025-11-02" },
    { id:"u2", name:"Maya Chen", email:"maya@mail.com", role:"creator", status:"active", subs:"Premium", joined:"2025-09-14" },
    { id:"u3", name:"Sam Rivera", email:"sam@mail.com", role:"viewer", status:"suspended", subs:"Free", joined:"2026-01-20" },
    { id:"u4", name:"Jordan Lee", email:"jordan@mail.com", role:"viewer", status:"active", subs:"Premium", joined:"2026-03-05" },
    { id:"u5", name:"Casey Kim", email:"casey@mail.com", role:"viewer", status:"banned", subs:"Free", joined:"2026-02-11" },
  ],

  flags: [
    { key:"new_homepage", desc:"New homepage layout A/B test", on:true, rollout:50 },
    { key:"ai_thumbnails", desc:"AI thumbnail generation", on:true, rollout:100 },
    { key:"live_streaming", desc:"Creator live streaming", on:false, rollout:0 },
    { key:"watch_parties", desc:"Synchronized watch parties", on:false, rollout:10 },
    { key:"short_form_feed", desc:"Vertical short-form feed", on:true, rollout:25 },

  ],

  moderation: {
    classes:[ {c:"NSFW",n:18},{c:"Violence",n:4},{c:"Spam",n:23},{c:"Copyright",n:7},{c:"Hate Speech",n:2},{c:"Deepfake",n:1},{c:"Fake Engagement",n:11} ],
  },
};

/* ---- Lazy full-catalog load ----
   DATA.videos above is only a small SEED (first ~72 entries) so the shell +
   first screen paint immediately without parsing the ~1.9 MB full catalog. The
   complete list lives in ./catalog-videos.js and is code-split into its own
   chunk, fetched and parsed off the critical path. On resolve we merge in every
   entry not already present (preserving the seed's identity and anything the
   manifest sync / live-upload merge unshifted in the meantime), then the caller
   re-renders. Idempotent — safe to await more than once. */
let _fullCatalogPromise = null;
function loadFullCatalog(){
  if(_fullCatalogPromise) return _fullCatalogPromise;
  _fullCatalogPromise = import("./catalog-videos.js")
    .then(({ VIDEOS }) => {
      const canonical = new Set(VIDEOS.map(v => v.id));
      // Entries added at runtime (manifest sync / live uploads) that aren't in
      // the canonical list — keep them, front of the list like unshift did.
      const extras = DATA.videos.filter(v => !canonical.has(v.id));
      DATA.videos = extras.concat(VIDEOS);
      return DATA.videos;
    })
    .catch((e) => {
      // Network/parse failure: keep the seed so the site still works degraded.
      console.error("Full catalog failed to load; running on seed only.", e);
      _fullCatalogPromise = null;   // allow a retry on next call
      return DATA.videos;
    });
  return _fullCatalogPromise;
}

export { MEDIA_BASE, DATA, esc, creatorName, creatorVerified, fmt, toast, mediaUrl, ytId, loadFullCatalog };
