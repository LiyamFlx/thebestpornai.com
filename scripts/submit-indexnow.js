#!/usr/bin/env node
/**
 * IndexNow ping script for Bing & Yandex
 * Submits updated URLs from sitemap.xml to the IndexNow protocol endpoint.
 *
 * Usage:
 *   node scripts/submit-indexnow.js [--dry-run] [--limit <n>]
 */

import fs from "fs";
import path from "path";
import https from "https";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, "..");
const HOST = "www.thebestpornai.com";
const KEY = "c8f192b0e9a44c77a3d95e62f0178491";
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`;
const SITEMAP_PATH = path.join(REPO, "public", "sitemap.xml");

const isDryRun = process.argv.includes("--dry-run");
const limitIdx = process.argv.indexOf("--limit");
const limit = limitIdx !== -1 && process.argv[limitIdx + 1] ? parseInt(process.argv[limitIdx + 1], 10) : 100;

function parseSitemapUrls() {
  if (!fs.existsSync(SITEMAP_PATH)) {
    console.error(`Sitemap not found at ${SITEMAP_PATH}. Run 'npm run sitemap' first.`);
    return [];
  }
  const xml = fs.readFileSync(SITEMAP_PATH, "utf8");
  const urls = [];
  const locRegex = /<loc>(https:\/\/[^<]+)<\/loc>/g;
  let match;
  while ((match = locRegex.exec(xml)) !== null) {
    urls.push(match[1]);
  }
  return urls;
}

async function submitIndexNow(urls) {
  if (!urls.length) {
    console.log("No URLs found to submit.");
    return;
  }

  const batch = urls.slice(0, limit);
  const payload = {
    host: HOST,
    key: KEY,
    keyLocation: KEY_LOCATION,
    urlList: batch,
  };

  console.log(`[IndexNow] Preparing to submit ${batch.length} URLs (Host: ${HOST})`);

  if (isDryRun) {
    console.log("[IndexNow] DRY-RUN MODE: Payload would be:");
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  const postData = JSON.stringify(payload);
  const options = {
    hostname: "api.indexnow.org",
    port: 443,
    path: "/indexnow",
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Length": Buffer.byteLength(postData),
    },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        if (res.statusCode === 200 || res.statusCode === 202) {
          console.log(`✔ [IndexNow] Successfully submitted ${batch.length} URLs to IndexNow! (HTTP ${res.statusCode})`);
          resolve(true);
        } else {
          console.warn(`⚠ [IndexNow] API responded with HTTP ${res.statusCode}: ${data || res.statusMessage}`);
          resolve(false);
        }
      });
    });

    req.on("error", (err) => {
      console.error(`✖ [IndexNow] Request failed:`, err.message);
      reject(err);
    });

    req.write(postData);
    req.end();
  });
}

const urls = parseSitemapUrls();
submitIndexNow(urls).catch((err) => {
  console.error("IndexNow submission error:", err);
  process.exit(1);
});
