import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase as SB } from '../../../lib/supabaseClient';
import { P, mono, oswald } from '../theme';
import { GhostBtn, PrimaryBtn } from './ui';
import { downloadCsv } from './charts';
import { perShooterStats, nextUpcomingMatch, round1, schoolYearOf } from './rifleStats';

const label = { fontFamily: mono, fontSize: 9, color: P.gold, letterSpacing: '0.22em' };
const SORTS = [
  ['avg', 'SEASON AVG'], ['last3', 'LAST 3'], ['pr', 'PR'],
  ['prone', 'PRONE'], ['standing', 'STANDING'], ['kneeling', 'KNEELING'],
];

export default function LineupTab({ season, onNavigate }) {
  const [shooters, setShooters] = useState([]);
  const [allMatches, setAllMatches] = useState([]);
  const [scores, setScores] = useState([]);
  const [lineups, setLineups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState('avg');
  const [err, setErr] = useState('');
  const [busySlot, setBusySlot] = useState(null);

  const load = useCallback(async () => {
    setErr('');
    const [{ data: sh }, { data: m }, { data: sc }, { data: lu }] = await Promise.all([
      SB.from('rifle_shooters').select('*').order('name'),
      SB.from('rifle_matches').select('*').order('week', { ascending: true }),
      SB.from('rifle_scores').select('*'),
      SB.from('rifle_lineups').select('*'),
    ]);
    setShooters(sh || []);
    setAllMatches(m || []);
    setScores(sc || []);
    setLineups(lu || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const matches = useMemo(() => allMatches.filter((m) => schoolYearOf(m) === season), [allMatches, season]);
  const per = useMemo(() => perShooterStats(shooters, matches, scores), [shooters, matches, scores]);
  const nextMatch = useMemo(() => nextUpcomingMatch(matches, scores), [matches, scores]);

  // "Prior" snapshot — same stats computed with the most recent scored match
  // excluded, so rank movement means something (not just "same as now").
  const prevPer = useMemo(() => {
    const scoredWeeks = matches.filter((m) => scores.some((sc) => sc.match_id === m.id)).map((m) => m.week);
    if (scoredWeeks.length < 2) return null;
    const maxWeek = Math.max(...scoredWeeks);
    const priorMatches = matches.filter((m) => m.week !== maxWeek);
    return perShooterStats(shooters, priorMatches, scores);
  }, [shooters, matches, scores]);

  if (loading) return <div style={{ fontFamily: mono, fontSize: 12, color: P.mute }}>Loading rankings…</div>;

  const metric = (st) => (sort === 'pr' ? st.pr : st[sort]);
  const ranked = shooters
    .map((s) => ({ shooter: s, st: per.get(s.id) }))
    .filter((x) => x.st.n)
    .sort((a, b) => metric(b.st) - metric(a.st));

  const prevRanked = prevPer
    ? shooters
        .map((s) => ({ id: s.id, st: prevPer.get(s.id) }))
        .filter((x) => x.st.n)
        .sort((a, b) => metric(b.st) - metric(a.st))
        .map((x, i) => ({ id: x.id, rank: i + 1 }))
    : null;

  const maxMetric = ranked.length ? metric(ranked[0].st) : 1;

  const lineupSlots = nextMatch ? lineups.filter((l) => l.match_id === nextMatch.id) : [];
  const slotShooter = (slot) => {
    const row = lineupSlots.find((l) => l.slot === slot);
    if (!row) return null;
    return shooters.find((s) => s.id === row.shooter_id) || null;
  };
  const placedIds = new Set(lineupSlots.map((l) => l.shooter_id));
  const available = ranked.filter((r) => !placedIds.has(r.shooter.id) && r.shooter.active);

  async function setSlot(slot, shooterId) {
    if (!nextMatch) return;
    setBusySlot(slot); setErr('');
    const { error } = shooterId
      ? await SB.from('rifle_lineups').upsert({ match_id: nextMatch.id, slot, shooter_id: shooterId }, { onConflict: 'match_id,slot' })
      : await SB.from('rifle_lineups').delete().eq('match_id', nextMatch.id).eq('slot', slot);
    setBusySlot(null);
    if (error) { setErr(error.message); return; }
    await load();
  }

  async function autofillBest() {
    if (!nextMatch) return;
    const emptySlots = [1, 2, 3, 4, 5, 6].filter((s) => !slotShooter(s));
    const fillers = available.slice(0, emptySlots.length);
    for (let i = 0; i < emptySlots.length && i < fillers.length; i++) {
      // eslint-disable-next-line no-await-in-loop
      await SB.from('rifle_lineups').upsert({ match_id: nextMatch.id, slot: emptySlots[i], shooter_id: fillers[i].shooter.id }, { onConflict: 'match_id,slot' });
    }
    await load();
  }

  function exportLineup() {
    if (!nextMatch) return;
    const rows = [['Slot', 'Shooter', SORTS.find(([k]) => k === sort)[1]].join(',')];
    for (let slot = 1; slot <= 6; slot++) {
      const s = slotShooter(slot);
      const st = s ? per.get(s.id) : null;
      rows.push([slot, s?.name || '', st ? round1(metric(st)) : ''].join(','));
    }
    downloadCsv(`wk${nextMatch ? String(nextMatch.week).padStart(2, '0') : 'lineup'}_lineup.csv`, rows);
  }

  const starterSlots = [1, 2, 3, 4];
  const projected = starterSlots.reduce((sum, slot) => {
    const s = slotShooter(slot);
    const st = s ? per.get(s.id) : null;
    return sum + (st ? metric(st) : 0);
  }, 0);
  const seasonBest = ranked.length ? Math.max(...ranked.map((r) => metric(r.st))) : 0;

  return (
    <div>
      {err && <div style={{ fontFamily: mono, fontSize: 12, color: P.red, marginBottom: 14 }}>{err}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 400px', gap: 14, alignItems: 'start' }}>
        <div style={{ background: P.navy, border: `1px solid ${P.hair}` }}>
          <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: `1px solid ${P.hair}`, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div style={{ ...label, marginBottom: 6 }}>// LEADERBOARD</div>
              <div style={{ fontFamily: oswald, fontSize: 22, fontWeight: 600, color: P.cream }}>Rankings</div>
            </div>
            <div style={{ display: 'flex', border: `1px solid ${P.hairStrong}`, flexWrap: 'wrap' }}>
              {SORTS.map(([id, l]) => (
                <button key={id} onClick={() => setSort(id)} style={{ background: sort === id ? 'rgba(201,169,97,0.15)' : 'transparent', color: sort === id ? P.bright : P.mute, border: 'none', borderRight: `1px solid ${P.hair}`, fontFamily: mono, fontSize: 9, letterSpacing: '0.1em', padding: '6px 9px', cursor: 'pointer' }}>{l}</button>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '46px 34px minmax(0,1fr) minmax(0,1.1fr) 68px 100px', gap: 10, padding: '8px 20px', fontFamily: mono, fontSize: 9, color: P.gold, letterSpacing: '0.14em', background: P.deep, borderBottom: `1px solid ${P.hair}` }}>
            <span>RANK</span><span>MOVE</span><span>SHOOTER</span><span>{SORTS.find(([k]) => k === sort)[1]}</span><span style={{ textAlign: 'right' }}>VALUE</span><span />
          </div>
          {ranked.length === 0 ? (
            <div style={{ padding: '16px 20px', fontFamily: mono, fontSize: 12, color: P.mute }}>No scores recorded yet.</div>
          ) : ranked.map((r, i) => {
            const rank = i + 1;
            const prevRank = prevRanked?.find((p) => p.id === r.shooter.id)?.rank;
            const move = prevRank == null ? null : prevRank - rank;
            const val = metric(r.st);
            const inLineup = placedIds.has(r.shooter.id);
            const nextEmptySlot = [1, 2, 3, 4, 5, 6].find((s) => !slotShooter(s));
            return (
              <div key={r.shooter.id} style={{ display: 'grid', gridTemplateColumns: '46px 34px minmax(0,1fr) minmax(0,1.1fr) 68px 100px', gap: 10, padding: '10px 20px', alignItems: 'center', borderBottom: `1px solid ${P.hair}` }}>
                <span style={{ fontFamily: oswald, fontSize: 22, color: rank === 1 ? P.bright : P.mute }}>{rank}</span>
                <span style={{ fontFamily: mono, fontSize: 11, color: move > 0 ? P.win : move < 0 ? P.red : P.faint }}>{move == null ? '—' : move === 0 ? '=' : move > 0 ? `▲${move}` : `▼${-move}`}</span>
                <div onClick={() => onNavigate?.('shooters', { profileId: r.shooter.id })} style={{ cursor: 'pointer', minWidth: 0 }}>
                  <div style={{ fontSize: 14, color: P.cream, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.shooter.name}</div>
                  <div style={{ fontFamily: mono, fontSize: 9, color: P.faint }}>{r.st.n} matches</div>
                </div>
                <div style={{ height: 7, background: P.deep, position: 'relative' }}>
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min(100, (val / (maxMetric || 1)) * 100)}%`, background: `linear-gradient(90deg, rgba(201,169,97,0.4), ${P.bright})` }} />
                </div>
                <span style={{ fontFamily: mono, fontSize: 14, textAlign: 'right', color: P.cream }}>{round1(val)}</span>
                {nextMatch ? (
                  <button
                    onClick={() => setSlot(inLineup ? lineupSlots.find((l) => l.shooter_id === r.shooter.id).slot : nextEmptySlot, inLineup ? null : r.shooter.id)}
                    disabled={!inLineup && nextEmptySlot == null}
                    style={{ background: inLineup ? 'transparent' : 'rgba(201,169,97,0.1)', color: inLineup ? P.red : P.gold, border: `1px solid ${inLineup ? P.red + '66' : P.hairStrong}`, fontFamily: mono, fontSize: 9, letterSpacing: '0.1em', padding: '6px 8px', cursor: 'pointer', opacity: (!inLineup && nextEmptySlot == null) ? 0.4 : 1 }}
                  >
                    {inLineup ? 'REMOVE' : 'ADD TO LINEUP'}
                  </button>
                ) : <span />}
              </div>
            );
          })}
        </div>

        <div style={{ position: 'sticky', top: 76, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ position: 'relative', background: `linear-gradient(160deg, ${P.navy} 0%, ${P.deep} 100%)`, border: `1px solid ${P.hairStrong}`, padding: '20px 20px' }}>
            <div style={{ ...label, marginBottom: 6 }}>// LINEUP BUILDER {nextMatch ? `· WK ${nextMatch.week}` : ''}</div>
            {!nextMatch ? (
              <div style={{ fontFamily: mono, fontSize: 12, color: P.mute, padding: '10px 0' }}>No upcoming match — every scheduled match already has scores.</div>
            ) : (
              <>
                <div style={{ fontFamily: oswald, fontSize: 22, fontWeight: 600, color: P.cream }}>{nextMatch.opponent || 'Opponent TBD'}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', margin: '16px 0 14px', padding: '12px 0', borderTop: `1px solid ${P.hair}`, borderBottom: `1px solid ${P.hair}` }}>
                  <div>
                    <div style={{ fontFamily: mono, fontSize: 9, color: P.mute, letterSpacing: '0.18em' }}>PROJECTED (SLOTS 1-4)</div>
                    <div style={{ fontFamily: oswald, fontSize: 46, fontWeight: 600, color: P.bright, lineHeight: 1 }}>{round1(projected)}</div>
                  </div>
                  <div style={{ textAlign: 'right', fontFamily: mono, fontSize: 10, color: P.mute, lineHeight: 1.7 }}>
                    BEST SHOOTER {round1(seasonBest)}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {[1, 2, 3, 4, 5, 6].map((slot) => {
                    const s = slotShooter(slot);
                    const st = s ? per.get(s.id) : null;
                    return (
                      <div key={slot} style={{ display: 'grid', gridTemplateColumns: '26px minmax(0,1fr) 50px 20px', gap: 8, alignItems: 'center', padding: '8px 10px', background: s ? 'rgba(201,169,97,0.06)' : 'transparent', border: `1px ${s ? 'solid' : 'dashed'} ${slot <= 4 ? P.hairStrong : P.hair}` }}>
                        <span style={{ fontFamily: oswald, fontSize: 15, color: slot <= 4 ? P.bright : P.mute }}>{slot}</span>
                        {s ? (
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13, color: P.cream, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
                            <div style={{ fontFamily: mono, fontSize: 8, color: P.faint, letterSpacing: '0.1em' }}>{slot <= 4 ? 'STARTER' : 'ALTERNATE'}</div>
                          </div>
                        ) : (
                          <select onChange={(e) => e.target.value && setSlot(slot, e.target.value)} value="" disabled={busySlot === slot} style={{ background: 'transparent', border: 'none', color: P.faint, fontFamily: mono, fontSize: 11, outline: 'none' }}>
                            <option value="">— empty —</option>
                            {available.map((r) => <option key={r.shooter.id} value={r.shooter.id}>{r.shooter.name}</option>)}
                          </select>
                        )}
                        <span style={{ fontFamily: mono, fontSize: 12, textAlign: 'right', color: P.cream }}>{st ? round1(metric(st)) : ''}</span>
                        {s ? <span onClick={() => setSlot(slot, null)} style={{ fontFamily: mono, color: P.faint, cursor: 'pointer', textAlign: 'center' }}>×</span> : <span />}
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                  <GhostBtn onClick={autofillBest} active style={{ flex: 1, textAlign: 'center' }}>✦ AUTO-FILL BEST</GhostBtn>
                  <PrimaryBtn onClick={exportLineup} style={{ flex: 1 }}>EXPORT CSV</PrimaryBtn>
                </div>
                <GhostBtn onClick={() => window.print()} style={{ width: '100%', marginTop: 8, textAlign: 'center' }}>PRINT SHEET</GhostBtn>
              </>
            )}
          </div>
          <div style={{ fontFamily: mono, fontSize: 10, color: P.faint, lineHeight: 1.6, padding: '0 4px' }}>
            Projection uses each shooter's {SORTS.find(([k]) => k === sort)[1].toLowerCase()}. Slots 1-4 count toward the published aggregate; 5-6 are alternates.
          </div>
        </div>
      </div>
    </div>
  );
}
