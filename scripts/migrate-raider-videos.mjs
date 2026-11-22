// Copy every Raider TV video from Supabase Storage (`raider-videos`) to the
// R2 bucket of the same name, keeping the exact same file names. Also saves a
// local backup of every file and writes migration-log-raider-videos.csv,
// which scripts/cleanup-raider-videos.mjs reads before it deletes anything.
//
// This script NEVER deletes anything from Supabase.
//
// Safe to re-run: files already in R2 with the same size are not uploaded
// again, and backups that already exist with the right size are not
// downloaded again.
//
// Backups: a file already in R2 is backed up FROM R2 by default (same bytes,
// and it does not use up Supabase's monthly egress). Pass
// --backup-from-supabase to pull every backup from Supabase instead. Files
// not yet in R2 always come from Supabase.
//
// Usage (from the repo root):
//   node --env-file=.env.migrate scripts/migrate-raider-videos.mjs --dry-run
//   node --env-file=.env.migrate scripts/migrate-raider-videos.mjs

import { runMigration } from './lib/bucketMigration.mjs';

await runMigration({
  sbBucket: 'raider-videos',
  r2Bucket: 'raider-videos',
  logFile: 'migration-log-raider-videos.csv',
  concurrency: 2,
});
