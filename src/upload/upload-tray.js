// src/upload/upload-tray.js
// Persistent bottom-right tray showing upload job cards. Survives hash nav.
import { UploadManager } from "./upload-manager.js";
import { jsq } from "./upload-api.js";
import { toast, esc } from "../shared/catalog.js";

let trayEl;

function ensureTray() {
  if (trayEl) return trayEl;
  trayEl = document.createElement("div");
  trayEl.id = "upload-tray";
  trayEl.hidden = true;
  document.body.appendChild(trayEl);
  trayEl.addEventListener("click", (e) => {
    const c = e.target.closest("[data-upl]");
    if (!c) return;
    const id = c.dataset.uplId;
    const job = UploadManager.jobs.find((j) => j.id === id);
    if (c.dataset.upl === "cancel" && job) { job.status = "error"; job.error = "cancelled"; renderTray(); }
  });
  return trayEl;
}

function card(job) {
  const pct = job.progress || 0;
  const label = {
    queued: "Queued", hashing: "Preparing", uploading: pct + "%",
    live: "Live ✓", error: job.error || "Failed",
  }[job.status];
  return `<div class="upl-card upl-${job.status}" data-upl-id="${jsq(job.id)}">
    <img class="upl-thumb" src="${jsq(job.blobUrl)}" alt="">
    <div class="upl-meta"><span class="upl-title">${esc(job.title)}</span><span class="upl-status">${esc(label)}</span>
      <div class="upl-bar"><i style="width:${pct}%"></i></div></div>
    ${job.status === "uploading" || job.status === "queued" ? `<button class="upl-x" data-upl="cancel" data-upl-id="${jsq(job.id)}">✕</button>` : ""}
  </div>`;
}

export function renderTray() {
  const el = ensureTray();
  if (!UploadManager.jobs.length) { el.hidden = true; return; }
  el.hidden = false;
  el.innerHTML = `<div class="upl-head">Uploads</div>${UploadManager.jobs.map(card).join("")}`;
}

export function mountTray() {
  UploadManager.on("add", renderTray);
  UploadManager.on("update", renderTray);
  UploadManager.on("reject", ({ reason }) => toast("Skipped: " + reason));
  UploadManager.on("live", () => toast("Your video is live"));
}
