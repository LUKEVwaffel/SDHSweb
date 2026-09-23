import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase as SB } from '../../../lib/supabaseClient';
import { P, mono, oswald } from '../theme';
import { Badge } from './ui';
import { TrendChart, Sparkline } from './charts';
import { perShooterStats, teamAggregates, num, round1, initials, badgeFor, schoolYearOf } from './rifleStats';

const label = { fontFamily: mono, fontSize: 9, color: P.gold, letterSpacing: '0.22em' };
const POS = [
  { k: 'prone', label: 'PRONE', color: P.gold },
  { k: 'standing', label: 'STANDING', color: '#6FA8DC' },
  { k: 'kneeling', label: 'KNEELING', color: '#B99AE0' },
];

export default function ShooterTab({ season, initialProfileId, onNavigate }) {
  const [shooters, setShooters] = useState([]);
  const [allMatches, setAllMatches] = useState([]);
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [profileId, setProfileId] = useState(initialProfileId || null);
  const [rosterSearch, setRosterSearch] = useState('');
  const [mode, setMode] = useState('total'); // total | vsteam

  const load = useCallback(async () => {
    const [{ data: sh }, { data: m }, { data: sc }] = await Promise.all([
      SB.from('rifle_shooters').select('*').order('name'),
      SB.from('rifle_matches').select('*').order('week', { ascending: true }),
      SB.from('rifle_scores').select('*'),
    ]);
    setShooters(sh || []);
    setAllMatches(m || []);
    setScores(sc || []);
    setLoading(false);
    if (!profileId && sh?.length) setProfileId((sh.find((s) => s.active) || sh[0]).id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (initialProfileId) setProfileId(initialProfileId); }, [initialProfileId]);

  const matches = useMemo(() => allMatches.filter((m) => schoolYearOf(m) === season), [allMatches, season]);
  const per = useMemo(() => perShooterStats(shooters, matches, scores), [shooters, matches, scores]);
  const team = useMemo(() => teamAggregates(matches, scores), [matches, scores]);

  const rosterRows = useMemo(() => {
    const q = rosterSearch.trim().toLowerCase();
    return shooters
      .filter((s) => !q || s.name.toLowerCase().includes(q))
      .slice()
      .sort((a, b) => (b.active - a.active) || a.name.localeCompare(b.name));
  }, [shooters, rosterSearch]);

  if (loading) return <div style={{ fontFamily: mono, fontSize: 12, color: P.mute }}>Loading shooters…</div>;

  const shooter = shooters.find((s) => s.id === profileId);
  const st = profileId ? per.get(profileId) : null;

  if (!shooter) {
    return <div style={{ fontFamily: mono, fontSize: 12, color: P.mute }}>No shooters on the roster yet — add one from the Roster tab.</div>;
  }

  const matchesPlayedWeeks = st.rows.map((r) => `WK${r.match.week}`);
  const ownTotals = st.rows.map((r) => r.total);
  const teamAvgAligned = st.rows.map((r) => {
    const t = team.find((tt) => tt.match.id === r.match.id);
    return t ? round1(t.avg) : null;
  });

  const badge = badgeFor(st.pr);
  const kpis = [
    { l: 'SEASON AVG', v: st.n ? round1(st.avg) : '—' },
    { l: 'LAST 3 AVG', v: st.n ? round1(st.last3) : '—' },
    { l: 'PERSONAL RECORD', v: st.n ? st.pr : '—', c: P.bright },
    { l: 'TREND', v: st.n > 1 ? `${st.trend >= 0 ? '+' : ''}${round1(st.trend)}` : '—', c: st.trend >= 0 ? P.win : P.red },
    { l: 'MATCHES', v: st.n },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '250px minmax(0,1fr)', gap: 14, alignItems: 'start' }}>
      <div style={{ background: P.navy, border: `1px solid ${P.hair}` }}>
        <div style={{ padding: '12px 14px', borderBottom: `1px solid ${P.hair}` }}>
          <div style={{ ...label, marginBottom: 8 }}>// ROSTER · {shooters.filter((s) => s.active).length} ACTIVE</div>
          <input value={rosterSearch} onChange={(e) => setRosterSearch(e.target.value)} placeholder="search…" style={{ width: '100%', boxSizing: 'border-box', background: P.deep, border: `1px solid ${P.hair}`, color: P.cream, fontFamily: mono, fontSize: 12, padding: '7px 9px', outline: 'none' }} />
        </div>
        <div style={{ maxHeight: 620, overflowY: 'auto' }}>
          {rosterRows.map((s) => {
            const sst = per.get(s.id);
            const on = s.id === profileId;
            return (
              <div key={s.id} onClick={() => setProfileId(s.id)} style={{ display: 'grid', gridTemplateColumns: '28px minmax(0,1fr) 56px', gap: 10, alignItems: 'center', padding: '9px 14px', borderBottom: `1px solid ${P.hair}`, borderLeft: `2px solid ${on ? P.gold : 'transparent'}`, background: on ? 'rgba(201,169,97,0.07)' : 'transparent', cursor: 'pointer', opacity: s.active ? 1 : 0.55 }}>
                <div style={{ width: 28, height: 28, background: P.deep, border: `1px solid ${P.hair}`, fontFamily: oswald, fontSize: 11, color: P.bright, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{initials(s.name)}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: P.cream, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
                  <div style={{ fontFamily: mono, fontSize: 10, color: P.faint }}>{sst?.n ? `${round1(sst.avg)} avg` : 'no scores'}</div>
                </div>
                {sst && sst.rows.length > 1 ? <Sparkline values={sst.rows.map((r) => r.total)} width={50} height={20} color={P.gold} /> : <div />}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ position: 'relative', background: `linear-gradient(135deg, ${P.navy} 0%, ${P.deep} 100%)`, border: `1px solid ${P.hairStrong}`, padding: '22px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
              <div style={{ width: 72, height: 72, background: P.ink, border: `1px solid ${P.gold}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: oswald, fontSize: 26, color: P.bright }}>{initials(shooter.name)}</div>
              <div>
                <div style={{ ...label, marginBottom: 6 }}>// SHOOTER PROFILE</div>
                <div style={{ fontFamily: oswald, fontSize: 32, fontWeight: 600, color: P.cream, lineHeight: 1 }}>{shooter.name}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: mono, fontSize: 11, color: P.mute }}>{shooter.rifle_no ? `RIFLE #${shooter.rifle_no}` : 'no rifle #'} · {st.n} MATCHES</span>
                  {badge && <Badge tone="gold">{badge}</Badge>}
                  {!shooter.active && <Badge tone="mute">INACTIVE</Badge>}
                </div>
              </div>
            </div>
            <button onClick={() => onNavigate?.('lineup')} style={{ background: 'transparent', color: P.mute, border: `1px solid ${P.hairStrong}`, fontFamily: mono, fontSize: 11, letterSpacing: '0.1em', padding: '9px 14px', cursor: 'pointer' }}>+ LINEUP</button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0,1fr))', gap: 12 }}>
          {kpis.map((k, i) => (
            <div key={i} style={{ background: P.navy, border: `1px solid ${P.hair}`, padding: '12px 14px' }}>
              <div style={label}>{k.l}</div>
              <div style={{ fontFamily: oswald, fontSize: 28, fontWeight: 500, color: k.c || P.cream, marginTop: 6 }}>{k.v}</div>
            </div>
          ))}
        </div>

        <div style={{ background: P.navy, border: `1px solid ${P.hair}`, padding: '18px 20px 12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div style={{ ...label, marginBottom: 6 }}>// PERFORMANCE · {st.n} MATCHES</div>
              <div style={{ fontFamily: oswald, fontSize: 18, fontWeight: 500, color: P.cream }}>{mode === 'total' ? 'Total per match' : 'vs. team average'}</div>
            </div>
            <div style={{ display: 'flex', border: `1px solid ${P.hairStrong}` }}>
              {[['total', 'TOTAL'], ['vsteam', 'VS TEAM']].map(([id, l]) => (
                <button key={id} onClick={() => setMode(id)} style={{ background: mode === id ? 'rgba(201,169,97,0.15)' : 'transparent', color: mode === id ? P.bright : P.mute, border: 'none', fontFamily: mono, fontSize: 10, letterSpacing: '0.1em', padding: '6px 12px', cursor: 'pointer' }}>{l}</button>
              ))}
            </div>
          </div>
          {st.n > 1 ? (
            <TrendChart
              labels={matchesPlayedWeeks}
              series={mode === 'total'
                ? [{ values: ownTotals, color: P.bright, markBest: true }]
                : [{ values: ownTotals, color: P.bright, markBest: true }, { values: teamAvgAligned, color: '#6FA8DC', area: false }]}
            />
          ) : (
            <div style={{ fontFamily: mono, fontSize: 12, color: P.mute, padding: '30px 0' }}>Not enough matches yet for a trend.</div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.6fr)', gap: 14 }}>
          <div style={{ background: P.navy, border: `1px solid ${P.hair}`, padding: '18px 20px' }}>
            <div style={{ ...label, marginBottom: 16 }}>// VS TEAM AVERAGE</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {POS.map((p) => {
                const teamAvgPos = round1((() => {
                  const vals = scores.map((sc) => num(sc[p.k])).filter((v) => v > 0);
                  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
                })());
                return (
                  <div key={p.k}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                      <span style={{ fontFamily: mono, fontSize: 10, letterSpacing: '0.12em', color: P.mute }}>{p.label}</span>
                      <span style={{ fontFamily: oswald, fontSize: 20, color: P.cream }}>{round1(st[p.k])}</span>
                    </div>
                    <div style={{ height: 7, background: P.deep, position: 'relative' }}>
                      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min(100, (st[p.k] / 100) * 100)}%`, background: p.color }} />
                      <div style={{ position: 'absolute', top: -3, bottom: -3, width: 2, left: `${Math.min(100, (teamAvgPos / 100) * 100)}%`, background: P.cream }} />
                    </div>
                    <div style={{ fontFamily: mono, fontSize: 9, color: P.faint, marginTop: 4 }}>TEAM {teamAvgPos} · PR {st[`pr${p.k[0].toUpperCase()}${p.k.slice(1)}`]}</div>
                  </div>
                );
              })}
            </div>
          </div>
          <div style={{ background: P.navy, border: `1px solid ${P.hair}` }}>
            <div style={{ padding: '14px 18px 8px', ...label }}>// MATCH LOG</div>
            <div style={{ display: 'grid', gridTemplateColumns: '46px minmax(0,1fr) 42px 42px 42px 34px 56px', gap: 8, padding: '7px 18px', fontFamily: mono, fontSize: 9, color: P.gold, letterSpacing: '0.14em', background: P.deep, borderBottom: `1px solid ${P.hair}` }}>
              <span>WK</span><span>OPPONENT</span><span style={{ textAlign: 'right' }}>P</span><span style={{ textAlign: 'right' }}>S</span><span style={{ textAlign: 'right' }}>K</span><span style={{ textAlign: 'right' }}>X</span><span style={{ textAlign: 'right' }}>TOTAL</span>
            </div>
            {st.rows.length === 0 ? (
              <div style={{ padding: '14px 18px', fontFamily: mono, fontSize: 12, color: P.mute }}>No matches recorded yet.</div>
            ) : st.rows.slice().reverse().map((r) => (
              <div key={r.match.id} style={{ display: 'grid', gridTemplateColumns: '46px minmax(0,1fr) 42px 42px 42px 34px 56px', gap: 8, padding: '7px 18px', fontFamily: mono, fontSize: 12, borderBottom: `1px solid ${P.hair}` }}>
                <span style={{ color: P.faint }}>{r.match.week}</span>
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.match.opponent || '—'}</span>
                <span style={{ textAlign: 'right' }}>{r.score.prone ?? '—'}</span>
                <span style={{ textAlign: 'right' }}>{r.score.standing ?? '—'}</span>
                <span style={{ textAlign: 'right' }}>{r.score.kneeling ?? '—'}</span>
                <span style={{ textAlign: 'right', color: P.faint }}>{r.score.bulls ?? '—'}</span>
                <span style={{ textAlign: 'right', fontFamily: oswald, fontSize: 15, color: r.total >= st.avg ? P.win : P.cream }}>{r.total}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
