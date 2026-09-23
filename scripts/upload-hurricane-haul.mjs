// One-off: upload the re-encoded Hurricane Haul (East Hamilton, male squad)
// clips into the raider-videos bucket + public.raider_videos, replacing what
// /videotv points at. Requires a service-role key since storage insert is
// authenticated-only via RLS; run locally, never commit the key.
//
// Usage: node --env-file=.env --env-file=.env.local scripts/upload-hurricane-haul.mjs
// (put SUPABASE_SERVICE_ROLE_KEY in .env.local — never commit it)

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.');
  process.exit(1);
}

const sb = createClient(url, serviceKey, { auth: { persistSession: false } });
const BUCKET = 'raider-videos';
const ts = Date.now();

const CLIPS = [
  {
    localPath: '/private/tmp/claude-501/-Users-lukevetsch-Desktop-Trojan-Battalion-Folder/3571258b-443e-419d-ab51-c32e7e591c63/scratchpad/videotv/part1.mp4',
    storagePath: `${ts}-hurricane-haul-part1.mp4`,
    title: 'Hurricane Haul — Part 1',
    durationSec: 531.5,
  },
  {
    localPath: '/private/tmp/claude-501/-Users-lukevetsch-Desktop-Trojan-Battalion-Folder/3571258b-443e-419d-ab51-c32e7e591c63/scratchpad/videotv/part2.mp4',
    storagePath: `${ts + 1}-hurricane-haul-part2.mp4`,
    title: 'Hurricane Haul — Part 2',
    durationSec: 445.2,
  },
];

for (const clip of CLIPS) {
  console.log(`Uploading ${clip.localPath} -> ${BUCKET}/${clip.storagePath} ...`);
  const bytes = readFileSync(clip.localPath);
  const { error: upErr } = await sb.storage.from(BUCKET).upload(clip.storagePath, bytes, {
    contentType: 'video/mp4',
    upsert: false,
  });
  if (upErr) { console.error(`Upload failed for ${clip.title}:`, upErr.message); process.exit(1); }

  const { data, error: insErr } = await sb.from('raider_videos').insert({
    title: clip.title,
    storage_path: clip.storagePath,
    duration_sec: clip.durationSec,
    created_by: 'bulk-import',
  }).select('id').single();
  if (insErr) { console.error(`Row insert failed for ${clip.title}:`, insErr.message); process.exit(1); }

  console.log(`  done — id ${data.id}`);
}

console.log('All Hurricane Haul clips uploaded.');
