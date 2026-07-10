// src/upload/global-dropzone.js
// Window-level drag-and-drop upload. Entire viewport is a drop target on every
// page. Mounted once in the app shell (behind the globalUpload flag).
import { UploadManager } from "./upload-manager.js";
import { mountTray } from "./upload-tray.js";
import { needsAttestation, showAttestationModal, recordAttestation } from "./attestation.js";
import { ShAuth } from "../shared/streamhub-api.js";
import { toast } from "../shared/catalog.js";

let dragDepth = 0, overlay, input;
let onNeedLoginRef = () => {};

function buildOverlay() {
  overlay = document.createElement("div");
  overlay.id = "drop-overlay";
  overlay.innerHTML = `<div class="dz-box"><div>Drop videos to upload</div><div class="dz-badge"></div></div>`;
  document.body.appendChild(overlay);

  input = document.createElement("input");
  input.type = "file"; input.multiple = true; input.accept = "video/*"; input.hidden = true;
  document.body.appendChild(input);
  input.addEventListener("change", () => {
    if (input.files.length) handleFiles([...input.files]);
    input.value = "";
  });
}

function setBadge(n) {
  const b = overlay.querySelector(".dz-badge");
  b.textContent = n ? `${n} file${n > 1 ? "s" : ""}` : "";
}
function show(on, n = 0) {
  overlay.classList.toggle("active", on);
  if (on) setBadge(n);
}

async function handleFiles(files) {
  if (!ShAuth.isSignedIn()) { onNeedLoginRef(); return; }
  const vids = files.filter((f) => f.type.startsWith("video/") || /\.(mp4|mov|webm|m4v)$/i.test(f.name));
  if (!vids.length) { toast("Only video files can be uploaded"); return; }
  if (await needsAttestation(0)) {
    const ok = await showAttestationModal();
    if (!ok) return;
    await recordAttestation([]);
  }
  UploadManager.enqueue(vids);
}

export function mountDropzone({ onNeedLogin } = {}) {
  onNeedLoginRef = onNeedLogin || (() => toast("Please sign in to upload"));
  buildOverlay();
  mountTray();

  window.addEventListener("dragenter", (e) => {
    if (!e.dataTransfer || ![...e.dataTransfer.types].includes("Files")) return;
    dragDepth++;
    show(true, e.dataTransfer.items ? e.dataTransfer.items.length : 0);
  });
  window.addEventListener("dragover", (e) => { e.preventDefault(); });
  window.addEventListener("dragleave", () => {
    dragDepth = Math.max(0, dragDepth - 1);
    if (!dragDepth) show(false);
  });
  window.addEventListener("drop", (e) => {
    e.preventDefault();
    dragDepth = 0; show(false);
    if (e.dataTransfer.files.length) handleFiles([...e.dataTransfer.files]);
  });
  document.addEventListener("click", (e) => {
    if (e.target.closest('[data-page="upload-trigger"]')) input.click();
  });
}
