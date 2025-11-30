import { createClient } from '@supabase/supabase-js';

// Script: scan_null_descriptions.mjs
// Purpose: Lists destinations with a NULL description in the Supabase `destinations` table.
// Usage (PowerShell):
//   $env:VITE_SUPABASE_URL = "https://xyz.supabase.co";
//   $env:VITE_SUPABASE_PUBLISHABLE_KEY = "public-anon-key";
//   node .\scripts\scan_null_descriptions.mjs
// Or set SUPABASE_URL / SUPABASE_KEY env vars instead.

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase credentials. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (or SUPABASE_URL / SUPABASE_KEY).');
  process.exit(2);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  console.log('Scanning Supabase `destinations` table for NULL descriptions...');
  try {
    const { data, error } = await supabase
      .from('destinations')
      .select('id, name, province_id, description')
      .is('description', null)
      .order('name', { ascending: true });

    if (error) {
      console.error('Supabase query error:', error);
      process.exit(1);
    }

    if (!data || data.length === 0) {
      console.log('No destinations with NULL description found.');
      return;
    }

    console.log(`Found ${data.length} destination(s) with NULL description:`);
    console.table(data.map(d => ({ id: d.id, name: d.name, province_id: d.province_id })));

    // Also produce a simple CSV on disk for convenience
    const csvLines = ['id,name,province_id'];
    for (const d of data) {
      // escape quotes
      const name = String(d.name).replace(/"/g, '""');
      csvLines.push(`${d.id},"${name}",${d.province_id}`);
    }

    const fs = await import('fs');
    const outPath = './scan_null_descriptions.csv';
    fs.writeFileSync(outPath, csvLines.join('\n'));
    console.log(`Wrote CSV to ${outPath}`);
  } catch (err) {
    console.error('Unexpected error:', err);
    process.exit(1);
  }
}

run();
