#!/usr/bin/env node
/**
 * StreamHub Deploy Helper
 *
 * Usage:
 *   npm run deploy          # dry-run (shows what would happen)
 *   npm run deploy:apply    # actually upload (requires BUNNY_STORAGE_KEY)
 *
 * This script replaces the manual curl spam from CLAUDE.md.
 * It builds (optional) then walks dist/ and uploads to Bunny Storage,
 * preserving the exact folder structure the live site expects.
 *
 * After a successful upload you STILL must purge the Pull Zone cache.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STORAGE_BASE = 'https://storage.bunnycdn.com/streamhub-media';
const CDN_BASE = 'https://streamhub-media.b-cdn.net';
const KEY = process.env.BUNNY_STORAGE_KEY;

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return CONTENT_TYPES[ext] || 'application/octet-stream';
}

function shouldSkip(file) {
  // Never upload source maps in production if you want, but we keep them for now
  return false;
}

async function* walk(dir, baseDir = dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(fullPath, baseDir);
    } else if (entry.isFile()) {
      const relative = path.relative(baseDir, fullPath);
      yield { local: fullPath, remote: relative.replace(/\\/g, '/') };
    }
  }
}

async function uploadFile(localPath, remotePath, dryRun) {
  const content = await fs.readFile(localPath);
  const contentType = getContentType(remotePath);
  const url = `${STORAGE_BASE}/${remotePath}`;

  if (dryRun) {
    console.log(`[DRY] PUT ${remotePath}  (${content.length} bytes, ${contentType})`);
    return { ok: true, dry: true };
  }

  if (!KEY) {
    throw new Error('BUNNY_STORAGE_KEY is not set in the environment');
  }

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'AccessKey': KEY,
      'Content-Type': contentType,
      'Content-Length': String(content.length),
    },
    body: content,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Bunny upload failed for ${remotePath}: ${res.status} ${text}`);
  }

  console.log(`[OK]  ${remotePath}`);
  return { ok: true };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--apply') && !args.includes('--yes');
  const doBuild = args.includes('--build') || args.includes('-b');

  console.log('\nStreamHub Deploy');
  console.log('================');
  console.log(`Mode: ${dryRun ? 'DRY RUN (safe)' : 'LIVE UPLOAD'}`);
  console.log(`Target storage: ${STORAGE_BASE}`);
  console.log('');

  const distDir = path.join(__dirname, 'dist');

  // Ensure dist exists
  try {
    await fs.access(distDir);
  } catch {
    if (doBuild) {
      console.log('dist/ not found — running npm run build first...');
      const { execSync } = await import('child_process');
      execSync('npm run build', { stdio: 'inherit', cwd: __dirname });
    } else {
      console.error('ERROR: dist/ does not exist.');
      console.error('Run `npm run build` first, or use `npm run deploy:apply -- --build`');
      process.exit(1);
    }
  }

  // Collect files
  const files = [];
  for await (const f of walk(distDir, distDir)) {
    if (!shouldSkip(f.remote)) {
      files.push(f);
    }
  }

  if (files.length === 0) {
    console.log('No files found in dist/. Nothing to do.');
    return;
  }

  console.log(`Found ${files.length} files to upload.\n`);

  let success = 0;
  let failed = 0;

  for (const { local, remote } of files) {
    try {
      await uploadFile(local, remote, dryRun);
      success++;
    } catch (err) {
      console.error(`[FAIL] ${remote}: ${err.message}`);
      failed++;
    }
  }

  console.log('\n================');
  console.log(`Summary: ${success} succeeded, ${failed} failed`);

  if (dryRun) {
    console.log('\nThis was a DRY RUN. To actually upload run:');
    console.log('  npm run deploy:apply');
    console.log('or');
    console.log('  BUNNY_STORAGE_KEY=xxx node deploy.js --apply');
  } else {
    console.log('\n✅ Files uploaded to Bunny Storage.');
  }

  // Always remind about purge — this is the #1 source of "changes not live"
  console.log('\n⚠️  CRITICAL: You must still purge the Pull Zone cache (30-day TTL).');
  console.log('   1. Go to Bunny dashboard → CDN → Pull Zone "streamhub-media"');
  console.log('   2. Click "Purge Cache" → Purge Everything (or specific tag)');
  console.log('   Dashboard purge is easiest. API purge requires the account key.');
  console.log(`\n   Verification (after purge):`);
  console.log(`     curl -I ${CDN_BASE}/index.html`);
  console.log(`     curl -I ${CDN_BASE}/assets/main-*.js | head -1\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('\nFatal error:', err);
  process.exit(1);
});
