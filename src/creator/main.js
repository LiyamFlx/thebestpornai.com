import { DATA, esc, fmt, toast, loadFullCatalog } from "../shared/catalog.js";
import { ShAuth, ShAPI } from "../shared/streamhub-api.js";
import { metric, barChart, distRows } from "../shared/ui.js";
import { ALL_CATEGORIES, ALL_TAGS, POPULAR_TAGS, isPopularTag } from "../shared/taxonomy.js";
import { ageGate } from "../shared/age-gate.js";
import { jsq, jsdec } from "../viewer/util.js";
ageGate();

/* fmt(), toast(), esc() are shared — defined in catalog.js */

/* ===================== CREATOR STUDIO ===================== */
const MY = "c4"; // Alex's creator id
const myVideos = ()=> DATA.videos.filter(v=>v.creator===MY);
function freshUpload(){ return {step:0, title:"", desc:"", visibility:"public", monet:true,
  file:null, url:"", duration:"0:00", durationSec:0, thumb:"", thumbOptions:[],
  categories:[], createdWith:[], tags:[], orientation:"horizontal",
  q_cat:"", q_tool:"", q_tag:"",
  sample5:null, sample30:null, capturingClip:"",
  rightsConfirmed:false,
  progress:0, uploading:false, verifying:false}; }   // search query per picker
let cstate = { page:"dashboard", upload:freshUpload(), editingProfile:false };
// Inline oninput/onclick/onchange handlers in the rendered HTML run in GLOBAL
// scope (type="module" keeps module vars private), so cstate must be on window
// or every inline handler throws "cstate is not defined".
if (typeof window !== "undefined") window.cstate = cstate;

/* ---- Creator account / subscription gate ---- */
const CREATOR_PLANS = [
  {id:"starter", name:"Starter", price:"Free", note:"Up to 10 uploads · basic analytics", feats:["10 uploads/mo","Basic analytics","Community support"]},
  {id:"pro",     name:"Pro",     price:"$19/mo", note:"Unlimited uploads · full analytics · AI tools", feats:["Unlimited uploads","Full analytics","AI assistant","55% revenue share"], best:true},
  {id:"studio",  name:"Studio",  price:"$49/mo", note:"Everything in Pro · API + priority", feats:["Everything in Pro","Developer API","Priority support","Custom branding"]},
];
function loadCreator(){
  try{ return JSON.parse(localStorage.getItem("creatorProfile")||"null"); }catch(e){ return null; }
}
function saveCreator(c){ try{ localStorage.setItem("creatorProfile", JSON.stringify(c)); }catch(e){} }
let creator = loadCreator();          // null until subscribed
let onboard = { step:1, plan:"pro", name:"", handle:"", category:"POV", bio:"" };

export function ensureFreeCreatorProfile(targetPage = "upload"){
  if(!creator){
    creator = {
      name: "Guest Creator",
      handle: "@guest",
      category: "POV",
      bio: "Creator channel",
      plan: "starter",
      joined: new Date().toISOString().slice(0,10),
      subscribers: 0,
      avatar: "G"
    };
    saveCreator(creator);
    const me = DATA.creators.find(c=>c.id===MY);
    if(me){ me.name = creator.name; me.handle = creator.handle; }
    DATA.user.name = creator.name;
  }
  cstate.page = targetPage;
  render();
}

// Auto-provision if ?page=upload query parameter is present
if(typeof window !== "undefined"){
  const params = new URLSearchParams(window.location.search);
  if(params.get("page") === "upload"){
    ensureFreeCreatorProfile("upload");
  }
}

function startSubscribe(plan){ onboard.plan=plan; onboard.step=2; render(); }
function finishSubscribe(){
  const name=(document.getElementById("cpName").value||"").trim();
  const handle=(document.getElementById("cpHandle").value||"").trim();
  if(!name){ toast("Please enter a creator name"); return; }
  creator = {
    name, handle: handle || ("@"+name.toLowerCase().replace(/\s+/g,"")),
    category: document.getElementById("cpCat").value,
    bio: (document.getElementById("cpBio").value||"").trim(),
    plan: onboard.plan, joined: new Date().toISOString().slice(0,10),
    subscribers: 0, avatar: name[0].toUpperCase()
  };
  saveCreator(creator);
  // reflect into the shared data model so the rest of the studio uses it
  const me = DATA.creators.find(c=>c.id===MY);
  if(me){ me.name=creator.name; me.handle=creator.handle; }
  DATA.user.name = creator.name;
  toast(`Welcome, ${creator.name}! Your creator account is live.`);
  cstate.page="dashboard"; render();
}
function signOutCreator(){ localStorage.removeItem("creatorProfile"); creator=null; onboard={step:1,plan:"pro",name:"",handle:"",category:"POV",bio:""}; render(); }

/* Options for the Metadata step */
const AI_TOOLS = ["Joi.ai","Candy.ai","Ourdream.ai","Zen Creator","Spicy AI","Grok","ComfyUI"];
const MAX_CATS = 5, MAX_TAGS = 10;
/* Category & tag libraries come from the shared taxonomy (single source of
   truth). Popular tags are floated to the top of the tag picker so creators
   pick high-traffic terms first. */
const CATEGORY_LIBRARY = ALL_CATEGORIES;
const TAG_LIBRARY = [...POPULAR_TAGS, ...ALL_TAGS.filter(t => !isPopularTag(t))];

function go(p){ cstate.page=p; render(); }

/* ---- Upload wizard (REAL, browser-based) ---- */
function uSetRightsConfirmed(checked){ cstate.upload.rightsConfirmed = checked; render(); }
/* Revoke the current upload's object URL (unless the optimistic DATA entry
   still points at it — e.g. an upload-failed stub previews from the blob). */
function revokeUploadUrl(){
  const url = cstate.upload && cstate.upload.url;
  if(!url || !url.startsWith("blob:")) return;
  if(DATA.videos.some(v=>v.src===url)) return;   // a stub still needs it
  try{ URL.revokeObjectURL(url); }catch(_){}
}
/* ---- Searchable multi-select pickers (Category / Created using / Tags) ---- */
/* config: key=field on upload, lib=options, max=limit, q=query field */
const PICKERS = {
  cat:  { key:"categories", lib:CATEGORY_LIBRARY, max:MAX_CATS,  q:"q_cat",  label:"category" },
  tool: { key:"createdWith",lib:AI_TOOLS,         max:99,        q:"q_tool", label:"tool" },
  tag:  { key:"tags",       lib:TAG_LIBRARY,      max:MAX_TAGS,  q:"q_tag",  label:"tag" },
};
/* keep Title/Description the user typed before any re-render of the Metadata step */
function syncMetaInputs(){
  const t=document.getElementById("uTitle"); if(t) cstate.upload.title=t.value;
  const d=document.getElementById("uDesc"); if(d) cstate.upload.desc=d.value;
}
function pickToggle(pk, value){
  value = jsdec(value);
  syncMetaInputs();
  const c=PICKERS[pk], arr=cstate.upload[c.key];
  const i=arr.indexOf(value);
  if(i>=0){ arr.splice(i,1); }
  else {
    if(arr.length>=c.max){ toast(`Max ${c.max} ${c.label}${c.max>1?'s':''}`); return; }
    arr.push(value);
  }
  cstate.upload[c.q]="";                 // clear search after pick
  render();
  const el=document.getElementById("pk_"+pk); if(el){ el.value=""; el.focus(); }
}
function pickSearch(pk, val){ cstate.upload[PICKERS[pk].q]=val; renderPickerList(pk); }
function pickKey(pk, ev){
  if(ev.key==="Enter"){
    ev.preventDefault();
    const c=PICKERS[pk], q=(cstate.upload[c.q]||"").toLowerCase();
    if(!q) return;   // bare Enter must not blind-pick the first library option
    const matches=c.lib.filter(o=>o.toLowerCase().includes(q) && !cstate.upload[c.key].includes(o));
    if(matches.length){ pickToggle(pk, jsq(matches[0])); }
  } else if(ev.key==="Backspace" && !ev.target.value){
    const arr=cstate.upload[PICKERS[pk].key]; if(arr.length){ arr.pop(); render(); }
  }
}
/* one picker's full UI */
function pickerHTML(pk){
  const c=PICKERS[pk], u=cstate.upload, sel=u[c.key], q=(u[c.q]||"").toLowerCase();
  const avail=c.lib.filter(o=>!sel.includes(o) && (!q || o.toLowerCase().includes(q)));
  return `
    <div class="ms-box" onclick="document.getElementById('pk_${pk}').focus()">
      ${sel.map(s=>`<span class="ms-token">${esc(s)}<button type="button" onclick="event.stopPropagation();pickToggle('${pk}','${jsq(s)}')">×</button></span>`).join("")}
      <input class="ms-input" id="pk_${pk}" value="${esc(u[c.q]||'')}" placeholder="${sel.length?'':'Type to search…'}"
        oninput="pickSearch('${pk}',this.value)" onkeydown="pickKey('${pk}',event)" autocomplete="off"/>
    </div>
    <div class="ms-list" id="pklist_${pk}">${pickerOptions(pk, avail)}</div>`;
}
function pickerOptions(pk, avail){
  if(!avail.length) return `<div class="ms-empty">No matches</div>`;
  return avail.slice(0,40).map(o=>`<button type="button" class="ms-opt" onclick="pickToggle('${pk}','${jsq(o)}')">${esc(o)}</button>`).join("");
}
function renderPickerList(pk){
  const c=PICKERS[pk], u=cstate.upload, q=(u[c.q]||"").toLowerCase();
  const avail=c.lib.filter(o=>!u[c.key].includes(o) && (!q || o.toLowerCase().includes(q)));
  const el=document.getElementById("pklist_"+pk); if(el) el.innerHTML=pickerOptions(pk, avail);
}

/* format seconds -> M:SS */
function fmtDur(sec){ if(!isFinite(sec)) return "0:00"; sec=Math.round(sec||0); const m=Math.floor(sec/60), s=sec%60; return m+":"+String(s).padStart(2,"0"); }

/* User picked a real file: create object URL, read real duration, advance to Processing */
function uPickFile(input){
  const file = (input.files || [])[0];
  if(!file) return;

  if(!file.type.startsWith("video/")){
    toast("Skipped non-video file: " + file.name);
    return;
  }

  revokeUploadUrl();   // release the previous pick's blob URL before replacing
  cstate.upload = freshUpload();
  cstate.upload.file = file;
  cstate.upload.url = URL.createObjectURL(file);
  cstate.upload.title = file.name.replace(/\.[^.]+$/,"").replace(/[-_]/g," ");
  cstate.upload.step = 0; // will be probed

  // Probe metadata + generate thumbs (async)
  uProbeQueueItem(cstate.upload);

  cstate.page = "upload";
  render();
}

// Probe a single item (duration + thumbnails)
function uProbeQueueItem(u){
  if(!u || u._probing) return;
  u._probing = true;

  const v = document.createElement("video");
  v.preload = "metadata"; v.muted = true; v.src = u.url;

  // If loadedmetadata never fires (bad file, R2/network stall), _probing
  // would otherwise stay true forever and silently block Publish on every
  // click with no visible error — same failure class as captureFrames' seek
  // timeout below.
  let metaTimedOut = false;
  const metaTimer = setTimeout(() => {
    metaTimedOut = true;
    u._probing = false;
    v.onloadedmetadata = null; v.onerror = null; v.src = "";   // stop loading, release
    toast("Could not read video metadata (timed out) — you can still publish.");
    render();
  }, 8000);

  v.onloadedmetadata = () => {
    if(metaTimedOut) return;   // timeout already gave up and rendered; ignore late event
    clearTimeout(metaTimer);
    u.duration = fmtDur(v.duration);
    u.durationSec = isFinite(v.duration) ? v.duration : 0;
    u.width = v.videoWidth;
    u.height = v.videoHeight;
    if (v.videoHeight && v.videoWidth) {
      u.orientation = (v.videoHeight > v.videoWidth) ? "vertical" : "horizontal";
    }

    const dur = v.duration;
    if(!isFinite(dur) || dur <= 0){
      // Streams/odd containers report Infinity/0 — seeking to NaN stamps would
      // just burn six 2s timeouts in captureFrames. Skip frame capture, but
      // tell the creator why the thumbnail grid is empty instead of leaving
      // them guessing.
      u._probing = false; v.onerror = null; v.src = "";
      toast("Couldn't extract thumbnails from this file — pick one manually or publish without one.");
      render();
      return;
    }
    const stamps = [0.05,0.15,0.30,0.50,0.70,0.85].map(p => Math.max(0.05, Math.min(dur * p, dur - 0.1)));

    captureFrames(v, stamps, (thumbs) => {
      u.thumbOptions = thumbs;
      u.thumb = thumbs[0] || "";
      u._probing = false;
      render();
    });
  };

  v.onerror = () => {
    clearTimeout(metaTimer);
    u._probing = false;
    v.onerror = null; v.src = "";   // null first — clearing src can re-fire error
    toast("Could not read: " + (u.title || "video"));
    render();   // clear the "Extracting video metadata…" overlay
  };
}

/* Grab still frames into data URLs using a canvas */
function captureFrames(video, stamps, done){
  const canvas = document.createElement("canvas");
  const out = []; let i = 0; let finished = false;
  // Bumped every time we move on from a seek (whether it completed or timed
  // out) — lets a late "seeked" event that fires AFTER its own timeout
  // already advanced i recognize it's stale and ignore itself, instead of
  // capturing a frame at the wrong timestamp and double-incrementing i.
  let seekToken = 0;
  const finish = ()=>{ if(finished) return; finished = true; video.onseeked = null; video.src = ""; done(out); };
  // Some videos never fire "seeked" for one or more of these timestamps
  // (short clips, certain codecs/keyframe layouts, byte-range quirks over
  // CORS) — without a timeout this hangs forever, leaving u._probing stuck
  // true and silently blocking Publish on every click with no visible error.
  let seekTimer = null;
  // Each seek gets its own token, captured by closure in both its timeout
  // callback and its onseeked handler (reassigned fresh per seek below) —
  // whichever fires first bumps seekToken and wins; the other reads its own
  // frozen myToken, sees it no longer matches, and no-ops instead of
  // capturing the wrong frame or double-advancing i. Reassigning
  // video.onseeked each time also means a stale handler is simply no longer
  // attached by the time a late event would have reached it.
  const armTimeout = (myToken)=>{
    clearTimeout(seekTimer);
    seekTimer = setTimeout(()=>{
      if(myToken !== seekToken) return;   // this seek already resolved via onseeked; ignore
      seekToken++; i++; grabOrFinish();
    }, 2000);
  };
  const grabOrFinish = ()=>{
    if(i >= stamps.length){ finish(); return; }
    const myToken = seekToken;
    armTimeout(myToken);
    video.onseeked = ()=>{
      clearTimeout(seekTimer);
      // A late "seeked" whose own timeout already fired and moved i along —
      // currentTime no longer matches the stamp this handler was set up
      // for, so capturing now would grab the wrong frame under a stale index.
      if(myToken !== seekToken || finished) return;
      const w = video.videoWidth || 320, h = video.videoHeight || 180;
      canvas.width = 320; canvas.height = Math.round(320 * h / w);
      try{
        canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
        out.push(canvas.toDataURL("image/jpeg", 0.7));
      }catch(e){ /* tainted/decode issue — skip */ }
      seekToken++; i++;
      grabOrFinish();
    };
    video.currentTime = stamps[i];
  };
  grabOrFinish();
}

function uChooseThumb(idx){ cstate.upload.thumb = cstate.upload.thumbOptions[idx]; render(); }

/* Capture current video frame (from scrubber) as the thumbnail */
function uCaptureCurrentFrame(){
  const v = document.getElementById("thumbScrubVideo");
  if(!v) return;
  if(v.readyState < 2){ toast("Video frame not ready yet — scrub again in a moment"); return; }
  const canvas = document.createElement("canvas");
  const w = v.videoWidth||320, h = v.videoHeight||180;
  canvas.width = 320; canvas.height = Math.round(320*h/w);
  try{ canvas.getContext("2d").drawImage(v,0,0,canvas.width,canvas.height); }
  catch(_){ toast("Couldn't capture frame"); return; }
  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  const u = cstate.upload;
  u.thumbOptions = [dataUrl, ...u.thumbOptions.filter(t=>t!==dataUrl)].slice(0,7);
  u.thumb = dataUrl;
  render();
}

/* Record a clip of `secs` seconds starting 10% into the video using MediaRecorder */
async function captureClip(videoUrl, startTime, secs){
  return new Promise((resolve, reject)=>{
    const v = document.createElement("video");
    let settled = false;
    const fail = (msg)=>{ if(settled) return; settled = true; clearTimeout(watchdog); v.onerror=null; v.onloadeddata=null; v.onseeked=null; v.src=""; reject(new Error(msg)); };
    const ok = (blob)=>{ if(settled) return; settled = true; clearTimeout(watchdog); resolve(blob); };
    // loadeddata/seeked can silently never fire (same failure class as the
    // probe/captureFrames timeouts) — without this the promise pends forever
    // and the "capturing" spinner is stuck for the rest of the session.
    const watchdog = setTimeout(()=>fail("Clip capture timed out"), secs*1000 + 10000);
    v.src = videoUrl; v.muted = true; v.preload = "auto";
    v.onloadeddata = ()=>{
      v.currentTime = startTime;
      v.onseeked = ()=>{
        v.onseeked = null;   // one-shot — rec playback re-seeks must not re-enter
        let stream;
        try{ stream = v.captureStream(); }
        catch(e){ fail("captureStream not supported in this browser"); return; }
        const mime = ["video/webm;codecs=vp8","video/webm"].find(t=>MediaRecorder.isTypeSupported(t)) || "video/webm";
        const rec = new MediaRecorder(stream, {mimeType:mime});
        const chunks = [];
        rec.ondataavailable = e=>{ if(e.data.size>0) chunks.push(e.data); };
        rec.onerror = ()=>fail("Recording failed");
        rec.onstop = ()=>ok(new Blob(chunks, {type: mime.split(";")[0]}));
        rec.start(200);
        v.play().catch(()=>{});
        setTimeout(()=>{ try{ rec.stop(); }catch(_){} v.pause(); v.src=""; }, secs*1000+200);
      };
    };
    v.onerror = ()=>fail("Video load failed");
  });
}

async function uCaptureClip(secs){
  const u = cstate.upload;
  if(!u.url){ toast("No video loaded"); return; }
  u.capturingClip = secs+"s"; render();
  try{
    const startTime = Math.max(0.5, u.durationSec * 0.10);
    const blob = await captureClip(u.url, startTime, secs);
    if(secs===5) u.sample5 = blob; else u.sample30 = blob;
    toast(`✓ ${secs}s sample captured`);
  } catch(e){
    toast("Clip capture failed: "+e.message);
  }
  u.capturingClip = ""; render();
}

let _publishing = false;

function dataURLtoFile(dataurl, filename) {
  const arr = dataurl.split(',');
  const mime = (arr[0].match(/:(.*?);/) || [])[1] || "image/jpeg";
  const bstr = atob(arr[arr.length - 1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while(n--){
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, {type:mime});
}

async function uPublish(){
  if (_publishing) { toast("Upload already in progress…"); return; }
  const u = cstate.upload;
  if (u._probing) { toast("Still probing video file. Please wait…"); return; }
  if(!u.file){ toast("No file selected"); cstate.upload.step=0; render(); return; }
  if(!u.rightsConfirmed){ toast("Please confirm the rights/age statement before publishing"); return; }
  _publishing = true;
  u.uploading = true; u.progress = 0; render();

  const setBar = pct=>{ const b=document.getElementById("uploadProgressBar"); if(b) b.style.width=pct+"%"; };

  // Consent/rights attestation MUST happen before any upload bytes are
  // treated as compliant — this records the legal attestation record and
  // gets a short-lived token that /api/verify-upload requires below.
  try {
    await ShAPI.attestUpload({
      rightsConfirmed: true,
      ageConfirmed: true,
      title: u.title || "Untitled",
      confirmedAt: new Date().toISOString(),
    });
  } catch(e){
    _publishing = false; u.uploading = false; render();
    toast("Could not record attestation, try again: " + (e.message || "unknown error"));
    return;
  }

  try {
    const seedViews = 10000 + Math.floor(Math.random()*5001);
    const seedLikes = 100 + Math.floor(Math.random()*201);
    const localId = Date.now();

    // Optimistic local entry
    DATA.videos.unshift({
      id:localId, title:u.title||"Untitled Upload", creator:MY, type:"ugc",
      category:u.categories[0]||"POV", categories:u.categories.slice(),
      views:seedViews, likes:seedLikes, dislikes:5, comments:0, favorites:0,
      duration:u.duration||"0:00", uploaded:new Date().toISOString().slice(0,10),
      src:u.url, thumb:u.thumb||"",
      createdWith:u.createdWith.slice(), tags:u.tags.slice(),
      status: u.visibility === "private" ? "private" : "published",
      flagged:false
    });

    try {
      // Upload the main video, thumbnail, and sample clips ALL IN PARALLEL —
      // each goes directly to R2 via a presigned PUT, so they don't contend for
      // a single relay. The main file drives the progress bar; the rest ride
      // alongside and never block "live".
      const mainP = ShAPI.uploadVideo(u.file, u.title||"Untitled", pct=>{
        u.progress = pct; setBar(pct);
      });

      let thumbP = Promise.resolve({ url: u.thumb || "" });
      if (u.thumb && u.thumb.startsWith("data:")) {
        const thumbFile = dataURLtoFile(u.thumb, `thumb_${localId}.jpg`);
        // On failure fall back to NO manifest thumb (viewer lazy-loads a video
        // frame instead) — never push a ~300KB base64 data URL into the shared
        // manifest that every visitor downloads.
        thumbP = ShAPI.uploadVideo(thumbFile, u.title + " Thumbnail", () => {})
          .catch(e => { console.error("Thumbnail upload failed, omitting from manifest:", e); return { url: "" }; });
      }

      const clipPromises = [];
      if(u.sample5){
        const f5 = new File([u.sample5], (u.title||"video").replace(/\s+/g,"-")+"-5s.webm", {type:"video/webm"});
        clipPromises.push(ShAPI.uploadVideo(f5, u.title+"-5s", ()=>{}).catch(()=>{}));
      }
      if(u.sample30){
        const f30 = new File([u.sample30], (u.title||"video").replace(/\s+/g,"-")+"-30s.webm", {type:"video/webm"});
        clipPromises.push(ShAPI.uploadVideo(f30, u.title+"-30s", ()=>{}).catch(()=>{}));
      }

      const [uploadInfo, thumbInfo] = await Promise.all([mainP, thumbP, ...clipPromises]);
      const cdnSrc = uploadInfo.src;
      const thumbUrl = thumbInfo.url || "";
      setBar(100); u.progress = 100;

      // Point local entry at real CDN src and thumbnail URL
      const vid = DATA.videos.find(v=>v.id===localId);
      if(vid) {
        vid.src = cdnSrc;
        // If the thumb upload failed, thumbUrl is "" — keep showing the local
        // data-URL thumb in THIS session's UI only, rather than flashing to
        // blank. The manifest itself (what everyone else sees) correctly has
        // no thumb in that case; this local view self-heals on next reload
        // once the catalog re-fetches from the manifest.
        vid.thumb = thumbUrl || u.thumb;
      }

      // Server-verified compliance gate: real SHA-256 of the uploaded bytes,
      // banned/duplicate-hash check, CSAM interception, trust-tier read.
      // Throws (banned/duplicate/etc.) — caught below, entry is NOT saved to
      // the manifest if this fails. Can legitimately take a while for a
      // large file (server streams it back from R2 to hash it) — flag this
      // distinct phase so the UI doesn't look stuck at a static "Saving
      // metadata..." for minutes with no explanation.
      u.verifying = true; render();
      const verified = await ShAPI.verifyUpload({
        path: uploadInfo.path,
        title: u.title || "Untitled",
        width: u.width || null,
        height: u.height || null,
        durationS: u.durationSec || null,
      });
      u.verifying = false;

      // Save to the manifest via the secure serverless endpoint so the video
      // appears for visitors — status is decided by verifyUpload's result
      // (live -> published immediately, held -> pending review), never by
      // what the uploader selected, except that an explicit "private"
      // visibility choice always stays private regardless of trust tier.
      const manifestEntry = {
        id: localId,
        uploadId: verified.uploadId,
        title: u.title||"Untitled",
        creator: MY,
        type: "ugc",
        src: cdnSrc,
        thumb: thumbUrl,
        category: u.categories[0]||"Amateur",
        categories: u.categories.slice(),
        tags: u.tags.slice(),
        duration: u.duration||"",
        uploaded: new Date().toISOString().slice(0,10),
        views: seedViews,
        likes: seedLikes,
        dislikes: 0,
        comments: 0,
        favorites: 0,
        visibility: u.visibility,
        flagged: false,
        orientation: u.orientation || "horizontal"
      };
      await ShAPI.saveToManifest(manifestEntry);

      await new Promise(r=>setTimeout(r,300));
      if(verified.status === "live"){
        toast(`✓ "${u.title||'Untitled'}" is live!`);
      } else {
        if(vid) vid.status = "pending";
        toast(`"${u.title||'Untitled'}" uploaded — pending review before it goes live.`);
      }
    } catch(e){
      const msg = String(e.message || "");
      if(msg === "banned" || msg === "duplicate"){
        // A genuine compliance rejection, not a network hiccup — the file
        // must NOT stay visible/optimistic in the creator's list.
        const idx = DATA.videos.findIndex(v=>v.id===localId);
        if(idx>=0) DATA.videos.splice(idx,1);
        toast(msg === "banned"
          ? "This file was rejected: matches a banned-content hash."
          : "This file was rejected: already uploaded (duplicate).");
      } else {
        // Network/infra failure: the entry never reached the manifest, so
        // it's not actually visible to anyone else — mark it so (the
        // Content table's "Failed" badge + Retry button already exist for
        // exactly this status, they just had nothing setting it before).
        const failedVid = DATA.videos.find(v=>v.id===localId);
        if(failedVid) failedVid.status = "upload-failed";
        console.error("Upload remote step failed:", e);
        toast("Upload failed: " + (e.message || "see console") + " — you can retry from Content.");
      }
    }

    u.uploading = false;
    revokeUploadUrl();   // no-op if an upload-failed stub still previews from the blob
    cstate.upload = freshUpload();
    cstate.page = "content";
    render();
  } finally {
    _publishing = false;
  }
}

function retryUpload(id){
  // Remove the failed stub and re-open the upload wizard so user can re-pick the file
  const idx = DATA.videos.findIndex(v=>v.id===id);
  if(idx>=0){
    const stub = DATA.videos[idx];
    DATA.videos.splice(idx,1);
    if(stub.src && stub.src.startsWith("blob:")){ try{ URL.revokeObjectURL(stub.src); }catch(_){} }
  }
  cstate.upload = freshUpload();
  cstate.page = "upload";
  toast("Please re-select your video file to retry");
  render();
}

/* ==================== MULTI UPLOAD QUEUE (up to 10 videos) ==================== */

function uUpdateScrub(val) {
  const scrubVid = document.getElementById("thumbScrubVideo");
  if (scrubVid) {
    scrubVid.currentTime = val;
  }
  const label = document.getElementById("scrubTimeLabel");
  if (label) {
    label.textContent = parseFloat(val).toFixed(1) + "s";
  }
}

function uCancelUpload() {
  revokeUploadUrl();
  cstate.upload = freshUpload();
  render();
}

function renderDashboard(){
  const r=DATA.revenue;
  return `<h1>Dashboard</h1><p class="sub">Welcome back, ${esc(creator?.name||"Creator")} — here's how your channel is doing.</p>
    <div class="metrics">
      ${metric("Revenue (mo)","$"+((r.history&&r.history.length?r.history[r.history.length-1].v:0)).toLocaleString(),"18%",true)}
      ${metric("Subscribers",fmt(DATA.creators.find(c=>c.id===MY)?.subs ?? 0),"4.2%",true)}
      ${metric("Views (7d)",fmt(DATA.analytics.views7d.reduce((a,b)=>a+b,0)),"9%",true)}
      ${metric("Watch Time","54.2K min","6%",true)}
      ${metric("CTR","7.8%","0.4%",true)}
      ${metric("Engagement","12.4%","1.1%",true)}
      ${metric("Comments",(DATA.comments||[]).length,"3",true)}
      ${metric("Growth","+312","subs",true)}
    </div>
    <div class="grid" style="grid-template-columns:2fr 1fr;margin-top:18px">
      <div class="panel"><h3 style="margin-top:0">Views — last 7 days</h3>${barChart(DATA.analytics.views7d,["M","T","W","T","F","S","S"])}</div>
      <div class="panel"><h3 style="margin-top:0">Top Traffic Sources</h3>${distRows(DATA.analytics.traffic)}</div>
    </div>`;
}

function openVideoEditor(id){
  const v = DATA.videos.find(v=>v.id===id);
  toast("Opening editor for: " + (v ? v.title : "video"));
}

function renderContent(){
  return `<h1>Content</h1><p class="sub">Manage your videos</p>
    <div class="panel" style="padding:0">
    <table class="data"><thead><tr><th>Video</th><th>Status</th><th>Views</th><th>Likes</th><th>Comments</th><th>Date</th></tr></thead><tbody>
    ${myVideos().map(v=>`<tr style="cursor:pointer" onclick="openVideoEditor(${v.id})">
      <td><b>${esc(v.title)}</b><div class="small">${esc(v.category)}</div></td>
      <td><span class="tag-pill ${v.status==='published'?'green':v.status==='review'?'warn':v.status==='upload-failed'?'red':'muted'}">${esc(v.status==='upload-failed'?'Failed':v.status)}</span>${v.status==='upload-failed'?` <button class="chip retry-btn" onclick="event.stopPropagation();retryUpload(${v.id})">↺ Retry</button>`:''}</td>
      <td>${fmt(v.views)}</td><td>${fmt(v.likes)}</td><td>${v.comments}</td><td class="small">${esc(v.uploaded)}</td></tr>`).join("")}
    </tbody></table></div>`;
}

function renderUpload() {
  const u = cstate.upload;
  
  if (!u.file) {
    return `
      <div class="upload-start-container">
        <h1>Upload Video</h1>
        <p class="sub">Publish high-quality vertical or horizontal videos to the bestpornai catalog.</p>
        
        <label class="upload-dropzone" id="uploadDropzone">
          <span class="upload-icon">⤒</span>
          <span class="upload-title">Select video file to upload</span>
          <span class="upload-sub">Or drag and drop a file here</span>
          <span class="upload-formats">MP4, WebM, MOV (Max 500MB)</span>
          <input type="file" accept="video/*" style="display:none" onchange="uPickFile(this)"/>
        </label>
      </div>
    `;
  }

  const isProbing = u._probing;
  const isUploading = u.uploading;

  return `
    <div class="upload-flow-header">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;">
        <div>
          <h1 style="margin:0;">Video Details</h1>
          <p class="sub" style="margin:0;margin-top:4px;">Configure details and publish your video.</p>
        </div>
        <div>
          <button class="btn ghost sm" onclick="uCancelUpload()">Cancel</button>
        </div>
      </div>
    </div>

    <div class="upload-grid">
      <!-- LEFT COLUMN: Preview & Thumbnails -->
      <div class="upload-col-left">
        <!-- Player / Preview Box -->
        <div class="upload-preview-card panel" style="padding:12px; margin-bottom:16px;">
          <div class="upload-preview-player-wrap" style="position:relative; aspect-ratio:16/9; background:#000; border-radius:10px; overflow:hidden; display:flex; align-items:center; justify-content:center;">
            ${isProbing ? `
              <div class="upload-probing-overlay" style="display:flex; flex-direction:column; align-items:center; gap:12px; color:var(--muted);">
                <div class="player-spinner"></div>
                <div class="small">Extracting video metadata…</div>
              </div>
            ` : `
              <video id="uploadPreviewVideo" src="${u.url}" muted playsinline controls style="width:100%; height:100%; object-fit:contain;"></video>
            `}
          </div>
          <div class="upload-file-info" style="margin-top:12px; display:flex; justify-content:space-between; align-items:center;">
            <div style="min-width:0; flex:1;">
              <div class="small" style="font-weight:600; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${esc(u.file.name)}">${esc(u.file.name)}</div>
              <div class="small" style="color:var(--muted); margin-top:2px;">
                ${esc(u.duration)} • ${u.orientation === "vertical" ? "📱 Portrait" : "🖥 Landscape"}
              </div>
            </div>
            <div>
              <span class="tag-pill ${u.orientation === 'vertical' ? 'purple' : 'blue'}" style="font-size:10px; padding:2px 6px;">
                ${u.orientation === 'vertical' ? 'Vertical Feed' : 'Grid'}
              </span>
            </div>
          </div>
        </div>

        <!-- Thumbnail Selector -->
        <div class="panel" style="padding:16px; margin-bottom:16px;">
          <h3 style="margin:0 0 12px 0;">Thumbnail</h3>
          <p class="small" style="margin:0 0 12px 0;">Choose a frame from the video or extract a custom moment.</p>
          
          <div class="upload-thumb-grid" style="display:grid; grid-template-columns:repeat(3, 1fr); gap:8px; margin-bottom:16px;">
            ${(u.thumbOptions.length ? u.thumbOptions : ['', '', '', '', '', '']).map((t, i) => `
              <div class="upload-thumb-option" style="aspect-ratio:16/9; border:2px solid ${u.thumb === t && t ? 'var(--accent)' : 'var(--border)'}; border-radius:6px; overflow:hidden; cursor:pointer; background:#111;" onclick="uChooseThumb(${i})">
                ${t ? `<img src="${t}" style="width:100%; height:100%; object-fit:cover;"/>` : '<div class="small" style="display:flex; align-items:center; justify-content:center; height:100%; color:var(--muted)">⋯</div>'}
              </div>`).join("")}
          </div>

          <!-- Timeline scrub thumbnail extraction -->
          <div style="background:rgba(255,255,255,.02); border:1px solid var(--border); border-radius:8px; padding:12px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
              <span class="small" style="font-weight:600; color:var(--muted);">CUSTOM FRAME</span>
              <span class="small" id="scrubTimeLabel" style="font-family:monospace; color:var(--muted);">0.0s</span>
            </div>
            <video id="thumbScrubVideo" src="${u.url || ''}" muted playsinline style="display:none;"></video>
            <input type="range" style="width:100%; margin-bottom:8px; accent-color:var(--accent);"
              min="0" max="${(u.durationSec || 100).toFixed(1)}" step="0.1" value="0"
              oninput="uUpdateScrub(this.value)"/>
            <button class="btn ghost sm" style="width:100%;" onclick="uCaptureCurrentFrame()" ${isProbing ? 'disabled' : ''}>📸 Extract & Use Current Frame</button>
          </div>
        </div>

        <!-- Upload Status / Progress Card -->
        ${isUploading ? `
          <div class="panel" style="padding:16px; border-color:var(--accent);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <span style="font-weight:600; font-size:13px;">Uploading to CDN…</span>
              <span style="font-family:monospace; font-weight:700; color:var(--accent);">${u.progress.toFixed(0)}%</span>
            </div>
            <div class="upload-progress-track" style="height:6px; background:var(--surface3); border-radius:999px; overflow:hidden;">
              <div class="upload-progress-bar" id="uploadProgressBar" style="width:${u.progress}%; height:100%; background:linear-gradient(90deg, var(--accent), var(--accent2)); transition: width 0.1s ease;"></div>
            </div>
            <p class="small" style="margin:8px 0 0 0; color:var(--muted);">
              ${u.progress < 100 ? 'Transferring video file packets...'
                : u.verifying ? '✓ Upload complete! Verifying file (this can take a few minutes for large videos, please don’t close this tab)...'
                : '✓ Upload complete! Saving metadata...'}
            </p>
          </div>
        ` : ''}
      </div>

      <!-- RIGHT COLUMN: Form Fields -->
      <div class="upload-col-right panel" style="padding:20px;">
        <label class="lbl">Title *</label>
        <input class="fld" id="uTitle" value="${esc(u.title)}" placeholder="Give your video a catchy title" oninput="cstate.upload.title=this.value"/>
        
        <label class="lbl">Description</label>
        <textarea class="fld" id="uDesc" placeholder="Tell viewers what this video is about" style="height:90px;" oninput="cstate.upload.desc=this.value">${esc(u.desc)}</textarea>
        
        <label class="lbl">Category *</label>
        ${pickerHTML('cat')}

        <label class="lbl">Visibility</label>
        <select class="fld" onchange="cstate.upload.visibility=this.value">
          <option value="public" ${u.visibility === 'public' ? 'selected' : ''}>Public</option>
          <option value="unlisted" ${u.visibility === 'unlisted' ? 'selected' : ''}>Unlisted</option>
          <option value="private" ${u.visibility === 'private' ? 'selected' : ''}>Private</option>
        </select>

        <label class="lbl">Created using</label>
        ${pickerHTML('tool')}

        <label class="lbl">Tags</label>
        ${pickerHTML('tag')}

        <div style="margin-top:20px; border-top:1px solid var(--border); padding-top:16px;">
          <label class="small" style="display:flex; gap:8px; align-items:flex-start; cursor:pointer;">
            <input type="checkbox" id="uRightsConfirm" ${u.rightsConfirmed ? 'checked' : ''}
              onchange="uSetRightsConfirmed(this.checked)" style="margin-top:2px;"/>
            <span>I confirm all performers depicted are 18+ years of age, I hold the rights to
              upload this content, and any required 2257 documentation is on file.</span>
          </label>
          <div style="margin-top:16px; display:flex; justify-content:flex-end; gap:12px;">
            <button type="button" class="btn" style="padding:10px 24px;" onclick="uPublish()"
              ${isProbing || isUploading || !u.rightsConfirmed ? 'disabled' : ''}>
              ${isUploading ? 'Publishing…' : '🚀 Publish Video'}
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderAnalytics(){
  const a=DATA.analytics;
  return `<h1>Analytics</h1><p class="sub">Performance overview</p>
    <div class="grid" style="grid-template-columns:1fr 1fr">
      <div class="panel"><h3 style="margin-top:0">Views</h3>${barChart(a.views7d,["M","T","W","T","F","S","S"])}</div>
      <div class="panel"><h3 style="margin-top:0">Retention</h3>${barChart(a.retention)}</div>
      <div class="panel"><h3 style="margin-top:0">Audience by Country</h3>${distRows(a.countries)}</div>
      <div class="panel"><h3 style="margin-top:0">Devices</h3>${distRows(a.devices)}</div>
      <div class="panel"><h3 style="margin-top:0">Traffic Sources</h3>${distRows(a.traffic)}</div>
      <div class="panel"><h3 style="margin-top:0">Revenue Trend</h3>${barChart(DATA.revenue.history.map(h=>h.v),DATA.revenue.history.map(h=>h.m))}</div>
    </div>`;
}

function renderRevenue(){
  const r=DATA.revenue;
  const rows=[["Ad Revenue",r.ads],["Premium Revenue",r.premium],["Subscriptions",r.subscriptions],["Tips",r.tips],["Affiliate",r.affiliate],["Sponsors",r.sponsors]];
  return `<h1>Revenue</h1><p class="sub">Total this period: <b style="color:#fff">$${r.total.toLocaleString()}</b></p>
    <div class="metrics">${rows.map(([k,v])=>metric(k,"$"+v.toLocaleString())).join("")}</div>
    <h3>Payout History</h3>
    <div class="panel" style="padding:0"><table class="data"><thead><tr><th>Date</th><th>Method</th><th>Amount</th><th>Status</th></tr></thead><tbody>
      ${r.history.slice().reverse().map(h=>`<tr><td>${h.m} 2026</td><td>Bank Transfer</td><td>$${h.v.toLocaleString()}</td><td><span class="tag-pill green">Paid</span></td></tr>`).join("")}
    </tbody></table></div>`;
}

function renderSubscribers(){
  return `<h1>Subscribers</h1><p class="sub">${fmt(DATA.creators.find(c=>c.id===MY)?.subs ?? 0)} total</p>
    <div class="panel"><h3 style="margin-top:0">Growth</h3>${barChart([820,910,980,1050,1140,1240],["Jan","Feb","Mar","Apr","May","Jun"])}</div>
    <h3>Recent Subscribers</h3>
    <div class="panel" style="padding:0"><table class="data"><thead><tr><th>User</th><th>Tier</th><th>Joined</th></tr></thead><tbody>
      ${(DATA.users||[]).filter(u=>u.role==='viewer').map(u=>`<tr><td>${esc(u.name)}</td><td><span class="tag-pill ${u.subs==='Premium'?'green':'muted'}">${esc(u.subs)}</span></td><td class="small">${esc(u.joined)}</td></tr>`).join("") || '<tr><td colspan="3" style="text-align:center;color:var(--muted)">No subscriber data yet.</td></tr>'}
    </tbody></table></div>`;
}

function renderComments(){
  return `<h1>Comments</h1><p class="sub">Across all your videos</p>
    ${(DATA.comments||[]).map(m=>`<div class="panel" style="margin-bottom:10px;display:flex;justify-content:space-between;align-items:center">
      <div><b>${esc(m.user)}</b> <span class="small">on "${esc(DATA.videos.find(v=>v.id===m.video)?.title || "removed video")}"</span><div style="font-size:13px;margin-top:4px">${esc(m.text)}</div></div>
      <div><button class="chip" onclick="toast('Replied (simulated)')">Reply</button> <button class="chip" onclick="toast('Hearted')">♥</button></div>
    </div>`).join("")}`;
}

function renderAI(){
  const tools=["Generate Title","Generate Description","Generate Thumbnail","Generate Tags","SEO Optimization","Chapter Generator","Subtitle Generator","Translate","Social Posts","Repurpose Video"];
  return `<h1>Creator AI</h1><p class="sub">Generate metadata and assets in one click</p>
    <div class="grid">${tools.map(t=>`<div class="card" onclick="toast('${t}: generated ✓ (simulated)')"><div class="title">✨ ${t}</div><div class="meta">Tap to generate</div></div>`).join("")}</div>`;
}

function renderAPI(){
  const items=["API Keys","OAuth","Webhooks","SDK","Uploads","Analytics API","Documentation","Usage","Logs"];
  return `<h1>API Center</h1><p class="sub">Build on top of your channel</p>
    <div class="panel" style="margin-bottom:16px"><h3 style="margin-top:0">Your API Key</h3>
      <code style="background:var(--bg);padding:8px 12px;border-radius:8px;display:inline-block">sk_live_••••••••••••4f2a</code>
      <button class="btn sm" style="margin-left:8px" onclick="toast('Key copied')">Copy</button></div>
    <div class="grid">${items.map(i=>`<div class="card" onclick="toast('${i} (simulated)')"><div class="title">${i}</div></div>`).join("")}</div>`;
}

function simplePage(title,sub,items){
  return `<h1>${title}</h1><p class="sub">${sub}</p><div class="grid">${items.map(i=>`<div class="card" onclick="toast('${i} (simulated)')"><div class="title">${i}</div></div>`).join("")}</div>`;
}

/* ---- Onboarding: subscribe + minimal profile (shown until creator exists) ---- */
function onboardBack(){ onboard.step = 1; render(); }
function renderOnboarding(){
  if(onboard.step===1){
    return `
      <div class="onboard">
        <h1>Become a Creator</h1>
        <p class="sub">Subscribe to a plan to open your Creator Studio or upload for free as a guest.</p>
        <button class="btn" style="width:100%;max-width:520px;margin:0 auto 20px;display:block;padding:12px;font-size:15px;background:var(--accent,#e50914)" onclick="ensureFreeCreatorProfile('upload')">
          🚀 Instant Upload as Free Guest Creator
        </button>
        <div class="plan-grid">
          ${CREATOR_PLANS.map(p=>`
            <div class="plan ${p.best?'best':''}">
              ${p.best?`<div class="plan-badge">Most popular</div>`:''}
              <h3>${p.name}</h3>
              <div class="plan-price">${p.price}</div>
              <p class="small">${p.note}</p>
              <ul class="plan-feats">${p.feats.map(f=>`<li>✓ ${f}</li>`).join("")}</ul>
              <button class="btn ${p.best?'':'ghost'}" style="width:100%" onclick="${p.price==='Free' ? "ensureFreeCreatorProfile('upload')" : `startSubscribe('${p.id}')`}">
                ${p.price==='Free'?'Start free':'Subscribe'}
              </button>
            </div>`).join("")}
        </div>
      </div>`;
  }
  // step 2 — minimal profile
  const plan = CREATOR_PLANS.find(p=>p.id===onboard.plan);
  return `
    <div class="onboard onboard-form">
      <h1>Set up your creator profile</h1>
      <p class="sub">Plan: <b>${plan.name}</b> · ${plan.price} — just a few details to finish.</p>
      <div class="panel" style="max-width:520px">
        <label class="lbl">Creator name *</label>
        <input class="fld" id="cpName" value="${esc(onboard.name)}" placeholder="e.g. Nova Studios"/>
        <label class="lbl">Handle</label>
        <input class="fld" id="cpHandle" placeholder="@yourhandle (optional)"/>
        <label class="lbl">Primary category</label>
        <select class="fld" id="cpCat">${DATA.categories.map(c=>`<option ${onboard.category===c?'selected':''}>${esc(c)}</option>`).join("")}</select>
        <label class="lbl">Short bio</label>
        <textarea class="fld" id="cpBio" placeholder="Tell viewers about your channel (optional)"></textarea>
        <div class="wizard-footer">
          <div><button class="btn ghost sm" onclick="onboardBack()">← Back</button></div>
          <div><button class="btn" onclick="finishSubscribe()">Create account →</button></div>
        </div>
      </div>
    </div>`;
}

function editProfile(){ cstate.editingProfile=true; render(); }
function cancelEditProfile(){ cstate.editingProfile=false; render(); }
function saveProfile(){
  const name=(document.getElementById("epName").value||"").trim();
  const handle=(document.getElementById("epHandle").value||"").trim();
  if(!name){ toast("Name is required"); return; }
  creator.name = name;
  creator.handle = handle || creator.handle;
  creator.category = document.getElementById("epCat").value;
  creator.bio = (document.getElementById("epBio").value||"").trim();
  creator.avatar = name[0].toUpperCase();
  saveCreator(creator);
  const me = DATA.creators.find(c=>c.id===MY);
  if(me){ me.name=creator.name; me.handle=creator.handle; }
  DATA.user.name = creator.name;
  cstate.editingProfile=false;
  toast("Profile updated");
  render();
}

function renderProfile(){
  const c=creator;
  if(cstate.editingProfile){
    return `<h1>Edit Profile</h1><p class="sub">Update your public channel identity</p>
      <div class="panel" style="max-width:520px">
        <label class="lbl">Creator name *</label>
        <input class="fld" id="epName" value="${esc(c.name)}" placeholder="Your creator name"/>
        <label class="lbl">Handle</label>
        <input class="fld" id="epHandle" value="${esc(c.handle)}" placeholder="@yourhandle"/>
        <label class="lbl">Primary category</label>
        <select class="fld" id="epCat">${DATA.categories.map(cat=>`<option ${c.category===cat?'selected':''}>${esc(cat)}</option>`).join("")}</select>
        <label class="lbl">Short bio</label>
        <textarea class="fld" id="epBio" placeholder="Tell viewers about your channel">${esc(c.bio||"")}</textarea>
        <div class="wizard-footer">
          <div><button class="btn ghost sm" onclick="cancelEditProfile()">Cancel</button></div>
          <div><button class="btn" onclick="saveProfile()">Save changes</button></div>
        </div>
      </div>`;
  }
  return `<h1>Creator Profile</h1><p class="sub">Your public channel identity</p>
    <div class="cp-header panel">
      <div class="cp-avatar">${esc(c.avatar)}</div>
      <div class="cp-info">
        <h3 style="margin:0 0 3px">${esc(c.name)}</h3>
        <div class="small">${esc(c.handle)} · ${esc(c.category)} · <span style="color:var(--accent2);font-weight:600">${esc(c.plan.toUpperCase())}</span> plan</div>
        ${c.bio?`<p style="font-size:13px;margin:8px 0 0;line-height:1.5">${esc(c.bio)}</p>`:'<p class="small" style="margin:8px 0 0;font-style:italic">No bio yet — add one to attract subscribers.</p>'}
      </div>
      <button class="btn sm ghost" onclick="editProfile()" style="align-self:flex-start">Edit</button>
    </div>
    <div class="metrics" style="margin-top:16px">
      ${metric("Plan",esc(c.plan.charAt(0).toUpperCase()+c.plan.slice(1)))}
      ${metric("Member since",esc(c.joined))}
      ${metric("Your videos",myVideos().length)}
      ${metric("Category",esc(c.category))}
    </div>
    <br/>
    <button class="btn ghost sm" onclick="signOutCreator()">Sign out</button>`;
}

function syncChrome(){
  const gated = !creator;
  // Hide sidebar nav + upload button until subscribed
  const sidebar = document.querySelector(".sidebar");
  if(sidebar) sidebar.style.display = gated ? "none" : "";
  const topbarActions = document.querySelector(".topbar-actions");
  if(topbarActions) topbarActions.style.visibility = gated ? "hidden" : "";
  if(creator){
    const nameEl = document.getElementById("creatorName");
    if(nameEl) nameEl.textContent = creator.name;
    const av = document.getElementById("avatarBtn");
    if(av){ av.textContent = creator.avatar; av.title="Profile"; }
  }
}

function render(){
  const v=document.getElementById("view"); const p=cstate.page;

  // Open uploads: no sign-in gate. Re-enable by restoring the guard below.
  // if(authReady() && !ShAuth.isSignedIn()){ v.innerHTML = renderSignIn(); syncChrome(); return; }

  // GATE: must subscribe + create a profile first (demo onboarding)
  if(!creator){ v.innerHTML = renderOnboarding(); syncChrome(); return; }

  const map={dashboard:renderDashboard,content:renderContent,upload:renderUpload,analytics:renderAnalytics,
    revenue:renderRevenue,subscribers:renderSubscribers,comments:renderComments,ai:renderAI,api:renderAPI,profile:renderProfile};
  if(map[p]) v.innerHTML=map[p]();
  else if(p==="playlists")  v.innerHTML=simplePage("Playlists","Organize your content",["Create Playlist","My Mix","Tutorials","Originals"]);
  else if(p==="livestream") v.innerHTML=simplePage("Livestream","Go live to your audience",["Start Stream","Stream Key","Chat Settings","Past Streams"]);
  else if(p==="series")     v.innerHTML=simplePage("Original Series","Episodic content",["New Series","Season 1","Drafts","Schedule"]);
  else if(p==="copyright")  v.innerHTML=simplePage("Copyright","Protect your content",["Content ID","Claims","Disputes","Strikes"]);
  else if(p==="integrations")v.innerHTML=simplePage("Integrations","Connect your tools",["Discord","Stripe","Zapier","Patreon","Shopify","Mailchimp"]);
  else if(p==="settings")   v.innerHTML=simplePage("Settings","Channel preferences",["Channel Info","Branding","Permissions","Defaults","Danger Zone"]);
  else v.innerHTML=renderDashboard();
  document.querySelectorAll("#nav button").forEach(b=>b.classList.toggle("active",b.dataset.page===p));
  syncChrome();
}

/* Keep the shared session alive on load. If the user signed in anywhere on the
   site (viewer/manager), the creator recognizes it with no re-prompt. */
if(typeof ShAuth!=="undefined"){
  ShAuth.ensureFresh().then(()=>{
    // Hydrate header info if signed in
    if(ShAuth.isSignedIn()){
      ShAuth.user().then(user=>{
        if(user && user.email){
          const name = creator?.name || user.email.split("@")[0];
          const nameSpan = document.getElementById("creatorName");
          if(nameSpan) nameSpan.textContent = name;
          const av = document.getElementById("avatarBtn");
          if(av) av.textContent = name[0].toUpperCase();
        }
      });
    }
    render();
  });
}

/* Delegated nav click listener (replaces inline onclick) + Quick Nav dropdown toggle */
document.addEventListener("click", (e) => {
  const qBtn = e.target.closest("#quickNavBtn");
  const dropdown = document.getElementById("quickNavDropdown");
  
  if (qBtn && dropdown) {
    e.stopPropagation();
    dropdown.classList.toggle("open");
  } else if (dropdown && !e.target.closest("#quickNavDropdown")) {
    dropdown.classList.remove("open");
  }

  const b = e.target.closest("[data-page]");
  if (b) {
    if (dropdown && b.closest("#quickNavDropdown")) {
      dropdown.classList.remove("open");
    }
    go(b.dataset.page);
  }
});

render();

// catalog.js ships only a small seed for fast first paint; pull in the full
// video list (code-split chunk) and re-render so the creator's full library shows.
loadFullCatalog().then(render).catch(e=>console.error("Full catalog load failed (seed catalog still shown):", e));

/* ---- Attach functions invoked from inline HTML event handler attributes ---- */
window.go = go;
window.ensureFreeCreatorProfile = ensureFreeCreatorProfile;
window.onboardBack = onboardBack;
window.finishSubscribe = finishSubscribe;
window.pickKey = pickKey;
window.pickSearch = pickSearch;
window.pickToggle = pickToggle;
window.signOutCreator = signOutCreator;
window.startSubscribe = startSubscribe;
window.editProfile = editProfile;
window.cancelEditProfile = cancelEditProfile;
window.saveProfile = saveProfile;
window.retryUpload = retryUpload;
window.toast = toast;
window.uChooseThumb = uChooseThumb;
window.uCaptureCurrentFrame = uCaptureCurrentFrame;
window.uCaptureClip = uCaptureClip;
window.uPickFile = uPickFile;
window.uPublish = uPublish;
window.uUpdateScrub = uUpdateScrub;
window.uCancelUpload = uCancelUpload;
window.openVideoEditor = openVideoEditor;
window.uSetRightsConfirmed = uSetRightsConfirmed;
