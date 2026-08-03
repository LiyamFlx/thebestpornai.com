#!/usr/bin/env node
/**
 * Internal Content Manager — local or hosted.
 *   npm run writer
 *   WRITER_PASSWORD=... WRITER_LLM_API_KEY=... node tools/content-manager/server.mjs
 */
import http from "http";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath, pathToFileURL } from "url";
import "dotenv/config";

import { parseVideoId, videoWatchUrl } from "./lib/video.mjs";
import { generateArticle, sanitizeBodyHtml, validateGenerated } from "./lib/generate.mjs";
import { publishPost } from "./lib/publish.mjs";
import { commitWriterPostsFile } from "./lib/github-publish.mjs";
import { REPO_ROOT } from "./lib/posts-io.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, "public");
const PORT = Number(process.env.WRITER_PORT || 3847);
const HOST = process.env.WRITER_HOST || "127.0.0.1";
const PASSWORD = process.env.WRITER_PASSWORD || "";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const sessions = new Map(); // token -> { exp }

function log(...args) {
  console.log(new Date().toISOString(), ...args);
}

function timingSafeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function parseCookies(req) {
  const h = req.headers.cookie || "";
  const out = {};
  for (const part of h.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (!k) continue;
    out[k] = decodeURIComponent(rest.join("=") || "");
  }
  return out;
}

function setSession(res, token) {
  const secure = process.env.WRITER_COOKIE_SECURE === "1" || process.env.NODE_ENV === "production";
  res.setHeader(
    "Set-Cookie",
    `writer_session=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Strict; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}${secure ? "; Secure" : ""}`
  );
}

function clearSession(res) {
  res.setHeader("Set-Cookie", "writer_session=; HttpOnly; Path=/; Max-Age=0");
}

function requireAuth(req, res) {
  if (!PASSWORD) {
    // Dev convenience: empty password allows all (warn once)
    return true;
  }
  const cookies = parseCookies(req);
  const token = cookies.writer_session;
  const sess = token && sessions.get(token);
  if (sess && sess.exp > Date.now()) return true;
  if (sess) sessions.delete(token);
  json(res, 401, { error: "Unauthorized — log in first" });
  return false;
}

function json(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(data),
    "Cache-Control": "no-store",
    "X-Robots-Tag": "noindex, nofollow",
  });
  res.end(data);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > 2_000_000) {
        reject(new Error("Body too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

function serveStatic(req, res) {
  let urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  if (urlPath === "/") urlPath = "/index.html";
  const safe = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, "");
  const file = path.join(PUBLIC, safe);
  if (!file.startsWith(PUBLIC)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404);
    return res.end("Not found");
  }
  const ext = path.extname(file);
  res.writeHead(200, {
    "Content-Type": MIME[ext] || "application/octet-stream",
    "X-Robots-Tag": "noindex, nofollow",
    "Cache-Control": "no-store",
  });
  fs.createReadStream(file).pipe(res);
}

let catalogCache = null;
async function loadCatalog() {
  if (catalogCache) return catalogCache;
  const mod = await import(pathToFileURL(path.join(REPO_ROOT, "src/shared/catalog-videos.js")).href);
  catalogCache = mod.VIDEOS || mod.default || [];
  return catalogCache;
}

async function findVideo(id) {
  const videos = await loadCatalog();
  return videos.find((v) => v.id === id) || null;
}

const CATEGORIES = ["Guides", "Stories", "Fantasies", "Confessions", "Kink Lab"];

// simple rate limit: ip -> timestamps
const genHits = new Map();
function rateLimit(ip, limit = 20, windowMs = 60 * 60 * 1000) {
  const now = Date.now();
  const arr = (genHits.get(ip) || []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) return false;
  arr.push(now);
  genHits.set(ip, arr);
  return true;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const ip = req.socket.remoteAddress || "unknown";

  try {
    if (req.method === "GET" && url.pathname === "/api/health") {
      return json(res, 200, {
        ok: true,
        passwordRequired: Boolean(PASSWORD),
        githubPublish: Boolean(process.env.GITHUB_TOKEN || process.env.WRITER_GITHUB_TOKEN),
      });
    }

    if (req.method === "POST" && url.pathname === "/api/login") {
      const body = await readBody(req);
      if (!PASSWORD) {
        const token = crypto.randomBytes(24).toString("hex");
        sessions.set(token, { exp: Date.now() + SESSION_TTL_MS });
        setSession(res, token);
        return json(res, 200, { ok: true, devOpen: true });
      }
      if (!timingSafeEqual(body.password || "", PASSWORD)) {
        return json(res, 401, { error: "Wrong password" });
      }
      const token = crypto.randomBytes(24).toString("hex");
      sessions.set(token, { exp: Date.now() + SESSION_TTL_MS });
      setSession(res, token);
      log("login ok", ip);
      return json(res, 200, { ok: true });
    }

    if (req.method === "POST" && url.pathname === "/api/logout") {
      const cookies = parseCookies(req);
      if (cookies.writer_session) sessions.delete(cookies.writer_session);
      clearSession(res);
      return json(res, 200, { ok: true });
    }

    if (req.method === "GET" && url.pathname === "/api/session") {
      const ok = !PASSWORD || (() => {
        const t = parseCookies(req).writer_session;
        const s = t && sessions.get(t);
        return s && s.exp > Date.now();
      })();
      return json(res, 200, { authenticated: Boolean(ok), passwordRequired: Boolean(PASSWORD) });
    }

    if (req.method === "POST" && url.pathname === "/api/resolve-video") {
      if (!requireAuth(req, res)) return;
      const body = await readBody(req);
      const id = parseVideoId(body.url || body.id);
      if (id == null) return json(res, 400, { error: "Could not parse video id from URL" });
      const v = await findVideo(id);
      if (!v) return json(res, 404, { error: `Video id ${id} not found in catalog` });
      return json(res, 200, {
        id: v.id,
        title: v.title,
        duration: v.duration,
        category: v.category,
        thumb: v.thumb || null,
        watchUrl: videoWatchUrl(v.id),
      });
    }

    if (req.method === "POST" && url.pathname === "/api/generate") {
      if (!requireAuth(req, res)) return;
      if (!rateLimit(ip, 30)) return json(res, 429, { error: "Rate limit — try again later" });
      const body = await readBody(req);
      const title = String(body.title || "").trim();
      const category = String(body.category || "Guides").trim();
      const notes = String(body.notes || "").trim();
      if (!title) return json(res, 400, { error: "Title is required" });
      if (!CATEGORIES.includes(category)) return json(res, 400, { error: "Invalid category" });
      const id = parseVideoId(body.videoUrl || body.videoId);
      if (id == null) return json(res, 400, { error: "Valid thebestpornai video URL required (#video/N)" });
      const v = await findVideo(id);
      if (!v) return json(res, 404, { error: `Video id ${id} not found in catalog` });

      log("generate", { title, category, videoId: id, ip });
      const article = await generateArticle({
        title,
        category,
        notes,
        video: { id: v.id, title: v.title, duration: v.duration, category: v.category },
        env: process.env,
      });
      return json(res, 200, {
        ok: true,
        article: {
          ...article,
          category,
          coverVideoId: v.id,
          video: {
            id: v.id,
            title: v.title,
            watchUrl: videoWatchUrl(v.id),
          },
        },
      });
    }

    if (req.method === "POST" && url.pathname === "/api/publish") {
      if (!requireAuth(req, res)) return;
      if (!rateLimit(ip + ":pub", 40)) return json(res, 429, { error: "Rate limit" });
      const body = await readBody(req);
      const category = String(body.category || "Guides").trim();
      if (!CATEGORIES.includes(category)) return json(res, 400, { error: "Invalid category" });
      const id = parseVideoId(body.videoUrl || body.videoId || body.coverVideoId);
      if (id == null) return json(res, 400, { error: "Valid video id required" });
      const v = await findVideo(id);
      if (!v) return json(res, 404, { error: `Video id ${id} not found` });

      const draft = validateGenerated({
        title: body.title,
        excerpt: body.excerpt,
        microcopy: body.microcopy,
        body: sanitizeBodyHtml(body.body),
        faqs: body.faqs,
        tags: body.tags,
        readMins: body.readMins,
      });

      const dryRun = Boolean(body.dryRun);
      log("publish", { title: draft.title, videoId: id, dryRun, ip });

      const result = await publishPost({
        draft,
        video: { id: v.id, title: v.title },
        category,
        dryRun,
      });

      let github = null;
      if (!dryRun && (process.env.WRITER_GITHUB_PUBLISH === "1" || process.env.GITHUB_TOKEN)) {
        try {
          github = await commitWriterPostsFile({
            env: process.env,
            message: `content(writer): ${result.post.slug}`,
          });
        } catch (e) {
          github = { error: e.message };
        }
      }

      return json(res, 200, { ok: true, ...result, github });
    }

    if (req.method === "GET" || req.method === "HEAD") {
      return serveStatic(req, res);
    }

    json(res, 405, { error: "Method not allowed" });
  } catch (e) {
    log("error", e.message);
    json(res, 500, { error: e.message || "Server error" });
  }
});

server.listen(PORT, HOST, () => {
  if (!PASSWORD) {
    console.warn("⚠ WRITER_PASSWORD is empty — auth open (dev only). Set WRITER_PASSWORD for real use.");
  }
  console.log(`Content Manager → http://${HOST}:${PORT}`);
  console.log(`Repo root: ${REPO_ROOT}`);
});
