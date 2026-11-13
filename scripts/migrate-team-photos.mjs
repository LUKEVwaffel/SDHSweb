// Step 1 of moving team/event photos off Supabase Storage: copy every file in
// the Supabase `team-photos` bucket into the R2 `optic-photos` bucket (same
// keys, so photos.storage_path keeps meaning the same thing), keep a local
// backup of every file in storage-backup/team-photos/, and write
// migration-log-team-photos.csv for the cleanup step.
//
// This script NEVER deletes anything and never changes DB rows. After it,
// run scripts/migrate-photos-to-r2.mjs to point the remaining photos rows at
// R2, then scripts/cleanup-team-photos.mjs. See docs/r2-migration-audit.md.
//
// Safe to re-run: files already in R2 with the same size are not uploaded
// again, and existing backups are not downloaded again. Files already in R2
// are backed up FROM R2 (saves Supabase egress) unless --backup-from-supabase.
//
// Usage (from the repo root):
//   node --env-file=.env.migrate scripts/migrate-team-photos.mjs --dry-run
//   node --env-file=.env.migrate scripts/migrate-team-photos.mjs

import { runMigration } from './lib/bucketMigration.mjs';

await runMigration({
  sbBucket: 'team-photos',
  r2Bucket: 'optic-photos',
  logFile: 'migration-log-team-photos.csv',
  concurrency: 6,
});
