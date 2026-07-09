import { DATA, esc, creatorName, fmt, toast, mediaUrl } from "../shared/catalog.js";
import { ShAuth, ShAPI } from "../shared/streamhub-api.js";
import { metric, barChart, distRows } from "../shared/ui.js";
import { ageGate } from "../shared/age-gate.js";
ageGate();

/* creatorName(), fmt(), toast() are shared — defined in catalog.js */

/* ===================== CREATOR STUDIO ===================== */
const MY = "c4"; // Alex's creator id
const myVideos = ()=> DATA.videos.filter(v=>v.creator===MY);
function freshUpload(){ return {step:0, title:"", desc:"", visibility:"public", monet:true,
  file:null, url:"", duration:"0:00", durationSec:0, thumb:"", thumbOptions:[],
  categories:[], createdWith:[], tags:[],
  q_cat:"", q_tool:"", q_tag:"",
  sample5:null, sample30:null, capturingClip:"",
  progress:0, uploading:false}; }   // search query per picker
let cstate = { page:"dashboard", upload:freshUpload(), editingProfile:false };

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
const CATEGORY_LIBRARY = ["Lesbian","Transgender","MILF","Anal","Mature","Hentai","Japanese","Threesome",
  "Ebony","Asian","Big Tits","Creampie","Amateur","Big Ass","POV","Latina","Massage","BBW","Teen","Femboy",
  "Step Family","Cosplay","Blowjob","Gangbang","Squirt","Foot Fetish","Public","BDSM","Interracial","Rough Sex"];
const TAG_LIBRARY = ["Hentai","MILF","Pinay","Lesbian","Anal","Big Ass","Latina","Anime","Asian","Femboy",
  "Stepmom","Japanese","Creampie","Threesome","Cosplay","Trans","Big Tits","Blowjob","Gangbang","POV","Massage",
  "Amateur","Cheating","Squirt","BBW","Office","Foot Fetish","Deepthroat","Public","Rough Sex","Pregnant","BDSM",
  "Handjob","GILF","Interracial","JOI","Petite","Lingerie","Pissing","Roleplay","VR","Cumshot","Redhead","Indian",
  "Lesbian Strapon","Cuckold","Gym","No Makeup","ASMR","Double Penetration"];

function go(p){ cstate.page=p; render(); }

/* ---- Upload wizard (REAL, browser-based) ---- */
const STEPS = ["Upload","Processing","AI Thumbnail","Metadata","Visibility","Scheduling","Monetization","Publish"];
function uNext(){ cstate.upload.step=Math.min(cstate.upload.step+1,STEPS.length-1); render(); }
function uPrev(){ cstate.upload.step=Math.max(cstate.upload.step-1,0); render(); }
function uSaveMeta(){
  const t=document.getElementById("uTitle"); if(t) cstate.upload.title=t.value;
  const d=document.getElementById("uDesc"); if(d) cstate.upload.desc=d.value;
  uNext();
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
    const matches=c.lib.filter(o=>o.toLowerCase().includes(q) && !cstate.upload[c.key].includes(o));
    if(matches.length){ pickToggle(pk, matches[0]); }
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
      ${sel.map(s=>`<span class="ms-token">${esc(s)}<button type="button" onclick="event.stopPropagation();pickToggle('${pk}','${esc(s.replace(/'/g,"\\'"))}')">×</button></span>`).join("")}
      <input class="ms-input" id="pk_${pk}" value="${esc(u[c.q]||'')}" placeholder="${sel.length?'':'Type to search…'}"
        oninput="pickSearch('${pk}',this.value)" onkeydown="pickKey('${pk}',event)" autocomplete="off"/>
    </div>
    <div class="ms-list" id="pklist_${pk}">${pickerOptions(pk, avail)}</div>`;
}
function pickerOptions(pk, avail){
  if(!avail.length) return `<div class="ms-empty">No matches</div>`;
  return avail.slice(0,40).map(o=>`<button type="button" class="ms-opt" onclick="pickToggle('${pk}','${esc(o.replace(/'/g,"\\'"))}')">${esc(o)}</button>`).join("");
}
function renderPickerList(pk){
  const c=PICKERS[pk], u=cstate.upload, q=(u[c.q]||"").toLowerCase();
  const avail=c.lib.filter(o=>!u[c.key].includes(o) && (!q || o.toLowerCase().includes(q)));
  const el=document.getElementById("pklist_"+pk); if(el) el.innerHTML=pickerOptions(pk, avail);
}

/* format seconds -> M:SS */
function fmtDur(sec){ sec=Math.round(sec||0); const m=Math.floor(sec/60), s=sec%60; return m+":"+String(s).padStart(2,"0"); }

/* User picked a real file: create object URL, read real duration, advance to Processing */
function uPickFile(input){
  const files = Array.from(input.files || []);
  if(!files.length) return;

  // Enforce max 10 videos
  const currentCount = (cstate.queue && cstate.queue.length) || 0;
  const available = 10 - currentCount;
  if(available <= 0){
    toast("You can upload a maximum of 10 videos at a time");
    return;
  }

  const toAdd = files.slice(0, available);
  if(toAdd.length < files.length){
    toast(`Only ${available} more video(s) allowed (max 10 total)`);
  }

  if(!cstate.queue) cstate.queue = [];
  if(!cstate.mode) cstate.mode = 'queue';

  toAdd.forEach(f => {
    if(!f.type.startsWith("video/")){
      toast("Skipped non-video file: " + f.name);
      return;
    }
    const u = freshUpload();
    u.file = f;
    u.url = URL.createObjectURL(f);
    u.title = f.name.replace(/\.[^.]+$/,"").replace(/[-_]/g," ");
    u.step = 0; // will be probed
    cstate.queue.push(u);

    // Probe metadata + generate thumbs for this item (async)
    uProbeQueueItem(u);
  });

  // If this is the first selection, go to queue review
  cstate.page = "upload";
  render();
}

// Probe a single queue item (duration + thumbnails)
function uProbeQueueItem(u){
  if(!u || u._probing) return;
  u._probing = true;

  const v = document.createElement("video");
  v.preload = "metadata"; v.muted = true; v.src = u.url;

  v.onloadedmetadata = () => {
    u.duration = fmtDur(v.duration);
    u.durationSec = v.duration;

    const dur = v.duration;
    const stamps = [0.05,0.15,0.30,0.50,0.70,0.85].map(p => Math.max(0.05, Math.min(dur * p, dur - 0.1)));

    captureFrames(v, stamps, (thumbs) => {
      u.thumbOptions = thumbs;
      u.thumb = thumbs[0] || "";
      u._probing = false;
      if(cstate.page === "upload") render();
    });
  };

  v.onerror = () => {
    u._probing = false;
    toast("Could not read: " + (u.title || "video"));
  };
}

/* Read real duration from the file and generate REAL thumbnails from frames */
function uProbe(){
  const u = cstate.upload;
  const v = document.createElement("video");
  v.preload = "metadata"; v.muted = true; v.src = u.url;
  v.onloadedmetadata = ()=>{
    u.duration = fmtDur(v.duration);
    u.durationSec = v.duration;
    // capture 6 frames spread across the video for thumbnail options
    const dur = v.duration;
    const stamps = [0.05,0.15,0.30,0.50,0.70,0.85].map(p=>Math.max(0.05, Math.min(dur*p, dur-0.1)));
    captureFrames(v, stamps, (thumbs)=>{
      u.thumbOptions = thumbs;
      u.thumb = thumbs[0] || "";
      if(cstate.page==="upload" && cstate.upload.step===1) uNext();  // -> AI Thumbnail
      else render();
    });
  };
  v.onerror = ()=>{ toast("Couldn't read that file"); };
}

/* Grab still frames into data URLs using a canvas */
function captureFrames(video, stamps, done){
  const canvas = document.createElement("canvas");
  const out = []; let i = 0;
  const grab = ()=>{
    if(i >= stamps.length){ done(out); return; }
    video.currentTime = stamps[i];
  };
  video.onseeked = ()=>{
    const w = video.videoWidth || 320, h = video.videoHeight || 180;
    canvas.width = 320; canvas.height = Math.round(320 * h / w);
    try{
      canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
      out.push(canvas.toDataURL("image/jpeg", 0.7));
    }catch(e){ /* tainted/decode issue — skip */ }
    i++;
    if(i >= stamps.length){ video.src = ""; done(out); } // cleanup src before done
    else grab();
  };
  grab();
}

function uChooseThumb(idx){ cstate.upload.thumb = cstate.upload.thumbOptions[idx]; render(); }

/* Capture current video frame (from scrubber) as the thumbnail */
function uCaptureCurrentFrame(){
  const v = document.getElementById("thumbScrubVideo");
  if(!v) return;
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
    v.src = videoUrl; v.muted = true; v.preload = "auto";
    v.onloadeddata = ()=>{
      v.currentTime = startTime;
      v.onseeked = ()=>{
        let stream;
        try{ stream = v.captureStream(); }
        catch(e){ reject(new Error("captureStream not supported in this browser")); return; }
        const mime = ["video/webm;codecs=vp8","video/webm"].find(t=>MediaRecorder.isTypeSupported(t)) || "video/webm";
        const rec = new MediaRecorder(stream, {mimeType:mime});
        const chunks = [];
        rec.ondataavailable = e=>{ if(e.data.size>0) chunks.push(e.data); };
        rec.onstop = ()=>resolve(new Blob(chunks, {type: mime.split(";")[0]}));
        rec.start(200);
        v.play().catch(()=>{});
        setTimeout(()=>{ rec.stop(); v.pause(); v.src=""; }, secs*1000+200);
      };
    };
    v.onerror = ()=>reject(new Error("Video load failed"));
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
  const mime = arr[0].match(/:(.*?);/)[1];
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
  if(!u.file){ toast("No file selected"); cstate.upload.step=0; render(); return; }
  _publishing = true;
  u.uploading = true; u.progress = 0; render();

  const setBar = pct=>{ const b=document.getElementById("uploadProgressBar"); if(b) b.style.width=pct+"%"; };

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
      status:"public", flagged:false
    });

    try {
      // 1. Upload main video file securely via Vercel serverless relay
      const uploadInfo = await ShAPI.uploadVideo(u.file, u.title||"Untitled", pct=>{
        u.progress = pct; setBar(pct);
      });
      const cdnSrc = uploadInfo.src;
      setBar(100); u.progress = 100;

      // 2. Convert and upload thumbnail if it is a base64 Data URL
      let thumbUrl = "";
      if (u.thumb && u.thumb.startsWith("data:")) {
        try {
          const thumbFile = dataURLtoFile(u.thumb, `thumb_${localId}.jpg`);
          const thumbUploadInfo = await ShAPI.uploadVideo(thumbFile, u.title + " Thumbnail", () => {});
          thumbUrl = thumbUploadInfo.url;
        } catch (e) {
          console.error("Thumbnail upload failed, falling back to data URL:", e);
          thumbUrl = u.thumb;
        }
      } else {
        thumbUrl = u.thumb;
      }

      // 3. Upload sample clips if captured (non-blocking) securely via Vercel relay
      if(u.sample5){
        try{
          const f5 = new File([u.sample5], (u.title||"video").replace(/\s+/g,"-")+"-5s.webm", {type:"video/webm"});
          await ShAPI.uploadVideo(f5, u.title+"-5s", ()=>{});
        }catch(_){}
      }
      if(u.sample30){
        try{
          const f30 = new File([u.sample30], (u.title||"video").replace(/\s+/g,"-")+"-30s.webm", {type:"video/webm"});
          await ShAPI.uploadVideo(f30, u.title+"-30s", ()=>{});
        }catch(_){}
      }

      // Point local entry at real CDN src and thumbnail URL
      const vid = DATA.videos.find(v=>v.id===localId);
      if(vid) {
        vid.src = cdnSrc;
        vid.thumb = thumbUrl;
      }

      // Save to Bunny manifest via secure serverless endpoint so the video appears for ALL visitors immediately
      const manifestEntry = {
        id: localId,
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
        status: "public",
        flagged: false
      };
      try{
        await ShAPI.saveToManifest(manifestEntry);
      } catch(err){
        console.error("Manifest save failed:", err);
      }

      await new Promise(r=>setTimeout(r,300));
      toast(`✓ "${u.title||'Untitled'}" is live!`);
    } catch(e){
      // TEMP: do not mark as "upload-failed" to avoid blocking the creator list.
      // The entry stays as optimistic "public" with local blob URL for now.
      // Remote upload (Bunny) may have failed due to missing API base / env / network.
      console.error("Upload remote step failed (kept local):", e);
      toast("Remote upload step failed (kept locally for now): " + (e.message || "see console"));
    }

    u.uploading = false;

    // If we were editing a queue item, go back to queue instead of content
    if(cstate._queueContext){
      const ctx = cstate._queueContext;
      // Update the item in queue with edited values
      if(ctx.queue && ctx.queue[ctx.idx]){
        const edited = cstate.upload;
        Object.assign(ctx.queue[ctx.idx], {
          title: edited.title,
          desc: edited.desc,
          categories: edited.categories,
          tags: edited.tags,
          thumb: edited.thumb,
          visibility: edited.visibility,
          duration: edited.duration,
          durationSec: edited.durationSec,
          thumbOptions: edited.thumbOptions,
        });
      }
      cstate.queue = ctx.queue;
      cstate.mode = 'queue';
      delete cstate._queueContext;
      cstate.upload = freshUpload();
      cstate.page = "upload";
    } else {
      cstate.upload = freshUpload();
      cstate.page = "content";
    }
    render();
  } finally {
    _publishing = false;
  }
}

function retryUpload(id){
  // Remove the failed stub and re-open the upload wizard so user can re-pick the file
  const idx = DATA.videos.findIndex(v=>v.id===id);
  if(idx>=0) DATA.videos.splice(idx,1);
  cstate.upload = freshUpload();
  cstate.page = "upload";
  toast("Please re-select your video file to retry");
  render();
}

/* ==================== MULTI UPLOAD QUEUE (up to 10 videos) ==================== */

function renderUploadQueue(){
  const q = cstate.queue || [];
  const count = q.length;

  const itemsHTML = q.map((item, idx) => {
    const thumb = item.thumb || (item.thumbOptions && item.thumbOptions[0]) || '';
    return `
      <div class="queue-item" style="display:flex;gap:12px;align-items:flex-start;padding:10px;border:1px solid var(--border);border-radius:8px;margin-bottom:8px;background:var(--surface2)">
        <div style="width:110px;height:62px;flex-shrink:0;border-radius:6px;overflow:hidden;background:#111">
          ${thumb ? `<img src="${thumb}" style="width:100%;height:100%;object-fit:cover"/>` : `<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:11px;color:#666">No thumb</div>`}
        </div>
        <div style="flex:1;min-width:0">
          <input class="fld" style="font-size:13px;padding:4px 8px;margin-bottom:4px" value="${esc(item.title)}"
            oninput="cstate.queue[${idx}].title = this.value" />
          <div class="small" style="color:var(--muted)">${esc(item.duration || '—')} • ${esc(item.categories && item.categories[0] || 'No cat')}</div>
          <div style="margin-top:6px">
            <button class="chip" onclick="editQueueItem(${idx})">Edit details</button>
            <button class="chip" style="color:var(--accent2)" onclick="removeFromQueue(${idx})">Remove</button>
          </div>
        </div>
        <div style="text-align:right;min-width:70px">
          ${item._uploading ? `<div class="small" style="color:var(--accent)">${item._progress||0}%</div>` : ''}
          ${item.status === 'done' ? `<span class="tag-pill green">Done</span>` : ''}
          ${item.status === 'failed' ? `<span class="tag-pill red">Failed</span>` : ''}
        </div>
      </div>`;
  }).join('');

  return `
    <h1>Upload Queue</h1>
    <p class="sub">You have <b>${count}</b> video(s) ready (max 10)</p>

    <div class="panel" style="padding:12px">
      ${itemsHTML || '<div class="empty">No videos in queue</div>'}
    </div>

    <div style="margin:16px 0">
      <label class="lbl">Apply to all (quick bulk)</label>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <select class="fld" style="max-width:180px" onchange="bulkApplyCategory(this.value)">
          <option value="">— Set category for all —</option>
          ${CATEGORY_LIBRARY.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('')}
        </select>
        <button class="btn ghost sm" onclick="bulkApplyToAll()">Apply common settings</button>
      </div>
    </div>

    <div style="margin-top:16px">
      <button class="btn" style="width:100%;padding:14px;font-size:15px" onclick="publishQueue()" ${count===0 ? 'disabled' : ''}>
        🚀 Publish All (${count} videos)
      </button>

      <div style="display:flex;gap:8px;margin-top:8px">
        <label class="btn ghost sm" style="flex:1;text-align:center;cursor:pointer">
          + Add more videos (up to 10)
          <input type="file" accept="video/*" multiple style="display:none" onchange="uPickFile(this)"/>
        </label>
        <button class="btn ghost sm" style="flex:1" onclick="clearQueue()">Clear</button>
      </div>

      <p class="small" style="text-align:center;margin-top:8px;color:var(--muted)">Videos will be uploaded one by one</p>
    </div>
  `;
}

function editQueueItem(idx){
  // Switch temporarily to single-item wizard for detailed editing
  const item = cstate.queue[idx];
  if(!item) return;

  // Save current queue context
  cstate._queueContext = { idx, queue: cstate.queue };

  // Load item into the classic single upload state
  cstate.upload = {...item, step: 2}; // jump to thumbnail step or 3 for metadata
  cstate.mode = 'single-edit';
  cstate.page = 'upload';
  render();
}

function removeFromQueue(idx){
  if(!cstate.queue) return;
  cstate.queue.splice(idx,1);
  if(cstate.queue.length === 0){
    cstate.queue = null;
    cstate.mode = null;
  }
  render();
}

function bulkApplyCategory(cat){
  if(!cstate.queue || !cat) return;
  cstate.queue.forEach(item => {
    item.categories = [cat];
    item.category = cat;
  });
  render();
}

function bulkApplyToAll(){
  // Simple: copy common fields from first item to others
  if(!cstate.queue || cstate.queue.length < 2) return;
  const src = cstate.queue[0];
  cstate.queue.forEach((item,i) => {
    if(i===0) return;
    item.categories = [...(src.categories||[])];
    item.tags = [...(src.tags||[])];
    item.visibility = src.visibility || 'public';
  });
  toast("Applied common settings to all videos");
  render();
}

function clearQueue(){
  cstate.queue = null;
  cstate.mode = null;
  cstate.upload = freshUpload();
  render();
}

async function publishQueue(){
  const q = cstate.queue;
  if(!q || !q.length) return;

  let success = 0;
  let failed = 0;

  for(let i = 0; i < q.length; i++){
    const item = q[i];
    item._uploading = true;
    item._progress = 0;
    item.status = '';
    render();

    try{
      const seedViews = 10000 + Math.floor(Math.random()*5001);
      const seedLikes = 100 + Math.floor(Math.random()*201);
      const localId = Date.now() + i;

      // Add optimistic entry
      DATA.videos.unshift({
        id: localId,
        title: item.title || "Untitled",
        creator: MY,
        type: "ugc",
        category: item.categories && item.categories[0] || "POV",
        categories: item.categories || [],
        views: seedViews,
        likes: seedLikes,
        dislikes: 0,
        comments: 0,
        favorites: 0,
        duration: item.duration || "",
        uploaded: new Date().toISOString().slice(0,10),
        src: item.url,
        thumb: item.thumb || "",
        tags: item.tags || [],
        status: "public",
        flagged: false
      });

      // 1. Upload main file
      const uploadInfo = await ShAPI.uploadVideo(item.file, item.title || "Untitled", (pct) => {
        item._progress = pct;
        render();
      });

      const cdnSrc = uploadInfo.src;

      // 2. Upload thumb if base64
      let thumbUrl = item.thumb || "";
      if(item.thumb && item.thumb.startsWith("data:")){
        try{
          const thumbFile = dataURLtoFile(item.thumb, `thumb_${localId}.jpg`);
          const tinfo = await ShAPI.uploadVideo(thumbFile, (item.title||"video") + " thumb", ()=>{});
          thumbUrl = tinfo.url;
        }catch(e){ console.warn("thumb upload failed", e); }
      }

      // 3. Save manifest
      const manifestEntry = {
        id: localId,
        title: item.title || "Untitled",
        creator: MY,
        type: "ugc",
        src: cdnSrc,
        thumb: thumbUrl,
        category: item.categories && item.categories[0] || "Amateur",
        categories: item.categories || [],
        tags: item.tags || [],
        duration: item.duration || "",
        uploaded: new Date().toISOString().slice(0,10),
        views: seedViews,
        likes: seedLikes,
        status: "public",
        flagged: false
      };

      await ShAPI.saveToManifest(manifestEntry);

      // Update the optimistic entry
      const vid = DATA.videos.find(v => v.id === localId);
      if(vid){
        vid.src = cdnSrc;
        vid.thumb = thumbUrl;
      }

      item.status = 'done';
      success++;

    }catch(e){
      console.error("Queue item failed", e);
      item.status = 'failed';
      failed++;
      // remove the optimistic entry on failure
      // (we can leave it or remove — for now leave as "local" like before)
    }

    item._uploading = false;
    render();
  }

  toast(`${success} uploaded${failed ? `, ${failed} failed` : ''}`);

  // Clean up queue
  cstate.queue = null;
  cstate.mode = null;
  cstate.page = "content";
  render();
}

function renderDashboard(){
  const r=DATA.revenue;
  return `<h1>Dashboard</h1><p class="sub">Welcome back, Alex — here's how your channel is doing.</p>
    <div class="metrics">
      ${metric("Revenue (mo)","$"+((r.history&&r.history.length?r.history[r.history.length-1].v:0)).toLocaleString(),"18%",true)}
      ${metric("Subscribers",fmt(DATA.creators.find(c=>c.id===MY).subs),"4.2%",true)}
      ${metric("Views (7d)",fmt(DATA.analytics.views7d.reduce((a,b)=>a+b,0)),"9%",true)}
      ${metric("Watch Time","54.2K min","6%",true)}
      ${metric("CTR","7.8%","0.4%",true)}
      ${metric("Engagement","12.4%","1.1%",true)}
      ${metric("Comments",DATA.comments.length,"3",true)}
      ${metric("Growth","+312","subs",true)}
    </div>
    <div class="grid" style="grid-template-columns:2fr 1fr;margin-top:18px">
      <div class="panel"><h3 style="margin-top:0">Views — last 7 days</h3>${barChart(DATA.analytics.views7d,["M","T","W","T","F","S","S"])}</div>
      <div class="panel"><h3 style="margin-top:0">Top Traffic Sources</h3>${distRows(DATA.analytics.traffic)}</div>
    </div>`;
}

function renderContent(){
  return `<h1>Content</h1><p class="sub">Manage your videos</p>
    <div class="panel" style="padding:0">
    <table class="data"><thead><tr><th>Video</th><th>Status</th><th>Views</th><th>Likes</th><th>Comments</th><th>Date</th></tr></thead><tbody>
    ${myVideos().map(v=>`<tr style="cursor:pointer" onclick="toast('Opening editor for: ${esc(v.title)}')">
      <td><b>${esc(v.title)}</b><div class="small">${esc(v.category)}</div></td>
      <td><span class="tag-pill ${v.status==='published'?'green':v.status==='review'?'warn':v.status==='upload-failed'?'red':'muted'}">${esc(v.status==='upload-failed'?'Failed':v.status)}</span>${v.status==='upload-failed'?` <button class="chip retry-btn" onclick="event.stopPropagation();retryUpload(${v.id})">↺ Retry</button>`:''}</td>
      <td>${fmt(v.views)}</td><td>${fmt(v.likes)}</td><td>${v.comments}</td><td class="small">${esc(v.uploaded)}</td></tr>`).join("")}
    </tbody></table></div>`;
}

/* ---- Auth gate removed for now (temp) to unblock uploads.
   Email/magic link requirement disabled. The functions below are left for future re-enable. ---- */
function authReady(){ return false; } // TEMP: always pretend not to force sign-in
// renderSignIn, sendMagicLink, signOutCreatorAuth left commented for easy re-enable
/* 
function renderSignIn(){ ... }
async function sendMagicLink(){ ... }
function signOutCreatorAuth(){ ... }
*/

function renderUpload(){
  // MULTI-UPLOAD QUEUE MODE (up to 10 videos)
  if(cstate.queue && cstate.queue.length > 0 && cstate.mode !== 'single-edit'){
    return renderUploadQueue();
  }

  const s=cstate.upload.step;
  const u = cstate.upload;
  const body = [
    `<p><b>Select up to 10 videos</b></p>
      <label class="empty" style="cursor:pointer;display:block">
        ⤒ Click to choose video files (max 10)<div class="small" style="margin-top:6px">MP4, WebM, MOV — you can upload multiple at once</div>
        <input type="file" accept="video/*" multiple style="display:none" onchange="uPickFile(this)"/>
      </label>
      ${ (cstate.queue && cstate.queue.length) ? `<div class="small" style="margin-top:8px;color:var(--accent)">${cstate.queue.length} video(s) selected — scroll down to review & publish</div>` : '' }`,
    `<p><b>Reading your video…</b></p><p class="small">Extracting duration and generating thumbnails from real frames</p><div class="loader"></div>
      ${u.url?`<br/><video class="player" style="height:180px" src="${u.url}" muted></video>`:''}`,
    `<p><b>Thumbnail &amp; Previews</b></p>
      <p class="small" style="margin-bottom:12px">Pick a frame or scrub to any moment in your video.</p>

      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:14px">
        ${(u.thumbOptions.length?u.thumbOptions:['']).map((t,i)=>`
          <div style="height:80px;border:2px solid ${u.thumb===t&&t?'var(--accent)':'rgba(255,255,255,.1)'};border-radius:6px;overflow:hidden;cursor:pointer;background:#111" onclick="uChooseThumb(${i})">
            ${t?`<img src="${t}" style="width:100%;height:100%;object-fit:cover"/>`:'<div class="small" style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--muted)">⋯</div>'}
          </div>`).join("")}
      </div>

      <div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:14px;margin-bottom:12px">
        <p class="small" style="margin:0 0 8px;color:var(--muted);letter-spacing:.06em;font-size:.7rem">CUSTOM FRAME</p>
        <video id="thumbScrubVideo" src="${u.url||''}" muted playsinline
          style="width:100%;height:130px;object-fit:contain;background:#000;border-radius:6px;display:block;margin-bottom:8px"></video>
        <input type="range" style="width:100%;margin-bottom:8px;accent-color:var(--accent)"
          min="0" max="${(u.durationSec||100).toFixed(1)}" step="0.1" value="0"
          oninput="document.getElementById('thumbScrubVideo').currentTime=this.value"/>
        <button class="btn ghost sm" style="width:100%" onclick="uCaptureCurrentFrame()">📸 Use this frame as thumbnail</button>
      </div>

      <div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:14px">
        <p class="small" style="margin:0 0 10px;color:var(--muted);letter-spacing:.06em;font-size:.7rem">PREVIEW SAMPLES</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div>
            <p class="small" style="margin:0 0 6px;font-weight:600">5-second teaser</p>
            ${u.sample5?`<p class="small" style="color:var(--accent);margin:0 0 6px">✓ Captured</p>`:''}
            <button class="btn ghost sm" style="width:100%" onclick="uCaptureClip(5)" ${u.capturingClip==="5s"?'disabled':''}>
              ${u.capturingClip==="5s"?'⏺ Recording…':u.sample5?'↻ Re-capture':'⏺ Capture 5s'}
            </button>
          </div>
          <div>
            <p class="small" style="margin:0 0 6px;font-weight:600">30-second preview</p>
            ${u.sample30?`<p class="small" style="color:var(--accent);margin:0 0 6px">✓ Captured</p>`:''}
            <button class="btn ghost sm" style="width:100%" onclick="uCaptureClip(30)" ${u.capturingClip==="30s"?'disabled':''}>
              ${u.capturingClip==="30s"?'⏺ Recording 30s…':u.sample30?'↻ Re-capture':'⏺ Capture 30s'}
            </button>
          </div>
        </div>
        <p class="small" style="margin-top:8px;color:var(--muted)">Clips start 10% in. Optional but boost conversions.</p>
      </div>`,
    `<label class="lbl">Title</label><input class="fld" id="uTitle" value="${esc(u.title)}" placeholder="Add a title"/>
      <label class="lbl">Description</label><textarea class="fld" id="uDesc" placeholder="Tell viewers about your video">${esc(u.desc)}</textarea>
      <label class="lbl">Category <span class="small">(${u.categories.length}/${MAX_CATS})</span></label>
      ${pickerHTML('cat')}
      <label class="lbl">Created using <span class="small">(${u.createdWith.length} selected)</span></label>
      ${pickerHTML('tool')}
      <label class="lbl">Tags <span class="small">(${u.tags.length}/${MAX_TAGS})</span></label>
      ${pickerHTML('tag')}`,
    `<label class="lbl">Visibility</label>
      <select class="fld" onchange="cstate.upload.visibility=this.value">
        <option value="public">Public</option><option value="unlisted">Unlisted</option><option value="private">Private</option></select>`,
    `<p><b>Scheduling</b></p><label class="lbl">Publish</label>
      <select class="fld"><option>Now</option><option>Schedule for later</option></select>
      <label class="lbl">Date</label><input class="fld" type="date"/>`,
    `<p><b>Monetization</b></p>
      <label class="lbl"><input type="checkbox" checked onchange="cstate.upload.monet=this.checked"/> Enable ads</label>
      <label class="lbl"><input type="checkbox" checked/> Allow Premium revenue</label>
      <label class="lbl"><input type="checkbox"/> Accept tips</label>`,
    `${u.uploading ? `
      <p><b>Uploading…</b></p>
      <div class="upload-progress-track"><div class="upload-progress-bar" id="uploadProgressBar" style="width:${u.progress.toFixed(0)}%"></div></div>
      <p class="small" style="margin-top:8px">${u.progress < 100 ? 'Sending your video to the CDN…' : '✓ Upload complete — saving metadata…'}</p>
    ` : `
      <p><b>Ready to publish</b></p>
      <div style="display:flex;gap:14px;align-items:center;margin-bottom:14px">
        <div class="video-thumb" style="width:140px;height:80px;margin:0;flex:none">
          ${u.thumb?`<img src="${u.thumb}" style="width:100%;height:100%;object-fit:cover"/>`:`<div class="thumb-placeholder">🎬</div>`}
        </div>
        <div><b>${esc(u.title||'Untitled')}</b>
          <div class="small">${esc(u.categories.join(', ')||'No category')} · ${esc(u.visibility)} · ${esc(u.duration)}${u.createdWith.length?` · ${esc(u.createdWith.join(', '))}`:''}</div>
          ${u.tags.length?`<div class="small" style="margin-top:4px">${esc(u.tags.join(', '))}</div>`:''}
        </div>
      </div>
      `}`,
  ][s];

  // Shared footer: Back on the left, primary action on the bottom-right.
  // Step 1 (Processing) is auto-advancing, so no buttons.
  const primary = [
    null,                                                            // 0 Upload (file picker advances)
    null,                                                            // 1 Processing (auto)
    {label:"Use selected", fn:"uNext()"},                            // 2 Thumbnail
    {label:"Next →",        fn:"uSaveMeta()"},                       // 3 Metadata
    {label:"Next →",        fn:"uNext()"},                           // 4 Visibility
    {label:"Next →",        fn:"uNext()"},                           // 5 Scheduling
    {label:"Next →",        fn:"uNext()"},                           // 6 Monetization
    u.uploading ? null : {label:"🚀 Publish Video", fn:"uPublish()"},  // 7 Publish
  ][s];

  const showBack = s>0 && s!==1;
  const footer = (showBack || primary) ? `
    <div class="wizard-footer">
      <div>${showBack?`<button class="btn ghost sm" onclick="uPrev()">← Back</button>`:''}</div>
      <div>${primary?`<button class="btn" onclick="${primary.fn}">${primary.label}</button>`:''}</div>
    </div>` : '';

  return `<h1>Upload</h1><p class="sub">Step ${s+1} of ${STEPS.length} — ${STEPS[s]}</p>
    <div class="steps">${STEPS.map((_,i)=>`<div class="dot ${i<=s?'active':''}"></div>`).join("")}</div>
    <div class="panel" style="max-width:640px">
      <div class="wizard-body">${body}</div>
      ${footer}
    </div>`;
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
  return `<h1>Subscribers</h1><p class="sub">${fmt(DATA.creators.find(c=>c.id===MY).subs)} total</p>
    <div class="panel"><h3 style="margin-top:0">Growth</h3>${barChart([820,910,980,1050,1140,1240],["Jan","Feb","Mar","Apr","May","Jun"])}</div>
    <h3>Recent Subscribers</h3>
    <div class="panel" style="padding:0"><table class="data"><thead><tr><th>User</th><th>Tier</th><th>Joined</th></tr></thead><tbody>
      ${(DATA.users||[]).filter(u=>u.role==='viewer').map(u=>`<tr><td>${esc(u.name)}</td><td><span class="tag-pill ${u.subs==='Premium'?'green':'muted'}">${esc(u.subs)}</span></td><td class="small">${esc(u.joined)}</td></tr>`).join("") || '<tr><td colspan="3" style="text-align:center;color:var(--muted)">No subscriber data yet.</td></tr>'}
    </tbody></table></div>`;
}

function renderComments(){
  return `<h1>Comments</h1><p class="sub">Across all your videos</p>
    ${DATA.comments.map(m=>`<div class="panel" style="margin-bottom:10px;display:flex;justify-content:space-between;align-items:center">
      <div><b>${esc(m.user)}</b> <span class="small">on "${esc(DATA.videos.find(v=>v.id===m.video)?.title)}"</span><div style="font-size:13px;margin-top:4px">${esc(m.text)}</div></div>
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
        <p class="sub">Subscribe to a plan to open your Creator Studio and start uploading.</p>
        <div class="plan-grid">
          ${CREATOR_PLANS.map(p=>`
            <div class="plan ${p.best?'best':''}">
              ${p.best?`<div class="plan-badge">Most popular</div>`:''}
              <h3>${p.name}</h3>
              <div class="plan-price">${p.price}</div>
              <p class="small">${p.note}</p>
              <ul class="plan-feats">${p.feats.map(f=>`<li>✓ ${f}</li>`).join("")}</ul>
              <button class="btn ${p.best?'':'ghost'}" style="width:100%" onclick="startSubscribe('${p.id}')">
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
      ${metric("Plan",c.plan.charAt(0).toUpperCase()+c.plan.slice(1))}
      ${metric("Member since",c.joined)}
      ${metric("Your videos",myVideos().length)}
      ${metric("Category",esc(c.category))}
    </div>
    <br/>
    <button class="btn ghost sm" onclick="signOutCreator()">Sign out</button>`;
}

function syncChrome(){
  const gated = !creator;
  // Hide sidebar nav + upload button until subscribed
  document.querySelector(".sidebar").style.display = gated ? "none" : "";
  document.querySelector(".topbar-actions").style.visibility = gated ? "hidden" : "";
  if(creator){
    const nameEl = document.getElementById("creatorName");
    if(nameEl) nameEl.textContent = creator.name;
    const av = document.getElementById("avatarBtn");
    if(av){ av.textContent = creator.avatar; av.title="Profile"; }
  }
}

function render(){
  const v=document.getElementById("view"); const p=cstate.page;

  // TEMP: Email/magic link auth gate removed for now to unblock uploads.
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

/* If we returned from a magic link, capture the session and land on Upload page. */
if(typeof ShAuth!=="undefined"){
  const sess = ShAuth.captureSessionFromUrl();
  if(sess){ cstate.page="upload"; toast("Signed in — you can upload now"); }
  
  // Hydrate header information if already signed in
  (async () => {
    if(ShAuth.isSignedIn()){
      const user = await ShAuth.user();
      if(user && user.email){
        const name = creator?.name || user.email.split("@")[0];
        const nameSpan = document.getElementById("creatorName");
        if(nameSpan) nameSpan.textContent = name;
        const av = document.getElementById("avatarBtn");
        if(av) av.textContent = name[0].toUpperCase();
      }
    }
  })();
}

/* Delegated nav click listener (replaces inline onclick) */
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-page]");
  if (b) go(b.dataset.page);
});

render();

/* ---- Attach functions invoked from inline HTML event handler attributes ---- */
window.go = go;
window.onboardBack = onboardBack;
window.finishSubscribe = finishSubscribe;
window.pickKey = pickKey;
window.pickSearch = pickSearch;
window.pickToggle = pickToggle;
// TEMP: sendMagicLink removed (auth disabled for uploads)
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
window.uPrev = uPrev;
window.uNext = uNext;
window.uSaveMeta = uSaveMeta;
window.uPublish = uPublish;
window.publishQueue = publishQueue;
window.removeFromQueue = removeFromQueue;
window.editQueueItem = editQueueItem;
