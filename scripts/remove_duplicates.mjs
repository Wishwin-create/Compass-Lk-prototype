#!/usr/bin/env node
import fs from 'fs';
import readline from 'readline';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (recommended) or VITE_SUPABASE_* env vars.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (q) => new Promise((res) => rl.question(q, res));

// CLI args
const argv = process.argv.slice(2);
const AUTO_YES = argv.includes('--yes') || argv.includes('-y');
const CSV_OUT = argv.includes('--csv') || argv.includes('--export-csv');

const normalize = (s = '') => String(s).toLowerCase().replace(/[^a-z0-9]/g, '').trim();

async function main() {
  console.log('Fetching destinations from Supabase...');
  const { data: destinations, error } = await supabase.from('destinations').select('*');
  if (error) {
    console.error('Error fetching destinations:', error);
    process.exit(1);
  }
  if (!destinations || destinations.length === 0) {
    console.log('No destinations found. Nothing to do.');
    process.exit(0);
  }

  // Group by normalized name
  const groups = {};
  destinations.forEach((d) => {
    const key = normalize(d.name || '');
    if (!groups[key]) groups[key] = [];
    groups[key].push(d);
  });

  const duplicates = [];
  Object.values(groups).forEach((list) => {
    if (list.length <= 1) return;
    // score attributes (higher = keep)
    const scored = list.map((item) => {
      let score = 0;
      if (item.description && String(item.description).trim().length > 0) score += 2;
      if (item.province_id) score += 1;
      if (item.image_url) score += 2;
      if (item.location_lat || item.location_lng) score += 1;
      return { item, score };
    });
    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      // prefer longer description
      const al = (a.item.description || '').length;
      const bl = (b.item.description || '').length;
      if (bl !== al) return bl - al;
      return String(a.item.id || '').localeCompare(String(b.item.id || ''));
    });
    const keep = scored[0].item;
    const remove = scored.slice(1).map((s) => s.item);
    duplicates.push({ keep, remove });
  });

  if (duplicates.length === 0) {
    console.log('No duplicate groups found.');
    process.exit(0);
  }

  // prepare backup
  const toDelete = duplicates.flatMap((g) => g.remove.map((r) => r.id));
  const backup = { timestamp: new Date().toISOString(), groups: duplicates };
  const backupPath = `./scripts/duplicates_backup_${Date.now()}.json`;
  fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2), 'utf8');
  console.log(`Backup of duplicate groups written to ${backupPath}`);

  if (CSV_OUT) {
    // also write a simple CSV with deleted rows
    const csvPath = `./scripts/duplicates_backup_${Date.now()}.csv`;
    const rows: string[] = [];
    rows.push('group_index,keep_id,keep_name,remove_id,remove_name');
    duplicates.forEach((g, gi) => {
      g.remove.forEach((r) => {
        rows.push(`${gi + 1},"${String(g.keep.id)}","${String((g.keep.name || '').replace(/"/g,'""'))}","${String(r.id)}","${String((r.name || '').replace(/"/g,'""'))}"`);
      });
    });
    fs.writeFileSync(csvPath, rows.join('\n'), 'utf8');
    console.log(`CSV backup written to ${csvPath}`);
  }

  // show summary
  console.log(`Found ${duplicates.length} duplicate groups; ${toDelete.length} rows marked for deletion.`);
  duplicates.slice(0, 10).forEach((g, idx) => {
    console.log(`Group ${idx + 1}: keep id=${g.keep.id}, name="${g.keep.name}"; remove: ${g.remove.map(r => `${r.id}("${r.name}")`).join(', ')}`);
  });
  if (duplicates.length > 10) console.log(`...and ${duplicates.length - 10} more groups.`);

  if (!AUTO_YES) {
    const ans = (await question('Proceed to delete the marked rows? Type YES to confirm: ')).trim();
    if (ans !== 'YES') {
      console.log('Aborted by user. No deletions performed.');
      rl.close();
      process.exit(0);
    }
  } else {
    console.log('--yes provided, proceeding without prompt');
  }

  // perform deletion in batches
  const batchSize = 100;
  for (let i = 0; i < toDelete.length; i += batchSize) {
    const batch = toDelete.slice(i, i + batchSize);
    const { data, error: delErr } = await supabase.from('destinations').delete().in('id', batch).select();
    if (delErr) {
      console.error('Error deleting batch:', delErr);
      rl.close();
      process.exit(1);
    }
    console.log(`Deleted batch ${i / batchSize + 1}: ${batch.length} rows`);
  }

  console.log(`Deletion complete. ${toDelete.length} rows deleted.`);
  rl.close();
}

main().catch((err) => { console.error('Unexpected error', err); process.exit(1); });
