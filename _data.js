/* ============================================================
   SHARED SAMPLE DATA MODEL — Hybrid Video Platform
   Used by viewer / creator / manager apps.
   ============================================================ */

/* Where video files are streamed from.
   - ""  -> use the local ../media/ files (offline / Start.command)
   - CDN -> stream from Bunny.net so the PUBLIC deploy can play them
   Files on the CDN must be named vid-1.mp4 … vid-31.mp4 (+ sample-*.mp4). */
const MEDIA_BASE = "https://streamhub-media.b-cdn.net";

/* Rewrite a "../media/x.mp4" path to the CDN when MEDIA_BASE is set */
function mediaUrl(src){
  if(!src) return src;
  if(/^https?:\/\//.test(src) || src.startsWith("blob:") || src.startsWith("data:")) return src;
  if(!MEDIA_BASE) return src;                       // local mode, keep relative path
  const file = src.split("/").pop();                // -> original filename
  return MEDIA_BASE.replace(/\/$/,"") + "/" + encodeURIComponent(file);
}

const DATA = {
  user: { id:"u1", name:"Alex", handle:"@alex", avatar:"A", subscriptions:42, role:"viewer" },

  creators: [
    { id:"c1", name:"House Originals", handle:"@house", subs:1240000, verified:true },
    { id:"c2", name:"Maya Chen",       handle:"@maya",  subs:84000,   verified:true },
    { id:"c3", name:"DevTalks",        handle:"@devtalks", subs:31000, verified:false },
    { id:"c4", name:"Alex",            handle:"@alex",  subs:1240,     verified:false },
  ],

  categories: ["POV","Big","Beauty","AI","Boy Girl","Girl Girl","Boy Boy","Blowjob","Threesome","Blond","18-25","Amateur","Asian","Babe","Anal"],

  videos: [
    { id:1, title:"Blonde Office Twerk", creator:"c3", type:"ugc", category:"Blond", views:10686, likes:871, dislikes:5, comments:0, favorites:0, duration:"0:10", uploaded:"2026-05-04", src:"../media/Blonde Office Twerk video by ttt-ai on DeviantArt.mp4", status:"published", flagged:false },
    { id:2, title:"HUge TITS PINK00005", creator:"c1", type:"original", category:"Big", views:34055, likes:2287, dislikes:7, comments:3, favorites:0, duration:"0:10", uploaded:"2026-04-03", src:"../media/HUge TITS PINK00005.mp4", status:"published", flagged:false },
    { id:3, title:"Naked surfer G2159", creator:"c4", type:"ugc", category:"Boy Boy", views:4673, likes:542, dislikes:9, comments:1, favorites:0, duration:"0:10", uploaded:"2026-06-21", src:"../media/Naked surfer -G2159 video by The-Satin-Pause on DeviantArt.mp4", status:"published", flagged:false },
    { id:4, title:"Perfect Pussy Twerk", creator:"c1", type:"original", category:"Babe", views:38621, likes:3740, dislikes:5, comments:1, favorites:0, duration:"0:10", uploaded:"2026-01-18", src:"../media/Perfect Pussy Twerk .mp4", status:"published", flagged:false },
    { id:5, title:"Perfect doggy cumming00001", creator:"c3", type:"ugc", category:"Anal", views:28268, likes:1739, dislikes:9, comments:4, favorites:0, duration:"0:10", uploaded:"2026-03-18", src:"../media/Perfect doggy cumming00001.mp4", status:"published", flagged:false },
    { id:6, title:"Sexy by SexyGirls2", creator:"c2", type:"ugc", category:"Asian", views:7553, likes:729, dislikes:14, comments:2, favorites:0, duration:"0:10", uploaded:"2026-01-18", src:"../media/Sexy by SexyGirls2 on DeviantArt (4).mp4", status:"published", flagged:false },
    { id:7, title:"Solo beach walk G2630", creator:"c1", type:"original", category:"POV", views:41367, likes:2749, dislikes:36, comments:3, favorites:0, duration:"0:10", uploaded:"2026-03-15", src:"../media/Solo beach walk -G2630 video by The-Satin-Pause on DeviantArt (7).mp4", status:"published", flagged:false },
    { id:8, title:"Solo beach walk", creator:"c4", type:"ugc", category:"Amateur", views:24496, likes:1812, dislikes:13, comments:1, favorites:0, duration:"0:10", uploaded:"2026-01-19", src:"../media/Solo beach walk.mp4", status:"published", flagged:false },
    { id:9, title:"Sunscreen G2718", creator:"c4", type:"ugc", category:"Blowjob", views:23310, likes:2525, dislikes:20, comments:4, favorites:0, duration:"0:10", uploaded:"2026-01-04", src:"../media/Sunscreen -G2718 video by The-Satin-Pause on DeviantArt.mp4", status:"published", flagged:false },
    { id:10, title:"Surrender to nature G2538", creator:"c2", type:"ugc", category:"Amateur", views:23216, likes:1443, dislikes:33, comments:3, favorites:0, duration:"0:10", uploaded:"2026-01-22", src:"../media/Surrender to nature -G2538 video by The-Satin-Pause on DeviantArt.mp4", status:"published", flagged:true },
    { id:11, title:"All", creator:"c3", type:"ugc", category:"POV", views:23090, likes:2438, dislikes:40, comments:3, favorites:0, duration:"0:10", uploaded:"2026-05-26", src:"../media/all.mp4", status:"published", flagged:false },
    { id:12, title:"Amazing 18", creator:"c1", type:"original", category:"18-25", views:18490, likes:1625, dislikes:6, comments:0, favorites:0, duration:"0:10", uploaded:"2026-06-23", src:"../media/amazing 18.mp4", status:"published", flagged:false },
    { id:13, title:"Amazing big natural", creator:"c4", type:"ugc", category:"Big", views:19451, likes:2087, dislikes:24, comments:0, favorites:0, duration:"0:10", uploaded:"2026-04-12", src:"../media/amazing big natural.mp4", status:"published", flagged:false },
    { id:14, title:"Anazing girls on the beach", creator:"c1", type:"original", category:"Girl Girl", views:33154, likes:1814, dislikes:20, comments:1, favorites:0, duration:"0:10", uploaded:"2026-06-08", src:"../media/anazing girls on the beach.mp4", status:"published", flagged:false },
    { id:15, title:"Beauty girl", creator:"c4", type:"ugc", category:"Beauty", views:6080, likes:384, dislikes:27, comments:4, favorites:0, duration:"0:10", uploaded:"2026-03-05", src:"../media/beauty girl.mp4", status:"published", flagged:false },
    { id:16, title:"Big natural", creator:"c3", type:"ugc", category:"Big", views:28016, likes:3611, dislikes:26, comments:1, favorites:0, duration:"0:10", uploaded:"2026-02-03", src:"../media/big natural.mp4", status:"published", flagged:false },
    { id:17, title:"Blond girl having fun", creator:"c2", type:"ugc", category:"Blond", views:43956, likes:3018, dislikes:33, comments:4, favorites:0, duration:"0:10", uploaded:"2026-02-09", src:"../media/blond girl having fun.mp4", status:"published", flagged:false },
    { id:18, title:"Blond", creator:"c2", type:"ugc", category:"Blond", views:28256, likes:2621, dislikes:38, comments:2, favorites:0, duration:"0:10", uploaded:"2026-02-23", src:"../media/blond.mp4", status:"published", flagged:false },
    { id:19, title:"Blondy ai", creator:"c1", type:"original", category:"Blond", views:30726, likes:3747, dislikes:37, comments:3, favorites:0, duration:"0:10", uploaded:"2026-04-13", src:"../media/blondy ai.mp4", status:"published", flagged:false },
    { id:20, title:"Comming gitls", creator:"c4", type:"ugc", category:"Amateur", views:42368, likes:3475, dislikes:14, comments:0, favorites:0, duration:"0:10", uploaded:"2026-02-15", src:"../media/comming gitls.mp4", status:"published", flagged:false },
    { id:21, title:"AI Generated Clip (1)", creator:"c3", type:"ugc", category:"AI", views:40169, likes:2177, dislikes:2, comments:4, favorites:0, duration:"0:10", uploaded:"2026-02-18", src:"../media/grok-video-356eddc7-87b2-4217-9418-ddc9ff6d900a (1).mp4", status:"published", flagged:true },
    { id:22, title:"AI Generated Clip (12)", creator:"c3", type:"ugc", category:"AI", views:41021, likes:2134, dislikes:15, comments:4, favorites:0, duration:"0:10", uploaded:"2026-04-05", src:"../media/grok-video-db383327-45a9-4339-a5a5-22973570fb5c (12).mp4", status:"published", flagged:false },
    { id:23, title:"Redhead", creator:"c3", type:"ugc", category:"Boy Girl", views:40270, likes:3186, dislikes:9, comments:0, favorites:0, duration:"0:10", uploaded:"2026-04-15", src:"../media/redhead.mp4", status:"published", flagged:false },
    { id:24, title:"Robo sex ai", creator:"c3", type:"ugc", category:"AI", views:6428, likes:395, dislikes:23, comments:2, favorites:0, duration:"0:10", uploaded:"2026-04-27", src:"../media/robo-sex ai.mp4", status:"published", flagged:false },
    { id:25, title:"Robo sex", creator:"c1", type:"original", category:"AI", views:14248, likes:1796, dislikes:35, comments:2, favorites:0, duration:"0:10", uploaded:"2026-02-23", src:"../media/robo-sex.mp4", status:"published", flagged:false },
    { id:26, title:"Sexy milf", creator:"c1", type:"original", category:"Babe", views:35410, likes:2614, dislikes:7, comments:2, favorites:0, duration:"0:10", uploaded:"2026-05-12", src:"../media/sexy milf.mp4", status:"published", flagged:false },
    { id:27, title:"She is comming", creator:"c3", type:"ugc", category:"Amateur", views:15400, likes:1426, dislikes:34, comments:2, favorites:0, duration:"0:10", uploaded:"2026-06-08", src:"../media/she is comming.mp4", status:"published", flagged:false },
    { id:28, title:"Suger daddy", creator:"c2", type:"ugc", category:"Babe", views:16488, likes:1903, dislikes:16, comments:1, favorites:0, duration:"0:10", uploaded:"2026-05-16", src:"../media/suger-daddy.mp4", status:"published", flagged:false },
    { id:29, title:"The best sexy cyber", creator:"c1", type:"original", category:"AI", views:2630, likes:297, dislikes:32, comments:2, favorites:0, duration:"0:10", uploaded:"2026-02-23", src:"../media/the best sexy cyber.mp4", status:"published", flagged:false },
    { id:30, title:"Threesome girls", creator:"c3", type:"ugc", category:"Threesome", views:30109, likes:3453, dislikes:24, comments:2, favorites:0, duration:"0:10", uploaded:"2026-01-08", src:"../media/threesome girls.mp4", status:"published", flagged:true },
    { id:31, title:"Threesome girls2", creator:"c4", type:"ugc", category:"Threesome", views:13691, likes:1054, dislikes:32, comments:4, favorites:0, duration:"0:10", uploaded:"2026-05-27", src:"../media/threesome girls2.mp4", status:"published", flagged:true },
  ],

  comments: [
    { id:"m1", video:1, user:"Maya Chen",  text:"This is incredible quality!", time:"2h" },
    { id:"m2", video:1, user:"DevTalks",   text:"Loved the pacing on this one.", time:"5h" },
    { id:"m3", video:1, user:"Alex",       text:"House Originals never miss.", time:"1d" },
    { id:"m4", video:2, user:"Alex",       text:"Great vibe 🎵", time:"3h" },
    { id:"m5", video:3, user:"Maya Chen",  text:"spam link here buy now", time:"1h", flagged:true },
  ],

  revenue: { total:18420, ads:7200, premium:6100, subscriptions:3400, tips:920, affiliate:800,
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

/* ---------- shared helpers ---------- */
function creatorName(id){ const c = DATA.creators.find(x=>x.id===id); return c?c.name:"Unknown"; }
function fmt(n){ return n>=1000000 ? (n/1000000).toFixed(1)+"M" : n>=1000 ? (n/1000).toFixed(1)+"K" : ""+n; }
function ytId(url){ if(!url) return null; const m=url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/); return m?m[1]:null; }

function playerEmbed(v){
  const yt = ytId(v.src);
  if(yt) return `<iframe class="player" src="https://www.youtube.com/embed/${yt}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
  if(v.src) return `<video class="player" src="${mediaUrl(v.src)}" controls></video>`;
  return `<div class="player">VIDEO STREAM — ${v.title}</div>`;
}

function videoCard(v, opts={}){
  const thumb = v.thumb
    ? `<img class="thumb-video" src="${v.thumb}" alt=""/>`
    : (v.src && !ytId(v.src)
        ? `<video class="thumb-video" src="${mediaUrl(v.src)}#t=0.1" muted preload="metadata" playsinline></video>` : ``);
  return `
    <div class="card" onclick="${opts.onClick || `openVideo(${v.id})`}">
      <div class="video-thumb ${v.type==='original'?'original':''}">
        ${thumb}
        ${v.duration?`<span class="dur-badge">${v.duration}</span>`:``}
        ${v.src?`<span class="play-badge">▶</span>`:``}
      </div>
      <div class="title">${v.title}</div>
      <div class="meta">${creatorName(v.creator)} • ${fmt(v.views)} views</div>
      ${opts.extra ? opts.extra(v) : ``}
    </div>`;
}

/* toast (expects a #toast element) */
let _toastTimer;
function toast(msg){
  const t=document.getElementById("toast"); if(!t) return;
  t.textContent=msg; t.classList.add("show");
  clearTimeout(_toastTimer); _toastTimer=setTimeout(()=>t.classList.remove("show"),2400);
}

/* simple CSS bar chart */
function barChart(values, labels){
  const max = Math.max(...values,1);
  return `
    <div class="bars">${values.map(v=>`<div class="bar" style="height:${Math.round(v/max*100)}%"></div>`).join("")}</div>
    <div class="bars-x">${(labels||values.map((_,i)=>i+1)).map(l=>`<div>${l}</div>`).join("")}</div>`;
}
/* horizontal distribution rows */
function distRows(arr){
  return arr.map(d=>`
    <div style="margin:10px 0">
      <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">
        <span>${d.c}</span><span class="small">${d.p}%</span>
      </div>
      <div style="height:6px;background:var(--surface3);border-radius:999px;overflow:hidden">
        <div style="height:100%;width:${d.p}%;background:linear-gradient(90deg,var(--accent),var(--accent2))"></div>
      </div>
    </div>`).join("");
}
