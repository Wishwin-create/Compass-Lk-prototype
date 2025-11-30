#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Usage:
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in env.
// node scripts/assign_local_images.mjs [--dry-run] [--yes]

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (recommended).');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

const argv = process.argv.slice(2);
const DRY_RUN = argv.includes('--dry-run');
const AUTO_YES = argv.includes('--yes') || argv.includes('-y');

const PICTURES_DIR = path.resolve(process.cwd(), 'src', 'pictures');

function normalize(s = '') { return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim(); }

function walkDir(dir) {
  const entries = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const it of items) {
    const full = path.join(dir, it.name);
    if (it.isDirectory()) entries.push(...walkDir(full));
    else entries.push(full);
  }
  return entries;
}

async function main() {
  if (!fs.existsSync(PICTURES_DIR)) {
    console.error('Pictures directory not found at', PICTURES_DIR);
    process.exit(1);
  }

  const files = walkDir(PICTURES_DIR).filter((f) => /\.(jpg|jpeg|png|webp|gif)$/i.test(f));
  if (files.length === 0) {
    console.log('No image files found under src/pictures');
    process.exit(0);
  }

  // Build map of normalized filename -> relative path (web path) using posix separators
  const fileRecords = files.map((f) => {
    const rel = path.relative(process.cwd(), f).split(path.sep).join('/');
    const filename = path.basename(f);
    const key = normalize(filename.replace(/\.(jpg|jpeg|png|webp|gif)$/i, ''));
    return { full: f, rel: `/${rel}`, filename, key };
  });

  console.log(`Found ${fileRecords.length} image files under src/pictures`);

  // Fetch destinations with no image_url
  const { data: destinations, error } = await supabase.from('destinations').select('*').is('image_url', null);
  if (error) {
    console.error('Error fetching destinations:', error);
    process.exit(1);
  }
  if (!destinations || destinations.length === 0) {
    console.log('No destinations without image_url found.');
    process.exit(0);
  }

  const assignments = [];

  for (const dest of destinations) {
    const n = normalize(dest.name || '');
    // try direct filename match
    let match = fileRecords.find((fr) => fr.key.includes(n));
    // fallback: filename includes some word from name
    if (!match) {
      const parts = (dest.name || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
      for (const p of parts) {
        const k = normalize(p);
        match = fileRecords.find((fr) => fr.key.includes(k));
        if (match) break;
      }
    }
    if (match) {
      assignments.push({ id: dest.id, name: dest.name, image_rel: match.rel });
    }
  }

  if (assignments.length === 0) {
    console.log('No suitable local images found to assign.');
    process.exit(0);
  }

  // write backup
  const backupPath = `./scripts/assign_local_images_backup_${Date.now()}.json`;
  fs.writeFileSync(backupPath, JSON.stringify({ timestamp: new Date().toISOString(), assignments }, null, 2), 'utf8');
  console.log(`Backup written to ${backupPath}`);

  console.log(`Will assign ${assignments.length} images to destinations (sample):`);
  assignments.slice(0, 10).forEach((a, i) => console.log(`${i + 1}. id=${a.id} name="${a.name}" -> ${a.image_rel}`));
  if (assignments.length > 10) console.log(`...and ${assignments.length - 10} more`);

  if (DRY_RUN) {
    console.log('--dry-run provided, exiting without making changes.');
    process.exit(0);
  }

  if (!AUTO_YES) {
    const input = await new Promise((res) => {
      process.stdout.write('Proceed to update these destinations? Type YES to confirm: ');
      process.stdin.once('data', (d) => res(String(d).trim()));
    });
    if (input !== 'YES') {
      console.log('Aborted by user. No changes made.');
      process.exit(0);
    }
  }

  // perform updates in batches
  const batchSize = 50;
  for (let i = 0; i < assignments.length; i += batchSize) {
    const batch = assignments.slice(i, i + batchSize);
    // Supabase update per id (we can perform multiple updates in parallel)
    const promises = batch.map((b) => supabase.from('destinations').update({ image_url: b.image_rel }).eq('id', b.id));
    const results = await Promise.all(promises);
    for (const r of results) {
      if (r.error) console.error('Update error:', r.error.message || r.error);
    }
    console.log(`Updated batch ${Math.floor(i / batchSize) + 1}: ${batch.length} rows`);
  }

  console.log(`Assigned ${assignments.length} local images to destinations.`);
}

main().catch((err) => { console.error('Unexpected error', err); process.exit(1); });
