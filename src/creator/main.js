import { DATA, esc, fmt, toast, loadFullCatalog } from "../shared/catalog.js";
import { fetchManifest, mergeManifest } from "../shared/manifest-core.js";
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
let cstate = {
  page: "dashboard",
  upload: freshUpload(),
  queue: [],
  activeIdx: 0,
  singleView: false,
  batchRightsConfirmed: false,
  isBatchUploading: false,
  batchProgress: 0,
  batchCompleted: false,
  lastBatchResults: null,
  editingProfile: false
};
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

/* Recursive reader for dragged folders and files using HTML5 File System Entry API */
async function getFilesFromDataTransfer(dataTransfer) {
  const files = [];
  const items = Array.from((dataTransfer && dataTransfer.items) || []);

  async function traverseEntry(entry) {
    if (!entry) return;
    if (entry.isFile) {
      const file = await new Promise((resolve) => entry.file(resolve, () => resolve(null)));
      if (file && (file.type.startsWith("video/") || /\.(mp4|mov|webm|m4v)$/i.test(file.name))) {
        files.push(file);
      }
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      let entries = [];
      let batch;
      do {
        batch = await new Promise((resolve) => reader.readEntries(resolve, () => resolve([])));
        if (batch && batch.length) entries.push(...batch);
      } while (batch && batch.length > 0);

      for (const child of entries) {
        await traverseEntry(child);
      }
    }
  }

  const entriesToTraverse = [];
  for (const item of items) {
    if (item.webkitGetAsEntry) {
      const entry = item.webkitGetAsEntry();
      if (entry) entriesToTraverse.push(entry);
    }
  }

  if (entriesToTraverse.length > 0) {
    for (const entry of entriesToTraverse) {
      await traverseEntry(entry);
    }
  } else if (dataTransfer && dataTransfer.files && dataTransfer.files.length > 0) {
    for (const file of Array.from(dataTransfer.files)) {
      if (file.type.startsWith("video/") || /\.(mp4|mov|webm|m4v)$/i.test(file.name)) {
        files.push(file);
      }
    }
  }

  return files;
}

function createQueueItem(file) {
  let cleanTitle = (file.name || "Video")
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .trim();
  cleanTitle = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);

  return {
    id: "q_" + Math.random().toString(36).slice(2, 9) + "_" + Date.now(),
    file,
    title: cleanTitle,
    desc: "",
    category: "Amateur",
    categories: ["Amateur"],
    tags: ["4K", "AI"],
    visibility: "public",
    createdWith: [],
    url: URL.createObjectURL(file),
    duration: "0:00",
    durationSec: 0,
    width: null,
    height: null,
    orientation: "horizontal",
    thumb: "",
    thumbOptions: [],
    _probing: false,
    _probed: false,
    _showThumbs: false,
    status: "ready", // ready | uploading | verifying | live | failed
    progress: 0,
    error: ""
  };
}

async function uEnqueueFiles(fileList) {
  const rawFiles = Array.from(fileList || []);
  const videoFiles = rawFiles.filter(f => f.type.startsWith("video/") || /\.(mp4|mov|webm|m4v)$/i.test(f.name));

  if (!videoFiles.length) {
    toast("No video files found (supported formats: MP4, WebM, MOV, M4V).");
    return;
  }

  const newItems = videoFiles.map(createQueueItem);
  cstate.queue.push(...newItems);
  cstate.activeIdx = 0;
  cstate.upload = cstate.queue[0];
  cstate.singleView = false;
  cstate.page = "upload";
  render();

  toast(`Added ${videoFiles.length} video${videoFiles.length === 1 ? '' : 's'} to upload queue!`);

  probeQueueItems();
}

let _isProbingQueue = false;
async function probeQueueItems() {
  if (_isProbingQueue) return;
  _isProbingQueue = true;
  try {
    for (const item of cstate.queue) {
      if (!item._probed && !item._probing) {
        await new Promise(resolve => {
          uProbeQueueItem(item, resolve);
        });
      }
    }
  } finally {
    _isProbingQueue = false;
  }
}

function uPickFiles(input) {
  if (!input || !input.files) return;
  uEnqueueFiles(input.files);
  input.value = "";
}

function uPickFile(input) {
  uPickFiles(input);
}

function uClearQueue() {
  cstate.queue.forEach(item => {
    if (item.url && item.url.startsWith("blob:")) {
      try { URL.revokeObjectURL(item.url); } catch(_) {}
    }
  });
  cstate.queue = [];
  cstate.upload = freshUpload();
  cstate.singleView = false;
  render();
}

function uRemoveQueueItem(id) {
  const idx = cstate.queue.findIndex(i => i.id === id);
  if (idx >= 0) {
    const item = cstate.queue[idx];
    if (item.url && item.url.startsWith("blob:")) {
      try { URL.revokeObjectURL(item.url); } catch(_) {}
    }
    cstate.queue.splice(idx, 1);
    if (cstate.queue.length > 0) {
      cstate.activeIdx = Math.min(cstate.activeIdx, cstate.queue.length - 1);
      cstate.upload = cstate.queue[cstate.activeIdx];
    } else {
      cstate.upload = freshUpload();
      cstate.singleView = false;
    }
    render();
  }
}

function uUpdateItemTitle(id, val) {
  const item = cstate.queue.find(i => i.id === id);
  if (item) item.title = val;
}

function uUpdateItemCategory(id, val) {
  const item = cstate.queue.find(i => i.id === id);
  if (item) {
    item.category = val;
    item.categories = [val];
  }
}

function uUpdateItemVisibility(id, val) {
  const item = cstate.queue.find(i => i.id === id);
  if (item) item.visibility = val;
}

function uApplyBatchCategory() {
  const sel = document.getElementById("batchCategorySelect");
  if (!sel) return;
  const cat = sel.value;
  cstate.queue.forEach(item => {
    item.category = cat;
    item.categories = [cat];
  });
  render();
  toast(`Applied category "${cat}" to all ${cstate.queue.length} videos!`);
}

function uApplyBatchVisibility() {
  const sel = document.getElementById("batchVisibilitySelect");
  if (!sel) return;
  const vis = sel.value;
  cstate.queue.forEach(item => {
    item.visibility = vis;
  });
  render();
  toast(`Applied visibility "${vis}" to all ${cstate.queue.length} videos!`);
}

function uToggleThumbPicker(id) {
  const item = cstate.queue.find(i => i.id === id);
  if (item) {
    item._showThumbs = !item._showThumbs;
    render();
  }
}

function uSelectQueueThumb(id, idx) {
  const item = cstate.queue.find(i => i.id === id);
  if (item && item.thumbOptions[idx]) {
    item.thumb = item.thumbOptions[idx];
    render();
  }
}

function uSetBatchRightsConfirmed(checked) {
  cstate.batchRightsConfirmed = checked;
  render();
}

function uOpenSingleEditor(idx) {
  if (cstate.queue[idx]) {
    cstate.activeIdx = idx;
    cstate.upload = cstate.queue[idx];
    cstate.singleView = true;
    render();
  }
}

function uBackToQueue() {
  cstate.singleView = false;
  render();
}

// Probe a single item (duration + thumbnails)
function uProbeQueueItem(u, done){
  if(!u || u._probing) { if(done) done(); return; }
  u._probing = true;

  const v = document.createElement("video");
  v.preload = "metadata"; v.muted = true; v.src = u.url;

  let metaTimedOut = false;
  const metaTimer = setTimeout(() => {
    metaTimedOut = true;
    u._probing = false;
    u._probed = true;
    v.onloadedmetadata = null; v.onerror = null; v.src = "";
    if (cstate.page === "upload") render();
    if (done) done();
  }, 8000);

  v.onloadedmetadata = () => {
    if(metaTimedOut) return;
    clearTimeout(metaTimer);
    u.duration = fmtDur(v.duration);
    u.durationSec = isFinite(v.duration) ? Math.round(v.duration) : 0;
    u.width = v.videoWidth;
    u.height = v.videoHeight;
    if (v.videoHeight && v.videoWidth) {
      u.orientation = (v.videoHeight > v.videoWidth) ? "vertical" : "horizontal";
    }

    const dur = v.duration;
    if(!isFinite(dur) || dur <= 0){
      u._probing = false;
      u._probed = true;
      v.onerror = null; v.src = "";
      if (cstate.page === "upload") render();
      if (done) done();
      return;
    }
    const stamps = [0.05,0.15,0.30,0.50,0.70,0.85].map(p => Math.max(0.05, Math.min(dur * p, dur - 0.1)));

    captureFrames(v, stamps, (thumbs) => {
      u.thumbOptions = thumbs;
      u.thumb = thumbs[0] || "";
      u._probing = false;
      u._probed = true;
      if (cstate.page === "upload") render();
      if (done) done();
    });
  };

  v.onerror = () => {
    clearTimeout(metaTimer);
    u._probing = false;
    u._probed = true;
    v.onerror = null; v.src = "";
    if (cstate.page === "upload") render();
    if (done) done();
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
    // Unix seconds timestamp fits safely in Postgres 32-bit integer (< 2,147,483,647)
    // while remaining unique per second and cleanly distinct from catalog videos (1..7000).
    const localId = Math.floor(Date.now() / 1000);

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

    let step = "uploading file";
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
      step = "verifying file";
      u.verifying = true; render();
      const verified = await ShAPI.verifyUpload({
        path: uploadInfo.path,
        title: u.title || "Untitled",
        width: u.width || null,
        height: u.height || null,
        durationS: u.durationSec || null,
      });
      u.verifying = false;
      step = "saving to catalog";

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

      // Re-fetch manifest.json now that our own write just landed in it —
      // closes the loop: the optimistic local entry above only lives in this
      // page's memory, so without this the video "worked" for this session
      // and then silently disappeared from Content on the next reload (it
      // was saved server-side the whole time, this app just never re-read
      // it). R2 is eventually-consistent, so this can occasionally still
      // miss the entry on the very first read; syncCreatorManifest() on next
      // page load is the backstop.
      syncCreatorManifest();
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
        toast("Upload failed while " + step + ": " + (e.message || "see console") + " — you can retry from Content.");
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

/* ==================== MULTI UPLOAD QUEUE & BATCH PROCESSING ==================== */

async function uPublishBatch() {
  if (cstate.isBatchUploading) {
    toast("Upload batch already running…");
    return;
  }
  if (!cstate.queue.length) {
    toast("No videos in upload queue.");
    return;
  }
  if (!cstate.batchRightsConfirmed) {
    toast("Please confirm the 18+ legal rights statement before publishing.");
    return;
  }

  const pending = cstate.queue.filter(i => i.status !== "live");
  if (!pending.length) {
    toast("All videos in queue are already published!");
    return;
  }

  cstate.isBatchUploading = true;
  cstate.batchProgress = 0;
  render();

  try {
    await ShAPI.attestUpload({
      rightsConfirmed: true,
      ageConfirmed: true,
      title: "Batch Upload (" + pending.length + " videos)",
      confirmedAt: new Date().toISOString(),
    });
  } catch (e) {
    cstate.isBatchUploading = false;
    render();
    toast("Could not record legal attestation: " + (e.message || "unknown error"));
    return;
  }

  let completedCount = 0;
  let successCount = 0;
  const queueToProcess = [...pending];
  const total = pending.length;

  function updateOverallBatchProgress() {
    const totalProg = cstate.queue.reduce((acc, i) => acc + (i.progress || 0), 0);
    cstate.batchProgress = Math.round(totalProg / (cstate.queue.length || 1));
    const pEl = document.getElementById("batchProgressBar");
    if (pEl) pEl.style.width = cstate.batchProgress + "%";
    const pctEl = document.getElementById("batchProgressPct");
    if (pctEl) pctEl.textContent = cstate.batchProgress + "%";
    const stEl = document.getElementById("batchStatusText");
    if (stEl) stEl.textContent = `Completed ${completedCount} of ${total} videos (${cstate.batchProgress}%)`;
  }

  function updateItemProgressInDOM(id, pct) {
    const bar = document.getElementById("prog_bar_" + id);
    if (bar) bar.style.width = pct + "%";
    const num = document.getElementById("prog_num_" + id);
    if (num) num.textContent = pct + "%";
  }

  async function uploadWorker() {
    while (queueToProcess.length > 0) {
      const item = queueToProcess.shift();
      if (!item) break;

      item.status = "uploading";
      item.progress = 0;
      const card = document.getElementById("q_card_" + item.id);
      if (card) {
        card.className = "queue-card uploading";
        const statusCol = card.querySelector(".queue-status-col");
        if (statusCol) {
          statusCol.innerHTML = `
            <div class="mini-progress-track"><div class="mini-progress-bar" id="prog_bar_${item.id}" style="width:0%"></div></div>
            <span class="small" id="prog_num_${item.id}" style="font-weight:700;color:var(--accent);font-family:monospace;">0%</span>
          `;
        }
      }

      try {
        const seedViews = 10000 + Math.floor(Math.random() * 5001);
        const seedLikes = 100 + Math.floor(Math.random() * 201);
        const localId = Math.floor(Date.now() / 1000) + Math.floor(Math.random() * 10000);

        DATA.videos.unshift({
          id: localId,
          title: item.title || "Untitled Upload",
          creator: MY,
          type: "ugc",
          category: item.categories[0] || "Amateur",
          categories: item.categories.slice(),
          views: seedViews,
          likes: seedLikes,
          dislikes: 5,
          comments: 0,
          favorites: 0,
          duration: item.duration || "0:00",
          uploaded: new Date().toISOString().slice(0, 10),
          src: item.url,
          thumb: item.thumb || "",
          createdWith: item.createdWith ? item.createdWith.slice() : [],
          tags: item.tags ? item.tags.slice() : [],
          status: item.visibility === "private" ? "private" : "published",
          flagged: false
        });

        const mainP = ShAPI.uploadVideo(item.file, item.title || "Untitled", (pct) => {
          item.progress = pct;
          updateItemProgressInDOM(item.id, pct);
          updateOverallBatchProgress();
        });

        let thumbP = Promise.resolve({ url: item.thumb || "" });
        if (item.thumb && item.thumb.startsWith("data:")) {
          const thumbFile = dataURLtoFile(item.thumb, `thumb_${localId}.jpg`);
          thumbP = ShAPI.uploadVideo(thumbFile, item.title + " Thumbnail", () => {})
            .catch(() => ({ url: "" }));
        }

        const [uploadInfo, thumbInfo] = await Promise.all([mainP, thumbP]);
        const cdnSrc = uploadInfo.src;
        const thumbUrl = thumbInfo.url || "";
        item.progress = 100;
        item.status = "verifying";

        const cardVerifying = document.getElementById("q_card_" + item.id);
        if (cardVerifying) {
          const col = cardVerifying.querySelector(".queue-status-col");
          if (col) col.innerHTML = `<span class="tag-pill blue" style="font-size:11px;">Verifying…</span>`;
        }

        const verified = await ShAPI.verifyUpload({
          path: uploadInfo.path,
          title: item.title || "Untitled",
          width: item.width || null,
          height: item.height || null,
          durationS: item.durationSec || null,
        });

        const manifestEntry = {
          id: localId,
          uploadId: verified.uploadId,
          title: item.title || "Untitled",
          creator: MY,
          type: "ugc",
          src: cdnSrc,
          thumb: thumbUrl,
          category: item.categories[0] || "Amateur",
          categories: item.categories.slice(),
          tags: item.tags ? item.tags.slice() : [],
          duration: item.duration || "",
          uploaded: new Date().toISOString().slice(0, 10),
          views: seedViews,
          likes: seedLikes,
          dislikes: 0,
          comments: 0,
          favorites: 0,
          visibility: item.visibility,
          flagged: false,
          orientation: item.orientation || "horizontal"
        };
        await ShAPI.saveToManifest(manifestEntry);

        const vid = DATA.videos.find(v => v.id === localId);
        if (vid) {
          vid.src = cdnSrc;
          if (thumbUrl) vid.thumb = thumbUrl;
          if (verified.status !== "live") vid.status = "pending";
        }

        item.status = "live";
        item.publishedId = localId;
        successCount++;
        const cardDone = document.getElementById("q_card_" + item.id);
        if (cardDone) {
          cardDone.className = "queue-card live";
          const col = cardDone.querySelector(".queue-status-col");
          if (col) {
            col.innerHTML = `
              <div style="display:flex;flex-direction:column;align-items:flex-end;gap:5px;">
                <span class="tag-pill green" style="font-size:11px;">✓ Live</span>
                <div style="display:flex;gap:4px;">
                  <a href="/video/${localId}.html" target="_blank" class="btn ghost sm" style="padding:2px 7px;font-size:11px;text-decoration:none;" title="Watch live video">▶ Watch</a>
                  <button type="button" class="btn ghost sm" style="padding:2px 7px;font-size:11px;" onclick="go('content')" title="Manage in Content Manager">Manage</button>
                </div>
              </div>
            `;
          }
        }
      } catch (err) {
        console.error("Failed to upload " + item.title, err);
        item.status = "failed";
        item.error = err.message || "Upload failed";
        const cardFail = document.getElementById("q_card_" + item.id);
        if (cardFail) {
          cardFail.className = "queue-card failed";
          const col = cardFail.querySelector(".queue-status-col");
          if (col) col.innerHTML = `<span class="tag-pill red" style="font-size:11px;">✕ Failed</span>`;
        }
      } finally {
        completedCount++;
        updateOverallBatchProgress();
      }
    }
  }

  await Promise.all([uploadWorker(), uploadWorker()]);

  cstate.isBatchUploading = false;
  syncCreatorManifest();

  if (successCount > 0) {
    const liveItems = cstate.queue.filter(i => i.status === "live");
    cstate.batchCompleted = true;
    cstate.lastBatchResults = {
      total,
      successCount,
      failedCount: total - successCount,
      items: liveItems.map(i => ({
        id: i.publishedId || i.id,
        title: i.title || "Untitled",
        thumb: i.thumb || "",
        duration: i.duration || "0:15",
        category: (i.categories && i.categories[0]) || "Amateur",
        visibility: i.visibility || "public"
      }))
    };
  }

  render();

  if (successCount === total) {
    toast(`🎉 All ${successCount} videos published successfully!`);
  } else {
    toast(`Batch completed: ${successCount} published, ${total - successCount} failed.`);
  }
}

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
  uClearQueue();
}

function renderQueueItemCard(item, idx) {
  const isUploading = item.status === "uploading";
  const isLive = item.status === "live";
  const isFailed = item.status === "failed";
  const isVerifying = item.status === "verifying";

  return `
    <div class="queue-card ${item.status}" id="q_card_${item.id}">
      <div class="queue-thumb-wrap" onclick="uToggleThumbPicker('${item.id}')" title="Click to change thumbnail frame" style="cursor:pointer;">
        ${item.thumb ? `<img class="queue-thumb-img" src="${item.thumb}" alt="Thumbnail"/>` : `<div class="small" style="color:var(--muted)">⋯</div>`}
        <span class="queue-dur-badge">${esc(item.duration || '0:00')}</span>
        <span class="queue-orient-badge tag-pill ${item.orientation === 'vertical' ? 'purple' : 'blue'}" style="font-size:9px;padding:1px 4px;">
          ${item.orientation === 'vertical' ? '📱' : '🖥'}
        </span>
      </div>

      <div class="queue-info">
        <div style="display:flex;gap:8px;align-items:center;">
          <input class="queue-title-input" value="${esc(item.title)}" placeholder="Video title"
            oninput="uUpdateItemTitle('${item.id}', this.value)"
            ${cstate.isBatchUploading ? 'disabled' : ''}/>
        </div>
        <div class="queue-meta-row">
          <span>📁 ${(item.file.size / 1024 / 1024).toFixed(1)} MB</span>
          <span>•</span>
          <label style="display:inline-flex;align-items:center;gap:4px;">
            <span>Category:</span>
            <select class="fld" onchange="uUpdateItemCategory('${item.id}', this.value)" ${cstate.isBatchUploading ? 'disabled' : ''}>
              ${CATEGORY_LIBRARY.map(cat => `<option value="${esc(cat)}" ${item.category === cat ? 'selected' : ''}>${esc(cat)}</option>`).join("")}
            </select>
          </label>
          <span>•</span>
          <label style="display:inline-flex;align-items:center;gap:4px;">
            <span>Visibility:</span>
            <select class="fld" onchange="uUpdateItemVisibility('${item.id}', this.value)" ${cstate.isBatchUploading ? 'disabled' : ''}>
              <option value="public" ${item.visibility === 'public' ? 'selected' : ''}>Public</option>
              <option value="unlisted" ${item.visibility === 'unlisted' ? 'selected' : ''}>Unlisted</option>
              <option value="private" ${item.visibility === 'private' ? 'selected' : ''}>Private</option>
            </select>
          </label>
          <span>•</span>
          <button type="button" class="chip" onclick="uOpenSingleEditor(${idx})" style="font-size:11px;padding:3px 8px;">
            ⚙ Detailed Settings
          </button>
        </div>

        ${item._showThumbs && item.thumbOptions.length ? `
          <div class="queue-thumb-picker">
            <span class="small" style="color:var(--muted);align-self:center;margin-right:4px;">Select frame:</span>
            ${item.thumbOptions.map((t, ti) => `
              <div class="queue-thumb-opt ${item.thumb === t ? 'active' : ''}" onclick="uSelectQueueThumb('${item.id}', ${ti})">
                <img src="${t}" alt="Frame ${ti + 1}"/>
              </div>
            `).join("")}
          </div>
        ` : ''}
      </div>

      <div class="queue-actions">
        <div class="queue-status-col">
          ${isUploading ? `
            <div class="mini-progress-track"><div class="mini-progress-bar" id="prog_bar_${item.id}" style="width:${item.progress}%"></div></div>
            <span class="small" id="prog_num_${item.id}" style="font-weight:700;color:var(--accent);font-family:monospace;">${item.progress}%</span>
          ` : isVerifying ? `
            <span class="tag-pill blue" style="font-size:11px;">Verifying…</span>
          ` : isLive ? `
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:5px;">
              <span class="tag-pill green" style="font-size:11px;">✓ Live</span>
              <div style="display:flex;gap:4px;">
                <a href="/video/${item.publishedId || item.id}.html" target="_blank" class="btn ghost sm" style="padding:2px 7px;font-size:11px;text-decoration:none;" title="Watch live video">▶ Watch</a>
                <button type="button" class="btn ghost sm" style="padding:2px 7px;font-size:11px;" onclick="go('content')" title="Manage in Content Manager">Manage</button>
              </div>
            </div>
          ` : isFailed ? `
            <span class="tag-pill red" style="font-size:11px;" title="${esc(item.error || 'Failed')}">✕ Failed</span>
          ` : `
            <span class="tag-pill muted" style="font-size:11px;">Ready</span>
          `}
        </div>
        <button type="button" class="icon-btn sm" onclick="uRemoveQueueItem('${item.id}')" title="Remove video"
          ${cstate.isBatchUploading ? 'disabled' : ''} style="width:28px;height:28px;border-radius:6px;font-size:11px;">✕</button>
      </div>
    </div>
  `;
}

function attachDropzoneEvents() {
  const dz = document.getElementById("uploadDropzone");
  if (!dz) return;

  dz.ondragover = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dz.classList.add("is-dragover");
  };
  dz.ondragleave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dz.classList.remove("is-dragover");
  };
  dz.ondrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    dz.classList.remove("is-dragover");
    toast("Reading dropped files / folders…");
    const files = await getFilesFromDataTransfer(e.dataTransfer);
    uEnqueueFiles(files);
  };
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

function renderSingleUploadEditor() {
  const u = cstate.upload;
  const isProbing = u._probing;
  const isUploading = u.uploading;

  return `
    <div class="upload-flow-header">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;">
        <div style="display:flex;align-items:center;gap:12px;">
          ${cstate.queue.length > 1 ? `<button class="btn ghost sm" onclick="uBackToQueue()">← Back to Queue (${cstate.queue.length})</button>` : ''}
          <div>
            <h1 style="margin:0;">Video Details</h1>
            <p class="sub" style="margin:0;margin-top:4px;">Configure details and preview for "${esc(u.title)}".</p>
          </div>
        </div>
        <div>
          ${cstate.queue.length > 1
            ? `<button class="btn sm" onclick="uBackToQueue()">Done Editing</button>`
            : `<button class="btn ghost sm" onclick="uCancelUpload()">Cancel</button>`}
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
            ${cstate.queue.length > 1 ? `
              <button type="button" class="btn ghost" onclick="uBackToQueue()">Save & Back to Queue</button>
            ` : `
              <button type="button" class="btn" style="padding:10px 24px;" onclick="uPublish()"
                ${isProbing || isUploading || !u.rightsConfirmed ? 'disabled' : ''}>
                ${isUploading ? 'Publishing…' : '🚀 Publish Video'}
              </button>
            `}
          </div>
        </div>
      </div>
    </div>
  `;
}

function uStartNewUploadBatch() {
  cstate.batchCompleted = false;
  cstate.lastBatchResults = null;
  uClearQueue();
  render();
}

function renderBatchSuccess() {
  const res = cstate.lastBatchResults || { successCount: 0, total: 0, items: [] };
  const firstId = res.items.length ? res.items[0].id : null;

  return `
    <div class="upload-success-container">
      <div class="upload-success-badge">🎉 BATCH PUBLISH COMPLETE</div>
      <h1 style="margin:0 0 10px;font-size:30px;">All ${res.successCount} Videos Are Live!</h1>
      <p class="sub" style="margin:0 auto 28px;max-width:620px;font-size:15px;line-height:1.6;">
        Your videos are now encoded, verified, and distributed across the global edge CDN. Viewers can stream them immediately in high-definition 4K.
      </p>

      <!-- Primary Next Steps Grid -->
      <div class="success-actions-grid">
        <div class="success-action-card" onclick="go('content')">
          <span class="action-card-ico">🎬</span>
          <div class="action-card-content">
            <h3>Content Manager</h3>
            <p>Edit titles, tags, descriptions, change visibility, or track views.</p>
            <span class="action-card-btn">Manage Videos →</span>
          </div>
        </div>

        <div class="success-action-card" onclick="go('profile')">
          <span class="action-card-ico">👤</span>
          <div class="action-card-content">
            <h3>Creator Profile</h3>
            <p>Check your public channel presence, subscriber count, and bio.</p>
            <span class="action-card-btn">View Profile →</span>
          </div>
        </div>

        <div class="success-action-card" onclick="${firstId ? `window.open('/video/${firstId}.html','_blank')` : `window.location.href='/'`}">
          <span class="action-card-ico">👁</span>
          <div class="action-card-content">
            <h3>Watch on Live Site</h3>
            <p>Preview your new uploads directly on the live player experience.</p>
            <span class="action-card-btn">Watch Scene →</span>
          </div>
        </div>
      </div>

      <!-- Published Videos Showcase List -->
      <div class="success-published-showcase">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px;">
          <h3 style="margin:0;font-size:18px;">Published Videos (${res.items.length})</h3>
          <button class="btn sm" onclick="uStartNewUploadBatch()">＋ Upload More Videos</button>
        </div>

        <div class="success-video-list">
          ${res.items.map(item => `
            <div class="success-video-row">
              <div class="success-video-thumb">
                ${item.thumb ? `<img src="${item.thumb}" alt="${esc(item.title)}"/>` : `<div style="width:100%;height:100%;background:#000;display:flex;align-items:center;justify-content:center;color:#666;">4K</div>`}
                <span class="tag-pill green" style="position:absolute;top:6px;left:6px;font-size:10px;padding:2px 6px;">✓ LIVE</span>
                <span class="tag-pill dark" style="position:absolute;bottom:6px;right:6px;font-size:10px;padding:2px 6px;">${esc(item.duration || '0:15')}</span>
              </div>
              <div class="success-video-details">
                <div class="success-video-title">${esc(item.title)}</div>
                <div class="success-video-meta">
                  <span class="tag-pill muted">${esc(item.category || 'Amateur')}</span>
                  <span class="small" style="color:var(--muted);text-transform:capitalize;">${esc(item.visibility || 'public')} · Edge Cached</span>
                </div>
              </div>
              <div class="success-video-links">
                <a href="/video/${item.id}.html" target="_blank" class="btn sm ghost" style="text-decoration:none;">▶ Watch</a>
                <button class="btn sm" onclick="go('content')">Manage</button>
              </div>
            </div>
          `).join("")}
        </div>
      </div>

      <div style="margin-top:32px;display:flex;justify-content:center;gap:14px;flex-wrap:wrap;">
        <button class="btn" style="padding:12px 32px;font-weight:700;" onclick="uStartNewUploadBatch()">
          ⬆ Upload Another Batch
        </button>
        <button class="btn ghost" style="padding:12px 28px;" onclick="go('dashboard')">
          Return to Studio Dashboard
        </button>
      </div>
    </div>
  `;
}

function renderUpload() {
  if (cstate.singleView && cstate.upload && cstate.upload.file) {
    return renderSingleUploadEditor();
  }

  if (cstate.batchCompleted && cstate.lastBatchResults) {
    return renderBatchSuccess();
  }

  if (!cstate.queue.length) {
    return `
      <div class="upload-start-container">
        <span class="upload-badge">COMMUNITY & CREATOR UPLOADS</span>
        <h1 style="margin:0 0 8px;">Upload Videos or Entire Folders</h1>
        <p class="sub" style="margin:0 auto 20px;max-width:540px;">
          Publish vertical shorts or widescreen 4K scenes. Drag and drop multiple videos or select a complete directory in seconds.
        </p>

        <div class="upload-dropzone" id="uploadDropzone">
          <div class="upload-icon">⤒</div>
          <div class="upload-title">Drop videos or folders anywhere here</div>
          <div class="upload-sub">Files are processed instantly directly in your browser.</div>

          <div class="upload-btn-row">
            <label class="btn upload-action-btn" style="cursor:pointer;">
              <span>🎬 Select Videos</span>
              <input type="file" accept="video/*" multiple style="display:none" onchange="uPickFiles(this)"/>
            </label>
            <label class="btn ghost upload-action-btn" style="cursor:pointer;">
              <span>📁 Select Entire Folder</span>
              <input type="file" accept="video/*" webkitdirectory directory style="display:none" onchange="uPickFiles(this)"/>
            </label>
          </div>

          <div class="upload-formats">Supported: MP4, WebM, MOV, M4V • Up to 2GB per video • Fast Direct-to-CDN Upload</div>
        </div>

        <div class="upload-highlights">
          <div class="upload-hl-item">
            <span class="hl-ico">⚡</span>
            <div><strong>Instant CDN Streaming</strong><span>Uploaded videos are pushed directly to edge CDN with 4K streaming.</span></div>
          </div>
          <div class="upload-hl-item">
            <span class="hl-ico">📁</span>
            <div><strong>Batch & Folder Ingestion</strong><span>Upload dozens of scenes at once with automatic metadata and thumbnail extraction.</span></div>
          </div>
          <div class="upload-hl-item">
            <span class="hl-ico">🛡</span>
            <div><strong>Open Community Access</strong><span>No complex account setup required — upload as a guest or manage your channel.</span></div>
          </div>
        </div>
      </div>
    `;
  }

  return `
    <div class="upload-queue-container">
      <div class="upload-queue-header">
        <div>
          <h1 style="margin:0;display:flex;align-items:center;gap:12px;">
            Upload Queue
            <span class="tag-pill blue" style="font-size:12px;padding:3px 10px;">${cstate.queue.length} video${cstate.queue.length === 1 ? '' : 's'}</span>
          </h1>
          <p class="sub" style="margin:4px 0 0 0;">Review titles and categories, then publish your batch.</p>
        </div>
        <div class="queue-header-actions">
          <label class="btn ghost sm" style="cursor:pointer;" ${cstate.isBatchUploading ? 'style="pointer-events:none;opacity:0.5;"' : ''}>
            <span>＋ Add More</span>
            <input type="file" accept="video/*" multiple style="display:none" onchange="uPickFiles(this)"/>
          </label>
          <label class="btn ghost sm" style="cursor:pointer;" ${cstate.isBatchUploading ? 'style="pointer-events:none;opacity:0.5;"' : ''}>
            <span>📁 Add Folder</span>
            <input type="file" accept="video/*" webkitdirectory directory style="display:none" onchange="uPickFiles(this)"/>
          </label>
          <button class="btn ghost sm" onclick="uClearQueue()" ${cstate.isBatchUploading ? 'disabled' : ''}>Clear All</button>
        </div>
      </div>

      ${cstate.queue.length > 1 ? `
        <div class="batch-toolbar">
          <div class="batch-tb-title">⚡ Batch Quick-Set (Apply to All ${cstate.queue.length} Videos)</div>
          <div class="batch-tb-controls">
            <div class="batch-tb-group">
              <label class="small" style="color:var(--muted)">Category:</label>
              <select class="fld" id="batchCategorySelect" ${cstate.isBatchUploading ? 'disabled' : ''}>
                ${CATEGORY_LIBRARY.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join("")}
              </select>
              <button class="btn ghost sm" onclick="uApplyBatchCategory()" ${cstate.isBatchUploading ? 'disabled' : ''}>Apply</button>
            </div>
            <div class="batch-tb-group">
              <label class="small" style="color:var(--muted)">Visibility:</label>
              <select class="fld" id="batchVisibilitySelect" ${cstate.isBatchUploading ? 'disabled' : ''}>
                <option value="public">Public</option>
                <option value="unlisted">Unlisted</option>
                <option value="private">Private</option>
              </select>
              <button class="btn ghost sm" onclick="uApplyBatchVisibility()" ${cstate.isBatchUploading ? 'disabled' : ''}>Apply</button>
            </div>
          </div>
        </div>
      ` : ''}

      <div class="queue-list">
        ${cstate.queue.map((item, idx) => renderQueueItemCard(item, idx)).join("")}
      </div>

      ${cstate.isBatchUploading ? `
        <div class="panel" style="margin-top:20px;border-color:var(--accent);">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <span style="font-weight:700;font-size:13.5px;">Uploading Batch to Cloudflare R2 Storage…</span>
            <span style="font-family:monospace;font-weight:700;color:var(--accent);" id="batchProgressPct">${cstate.batchProgress || 0}%</span>
          </div>
          <div class="upload-progress-track">
            <div class="upload-progress-bar" id="batchProgressBar" style="width:${cstate.batchProgress || 0}%;"></div>
          </div>
          <p class="small" id="batchStatusText" style="margin:8px 0 0 0;color:var(--muted);">
            Processing files in parallel…
          </p>
        </div>
      ` : ''}

      <div class="panel queue-publish-bar" style="margin-top:24px;padding:20px;">
        ${cstate.queue.every(i => i.status === 'live') ? `
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:14px;">
            <div style="display:flex;align-items:center;gap:12px;">
              <span style="font-size:26px;">🎉</span>
              <div>
                <strong style="font-size:15px;color:#2ed573;">All ${cstate.queue.length} videos published successfully!</strong>
                <div class="small" style="color:var(--muted)">Content is live and distributed across Cloudflare CDN.</div>
              </div>
            </div>
            <div style="display:flex;gap:10px;flex-wrap:wrap;">
              <button type="button" class="btn" onclick="go('content')">🎬 View in Content Manager</button>
              <button type="button" class="btn ghost" onclick="go('profile')">👤 Creator Profile</button>
              <button type="button" class="btn ghost" onclick="uStartNewUploadBatch()">⬆ Upload More</button>
            </div>
          </div>
        ` : `
          <label class="small" style="display:flex;gap:10px;align-items:flex-start;cursor:pointer;">
            <input type="checkbox" id="batchRightsConfirm" ${cstate.batchRightsConfirmed ? 'checked' : ''}
              onchange="uSetBatchRightsConfirmed(this.checked)" style="margin-top:2px;" ${cstate.isBatchUploading ? 'disabled' : ''}/>
            <span><strong>18+ Age & Rights Confirmation:</strong> I confirm all performers depicted in these videos are 18+ years of age, I hold the rights to upload this content, and any required 2257 documentation is on file.</span>
          </label>
          <div style="margin-top:16px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;border-top:1px solid var(--border);padding-top:16px;">
            <div class="small" style="color:var(--muted);">
              ${cstate.queue.filter(i => i.status === 'live').length} of ${cstate.queue.length} published
            </div>
            <div style="display:flex;gap:10px;">
              <button type="button" class="btn" style="padding:10px 28px;font-weight:700;" onclick="uPublishBatch()"
                ${cstate.isBatchUploading || !cstate.batchRightsConfirmed ? 'disabled' : ''}>
                ${cstate.isBatchUploading ? '⏳ Uploading…' : `🚀 Publish All (${cstate.queue.length}) Videos`}
              </button>
            </div>
          </div>
        `}
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
  if (p === "upload") {
    setTimeout(attachDropzoneEvents, 0);
  }
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

// Merge manifest.json (R2) into DATA.videos so a creator's own past uploads
// still show in "Content" after a reload — uPublish()'s optimistic
// DATA.videos.unshift() only lives for that page session; without this sync
// the upload looked successful but silently vanished on next visit (the
// video WAS saved server-side the whole time, this app just never read it
// back). Also called again right after a publish succeeds (see uPublish).
function syncCreatorManifest(){
  fetchManifest().then(uploads => { if (mergeManifest(uploads)) render(); })
    .catch(e => console.warn("[manifest] creator sync failed (non-fatal):", e?.message || e));
}
syncCreatorManifest();

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
window.uPickFiles = uPickFiles;
window.uClearQueue = uClearQueue;
window.uRemoveQueueItem = uRemoveQueueItem;
window.uUpdateItemTitle = uUpdateItemTitle;
window.uUpdateItemCategory = uUpdateItemCategory;
window.uUpdateItemVisibility = uUpdateItemVisibility;
window.uApplyBatchCategory = uApplyBatchCategory;
window.uApplyBatchVisibility = uApplyBatchVisibility;
window.uToggleThumbPicker = uToggleThumbPicker;
window.uSelectQueueThumb = uSelectQueueThumb;
window.uSetBatchRightsConfirmed = uSetBatchRightsConfirmed;
window.uOpenSingleEditor = uOpenSingleEditor;
window.uBackToQueue = uBackToQueue;
window.uPublishBatch = uPublishBatch;
window.uPublish = uPublish;
window.uUpdateScrub = uUpdateScrub;
window.uCancelUpload = uCancelUpload;
window.openVideoEditor = openVideoEditor;
window.uSetRightsConfirmed = uSetRightsConfirmed;
window.uStartNewUploadBatch = uStartNewUploadBatch;
window.go = go;
