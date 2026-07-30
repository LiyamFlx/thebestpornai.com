#!/usr/bin/env node
/**
 * 🔥 Enhanced gen-catalog-from-local.js for thebestpornai.com
 * Generates high-quality video entries from local ./media/<folder>
 * Now with smart tagging, duration, and structural parsing.
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { parseStructure } from "./lib/parse-structure.js";

const args = process.argv.slice(2);
const folder = args.find(a => !a.startsWith("--"));
if (!folder) {
  console.error("❌ Usage: node gen-catalog-from-local.js <folder> [--category AI] [--tags \"Big Ass,Teen\"] [--start-id 900] [--creator c1]");
  process.exit(1);
}

let category = "AI";
let startId = 900;
let extraTags = [];
let creatorOverride = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--category" && args[i+1]) category = args[++i];
  if (args[i] === "--start-id" && args[i+1]) startId = parseInt(args[++i], 10);
  if (args[i] === "--creator" && args[i+1]) creatorOverride = args[++i];
  if (args[i] === "--tags" && args[i+1]) {
    extraTags = args[++i].split(",").map(t => t.trim());
  }
}

const VIDEO_EXT = new Set([".mp4", ".mov", ".webm", ".m4v"]);
const dir = path.join(process.cwd(), "media", folder);

if (!fs.existsSync(dir)) {
  console.error(`❌ Folder not found: ${dir}`);
  process.exit(1);
}

const files = fs.readdirSync(dir)
  .filter(f => VIDEO_EXT.has(path.extname(f).toLowerCase()))
  .sort((a,b) => a.localeCompare(b));

console.error(`🔥 Processing ${files.length} videos from "${folder}"...`);

const creators = ["c1", "c2", "c3", "c4"];
const today = new Date().toISOString().slice(0, 10);

function getDuration(filePath) {
  try {
    const out = execSync(`ffprobe -v quiet -print_format json -show_format "${filePath}"`, { encoding: "utf8" });
    const data = JSON.parse(out);
    const secs = parseFloat(data.format?.duration || 0);
    const min = Math.floor(secs / 60);
    const sec = Math.floor(secs % 60);
    return `${min}:${sec.toString().padStart(2, '0')}`;
  } catch (_) {
    return "0:00";
  }
}

function generateTags(title, category, extra) {
  const t = title.toLowerCase();
  const common = ["Hardcore", category];
  if (t.includes("ass")) common.push("Big Ass", "PAWG");
  // Use the site-standard "18+" label, never bare "18"/"Teen" (processor risk;
  // matches the taxonomy the rest of the platform uses).
  if (t.includes("teen") || /\b18\b/.test(t)) common.push("18+");
  if (t.includes("milf")) common.push("MILF");
  if (t.includes("blow") || t.includes("suck")) common.push("Blowjob", "Deepthroat");
  return [...new Set([...common, ...extra])].slice(0, 8);
}

const entries = files.map((f, i) => {
  const fullPath = path.join(dir, f);
  const id = startId + i;
  const creator = creatorOverride || creators[i % creators.length];
  const src = `../media/${folder}/${f}`;
  const duration = getDuration(fullPath);
  const title = titleFromFile(f);
  const structure = parseStructure(f);
  const tags = generateTags(title, category, extraTags);

  return `    {
      id: ${id},
      title: ${JSON.stringify(title)},
      creator: "${creator}",
      type: "ugc",
      category: ${JSON.stringify(category)},
      categories: [${JSON.stringify(category)}],
      views: 0,
      likes: 0,
      dislikes: 0,
      comments: 0,
      favorites: 0,
      duration: "${duration}",
      uploaded: "${today}",
      src: ${JSON.stringify(src)},
      tags: ${JSON.stringify(tags)},
      status: "published",
      flagged: false,
      ${structure.movieTitle ? `movieTitle: ${JSON.stringify(structure.movieTitle)},` : ''}
      ${structure.level ? `level: "${structure.level}",` : ''}
      ${structure.sceneNumber ? `sceneNumber: ${structure.sceneNumber},` : ''}
      ${structure.clipNumber ? `clipNumber: ${structure.clipNumber},` : ''}
      ${structure.actName ? `actName: ${JSON.stringify(structure.actName)},` : ''}
    },`;
});

function titleFromFile(f) {
  return path.basename(f, path.extname(f))
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, c => c.toUpperCase());
}

console.error(`✅ Generated ${entries.length} entries (IDs ${startId}–${startId + entries.length - 1})`);
console.log("[\n" + entries.join("\n") + "\n]");