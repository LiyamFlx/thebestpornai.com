import { MEDIA_BASE, DATA, esc, creatorName, fmt, toast, mediaUrl } from "../shared/catalog.js";
import { ShAuth, ShAPI } from "../shared/streamhub-api.js";
import { metric, barChart, distRows } from "../shared/ui.js";
import { ageGate } from "../shared/age-gate.js";
ageGate();

/* creatorName(), fmt(), toast() are shared — defined in catalog.js */

/* ===================== PLATFORM MANAGER ===================== */
let mstate = { page:"overview" };
function go(p){ mstate.page=p; render(); if(p==="moderation") loadModeration(); }

/* ---- Auth gate: moderation writes require sign-in (RLS restricts the
   moderation table's insert policy to the `authenticated` role). ---- */
function authReady(){ return typeof ShAuth!=="undefined"; }
function renderModSignIn(){
  return `<h1>Sign in to moderate</h1>
    <p class="sub">One account for the whole site. Sign in once and you stay signed in — for moderating, uploading, everything.</p>
    <div class="panel" style="max-width:440px">
      <label class="lbl">Email</label>
      <input class="fld" id="modAuthEmail" type="email" placeholder="you@email.com" autocomplete="email"/>
      <label class="lbl" style="margin-top:10px">Password</label>
      <input class="fld" id="modAuthPass" type="password" placeholder="Password (min 6 characters)" autocomplete="current-password" minlength="6"/>
      <div id="modAuthMsg" class="small" style="margin:10px 0;min-height:16px"></div>
      <button class="btn" onclick="doModSignIn()">Sign in / Create account</button>
    </div>`;
}
async function doModSignIn(){
  const email=(document.getElementById("modAuthEmail")?.value||"").trim();
  const pass=document.getElementById("modAuthPass")?.value||"";
  const msg=document.getElementById("modAuthMsg");
  if(!email || email.indexOf("@")<1){ if(msg) msg.textContent="Please enter a valid email."; return; }
  if(!pass || pass.length<6){ if(msg) msg.textContent="Password must be at least 6 characters."; return; }
  if(msg){ msg.style.color="var(--muted)"; msg.textContent="Signing in…"; }
  try {
    await ShAuth.signInWithPassword(email, pass);
    if(msg){ msg.style.color="var(--good)"; msg.textContent="Signed in!"; }
    render();
  } catch(e){
    if(msg){ msg.style.color="var(--accent2)"; msg.textContent=e.message||"Sign-in failed, try again"; }
  }
}

function renderOverview(){
  const s=DATA.system;
  return `<h1>Overview</h1><p class="sub">Platform operating system — real-time state</p>
    <div class="metrics">
      ${metric("DAU",fmt(s.dau),"▲ 3.2%",true)}
      ${metric("MAU",fmt(s.mau),"▲ 1.8%",true)}
      ${metric("Revenue (mo)","$184K","▲ 12%",true)}
      ${metric("Watch Time","2.4M hrs","▲ 6%",true)}
      ${metric("Uploads Today",s.uploadsToday,"",true)}
      ${metric("Moderation Queue",s.moderationQueue,"needs review")}
      ${metric("Storage",s.storageTB+" TB","")}
      ${metric("Processing Queue",s.processingQueue,"")}
      ${metric("Errors (24h)",s.errors,"")}
      ${metric("System Status","Healthy","99.98% uptime",true)}
    </div>
    <div class="grid" style="grid-template-columns:2fr 1fr;margin-top:18px">
      <div class="panel"><h3 style="margin-top:0">Daily Active Users</h3>${barChart([72,75,79,81,80,83,84],["M","T","W","T","F","S","S"])}</div>
      <div class="panel"><h3 style="margin-top:0">Moderation Queue</h3>${distRows(DATA.moderation.classes.map(c=>({c:c.c,p:Math.min(c.n*4,100)})))}</div>
    </div>`;
}

function renderUsers(){
  return `<h1>Users</h1><p class="sub">${DATA.users.length} accounts</p>
    <input class="search-input" style="width:260px;margin-bottom:14px" placeholder="Search users…"/>
    <div class="panel" style="padding:0"><table class="data">
      <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Plan</th><th>Joined</th><th>Actions</th></tr></thead><tbody>
      ${DATA.users.map(u=>`<tr>
        <td><b>${esc(u.name)}</b></td><td class="small">${esc(u.email)}</td><td>${esc(u.role)}</td>
        <td><span class="tag-pill ${u.status==='active'?'green':u.status==='suspended'?'warn':'red'}">${esc(u.status)}</span></td>
        <td>${esc(u.subs)}</td><td class="small">${esc(u.joined)}</td>
        <td><button class="chip" onclick="toast('Warned ${esc(u.name)} (simulated)')">Warn</button>
            <button class="chip" onclick="toast('Suspended ${esc(u.name)} (simulated)')">Suspend</button>
            <button class="chip" style="color:var(--accent2);border-color:var(--accent2)" onclick="toast('Banned ${esc(u.name)} (simulated)')">Ban</button></td></tr>`).join("")}
    </tbody></table></div>`;
}

function renderCreators(){
  return `<h1>Creators</h1><p class="sub">${DATA.creators.length} channels</p>
    <div class="grid">${DATA.creators.map(c=>`<div class="card">
      <div style="display:flex;align-items:center;gap:10px"><div class="avatar">${esc((c.name||"?")[0])}</div>
      <div><div class="title">${esc(c.name)} ${c.verified?'✔️':''}</div><div class="meta">${fmt(c.subs)} subscribers</div></div></div>
      <div class="card-actions"><span class="chip" onclick="toast('Viewing ${esc(c.name)}')">View</span><span class="chip" onclick="toast('Featured ${esc(c.name)} (simulated)')">Feature</span></div>
    </div>`).join("")}</div>`;
}

let _videoTablePage = 0;
const VIDEOS_PER_PAGE = 25;

function renderVideos(){
  const total = DATA.videos.length;
  const pages = Math.max(1, Math.ceil(total / VIDEOS_PER_PAGE));
  _videoTablePage = Math.min(_videoTablePage, pages - 1);
  const start = _videoTablePage * VIDEOS_PER_PAGE;
  const pageItems = DATA.videos.slice(start, start + VIDEOS_PER_PAGE);
  return `<h1>Videos</h1><p class="sub">Full catalog · ${total} videos · page ${_videoTablePage+1} of ${pages}</p>
    <div class="panel" style="padding:0"><table class="data">
      <thead><tr><th>Title</th><th>Creator</th><th>Category</th><th>Views</th><th>Status</th><th>Flag</th></tr></thead><tbody>
      ${pageItems.map(v=>`<tr>
        <td><b>${esc(v.title)}</b></td><td>${esc(creatorName(v.creator))}</td><td>${esc(v.category)}</td><td>${fmt(v.views)}</td>
        <td><span class="tag-pill ${v.status==='published'?'green':'warn'}">${esc(v.status)}</span></td>
        <td>${v.flagged?'<span class="tag-pill red">⚑ flagged</span>':'<span class="small">—</span>'}</td></tr>`).join("")}
    </tbody></table></div>
    <div style="display:flex;gap:8px;margin-top:10px">
      <button class="chip" ${_videoTablePage===0?'disabled':''} onclick="videosPrevPage()">← Prev</button>
      <button class="chip" ${_videoTablePage>=pages-1?'disabled':''} onclick="videosNextPage()">Next →</button>
    </div>`;
}
function videosPrevPage(){ if(_videoTablePage>0){ _videoTablePage--; render(); } }
function videosNextPage(){
  const pages = Math.max(1, Math.ceil(DATA.videos.length / VIDEOS_PER_PAGE));
  if(_videoTablePage < pages-1){ _videoTablePage++; render(); }
}

/* Moderation queue = flagged catalog videos + creator uploads awaiting review
   (Supabase `uploads` table) + open manifest uploads awaiting review (R2
   manifest.json, written status:"pending" by api/save-upload.js).
   _modDecisions holds the latest persisted decision per video so actioned items
   drop out of the queue across reloads/sessions. */
let _modDecisions = {};
let _modUploads = [];
let _modPending = [];
const MANIFEST_URL = "https://pub-b281e1d5ecb94a148bd620f8a2fe9d55.r2.dev/manifest.json";

async function loadModeration(){
  try {
    const r = await fetch(MANIFEST_URL + "?t=" + Date.now(), { cache: "no-store" });
    const list = r.ok ? await r.json() : [];
    _modPending = Array.isArray(list) ? list.filter(v => v && v.status === "pending") : [];
  } catch(_){ _modPending = []; }

  if(typeof ShAPI==="undefined" || !ShAPI.enabled){ if(mstate.page==="moderation") render(); return; }
  try {
    const [dec, ups] = await Promise.all([ ShAPI.latestDecisions(), ShAPI.listUploadedVideos() ]);
    // Merge server decisions in WITHOUT clobbering optimistic local ones.
    _modDecisions = Object.assign({}, dec, _modDecisions);
    _modUploads = ups;
    if(mstate.page==="moderation") render();
  } catch(_){}
}

async function modAction(videoId, action, kind){
  toast("Working…");
  if(kind==="manifest"){
    try {
      const sess = ShAuth.session();
      if(!sess) throw new Error("sign in required");
      const r = await fetch("/api/moderate-manifest", {
        method:"POST",
        headers:{ "Content-Type":"application/json", "Authorization":"Bearer "+sess.access_token },
        body: JSON.stringify({ id: videoId, action: action==="escalate" ? "approve" : action }),
      });
      if(!r.ok) throw new Error((await r.json().catch(()=>({})))?.error || ("status "+r.status));
      _modDecisions[String(videoId)] = action;
      toast(action.charAt(0).toUpperCase()+action.slice(1)+"d");
      await loadModeration();
    } catch(e){
      toast("Action failed to save — "+(e.message||"please retry"));
    }
    render();
    return;
  }
  if(typeof ShAPI!=="undefined" && ShAPI.enabled){
    let mod=""; try{ if(typeof ShAuth!=="undefined"){ const u=await ShAuth.user(); mod=u&&u.email||""; } }catch(_){}
    try {
      await ShAPI.moderate(videoId, action, null, mod);
      _modDecisions[String(videoId)] = action;   // only mark decided after confirmed persist
      toast(action.charAt(0).toUpperCase()+action.slice(1)+"d");
    } catch(_){
      toast("Action failed to save — please retry");
    }
  } else {
    // API not configured: keep prior local-only behavior.
    _modDecisions[String(videoId)] = action;
    toast(action.charAt(0).toUpperCase()+action.slice(1)+"d (local only)");
  }
  render();
}

function renderModeration(){
  if(authReady() && !ShAuth.isSignedIn()) return renderModSignIn();
  const decided = id => { const d=_modDecisions[String(id)]; return d==="approve"||d==="remove"; };
  const flagged = DATA.videos.filter(v=>v.flagged && !decided(v.id));
  const reviews = (_modUploads||[]).filter(u=>(u.status==="review") && !decided(u.id));
  const pending = (_modPending||[]).filter(u=>!decided(u.id));
  const queue = [
    ...pending.map(u=>({ id:u.id, title:u.title, who:u.creator||"upload", src:u.src, why:"New open upload — pending review", isUpload:true, kind:"manifest" })),
    ...reviews.map(u=>({ id:u.id, title:u.title, who:u.creator||"upload", src:u.src, why:"New upload — pending review", isUpload:true, kind:"supabase" })),
    ...flagged.map(v=>({ id:v.id, title:v.title, who:creatorName(v.creator), src:v.src, why:"Flagged for review (demo data — not a real classifier signal)", isUpload:false, kind:"supabase" })),
  ];
  return `<h1>Content Moderation</h1><p class="sub">${queue.length} items in queue</p>
    <div class="tabs"><button class="active">Review Queue</button><button onclick="loadModeration()">↻ Refresh</button></div>
    ${queue.length? queue.map(it=>`<div class="panel" style="margin-bottom:10px;display:flex;gap:14px;align-items:center">
      <div class="video-thumb" style="width:120px;height:68px;margin:0;flex:none">${it.src?`<video class="thumb-video lazy" data-src="${mediaUrl(it.src)}#t=1" muted preload="none"></video>`:``}</div>
      <div style="flex:1"><b>${esc(it.title)}</b>${it.isUpload?' <span class="tag-pill warn">upload</span>':''}<div class="small">${esc(it.who)} • ${esc(it.why)}</div></div>
      <div><button class="chip" style="color:var(--good);border-color:var(--good)" onclick="modAction('${esc(String(it.id))}','approve','${it.kind}')">Approve</button>
           <button class="chip" style="color:var(--accent2);border-color:var(--accent2)" onclick="modAction('${esc(String(it.id))}','remove','${it.kind}')">Remove</button>
           <button class="chip" onclick="modAction('${esc(String(it.id))}','escalate','${it.kind}')">Escalate</button></div>
    </div>`).join("") : `<div class="empty">Queue clear — nothing awaiting review. 🎉</div>`}`;
}

function renderHomepage(){
  const blocks=["Hero","Continue Watching","Trending","Categories","Recommendations","Sponsored","Originals"];
  return `<h1>Homepage Builder</h1><p class="sub">Arrange the viewer home layout (drag to reorder — simulated)</p>
    <div style="max-width:560px">${blocks.map((b,i)=>`<div class="panel" style="margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;cursor:grab">
      <span>⠿ <b>${b}</b></span><div><button class="chip" onclick="toast('Moved ${b} up (simulated)')">↑</button><button class="chip" onclick="toast('Moved ${b} down (simulated)')">↓</button><button class="chip" onclick="toast('Hidden ${b} (simulated)')">Hide</button></div>
    </div>`).join("")}</div><br/><button class="btn" onclick="toast('Homepage layout published (simulated)')">Publish Layout</button>`;
}

function renderRecommendations(){
  return `<h1>Recommendation Engine</h1><p class="sub">Tune ranking signals</p>
    <div class="grid" style="grid-template-columns:1fr 1fr">
      <div class="panel"><h3 style="margin-top:0">Ranking Signal Weights</h3>
        ${[["Watch time",70],["Likes",55],["Freshness",40],["Click-through",60],["Subscriptions",45]].map(([k,v])=>`
          <label class="lbl">${k} — ${v}%</label><input type="range" min="0" max="100" value="${v}" style="width:100%" oninput="this.previousElementSibling.textContent='${k} — '+this.value+'%'"/>`).join("")}
        <br/><button class="btn sm" onclick="toast('Weights saved (simulated)')">Save</button></div>
      <div class="panel"><h3 style="margin-top:0">A/B Tests</h3>
        <table class="data"><thead><tr><th>Test</th><th>Split</th><th>Status</th></tr></thead><tbody>
        <tr><td>New ranking v2</td><td>50/50</td><td><span class="tag-pill green">Running</span></td></tr>
        <tr><td>Cold-start boost</td><td>20/80</td><td><span class="tag-pill warn">Paused</span></td></tr>
        </tbody></table></div>
    </div>`;
}

function renderAImod(){
  return `<h1>AI Moderation</h1><p class="sub">Automated detection across content</p>
    <div class="metrics">${DATA.moderation.classes.map(c=>metric(c.c,c.n,"flags")).join("")}</div>
    <div class="panel" style="margin-top:16px"><h3 style="margin-top:0">Detection Volume</h3>
      ${distRows(DATA.moderation.classes.map(c=>({c:c.c,p:Math.min(c.n*4,100)})))}</div>`;
}

function renderStorage(){
  const s=DATA.system;
  return `<h1>Storage</h1><p class="sub">Infrastructure usage & cost</p>
    <div class="metrics">
      ${metric("Total Storage",s.storageTB+" TB")}${metric("Bandwidth (mo)",s.bandwidthTB+" TB")}
      ${metric("CDN Cost (mo)","$"+s.cdnCost.toLocaleString())}${metric("Transcoding Jobs",s.processingQueue+" active")}
    </div>
    <div class="panel" style="margin-top:8px"><h3 style="margin-top:0">Storage Breakdown</h3>
      ${distRows([{c:"Videos",p:74},{c:"Images",p:12},{c:"Cache",p:9},{c:"Other",p:5}])}</div>`;
}

function renderFlags(){
  return `<h1>Feature Flags</h1><p class="sub">Roll out features safely</p>
    <div class="panel" style="padding:0"><table class="data">
      <thead><tr><th>Flag</th><th>Description</th><th>Rollout</th><th>State</th><th></th></tr></thead><tbody>
      ${DATA.flags.map(f=>`<tr><td><code>${esc(f.key)}</code></td><td class="small">${esc(f.desc)}</td><td>${f.rollout}%</td>
        <td><span class="tag-pill ${f.on?'green':'muted'}">${f.on?'ON':'OFF'}</span></td>
        <td><button class="chip" onclick="toast('Toggled ${esc(f.key)} (simulated)')">Toggle</button></td></tr>`).join("")}
    </tbody></table></div>`;
}

function renderAudit(){
  const logs=[["op@hub","Banned user Casey Kim","2m ago"],["mod-ai","Auto-removed spam comment","18m ago"],["op@hub","Featured House Originals","1h ago"],["system","Scaled processing workers","3h ago"],["op@hub","Updated ranking weights","5h ago"]];
  return `<h1>Audit Log</h1><p class="sub">Immutable record of platform actions</p>
    <div class="panel" style="padding:0"><table class="data"><thead><tr><th>Actor</th><th>Action</th><th>Time</th></tr></thead><tbody>
    ${logs.map(l=>`<tr><td><code>${l[0]}</code></td><td>${l[1]}</td><td class="small">${l[2]}</td></tr>`).join("")}</tbody></table></div>`;
}

function renderHealth(){
  const svc=[["API Gateway","operational"],["Auth Service","operational"],["Firestore","operational"],["Video Pipeline (Mux)","operational"],["CDN","degraded"],["Search","operational"]];
  return `<h1>System Health</h1><p class="sub">Service status</p>
    <div class="grid">${svc.map(([n,st])=>`<div class="panel"><div style="display:flex;justify-content:space-between;align-items:center">
      <b>${n}</b><span class="tag-pill ${st==='operational'?'green':'warn'}">${st}</span></div></div>`).join("")}</div>
    <div class="panel" style="margin-top:16px"><h3 style="margin-top:0">Request Latency (ms)</h3>${barChart([42,38,45,51,47,40,39])}</div>`;
}

function simplePage(title,sub,items){
  return `<h1>${esc(title)}</h1><p class="sub">${esc(sub)}</p><div class="grid">${items.map(i=>`<div class="card" onclick="toast('${esc(i)} (simulated)')"><div class="title">${esc(i)}</div></div>`).join("")}</div>`;
}

/* Lazy-load moderation thumbnails (avoid N eager CDN metadata fetches). */
const _mLazyObs = ("IntersectionObserver" in window)
  ? new IntersectionObserver((es,o)=>es.forEach(e=>{ if(!e.isIntersecting)return; const el=e.target; if(el.dataset.src){el.src=el.dataset.src;el.preload="metadata";el.removeAttribute("data-src");} el.classList.remove("lazy"); o.unobserve(el); }), { rootMargin:"200px" })
  : null;
function lazyThumbs(){
  const els=document.querySelectorAll("video.lazy[data-src]");
  if(_mLazyObs) els.forEach(el=>_mLazyObs.observe(el));
  else els.forEach(el=>{ el.src=el.dataset.src; el.preload="metadata"; el.removeAttribute("data-src"); el.classList.remove("lazy"); });
}

function render(){
  const v=document.getElementById("view"); const p=mstate.page;
  const map={overview:renderOverview,users:renderUsers,creators:renderCreators,videos:renderVideos,
    moderation:renderModeration,homepage:renderHomepage,recommendations:renderRecommendations,
    aimod:renderAImod,storage:renderStorage,flags:renderFlags,audit:renderAudit,health:renderHealth};
  if(map[p]) v.innerHTML=map[p]();
  else if(p==="originals")     v.innerHTML=renderVideos();
  else if(p==="categories")    v.innerHTML=simplePage("Categories","Manage content taxonomy",DATA.categories.concat(["+ Add Category"]));
  else if(p==="live")          v.innerHTML=simplePage("Live Operations","Monitor active streams",["Active Streams","Stream Health","Incidents","Capacity"]);
  else if(p==="revenue")       v.innerHTML=simplePage("Revenue","Platform-wide finance",["Gross Revenue","Creator Payouts","Platform Margin","Forecasts"]);
  else if(p==="subscriptions") v.innerHTML=simplePage("Subscriptions","Plan management",["Plans","Churn","Trials","Coupons","Billing"]);
  else if(p==="ads")           v.innerHTML=simplePage("Ads","Advertising operations",["Campaigns","Inventory","Fill Rate","Advertisers","Pricing"]);
  else if(p==="reports")       v.innerHTML=simplePage("Reports","Scheduled exports",["Daily Summary","Revenue Report","Moderation Report","Growth Report"]);
  else if(p==="analytics")     v.innerHTML=simplePage("Analytics","Deep platform metrics",["Engagement","Funnels","Cohorts","Retention","Geo"]);
  else if(p==="processing")    v.innerHTML=simplePage("Processing","Transcoding pipeline",["Queue","Workers","Failed Jobs","Renditions","Throughput"]);
  else if(p==="notifications") v.innerHTML=simplePage("Notifications","Messaging system",["Push","Email","In-App","Templates","Delivery"]);
  else if(p==="integrations")  v.innerHTML=simplePage("Integrations","Connected services",["Stripe","Mux","Firebase","Segment","Slack","PagerDuty"]);
  else if(p==="security")      v.innerHTML=simplePage("Security","Platform protection",["Access Control","API Tokens","Rate Limits","Threats","Compliance"]);
  else if(p==="roles")         v.innerHTML=simplePage("Roles","Team permissions",["Admin","Moderator","Support","Analyst","Read-only"]);
  else if(p==="settings")      v.innerHTML=simplePage("Settings","Platform configuration",["General","Branding","Regions","Limits","Danger Zone"]);
  else v.innerHTML=renderOverview();
  document.querySelectorAll("#nav button").forEach(b=>b.classList.toggle("active",b.dataset.page===p));
  lazyThumbs();
}
/* Keep the shared session alive on load; if already signed in elsewhere, the
   manager recognizes it with no re-prompt. */
if(typeof ShAuth!=="undefined"){
  ShAuth.ensureFresh().then(()=>render());
}
render();

window.go = go;
window.toast = toast;
window.loadModeration = loadModeration;
window.modAction = modAction;
window.videosPrevPage = videosPrevPage;
window.videosNextPage = videosNextPage;
window.doModSignIn = doModSignIn;
