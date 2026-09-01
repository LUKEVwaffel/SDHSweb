import { supabase as SB } from './supabaseClient';

// Shared constants + helpers for the Raider film-review surfaces:
//   /raidertv       — the display (creates a session, shows a pair code)
//   /raiderremote   — the phone control (joins by code, writes intent)
//   DISPATCH "Raider TV" panel — the durable video library
//
// Transport is a single row in public.raider_tv_sessions watched by both
// sides over Realtime. The remote writes the "intent" columns (video_id /
// playing / rate / seek_to_sec / loop / ab_*); the TV writes the "status"
// columns (tv_position_sec / tv_duration_sec / tv_ready) plus last_seen_at.

// 6-char pair codes. Alphabet drops O/0/I/1/L/S/5 so a code read off a TV
// across the room is unambiguous.
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRTUVWXYZ2346789';
export const CODE_LEN = 6;

export const VIDEO_BUCKET = 'raider-videos';

// Playback speeds the remote exposes — slow first, this is for breaking down
// technique frame by frame, not casual viewing.
export const SPEED_PRESETS = [0.1, 0.25, 0.5, 0.75, 1, 1.5, 2];

// One frame at 30fps — the nudge the ◀| / |▶ step buttons apply while paused.
export const FRAME_SEC = 1 / 30;

export const SKIP_SMALL = 1;   // seconds — the ±1s buttons
export const SKIP_LARGE = 10;  // seconds — the ±10s buttons

// Drift past which the TV hard-seeks currentTime instead of letting normal
// playback close the gap.
export const DRIFT_TOLERANCE_SEC = 0.75;

// The other side counts as "connected" only if it wrote within this window.
export const STALE_MS = 12000;

export function makeCode() {
  let out = '';
  for (let i = 0; i < CODE_LEN; i += 1) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

// Accept lowercase / spaces / hyphens when the code is typed on a phone.
export function normalizeCode(raw) {
  return (raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LEN);
}

export function videoUrl(storagePath) {
  return SB.storage.from(VIDEO_BUCKET).getPublicUrl(storagePath).data.publicUrl;
}

export function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}

export function fmtTime(sec) {
  let s = Number.isFinite(sec) && sec > 0 ? sec : 0;
  const m = Math.floor(s / 60);
  s = Math.floor(s % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

// The TV only heartbeats its position every ~1s. Between beats, estimate where
// playback actually is so the remote's scrubber and the ±skip math work off a
// live number rather than a stale one.
export function estPosition(session) {
  if (!session) return 0;
  const base = Number(session.tv_position_sec) || 0;
  if (!session.playing) return base;
  const ageSec = (Date.now() - new Date(session.last_seen_at).getTime()) / 1000;
  if (!Number.isFinite(ageSec) || ageSec < 0 || ageSec > 5) return base;
  const est = base + ageSec * (Number(session.rate) || 1);
  const dur = Number(session.tv_duration_sec) || 0;
  return dur ? Math.min(est, dur) : est;
}

export function isConnected(session, side /* 'tv' | 'remote' */) {
  if (!session) return false;
  const age = Date.now() - new Date(session.last_seen_at).getTime();
  if (side === 'tv') return age < STALE_MS;
  // The remote has "arrived" once it has issued at least one intent write.
  return !!session.command_id;
}

// Remote -> session. Always bumps command_id so the TV re-applies even when a
// value (e.g. a repeat seek to the same spot) is unchanged from last time.
//
// seek_to_sec is a per-command target, not sticky state: unless THIS intent is
// itself a seek, it's cleared to null. Otherwise every command_id bump (rate,
// play, pause, loop…) would make the TV re-seek to the last seek point.
export async function sendRemoteIntent(sessionId, patch) {
  const update = { ...patch, command_id: crypto.randomUUID() };
  if (!('seek_to_sec' in patch)) update.seek_to_sec = null;
  const { error } = await SB.from('raider_tv_sessions')
    .update(update)
    .eq('id', sessionId);
  return { error };
}

// TV -> session. Status only; never bumps command_id (that would echo back to
// the remote as a fresh command and loop).
export async function sendTvStatus(sessionId, patch) {
  const { error } = await SB.from('raider_tv_sessions')
    .update({ ...patch, last_seen_at: new Date().toISOString() })
    .eq('id', sessionId);
  return { error };
}
