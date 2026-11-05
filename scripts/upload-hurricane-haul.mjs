// One-off: upload the re-encoded Hurricane Haul (East Hamilton, male squad)
// clips into the R2 raider-videos bucket + public.raider_videos, replacing
// what /videotv points at. Uses the service-role key for the row insert and
// the R2 keys for the upload; run locally, never commit either.
//
// Usage: node --env-file=.env.migrate scripts/upload-hurricane-haul.mjs

import { statSync } from 'node:fs';
import { loadEnv, supabaseAdmin, r2Put, r2Size, r2ObjectUrl } from './lib/storageMigration.mjs';

const env = loadEnv();
const sb = supabaseAdmin(env);
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
  try {
    await r2Put(env, BUCKET, clip.storagePath, clip.localPath, 'video/mp4');
    const uploaded = await r2Size(env, BUCKET, clip.storagePath);
    if (uploaded !== statSync(clip.localPath).size) throw new Error(`R2 has ${uploaded} bytes, expected ${statSync(clip.localPath).size}`);
  } catch (e) {
    console.error(`Upload failed for ${clip.title}:`, e.message);
    process.exit(1);
  }

  const { data, error: insErr } = await sb.from('raider_videos').insert({
    title: clip.title,
    storage_path: clip.storagePath,
    duration_sec: clip.durationSec,
    created_by: 'bulk-import',
  }).select('id').single();
  if (insErr) {
    // No row, so don't leave an orphan file in R2 either.
    await env.r2.fetch(r2ObjectUrl(env, BUCKET, clip.storagePath), { method: 'DELETE' });
    console.error(`Row insert failed for ${clip.title}:`, insErr.message);
    process.exit(1);
  }

  console.log(`  done — id ${data.id}`);
}

console.log('All Hurricane Haul clips uploaded.');
