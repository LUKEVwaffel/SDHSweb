import { useEffect, useRef, useState } from 'react';
import { P, mono } from '../../theme';
import { PrimaryBtn, GhostBtn, inputStyle } from '../ui';
import { schoolYearOf } from '../rifleStats';
import { readScoreFile, readPastedText, ACCEPT, FORMAT_LABEL } from './readScoreFile.js';
import { gridToCsv } from './textGrid.js';
import { toDrafts } from './review.js';
import { aiParse, discardUpload } from './scoreImportApi.js';
import ReviewBatch from './ReviewBatch.jsx';

// Score import front door: drop/pick any number of files or paste text →
// deterministic header reader first (instant, free, exact numbers) → AI
// fallback only when that finds nothing → one ReviewBatch per table found.
// Nothing touches rifle_scores until a batch's PUBLISH is pressed.

const label = { fontFamily: mono, fontSize: 9, color: P.gold, letterSpacing: '0.2em' };
const emptyMatch = (week) => ({ week: week ? String(week) : '', dates: '', opponent: '', location: '' });
let batchSeq = 0;

function autoMatchId(week, matches, season, defaultMatchId, groupCount) {
  if (week != null) {
    const hits = matches.filter((m) => m.week === week);
    const inSeason = season ? hits.filter((m) => schoolYearOf(m) === season) : hits;
    if (inSeason.length === 1) return inSeason[0].id;
    if (!season && hits.length === 1) return hits[0].id;
    return '';
  }
  return groupCount === 1 && defaultMatchId ? defaultMatchId : '';
}

export default function ScoreImport({ matches, shooters, season, defaultMatchId, canUseAi = true, onPublished, onMatchCreated, onBatchesChange }) {
  const [batches, setBatches] = useState([]);
  const [jobs, setJobs] = useState([]); // per-file progress lines
  const [paste, setPaste] = useState('');
  const [showPaste, setShowPaste] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [created, setCreated] = useState([]); // shooters added by a publish, until the parent reloads
  const [discardErr, setDiscardErr] = useState('');
  const inputRef = useRef(null);
  // Inactive shooters stay matchable: an old sheet re-imported must not
  // create a duplicate of someone who has since left the team.
  const allShooters = [...shooters, ...created.filter((c) => !shooters.some((s) => s.id === c.id))];
  const rosterNames = allShooters.map((s) => s.name);
  const busy = jobs.some((j) => j.state === 'reading' || j.state === 'ai');
  const pending = batches.some((b) => b.status === 'review');

  useEffect(() => { onBatchesChange?.(batches); }, [batches, onBatchesChange]);

  // Unpublished review work shouldn't vanish on an accidental tab close.
  useEffect(() => {
    if (!pending) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [pending]);

  const setJob = (id, patch) => setJobs((js) => js.map((j) => (j.id === id ? { ...j, ...patch } : j)));
  const patchBatch = (key, patch) => setBatches((bs) => bs.map((b) => (b.key === key ? { ...b, ...patch } : b)));

  function batchesFromGroups(sourceName, groups, rawText) {
    return groups.map((g) => {
      const parts = [sourceName];
      if (g.sheet && g.sheet !== sourceName) parts.push(g.sheet);
      if (g.label) parts.push(g.label);
      else if (groups.length > 1) parts.push(g.week ? `Week ${g.week}` : `Group ${g.index}`);
      return {
        key: `b${++batchSeq}`, title: parts.join(' › '), parser: 'sheet', status: 'review',
        drafts: toDrafts(g.rows, rosterNames),
        matchId: autoMatchId(g.week, matches, season, defaultMatchId, groups.length),
        newMatch: emptyMatch(g.week), notes: '', uploadId: null, uploadDraft: null,
        rawText: g.grid ? gridToCsv(g.grid) : rawText,
        source: { name: sourceName, sheet: g.sheet || null, label: g.label || null, week: g.week ?? null, parser: 'sheet' },
      };
    });
  }

  function batchFromUpload(sourceName, upload) {
    return {
      key: `b${++batchSeq}`, title: `${sourceName} › AI read`, parser: 'ai', status: 'review',
      drafts: toDrafts(upload.draft?.rows || [], rosterNames),
      matchId: autoMatchId(null, matches, season, defaultMatchId, 1),
      newMatch: emptyMatch(null), notes: upload.draft?.notes || '',
      uploadId: upload.id, uploadDraft: upload.draft, rawText: upload.raw_csv, source: { name: sourceName, parser: 'ai' },
    };
  }

  async function ingest(sourceName, read) {
    const id = `j${++batchSeq}`;
    setJobs((js) => [...js, { id, name: sourceName, state: 'reading', msg: 'Reading…' }]);
    try {
      const res = await read();
      if (res.groups.length) {
        const made = batchesFromGroups(sourceName, res.groups, res.aiInput?.raw_text);
        setBatches((bs) => [...bs, ...made]);
        const rows = made.reduce((a, b) => a + b.drafts.length, 0);
        setJob(id, { state: 'ok', msg: `${rows} row${rows === 1 ? '' : 's'} in ${made.length} table${made.length === 1 ? '' : 's'}` });
        return;
      }
      if (!res.aiInput) throw new Error(res.reason || 'No score table found.');
      if (!canUseAi) throw new Error(`${res.reason || 'No score table found.'} AI reading is limited to Kaz and Luke.`);
      setJob(id, { state: 'ai', msg: `${res.reason ? `${res.reason} ` : ''}Reading with AI…` });
      const upload = await aiParse(res.aiInput, sourceName);
      const batch = batchFromUpload(sourceName, upload);
      if (!batch.drafts.length) throw new Error(upload.draft?.notes || 'AI found no shooter scores in it.');
      setBatches((bs) => [...bs, batch]);
      setJob(id, { state: 'ok', msg: `AI read ${batch.drafts.length} row${batch.drafts.length === 1 ? '' : 's'} — check them` });
    } catch (e) {
      setJob(id, { state: 'fail', msg: e.message || 'Couldn\'t read it.' });
    }
  }

  async function onFiles(fileList) {
    const files = [...(fileList || [])];
    for (const f of files) await ingest(f.name, () => readScoreFile(f));
  }

  async function onPaste() {
    const text = paste;
    if (!text.trim()) return;
    setPaste('');
    setShowPaste(false);
    await ingest('Pasted text', async () => readPastedText(text));
  }

  function discard(b) {
    if (b.uploadId && !confirm('Discard this import? Nothing gets written to scores.')) return;
    patchBatch(b.key, { status: 'skipped' });
    setDiscardErr('');
    if (b.uploadId) discardUpload(b.uploadId).catch((e) => setDiscardErr(e.message));
  }

  function handlePublished(msg, res) {
    if (res?.created?.length) setCreated((c) => [...c, ...res.created]);
    onPublished?.(msg, res);
  }

  const dropProps = {
    onDragOver: (e) => { e.preventDefault(); setDragging(true); },
    onDragLeave: () => setDragging(false),
    onDrop: (e) => { e.preventDefault(); setDragging(false); onFiles(e.dataTransfer.files); },
  };

  return (
    <div>
      <div
        {...dropProps}
        role="button" tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click(); } }}
        aria-label="Upload score sheets"
        style={{
          border: `1px dashed ${dragging ? P.bright : P.hairStrong}`, background: dragging ? 'rgba(201,169,97,0.1)' : 'rgba(10,22,40,0.5)',
          padding: '22px 18px', textAlign: 'center', cursor: 'pointer', transition: 'background 150ms ease, border-color 150ms ease', marginBottom: 10,
        }}
      >
        <div style={{ fontFamily: mono, fontSize: 13, color: P.cream, marginBottom: 6 }}>
          {busy ? 'Reading…' : 'Drop score sheets here, or click to choose files'}
        </div>
        <div style={{ fontFamily: mono, fontSize: 10, color: P.mute, lineHeight: 1.6 }}>{FORMAT_LABEL}. Several files at once is fine.</div>
        <input ref={inputRef} type="file" multiple accept={ACCEPT} style={{ display: 'none' }}
          onClick={(e) => e.stopPropagation()} /* its click would bubble to the drop zone and re-open the picker */
          onChange={(e) => { const fl = e.target.files; onFiles(fl).finally(() => { e.target.value = ''; }); }} />
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <GhostBtn onClick={() => setShowPaste((s) => !s)} active={showPaste}>{showPaste ? 'HIDE PASTE BOX' : 'OR PASTE TEXT'}</GhostBtn>
        {jobs.length > 0 && !busy && <GhostBtn onClick={() => setJobs([])}>CLEAR LOG</GhostBtn>}
      </div>
      {showPaste && (
        <div style={{ marginBottom: 14 }}>
          <textarea
            aria-label="Paste score sheet text" value={paste} onChange={(e) => setPaste(e.target.value)} rows={7}
            placeholder={'Copy the cells straight out of Excel / Google Sheets, or paste CSV / text from a results page.\nName    Prone   Standing   Kneeling   Total   X'}
            style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', fontSize: 12, resize: 'vertical', marginBottom: 8 }}
          />
          <PrimaryBtn onClick={onPaste} disabled={busy || !paste.trim()}>READ PASTED TEXT</PrimaryBtn>
        </div>
      )}

      {jobs.length > 0 && (
        <ul aria-live="polite" style={{ listStyle: 'none', margin: '0 0 14px', padding: 0 }}>
          {jobs.map((j) => (
            <li key={j.id} style={{ display: 'flex', gap: 10, fontFamily: mono, fontSize: 11, padding: '3px 0', color: j.state === 'fail' ? P.red : j.state === 'ok' ? P.win : P.mute }}>
              <span style={{ width: 12 }}>{j.state === 'fail' ? '✕' : j.state === 'ok' ? '✓' : '…'}</span>
              <span style={{ color: P.cream, flexShrink: 0, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.name}</span>
              <span style={{ wordBreak: 'break-word' }}>{j.msg}</span>
            </li>
          ))}
        </ul>
      )}

      {discardErr && <div role="alert" style={{ fontFamily: mono, fontSize: 11, color: P.red, marginBottom: 10 }}>{discardErr}</div>}
      {batches.length > 0 && <div style={{ ...label, marginBottom: 10 }}>// REVIEW BEFORE PUBLISHING</div>}
      {batches.map((b) => (
        <ReviewBatch
          key={b.key} batch={b} matches={matches} season={season} shooters={allShooters} rosterNames={rosterNames}
          onChange={(patch) => patchBatch(b.key, patch)}
          onMatchCreated={onMatchCreated}
          onPublished={handlePublished}
          onDiscard={() => discard(b)}
        />
      ))}
      <datalist id="rifle-import-roster">
        {rosterNames.map((n, i) => <option key={`${n}-${i}`} value={n} />)}
      </datalist>
    </div>
  );
}
