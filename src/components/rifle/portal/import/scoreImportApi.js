// Data layer for the rifle score import. Everything here is a plain
// client-side write gated by RLS (is_rifle_admin() or is_s6()) on
// rifle_shooters / rifle_matches / rifle_scores / rifle_comp_uploads — same
// gate as the rest of the portal. Only the AI fallback goes through an edge
// function, because it needs the ANTHROPIC_API_KEY secret.

import { supabase as SB } from '../../../../lib/supabaseClient';
import { invokeError } from '../../../../lib/supabaseFnError';
import { SCORE_FIELDS, POSITION_FIELDS } from './scoreGrid.js';
import { AI_MAX_CHARS } from './readScoreFile.js';

const RAW_SNAPSHOT_MAX = 200000;

function friendly(error, fallback) {
  if (!error) return fallback;
  if (error.code === '23505' && /rifle_matches/.test(error.message || '')) {
    return 'A match with that week number already exists. Pick it from the list — or, if this is a new season, run supabase/rifle_matches_week_per_season.sql once so weeks can repeat across seasons.';
  }
  if (error.code === '42501' || /row-level security/i.test(error.message || '')) {
    return 'Your account isn\'t allowed to write rifle scores (needs rifle admin or S-6). Sign out and back in, or ask Luke.';
  }
  return error.message || fallback;
}

export async function createMatch({ week, dates, opponent, location }) {
  const w = Number(week);
  if (!Number.isInteger(w) || w < 1 || w > 99) throw new Error('Week number must be a whole number 1–99.');
  const { data, error } = await SB.from('rifle_matches').insert({
    week: w, dates: dates?.trim() || null, opponent: opponent?.trim() || null, location: location?.trim() || null,
  }).select('*').single();
  if (error) throw new Error(friendly(error, 'Couldn\'t create the match.'));
  return data;
}

export async function fetchMatchScores(matchId) {
  const { data, error } = await SB.from('rifle_scores').select('shooter_id, prone, standing, kneeling, total, bulls').eq('match_id', matchId);
  if (error) throw new Error(friendly(error, 'Couldn\'t load existing scores.'));
  return data || [];
}

// AI fallback. `input` is { raw_text } or { file_base64, media_type }.
export async function aiParse(input, sourceName) {
  if (input.raw_text != null && input.raw_text.length > AI_MAX_CHARS) {
    throw new Error(`Too much text for AI reading (${input.raw_text.length.toLocaleString()} characters, max ${AI_MAX_CHARS.toLocaleString()}). Trim it to just the score table.`);
  }
  const { data, error } = await SB.functions.invoke('rifle-comp-parse', {
    body: input.raw_text != null ? { raw_csv: input.raw_text, source_name: sourceName } : { ...input, source_name: sourceName },
  });
  if (error || data?.error) throw new Error(await invokeError(data, error, 'AI reading failed.'));
  return data.upload;
}

export async function createUploadRecord({ rawText, rows, notes, source }) {
  const { data: { user } } = await SB.auth.getUser();
  const { data, error } = await SB.from('rifle_comp_uploads').insert({
    uploaded_by: user?.email || 'unknown',
    raw_csv: (rawText || '(no text)').slice(0, RAW_SNAPSHOT_MAX),
    draft: { rows, notes: notes || '', source },
    status: 'pending_review',
  }).select('*').single();
  if (error) throw new Error(friendly(error, 'Couldn\'t save the upload record.'));
  return data;
}

/**
 * Write finalized rows into one match.
 *   1. re-read the roster and create only shooters still missing (so a
 *      retry after a failed publish, or two batches published back to back,
 *      can't insert the same new shooter twice — name has no unique index)
 *   2. upsert scores — one statement per distinct set of columns, so a sheet
 *      that only has totals never blanks out stored positions
 *   3. mark the upload published (a failure here doesn't undo the scores,
 *      it's reported as a warning)
 * Publishes are serialized through one queue for the same reason as (1).
 * Returns { written, created, warning }.
 */
let publishQueue = Promise.resolve();
export function publishScores(args) {
  const run = publishQueue.then(() => publishScoresNow(args));
  publishQueue = run.catch(() => {});
  return run;
}

async function publishScoresNow({ rows, matchId, uploadId, uploadRows, uploadDraft }) {
  if (!matchId) throw new Error('Pick which match these scores belong to.');
  if (!rows.length) throw new Error('No rows to publish.');

  const { data: roster, error: rosterErr } = await SB.from('rifle_shooters').select('id, name');
  if (rosterErr) throw new Error(friendly(rosterErr, 'Couldn\'t load the roster.'));
  const byLower = new Map((roster || []).map((s) => [s.name.trim().toLowerCase(), s]));
  const missing = [...new Map(rows.map((r) => [r.name.trim().toLowerCase(), r.name.trim()])).entries()]
    .filter(([lower]) => !byLower.has(lower)).map(([, name]) => name);
  let created = [];
  if (missing.length) {
    const { data, error } = await SB.from('rifle_shooters').insert(missing.map((name) => ({ name }))).select('id, name');
    if (error) throw new Error(friendly(error, 'Couldn\'t add the new shooters.'));
    created = data || [];
    created.forEach((s) => byLower.set(s.name.trim().toLowerCase(), s));
  }

  const buckets = new Map();
  for (const r of rows) {
    const shooter = byLower.get(r.name.trim().toLowerCase());
    if (!shooter) throw new Error(`Couldn't resolve shooter "${r.name}".`);
    const rec = { shooter_id: shooter.id, match_id: matchId, upload_id: uploadId ?? null };
    SCORE_FIELDS.forEach((f) => { if (r[f] != null) rec[f] = r[f]; });
    // Positions changed but the sheet gave no total (and P+S+K couldn't be
    // filled because one is missing): clear the stored total rather than
    // leave a stale one that disagrees with the new positions.
    if (rec.total === undefined && POSITION_FIELDS.some((f) => r[f] != null)) rec.total = null;
    const sig = Object.keys(rec).sort().join(',');
    if (!buckets.has(sig)) buckets.set(sig, []);
    buckets.get(sig).push(rec);
  }
  for (const batch of buckets.values()) {
    const { error } = await SB.from('rifle_scores').upsert(batch, { onConflict: 'shooter_id,match_id' });
    if (error) throw new Error(friendly(error, 'Couldn\'t save the scores.'));
  }

  let warning = null;
  if (uploadId) {
    const { error } = await SB.from('rifle_comp_uploads').update({
      status: 'published', published_at: new Date().toISOString(), draft: { ...(uploadDraft || {}), rows: uploadRows, published_match_id: matchId },
    }).eq('id', uploadId);
    if (error) warning = `Scores saved, but the upload record didn't update (${error.message}).`;
  }
  return { written: rows.length, created, warning };
}

export async function discardUpload(uploadId) {
  const { error } = await SB.from('rifle_comp_uploads').update({ status: 'discarded' }).eq('id', uploadId);
  if (error) throw new Error(friendly(error, 'Couldn\'t discard the upload.'));
}
