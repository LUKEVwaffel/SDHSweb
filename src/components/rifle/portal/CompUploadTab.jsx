import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase as SB } from '../../../lib/supabaseClient';
import { P, mono } from '../theme';
import { SectionLabel, Badge, EmptyState, DangerBtn, th, td } from './ui';
import ScoreImport from './import/ScoreImport.jsx';
import ReviewBatch from './import/ReviewBatch.jsx';
import { toDrafts } from './import/review.js';
import { discardUpload, uploadScoreRows, deleteUpload, matchScoreCount, deleteMatch } from './import/scoreImportApi.js';

// Comp Upload — the full-page home of the score import (the Scores Editor's
// IMPORT button opens the same ScoreImport in a modal). Kaz or Luke drop any
// spreadsheet / CSV / PDF / photo; tables with real headers are read
// deterministically in the browser, anything else falls back to Claude via
// the rifle-comp-parse edge function (which holds ANTHROPIC_API_KEY and
// enforces the Kaz/Luke allowlist server-side — `canUpload` here is UI).
// Every import leaves a rifle_comp_uploads record: pending ones (an AI read
// nobody published yet, or a publish that failed) are listed below for any
// rifle_admin to finish; published/discarded ones are the history.

function StatusBadge({ status }) {
  const tone = { pending_review: 'warn', published: 'win', discarded: 'mute' }[status] || 'mute';
  return <Badge tone={tone}>{status.replace('_', ' ')}</Badge>;
}

function batchFromUpload(u, rosterNames) {
  return {
    key: `u-${u.id}`, title: `${new Date(u.created_at).toLocaleString()} · ${u.uploaded_by}${u.draft?.source?.name ? ` · ${u.draft.source.name}` : ''}`,
    parser: u.draft?.source?.parser === 'sheet' ? 'sheet' : 'ai', status: 'review',
    drafts: toDrafts(u.draft?.rows || [], rosterNames),
    matchId: u.draft?.published_match_id || '', newMatch: { week: '', dates: '', opponent: '', location: '' },
    notes: u.draft?.notes || '', uploadId: u.id, uploadDraft: u.draft, rawText: u.raw_csv, source: u.draft?.source || null,
  };
}

export default function CompUploadTab({ canUpload = true, season }) {
  const [matches, setMatches] = useState([]);
  const [shooters, setShooters] = useState([]);
  const [uploads, setUploads] = useState([]);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [openId, setOpenId] = useState(null);
  const [pendingBatches, setPendingBatches] = useState({}); // uploadId → batch under review
  const [activeUploadIds, setActiveUploadIds] = useState(() => new Set());
  const [deletingId, setDeletingId] = useState(null);

  const load = useCallback(async () => {
    const [m, s, u] = await Promise.all([
      SB.from('rifle_matches').select('*').order('week', { ascending: false }),
      SB.from('rifle_shooters').select('id, name, active').order('name'),
      SB.from('rifle_comp_uploads').select('*').order('created_at', { ascending: false }).limit(30),
    ]);
    const firstErr = m.error || s.error || u.error;
    if (firstErr) setErr(firstErr.message);
    setMatches(m.data || []);
    setShooters(s.data || []);
    setUploads(u.data || []);
    // Build each pending upload's review batch once (stable draft keys);
    // ones already being edited keep their edits.
    const names = (s.data || []).map((x) => x.name);
    setPendingBatches((pb) => {
      const next = {};
      (u.data || []).filter((x) => x.status === 'pending_review').forEach((x) => { next[x.id] = pb[x.id] || batchFromUpload(x, names); });
      return next;
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  const rosterNames = useMemo(() => shooters.map((s) => s.name), [shooters]);
  // Uploads already open in the importer above shouldn't show twice.
  const onBatchesChange = useCallback((bs) => {
    setActiveUploadIds(new Set(bs.filter((b) => b.uploadId).map((b) => b.uploadId)));
  }, []);

  const pending = uploads.filter((u) => u.status === 'pending_review' && !activeUploadIds.has(u.id) && pendingBatches[u.id]);
  const history = uploads.filter((u) => u.status !== 'pending_review');

  function flash(msg) { setOk(msg); setTimeout(() => setOk(''), 3000); }

  function patchPending(u, patch) {
    setPendingBatches((pb) => (pb[u.id] ? { ...pb, [u.id]: { ...pb[u.id], ...patch } } : pb));
  }

  const matchLabel = (id) => {
    const m = matches.find((x) => x.id === id);
    return m ? `Week ${m.week}${m.opponent ? ` · ${m.opponent}` : ''}${m.dates ? ` (${m.dates})` : ''}` : 'a match';
  };

  // Delete = undo the import: its scores, then the record, then (asked
  // separately) any match the delete left with zero scores — e.g. the
  // duplicate "new match" a double-published upload created.
  async function removeUpload(u) {
    setErr('');
    setDeletingId(u.id);
    try {
      const rows = await uploadScoreRows(u.id);
      const matchIds = [...new Set(rows.map((r) => r.match_id))];
      const where = matchIds.map(matchLabel).join(', ');
      const ask = rows.length
        ? `Delete this upload AND the ${rows.length} score${rows.length === 1 ? '' : 's'} it wrote to ${where}?\n\nIf it overwrote scores that were already there, those are removed too (restore them from History).`
        : 'Delete this upload record? It has no scores on file.';
      if (!confirm(ask)) return;
      await deleteUpload(u.id, { removeScores: rows.length > 0 });
      let removedMatches = 0;
      for (const id of matchIds) {
        if ((await matchScoreCount(id)) === 0 && confirm(`${matchLabel(id)} has no scores left. Delete that match too?`)) {
          await deleteMatch(id);
          removedMatches++;
        }
      }
      if (openId === u.id) setOpenId(null);
      await load();
      flash(`Upload deleted${rows.length ? ` · ${rows.length} score${rows.length === 1 ? '' : 's'} removed` : ''}${removedMatches ? ` · ${removedMatches} empty match${removedMatches === 1 ? '' : 'es'} removed` : ''}`);
    } catch (e) {
      setErr(e.message);
      await load();
    } finally {
      setDeletingId(null);
    }
  }

  async function discard(u) {
    if (!confirm('Discard this upload? Nothing gets written to scores.')) return;
    try {
      await discardUpload(u.id);
      await load();
    } catch (e) {
      setErr(e.message);
    }
  }

  return (
    <div>
      <SectionLabel
        tag="// COMP UPLOAD"
        title="Score Sheet Import"
        sub="Drop any score sheet — spreadsheets and CSVs are read straight from their headers; PDFs, photos and messy text fall back to AI. Review every row before it publishes."
      />

      {err && <div role="alert" style={{ fontFamily: mono, fontSize: 12, color: P.red, marginBottom: 14 }}>{err}</div>}
      {ok && <div style={{ fontFamily: mono, fontSize: 12, color: P.win, marginBottom: 14 }}>{ok}</div>}

      {canUpload ? (
        <div style={{ marginBottom: 30 }}>
          <ScoreImport
            matches={matches} shooters={shooters} season={season} canUseAi
            onPublished={async (msg) => { await load(); flash(msg); }}
            onMatchCreated={() => load()}
            onBatchesChange={onBatchesChange}
          />
        </div>
      ) : (
        <div style={{ fontFamily: mono, fontSize: 12, color: P.mute, marginBottom: 28 }}>
          Only Kaz and Luke can start a new import — you can still finish, publish or discard pending uploads below.
        </div>
      )}

      <SectionLabel tag="// PENDING DRAFTS" sub={pending.length ? 'Started but never published — finish, or delete it.' : undefined} />
      {pending.length === 0 ? (
        <div style={{ marginBottom: 28 }}><EmptyState>No pending drafts.</EmptyState></div>
      ) : (
        <div style={{ marginBottom: 28 }}>
          {pending.map((u) => (
            <ReviewBatch
              key={u.id} batch={pendingBatches[u.id]} matches={matches} season={season} shooters={shooters} rosterNames={rosterNames}
              onChange={(patch) => patchPending(u, patch)}
              onMatchCreated={() => load()}
              onPublished={async (msg) => { await load(); flash(msg); }}
              onDiscard={() => (canUpload ? removeUpload(u) : discard(u))}
              discardLabel={canUpload ? 'DELETE' : 'DISCARD'}
            />
          ))}
        </div>
      )}

      <SectionLabel tag="// HISTORY" />
      {history.length === 0 ? (
        <EmptyState>No published or discarded uploads yet.</EmptyState>
      ) : history.map((u) => {
        const open = openId === u.id;
        const rows = u.draft?.rows || [];
        return (
          <div key={u.id} style={{ border: `1px solid ${P.hair}`, marginBottom: 8 }}>
            <button
              type="button" aria-expanded={open} onClick={() => setOpenId(open ? null : u.id)}
              style={{ width: '100%', textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer', padding: '11px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}
            >
              <span style={{ fontFamily: mono, fontSize: 12, color: P.cream }}>
                {new Date(u.created_at).toLocaleString()} · {u.uploaded_by}{u.draft?.source?.name ? ` · ${u.draft.source.name}` : ''} · {rows.length} rows
              </span>
              <StatusBadge status={u.status} />
            </button>
            {open && (
              <div style={{ padding: '0 14px 14px', overflowX: 'auto' }}>
                {u.draft?.notes && <div style={{ fontFamily: mono, fontSize: 11, color: P.mute, marginBottom: 10, fontStyle: 'italic' }}>{u.draft.notes}</div>}
                {canUpload && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
                    <span style={{ fontFamily: mono, fontSize: 10, color: P.faint }}>
                      {u.status === 'published' ? 'Deleting removes this upload and the scores it published.' : 'Deleting removes this record.'}
                    </span>
                    <DangerBtn onClick={() => removeUpload(u)} disabled={deletingId === u.id}>{deletingId === u.id ? 'DELETING…' : 'DELETE UPLOAD'}</DangerBtn>
                  </div>
                )}
                <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: mono, fontSize: 12 }}>
                  <thead>
                    <tr>{['On sheet', 'Shooter', 'Prone', 'Standing', 'Kneeling', 'Total', 'X'].map((h) => <th key={h} style={th()}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i}>
                        <td style={{ ...td(), color: P.faint }}>{r.raw_name}</td>
                        <td style={td()}>{r.matched_shooter_name || r.raw_name}</td>
                        {['prone', 'standing', 'kneeling', 'total', 'bulls'].map((f) => <td key={f} style={td()}>{r[f] ?? '—'}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
