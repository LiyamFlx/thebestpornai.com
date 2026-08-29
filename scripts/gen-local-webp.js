#!/usr/bin/env node
/**
 * Auto-generate high-efficiency WebP variants for images in public/blog-assets/
 * if they do not already exist.
 *
 * Run: node scripts/gen-local-webp.js
 */
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, "..");
const DIR = path.join(REPO, "public", "blog-assets");

if (fs.existsSync(DIR)) {
  const files = fs.readdirSync(DIR);
  let count = 0;
  for (const f of files) {
    if (!/\.(jpe?g|png)$/i.test(f)) continue;
    const base = f.replace(/\.(jpe?g|png)$/i, "");
    const webp = path.join(DIR, base + ".webp");
    if (!fs.existsSync(webp)) {
      const src = path.join(DIR, f);
      try {
        execFileSync("cwebp", ["-q", "82", src, "-o", webp], { stdio: "ignore" });
        count++;
      } catch {
        // Fall back gracefully if cwebp fails on an individual asset
      }
    }
  }
  if (count > 0) {
    console.log(`generated ${count} new webp variant(s) in public/blog-assets/`);
  }
}
