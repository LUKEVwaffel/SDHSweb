import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase as SB } from '../../../lib/supabaseClient';
import { P, mono } from '../theme';

// Full match + score editor — the gap CompUploadTab leaves open: once an
// upload is published its rows go read-only there (by design, as an audit
// trail), so fixing a typo in an old season's score, correcting a match's
// opponent, or removing a bad row had no UI path. This tab is direct CRUD
// on rifle_matches/rifle_scores, same RLS gate as everywhere else in the
// portal (is_rifle_admin() or is_s6()) — no year restriction, so last
// season's rows are exactly as editable as this week's.
const inputStyle = { background: P.deep, border: `1px solid ${P.hair}`, color: P.cream, fontFamily: mono, fontSize: 13, padding: '9px 11px', outline: 'none' };
const label = { fontFamily: mono, fontSize: 11, color: P.gold, letterSpacing: '0.1em' };
const numInput = { ...inputStyle, width: 76, textAlign: 'center', padding: '7px 8px', fontSize: 12 };
const smallBtn = { background: 'transparent', border: `1px solid ${P.hairStrong}`, color: P.mute, fontFamily: mono, fontSize: 11, letterSpacing: '0.06em', padding: '6px 12px', cursor: 'pointer' };
const dangerBtn = { ...smallBtn, borderColor: P.red, color: P.red };
const STAT_FIELDS = ['prone', 'standing', 'kneeling', 'total', 'bulls'];

function seasonOf(match) {
  // Matches carry no explicit year column — the "dates" free-text field is
  // the only season signal on record, so pull a 4-digit year out of it and
  // fall back to "Undated" rather than guessing.
  const m = (match.dates || '').match(/\b(20\d{2})\b/);
  return m ? m[1] : 'Undated';
}

export default function ScoresTab() {
  const [matches, setMatches] = useState([]);
  const [shooters, setShooters] = useState([]);
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [selectedMatchId, setSelectedMatchId] = useState(null);
  const [seasonFilter, setSeasonFilter] = useState('All');
  const [matchSearch, setMatchSearch] = useState('');
  const [shooterSearch, setShooterSearch] = useState('');
  const [newMatch, setNewMatch] = useState({ week: '', dates: '', opponent: '', location: '' });
  const [addShooterId, setAddShooterId] = useState('');

  const load = useCallback(async () => {
    setErr('');
    const [{ data: m, error: mErr }, { data: s, error: sErr }, { data: sc, error: scErr }] = await Promise.all([
      SB.from('rifle_matches').select('*').order('week', { ascending: false }),
      SB.from('rifle_shooters').select('id, name, active').order('name'),
      SB.from('rifle_scores').select('*'),
    ]);
    if (mErr || sErr || scErr) { setErr((mErr || sErr || scErr).message); setLoading(false); return; }
    setMatches(m || []);
    setShooters(s || []);
    setScores(sc || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function flash(msg) {
    setOk(msg);
    setTimeout(() => setOk(''), 2000);
  }

  const seasons = useMemo(() => {
    const set = new Set(matches.map(seasonOf));
    return ['All', ...Array.from(set).sort((a, b) => b.localeCompare(a))];
  }, [matches]);

  const visibleMatches = useMemo(() => {
    const q = matchSearch.trim().toLowerCase();
    return matches
      .filter((m) => seasonFilter === 'All' || seasonOf(m) === seasonFilter)
      .filter((m) => !q || [m.week, m.dates, m.opponent, m.location].some((v) => String(v ?? '').toLowerCase().includes(q)));
  }, [matches, seasonFilter, matchSearch]);

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
    const scoredIds = new Set(matchScores.map((s) => s.shooter_id));
    return shooters.filter((s) => !scoredIds.has(s.id));
  }, [shooters, matchScores]);

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
    await load();
  }

  async function deleteScore(score) {
    if (!confirm(`Remove ${shooterName(score.shooter_id)}'s score from this match?`)) return;
    setErr('');
    const { error } = await SB.from('rifle_scores').delete().eq('id', score.id);
    if (error) { setErr(error.message); return; }
    await load();
    flash('Score removed');
  }

  async function addScoreRow() {
    if (!addShooterId || !selectedMatchId) return;
    setErr('');
    const { error } = await SB.from('rifle_scores').insert({ shooter_id: addShooterId, match_id: selectedMatchId });
    if (error) { setErr(error.message); return; }
    setAddShooterId('');
    await load();
    flash('Shooter added to match');
  }

  if (loading) return <div style={{ fontFamily: mono, fontSize: 12, color: P.mute }}>Loading scores…</div>;

  return (
    <div>
      <div style={{ fontFamily: mono, fontSize: 12, color: P.mute, marginBottom: 20, lineHeight: 1.6 }}>
        Edit any match or score directly — including past seasons. Comp Upload is for pasting a new score
        sheet; this tab is for fixing what's already published.
      </div>

      {err && <div style={{ fontFamily: mono, fontSize: 12, color: P.red, marginBottom: 14 }}>{err}</div>}
      {ok && <div style={{ fontFamily: mono, fontSize: 12, color: P.win, marginBottom: 14 }}>{ok}</div>}

      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <div style={{ ...label, marginBottom: 6 }}>SEASON</div>
          <select value={seasonFilter} onChange={(e) => setSeasonFilter(e.target.value)} style={{ ...inputStyle, minWidth: 140 }}>
            {seasons.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <div style={{ ...label, marginBottom: 6 }}>SEARCH MATCHES</div>
          <input value={matchSearch} onChange={(e) => setMatchSearch(e.target.value)} placeholder="week, opponent, location…" style={{ ...inputStyle, minWidth: 220 }} />
        </div>
      </div>

      {/* Match list */}
      <div style={{ border: `1px solid ${P.hair}`, marginBottom: 24 }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: mono, fontSize: 12 }}>
            <thead>
              <tr style={{ color: P.gold, textAlign: 'left' }}>
                <th style={{ padding: '10px 10px' }}>Week</th>
                <th style={{ padding: '10px 10px' }}>Dates</th>
                <th style={{ padding: '10px 10px' }}>Opponent</th>
                <th style={{ padding: '10px 10px' }}>Location</th>
                <th style={{ padding: '10px 10px' }}># Scores</th>
                <th style={{ padding: '10px 10px' }} />
              </tr>
            </thead>
            <tbody>
              {visibleMatches.length === 0 && (
                <tr><td colSpan={6} style={{ padding: '14px 10px', color: P.mute }}>No matches in this season.</td></tr>
              )}
              {visibleMatches.map((m) => {
                const count = scores.filter((sc) => sc.match_id === m.id).length;
                const selected = selectedMatchId === m.id;
                return (
                  <tr key={m.id} style={{ borderTop: `1px solid ${P.hair}`, background: selected ? 'rgba(201,169,97,0.08)' : 'transparent' }}>
                    <td style={{ padding: '8px 10px' }}>
                      <input defaultValue={m.week} onBlur={(e) => updateMatchField(m, 'week', e.target.value)} style={{ ...inputStyle, width: 56, padding: '6px 8px', fontSize: 12 }} />
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <input defaultValue={m.dates || ''} onBlur={(e) => updateMatchField(m, 'dates', e.target.value)} placeholder="e.g. 2025-10-04" style={{ ...inputStyle, width: 130, padding: '6px 8px', fontSize: 12 }} />
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <input defaultValue={m.opponent || ''} onBlur={(e) => updateMatchField(m, 'opponent', e.target.value)} style={{ ...inputStyle, width: 140, padding: '6px 8px', fontSize: 12 }} />
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <input defaultValue={m.location || ''} onBlur={(e) => updateMatchField(m, 'location', e.target.value)} style={{ ...inputStyle, width: 140, padding: '6px 8px', fontSize: 12 }} />
                    </td>
                    <td style={{ padding: '8px 10px', color: P.mute }}>{count}</td>
                    <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                      <button onClick={() => setSelectedMatchId(selected ? null : m.id)} style={{ ...smallBtn, marginRight: 6, color: selected ? P.gold : P.mute, borderColor: selected ? P.gold : P.hairStrong }}>
                        {selected ? 'CLOSE' : 'SCORES'}
                      </button>
                      <button onClick={() => deleteMatch(m)} style={dangerBtn}>DELETE</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ border: `1px solid ${P.hair}`, padding: 14, marginBottom: 28 }}>
        <div style={{ ...label, marginBottom: 10 }}>ADD A MATCH</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input value={newMatch.week} onChange={(e) => setNewMatch((m) => ({ ...m, week: e.target.value.replace(/\D/g, '') }))} placeholder="Week #" style={{ ...inputStyle, width: 80 }} />
          <input value={newMatch.dates} onChange={(e) => setNewMatch((m) => ({ ...m, dates: e.target.value }))} placeholder="Dates (include year)" style={inputStyle} />
          <input value={newMatch.opponent} onChange={(e) => setNewMatch((m) => ({ ...m, opponent: e.target.value }))} placeholder="Opponent" style={inputStyle} />
          <input value={newMatch.location} onChange={(e) => setNewMatch((m) => ({ ...m, location: e.target.value }))} placeholder="Location" style={inputStyle} />
          <button onClick={addMatch} style={{ background: P.gold, color: P.ink, border: 'none', fontFamily: mono, fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', padding: '9px 16px', cursor: 'pointer' }}>
            ADD MATCH
          </button>
        </div>
      </div>

      {/* Score editor for the selected match */}
      {selectedMatch && (
        <div>
          <div style={{ fontFamily: mono, fontSize: 12, color: P.gold, letterSpacing: '0.1em', marginBottom: 12 }}>
            WEEK {selectedMatch.week}{selectedMatch.opponent ? ` — VS ${selectedMatch.opponent.toUpperCase()}` : ''}{selectedMatch.dates ? ` (${selectedMatch.dates})` : ''}
          </div>

          <div style={{ marginBottom: 10 }}>
            <input value={shooterSearch} onChange={(e) => setShooterSearch(e.target.value)} placeholder="Search shooter in this match…" style={{ ...inputStyle, width: 240, padding: '7px 10px', fontSize: 12 }} />
          </div>

          <div style={{ overflowX: 'auto', marginBottom: 14 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: mono, fontSize: 12 }}>
              <thead>
                <tr style={{ color: P.gold, textAlign: 'left' }}>
                  <th style={{ padding: '6px 8px' }}>Shooter</th>
                  {STAT_FIELDS.map((f) => <th key={f} style={{ padding: '6px 8px', textTransform: 'capitalize' }}>{f}</th>)}
                  <th style={{ padding: '6px 8px' }} />
                </tr>
              </thead>
              <tbody>
                {matchScores.length === 0 && (
                  <tr><td colSpan={STAT_FIELDS.length + 2} style={{ padding: '12px 8px', color: P.mute }}>No scores recorded for this match yet.</td></tr>
                )}
                {matchScores.map((sc) => {
                  const inactive = !shooters.find((s) => s.id === sc.shooter_id)?.active;
                  return (
                    <tr key={sc.id} style={{ borderTop: `1px solid ${P.hair}` }}>
                      <td style={{ padding: '6px 8px', color: inactive ? P.faint : P.cream }}>
                        {shooterName(sc.shooter_id)}{inactive ? ' (inactive)' : ''}
                      </td>
                      {STAT_FIELDS.map((f) => (
                        <td key={f} style={{ padding: '6px 8px' }}>
                          <input defaultValue={sc[f] ?? ''} inputMode="decimal" onBlur={(e) => updateScoreField(sc, f, e.target.value)} style={numInput} />
                        </td>
                      ))}
                      <td style={{ padding: '6px 8px' }}>
                        <button onClick={() => deleteScore(sc)} style={dangerBtn}>REMOVE</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {unscoredShooters.length > 0 && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <select value={addShooterId} onChange={(e) => setAddShooterId(e.target.value)} style={{ ...inputStyle, minWidth: 200 }}>
                <option value="">Add shooter to this match&hellip;</option>
                {unscoredShooters.map((s) => <option key={s.id} value={s.id}>{s.name}{s.active ? '' : ' (inactive)'}</option>)}
              </select>
              <button onClick={addScoreRow} disabled={!addShooterId} style={{ ...smallBtn, color: P.gold, borderColor: P.gold, opacity: addShooterId ? 1 : 0.4 }}>
                ADD
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
