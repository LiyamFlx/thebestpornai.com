/* ============================================================
   SHARED SAMPLE DATA MODEL — Hybrid Video Platform
   Used by viewer / creator / manager apps.
   ============================================================ */
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
    { id:1, title:"Spotlight Premiere", creator:"c1", type:"original", category:"POV", views:22000, likes:2400, dislikes:30, comments:3, favorites:0, duration:"0:10", uploaded:"2026-06-01", src:"../media/sample-1.mp4", status:"published", flagged:false },
    { id:2, title:"Late Night Sessions", creator:"c2", type:"ugc", category:"Boy Girl", views:3400, likes:310, dislikes:8, comments:1, favorites:0, duration:"0:10", uploaded:"2026-06-12", src:"../media/sample-2.mp4", status:"published", flagged:false },
    { id:3, title:"Behind The Scenes", creator:"c3", type:"ugc", category:"Girl Girl", views:7800, likes:640, dislikes:12, comments:2, favorites:0, duration:"0:10", uploaded:"2026-06-09", src:"../media/sample-3.mp4", status:"published", flagged:true },
    { id:4, title:"Featured Exclusive", creator:"c1", type:"original", category:"Beauty", views:18500, likes:1900, dislikes:20, comments:0, favorites:0, duration:"0:10", uploaded:"2026-05-28", src:"../media/sample-1.mp4", status:"published", flagged:false },
    { id:5, title:"Creator Spotlight", creator:"c2", type:"ugc", category:"Boy Boy", views:5200, likes:480, dislikes:5, comments:0, favorites:0, duration:"0:10", uploaded:"2026-06-18", src:"../media/sample-2.mp4", status:"published", flagged:false },
    { id:6, title:"Fan Favorites", creator:"c4", type:"ugc", category:"POV", views:2100, likes:190, dislikes:3, comments:0, favorites:0, duration:"0:10", uploaded:"2026-06-20", src:"../media/sample-3.mp4", status:"published", flagged:false },
    { id:7, title:"Headliner Feature", creator:"c1", type:"original", category:"Big", views:14300, likes:1500, dislikes:18, comments:0, favorites:0, duration:"0:10", uploaded:"2026-06-03", src:"../media/sample-1.mp4", status:"published", flagged:false },
    { id:8, title:"Trending Now", creator:"c3", type:"ugc", category:"Beauty", views:9100, likes:720, dislikes:9, comments:0, favorites:0, duration:"0:10", uploaded:"2026-06-22", src:"../media/sample-2.mp4", status:"review", flagged:true },
    { id:9, title:"Community Picks", creator:"c4", type:"ugc", category:"AI", views:4600, likes:410, dislikes:6, comments:0, favorites:0, duration:"0:10", uploaded:"2026-06-24", src:"../media/sample-3.mp4", status:"published", flagged:false },
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
  if(v.src) return `<video class="player" src="${v.src}" controls></video>`;
  return `<div class="player">VIDEO STREAM — ${v.title}</div>`;
}

function videoCard(v, opts={}){
  const thumb = v.thumb
    ? `<img class="thumb-video" src="${v.thumb}" alt=""/>`
    : (v.src && !ytId(v.src)
        ? `<video class="thumb-video" src="${v.src}#t=0.1" muted preload="metadata" playsinline></video>` : ``);
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
