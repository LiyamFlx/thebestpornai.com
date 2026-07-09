#!/usr/bin/env node
/**
 * Add videos from a Bunny storage subfolder to the catalog.
 *
 * Usage:
 *   BUNNY_STORAGE_KEY=xxx node scripts/add-bunny-folder.js "5jun to upload" --category "Blonde" --tags "Amateur"
 *
 * It will:
 *   - List files in the given path (non-recursive)
 *   - Filter common video extensions
 *   - Generate catalog entries starting after the current max id
 *   - Output a ready-to-paste JS array snippet
 *   - Optionally patch src/shared/catalog.js (use --patch with care)
 *
 * Then:
 *   1. Paste the entries into DATA.videos (before the closing ])
 *   2. npm run build
 *   3. node deploy.js --apply   (or manually upload dist/)
 *   4. Purge Bunny Pull Zone cache
 */

import fs from 'fs';
import path from 'path';

const STORAGE_ZONE = 'streamhub-media';
const CDN_BASE = 'https://streamhub-media.b-cdn.net';
const CATALOG_PATH = path.join(process.cwd(), 'src/shared/catalog.js');

const args = process.argv.slice(2);
const folderPath = args[0] || '5jun to upload';
const patch = args.includes('--patch');
let category = 'Blonde';
let tags = ['Blonde', 'Amateur'];

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--category' && args[i+1]) category = args[++i];
  if (args[i] === '--tags' && args[i+1]) tags = args[++i].split(',').map(t => t.trim());
}

const key = process.env.BUNNY_STORAGE_KEY;
if (!key) {
  console.error('ERROR: Set BUNNY_STORAGE_KEY env var');
  process.exit(1);
}

async function listFiles(prefix) {
  const url = `https://storage.bunnycdn.com/${STORAGE_ZONE}/${encodeURIComponent(prefix)}/`;
  const res = await fetch(url, {
    headers: {
      'AccessKey': key,
      'Accept': 'application/json'
    }
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Bunny list failed: ${res.status} ${txt}`);
  }
  return res.json();
}

function isVideoFile(name) {
  return /\.(mp4|mov|webm|m4v)$/i.test(name);
}

function cleanTitle(name) {
  let t = name.replace(/\.[^.]+$/, '');
  t = t.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  // Remove trailing numbers like 00002
  t = t.replace(/\s*\d{3,}$/, '').trim();
  if (!t) t = name.replace(/\.[^.]+$/, '');
  return t;
}

function nextId(currentMax) {
  return currentMax + 1;
}

function getMaxIdFromCatalog() {
  const content = fs.readFileSync(CATALOG_PATH, 'utf8');
  const matches = content.match(/id:\s*(\d+)/g) || [];
  const nums = matches.map(m => parseInt(m.replace(/[^\d]/g, ''), 10)).filter(n => !isNaN(n));
  return nums.length ? Math.max(...nums) : 0;
}

function makeEntry(id, fileName, folder) {
  const title = cleanTitle(fileName);
  const src = `../media/${folder}/${fileName}`;
  const today = '2026-07-09';

  return `    { id:${id}, title:"${title}", creator:"c4", type:"ugc", category:"${category}", categories:["${category}"], views:0, likes:0, dislikes:0, comments:0, favorites:0, duration:"", uploaded:"${today}", src:"${src}", tags:${JSON.stringify(tags)}, status:"published", flagged:false },`;
}

async function main() {
  console.log(`Listing Bunny folder: ${folderPath} (zone: ${STORAGE_ZONE})`);

  let files;
  try {
    const raw = await listFiles(folderPath);
    files = raw.filter(f => !f.IsDirectory && isVideoFile(f.ObjectName || f.objectName || ''));
    console.log(`Found ${files.length} video files.`);
  } catch (e) {
    console.error('Failed to list:', e.message);
    process.exit(1);
  }

  if (!files.length) {
    console.log('No videos found. Nothing to do.');
    return;
  }

  const maxId = getMaxIdFromCatalog();
  console.log(`Current max id in catalog: ${maxId}`);

  let next = maxId + 1;
  const entries = [];

  for (const f of files) {
    const name = f.ObjectName || f.objectName || f.name;
    if (!name) continue;
    const entry = makeEntry(next++, name, folderPath);
    entries.push(entry);
  }

  const snippet = entries.join('\n');

  console.log('\n=== COPY THE FOLLOWING INTO src/shared/catalog.js ===\n');
  console.log('Paste these lines just before the final   ], of the videos array:\n');
  console.log(snippet);
  console.log('\n=== END OF SNIPPET ===\n');

  const useManifest = args.includes('--use-manifest') || args.includes('--manifest');

  if (useManifest) {
    console.log('\n=== MANIFEST MODE: updating Bunny manifest.json directly ===');
    await updateManifest(entries, files, folderPath);
    console.log('\nDone. Now purge the Pull Zone cache in the Bunny dashboard for instant visibility.');
    console.log('The videos should appear in feeds via the dynamic manifest loader.');
    return;
  }

  if (patch) {
    console.log('Patching catalog.js ...');
    let content = fs.readFileSync(CATALOG_PATH, 'utf8');

    // Find the "videos: [" array specifically, then its matching closing "  ],"
    // (NOT content.lastIndexOf('  ],') on the whole file, which finds whatever
    // array happens to close last textually — e.g. `users:` right before `flags:` —
    // and silently corrupts the catalog by inserting entries into the wrong array).
    const videosStart = content.indexOf('videos: [');
    if (videosStart === -1) {
      console.error('Could not find "videos: [" in catalog.js. Please paste manually.');
      return;
    }
    const videosClose = content.indexOf('\n  ],', videosStart);
    if (videosClose === -1) {
      console.error('Could not find the closing "  ]," for the videos array. Please paste manually.');
      return;
    }

    // Insert right before that closing bracket.
    const before = content.slice(0, videosClose);
    const after = content.slice(videosClose);

    const newContent = before + '\n' + snippet + after;

    fs.writeFileSync(CATALOG_PATH, newContent);
    console.log('Patched into the videos: [] array. Now run: npm run build && node deploy.js --apply');
  } else {
    console.log('Tip: rerun with --patch to auto-insert (make a backup first).');
    console.log('After editing catalog:');
    console.log('  npm run build');
    console.log('  node deploy.js --apply');
    console.log('Then purge the Pull Zone cache in Bunny dashboard.');
  }

  console.log('\nFilenames that will be added:');
  files.forEach((f, i) => {
    const name = f.ObjectName || f.objectName;
    console.log(`  ${i+1}. ${name}`);
  });
}

async function updateManifest(entries, fileList, folder) {
  const manifestUrl = `https://storage.bunnycdn.com/${STORAGE_ZONE}/manifest.json`;

  // 1. Fetch current manifest
  let existing = [];
  try {
    const r = await fetch(manifestUrl, {
      headers: { 'AccessKey': key, 'Accept': 'application/json' }
    });
    if (r.ok) {
      existing = await r.json();
    }
  } catch (e) {
    console.warn('Could not read existing manifest, starting fresh.', e.message);
  }

  if (!Array.isArray(existing)) existing = [];

  // Build full entry objects (same shape the viewer expects)
  const newEntries = fileList.map((f, idx) => {
    const name = f.ObjectName || f.objectName;
    const title = cleanTitle(name);
    const src = `../media/${folder}/${name}`;
    const today = '2026-07-09';

    return {
      id: 100000 + idx, // high ids to avoid clashing with static catalog
      title,
      creator: 'c4',
      type: 'ugc',
      category,
      categories: [category],
      views: 0,
      likes: 0,
      dislikes: 0,
      comments: 0,
      favorites: 0,
      duration: '',
      uploaded: today,
      src,
      tags,
      status: 'published',
      flagged: false,
      thumb: ''
    };
  });

  // Dedupe by src
  const existingSrcs = new Set(existing.map(e => e.src));
  const toAdd = newEntries.filter(e => !existingSrcs.has(e.src));

  if (!toAdd.length) {
    console.log('All videos from this folder are already in the manifest. Nothing added.');
    return;
  }

  // Prepend (newest first, like the save-upload flow)
  const updated = [...toAdd, ...existing];

  // 2. PUT back
  const putRes = await fetch(manifestUrl, {
    method: 'PUT',
    headers: {
      'AccessKey': key,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(updated, null, 2)
  });

  if (!putRes.ok) {
    const detail = await putRes.text().catch(() => '');
    throw new Error(`Failed to update manifest: ${putRes.status} ${detail}`);
  }

  console.log(`Successfully added ${toAdd.length} new videos to manifest.json`);
  console.log('New videos:');
  toAdd.forEach(e => console.log('  - ' + e.title));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
