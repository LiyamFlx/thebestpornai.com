#!/usr/bin/env node
/* ship.js — one command to ship everything.
 *
 *   npm run ship
 *
 * Does, in order:
 *   1. git push        → back up commits to GitHub (also triggers Vercel auto-deploy)
 *   2. vite build      → produce fresh dist/
 *   3. deploy to Bunny → upload dist/ + auto-purge the Pull Zone (via deploy.js)
 *   4. Vercel note     → if api/ changed, remind that the relay needs its own deploy
 *
 * The live website is served from Bunny, so step 3 is what makes changes visible.
 * Git + Vercel are backup / the upload-relay respectively.
 *
 * Env needed for the Bunny step (same as deploy:apply):
 *   BUNNY_STORAGE_KEY  (upload)   BUNNY_ACCOUNT_KEY (auto-purge, optional)
 */
import { execSync } from 'child_process';

function run(cmd, opts = {}) {
  console.log(`\n$ ${cmd}`);
  execSync(cmd, { stdio: 'inherit', ...opts });
}
function capture(cmd) {
  try { return execSync(cmd, { encoding: 'utf8' }).trim(); } catch { return ''; }
}

console.log('🚢 Shipping thebestpornai…');

// 0. safety: warn on uncommitted changes (they won't be pushed)
const dirty = capture('git status --porcelain');
if (dirty) {
  console.log('\n⚠️  You have uncommitted changes — commit them first or they won\'t be pushed:');
  console.log(dirty.split('\n').map(l => '   ' + l).join('\n'));
  console.log('   (Continuing: build/deploy will still use your working tree.)');
}

// 1. push to GitHub (skip gracefully if nothing to push / no network)
try {
  run('git push origin HEAD');
} catch {
  console.log('   (git push skipped or failed — continuing with build/deploy.)');
}

// 2 + 3. build + deploy to Bunny + auto-purge (deploy.js reads the env keys)
run('npm run build');
run('node deploy.js --apply');

// 4. Vercel: only the /api relay lives there. Remind if api/ changed recently.
const apiChanged = capture('git diff --name-only HEAD~1 HEAD -- api/') ||
                   capture('git status --porcelain -- api/');
if (apiChanged) {
  console.log('\n📦 Note: files under api/ changed. The upload relay runs on Vercel (project "x").');
  console.log('   Deploy it with:  vercel deploy --prod');
  console.log('   (Only needed when api/ changes — the website itself is on Bunny, already shipped above.)');
}

console.log('\n✅ Shipped. Website is live on Bunny; commits pushed to GitHub.');
