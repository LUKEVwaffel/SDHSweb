import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase as SB } from '../../../lib/supabaseClient';
import { P, mono, oswald } from '../theme';
import { TrendChart, Sparkline } from './charts';
import { perShooterStats, teamAggregates, nextUpcomingMatch, avgOf, round1, num, schoolYearOf } from './rifleStats';

const label = { fontFamily: mono, fontSize: 9, color: P.gold, letterSpacing: '0.24em' };

function parseDate(str) {
  const m = (str || '').match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  const d = new Date(m ? m[1] : str);
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysUntil(date) {
  if (!date) return null;
  const ms = date.setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0);
  return Math.round(ms / 86400000);
}

export default function DashboardTab({ season, onNavigate }) {
  const [shooters, setShooters] = useState([]);
  const [allMatches, setAllMatches] = useState([]);
  const [scores, setScores] = useState([]);
  const [uploads, setUploads] = useState([]);
  const [signups, setSignups] = useState([]);
  const [lineupCount, setLineupCount] = useState(null);
  const [auditLog, setAuditLog] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [{ data: sh }, { data: m }, { data: sc }, { data: up }, { data: su }, { data: al }] = await Promise.all([
      SB.from('rifle_shooters').select('*').order('name'),
      SB.from('rifle_matches').select('*').order('week', { ascending: false }),
      SB.from('rifle_scores').select('*'),
      SB.from('rifle_comp_uploads').select('id, status, created_at').order('created_at', { ascending: false }).limit(10),
      SB.from('rifle_signups_review_view').select('id, school_email, cadet_name, created_at'),
      SB.from('rifle_audit_log').select('id, table_name, action, row_id, new_data, old_data, changed_at').order('changed_at', { ascending: false }).limit(8),
    ]);
    setShooters(sh || []);
    setAllMatches(m || []);
    setScores(sc || []);
    setUploads(up || []);
    setSignups(su || []);
    setAuditLog(al || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const matches = useMemo(() => allMatches.filter((m) => schoolYearOf(m) === season), [allMatches, season]);
  const per = useMemo(() => perShooterStats(shooters, matches, scores), [shooters, matches, scores]);
  const team = useMemo(() => teamAggregates(matches, scores), [matches, scores]);
  const nextMatch = useMemo(() => nextUpcomingMatch(matches, scores), [matches, scores]);

  useEffect(() => {
    if (!nextMatch) { setLineupCount(null); return; }
    let cancelled = false;
    SB.from('rifle_lineups').select('slot', { count: 'exact', head: true }).eq('match_id', nextMatch.id).then(({ count }) => {
      if (!cancelled) setLineupCount(count || 0);
    });
    return () => { cancelled = true; };
  }, [nextMatch]);

  if (loading) return <div style={{ fontFamily: mono, fontSize: 12, color: P.mute }}>Loading dashboard…</div>;

  const last = team[team.length - 1];
  const prev = team[team.length - 2];
  const aggs = team.map((t) => t.agg);
  const best = aggs.length ? Math.max(...aggs) : 0;
  const bestRow = team[aggs.indexOf(best)];
  const activeShooters = shooters.filter((s) => s.active);
  const teamAvg = avgOf([...per.values()].filter((p) => p.n).map((p) => p.avg));

  const leaders = [...per.entries()]
    .filter(([, st]) => st.n)
    .sort((a, b) => b[1].avg - a[1].avg)
    .slice(0, 5)
    .map(([id, st]) => ({ shooter: shooters.find((s) => s.id === id), st }));

  const posLabels = [
    { k: 'prone', label: 'PRONE', color: P.gold },
    { k: 'standing', label: 'STANDING', color: '#6FA8DC' },
    { k: 'kneeling', label: 'KNEELING', color: '#B99AE0' },
  ];
  const teamPos = posLabels.map((p) => {
    const played = matches.filter((m) => scores.some((sc) => sc.match_id === m.id)).sort((a, b) => (a.week ?? 0) - (b.week ?? 0));
    const matchAvg = (m) => avgOf(scores.filter((sc) => sc.match_id === m.id).map((sc) => num(sc[p.k])));
    const first = avgOf(played.slice(0, 3).map(matchAvg));
    const lastN = avgOf(played.slice(-3).map(matchAvg));
    const all = avgOf(played.map(matchAvg));
    const d = lastN - first;
    return { ...p, v: round1(all), d, pct: Math.max(0, Math.min(100, ((all - 50) / 50) * 100)) };
  });

  const noSchoolEmail = activeShooters.filter((s) => !s.school_email).length;
  const shooterEmails = new Set(shooters.map((s) => (s.school_email || '').toLowerCase()).filter(Boolean));
  const unmatchedSignups = signups.filter((s) => !shooterEmails.has((s.school_email || '').toLowerCase())).length;
  const pendingUploads = uploads.filter((u) => u.status === 'pending_review').length;

  const alerts = [
    pendingUploads > 0 && {
      title: `${pendingUploads} score upload${pendingUploads === 1 ? '' : 's'} waiting for review`,
      sub: 'From Comp Upload · AI-parsed, not yet published', cta: 'REVIEW', color: P.warn, go: () => onNavigate('compupload'),
    },
    unmatchedSignups > 0 && {
      title: `${unmatchedSignups} signup${unmatchedSignups === 1 ? '' : 's'} aren't matched to the roster`,
      sub: 'From /rifle/signup', cta: 'REVIEW', color: P.gold, go: () => onNavigate('signups'),
    },
    nextMatch && lineupCount === 0 && {
      title: `Lineup for Week ${nextMatch.week} not built yet`,
      sub: nextMatch.opponent || 'Next match', cta: 'BUILD', color: '#6FA8DC', go: () => onNavigate('lineup'),
    },
    noSchoolEmail > 0 && {
      title: `${noSchoolEmail} active shooter${noSchoolEmail === 1 ? '' : 's'} missing school email`,
      sub: 'Needed to auto-link signups', cta: 'FIX', color: P.red, go: () => onNavigate('roster'),
    },
  ].filter(Boolean);

  const shooterNameFor = (id) => shooters.find((s) => s.id === id)?.name || 'A shooter';
  const matchLabelFor = (id) => { const m = matches.find((mm) => mm.id === id); return m ? `Week ${m.week}${m.opponent ? ` vs ${m.opponent}` : ''}` : 'a match'; };
  const activity = [
    ...auditLog.map((e) => ({
      t: e.changed_at, kind: e.action === 'INSERT' ? 'ADDED' : e.action === 'DELETE' ? 'REMOVED' : 'EDITED',
      color: e.action === 'DELETE' ? P.red : e.action === 'INSERT' ? P.win : P.bright,
      text: e.table_name === 'rifle_scores'
        ? `${shooterNameFor((e.new_data || e.old_data)?.shooter_id)} — ${matchLabelFor((e.new_data || e.old_data)?.match_id)}`
        : e.table_name === 'rifle_matches'
        ? `Week ${(e.new_data || e.old_data)?.week ?? '?'}${(e.new_data || e.old_data)?.opponent ? ` vs ${(e.new_data || e.old_data).opponent}` : ''}`
        : (e.new_data || e.old_data)?.name || 'Roster change',
    })),
    ...uploads.slice(0, 4).map((u) => ({ t: u.created_at, kind: 'IMPORT', color: P.gold, text: `Score sheet ${u.status.replace('_', ' ')}` })),
    ...signups.slice(0, 3).map((s) => ({ t: s.created_at, kind: 'SIGNUP', color: P.win, text: s.cadet_name ? `${s.cadet_name} signed up` : 'New interest signup' })),
  ].sort((a, b) => new Date(b.t) - new Date(a.t)).slice(0, 8);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const nextDate = nextMatch ? parseDate(nextMatch.dates) : null;
  const dOut = daysUntil(nextDate);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 22, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ ...label, marginBottom: 8 }}>// COMMAND · DASHBOARD</div>
          <div style={{ fontFamily: oswald, fontSize: 34, fontWeight: 600, color: P.cream, lineHeight: 1 }}>{greeting}.</div>
        </div>
        <div style={{ fontFamily: mono, fontSize: 11, color: P.mute, letterSpacing: '0.1em' }}>
          {new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0,1fr))', gap: 14 }}>
        {/* Next match hero */}
        <div style={{ gridColumn: 'span 5', position: 'relative', background: `linear-gradient(135deg, ${P.navy} 0%, ${P.deep} 100%)`, border: `1px solid ${P.hairStrong}`, padding: '22px 24px', minHeight: 190, overflow: 'hidden' }}>
          {nextMatch ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                <div>
                  <div style={{ ...label, marginBottom: 12 }}>// NEXT MATCH · WK {nextMatch.week}</div>
                  <div style={{ fontFamily: oswald, fontSize: 28, fontWeight: 600, color: P.cream, lineHeight: 1.1, marginBottom: 6 }}>{nextMatch.opponent || 'Opponent TBD'}</div>
                  <div style={{ fontFamily: mono, fontSize: 11, color: P.mute, letterSpacing: '0.08em' }}>{[nextMatch.dates, nextMatch.location].filter(Boolean).join(' · ') || 'Date/location TBD'}</div>
                </div>
                {dOut != null && (
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: oswald, fontSize: 64, fontWeight: 600, lineHeight: 0.85, color: P.bright }}>{Math.max(0, dOut)}</div>
                    <div style={{ ...label, marginTop: 6 }}>DAYS OUT</div>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 22 }}>
                <button onClick={() => onNavigate('lineup')} style={{ background: P.gold, color: P.ink, border: 'none', fontFamily: mono, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', padding: '9px 14px', cursor: 'pointer' }}>BUILD LINEUP →</button>
                <button onClick={() => onNavigate('scores', { matchId: nextMatch.id })} style={{ background: 'transparent', color: P.mute, border: `1px solid ${P.hairStrong}`, fontFamily: mono, fontSize: 11, letterSpacing: '0.1em', padding: '9px 14px', cursor: 'pointer' }}>OPEN IN SCORES</button>
              </div>
            </>
          ) : (
            <div style={{ fontFamily: mono, fontSize: 12, color: P.mute }}>No upcoming match scheduled — every match has scores recorded.</div>
          )}
        </div>

        {/* KPIs */}
        <div style={{ gridColumn: 'span 7', display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 14 }}>
          {[
            { l: last ? `LAST AGGREGATE · WK ${last.match.week}` : 'LAST AGGREGATE', v: last ? last.agg.toLocaleString() : '—', unit: '/ 1,200', spark: aggs, sub: last && prev ? `${last.agg - prev.agg >= 0 ? '▲ +' : '▼ '}${last.agg - prev.agg} vs wk ${prev.match.week}` : (last ? 'first recorded match' : 'no matches yet'), sc: last && prev && last.agg >= prev.agg ? P.win : P.red },
            { l: 'SEASON BEST', v: aggs.length ? best.toLocaleString() : '—', unit: 'AGG', spark: team.map((t) => t.avg), sub: bestRow ? `WK ${bestRow.match.week} · ${(bestRow.match.opponent || '').toUpperCase()}` : '—', sc: P.mute },
            { l: 'ACTIVE ROSTER', v: String(activeShooters.length), unit: 'SHOOTERS', spark: null, sub: `AVG ${round1(teamAvg)} / 300 PER SHOOTER`, sc: P.mute },
          ].map((k, i) => (
            <div key={i} style={{ position: 'relative', background: P.navy, border: `1px solid ${P.hair}`, padding: '16px 18px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div style={label}>{k.l}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 12 }}>
                <div style={{ fontFamily: oswald, fontSize: 40, fontWeight: 500, color: P.cream, lineHeight: 1 }}>{k.v}</div>
                <div style={{ fontFamily: mono, fontSize: 11, color: P.faint }}>{k.unit}</div>
              </div>
              <div style={{ margin: '8px 0 6px' }}>{k.spark && k.spark.length > 1 ? <Sparkline values={k.spark} width={180} height={30} color={P.bright} /> : <div style={{ height: 30 }} />}</div>
              <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: '0.06em', color: k.sc }}>{k.sub}</div>
            </div>
          ))}
        </div>

        {/* Team chart */}
        <div style={{ gridColumn: 'span 8', background: P.navy, border: `1px solid ${P.hair}`, padding: '18px 20px 12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <div>
              <div style={{ ...label, marginBottom: 6 }}>// TEAM AGGREGATE · TOP 4</div>
              <div style={{ fontFamily: oswald, fontSize: 18, fontWeight: 500, color: P.cream }}>Season trajectory</div>
            </div>
          </div>
          {team.length ? (
            <TrendChart series={[{ values: aggs, color: P.bright, markBest: true }]} labels={team.map((t) => `WK${t.match.week}`)} target={1100} />
          ) : (
            <div style={{ fontFamily: mono, fontSize: 12, color: P.mute, padding: '30px 0' }}>No matches with scores yet.</div>
          )}
        </div>

        {/* Alerts */}
        <div style={{ gridColumn: 'span 4', background: P.navy, border: `1px solid ${P.hair}`, padding: '18px 20px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={label}>// NEEDS ATTENTION</div>
            {alerts.length > 0 && <div style={{ fontFamily: mono, fontSize: 9, color: P.warn, letterSpacing: '0.18em' }}>{alerts.length} OPEN</div>}
          </div>
          {alerts.length === 0 ? (
            <div style={{ fontFamily: mono, fontSize: 12, color: P.mute }}>Nothing needs attention right now.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {alerts.map((a, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: 12, background: 'rgba(10,22,40,0.7)', border: `1px solid ${P.hair}` }}>
                  <div style={{ width: 3, alignSelf: 'stretch', background: a.color }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: P.cream, lineHeight: 1.35 }}>{a.title}</div>
                    <div style={{ fontFamily: mono, fontSize: 10, color: P.faint, marginTop: 4 }}>{a.sub}</div>
                  </div>
                  <button onClick={a.go} style={{ whiteSpace: 'nowrap', background: 'transparent', border: `1px solid ${a.color}66`, color: a.color, fontFamily: mono, fontSize: 10, letterSpacing: '0.1em', padding: '5px 9px', cursor: 'pointer' }}>{a.cta}</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Leaders */}
        <div style={{ gridColumn: 'span 5', background: P.navy, border: `1px solid ${P.hair}`, padding: '18px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={label}>// LEADERS · SEASON AVG</div>
            <a onClick={() => onNavigate('lineup')} style={{ fontFamily: mono, fontSize: 10, letterSpacing: '0.1em', color: P.gold, cursor: 'pointer' }}>FULL BOARD →</a>
          </div>
          {leaders.length === 0 ? (
            <div style={{ fontFamily: mono, fontSize: 12, color: P.mute }}>No scores recorded yet.</div>
          ) : leaders.map((l, i) => (
            <div key={l.shooter.id} onClick={() => onNavigate('shooters', { profileId: l.shooter.id })} style={{ display: 'grid', gridTemplateColumns: '26px minmax(0,1fr) 140px 54px', gap: 12, alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${P.hair}`, cursor: 'pointer' }}>
              <div style={{ fontFamily: oswald, fontSize: 18, color: i === 0 ? P.bright : P.mute }}>{i + 1}</div>
              <div style={{ fontSize: 13, color: P.cream, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.shooter.name}</div>
              <div style={{ display: 'flex', height: 6, gap: 2 }}>
                <div style={{ width: `${Math.min(100, (l.st.prone / 100) * 100)}%`, background: P.gold }} />
                <div style={{ width: `${Math.min(100, (l.st.standing / 100) * 100)}%`, background: '#6FA8DC' }} />
                <div style={{ width: `${Math.min(100, (l.st.kneeling / 100) * 100)}%`, background: '#B99AE0' }} />
              </div>
              <div style={{ fontFamily: mono, fontSize: 13, textAlign: 'right', color: P.bright }}>{round1(l.st.avg)}</div>
            </div>
          ))}
        </div>

        {/* Position breakdown */}
        <div style={{ gridColumn: 'span 3', background: P.navy, border: `1px solid ${P.hair}`, padding: '18px 20px' }}>
          <div style={{ ...label, marginBottom: 16 }}>// TEAM BY POSITION</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {teamPos.map((p) => (
              <div key={p.k}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                  <span style={{ fontFamily: mono, fontSize: 10, letterSpacing: '0.12em', color: P.mute }}>{p.label}</span>
                  <span style={{ fontFamily: oswald, fontSize: 20, color: P.cream }}>{p.v}<span style={{ fontFamily: mono, fontSize: 9, color: p.d >= 0 ? P.win : P.red, marginLeft: 5 }}>{p.d >= 0 ? '+' : ''}{round1(p.d)}</span></span>
                </div>
                <div style={{ height: 7, background: P.deep, position: 'relative' }}>
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${p.pct}%`, background: p.color }} />
                </div>
              </div>
            ))}
          </div>
          <div style={{ fontFamily: mono, fontSize: 9, color: P.faint, marginTop: 16, lineHeight: 1.6 }}>Change is last 3 matches vs first 3.</div>
        </div>

        {/* Activity */}
        <div style={{ gridColumn: 'span 4', background: P.navy, border: `1px solid ${P.hair}`, padding: '18px 20px' }}>
          <div style={{ ...label, marginBottom: 12 }}>// RECENT ACTIVITY</div>
          {activity.length === 0 ? (
            <div style={{ fontFamily: mono, fontSize: 12, color: P.mute }}>No activity yet.</div>
          ) : activity.map((a, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '58px minmax(0,1fr)', gap: 12, padding: '8px 0', borderBottom: `1px solid ${P.hair}` }}>
              <div style={{ fontFamily: mono, fontSize: 10, color: P.faint }}>{new Date(a.t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div>
              <div>
                <div style={{ fontFamily: mono, fontSize: 9, letterSpacing: '0.14em', color: a.color }}>{a.kind}</div>
                <div style={{ fontSize: 13, color: 'rgba(244,236,216,0.85)', marginTop: 2 }}>{a.text}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
