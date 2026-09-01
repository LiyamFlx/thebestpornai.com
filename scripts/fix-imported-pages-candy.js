import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const importedPath = path.join(__dirname, "../src/cluster/imported-pages.json");
const REFERRAL_LINK = "https://candyai.gg/home2?via=jeycxz";

let raw = fs.readFileSync(importedPath, "utf8");
const beforeCount = (raw.match(/https:\/\/(www\.)?candy\.ai\/?/g) || []).length;

raw = raw.replace(/https:\/\/(www\.)?candy\.ai\/?/g, REFERRAL_LINK);

fs.writeFileSync(importedPath, raw, "utf8");
console.log(`Replaced ${beforeCount} candy.ai links in imported-pages.json with ${REFERRAL_LINK}`);
