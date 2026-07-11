// src/upload/upload-manager.js
// Module-scope singleton upload queue. Survives hash-route navigation.
import { ShUpload, sniffVideo, sha256Head } from "./upload-api.js";

const ENV = (typeof import.meta !== "undefined" && import.meta.env) || {};
const MAX_BYTES = Number(ENV.VITE_MAX_UPLOAD_BYTES) || 4294967296;
const MAX_DUR = Number(ENV.VITE_MAX_DURATION_S) || 3600;
const CONCURRENCY = 3;
const BACKOFF = [0, 3000, 10000, 30000];

/* pure helpers (testable) */
export const computeBackoff = (attempt) => (attempt < BACKOFF.length ? BACKOFF[attempt] : null);
export const nextRunnable = (jobs, max) => {
  const active = jobs.filter((j) => j.status === "uploading").length;
  const slots = Math.max(0, max - active);
  return jobs.filter((j) => j.status === "queued").slice(0, slots);
};

function probeDuration(file) {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => { URL.revokeObjectURL(v.src); resolve(v.duration || 0); };
    v.onerror = () => resolve(0);
    v.src = URL.createObjectURL(file);
  });
}

const listeners = {};
function emit(evt, data) { (listeners[evt] || []).forEach((cb) => cb(data)); }

export const UploadManager = {
  jobs: [],
  on(evt, cb) { (listeners[evt] ||= []).push(cb); },

  async enqueue(files) {
    for (const file of files) {
      const type = await sniffVideo(file);
      if (!type) { emit("reject", { file, reason: "not a video" }); continue; }
      if (file.size > MAX_BYTES) { emit("reject", { file, reason: "too large" }); continue; }
      const dur = await probeDuration(file);
      if (dur > MAX_DUR) { emit("reject", { file, reason: "too long" }); continue; }
      const job = {
        id: "j_" + Math.random().toString(36).slice(2),
        file, status: "queued", progress: 0, attempt: 0,
        title: file.name.replace(/\.[^.]+$/, ""), tags: [],
        blobUrl: URL.createObjectURL(file),
      };
      this.jobs.push(job); emit("add", job);
    }
    this.pump();
  },

  pump() {
    for (const job of nextRunnable(this.jobs, CONCURRENCY)) this.run(job);
  },

  async run(job) {
    try {
      // 1. hash + duplicate check (before spending any upload bandwidth)
      job.status = "hashing"; emit("update", job);
      const sha = await sha256Head(job.file);
      const dup = await ShUpload.dupCheck(sha);
      if (dup.duplicate) { job.status = "error"; job.error = "duplicate"; emit("update", job); return; }

      // 2. upload bytes — the relay picks the final storage path and returns it.
      job.status = "uploading"; emit("update", job);
      const uploaded = await this.uploadWithRetry(job);
      // relay returns src like "../media/uploads/up_...mp4"; store path after "media/"
      // Use the relay's full storage path (e.g. "media/uploads/up_...mp4") as the
      // canonical bunny_path. The file physically lives there, so the catalog src
      // must resolve to b-cdn.net/media/uploads/... — see catalog-overlay rowToVideo.
      const bunnyPath = (uploaded.path || String(uploaded.src || "").replace(/^\.\.\//, "")).replace(/^\/+/, "");
      if (!bunnyPath) { job.status = "error"; job.error = "no path from relay"; emit("update", job); return; }
      job.bunny_path = bunnyPath;

      // 3. create the DB row now that we know the real path
      const created = await ShUpload.createUpload({ bunny_path: bunnyPath, title: job.title, tags: job.tags, sha256_head: sha, duration_s: 0 });
      if (!created.ok) { job.status = "error"; job.error = created.error || "create failed"; emit("update", job); return; }
      job.uploadId = created.uploadId;

      // 4. finalize -> live (no gate, owner decision)
      const fin = await ShUpload.finalize(job.uploadId);
      if (!fin.ok) { job.status = "error"; job.error = "finalize failed"; emit("update", job); return; }
      job.status = "live"; emit("update", job); emit("live", job);
    } catch (e) {
      job.status = "error"; job.error = String(e); emit("update", job);
    } finally {
      this.pump();
    }
  },

  async uploadWithRetry(job) {
    for (let attempt = 0; ; attempt++) {
      const wait = computeBackoff(attempt);
      if (wait === null) throw new Error("upload failed after retries");
      if (wait) await new Promise((r) => setTimeout(r, wait));
      try {
        return await ShUpload.putBytes(job.file, (p) => { job.progress = p; emit("update", job); });
      } catch (_) {
        job.attempt = attempt + 1; emit("update", job);
      }
    }
  },
};

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", (e) => {
    if (UploadManager.jobs.some((j) => j.status === "uploading")) { e.preventDefault(); e.returnValue = ""; }
  });
}
