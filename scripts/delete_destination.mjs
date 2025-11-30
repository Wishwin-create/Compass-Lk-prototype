#!/usr/bin/env node
import fs from 'fs';
import readline from 'readline';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (recommended).');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (q) => new Promise((res) => rl.question(q, res));

const argv = process.argv.slice(2);
const ID_ARG = argv.find((a) => a.startsWith('--id=')) || argv.find((a) => a === '--id');
const AUTO_YES = argv.includes('--yes') || argv.includes('-y');
let id = null;
if (ID_ARG && ID_ARG.includes('=')) id = ID_ARG.split('=')[1];
else if (ID_ARG === '--id') id = argv[argv.indexOf('--id') + 1];

if (!id) {
  console.error('Usage: node scripts/delete_destination.mjs --id <destination-id> [--yes]');
  process.exit(1);
}

async function main() {
  console.log(`Looking up destination id=${id}...`);
  const { data: existing, error: fetchErr } = await supabase.from('destinations').select('*').eq('id', id).maybeSingle();
  if (fetchErr) {
    console.error('Error fetching destination:', fetchErr);
    process.exit(1);
  }
  if (!existing) {
    console.log('No destination found with that id. Nothing to delete.');
    process.exit(0);
  }

  console.log('Found destination:');
  console.log(`  id: ${existing.id}`);
  console.log(`  name: ${existing.name}`);
  console.log(`  province_id: ${existing.province_id}`);

  if (!AUTO_YES) {
    const ans = (await question('Proceed to delete this destination? Type YES to confirm: ')).trim();
    if (ans !== 'YES') {
      console.log('Aborted by user. No deletions performed.');
      rl.close();
      process.exit(0);
    }
  } else {
    console.log('--yes provided, proceeding without prompt');
  }

  // Perform deletion
  const { data, error } = await supabase.from('destinations').delete().eq('id', id).select();
  console.debug('delete response:', { data, error });
  if (error) {
    console.error('Error deleting destination:', error);
    process.exit(1);
  }

  // verify
  const { data: verify, error: verifyErr } = await supabase.from('destinations').select('id').eq('id', id).maybeSingle();
  if (verifyErr) {
    console.error('Delete may have succeeded but verification query failed:', verifyErr);
    process.exit(1);
  }
  if (verify) {
    console.error('Delete failed: destination still exists after delete request. This is likely caused by RLS/permission rules blocking the operation.');
    process.exit(1);
  }

  console.log(`Destination id=${id} deleted successfully.`);
  rl.close();
}

main().catch((err) => { console.error('Unexpected error', err); process.exit(1); });
