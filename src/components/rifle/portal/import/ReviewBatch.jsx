import { useEffect, useMemo, useRef, useState } from 'react';
import { P, mono } from '../../theme';
import { Badge, PrimaryBtn, DangerBtn, inputStyle } from '../ui';
import { schoolYearOf } from '../rifleStats';
import { validateDrafts, finalizeDrafts, draftsToUploadRows, diffAgainstExisting, targetName } from './review.js';
import { createMatch, createUploadRecord, fetchMatchScores, publishScores } from './scoreImportApi.js';

// One reviewable block of imported rows (a file, a sheet, or one week-group
// of the season workbook) → pick the match, fix anything flagged, publish.
// Shared by the Scores Editor import modal and the Comp Upload tab so both
// surfaces validate and write exactly the same way.

const cell = { ...inputStyle, fontSize: 12, padding: '6px 4px', width: 58, textAlign: 'center', boxSizing: 'border-box' };
const label = { fontFamily: mono, fontSize: 9, color: P.gold, letterSpacing: '0.16em' };
const FIELDS = [['prone', 'P'], ['standing', 'S'], ['kneeling', 'K'], ['total', 'TOT'], ['bulls', 'X']];
const LEVEL_COLOR = { error: P.red, warn: P.warn, info: P.mute };
const STATUS_TONE = { new: 'win', update: 'warn', same: 'mute' };

function sumPlaceholder(d) {
  const v = ['prone', 'standing', 'kneeling'].map((f) => Number(String(d[f]).replace(',', '.')));
  return v.every((n) => Number.isFinite(n) && String(d.prone).trim() && String(d.standing).trim() && String(d.kneeling).trim())
    ? String(Math.round((v[0] + v[1] + v[2]) * 10) / 10) : '';
}

function MatchPicker({ batch, matches, season, onChange }) {
  const inSeason = season ? matches.filter((m) => schoolYearOf(m) === season) : matches;
  const others = season ? matches.filter((m) => schoolYearOf(m) !== season) : [];
  const opt = (m) => <option key={m.id} value={m.id}>Week {m.week}{m.opponent ? ` — vs ${m.opponent}` : ''}{m.dates ? ` (${m.dates})` : ''}</option>;
  const nm = batch.newMatch;
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <select aria-label="Match for these scores" value={batch.matchId} onChange={(e) => onChange({ matchId: e.target.value })} style={{ ...inputStyle, fontSize: 12, minWidth: 220, maxWidth: '100%' }}>
        <option value="">Assign to match…</option>
        <option value="__new__">+ New match…</option>
        {inSeason.length > 0 && <optgroup label={season ? `${season} season` : 'Matches'}>{inSeason.map(opt)}</optgroup>}
        {others.length > 0 && <optgroup label="Other seasons">{others.map(opt)}</optgroup>}
      </select>
      {batch.matchId === '__new__' && (
        <>
          <input aria-label="Week number" value={nm.week} onChange={(e) => onChange({ newMatch: { ...nm, week: e.target.value.replace(/\D/g, '').slice(0, 2) } })} placeholder="Week #" style={{ ...inputStyle, fontSize: 12, width: 72 }} />
          <input aria-label="Dates" value={nm.dates} onChange={(e) => onChange({ newMatch: { ...nm, dates: e.target.value } })} placeholder="Dates e.g. 10/6–10/12, 2026" style={{ ...inputStyle, fontSize: 12, width: 190 }} />
          <input aria-label="Opponent" value={nm.opponent} onChange={(e) => onChange({ newMatch: { ...nm, opponent: e.target.value } })} placeholder="Opponent" style={{ ...inputStyle, fontSize: 12, width: 150 }} />
        </>
      )}
    </div>
  );
}

export default function ReviewBatch({ batch, matches, season, shooters, rosterNames, onChange, onMatchCreated, onPublished, onDiscard }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [existing, setExisting] = useState(null); // Map(shooter_id → score) for the picked match
  const [existingErr, setExistingErr] = useState('');
  // Synchronous re-entry guard: `busy` is React state, so a fast double
  // click/tap can land before the re-render that disables the button — that
  // published one batch twice (two duplicate matches) on 2026-10-02.
  const inFlight = useRef(false);

  const realMatchId = batch.matchId && batch.matchId !== '__new__' ? batch.matchId : null;
  useEffect(() => {
    let live = true;
    setExisting(null);
    setExistingErr('');
    if (!realMatchId) return undefined;
    fetchMatchScores(realMatchId)
      .then((rows) => { if (live) setExisting(new Map(rows.map((r) => [r.shooter_id, r]))); })
      .catch((e) => { if (live) setExistingErr(`${e.message} Can't check for overwrites — pick the match again to retry.`); });
    return () => { live = false; };
  }, [realMatchId]);

  const validation = useMemo(() => validateDrafts(batch.drafts, rosterNames), [batch.drafts, rosterNames]);
  const shooterByLower = useMemo(() => new Map(shooters.map((s) => [s.name.toLowerCase(), s])), [shooters]);
  const finals = useMemo(() => new Map(batch.drafts.filter((d) => d.include).map((d) => [d.key, finalizeDrafts([d])[0]])), [batch.drafts]);

  const statusOf = (d) => {
    if (!existing || !d.include) return null;
    const s = shooterByLower.get(targetName(d).toLowerCase());
    return diffAgainstExisting(finals.get(d.key), s ? existing.get(s.id) : null);
  };
  const counts = { new: 0, update: 0, same: 0 };
  batch.drafts.forEach((d) => { const s = statusOf(d); if (s) counts[s]++; });

  function editDraft(key, patch) {
    onChange({ drafts: batch.drafts.map((d) => {
      if (d.key !== key) return d;
      const next = { ...d, ...patch };
      if ('name' in patch && patch.name.trim() && !d.include) next.include = true; // typing a name opts the row in
      return next;
    }) });
  }
  const setAll = (include) => onChange({ drafts: batch.drafts.map((d) => ({ ...d, include })) });

  async function publish() {
    if (inFlight.current) return;
    setErr('');
    if (validation.errorCount) { setErr('Fix the rows marked in red first.'); return; }
    if (!batch.matchId) { setErr('Pick which match these scores belong to.'); return; }
    if (realMatchId && !existing) { setErr('Still checking this match\'s existing scores — try again in a second.'); return; }
    if (counts.update && !confirm(`${counts.update} shooter${counts.update === 1 ? ' already has' : 's already have'} different scores in this match. Overwrite with the imported values?`)) return;
    inFlight.current = true;
    setBusy(true);
    try {
      let matchId = batch.matchId;
      if (matchId === '__new__') {
        const m = await createMatch(batch.newMatch);
        matchId = m.id;
        onChange({ matchId });
        onMatchCreated?.(m);
      }
      const rows = finalizeDrafts(batch.drafts);
      const uploadRows = draftsToUploadRows(batch.drafts);
      let uploadId = batch.uploadId;
      let uploadDraft = batch.uploadDraft;
      if (!uploadId) {
        // Saved before the scores so a failed publish leaves a retryable
        // draft in Comp Upload instead of losing the import.
        const rec = await createUploadRecord({ rawText: batch.rawText, rows: uploadRows, notes: batch.notes, source: batch.source });
        uploadId = rec.id;
        uploadDraft = rec.draft;
        onChange({ uploadId, uploadDraft });
      }
      const res = await publishScores({ rows, matchId, uploadId, uploadRows, uploadDraft });
      const msg = `Published ${res.written} score${res.written === 1 ? '' : 's'}${res.created.length ? ` · added ${res.created.length} new shooter${res.created.length === 1 ? '' : 's'}` : ''}`;
      onChange({ status: 'published', matchId, resultMsg: res.warning ? `${msg} — ${res.warning}` : msg });
      onPublished?.(msg, res);
    } catch (e) {
      setErr(e.message || 'Publish failed.');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  if (batch.status === 'published' || batch.status === 'skipped') {
    return (
      <div style={{ border: `1px solid ${P.hair}`, padding: '10px 14px', marginBottom: 10, display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', opacity: 0.75 }}>
        <span style={{ fontFamily: mono, fontSize: 11, color: P.cream }}>{batch.title}</span>
        <span style={{ fontFamily: mono, fontSize: 11, color: batch.status === 'published' ? P.win : P.mute }}>{batch.status === 'published' ? `✓ ${batch.resultMsg}` : 'Skipped'}</span>
      </div>
    );
  }

  const issueList = [];
  batch.drafts.forEach((d, i) => (validation.rows.get(d.key) || []).forEach((it) => {
    if (it.level !== 'info') issueList.push({ ...it, where: `Row ${i + 1} · ${targetName(d) || d.raw_name || '?'}` });
  }));
  issueList.sort((a, b) => (a.level === 'error' ? 0 : 1) - (b.level === 'error' ? 0 : 1));
  const allOn = batch.drafts.every((d) => d.include);

  return (
    <section aria-label={batch.title} style={{ border: `1px solid ${P.hairStrong}`, marginBottom: 16, background: 'rgba(10,22,40,0.6)' }}>
      <header style={{ padding: '12px 14px', background: P.ink, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'baseline' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ ...label, marginBottom: 4 }}>{batch.parser === 'ai' ? '// READ BY AI — CHECK CAREFULLY' : '// READ FROM SHEET HEADERS'}</div>
            <div style={{ fontFamily: mono, fontSize: 13, color: P.cream, wordBreak: 'break-word' }}>{batch.title}</div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <Badge tone="gold">{validation.includedCount}/{batch.drafts.length} rows</Badge>
            {existing && counts.new > 0 && <Badge tone="win">{counts.new} new</Badge>}
            {existing && counts.update > 0 && <Badge tone="warn">{counts.update} overwrite</Badge>}
            {existing && counts.same > 0 && <Badge tone="mute">{counts.same} unchanged</Badge>}
          </div>
        </div>
        <MatchPicker batch={batch} matches={matches} season={season} onChange={onChange} />
      </header>

      {batch.notes && <div style={{ fontFamily: mono, fontSize: 11, color: P.mute, padding: '10px 14px 0', fontStyle: 'italic' }}>AI note: {batch.notes}</div>}

      <div style={{ overflowX: 'auto', padding: '8px 0' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 720, fontFamily: mono, fontSize: 12 }}>
          <thead>
            <tr style={{ textAlign: 'left' }}>
              <th style={{ ...label, padding: '6px 8px 6px 14px', width: 28 }}>
                <input type="checkbox" aria-label="Include all rows" checked={allOn} onChange={(e) => setAll(e.target.checked)} />
              </th>
              <th style={{ ...label, padding: 6 }}>ON SHEET</th>
              <th style={{ ...label, padding: 6 }}>SHOOTER</th>
              {FIELDS.map(([, l]) => <th key={l} style={{ ...label, padding: 6, textAlign: 'center' }}>{l}</th>)}
              <th style={{ ...label, padding: 6 }} />
              <th style={{ width: 28 }} />
            </tr>
          </thead>
          <tbody>
            {batch.drafts.map((d) => {
              const issues = validation.rows.get(d.key) || [];
              const hasErr = issues.some((x) => x.level === 'error');
              const status = statusOf(d);
              const onRoster = rosterNames.some((n) => n.toLowerCase() === targetName(d).toLowerCase());
              return (
                <tr key={d.key} style={{ borderTop: `1px solid ${P.hair}`, background: hasErr ? 'rgba(232,137,122,0.08)' : 'transparent', opacity: d.include ? 1 : 0.5 }}>
                  <td style={{ padding: '6px 8px 6px 14px' }}>
                    <input type="checkbox" aria-label={`Include ${d.raw_name}`} checked={d.include} onChange={(e) => editDraft(d.key, { include: e.target.checked })} />
                  </td>
                  <td style={{ padding: 6, color: P.faint, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.raw_name}>{d.raw_name || '—'}</td>
                  <td style={{ padding: 6 }}>
                    <input
                      aria-label={`Roster name for ${d.raw_name}`} list="rifle-import-roster" value={d.name}
                      onChange={(e) => editDraft(d.key, { name: e.target.value })}
                      placeholder={d.include ? `new: ${d.raw_name}` : 'not on roster — pick or tick'}
                      style={{ ...inputStyle, fontSize: 12, padding: '6px 8px', width: 170, borderColor: !d.include ? P.hair : onRoster ? (d.how === 'fuzzy' ? P.warn : P.hair) : P.gold }}
                      title={d.how === 'fuzzy' ? 'Fuzzy match — double-check' : undefined}
                    />
                  </td>
                  {FIELDS.map(([f]) => (
                    <td key={f} style={{ padding: 4, textAlign: 'center' }}>
                      <input
                        aria-label={`${f} for ${d.raw_name}`} inputMode="decimal" value={d[f]}
                        placeholder={f === 'total' ? sumPlaceholder(d) : ''}
                        onChange={(e) => editDraft(d.key, { [f]: e.target.value })}
                        style={{ ...cell, borderColor: issues.some((x) => x.level === 'error' && x.text.startsWith(f)) ? P.red : P.hair }}
                      />
                    </td>
                  ))}
                  <td style={{ padding: 6, whiteSpace: 'nowrap' }}>
                    {status && <Badge tone={STATUS_TONE[status]}>{status === 'update' ? 'overwrite' : status}</Badge>}
                    {issues.length > 0 && (
                      <span title={issues.map((x) => x.text).join('\n')} style={{ marginLeft: 6, color: LEVEL_COLOR[hasErr ? 'error' : issues.some((x) => x.level === 'warn') ? 'warn' : 'info'] }}>
                        {hasErr ? '✕' : issues.some((x) => x.level === 'warn') ? '!' : 'i'}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: 6 }}>
                    <button type="button" aria-label={`Remove ${d.raw_name}`} onClick={() => onChange({ drafts: batch.drafts.filter((x) => x.key !== d.key) })}
                      style={{ background: 'none', border: 'none', color: 'rgba(232,137,122,0.6)', cursor: 'pointer', fontSize: 14 }}>×</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {(issueList.length > 0 || validation.batch.length > 0) && (
        <ul style={{ listStyle: 'none', margin: 0, padding: '4px 14px 10px', maxHeight: 160, overflowY: 'auto' }}>
          {validation.batch.map((it, i) => <li key={`b${i}`} style={{ fontFamily: mono, fontSize: 11, color: LEVEL_COLOR[it.level], padding: '2px 0' }}>{it.text}</li>)}
          {issueList.map((it, i) => (
            <li key={i} style={{ fontFamily: mono, fontSize: 11, color: LEVEL_COLOR[it.level], padding: '2px 0' }}>
              <span style={{ color: P.faint }}>{it.where}:</span> {it.text}
            </li>
          ))}
        </ul>
      )}

      {(err || existingErr) && <div role="alert" style={{ fontFamily: mono, fontSize: 12, color: P.red, padding: '0 14px 10px' }}>{err || existingErr}</div>}

      <footer style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '10px 14px', borderTop: `1px solid ${P.hair}`, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: mono, fontSize: 10, color: P.faint }}>Blank cells never erase stored values. Every change is logged to History.</span>
        <div style={{ display: 'flex', gap: 8 }}>
          {onDiscard && <DangerBtn onClick={onDiscard} disabled={busy}>{batch.uploadId ? 'DISCARD' : 'SKIP'}</DangerBtn>}
          <PrimaryBtn onClick={publish} disabled={busy || validation.errorCount > 0 || !batch.matchId || (realMatchId && !existing)}>
            {busy ? 'PUBLISHING…' : realMatchId && !existing && !existingErr ? 'CHECKING…' : `PUBLISH ${validation.includedCount} SCORE${validation.includedCount === 1 ? '' : 'S'}`}
          </PrimaryBtn>
        </div>
      </footer>
    </section>
  );
}
