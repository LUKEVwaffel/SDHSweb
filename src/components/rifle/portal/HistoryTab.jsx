import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase as SB } from '../../../lib/supabaseClient';
import { P, mono } from '../theme';

// Edit history + undo for the Scores tab's CRUD — reads rifle_audit_log,
// which rifle_scores_audit.sql's trigger fills automatically on every
// insert/update/delete to rifle_scores/rifle_matches/rifle_shooters. Undo
// calls the rifle_undo_audit_entry RPC (security definer, re-checks
// is_rifle_admin()-or-is_s6() itself — this tab's own gate is just UX).
const LOAD_LIMIT = 200;
const TABLE_LABEL = { rifle_scores: 'Score', rifle_matches: 'Match', rifle_shooters: 'Shooter' };
const ACTION_LABEL = { INSERT: 'added', UPDATE: 'edited', DELETE: 'deleted' };
const ACTION_COLOR = { INSERT: 'win', UPDATE: 'gold', DELETE: 'red' };
const SCORE_FIELDS = ['prone', 'standing', 'kneeling', 'total', 'bulls'];
const MATCH_FIELDS = ['week', 'dates', 'opponent', 'location'];
const SHOOTER_FIELDS = ['name', 'rifle_no', 'active', 'school_email'];

const label = { fontFamily: mono, fontSize: 11, color: P.gold, letterSpacing: '0.1em' };
const inputStyle = { background: P.deep, border: `1px solid ${P.hair}`, color: P.cream, fontFamily: mono, fontSize: 13, padding: '9px 11px', outline: 'none' };

function fieldsFor(table) {
  return table === 'rifle_scores' ? SCORE_FIELDS : table === 'rifle_matches' ? MATCH_FIELDS : SHOOTER_FIELDS;
}

function changedFields(entry) {
  if (entry.action !== 'UPDATE') return null;
  return fieldsFor(entry.table_name).filter((f) => String(entry.old_data?.[f] ?? '') !== String(entry.new_data?.[f] ?? ''));
}

export default function HistoryTab() {
  const [entries, setEntries] = useState([]);
  const [shooters, setShooters] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [search, setSearch] = useState('');
  const [tableFilter, setTableFilter] = useState('All');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setErr('');
    const [{ data: e, error: eErr }, { data: s }, { data: m }] = await Promise.all([
      SB.from('rifle_audit_log').select('*').order('changed_at', { ascending: false }).limit(LOAD_LIMIT),
      SB.from('rifle_shooters').select('id, name'),
      SB.from('rifle_matches').select('id, week, opponent, dates'),
    ]);
    if (eErr) { setErr(eErr.message); setLoading(false); return; }
    setEntries(e || []);
    setShooters(s || []);
    setMatches(m || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function flash(msg) {
    setOk(msg);
    setTimeout(() => setOk(''), 2000);
  }

  const shooterName = useCallback((id) => shooters.find((s) => s.id === id)?.name || null, [shooters]);
  const matchLabel = useCallback((id) => {
    const m = matches.find((mm) => mm.id === id);
    if (!m) return null;
    return `Week ${m.week}${m.opponent ? ` vs ${m.opponent}` : ''}`;
  }, [matches]);

  // Human-readable subject line for one entry — the ids in old_data/new_data
  // are meaningless on their own, so resolve shooter/match names for display.
  function subjectFor(entry) {
    const data = entry.new_data || entry.old_data || {};
    if (entry.table_name === 'rifle_scores') {
      const shooter = shooterName(data.shooter_id) || 'Unknown shooter';
      const match = matchLabel(data.match_id) || 'an unknown match';
      return `${shooter} — ${match}`;
    }
    if (entry.table_name === 'rifle_matches') {
      return `Week ${data.week ?? '?'}${data.opponent ? ` vs ${data.opponent}` : ''}`;
    }
    return data.name || 'Unknown shooter';
  }

  const searchable = useMemo(() => entries.map((e) => ({
    entry: e,
    text: [subjectFor(e), e.changed_by, e.table_name, e.action].join(' ').toLowerCase(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  })), [entries, shooters, matches]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return searchable
      .filter(({ entry }) => tableFilter === 'All' || entry.table_name === tableFilter)
      .filter(({ text }) => !q || text.includes(q))
      .map(({ entry }) => entry);
  }, [searchable, search, tableFilter]);

  async function undo(entry) {
    if (!confirm(`Undo this ${ACTION_LABEL[entry.action]} on ${TABLE_LABEL[entry.table_name].toLowerCase()} "${subjectFor(entry)}"?`)) return;
    setBusyId(entry.id);
    setErr('');
    const { error } = await SB.rpc('rifle_undo_audit_entry', { p_audit_id: entry.id });
    setBusyId(null);
    if (error) { setErr(error.message); return; }
    await load();
    flash('Undone');
  }

  if (loading) return <div style={{ fontFamily: mono, fontSize: 12, color: P.mute }}>Loading history…</div>;

  return (
    <div>
      <div style={{ fontFamily: mono, fontSize: 12, color: P.mute, marginBottom: 20, lineHeight: 1.6 }}>
        Every edit to matches, scores, and the roster — most recent {LOAD_LIMIT} changes. Undo reverts one
        entry back to what it was before that change; undoing itself is logged too, so nothing disappears
        from the trail.
      </div>

      {err && <div style={{ fontFamily: mono, fontSize: 12, color: P.red, marginBottom: 14 }}>{err}</div>}
      {ok && <div style={{ fontFamily: mono, fontSize: 12, color: P.win, marginBottom: 14 }}>{ok}</div>}

      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 18 }}>
        <div>
          <div style={{ ...label, marginBottom: 6 }}>SEARCH</div>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="shooter, match, editor's email…" style={{ ...inputStyle, minWidth: 240 }} />
        </div>
        <div>
          <div style={{ ...label, marginBottom: 6 }}>TABLE</div>
          <select value={tableFilter} onChange={(e) => setTableFilter(e.target.value)} style={inputStyle}>
            <option value="All">All</option>
            <option value="rifle_scores">Scores</option>
            <option value="rifle_matches">Matches</option>
            <option value="rifle_shooters">Shooters</option>
          </select>
        </div>
      </div>

      {visible.length === 0 ? (
        <div style={{ fontFamily: mono, fontSize: 12, color: P.mute }}>No matching history.</div>
      ) : visible.map((e) => {
        const fields = changedFields(e);
        const color = P[ACTION_COLOR[e.action]] || P.mute;
        return (
          <div key={e.id} style={{ border: `1px solid ${P.hair}`, padding: '12px 14px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, opacity: e.undone ? 0.55 : 1 }}>
            <div style={{ fontFamily: mono, fontSize: 12 }}>
              <div style={{ marginBottom: 4 }}>
                <span style={{ color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{TABLE_LABEL[e.table_name]} {ACTION_LABEL[e.action]}</span>
                {e.undone && <span style={{ color: P.mute }}> · UNDONE</span>}
              </div>
              <div style={{ color: P.cream, marginBottom: 4 }}>{subjectFor(e)}</div>
              {e.action === 'UPDATE' && fields?.length > 0 && (
                <div style={{ color: P.mute }}>
                  {fields.map((f) => `${f}: ${e.old_data?.[f] ?? '—'} → ${e.new_data?.[f] ?? '—'}`).join(' · ')}
                </div>
              )}
              <div style={{ color: P.faint, marginTop: 4, fontSize: 11 }}>
                {new Date(e.changed_at).toLocaleString()} · {e.changed_by || 'system'}
              </div>
            </div>
            {!e.undone && (
              <button
                onClick={() => undo(e)} disabled={busyId === e.id}
                style={{ background: 'transparent', border: `1px solid ${P.hairStrong}`, color: P.gold, fontFamily: mono, fontSize: 11, letterSpacing: '0.06em', padding: '7px 14px', cursor: busyId === e.id ? 'wait' : 'pointer', whiteSpace: 'nowrap' }}
              >
                {busyId === e.id ? 'UNDOING…' : 'UNDO'}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
