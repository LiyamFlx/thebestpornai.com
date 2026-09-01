#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, "..");

const REFERRAL_LINK = "https://candyai.gg/home2?via=jeycxz";

const filesToUpdate = [
  path.join(REPO, "src", "blog", "posts.js"),
  path.join(REPO, "src", "blog", "writer-posts.json"),
  path.join(REPO, "src", "blog", "ai-sex-chats-guide-post.js"),
  path.join(REPO, "src", "blog", "gptgirlfriend-review-2026-post.js"),
  path.join(REPO, "src", "blog", "nsfw-ai-image-generators-2026-post.js"),
  path.join(REPO, "public", "The-Best-Porn-AI-in-2026.html"),
];

let totalReplaced = 0;

for (const filePath of filesToUpdate) {
  if (!fs.existsSync(filePath)) continue;
  let content = fs.readFileSync(filePath, "utf8");
  const countBefore = (content.match(/https:\/\/candy\.ai(?!\w)/g) || []).length;
  if (countBefore > 0) {
    // Replace plain https://candy.ai with referral link
    content = content.replace(/https:\/\/candy\.ai(?!\w)/g, REFERRAL_LINK);
    fs.writeFileSync(filePath, content, "utf8");
    totalReplaced += countBefore;
    console.log(`[update-candy-links] Updated ${countBefore} link(s) in ${path.relative(REPO, filePath)}`);
  }
}

console.log(`[update-candy-links] Successfully updated ${totalReplaced} Candy.ai links across review & pillar pages!`);
