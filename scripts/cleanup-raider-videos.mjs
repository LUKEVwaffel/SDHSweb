// Delete the old Supabase copies of Raider TV videos, ONLY after proving each
// one is safely in R2. Run scripts/migrate-raider-videos.mjs first; this
// reads its log (migration-log-raider-videos.csv).
//
// A file is deleted from Supabase only if ALL of these are true:
//   1. The migration log says it was copied (status already-in-r2 or uploaded).
//   2. R2 has it, with the same size as the log.
//   3. The Supabase copy is still the same size as the log (nothing changed).
//   4. The local backup in storage-backup/ exists with the same size.
//   5. No DB row (any table except change_log history) has a Supabase URL
//      to that file.
// And the whole run stops before deleting anything if any code in src/,
// supabase/functions/ or scripts/ still reads or writes the Supabase
// raider-videos bucket. The checks live in scripts/lib/bucketMigration.mjs.
//
// Deletes go through the Supabase Storage API (never SQL on storage.objects),
// so the files are really removed and the quota goes down.
//
// Usage (from the repo root):
//   node --env-file=.env.migrate scripts/cleanup-raider-videos.mjs --dry-run
//   node --env-file=.env.migrate scripts/cleanup-raider-videos.mjs --yes
// Without --yes it only reports what it would delete.

import { runCleanup } from './lib/bucketMigration.mjs';

await runCleanup({
  sbBucket: 'raider-videos',
  r2Bucket: 'raider-videos',
  logFile: 'migration-log-raider-videos.csv',
  cleanupLog: 'migration-log-raider-videos-cleanup.csv',
});
