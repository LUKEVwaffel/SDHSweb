import { supabase as SB } from './supabaseClient';
import { RHEA_EVENT_ID, RHEA_EVENT_TITLE } from './rheaComp';

// ── "Picture of the Comp" single-winner vote — shared data helpers ─────────
// Public ballot at /vote (components/CompPhotoVote.jsx), managed in DISPATCH
// (admin/panels/photos/CompPhotoBallot.jsx). Backed by supabase/comp_photo_vote.sql:
//   comp_photo_polls / comp_photo_candidates / comp_photo_votes
// One poll for the Rhea County comp; Luke picks ~15 finalist photos, the
// public picks one (name required), the winner is declared in DISPATCH and
// then shows on the home page + the /tv congrats screen.

export const COMP_POLL_EVENT_ID = RHEA_EVENT_ID;
export const COMP_POLL_EVENT_TITLE = RHEA_EVENT_TITLE;

/** localStorage key for "this device already voted", scoped to the poll id so
 *  a fresh poll next comp re-opens voting on every device. */
const votedKey = (pollId) => `tb_comp_vote_done_${pollId || 'none'}`;

export function hasVotedComp(pollId) {
  try { return localStorage.getItem(votedKey(pollId)) === '1'; } catch { return false; }
}
export function markVotedComp(pollId) {
  try { localStorage.setItem(votedKey(pollId), '1'); } catch { /* private mode */ }
}

/**
 * The active poll (most recent row) plus its candidate photos, each joined to
 * its public.photos row and carrying the denormalized vote_count. Candidates
 * are returned in ballot order (sort_order, then created_at).
 * @returns {Promise<{ poll: object|null, candidates: object[], error: string|null }>}
 */
export async function fetchCompPoll() {
  const { data: poll, error: pollErr } = await SB
    .from('comp_photo_polls')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (pollErr) return { poll: null, candidates: [], error: pollErr.message };
  if (!poll) return { poll: null, candidates: [], error: null };

  const { data: rows, error: candErr } = await SB
    .from('comp_photo_candidates')
    .select('id, poll_id, photo_id, sort_order, vote_count, created_at, photos(id, photo_url, thumb_url, uploader_name)')
    .eq('poll_id', poll.id)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (candErr) return { poll, candidates: [], error: candErr.message };

  const candidates = (rows || []).map((r) => ({
    id: r.id,
    pollId: r.poll_id,
    photoId: r.photo_id,
    sortOrder: r.sort_order,
    voteCount: r.vote_count,
    photoUrl: r.photos?.photo_url || null,
    thumbUrl: r.photos?.thumb_url || r.photos?.photo_url || null,
    uploaderName: r.photos?.uploader_name || null,
  }));

  return { poll, candidates, error: null };
}

/** True when the poll is accepting votes right now. */
export function isPollOpen(poll, now = Date.now()) {
  if (!poll || poll.status !== 'open') return false;
  if (poll.closes_at && now >= new Date(poll.closes_at).getTime()) return false;
  return true;
}

/** True when voting is over (explicitly closed, or past the deadline). */
export function isPollClosed(poll, now = Date.now()) {
  if (!poll) return false;
  if (poll.status === 'closed') return true;
  if (poll.status === 'open' && poll.closes_at && now >= new Date(poll.closes_at).getTime()) return true;
  return false;
}

/** The declared winning candidate row, or null if none has been declared. */
export function deriveWinner(poll, candidates) {
  if (!poll?.winner_candidate_id) return null;
  return candidates.find((c) => c.id === poll.winner_candidate_id) || null;
}

/** Candidates sorted best-first by vote count (ties broken by ballot order). */
export function rankedCandidates(candidates) {
  return [...candidates].sort((a, b) => b.voteCount - a.voteCount || a.sortOrder - b.sortOrder);
}

/**
 * Cast one vote. Server enforces: poll open, not past deadline, name present,
 * one row per (poll, device_fp).
 * @returns {Promise<{ ok: boolean, error: string|null }>}
 */
export async function castCompVote({ pollId, candidateId, name, deviceFp }) {
  const { error } = await SB.rpc('cast_comp_photo_vote', {
    p_poll: pollId,
    p_candidate: candidateId,
    p_name: (name || '').trim(),
    p_fp: deviceFp || null,
  });
  if (error) return { ok: false, error: error.message || 'Vote failed' };
  return { ok: true, error: null };
}
