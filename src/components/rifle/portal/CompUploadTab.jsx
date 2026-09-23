import { useState, useEffect, useCallback } from 'react';
import { supabase as SB } from '../../../lib/supabaseClient';
import { P, mono } from '../theme';
import { SectionLabel, Card, Badge, PrimaryBtn, GhostBtn, DangerBtn, EmptyState, th, td } from './ui';

// Comp Upload — Kaz or Luke pastes a match's raw score sheet, Claude
// extracts structured per-shooter rows (rifle-comp-parse edge function,
// since it needs the ANTHROPIC_API_KEY secret — that function also enforces
// the Kaz/Luke-only gate server-side, `canUpload` here is just UI). Any
// rifle_admin can then review/edit the draft and publish. Publish itself is
// a plain client-side write: rifle_scores' RLS (is_rifle_admin() or is_s6())
// is the whole access gate, same as RosterTab.jsx — no edge function needed
// for it.
const inputStyle = { background: P.deep, border: `1px solid ${P.hair}`, color: P.cream, fontFamily: mono, fontSize: 13, padding: '9px 11px', outline: 'none' };
const label = { fontFamily: mono, fontSize: 11, color: P.gold, letterSpacing: '0.1em', marginBottom: 6 };
const numInput = { ...inputStyle, width: 72, textAlign: 'center' };

function StatusBadge({ status }) {
  const tone = { pending_review: 'warn', published: 'win', discarded: 'mute' }[status] || 'mute';
  return <Badge tone={tone}>{status.replace('_', ' ')}</Badge>;
}

export default function CompUploadTab({ canUpload = true }) {
  const [matches, setMatches] = useState([]);
  const [matchId, setMatchId] = useState('');
  const [newMatch, setNewMatch] = useState({ week: '', dates: '', opponent: '', location: '' });
  const [shooters, setShooters] = useState([]);
  const [uploads, setUploads] = useState([]);
  const [csv, setCsv] = useState('');
  const [parsing, setParsing] = useState(false);
  const [err, setErr] = useState('');
  const [openUploadId, setOpenUploadId] = useState(null);
  const [draftEdits, setDraftEdits] = useState({}); // uploadId -> edited rows array

  const load = useCallback(async () => {
    const [{ data: m }, { data: s }, { data: u }] = await Promise.all([
      SB.from('rifle_matches').select('*').order('week', { ascending: false }),
      SB.from('rifle_shooters').select('id, name').order('name'),
      SB.from('rifle_comp_uploads').select('*').order('created_at', { ascending: false }).limit(20),
    ]);
    setMatches(m || []);
    setShooters(s || []);
    setUploads(u || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function addMatch() {
    if (!newMatch.week.trim()) { setErr('Week number is required for a new match.'); return; }
    setErr('');
    const { data, error } = await SB.from('rifle_matches').insert({
      week: Number(newMatch.week), dates: newMatch.dates.trim() || null,
      opponent: newMatch.opponent.trim() || null, location: newMatch.location.trim() || null,
    }).select('*').single();
    if (error) { setErr(error.message); return; }
    setNewMatch({ week: '', dates: '', opponent: '', location: '' });
    await load();
    setMatchId(data.id);
  }

  async function parse() {
    if (!matchId) { setErr('Pick (or add) the match this score sheet is for.'); return; }
    if (!csv.trim()) { setErr('Paste the raw score sheet first.'); return; }
    setParsing(true); setErr('');
    const { data, error } = await SB.functions.invoke('rifle-comp-parse', { body: { raw_csv: csv } });
    setParsing(false);
    if (error || data?.error) { setErr(`Failed: ${data?.error || error.message}`); return; }
    setCsv('');
    await load();
    setOpenUploadId(data.upload.id);
  }

  function rowsFor(upload) {
    return draftEdits[upload.id] || upload.draft?.rows || [];
  }

  function editRow(upload, idx, field, value) {
    const rows = rowsFor(upload).map((r, i) => (i === idx ? { ...r, [field]: value } : r));
    setDraftEdits((d) => ({ ...d, [upload.id]: rows }));
  }

  async function publish(upload) {
    const rows = rowsFor(upload);
    if (!matchId) { setErr('Pick which match to publish these scores into.'); return; }
    setErr('');
    try {
      for (const row of rows) {
        const name = (row.matched_shooter_name || row.raw_name || '').trim();
        if (!name) continue;
        let shooter = shooters.find((s) => s.name.toLowerCase() === name.toLowerCase());
        if (!shooter) {
          const { data: created, error: createErr } = await SB.from('rifle_shooters').insert({ name }).select('id, name').single();
          if (createErr) throw createErr;
          shooter = created;
          setShooters((s) => [...s, created]);
        }
        const scoreRow = {
          shooter_id: shooter.id, match_id: matchId, upload_id: upload.id,
          prone: row.prone ?? null, standing: row.standing ?? null, kneeling: row.kneeling ?? null,
          total: row.total ?? null, bulls: row.bulls ?? null,
        };
        const { error: scoreErr } = await SB.from('rifle_scores').upsert(scoreRow, { onConflict: 'shooter_id,match_id' });
        if (scoreErr) throw scoreErr;
      }
      const { error: upErr } = await SB.from('rifle_comp_uploads').update({
        status: 'published', published_at: new Date().toISOString(), draft: { rows },
      }).eq('id', upload.id);
      if (upErr) throw upErr;
      await load();
      setOpenUploadId(null);
    } catch (e) {
      setErr(`Failed: ${e.message}`);
    }
  }

  async function discard(upload) {
    if (!confirm('Discard this upload? The AI draft is lost, nothing gets written to scores.')) return;
    const { error } = await SB.from('rifle_comp_uploads').update({ status: 'discarded' }).eq('id', upload.id);
    if (error) { setErr(error.message); return; }
    await load();
    setOpenUploadId(null);
  }

  return (
    <div>
      <SectionLabel tag="// COMP UPLOAD · AI PARSE" title="Score Sheet Upload" sub="Paste a raw match score sheet — Claude extracts per-shooter rows for review before publishing." />

      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 10 }}>
        <div>
          <div style={label}>MATCH</div>
          <select value={matchId} onChange={(e) => setMatchId(e.target.value)} style={{ ...inputStyle, minWidth: 220 }}>
            <option value="">Select a match&hellip;</option>
            {matches.map((m) => (
              <option key={m.id} value={m.id}>Week {m.week}{m.opponent ? ` — vs ${m.opponent}` : ''}{m.dates ? ` (${m.dates})` : ''}</option>
            ))}
          </select>
        </div>
      </div>

      <Card style={{ marginBottom: 22 }}>
        <div style={{ ...label, marginBottom: 10 }}>ADD A NEW MATCH</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input value={newMatch.week} onChange={(e) => setNewMatch((m) => ({ ...m, week: e.target.value.replace(/\D/g, '') }))} placeholder="Week #" style={{ ...inputStyle, width: 80 }} />
          <input value={newMatch.dates} onChange={(e) => setNewMatch((m) => ({ ...m, dates: e.target.value }))} placeholder="Dates" style={inputStyle} />
          <input value={newMatch.opponent} onChange={(e) => setNewMatch((m) => ({ ...m, opponent: e.target.value }))} placeholder="Opponent" style={inputStyle} />
          <input value={newMatch.location} onChange={(e) => setNewMatch((m) => ({ ...m, location: e.target.value }))} placeholder="Location" style={inputStyle} />
          <GhostBtn onClick={addMatch} active>ADD MATCH</GhostBtn>
        </div>
      </Card>

      {canUpload ? (
        <div style={{ marginBottom: 28 }}>
          <div style={label}>PASTE RAW SCORE SHEET</div>
          <textarea
            value={csv} onChange={(e) => setCsv(e.target.value)} rows={8}
            placeholder="Paste the CSV or copy-pasted score sheet text here&hellip;"
            style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', fontSize: 12, resize: 'vertical', marginBottom: 10 }}
          />
          <PrimaryBtn onClick={parse} disabled={parsing}>
            {parsing ? 'PARSING WITH AI…' : 'PARSE WITH AI'}
          </PrimaryBtn>
        </div>
      ) : (
        <div style={{ fontFamily: mono, fontSize: 12, color: P.mute, marginBottom: 28 }}>
          Only Kaz and Luke can upload a new score sheet here — you can still review, edit, publish, or discard uploads below.
        </div>
      )}

      {err && <div style={{ fontFamily: mono, fontSize: 12, color: P.red, marginBottom: 18 }}>{err}</div>}

      <div style={{ ...label, marginBottom: 10 }}>RECENT UPLOADS</div>
      {uploads.length === 0 ? (
        <EmptyState>No uploads yet.</EmptyState>
      ) : uploads.map((u) => {
        const open = openUploadId === u.id;
        const rows = rowsFor(u);
        return (
          <div key={u.id} style={{ border: `1px solid ${P.hair}`, marginBottom: 10 }}>
            <button
              onClick={() => setOpenUploadId(open ? null : u.id)}
              style={{ width: '100%', textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer', padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}
            >
              <div style={{ fontFamily: mono, fontSize: 12, color: P.cream }}>
                {new Date(u.created_at).toLocaleString()} &middot; {u.uploaded_by} &middot; {u.draft?.rows?.length ?? 0} rows
              </div>
              <StatusBadge status={u.status} />
            </button>
            {open && (
              <div style={{ padding: '0 14px 16px' }}>
                {u.draft?.notes && (
                  <div style={{ fontFamily: mono, fontSize: 11, color: P.mute, marginBottom: 12, fontStyle: 'italic' }}>{u.draft.notes}</div>
                )}
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: mono, fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th style={th()}>Raw name</th>
                        <th style={th()}>Matched shooter</th>
                        <th style={th()}>Prone</th>
                        <th style={th()}>Standing</th>
                        <th style={th()}>Kneeling</th>
                        <th style={th()}>Total</th>
                        <th style={th()}>Bulls</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={i}>
                          <td style={{ ...td(), color: P.faint }}>{r.raw_name}</td>
                          <td style={td()}>
                            {u.status === 'pending_review' ? (
                              <input
                                value={r.matched_shooter_name || ''} list="rifle-shooter-names"
                                onChange={(e) => editRow(u, i, 'matched_shooter_name', e.target.value)}
                                placeholder={r.raw_name} style={{ ...inputStyle, width: 160 }}
                              />
                            ) : (r.matched_shooter_name || r.raw_name)}
                          </td>
                          {['prone', 'standing', 'kneeling', 'total', 'bulls'].map((f) => (
                            <td key={f} style={td()}>
                              {u.status === 'pending_review' ? (
                                <input
                                  value={r[f] ?? ''} inputMode="decimal"
                                  onChange={(e) => editRow(u, i, f, e.target.value === '' ? null : Number(e.target.value))}
                                  style={numInput}
                                />
                              ) : (r[f] ?? '—')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {u.status === 'pending_review' && (
                  <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                    <PrimaryBtn onClick={() => publish(u)} style={{ background: P.win }}>PUBLISH TO SCORES</PrimaryBtn>
                    <DangerBtn onClick={() => discard(u)} style={{ padding: '9px 16px' }}>DISCARD</DangerBtn>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
      <datalist id="rifle-shooter-names">
        {shooters.map((s) => <option key={s.id} value={s.name} />)}
      </datalist>
    </div>
  );
}
