import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase as SB } from '../../../lib/supabaseClient';
import { P, mono, oswald } from '../theme';
import { GhostBtn, PrimaryBtn, DangerBtn, Badge } from './ui';
import { Sparkline, downloadCsv } from './charts';
import ScoreImport from './import/ScoreImport.jsx';
import { schoolYearOf, scoreTotal, perShooterStats, num, round1 } from './rifleStats';

// Grid-style match + score editor — the Range Ops redesign's replacement for
// the old row-per-match table view. Same underlying CRUD as before (direct
// on rifle_matches/rifle_scores, same RLS gate as everywhere in the portal),
// plus: heatmap cells, per-shooter sparkline trend, an inspector panel, and
// a real Undo wired to the audit log this repo already has (rifle_audit_log
// + rifle_undo_audit_entry RPC, the same system HistoryTab.jsx surfaces) —
// no new undo plumbing, just capturing the audit row id after each write.
const inputStyle = { background: P.deep, border: `1px solid ${P.hair}`, color: P.cream, fontFamily: mono, fontSize: 12, padding: '8px 10px', outline: 'none' };
const label = { fontFamily: mono, fontSize: 9, color: P.gold, letterSpacing: '0.2em' };
const STAT_FIELDS = ['prone', 'standing', 'kneeling', 'bulls'];
const FIELD_LABEL = { prone: 'PRONE', standing: 'STANDING', kneeling: 'KNEELING', bulls: 'X' };

function heat(n, active) {
  if (!active) return P.deep;
  const t = Math.max(0, Math.min(1, (n - 70) / 30));
  return `rgba(201,169,97,${(0.02 + t * t * 0.32).toFixed(3)})`;
}

export default function ScoresTab({ season, initialMatchId, canUpload = true }) {
  const [allMatches, setAllMatches] = useState([]);
  const [shooters, setShooters] = useState([]);
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [selectedMatchId, setSelectedMatchId] = useState(null);
  const [matchSearch, setMatchSearch] = useState('');
  const [shooterSearch, setShooterSearch] = useState('');
  const [newMatch, setNewMatch] = useState({ week: '', dates: '', opponent: '', location: '' });
  const [addShooterId, setAddShooterId] = useState('');
  const [selSid, setSelSid] = useState(null);
  const [undoStack, setUndoStack] = useState([]);
  const [undoing, setUndoing] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const load = useCallback(async () => {
    setErr('');
    const [{ data: m, error: mErr }, { data: s, error: sErr }, { data: sc, error: scErr }] = await Promise.all([
      SB.from('rifle_matches').select('*').order('week', { ascending: false }),
      SB.from('rifle_shooters').select('id, name, active').order('name'),
      SB.from('rifle_scores').select('*'),
    ]);
    if (mErr || sErr || scErr) { setErr((mErr || sErr || scErr).message); setLoading(false); return; }
    setAllMatches(m || []);
    setShooters(s || []);
    setScores(sc || []);
    setLoading(false);
    return m || [];
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (initialMatchId) setSelectedMatchId(initialMatchId);
  }, [initialMatchId]);

  function flash(msg) { setOk(msg); setTimeout(() => setOk(''), 2000); }

  // Filtered by the exact row_id the audit trigger logged for this write —
  // grabbing the latest rifle_scores entry unfiltered would grab someone
  // else's concurrent edit under load.
  async function pushUndo(rowId, actionLabel) {
    const { data } = await SB.from('rifle_audit_log').select('id').eq('table_name', 'rifle_scores').eq('row_id', rowId).order('changed_at', { ascending: false }).limit(1).maybeSingle();
    if (data) setUndoStack((st) => [...st.slice(-24), { auditId: data.id, label: actionLabel }]);
  }

  async function undo() {
    const last = undoStack[undoStack.length - 1];
    if (!last) return;
    setUndoing(true); setErr('');
    const { error } = await SB.rpc('rifle_undo_audit_entry', { p_audit_id: last.auditId });
    setUndoing(false);
    if (error) { setErr(error.message); return; }
    setUndoStack((st) => st.slice(0, -1));
    await load();
    flash(`Undone: ${last.label}`);
  }

  const matches = useMemo(() => allMatches.filter((m) => schoolYearOf(m) === season), [allMatches, season]);
  const per = useMemo(() => perShooterStats(shooters, matches, scores), [shooters, matches, scores]);
  const scoredMatchIds = useMemo(() => new Set(scores.map((sc) => sc.match_id)), [scores]);

  const visibleMatches = useMemo(() => {
    const q = matchSearch.trim().toLowerCase();
    return matches
      .filter((m) => !q || [m.week, m.dates, m.opponent, m.location].some((v) => String(v ?? '').toLowerCase().includes(q)));
  }, [matches, matchSearch]);

  const shooterName = useCallback((id) => shooters.find((s) => s.id === id)?.name || 'Unknown shooter', [shooters]);
  const selectedMatch = matches.find((m) => m.id === selectedMatchId) || null;

  const matchScores = useMemo(() => {
    const q = shooterSearch.trim().toLowerCase();
    return scores
      .filter((sc) => sc.match_id === selectedMatchId)
      .filter((sc) => !q || shooterName(sc.shooter_id).toLowerCase().includes(q))
      .sort((a, b) => shooterName(a.shooter_id).localeCompare(shooterName(b.shooter_id)));
  }, [scores, selectedMatchId, shooterName, shooterSearch]);

  const unscoredShooters = useMemo(() => {
    const scoredIds = new Set(scores.filter((sc) => sc.match_id === selectedMatchId).map((s) => s.shooter_id));
    return shooters.filter((s) => !scoredIds.has(s.id));
  }, [shooters, scores, selectedMatchId]);

  const top4Ids = useMemo(() => {
    return new Set(matchScores.slice().sort((a, b) => scoreTotal(b) - scoreTotal(a)).slice(0, 4).map((s) => s.shooter_id));
  }, [matchScores]);

  useEffect(() => {
    if (!selSid || !matchScores.some((s) => s.shooter_id === selSid)) {
      setSelSid(matchScores[0]?.shooter_id ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchScores]);

  async function updateMatchField(match, field, raw) {
    const value = field === 'week' ? Number(raw) : (raw.trim() || null);
    if (value === match[field]) return;
    setErr('');
    const { error } = await SB.from('rifle_matches').update({ [field]: value }).eq('id', match.id);
    if (error) { setErr(error.message); return; }
    await load();
    flash('Match updated');
  }

  async function deleteMatch(match) {
    if (!confirm(`Delete Week ${match.week}${match.opponent ? ` vs ${match.opponent}` : ''}? This also deletes every score recorded for it. Cannot be undone.`)) return;
    setErr('');
    const { error } = await SB.from('rifle_matches').delete().eq('id', match.id);
    if (error) { setErr(error.message); return; }
    if (selectedMatchId === match.id) setSelectedMatchId(null);
    await load();
    flash('Match deleted');
  }

  async function addMatch() {
    if (!newMatch.week.trim()) { setErr('Week number is required.'); return; }
    setErr('');
    const { data, error } = await SB.from('rifle_matches').insert({
      week: Number(newMatch.week), dates: newMatch.dates.trim() || null,
      opponent: newMatch.opponent.trim() || null, location: newMatch.location.trim() || null,
    }).select('*').single();
    if (error) { setErr(error.message); return; }
    setNewMatch({ week: '', dates: '', opponent: '', location: '' });
    await load();
    setSelectedMatchId(data.id);
    flash('Match added');
  }

  async function updateScoreField(score, field, raw) {
    const value = raw === '' ? null : Number(raw);
    if (value === score[field]) return;
    setErr('');
    const { error } = await SB.from('rifle_scores').update({ [field]: value }).eq('id', score.id);
    if (error) { setErr(error.message); return; }
    await pushUndo(score.id, `${shooterName(score.shooter_id)}'s ${field}`);
    await load();
  }

  async function deleteScore(score) {
    if (!confirm(`Remove ${shooterName(score.shooter_id)}'s score from this match?`)) return;
    setErr('');
    const { error } = await SB.from('rifle_scores').delete().eq('id', score.id);
    if (error) { setErr(error.message); return; }
    await pushUndo(score.id, `remove ${shooterName(score.shooter_id)}`);
    await load();
    flash('Score removed');
  }

  async function addScoreRow() {
    if (!addShooterId || !selectedMatchId) return;
    setErr('');
    const { data, error } = await SB.from('rifle_scores').insert({ shooter_id: addShooterId, match_id: selectedMatchId }).select('id').single();
    if (error) { setErr(error.message); return; }
    await pushUndo(data.id, `add ${shooterName(addShooterId)}`);
    setAddShooterId('');
    await load();
    flash('Shooter added to match');
  }

  function exportCsv() {
    if (!selectedMatch) return;
    const rows = [['Shooter', ...STAT_FIELDS, 'Total'].join(',')];
    matchScores.forEach((sc) => {
      rows.push([shooterName(sc.shooter_id), ...STAT_FIELDS.map((f) => sc[f] ?? ''), scoreTotal(sc)].join(','));
    });
    downloadCsv(`wk${String(selectedMatch.week).padStart(2, '0')}_scores.csv`, rows);
  }

  const insp = selSid ? matchScores.find((s) => s.shooter_id === selSid) : null;
  const inspStats = selSid ? per.get(selSid) : null;

  const validation = [];
  if (selectedMatch) {
    const outOfRange = matchScores.filter((sc) => STAT_FIELDS.slice(0, 3).some((f) => sc[f] != null && sc[f] > 100));
    if (outOfRange.length) validation.push({ text: `${outOfRange.length} score${outOfRange.length === 1 ? '' : 's'} above 100 — double-check`, color: P.warn, icon: '!' });
    if (unscoredShooters.filter((s) => s.active).length) validation.push({ text: `${unscoredShooters.filter((s) => s.active).length} active shooter(s) not yet scored`, color: P.mute, icon: '·' });
    if (!outOfRange.length && matchScores.length) validation.push({ text: 'All values within typical range', color: P.win, icon: '✓' });
  }

  if (loading) return <div style={{ fontFamily: mono, fontSize: 12, color: P.mute }}>Loading scores…</div>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ ...label, opacity: 0.75 }}>// MATCHES · SCORES</div>
        <div style={{ flex: 1, height: 1, background: P.hair }} />
      </div>
      <div style={{ fontFamily: oswald, fontSize: 18, fontWeight: 600, color: P.cream, marginBottom: 4 }}>Scores Editor</div>
      <div style={{ fontFamily: mono, fontSize: 11, color: P.mute, marginBottom: 16, lineHeight: 1.6 }}>
        Edit any match or score directly, import a score sheet, or undo the last change — all logged to History.
      </div>

      {err && <div style={{ fontFamily: mono, fontSize: 12, color: P.red, marginBottom: 14 }}>{err}</div>}
      {ok && <div style={{ fontFamily: mono, fontSize: 12, color: P.win, marginBottom: 14 }}>{ok}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '240px minmax(0,1fr) 300px', gap: 14, alignItems: 'start' }}>
        {/* Match rail */}
        <div style={{ background: P.navy, border: `1px solid ${P.hair}` }}>
          <div style={{ padding: '12px 14px', borderBottom: `1px solid ${P.hair}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={label}>// MATCHES</span>
            </div>
            <input value={matchSearch} onChange={(e) => setMatchSearch(e.target.value)} placeholder="search…" style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
          </div>
          <div style={{ maxHeight: 480, overflowY: 'auto' }}>
            {visibleMatches.length === 0 && <div style={{ padding: 14, fontFamily: mono, fontSize: 11, color: P.mute }}>No matches in this season.</div>}
            {visibleMatches.map((m) => {
              const on = m.id === selectedMatchId;
              const live = scoredMatchIds.has(m.id);
              const count = scores.filter((sc) => sc.match_id === m.id).length;
              return (
                <div key={m.id} onClick={() => setSelectedMatchId(m.id)} style={{ padding: '11px 14px', borderBottom: `1px solid ${P.hair}`, borderLeft: `2px solid ${on ? P.gold : 'transparent'}`, background: on ? 'rgba(201,169,97,0.08)' : 'transparent', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontFamily: mono, fontSize: 10, color: P.gold, letterSpacing: '0.1em' }}>WK {String(m.week).padStart(2, '0')}</span>
                    <Badge tone={live ? 'win' : 'mute'}>{live ? 'LIVE' : 'UPCOMING'}</Badge>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, gap: 6 }}>
                    <span style={{ fontSize: 13, color: P.cream, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.opponent || '—'}</span>
                    <span style={{ fontFamily: mono, fontSize: 11, color: P.faint }}>{count || ''}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ padding: 12 }}>
            <div style={{ ...label, marginBottom: 8 }}>ADD MATCH</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <input value={newMatch.week} onChange={(e) => setNewMatch((m) => ({ ...m, week: e.target.value.replace(/\D/g, '') }))} placeholder="Week #" style={{ ...inputStyle }} />
              <input value={newMatch.dates} onChange={(e) => setNewMatch((m) => ({ ...m, dates: e.target.value }))} placeholder="Dates" style={inputStyle} />
              <input value={newMatch.opponent} onChange={(e) => setNewMatch((m) => ({ ...m, opponent: e.target.value }))} placeholder="Opponent" style={inputStyle} />
              <input value={newMatch.location} onChange={(e) => setNewMatch((m) => ({ ...m, location: e.target.value }))} placeholder="Location" style={inputStyle} />
              <GhostBtn onClick={addMatch} active>ADD</GhostBtn>
            </div>
          </div>
        </div>

        {/* Editor */}
        <div>
          {!selectedMatch ? (
            <div style={{ border: `1px dashed ${P.hair}`, padding: '40px 20px', textAlign: 'center', fontFamily: mono, fontSize: 12, color: P.mute }}>
              Pick a match from the list, or add a new one.
            </div>
          ) : (
            <>
              <div style={{ position: 'relative', background: `linear-gradient(135deg, ${P.navy} 0%, ${P.deep} 100%)`, border: `1px solid ${P.hairStrong}`, padding: '18px 20px', marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ ...label, marginBottom: 8 }}>// WEEK {String(selectedMatch.week).padStart(2, '0')} · SCORES EDITOR</div>
                    <input defaultValue={selectedMatch.opponent || ''} onBlur={(e) => updateMatchField(selectedMatch, 'opponent', e.target.value)} placeholder="Opponent"
                      style={{ width: '100%', boxSizing: 'border-box', background: 'transparent', border: 'none', borderBottom: `1px dashed ${P.hair}`, color: P.cream, fontFamily: oswald, fontSize: 26, fontWeight: 600, padding: '2px 0', outline: 'none' }} />
                    <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap' }}>
                      <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontFamily: mono, fontSize: 10, color: P.mute }}>DATE
                        <input defaultValue={selectedMatch.dates || ''} onBlur={(e) => updateMatchField(selectedMatch, 'dates', e.target.value)} style={{ ...inputStyle, width: 110 }} />
                      </label>
                      <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontFamily: mono, fontSize: 10, color: P.mute }}>LOCATION
                        <input defaultValue={selectedMatch.location || ''} onBlur={(e) => updateMatchField(selectedMatch, 'location', e.target.value)} style={{ ...inputStyle, width: 150 }} />
                      </label>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={label}>TEAM AGG · TOP 4</div>
                    <div style={{ fontFamily: oswald, fontSize: 44, fontWeight: 600, color: P.bright, lineHeight: 1, marginTop: 4 }}>
                      {round1(matchScores.slice().sort((a, b) => scoreTotal(b) - scoreTotal(a)).slice(0, 4).reduce((a, b) => a + scoreTotal(b), 0))}
                    </div>
                    <div style={{ fontFamily: mono, fontSize: 10, color: P.faint, marginTop: 4 }}>/ 1,200</div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
                {canUpload && <PrimaryBtn onClick={() => setImportOpen(true)}>✦ IMPORT</PrimaryBtn>}
                <GhostBtn onClick={undo} disabled={!undoStack.length || undoing}>{undoing ? 'UNDOING…' : `↶ UNDO${undoStack.length ? ` (${undoStack.length})` : ''}`}</GhostBtn>
                <GhostBtn onClick={exportCsv} disabled={!matchScores.length}>CSV</GhostBtn>
                <GhostBtn onClick={() => window.print()}>PRINT</GhostBtn>
                <div style={{ flex: 1 }} />
                <input value={shooterSearch} onChange={(e) => setShooterSearch(e.target.value)} placeholder="search shooter…" style={{ ...inputStyle, width: 180 }} />
                <DangerBtn onClick={() => deleteMatch(selectedMatch)}>DELETE MATCH</DangerBtn>
              </div>

              <div style={{ background: 'rgba(10,22,40,0.85)', border: `1px solid ${P.hair}`, overflowX: 'auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '30px minmax(140px,1.4fr) repeat(4,minmax(58px,1fr)) 70px 64px 90px 24px', gap: 6, padding: '9px 12px', borderBottom: `1px solid ${P.hairStrong}`, fontFamily: mono, fontSize: 9, color: P.gold, letterSpacing: '0.14em', alignItems: 'center', minWidth: 720 }}>
                  <span>#</span><span>SHOOTER</span>{STAT_FIELDS.map((f) => <span key={f} style={{ textAlign: 'center' }}>{FIELD_LABEL[f]}</span>)}<span style={{ textAlign: 'right' }}>TOTAL</span><span style={{ textAlign: 'right' }}>Δ AVG</span><span style={{ textAlign: 'center' }}>TREND</span><span />
                </div>
                {matchScores.length === 0 && (
                  <div style={{ padding: '16px 12px', fontFamily: mono, fontSize: 12, color: P.mute }}>No scores recorded for this match yet.</div>
                )}
                {matchScores.map((sc, i) => {
                  const st = per.get(sc.shooter_id);
                  const total = scoreTotal(sc);
                  const delta = st ? total - st.avg : 0;
                  const on = sc.shooter_id === selSid;
                  return (
                    <div key={sc.id} onClick={() => setSelSid(sc.shooter_id)} style={{ display: 'grid', gridTemplateColumns: '30px minmax(140px,1.4fr) repeat(4,minmax(58px,1fr)) 70px 64px 90px 24px', gap: 6, padding: '6px 12px', borderBottom: `1px solid ${P.hair}`, alignItems: 'center', background: on ? 'rgba(201,169,97,0.07)' : 'transparent', borderLeft: `2px solid ${on ? P.bright : 'transparent'}`, minWidth: 720 }}>
                      <span style={{ fontFamily: mono, fontSize: 11, color: P.faint }}>{String(i + 1).padStart(2, '0')}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <span style={{ fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: P.cream }}>{shooterName(sc.shooter_id)}</span>
                        {top4Ids.has(sc.shooter_id) && <span style={{ fontFamily: mono, fontSize: 8, color: P.gold, letterSpacing: '0.1em' }}>TOP4</span>}
                      </div>
                      {STAT_FIELDS.map((f) => {
                        const bad = f !== 'bulls' && sc[f] != null && sc[f] > 100;
                        return (
                          <input key={f} defaultValue={sc[f] ?? ''} inputMode="decimal" onBlur={(e) => updateScoreField(sc, f, e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            style={{ width: '100%', boxSizing: 'border-box', background: bad ? 'rgba(232,137,122,0.14)' : heat(sc[f] ?? 0, f !== 'bulls'), border: `1px solid ${bad ? P.red : P.hair}`, color: bad ? P.red : P.cream, fontFamily: mono, fontSize: 13, textAlign: 'center', padding: '7px 0', outline: 'none' }} />
                        );
                      })}
                      <span style={{ fontFamily: oswald, fontSize: 18, textAlign: 'right', color: P.cream }}>{total}</span>
                      <span style={{ fontFamily: mono, fontSize: 11, textAlign: 'right', color: delta >= 0 ? P.win : P.red }}>{delta >= 0 ? '+' : ''}{round1(delta)}</span>
                      <div style={{ display: 'flex', justifyContent: 'center' }}>{st && st.rows.length > 1 && <Sparkline values={st.rows.map((r) => r.total)} width={70} height={20} color={delta >= 0 ? P.win : P.gold} />}</div>
                      <span onClick={(e) => { e.stopPropagation(); deleteScore(sc); }} title="Remove" style={{ fontFamily: mono, fontSize: 13, color: 'rgba(232,137,122,0.5)', cursor: 'pointer', textAlign: 'center' }}>×</span>
                    </div>
                  );
                })}
                {matchScores.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: '30px minmax(140px,1.4fr) repeat(4,minmax(58px,1fr)) 70px 64px 90px 24px', gap: 6, padding: '10px 12px', background: 'rgba(201,169,97,0.06)', fontFamily: mono, fontSize: 12, minWidth: 720 }}>
                    <span /><span style={{ fontSize: 9, letterSpacing: '0.2em', color: P.gold }}>MATCH AVERAGE</span>
                    {STAT_FIELDS.map((f) => <span key={f} style={{ textAlign: 'center', color: 'rgba(244,236,216,0.8)' }}>{round1(matchScores.reduce((a, s) => a + num(s[f]), 0) / matchScores.length)}</span>)}
                    <span style={{ fontFamily: oswald, fontSize: 16, textAlign: 'right', color: P.bright }}>{round1(matchScores.reduce((a, s) => a + scoreTotal(s), 0) / matchScores.length)}</span>
                    <span /><span /><span />
                  </div>
                )}
              </div>

              {unscoredShooters.length > 0 && (
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 12 }}>
                  <select value={addShooterId} onChange={(e) => setAddShooterId(e.target.value)} style={{ ...inputStyle, minWidth: 200 }}>
                    <option value="">Add shooter to this match…</option>
                    {unscoredShooters.map((s) => <option key={s.id} value={s.id}>{s.name}{s.active ? '' : ' (inactive)'}</option>)}
                  </select>
                  <GhostBtn onClick={addScoreRow} disabled={!addShooterId} active>ADD</GhostBtn>
                </div>
              )}
            </>
          )}
        </div>

        {/* Inspector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ background: P.navy, border: `1px solid ${P.hair}`, padding: '16px 18px' }}>
            <div style={{ ...label, marginBottom: 10 }}>// INSPECTOR</div>
            {insp && inspStats ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <div>
                    <div style={{ fontFamily: oswald, fontSize: 19, fontWeight: 500, color: P.cream, lineHeight: 1.1 }}>{shooterName(insp.shooter_id)}</div>
                    <div style={{ fontFamily: mono, fontSize: 10, color: P.faint, marginTop: 4 }}>{inspStats.n} MATCHES</div>
                  </div>
                  <div style={{ fontFamily: oswald, fontSize: 32, color: P.bright }}>{scoreTotal(insp)}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
                  {STAT_FIELDS.slice(0, 3).map((f) => (
                    <div key={f}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: mono, fontSize: 10, marginBottom: 4 }}>
                        <span style={{ color: P.mute }}>{FIELD_LABEL[f]}</span>
                        <span style={{ color: P.cream }}>{insp[f] ?? '—'} <span style={{ color: P.faint }}>/ avg {round1(inspStats[f])}</span></span>
                      </div>
                      <div style={{ height: 5, background: P.deep, position: 'relative' }}>
                        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min(100, ((num(insp[f]) - 50) / 50) * 100)}%`, background: P.gold }} />
                      </div>
                    </div>
                  ))}
                </div>
                {inspStats.rows.length > 1 && <div style={{ marginTop: 14 }}><Sparkline values={inspStats.rows.map((r) => r.total)} width={230} height={40} color={P.bright} /></div>}
              </>
            ) : (
              <div style={{ fontFamily: mono, fontSize: 12, color: P.mute }}>Click a row to inspect.</div>
            )}
          </div>
          {validation.length > 0 && (
            <div style={{ background: P.navy, border: `1px solid ${P.hair}`, padding: '16px 18px' }}>
              <div style={{ ...label, marginBottom: 10 }}>// VALIDATION</div>
              {validation.map((v, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, padding: '6px 0', fontSize: 12, lineHeight: 1.4, color: 'rgba(244,236,216,0.85)' }}>
                  <span style={{ fontFamily: mono, color: v.color, width: 14 }}>{v.icon}</span><span>{v.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {importOpen && (
        <ImportModal
          match={selectedMatch}
          matches={allMatches}
          shooters={shooters}
          season={season}
          canUseAi={canUpload}
          onClose={() => setImportOpen(false)}
          onPublished={async (msg) => { await load(); flash(msg || 'Scores published from import'); }}
          onMatchCreated={() => load()}
        />
      )}
    </div>
  );
}

// Import modal — thin shell around the shared ScoreImport (import/), which
// reads any spreadsheet/CSV/PDF/photo, shows a review table and publishes.
function ImportModal({ match, matches, shooters, season, canUseAi, onClose, onPublished, onMatchCreated }) {
  const [hasPending, setHasPending] = useState(false);
  const onBatchesChange = useCallback((bs) => setHasPending(bs.some((b) => b.status === 'review')), []);

  function close() {
    if (hasPending && !confirm('Close the import? Tables you haven\'t published yet will be lost (AI reads stay as drafts in Comp Upload).')) return;
    onClose();
  }

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div role="dialog" aria-modal="true" aria-label="Import scores" style={{ position: 'fixed', inset: 0, background: 'rgba(3,8,16,0.8)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'min(30px, 4vw)' }}>
      <div style={{ width: 980, maxWidth: '100%', maxHeight: '90vh', overflow: 'auto', background: P.deep, border: `1px solid ${P.hairStrong}`, boxShadow: '0 40px 80px rgba(0,0,0,0.6)' }}>
        <div style={{ padding: '18px 22px', borderBottom: `1px solid ${P.hair}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: P.deep, zIndex: 1 }}>
          <div>
            <div style={{ ...label, marginBottom: 6 }}>// IMPORT SCORES</div>
            <div style={{ fontFamily: oswald, fontSize: 20, fontWeight: 600, color: P.cream }}>{match ? `Default: Week ${match.week}${match.opponent ? ` · ${match.opponent}` : ''}` : 'Import score sheets'}</div>
          </div>
          <button type="button" onClick={close} aria-label="Close import" style={{ background: 'none', border: 'none', fontFamily: mono, fontSize: 20, color: P.mute, cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ padding: 20 }}>
          <ScoreImport
            matches={matches} shooters={shooters} season={season} defaultMatchId={match?.id} canUseAi={canUseAi}
            onPublished={onPublished} onMatchCreated={onMatchCreated} onBatchesChange={onBatchesChange}
          />
        </div>
      </div>
    </div>
  );
}
