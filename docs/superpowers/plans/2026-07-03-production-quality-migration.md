# StreamHub Vite Migration, Dedup & Reliability Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Vite build tooling (replacing manual `?v=N` cache-busting), split the three monolithic HTML apps into real ES modules, deduplicate the shared `metric`/`barChart`/`distRows` helpers (fixing a live divergence bug), and fix 8 concrete production reliability bugs found in a codebase audit — without changing the Bunny-storage deploy model, without a framework migration, and without merging creator/manager/viewer into one app.

**Architecture:** Vite multi-page build with three HTML entries (`creator/index.html`, `manager/index.html`, `viewer/index.html`), each loading a `type="module"` script from `src/<app>/main.js`. Shared code moves to `src/shared/` (`catalog.js`, `streamhub-api.js`, new `ui.js`). Because all three apps' markup uses inline `onclick="fn(...)"` handlers, every function referenced from HTML must be explicitly attached to `window` at the end of each module — this is the one place a plain "convert to ES modules" step can silently break the site, so it gets called out per task.

**Tech Stack:** Vite (build tool only, no framework), vanilla JS ES modules, existing Supabase/Bunny backend untouched.

## Global Constraints

- Deploy stays Bunny storage: `npm run build` → upload contents of `dist/` → purge Pull Zone cache. No change to this model (per `CLAUDE.md`).
- No framework (React/Preact/Svelte/etc.) — vanilla JS only.
- No merge of creator/manager/viewer into one routed app — three separate Vite entries.
- `catalog.js`'s `DATA` object and video-editing workflow (`CLAUDE.md`'s "Adding videos" steps) must keep working exactly as documented — editing the catalog data must remain a single-file edit.
- Every function called from an inline `onclick="..."`/`onkeydown="..."` HTML attribute must be assigned to `window` in the owning module, or the button silently does nothing (no error surfaced) after modularization. Each task below lists the exact functions requiring this for its file.
- No test suite exists and adding a full harness is out of scope; verification is manual (`npm run build` + `vite preview` + exercising each flow), as specified in the design doc.

---

## Task 1: Scaffold Vite project and directory structure

**Files:**
- Create: `platform/package.json`
- Create: `platform/vite.config.js`
- Create: `platform/.gitignore` (append `dist/` and `node_modules/` if not already present)
- Create: `platform/src/shared/` (empty dir, populated in Task 2)

**Interfaces:**
- Produces: `npm run dev` (Vite dev server), `npm run build` (outputs to `platform/dist/`), `npm run preview` (serve built output locally) — these commands are relied on by every later task's verification step.

- [ ] **Step 1: Check current `.gitignore` and `package.json` state**

```bash
cat platform/.gitignore 2>/dev/null || echo "NO GITIGNORE"
cat platform/package.json 2>/dev/null || echo "NO PACKAGE.JSON"
```

Expected: no `package.json` exists yet (confirmed during planning); note whether `.gitignore` exists so Step 2 appends rather than overwrites.

- [ ] **Step 2: Create `package.json`**

```json
{
  "name": "streamhub-platform",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "devDependencies": {
    "vite": "^5.4.10"
  }
}
```

- [ ] **Step 3: Create `vite.config.js` with multi-page entries**

```js
import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  root: ".",
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, "index.html"),
        creator: resolve(__dirname, "creator/index.html"),
        manager: resolve(__dirname, "manager/index.html"),
        viewer: resolve(__dirname, "viewer/index.html"),
      },
    },
  },
});
```

- [ ] **Step 4: Update `.gitignore`**

Append (creating the file if it doesn't exist):

```
dist/
node_modules/
```

- [ ] **Step 5: Install dependencies**

```bash
cd platform && npm install
```

Expected: `node_modules/` created, `package-lock.json` created, no errors.

- [ ] **Step 6: Commit**

```bash
git add platform/package.json platform/package-lock.json platform/vite.config.js platform/.gitignore
git commit -m "build: scaffold Vite for multi-page StreamHub build"
```

---

## Task 2: Extract shared modules — catalog, streamhub-api, and new ui.js

**Files:**
- Create: `platform/src/shared/catalog.js` (moved from `platform/catalog.js`, converted to ES exports)
- Create: `platform/src/shared/streamhub-api.js` (moved from `platform/streamhub-api.js`, converted to ES exports)
- Create: `platform/src/shared/ui.js` (new — extracted `metric`, `barChart`, `distRows`)
- Create: `platform/src/shared/theme.css` (new — the shared `:root { --bg: ...; }` CSS custom properties, identical in all three apps' `<style>` blocks lines 11-25ish)
- Delete: `platform/catalog.js`, `platform/streamhub-api.js` (after confirming nothing outside `platform/` references the old root paths)

**Interfaces:**
- Produces from `src/shared/catalog.js`: named exports `MEDIA_BASE`, `DATA`, `esc(s)`, `creatorName(id)`, `fmt(n)`, `toast(msg)`, `mediaUrl(src)`.
- Produces from `src/shared/streamhub-api.js`: named exports `ShAuth`, `ShAPI`, `SH_API_ENABLED`, `shClientId()`.
- Produces from `src/shared/ui.js`: named exports `metric(label, value, delta, up)`, `barChart(values, labels)`, `distRows(arr)`. **Canonical `metric()` includes the `${up?'▲':'▼'}` arrow** — this is the creator version; the manager's arrow-less version is the bug being fixed by this extraction.
- Consumes: nothing (base layer all other tasks import from).

- [ ] **Step 1: Read the full current `catalog.js` and `streamhub-api.js` to confirm no other consumer exists**

```bash
grep -rn "catalog.js\|streamhub-api.js" /Users/liyam/Downloads/videomat/platform --include="*.html" --include="*.js"
```

Expected: only the three app HTML files (`creator/creator-studio.html`, `manager/platform-manager.html`, `viewer/viewer-app.html`) and `index.html` reference these paths via `<script src>`. If `index.html` does NOT load `catalog.js` (confirmed during planning — it's a static picker page with no catalog dependency), it needs no change here.

- [ ] **Step 2: Create `src/shared/catalog.js`**

Copy the entire content of `platform/catalog.js` verbatim (all 291 lines: the `MEDIA_BASE` const, `esc`, `creatorName`, `fmt`, `toast`, `mediaUrl` functions, and the full `DATA` object literal with all video/creator/comment/analytics/moderation data). At the end of the file, add:

```js
export { MEDIA_BASE, DATA, esc, creatorName, fmt, toast, mediaUrl };
```

Do not otherwise change any line of the data or logic — this is a pure move + export.

- [ ] **Step 3: Create `src/shared/streamhub-api.js`**

Copy the entire content of `platform/streamhub-api.js` verbatim (all 197 lines). At the end of the file, add:

```js
export { ShAuth, ShAPI, SH_API_ENABLED, shClientId };
```

Note: `ShAPI.uploadApiBase` reads `(typeof SH_UPLOAD_API_BASE!=="undefined" ? SH_UPLOAD_API_BASE : "")` — this global-variable check still works as-is inside a module since it's checking a global `window`-scope variable, not doing anything module-specific. No change needed to that line.

- [ ] **Step 4: Create `src/shared/ui.js`**

```js
/* Shared UI render helpers used by creator, manager, and viewer.
   metric() is the canonical version (includes the up/down arrow) —
   manager's previous copy was missing it; this fixes that divergence. */

export function metric(label, value, delta, up) {
  return `<div class="metric"><div class="label">${label}</div><div class="value">${value}</div>${delta ? `<div class="delta ${up ? 'up' : 'down'}">${up ? '▲' : '▼'} ${delta}</div>` : ''}</div>`;
}

export function barChart(values, labels) {
  const max = Math.max(...values, 1);
  return `
    <div class="bars">${values.map(v => `<div class="bar" style="height:${Math.round(v / max * 100)}%"></div>`).join("")}</div>
    <div class="bars-x">${(labels || values.map((_, i) => i + 1)).map(l => `<div>${l}</div>`).join("")}</div>`;
}

export function distRows(arr) {
  return arr.map(d => `
    <div style="margin:10px 0">
      <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">
        <span>${d.c}</span><span class="small">${d.p}%</span>
      </div>
      <div style="height:6px;background:var(--surface3);border-radius:999px;overflow:hidden">
        <div style="height:100%;width:${d.p}%;background:linear-gradient(90deg,var(--accent),var(--accent2))"></div>
      </div>
    </div>`).join("");
}
```

- [ ] **Step 5: Create `src/shared/theme.css`**

Read `platform/creator/creator-studio.html` lines 11-25 (the `:root{...}` block with `--bg`, `--surface`, `--surface2`, `--surface3`, `--text`, `--muted`, `--accent`, `--accent2`, `--good`, `--warn`, `--danger`, `--border`, `--shadow`, `--radius`, and the `font-family` declaration). Confirm it is byte-identical in `manager/platform-manager.html` and `viewer/viewer-app.html`'s equivalent `:root{}` blocks:

```bash
sed -n '11,27p' /Users/liyam/Downloads/videomat/platform/creator/creator-studio.html > /tmp/theme-creator.txt
sed -n '11,27p' /Users/liyam/Downloads/videomat/platform/manager/platform-manager.html > /tmp/theme-manager.txt
diff /tmp/theme-creator.txt /tmp/theme-manager.txt
```

Expected: no diff (or only trivial whitespace). If there IS a real diff, stop and do not extract — leave each app's `:root` block in its own `style.css` (created in Tasks 3-5) instead, and skip creating `theme.css`. If they match, write `src/shared/theme.css` containing exactly that `:root{...}` block plus the shared `*{box-sizing:border-box}`, `body{...}`, `a{...}` rules that also appear identically in all three (verify the same way before including).

- [ ] **Step 6: Commit the new shared modules (old root files stay for now — deleted in Task 6 after all three apps are migrated)**

```bash
git add platform/src/shared/catalog.js platform/src/shared/streamhub-api.js platform/src/shared/ui.js platform/src/shared/theme.css
git commit -m "refactor: extract shared catalog/api/ui modules for Vite build"
```

---

## Task 3: Migrate viewer app to Vite module structure

**Files:**
- Create: `platform/viewer/index.html` (markup only, from lines 1-911 of `viewer/viewer-app.html` minus the extracted `<style>` and `<script>` content)
- Create: `platform/src/viewer/style.css` (from lines 15-454 of `viewer/viewer-app.html`, minus any rules moved to `theme.css`)
- Create: `platform/src/viewer/main.js` (from the two inline `<script>` blocks, lines 504-909 of `viewer/viewer-app.html`)
- Delete: `platform/viewer/viewer-app.html` (after verification in this task's last step)

**Interfaces:**
- Consumes: `MEDIA_BASE, DATA, esc, creatorName, fmt, toast, mediaUrl` from `../src/shared/catalog.js`; `ShAuth, ShAPI` from `../src/shared/streamhub-api.js`.
- Produces: nothing consumed by later tasks (viewer is a leaf).
- Functions that MUST be attached to `window` because they're called from inline `onclick`/`onkeydown` attributes in the markup: `go`, `onWatch`(if referenced inline — verify), `toggleFav`, `toggleLater`, `download`, `likeVideo`, `dislikeVideo`, `subscribe`, `addComment`, plus any others discovered via grep in Step 2 below.

- [ ] **Step 1: Read the full current `viewer/viewer-app.html`**

```bash
wc -l /Users/liyam/Downloads/videomat/platform/viewer/viewer-app.html
```

Read the file in full (it's 911 lines — read in two 500-line chunks if needed) to get the exact markup (lines 1-14, 455-503), style block (lines 15-454), and both script blocks (lines 504-535 and 536-909).

- [ ] **Step 2: Find every function called from an inline HTML attribute**

```bash
grep -oE 'on(click|keydown|change|input)="[a-zA-Z_]+\(' /Users/liyam/Downloads/videomat/platform/viewer/viewer-app.html | sed -E 's/on[a-z]+="//' | sort -u
```

Record the full list — this is the authoritative set of functions that need `window.fnName = fnName;` in `main.js`.

- [ ] **Step 3: Create `platform/viewer/index.html`**

Copy lines 1-14 and 455-503 of the original (head metadata + body markup), removing the `<style>` block (replaced by a `<link>`) and the `<script src="../catalog.js?v=3">` / `<script src="../streamhub-api.js?v=3">` tags (replaced by the module script). Structure:

```html
<!DOCTYPE html>
<html lang="en">
<head>
<!-- ...same meta tags as original lines 1-10... -->
<link rel="stylesheet" href="/src/shared/theme.css" />
<link rel="stylesheet" href="/src/viewer/style.css" />
</head>
<body>
<!-- ...same body markup as original lines 456-500 (everything between <body> and the old <script src> tags)... -->
<script type="module" src="/src/viewer/main.js"></script>
</body>
</html>
```

If Task 2 Step 5 determined `theme.css` should NOT be created (styles diverged), drop the `theme.css` link and keep all styles in `style.css`.

- [ ] **Step 4: Create `platform/src/viewer/style.css`**

Copy the CSS rules from the original `<style>` block (lines 15-454), excluding any rule moved into `theme.css` in Task 2 Step 5.

- [ ] **Step 5: Create `platform/src/viewer/main.js`**

Start with imports, then the full body of both original inline `<script>` blocks (lines 505-534 and 537-908) concatenated in original order, unchanged. Add imports at the top:

```js
import { MEDIA_BASE, DATA, esc, creatorName, fmt, toast, mediaUrl } from "../shared/catalog.js";
import { ShAuth, ShAPI } from "../shared/streamhub-api.js";
```

At the very end of the file, attach every function identified in Step 2 to `window`:

```js
window.go = go;
window.toggleFav = toggleFav;
window.toggleLater = toggleLater;
window.download = download;
window.likeVideo = likeVideo;
window.dislikeVideo = dislikeVideo;
window.subscribe = subscribe;
window.addComment = addComment;
// plus any additional functions found in Step 2 not listed here
```

Also call the app's existing initialization code (whatever runs at the bottom of the original second script block to kick off first render — e.g. `applyHash(); render();` or similar) — copy it exactly as it appears at the end of the original inline script.

- [ ] **Step 6: Verify with `npm run dev`**

```bash
cd platform && npm run dev
```

Open `http://localhost:5173/viewer/index.html` in a browser (or use `mcp__claude-in-chrome` tools if available). Confirm:
- Page loads with no console errors (`read_console_messages` if using the Chrome tools)
- Home page renders the video grid
- Clicking a video navigates to the watch page
- Like/dislike buttons increment the count and show a toast
- Adding a comment appends it to the comment list

- [ ] **Step 7: Delete the old file and commit**

```bash
cd /Users/liyam/Downloads/videomat/platform
git rm viewer/viewer-app.html
git add viewer/index.html src/viewer/style.css src/viewer/main.js
git commit -m "refactor: migrate viewer app to Vite ES module structure"
```

---

## Task 4: Migrate creator app to Vite module structure (with upload reliability fixes)

**Files:**
- Create: `platform/creator/index.html`
- Create: `platform/src/creator/style.css`
- Create: `platform/src/creator/main.js`
- Delete: `platform/creator/creator-studio.html`

**Interfaces:**
- Consumes: `MEDIA_BASE, DATA, esc, creatorName, fmt, toast, mediaUrl` from `../shared/catalog.js`; `ShAuth, ShAPI` from `../shared/streamhub-api.js`; `metric, barChart, distRows` from `../shared/ui.js`.
- Functions requiring `window` attachment (found via the same grep technique as Task 3 Step 2, run against `creator/creator-studio.html`): includes at minimum `go`, `uPublish`, `uChooseThumb`, plus all page-render/nav functions referenced by `onclick` in the sidebar and upload wizard.

This task bundles two production bug fixes (from the audit) because they touch the exact lines being moved:
- **Fix A — double-publish on slow upload + re-click**: `uPublish()` (original lines 579-628) has no in-flight guard.
- **Fix B — dead `onProgress` plumbing**: the `pct=>{...}` callback passed to `ShAPI.uploadVideo` at original line 605 receives a percentage that's never displayed anywhere (`document.getElementById("authMsg")` is looked up but nothing renders `pct`). Remove the dead callback rather than pretend to wire it up.

- [ ] **Step 1: Read the full current `creator/creator-studio.html`**

Read the file (937 lines) in full — head/style (lines 1-330), body markup (332-367), first script (371-393), second script (394-934).

- [ ] **Step 2: Find every function called from inline HTML attributes**

```bash
grep -oE 'on(click|keydown|change|input)="[a-zA-Z_]+\(' /Users/liyam/Downloads/videomat/platform/creator/creator-studio.html | sed -E 's/on[a-z]+="//' | sort -u
```

- [ ] **Step 3: Create `platform/creator/index.html`**

Same pattern as Task 3 Step 3: head meta (lines 1-10) + `<link>` tags for `theme.css`/`style.css` + body markup (lines 332-366) + `<script type="module" src="/src/creator/main.js"></script>`.

- [ ] **Step 4: Create `platform/src/creator/style.css`**

Copy lines 11-330 of the original `<style>` block, minus any rule extracted into `theme.css`.

- [ ] **Step 5: Create `platform/src/creator/main.js` with the two bug fixes applied**

Copy both original inline script bodies (lines 372-392 and 395-933) concatenated, with these specific changes to `uPublish()` (originally lines 579-628):

```js
let _publishing = false;

async function uPublish(){
  if (_publishing) { toast("Upload already in progress…"); return; }
  const u = cstate.upload;
  if(!u.file){ toast("No file selected"); cstate.upload.step=0; render(); return; }
  _publishing = true;
  try {
    // Realistic seed counts for the new video (10k-15k views, 100-300 likes).
    const seedViews = 10000 + Math.floor(Math.random()*5001);
    const seedLikes = 100 + Math.floor(Math.random()*201);

    // Add to the local list immediately with a temporary local URL (optimistic),
    // so the creator sees it right away while it uploads in the background.
    const localId = Date.now();
    DATA.videos.unshift({
      id:localId, title:u.title||"Untitled Upload", creator:MY, type:"ugc",
      category:u.categories[0]||"POV", categories:u.categories.slice(),
      views:seedViews, likes:seedLikes, dislikes:5, comments:0, favorites:0,
      duration:u.duration||"0:00", uploaded:new Date().toISOString().slice(0,10),
      src:u.url, thumb:u.thumb||"",
      createdWith:u.createdWith.slice(), tags:u.tags.slice(),
      status:"review",   // enters moderation queue (3d)
      flagged:false
    });

    // Real upload to Bunny Storage + persist metadata, if the API is available.
    if(typeof ShAPI!=="undefined" && ShAPI.enabled){
      toast("Uploading video…");
      try {
        const up = await ShAPI.uploadVideo(u.file, u.title||"Untitled");
        // point the local entry at the real CDN src and persist metadata for everyone
        const vid = DATA.videos.find(v=>v.id===localId); if(vid) vid.src = up.src;
        let uploaderEmail = "";
        if(typeof ShAuth!=="undefined"){ try{ const usr=await ShAuth.user(); uploaderEmail = usr && usr.email || ""; }catch(_){ } }
        await ShAPI.saveUploadedVideo({
          title:u.title||"Untitled", creator:MY, src:up.src,
          category:u.categories[0]||"POV", categories:u.categories.slice(), tags:u.tags.slice(),
          duration:u.duration||"0:00", views_seed:seedViews, likes_seed:seedLikes,
          status:"review", uploader:uploaderEmail
        });
        toast(`Published "${u.title||'Untitled'}" — uploaded and sent for review`);
      } catch(e){
        const vid = DATA.videos.find(v=>v.id===localId);
        if(vid) vid.status = "upload-failed";
        toast("Upload failed: "+(e.message||"try again"));
      }
    } else {
      toast(`Published "${u.title||'Untitled'}" (local preview only)`);
    }

    cstate.upload = freshUpload(); cstate.page="content"; render();
  } finally {
    _publishing = false;
  }
}
```

Changes from the original: (1) `_publishing` flag blocks re-entry while a request is in flight, (2) the dead `onProgress` callback argument is removed from the `ShAPI.uploadVideo(...)` call, (3) on failure the local optimistic entry is marked `status:"upload-failed"` instead of being left as a silently-broken `"review"` row (this requires `renderContent()`'s status badge rendering, wherever it maps `status` to a pill label, to handle `"upload-failed"` — check the existing status-to-label mapping in the content list render function and add a `red`/`"Failed — retry"` case consistent with how `"review"`/`"published"` are already styled there).

Add imports at the top and `window` exports at the bottom, following the same pattern as Task 3 Step 5, listing every function found in Step 2.

- [ ] **Step 6: Verify with `npm run dev`**

Navigate to `http://localhost:5173/creator/index.html`. Confirm:
- Dashboard, content, and upload pages render with no console errors
- `metric()` calls in the dashboard show the ▲/▼ arrow (unchanged from before — creator already had this)
- Attempting to double-click "Publish" during an in-flight upload shows the "already in progress" toast instead of creating two entries (simulate by throttling network in devtools, or by checking that `_publishing` is read/set correctly in code review if a live double-click isn't reliably reproducible in dev)

- [ ] **Step 7: Delete the old file and commit**

```bash
cd /Users/liyam/Downloads/videomat/platform
git rm creator/creator-studio.html
git add creator/index.html src/creator/style.css src/creator/main.js
git commit -m "refactor: migrate creator app to Vite modules; fix double-publish and dead progress callback"
```

---

## Task 5: Migrate manager app to Vite module structure (with moderation + pagination fixes)

**Files:**
- Create: `platform/manager/index.html`
- Create: `platform/src/manager/style.css`
- Create: `platform/src/manager/main.js`
- Delete: `platform/manager/platform-manager.html`

**Interfaces:**
- Consumes: `MEDIA_BASE, DATA, esc, creatorName, fmt, toast, mediaUrl` from `../shared/catalog.js`; `ShAuth, ShAPI` from `../shared/streamhub-api.js`; `metric, barChart, distRows` from `../shared/ui.js` (this deletes manager's own local `metric`/`barChart`/`distRows` definitions, originally lines 392-402 and 415, fixing the arrow-divergence bug by using the shared canonical version).
- Functions requiring `window` attachment: `go`, `modAction`, `loadModeration`, plus all others found via the Step 2 grep.

This task bundles two production bug fixes:
- **Fix C — moderation actions swallow errors while still optimistically mutating the queue** (original `modAction`, lines 490-498): a failed `ShAPI.moderate()` call is caught and discarded, leaving `_modDecisions` permanently "decided" even though nothing was persisted — the item silently reappears later with no operator feedback.
- **Fix D — full video table has no pagination** (original `renderVideos`, lines 462-471): renders all 180+ rows in one unbounded table.

- [ ] **Step 1: Read the full current `manager/platform-manager.html`**

Read the file (626 lines) in full.

- [ ] **Step 2: Find every function called from inline HTML attributes**

```bash
grep -oE 'on(click|keydown|change|input)="[a-zA-Z_]+\(' /Users/liyam/Downloads/videomat/platform/manager/platform-manager.html | sed -E 's/on[a-z]+="//' | sort -u
```

- [ ] **Step 3: Create `platform/manager/index.html`**

Same pattern as prior tasks: head meta + `<link>` tags + body markup (lines 332-384 in the original) + `<script type="module" src="/src/manager/main.js"></script>`.

- [ ] **Step 4: Create `platform/src/manager/style.css`**

Copy lines 11-330 of the original `<style>` block, minus anything moved to `theme.css`.

- [ ] **Step 5: Create `platform/src/manager/main.js` with the shared-helper import and two bug fixes**

Copy both original inline script bodies (lines 389-409 and 412-623), but:

1. **Delete** the local `barChart`, `distRows`, `metric` function definitions (originally at lines 392, 399, 415) — replaced by the import below.
2. Add imports at the top:

```js
import { MEDIA_BASE, DATA, esc, creatorName, fmt, toast, mediaUrl } from "../shared/catalog.js";
import { ShAuth, ShAPI } from "../shared/streamhub-api.js";
import { metric, barChart, distRows } from "../shared/ui.js";
```

3. Replace `modAction` (originally lines 490-498) with:

```js
async function modAction(videoId, action){
  toast("Working…");
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
```

This moves the `_modDecisions[...] = action` mutation to only happen after a confirmed successful persist (or in the explicit API-disabled fallback path), and surfaces a "please retry" toast on failure instead of silently discarding the error.

4. Replace `renderVideos` (originally lines 462-471) with a paginated version:

```js
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
function videosNextPage(){ _videoTablePage++; render(); }
```

Add `videosPrevPage` and `videosNextPage` to the list of functions requiring `window` attachment (they're referenced by the new `onclick` attributes above).

- [ ] **Step 6: Attach window exports**

At the end of `main.js`, attach every function found in Step 2 plus `videosPrevPage`/`videosNextPage`:

```js
window.go = go;
window.modAction = modAction;
window.loadModeration = loadModeration;
window.videosPrevPage = videosPrevPage;
window.videosNextPage = videosNextPage;
// plus any additional functions found in Step 2
```

- [ ] **Step 7: Verify with `npm run dev`**

Navigate to `http://localhost:5173/manager/index.html`. Confirm:
- Overview/dashboard metrics render with the ▲/▼ arrow (this is the fix — manager previously lacked it)
- Videos page shows 25 rows with working Prev/Next pagination and correct total-page count
- Moderation queue renders; approving/removing an item shows a toast and the item leaves the queue only after the (simulated or real) API call resolves

- [ ] **Step 8: Delete the old file and commit**

```bash
cd /Users/liyam/Downloads/videomat/platform
git rm manager/platform-manager.html
git add manager/index.html src/manager/style.css src/manager/main.js
git commit -m "refactor: migrate manager app to Vite modules; fix metric() arrow, moderation error handling, and add video table pagination"
```

---

## Task 6: Remaining bug fixes (like/dislike double-fire, comment length cap, upload MIME allowlist)

**Files:**
- Modify: `platform/src/viewer/main.js` (like/dislike debounce, comment length validation)
- Modify: `platform/src/shared/streamhub-api.js` (no change needed — confirmed the count-query inefficiency fix is deferred, see note below)
- Modify: `platform/api/upload.js` (MIME/extension allowlist)
- Create: `platform/supabase/schema-likes-fix.sql` (unique constraint on `likes`)

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Add debounce to viewer's like/dislike buttons**

In `platform/src/viewer/main.js`, find `likeVideo` and `dislikeVideo` (moved from original lines 636-647 in Task 3). Replace with:

```js
let _voting = new Set();

function likeVideo(id){
  if (_voting.has(id)) return;
  _voting.add(id);
  const v=DATA.videos.find(x=>x.id===id); if(!v){ _voting.delete(id); return; }
  v.likes++; toast("Liked");
  Promise.resolve(_persist(()=> ShAPI.addLike(id,"like"))).finally(()=> _voting.delete(id));
  const num=document.getElementById("likeNum");
  if(onWatch() && num) num.textContent=fmt(v.likes); else render();
}
function dislikeVideo(id){
  if (_voting.has(id)) return;
  _voting.add(id);
  const v=DATA.videos.find(x=>x.id===id); if(!v){ _voting.delete(id); return; }
  v.dislikes++; toast("Disliked");
  Promise.resolve(_persist(()=> ShAPI.addLike(id,"dislike"))).finally(()=> _voting.delete(id));
  const num=document.getElementById("disNum");
  if(onWatch() && num) num.textContent=fmt(v.dislikes); else render();
}
```

Note: `_persist()` (defined earlier in the same file) calls `promiseFn()` and returns whatever `Promise.resolve(...).catch(()=>{})` returns when `ShAPI.enabled`, or `undefined` otherwise — wrapping the whole call in `Promise.resolve(...).finally(...)` here safely handles both cases (a real promise or `undefined`).

- [ ] **Step 2: Add client-side length cap to `addComment`**

In the same file, find `addComment` (originally lines 649-654). Replace with:

```js
const COMMENT_MAX_LEN = 2000;

function addComment(id){
  const box=document.getElementById("cbox"); const t=(box.value||"").trim(); if(!t)return;
  if (t.length > COMMENT_MAX_LEN) {
    toast(`Comment too long (max ${COMMENT_MAX_LEN} characters)`);
    return;
  }
  DATA.comments.push({id:"m"+Date.now(),video:id,user:DATA.user.name,text:t,time:"now"});
  box.value = "";
  _persist(()=> ShAPI.addComment(id, DATA.user.name, t));
  render();
}
```

This matches the DB's existing 1-2000 char constraint (per the audit finding) so the UI rejects before the optimistic insert, instead of showing a comment as posted while Supabase silently rejects it. Also added `box.value = ""` to clear the input after a successful post (missing in the original — minor UX gap noticed while fixing this function).

- [ ] **Step 3: Add MIME/extension allowlist to the upload relay**

In `platform/api/upload.js`, after the existing `ext` computation (originally line 31), add a validation check before proceeding to the upload:

```js
const ALLOWED_EXT = new Set(["mp4", "mov", "webm", "m4v"]);
```

Add this constant near the top of the file (next to `STORAGE_BASE`/`CDN_BASE`/`KEY`), then insert a check immediately after the existing `ext`/`unique`/`storagePath` computation (after original line 33), before the `try` block:

```js
if (!ALLOWED_EXT.has(ext)) {
  return res.status(400).json({ error: `unsupported file type: .${ext}` });
}
```

- [ ] **Step 4: Add the missing unique constraint on `likes`**

Read `platform/supabase/schema.sql` first to confirm the exact `likes` table definition and existing `favorites` unique constraint pattern to match its style:

```bash
cat /Users/liyam/Downloads/videomat/platform/supabase/schema.sql
```

Create `platform/supabase/schema-likes-fix.sql`:

```sql
-- Prevent double-fire likes/dislikes from the same browser: one row per
-- (video_id, client_id, kind). This does not require a client_id column
-- change if `likes` doesn't already have one — check schema.sql's actual
-- columns first (see Step 4 read above) and adjust the constraint to match
-- whatever anti-abuse column pattern `favorites` already uses.
alter table likes
  add constraint likes_video_client_kind_unique
  unique (video_id, client_id, kind);
```

Note: apply this SQL manually via the Supabase dashboard SQL editor (no migration runner exists in this project — confirmed during planning). If `likes` doesn't currently have a `client_id` column, this step requires first adding one (matching how `favorites.client_id` works in `streamhub-api.js`'s `shClientId()`) and updating `ShAPI.addLike` to pass it — read `streamhub-api.js`'s current `addLike` (originally lines 99-101) and `favorites` methods (lines 191-196) side by side before writing the final SQL/JS, since the exact column may not exist yet.

- [ ] **Step 5: Update `addLike` in `src/shared/streamhub-api.js` to send `client_id`**

```js
async addLike(videoId, kind="like"){
  await _req(`/likes`, { method:"POST", body: JSON.stringify({ video_id: videoId, kind, client_id: shClientId() }) });
},
```

- [ ] **Step 6: Verify with `npm run dev`**

- Rapidly click the like button on a watch page multiple times in a row; confirm the count only increments once per click that isn't already in flight (visually: rapid double-click should not double the count locally).
- Try posting a comment over 2000 characters; confirm the toast appears and nothing is added to the comment list.
- (Upload allowlist and SQL constraint can't be exercised without live Bunny/Supabase credentials in dev — verify by code review that `ALLOWED_EXT` check runs before the Bunny PUT, and that the SQL matches `schema.sql`'s actual column types.)

- [ ] **Step 7: Commit**

```bash
cd /Users/liyam/Downloads/videomat/platform
git add src/viewer/main.js src/shared/streamhub-api.js api/upload.js supabase/schema-likes-fix.sql
git commit -m "fix: debounce like/dislike, cap comment length client-side, allowlist upload file types, add likes uniqueness constraint"
```

---

## Task 7: Update deploy documentation and clean up old root files

**Files:**
- Modify: `platform/CLAUDE.md` (deploy checklist section)
- Delete: `platform/catalog.js`, `platform/streamhub-api.js` (superseded by `src/shared/` versions — only delete after confirming Tasks 3-5 fully removed all references to the old paths)

**Interfaces:** none (documentation + cleanup task).

- [ ] **Step 1: Confirm no remaining references to the old root-level files**

```bash
grep -rn "\.\./catalog.js\|\.\./streamhub-api.js\|src=\"catalog.js\|src=\"streamhub-api.js" /Users/liyam/Downloads/videomat/platform --include="*.html"
```

Expected: no matches (all three apps now load `src/shared/*.js` via their bundled `main.js` imports, not `<script src>` tags).

- [ ] **Step 2: Delete the superseded root files**

```bash
cd /Users/liyam/Downloads/videomat/platform
git rm catalog.js streamhub-api.js
```

- [ ] **Step 3: Update `CLAUDE.md`'s deploy checklist**

Open `platform/CLAUDE.md` and replace the "Deploy checklist" section's step 2 (currently listing `catalog.js`, `viewer/viewer-app.html`, `manager/platform-manager.html`, `creator/creator-studio.html`, `index.html` as things to individually upload) with:

```markdown
## Deploy checklist (to update the live site)

1. Edit the catalog in `src/shared/catalog.js` (see "Adding videos" below).
2. Run `npm run build` — Vite outputs the built site to `dist/` with
   content-hashed filenames (no more manual `?v=N` cache-busting).
3. Upload the **entire contents of `dist/`** to Bunny storage, preserving the
   folder structure (`dist/index.html` → storage root, `dist/creator/index.html`
   → `creator/index.html`, `dist/assets/*` → `assets/`, etc.):
   ```bash
   curl -X PUT -H "AccessKey: $BUNNY_STORAGE_KEY" --data-binary "@dist/index.html" \
     "https://storage.bunnycdn.com/streamhub-media/index.html"
   # repeat for each file under dist/, or use a small upload script that walks dist/
   ```
4. **Purge the Pull Zone cache** (30-day TTL — site won't update otherwise):
   Bunny dashboard → CDN → Pull Zone `streamhub-media` → Purge Cache → empty tag → Purge.
5. (Optional) `git commit && git push` to keep GitHub/Vercel in sync.

**Catalog-only fast path unchanged**: if you only edited `src/shared/catalog.js`
and nothing else, you can still run the build and upload just the resulting
hashed catalog chunk plus the three app HTML files that reference it (their
`<script>` tag hash changes whenever catalog content changes) — or simply
upload the full `dist/` output each time, which is simpler and safe.
```

Also update the "✅ The catalog lives in ONE place" section's file path references from `catalog.js` (root) to `src/shared/catalog.js`, and the "Adding videos" section's step 5 similarly.

- [ ] **Step 4: Run a full build to confirm everything still works end-to-end**

```bash
cd platform && npm run build && npm run preview
```

Open the preview URL and spot-check all three apps (`/creator/index.html`, `/manager/index.html`, `/viewer/index.html`) plus the root `index.html` picker page load correctly with hashed asset filenames (check Network tab or `ls dist/assets/`).

- [ ] **Step 5: Commit**

```bash
git add platform/CLAUDE.md
git commit -m "docs: update deploy checklist for Vite build output; remove superseded root catalog/api files"
```

---

## Explicitly deferred (per design doc, not part of this plan)

- Full Supabase RLS policy audit (only the one new `likes` uniqueness constraint is added here).
- `fmt()`'s cosmetic 1000-boundary formatting inconsistency.
- Switching count queries (`likeCounts`, `viewCount`, `favoriteCount` in `streamhub-api.js`) from fetch-and-count-client-side to PostgREST's `count=exact` header — flagged in the audit as a performance improvement but requires verifying PostgREST response-header parsing isn't used elsewhere in a conflicting way; left for a follow-up pass to keep this plan's diff reviewable.
