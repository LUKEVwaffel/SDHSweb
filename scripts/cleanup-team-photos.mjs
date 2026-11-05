// Last step of moving team/event photos off Supabase Storage: delete the old
// Supabase `team-photos` copies, ONLY after proving each one is safely in the
// R2 `optic-photos` bucket. Run scripts/migrate-team-photos.mjs and then
// scripts/migrate-photos-to-r2.mjs first.
//
// A file is deleted from Supabase only if ALL of these are true:
//   1. migration-log-team-photos.csv says it was copied.
//   2. R2 optic-photos has it, with the same size as the log.
//   3. The Supabase copy is still the same size as the log (nothing changed).
//   4. The local backup in storage-backup/team-photos/ has the same size.
//   5. No DB row (any table except change_log history) has a Supabase URL
//      to that file. If any photos row still does, that file is kept: re-run
//      scripts/migrate-photos-to-r2.mjs.
// And the whole run stops before deleting anything if any code in src/,
// supabase/functions/ or scripts/ still reads or writes the Supabase
// team-photos bucket. The checks live in scripts/lib/bucketMigration.mjs.
//
// Deletes go through the Supabase Storage API (never SQL on storage.objects).
//
// Usage (from the repo root):
//   node --env-file=.env.migrate scripts/cleanup-team-photos.mjs --dry-run
//   node --env-file=.env.migrate scripts/cleanup-team-photos.mjs --yes
// Without --yes it only reports what it would delete.

import { runCleanup } from './lib/bucketMigration.mjs';

await runCleanup({
  sbBucket: 'team-photos',
  r2Bucket: 'optic-photos',
  logFile: 'migration-log-team-photos.csv',
  cleanupLog: 'migration-log-team-photos-cleanup.csv',
});
