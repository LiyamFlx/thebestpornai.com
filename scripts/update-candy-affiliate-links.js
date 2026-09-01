#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, "..");

const REFERRAL_LINK = "https://candyai.gg/home2?via=jeycxz";

function walkAndReplace(dir) {
  let count = 0;
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const fullPath = path.join(dir, f);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      count += walkAndReplace(fullPath);
    } else if (f.endsWith(".js") || f.endsWith(".mjs") || f.endsWith(".json") || f.endsWith(".html")) {
      let content = fs.readFileSync(fullPath, "utf8");
      // Replace https://candy.ai/ or https://candy.ai
      const matches = content.match(/https:\/\/(www\.)?candy\.ai\/?(?=["'\s<>]|$)/g);
      if (matches && matches.length > 0) {
        content = content.replace(/https:\/\/(www\.)?candy\.ai\/?(?=["'\s<>]|$)/g, REFERRAL_LINK);
        fs.writeFileSync(fullPath, content, "utf8");
        console.log(`[update-candy-links] Updated ${matches.length} link(s) in ${path.relative(REPO, fullPath)}`);
        count += matches.length;
      }
    }
  }
  return count;
}

console.log("🔄 Updating ALL plain candy.ai links to referral link: " + REFERRAL_LINK + "\n");
const total = walkAndReplace(path.join(REPO, "src")) + walkAndReplace(path.join(REPO, "public"));
console.log(`\n✨ Total replaced across codebase: ${total}`);
