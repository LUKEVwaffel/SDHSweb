import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase as SB } from '../../../../lib/supabaseClient';
import { P, mono, oswald, fs, sp } from '../../theme';
import { Btn, Card, Label, PanelHeader, EmptyState } from '../../shared/ui';
import { COMP_POLL_EVENT_ID, COMP_POLL_EVENT_TITLE } from '../../../../lib/compPhotoVote';

// DISPATCH → Photos → PICTURE OF THE COMP. Luke sifts his Rhea County comp set
// and marks up to 15 finalists for the public /vote ballot, then opens voting
// with a close time (default: this Friday 20:00), watches the tally, and
// declares the winner (which publishes it to the home band + /tv congrats).
//
// Sifting is the slow part, so two modes:
//   GRID   — click a photo to toggle it on/off the ballot (optimistic, no
//            reload), corner button opens REVIEW at that photo.
//   REVIEW — one big photo, keyboard driven: ←/→ move, Space or A toggles the
//            ballot, Esc back to the grid.
// Filters (sub-event, team, hide-picked, sort) narrow the pool first.
//
// All writes are plain table DML gated by is_admin() RLS
// (supabase/comp_photo_vote.sql) — same trust model as RaiderPolls.jsx.

const MAX_CANDIDATES = 15;
const TEAM_LABEL = { male: 'Male', coed: 'Coed', both: 'Both' };

function nextFridayAt2000() {
  const d = new Date();
  let add = (5 - d.getDay() + 7) % 7;          // 5 = Friday
  if (add === 0 && d.getHours() >= 20) add = 7;
  d.setDate(d.getDate() + add);
  d.setHours(20, 0, 0, 0);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toLocalInput(iso) {
  const dt = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

const subName = (ph) => ph.raider_sub_events?.name?.trim() || null;

export default function CompPhotoBallot() {
  const [poll, setPoll] = useState(null);
  const [pool, setPool] = useState([]);            // Luke's Rhea comp photos
  const [candById, setCandById] = useState({});    // photo_id -> candidate row
  const [closesInput, setClosesInput] = useState(nextFridayAt2000());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);         // poll-level actions only
  const [msg, setMsg] = useState('');

  // sifting UI state
  const [view, setView] = useState('grid');        // 'grid' | 'review'
  const [reviewIdx, setReviewIdx] = useState(0);
  const [fSub, setFSub] = useState('all');         // 'all' | sub_event_id | 'none'
  const [fTeam, setFTeam] = useState('all');       // 'all' | 'male' | 'coed' | 'both'
  const [hidePicked, setHidePicked] = useState(false);
  const [sortNewest, setSortNewest] = useState(true);

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 3500); };
  const candCountRef = useRef(0);

  const load = useCallback(async () => {
    const [{ data: pollRow }, { data: photos }] = await Promise.all([
      SB.from('comp_photo_polls').select('*').order('created_at', { ascending: false }).limit(1).maybeSingle(),
      SB.from('photos')
        .select('id, photo_url, thumb_url, uploader_name, created_at, raider_team, sub_event_id, raider_sub_events(name)')
        .eq('event_id', COMP_POLL_EVENT_ID)
        .eq('source', 'luke')
        .eq('status', 'live')
        .order('created_at', { ascending: false }),
    ]);
    setPoll(pollRow || null);
    setPool(photos || []);

    if (pollRow) {
      const { data: cands } = await SB.from('comp_photo_candidates').select('*').eq('poll_id', pollRow.id);
      setCandById(Object.fromEntries((cands || []).map((c) => [c.photo_id, c])));
      if (pollRow.closes_at) setClosesInput(toLocalInput(pollRow.closes_at));
    } else {
      setCandById({});
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const candidateCount = Object.keys(candById).length;
  candCountRef.current = candidateCount;
  const status = poll?.status || 'none';
  const locked = status === 'open' || status === 'closed'; // no ballot edits once live

  // ── sub-event options for the filter bar ────────────────────────────────
  const subOptions = useMemo(() => {
    const map = new Map();
    let hasUntagged = false;
    for (const ph of pool) {
      if (ph.sub_event_id && subName(ph)) map.set(ph.sub_event_id, subName(ph));
      else hasUntagged = true;
    }
    const opts = [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
    return { opts, hasUntagged };
  }, [pool]);

  // ── the filtered / sorted working set ──────────────────────────────────
  const filtered = useMemo(() => {
    let list = pool;
    if (fSub === 'none') list = list.filter((p) => !p.sub_event_id);
    else if (fSub !== 'all') list = list.filter((p) => p.sub_event_id === fSub);
    if (fTeam !== 'all') list = list.filter((p) => (p.raider_team || '') === fTeam);
    if (hidePicked) list = list.filter((p) => !candById[p.id]);
    list = [...list].sort((a, b) => {
      const d = new Date(a.created_at) - new Date(b.created_at);
      return sortNewest ? -d : d;
    });
    return list;
  }, [pool, fSub, fTeam, hidePicked, sortNewest, candById]);

  // keep the review cursor in range when the filter changes
  useEffect(() => {
    setReviewIdx((i) => Math.min(i, Math.max(0, filtered.length - 1)));
  }, [filtered.length]);

  const ensurePoll = useCallback(async () => {
    if (poll) return poll;
    const { data, error } = await SB.from('comp_photo_polls')
      .insert({ event_id: COMP_POLL_EVENT_ID, title: 'Picture of the Comp', status: 'draft' })
      .select('*').single();
    if (error) { flash(`Create failed: ${error.message}`); return null; }
    setPoll(data);
    return data;
  }, [poll]);

  // ── optimistic add/remove from the ballot ─────────────────────────────
  const toggleCandidate = useCallback(async (photo) => {
    if (locked) { flash('Ballot is locked — close voting to change photos.'); return; }
    const existing = candById[photo.id];

    if (existing) {
      setCandById((m) => { const n = { ...m }; delete n[photo.id]; return n; });
      const p = poll || (await ensurePoll());
      if (!p) return;
      if (!String(existing.id).startsWith('tmp_')) {
        const { error } = await SB.from('comp_photo_candidates').delete().eq('id', existing.id);
        if (error) { setCandById((m) => ({ ...m, [photo.id]: existing })); flash(`Remove failed: ${error.message}`); }
      }
      return;
    }

    if (candCountRef.current >= MAX_CANDIDATES) { flash(`Max ${MAX_CANDIDATES} photos — remove one first.`); return; }
    const tmp = { id: `tmp_${photo.id}`, photo_id: photo.id, sort_order: candCountRef.current, vote_count: 0 };
    setCandById((m) => ({ ...m, [photo.id]: tmp }));
    const p = poll || (await ensurePoll());
    if (!p) { setCandById((m) => { const n = { ...m }; delete n[photo.id]; return n; }); return; }
    const { data, error } = await SB.from('comp_photo_candidates')
      .insert({ poll_id: p.id, photo_id: photo.id, sort_order: tmp.sort_order })
      .select('*').single();
    if (error) { setCandById((m) => { const n = { ...m }; delete n[photo.id]; return n; }); flash(`Add failed: ${error.message}`); }
    else setCandById((m) => ({ ...m, [photo.id]: data }));
  }, [locked, candById, poll, ensurePoll]);

  // ── keyboard for review mode ─────────────────────────────────────────
  useEffect(() => {
    if (view !== 'review') return undefined;
    const onKey = (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); setReviewIdx((i) => Math.min(i + 1, filtered.length - 1)); }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); setReviewIdx((i) => Math.max(i - 1, 0)); }
      else if (e.key === ' ' || e.key.toLowerCase() === 'a') { e.preventDefault(); const ph = filtered[reviewIdx]; if (ph) toggleCandidate(ph); }
      else if (e.key === 'Escape') { setView('grid'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view, filtered, reviewIdx, toggleCandidate]);

  // ── poll lifecycle ──────────────────────────────────────────────────
  async function openVoting() {
    if (candidateCount < 2) { flash('Pick at least 2 photos first.'); return; }
    setBusy(true);
    const p = await ensurePoll();
    if (p) {
      const iso = closesInput ? new Date(closesInput).toISOString() : null;
      const { data, error } = await SB.from('comp_photo_polls')
        .update({ status: 'open', opens_at: new Date().toISOString(), closes_at: iso, winner_candidate_id: null })
        .eq('id', p.id).select('*').single();
      if (error) flash(`Open failed: ${error.message}`);
      else { setPoll(data); flash('Voting is open.'); }
    }
    setBusy(false);
  }

  async function updateCloses() {
    if (!poll) return;
    setBusy(true);
    const iso = closesInput ? new Date(closesInput).toISOString() : null;
    const { data, error } = await SB.from('comp_photo_polls').update({ closes_at: iso }).eq('id', poll.id).select('*').single();
    if (error) flash(`Update failed: ${error.message}`); else { setPoll(data); flash('Close time updated.'); }
    setBusy(false);
  }

  async function closeNow() {
    if (!poll || !window.confirm('Close voting now? Voters can no longer submit.')) return;
    setBusy(true);
    const { data, error } = await SB.from('comp_photo_polls').update({ status: 'closed' }).eq('id', poll.id).select('*').single();
    if (error) flash(`Close failed: ${error.message}`); else { setPoll(data); flash('Voting closed.'); }
    setBusy(false);
  }

  async function reopen() {
    if (!poll) return;
    setBusy(true);
    const { data, error } = await SB.from('comp_photo_polls').update({ status: 'open', winner_candidate_id: null }).eq('id', poll.id).select('*').single();
    if (error) flash(`Reopen failed: ${error.message}`); else { setPoll(data); flash('Voting reopened.'); }
    setBusy(false);
  }

  async function declareWinner(candidateId) {
    if (!poll) return;
    const isChange = !!poll.winner_candidate_id;
    if (!window.confirm(isChange
      ? 'Change the declared winner? This updates the home page and TVs.'
      : 'Declare this photo the winner? It publishes to the home page and the JROTC TV.')) return;
    setBusy(true);
    const { data, error } = await SB.from('comp_photo_polls').update({ winner_candidate_id: candidateId }).eq('id', poll.id).select('*').single();
    if (error) flash(`Declare failed: ${error.message}`); else { setPoll(data); flash('Winner published.'); }
    setBusy(false);
  }

  if (loading) {
    return <div style={{ fontFamily: mono, fontSize: fs.xs, color: P.mute, textAlign: 'center', marginTop: sp[10] }}>LOADING…</div>;
  }
  if (!pool.length) {
    return (
      <EmptyState icon="◱" title="NO COMP PHOTOS FOUND"
        hint={`No live photos tagged to ${COMP_POLL_EVENT_TITLE} from Luke. Upload the comp set first, then pick the ballot here.`} />
    );
  }

  const picked = Object.values(candById).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const photoById = Object.fromEntries(pool.map((p) => [p.id, p]));
  const rankedCands = Object.values(candById).sort((a, b) => (b.vote_count ?? 0) - (a.vote_count ?? 0));
  const totalVotes = rankedCands.reduce((s, c) => s + (c.vote_count ?? 0), 0);
  const capReached = candidateCount >= MAX_CANDIDATES;

  return (
    <div>
      <PanelHeader
        title="PICTURE OF THE COMP"
        sub={`${COMP_POLL_EVENT_TITLE} · public vote at /vote`}
        action={<Btn onClick={load} variant="ghost" size="sm">↺ REFRESH</Btn>}
      />
      {msg && <div style={{ fontFamily: mono, fontSize: fs.tiny, color: P.gold, margin: `${sp[2]}px 0 ${sp[4]}px` }}>{msg}</div>}

      {/* ── Poll controls ─────────────────────────────────────────────── */}
      <Card style={{ marginBottom: sp[4] }}>
        <div style={{ display: 'flex', gap: sp[5], flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <Label>Status</Label>
            <div style={{ fontFamily: oswald, fontSize: fs.lg, letterSpacing: '0.06em',
              color: status === 'open' ? P.green : status === 'closed' ? P.bright : P.mute }}>
              {status === 'open' ? 'VOTING LIVE' : status === 'closed' ? 'VOTING CLOSED' : status === 'draft' ? 'DRAFT' : 'NOT CREATED'}
            </div>
          </div>
          <div>
            <Label>On ballot</Label>
            <div style={{ fontFamily: oswald, fontSize: fs.lg, color: capReached ? P.green : P.cream }}>
              {candidateCount} / {MAX_CANDIDATES}
            </div>
          </div>
          <div>
            <Label>Closes at</Label>
            <input type="datetime-local" value={closesInput} onChange={(e) => setClosesInput(e.target.value)}
              style={{ background: P.deep, border: `1px solid ${P.hair}`, color: P.cream, fontFamily: mono, fontSize: fs.xs, padding: '9px 11px', borderRadius: 5, colorScheme: 'dark' }} />
          </div>
          <div style={{ display: 'flex', gap: sp[2], marginLeft: 'auto', flexWrap: 'wrap' }}>
            {status !== 'open' && <Btn onClick={openVoting} variant="green" size="sm" disabled={busy}>{status === 'closed' ? 'RE-OPEN + NEW CLOSE' : 'OPEN VOTING'}</Btn>}
            {status === 'open' && <>
              <Btn onClick={updateCloses} variant="ghost" size="sm" disabled={busy}>SAVE CLOSE TIME</Btn>
              <Btn onClick={closeNow} variant="danger" size="sm" disabled={busy}>CLOSE NOW</Btn>
            </>}
            {status === 'closed' && <Btn onClick={reopen} variant="ghost" size="sm" disabled={busy}>REOPEN</Btn>}
          </div>
        </div>
        {locked && (
          <div style={{ fontFamily: mono, fontSize: fs.micro, color: P.mute, marginTop: sp[3] }}>
            Ballot photos are locked while voting is open or closed. Use CLOSE NOW, then edit to swap a photo.
          </div>
        )}
      </Card>

      {/* ── Live tally (once there are votes) ────────────────────────── */}
      {rankedCands.length > 0 && (status === 'open' || status === 'closed') && (
        <Card style={{ marginBottom: sp[4] }}>
          <Label>Tally · {totalVotes} vote{totalVotes === 1 ? '' : 's'}{status === 'open' ? ' (live)' : ''}</Label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: sp[3], marginTop: sp[3] }}>
            {rankedCands.map((c, i) => {
              const ph = photoById[c.photo_id];
              const isWinner = poll?.winner_candidate_id === c.id;
              return (
                <div key={c.id} style={{ border: `1px solid ${isWinner ? P.gold : P.hair}`, background: P.deep }}>
                  <div style={{ position: 'relative', aspectRatio: '1 / 1', overflow: 'hidden' }}>
                    {ph && <img src={ph.thumb_url || ph.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                    <span style={{ position: 'absolute', top: 6, left: 6, background: 'rgba(6,16,31,0.8)', color: P.cream, fontFamily: mono, fontSize: 9, padding: '2px 6px' }}>#{i + 1}</span>
                    {isWinner && <span style={{ position: 'absolute', top: 6, right: 6, background: P.gold, color: P.ink, fontFamily: mono, fontSize: 9, padding: '2px 6px' }}>WINNER</span>}
                  </div>
                  <div style={{ padding: `${sp[2]}px ${sp[3]}px`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontFamily: oswald, fontSize: fs.md, color: P.cream }}>{c.vote_count ?? 0}</span>
                    <Btn onClick={() => declareWinner(c.id)} variant={isWinner ? 'gold' : 'ghost'} size="sm" disabled={busy}>{isWinner ? 'WINNER' : 'DECLARE'}</Btn>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* ── Ballot tray ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: sp[3], marginBottom: sp[2], flexWrap: 'wrap' }}>
        <Label style={{ margin: 0 }}>On the ballot — {candidateCount}/{MAX_CANDIDATES}</Label>
        {!locked && candidateCount > 0 && (
          <span style={{ fontFamily: mono, fontSize: fs.micro, color: P.mute }}>tap a photo to remove it</span>
        )}
      </div>
      <div style={{
        display: 'flex', gap: sp[2], overflowX: 'auto', padding: `${sp[2]}px`,
        background: P.deep, border: `1px solid ${P.hair}`, borderRadius: 6, minHeight: 84, marginBottom: sp[4],
      }}>
        {picked.length === 0 && (
          <div style={{ fontFamily: mono, fontSize: fs.tiny, color: P.mute, alignSelf: 'center', padding: `0 ${sp[3]}px` }}>
            Nothing picked yet — click photos below.
          </div>
        )}
        {picked.map((c) => {
          const ph = photoById[c.photo_id];
          if (!ph) return null;
          return (
            <button key={c.id} type="button" onClick={() => !locked && toggleCandidate(ph)} disabled={locked}
              title={locked ? '' : 'Remove from ballot'}
              style={{ flexShrink: 0, width: 68, height: 68, padding: 0, border: `1px solid ${P.gold}`, background: P.navy, cursor: locked ? 'default' : 'pointer', position: 'relative' }}>
              <img src={ph.thumb_url || ph.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              {!locked && <span style={{ position: 'absolute', top: -1, right: -1, background: P.red, color: '#fff', fontFamily: mono, fontSize: 10, lineHeight: 1, padding: '2px 4px' }}>×</span>}
            </button>
          );
        })}
      </div>

      {/* ── Filter / view bar ──────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: sp[2], flexWrap: 'wrap', alignItems: 'center', marginBottom: sp[3] }}>
        <PillGroup
          label="EVENT"
          value={fSub}
          onChange={setFSub}
          options={[
            { v: 'all', l: `All (${pool.length})` },
            ...subOptions.opts.map(([id, name]) => ({ v: id, l: name })),
            ...(subOptions.hasUntagged ? [{ v: 'none', l: 'Untagged' }] : []),
          ]}
        />
        <PillGroup
          label="TEAM"
          value={fTeam}
          onChange={setFTeam}
          options={[{ v: 'all', l: 'All' }, { v: 'male', l: 'Male' }, { v: 'coed', l: 'Coed' }, { v: 'both', l: 'Both' }]}
        />
        <Btn variant={hidePicked ? 'gold' : 'ghost'} size="sm" onClick={() => setHidePicked((v) => !v)}>
          {hidePicked ? '✓ HIDING PICKED' : 'HIDE PICKED'}
        </Btn>
        <Btn variant="ghost" size="sm" onClick={() => setSortNewest((v) => !v)}>
          {sortNewest ? 'NEWEST FIRST' : 'OLDEST FIRST'}
        </Btn>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: sp[2] }}>
          <Btn variant={view === 'grid' ? 'gold' : 'ghost'} size="sm" onClick={() => setView('grid')}>GRID</Btn>
          <Btn variant={view === 'review' ? 'gold' : 'ghost'} size="sm" onClick={() => { setView('review'); }}>REVIEW ONE-BY-ONE</Btn>
        </div>
      </div>
      <div style={{ fontFamily: mono, fontSize: fs.micro, color: P.mute, marginBottom: sp[3] }}>
        {filtered.length} shown{fSub !== 'all' || fTeam !== 'all' || hidePicked ? ' (filtered)' : ''}
        {view === 'review' && ' · ←/→ move · Space or A = add/remove · Esc = grid'}
      </div>

      {/* ── REVIEW ─────────────────────────────────────────────────── */}
      {view === 'review' && (
        filtered.length === 0
          ? <EmptyState icon="◦" title="NOTHING TO REVIEW" hint="Loosen the filters above." />
          : <ReviewPane
              photo={filtered[reviewIdx]}
              idx={reviewIdx}
              total={filtered.length}
              onName={subName}
              on={!!candById[filtered[reviewIdx]?.id]}
              locked={locked}
              capReached={capReached}
              onPrev={() => setReviewIdx((i) => Math.max(i - 1, 0))}
              onNext={() => setReviewIdx((i) => Math.min(i + 1, filtered.length - 1))}
              onToggle={() => toggleCandidate(filtered[reviewIdx])}
            />
      )}

      {/* ── GRID ───────────────────────────────────────────────────── */}
      {view === 'grid' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: sp[2] }}>
          {filtered.map((ph, i) => {
            const on = !!candById[ph.id];
            const blockAdd = !on && capReached;
            return (
              <div key={ph.id} style={{ position: 'relative', border: `2px solid ${on ? P.gold : 'transparent'}`, outline: on ? 'none' : `1px solid ${P.hair}`, background: P.navy }}>
                <button
                  type="button"
                  onClick={() => toggleCandidate(ph)}
                  disabled={locked || blockAdd}
                  title={locked ? 'Locked while voting is open/closed' : blockAdd ? 'Ballot full' : on ? 'Remove from ballot' : 'Add to ballot'}
                  style={{
                    display: 'block', width: '100%', aspectRatio: '1 / 1', padding: 0, border: 'none',
                    background: 'transparent', cursor: locked || blockAdd ? 'not-allowed' : 'pointer',
                    opacity: locked || blockAdd ? 0.45 : 1,
                  }}
                >
                  <img src={ph.thumb_url || ph.photo_url} alt="" loading="lazy"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                </button>
                {on && (
                  <span style={{ position: 'absolute', top: 5, left: 5, background: P.gold, color: P.ink, fontFamily: mono, fontSize: 8, letterSpacing: '0.06em', padding: '2px 6px' }}>ON BALLOT</span>
                )}
                {(subName(ph) || ph.raider_team) && (
                  <span style={{ position: 'absolute', bottom: 5, left: 5, right: 28, background: 'rgba(6,16,31,0.78)', color: P.mute, fontFamily: mono, fontSize: 8, letterSpacing: '0.04em', padding: '2px 5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {[subName(ph), TEAM_LABEL[ph.raider_team]].filter(Boolean).join(' · ')}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => { setReviewIdx(i); setView('review'); }}
                  title="Open in review"
                  style={{ position: 'absolute', bottom: 4, right: 4, width: 22, height: 22, lineHeight: 1, border: `1px solid ${P.hairStrong}`, background: 'rgba(6,16,31,0.8)', color: P.gold, fontFamily: mono, fontSize: 12, cursor: 'pointer' }}
                >⤢</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── filter pill group ──────────────────────────────────────────────────
function PillGroup({ label, value, onChange, options }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: sp[1], flexWrap: 'wrap' }}>
      <span style={{ fontFamily: mono, fontSize: fs.micro, color: P.gold, letterSpacing: '0.16em', marginRight: 2 }}>{label}</span>
      {options.map((o) => {
        const on = value === o.v;
        return (
          <button key={o.v} type="button" onClick={() => onChange(o.v)}
            style={{
              fontFamily: mono, fontSize: fs.micro, letterSpacing: '0.06em',
              padding: '6px 10px', cursor: 'pointer', borderRadius: 4,
              background: on ? P.gold : 'transparent', color: on ? P.ink : P.mute,
              border: `1px solid ${on ? P.gold : P.hair}`,
            }}>
            {o.l}
          </button>
        );
      })}
    </div>
  );
}

// ── one-at-a-time review pane ─────────────────────────────────────────
function ReviewPane({ photo, idx, total, onName, on, locked, capReached, onPrev, onNext, onToggle }) {
  if (!photo) return null;
  const blockAdd = !on && capReached;
  return (
    <div style={{ border: `1px solid ${P.hair}`, background: P.deep, borderRadius: 6, padding: sp[3] }}>
      <div style={{ position: 'relative', width: '100%', height: 'min(62vh, 640px)', background: P.ink, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <img src={photo.photo_url || photo.thumb_url} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block' }} />
        {on && <span style={{ position: 'absolute', top: 10, left: 10, background: P.gold, color: P.ink, fontFamily: mono, fontSize: 10, letterSpacing: '0.08em', padding: '4px 8px' }}>ON BALLOT</span>}
        <button type="button" onClick={onPrev} disabled={idx === 0} aria-label="Previous"
          style={{ position: 'absolute', left: 6, top: '50%', transform: 'translateY(-50%)', width: 40, height: 56, border: `1px solid ${P.hairStrong}`, background: 'rgba(6,16,31,0.72)', color: P.gold, fontFamily: oswald, fontSize: 26, cursor: idx === 0 ? 'default' : 'pointer', opacity: idx === 0 ? 0.35 : 1 }}>‹</button>
        <button type="button" onClick={onNext} disabled={idx >= total - 1} aria-label="Next"
          style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', width: 40, height: 56, border: `1px solid ${P.hairStrong}`, background: 'rgba(6,16,31,0.72)', color: P.gold, fontFamily: oswald, fontSize: 26, cursor: idx >= total - 1 ? 'default' : 'pointer', opacity: idx >= total - 1 ? 0.35 : 1 }}>›</button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: sp[4], marginTop: sp[3], flexWrap: 'wrap' }}>
        <span style={{ fontFamily: mono, fontSize: fs.sm, color: P.cream }}>{idx + 1} / {total}</span>
        <span style={{ fontFamily: mono, fontSize: fs.micro, color: P.mute, letterSpacing: '0.1em' }}>
          {[onName(photo), TEAM_LABEL[photo.raider_team]].filter(Boolean).join(' · ') || 'untagged'}
        </span>
        <div style={{ marginLeft: 'auto' }}>
          <Btn
            variant={on ? 'gold' : 'green'}
            size="md"
            onClick={onToggle}
            disabled={locked || blockAdd}
          >
            {locked ? 'LOCKED' : on ? '✓ ON BALLOT — REMOVE' : blockAdd ? 'BALLOT FULL' : 'ADD TO BALLOT  (Space)'}
          </Btn>
        </div>
      </div>
    </div>
  );
}
