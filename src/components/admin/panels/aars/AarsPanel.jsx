import { useState, useEffect, useRef, useMemo } from 'react';
import { supabase as SB } from '../../../../lib/supabaseClient';
import { P, mono, oswald, inter, fs, sp, radius } from '../../theme';
import { Btn, Card, Input, Label, PanelHeader, EmptyState } from '../../shared/ui';
import posthog from '../../../../lib/posthog';

// After Action Reports — usually tied to an event, but event_id is nullable
// (standalone AARs supported). Two sources, one table (public.aars, see
// supabase/aars.sql): 'uploaded' (file in the private aar-documents bucket)
// or 'drafted' (written directly here, content_* columns, no file at all).
// "Delete" from this UI is a soft archive, never a hard delete.
const DOCS_BUCKET = 'aar-documents';
const SIGNED_URL_TTL = 60 * 10; // 10 min

const FILE_RE = /\.(pdf|docx?)$/i;
const PDF_RE = /\.pdf$/i;
const isPdf = (name) => !!name && PDF_RE.test(name);
const ext = (name) => (name.split('.').pop() || '').toUpperCase();
const baseName = (name) => name.replace(/\.[^.]+$/, '');
const escapeHtml = (s) => String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nl2br = (s) => escapeHtml(s).replace(/\n/g, '<br>');

const CONFIDENTIALITY_LEVELS = [
  { value: 'public', label: 'PUBLIC', color: P.green },
  { value: 'internal', label: 'INTERNAL', color: P.gold },
  { value: 'confidential', label: 'CONFIDENTIAL', color: P.red },
];
const levelInfo = (value) => CONFIDENTIALITY_LEVELS.find((l) => l.value === value) || CONFIDENTIALITY_LEVELS[1];

const emptyDraft = () => ({
  title: '', date: new Date().toISOString().slice(0, 10), eventId: '', level: 'internal',
  wentWell: '', needsImprovement: '', summary: '',
});

export default function AarsPanel({ adminId, readOnly = false }) {
  const [rows, setRows] = useState([]);
  const [events, setEvents] = useState([]);
  const [urls, setUrls] = useState({}); // storage_path -> signed url
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [levelFilter, setLevelFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null); // row

  const [showChoice, setShowChoice] = useState(false);

  const [pendingFile, setPendingFile] = useState(null);
  const [pendingTitle, setPendingTitle] = useState('');
  const [pendingSummary, setPendingSummary] = useState('');
  const [pendingEventId, setPendingEventId] = useState('');
  const [pendingDate, setPendingDate] = useState('');
  const [pendingLevel, setPendingLevel] = useState('internal');
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef();

  const [draftOpen, setDraftOpen] = useState(false);
  const [editingDraftId, setEditingDraftId] = useState(null);
  const [draft, setDraft] = useState(emptyDraft());
  const [savingDraft, setSavingDraft] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [{ data: aarRows }, { data: eventRows }] = await Promise.all([
      SB.from('aars').select('*').order('aar_date', { ascending: false, nullsFirst: false }),
      SB.from('events').select('id,title,date').order('date', { ascending: false }),
    ]);
    const list = aarRows || [];
    setRows(list);
    setEvents(eventRows || []);
    const uploadedPaths = list.filter((r) => r.storage_path).map((r) => r.storage_path);
    if (uploadedPaths.length) {
      const { data: signed } = await SB.storage.from(DOCS_BUCKET).createSignedUrls(uploadedPaths, SIGNED_URL_TTL);
      const urlMap = {};
      (signed || []).forEach((s) => { if (s.path) urlMap[s.path] = s.signedUrl; });
      setUrls(urlMap);
    } else {
      setUrls({});
    }
    setLoading(false);
  }

  const eventById = useMemo(() => Object.fromEntries(events.map((e) => [e.id, e])), [events]);

  // ── upload path ────────────────────────────────────────────────────────
  function handleFileChosen(file) {
    if (!file) return;
    if (!FILE_RE.test(file.name)) { alert('AAR must be a PDF or Word document.'); return; }
    setPendingFile(file);
    setPendingTitle(baseName(file.name));
    setPendingSummary('');
    setPendingEventId('');
    setPendingDate(new Date().toISOString().slice(0, 10));
    setPendingLevel('internal');
  }

  function onPickFile(e) {
    const file = e.target.files[0];
    e.target.value = '';
    handleFileChosen(file);
  }
  function onDrop(e) {
    e.preventDefault();
    setDragOver(false);
    handleFileChosen(e.dataTransfer.files?.[0]);
  }

  async function confirmUpload() {
    if (!pendingFile || !pendingTitle.trim()) return;
    setUploading(true);
    const path = `${Date.now()}_${pendingFile.name.replace(/[^a-zA-Z0-9_.-]/g, '_')}`;
    const { error: upErr } = await SB.storage.from(DOCS_BUCKET).upload(path, pendingFile);
    if (upErr) { setUploading(false); alert(upErr.message); return; }
    const { error: insErr } = await SB.from('aars').insert({
      source: 'uploaded',
      event_id: pendingEventId || null,
      title: pendingTitle.trim(),
      aar_date: pendingDate || null,
      summary: pendingSummary.trim() || null,
      storage_path: path,
      file_name: pendingFile.name,
      confidentiality: pendingLevel,
    });
    setUploading(false);
    if (insErr) { alert(insErr.message); return; }
    posthog.capture('aar_created', {
      creation_method: 'file_upload',
      confidentiality: pendingLevel,
      is_linked_to_event: Boolean(pendingEventId),
    });
    await SB.from('change_log').insert({
      admin_id: adminId, page: 'aars', element: path,
      label: `NEW AAR (upload): ${pendingTitle.trim()}`, value_before: {}, value_after: { title: pendingTitle.trim() },
    });
    setPendingFile(null);
    setPendingTitle('');
    setPendingSummary('');
    load();
  }

  // ── drafted path ───────────────────────────────────────────────────────
  function startDraft() {
    setEditingDraftId(null);
    setDraft(emptyDraft());
    setDraftOpen(true);
  }
  function editDraft(row) {
    setEditingDraftId(row.id);
    setDraft({
      title: row.title || '', date: row.aar_date || '', eventId: row.event_id || '', level: row.confidentiality || 'internal',
      wentWell: row.content_went_well || '', needsImprovement: row.content_needs_improvement || '', summary: row.content_summary || '',
    });
    setDraftOpen(true);
    setPreview(null);
  }
  function cancelDraft() {
    setDraftOpen(false);
    setEditingDraftId(null);
  }

  async function confirmDraft() {
    if (!draft.title.trim() || !draft.summary.trim()) return;
    setSavingDraft(true);
    const body = {
      source: 'drafted',
      event_id: draft.eventId || null,
      title: draft.title.trim(),
      aar_date: draft.date || null,
      confidentiality: draft.level,
      content_went_well: draft.wentWell.trim() || null,
      content_needs_improvement: draft.needsImprovement.trim() || null,
      content_summary: draft.summary.trim(),
    };
    let error;
    if (editingDraftId) {
      ({ error } = await SB.from('aars').update({ ...body, updated_at: new Date().toISOString() }).eq('id', editingDraftId));
    } else {
      ({ error } = await SB.from('aars').insert(body));
    }
    setSavingDraft(false);
    if (error) { alert(error.message); return; }
    if (!editingDraftId) {
      posthog.capture('aar_created', {
        creation_method: 'draft',
        confidentiality: body.confidentiality,
        is_linked_to_event: Boolean(body.event_id),
      });
    }
    await SB.from('change_log').insert({
      admin_id: adminId, page: 'aars', element: editingDraftId || 'new',
      label: `${editingDraftId ? 'EDIT' : 'NEW'} AAR (draft): ${body.title}`, value_before: {}, value_after: { title: body.title },
    });
    setDraftOpen(false);
    setEditingDraftId(null);
    load();
  }

  // ── shared ─────────────────────────────────────────────────────────────
  async function archive(row) {
    if (!confirm(`Archive "${row.title}"? It moves out of the active list but stays recoverable.`)) return;
    await SB.from('aars').update({ status: 'archived', archived_at: new Date().toISOString(), archived_by: adminId || null }).eq('id', row.id);
    await SB.from('change_log').insert({ admin_id: adminId, page: 'aars', element: row.id, label: `ARCHIVE AAR: ${row.title}`, value_before: row, value_after: { status: 'archived' } });
    if (preview?.id === row.id) setPreview(null);
    load();
  }

  async function restore(row) {
    await SB.from('aars').update({ status: 'active', archived_at: null, archived_by: null }).eq('id', row.id);
    await SB.from('change_log').insert({ admin_id: adminId, page: 'aars', element: row.id, label: `RESTORE AAR: ${row.title}`, value_before: row, value_after: { status: 'active' } });
    load();
  }

  // urls[row.storage_path] is a Supabase Storage URL (a different origin
  // from this app), so `win` is a cross-origin popup: addEventListener
  // isn't available on it and throws "Illegal invocation" rather than just
  // being a no-op. There's no reliable cross-origin load signal, so just
  // open the tab — the browser's own PDF viewer has a print control.
  function printFile(row) {
    const win = window.open(urls[row.storage_path], '_blank');
    if (!win) { alert('Popup blocked, allow popups to print.'); return; }
  }

  function printDraft(row) {
    const win = window.open('', '_blank');
    if (!win) { alert('Popup blocked, allow popups to print.'); return; }
    const eventLine = row.event_id ? (eventById[row.event_id]?.title || 'Linked event') : 'Standalone';
    win.document.write(`<!doctype html><html><head><title>${escapeHtml(row.title)}</title><style>
      body{font-family:Georgia,serif;max-width:720px;margin:40px auto;padding:0 20px;color:#111;line-height:1.5}
      h1{font-size:22px;margin-bottom:2px} .meta{color:#555;font-size:13px;margin-bottom:28px}
      h2{font-size:15px;text-transform:uppercase;letter-spacing:0.06em;border-bottom:1px solid #ccc;padding-bottom:4px;margin-top:28px}
      p{white-space:normal}
    </style></head><body>
      <h1>${escapeHtml(row.title)}</h1>
      <div class="meta">${escapeHtml(row.aar_date || '')} · ${escapeHtml(eventLine)} · ${escapeHtml((row.confidentiality || '').toUpperCase())}</div>
      ${row.content_went_well ? `<h2>What Went Well</h2><p>${nl2br(row.content_went_well)}</p>` : ''}
      ${row.content_needs_improvement ? `<h2>What Needs Improvement</h2><p>${nl2br(row.content_needs_improvement)}</p>` : ''}
      <h2>Overall Summary</h2><p>${nl2br(row.content_summary)}</p>
    </body></html>`);
    win.document.close();
    win.focus();
    win.print();
  }

  const filtered = rows
    .filter((r) => r.status === statusFilter)
    .filter((r) => (levelFilter === 'all' ? true : r.confidentiality === levelFilter))
    .filter((r) => {
      if (!search) return true;
      const q = search.toLowerCase();
      const eventTitle = r.event_id ? (eventById[r.event_id]?.title || '') : '';
      const haystack = [r.title, r.summary, r.content_summary, eventTitle].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(q);
    });

  const activeCount = rows.filter((r) => r.status === 'active').length;
  const archivedCount = rows.filter((r) => r.status === 'archived').length;

  return (
    <div style={{ maxWidth: 1040 }}>
      <PanelHeader
        title="AAR TRACKER"
        sub={`${activeCount} active · ${archivedCount} archived${readOnly ? ' · READ-ONLY' : ''}`}
        action={!readOnly && <Btn onClick={() => setShowChoice(true)} variant="gold" size="sm">+ NEW AAR</Btn>}
      />
      {!readOnly && <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" style={{ display: 'none' }} onChange={onPickFile} />}

      <div style={{ display: 'flex', gap: sp[2], marginBottom: sp[3], flexWrap: 'wrap' }}>
        <Btn variant={statusFilter === 'active' ? 'gold' : 'ghost'} size="sm" onClick={() => setStatusFilter('active')}>ACTIVE</Btn>
        <Btn variant={statusFilter === 'archived' ? 'gold' : 'ghost'} size="sm" onClick={() => setStatusFilter('archived')}>ARCHIVED</Btn>
      </div>

      <div style={{ display: 'flex', gap: sp[2], marginBottom: sp[3], flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search AARs…" />
        </div>
        <select
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value)}
          style={{ background: P.deep, border: `1px solid ${P.hair}`, color: P.cream, fontFamily: mono, fontSize: fs.xs, padding: '0 10px', borderRadius: 5 }}
        >
          <option value="all">ALL LEVELS</option>
          {CONFIDENTIALITY_LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
        </select>
      </div>

      <div
        onDragOver={readOnly ? undefined : (e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={readOnly ? undefined : () => setDragOver(false)}
        onDrop={readOnly ? undefined : onDrop}
        style={{
          border: dragOver ? `2px dashed ${P.gold}` : '2px dashed transparent',
          background: dragOver ? P.goldWash : 'transparent',
          borderRadius: radius.md, transition: 'border-color 0.15s, background 0.15s', padding: dragOver ? sp[2] : 0,
        }}
      >
        {loading ? (
          <div style={{ fontFamily: mono, fontSize: fs.xs, color: P.mute, textAlign: 'center', marginTop: sp[6] }}>LOADING…</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="⊡"
            title={search ? 'NO MATCHING AARS' : statusFilter === 'archived' ? 'NO ARCHIVED AARS' : 'NO AARS YET'}
            hint={dragOver ? 'Drop to upload.' : (search ? 'Try a different search term.' : 'Draft an AAR directly, or upload a PDF/Word file, optionally linked to an event, then track it here.')}
          />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: sp[2] }}>
            {filtered.map((r) => {
              const level = levelInfo(r.confidentiality);
              const event = r.event_id ? eventById[r.event_id] : null;
              const drafted = r.source === 'drafted';
              return (
                <Card key={r.id} hover style={{ padding: 0, cursor: 'pointer' }} onClick={() => setPreview(r)}>
                  <div style={{ padding: sp[3] }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: sp[2] }}>
                      <div style={{ fontFamily: oswald, fontSize: fs.lg, color: P.gold, lineHeight: 1 }}>{drafted ? 'DRAFT' : (ext(r.file_name) || 'FILE')}</div>
                      <div style={{ background: level.color, color: P.ink, fontFamily: mono, fontSize: 7, letterSpacing: '0.08em', padding: '2px 5px', borderRadius: 3, whiteSpace: 'nowrap' }}>{level.label}</div>
                    </div>
                    <div title={r.title} style={{ fontFamily: inter, fontSize: fs.sm, color: P.cream, marginTop: sp[2], overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div>
                    <div style={{ fontFamily: mono, fontSize: 9, color: P.mute, marginTop: 3 }}>
                      {r.aar_date || '—'} · {event ? event.title : 'STANDALONE'}
                    </div>
                    <div style={{ display: 'flex', gap: 4, marginTop: sp[2], flexWrap: 'wrap' }} onClick={(e) => e.stopPropagation()}>
                      {drafted ? (
                        <>
                          <button onClick={() => printDraft(r)} style={miniBtn(false)}>PRINT</button>
                          {!readOnly && r.status === 'active' && <button onClick={() => editDraft(r)} style={miniBtn(false)}>EDIT</button>}
                        </>
                      ) : (
                        <>
                          <a href={urls[r.storage_path]} download={r.file_name} style={{ ...miniBtn(false), textDecoration: 'none', display: 'inline-block' }}>GET</a>
                          {isPdf(r.file_name) && <button onClick={() => printFile(r)} style={miniBtn(false)}>PRINT</button>}
                        </>
                      )}
                      {!readOnly && (r.status === 'active'
                        ? <button onClick={() => archive(r)} style={{ ...miniBtn(false), color: P.red, borderColor: 'rgba(192,57,43,0.4)' }}>ARCHIVE</button>
                        : <button onClick={() => restore(r)} style={{ ...miniBtn(false), color: P.green, borderColor: 'rgba(39,174,96,0.4)' }}>RESTORE</button>)}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* new-AAR choice: draft in DISPATCH vs upload a file */}
      {showChoice && (
        <div
          onClick={() => setShowChoice(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(6,16,31,0.9)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: sp[6] }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: P.navy, border: `1px solid ${P.hairStrong}`, borderRadius: radius.md, padding: sp[5], width: 440, maxWidth: '90vw' }}>
            <Label>NEW AAR</Label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: sp[2], marginTop: sp[3] }}>
              <button
                onClick={() => { setShowChoice(false); startDraft(); }}
                style={choiceBtnStyle(true)}
              >
                <div style={{ fontFamily: mono, fontSize: fs.sm, color: P.cream, letterSpacing: '0.06em' }}>DRAFT IN DISPATCH</div>
                <div style={{ fontFamily: inter, fontSize: fs.xs, color: P.mute, marginTop: 4 }}>Write it here: went well / needs improvement / summary. No file needed.</div>
              </button>
              <button
                onClick={() => { setShowChoice(false); fileRef.current.click(); }}
                style={choiceBtnStyle(false)}
              >
                <div style={{ fontFamily: mono, fontSize: fs.sm, color: P.cream, letterSpacing: '0.06em' }}>UPLOAD FILE</div>
                <div style={{ fontFamily: inter, fontSize: fs.xs, color: P.mute, marginTop: 4 }}>Attach an existing PDF or Word AAR.</div>
              </button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: sp[4] }}>
              <Btn variant="ghost" size="sm" onClick={() => setShowChoice(false)}>CANCEL</Btn>
            </div>
          </div>
        </div>
      )}

      {/* upload metadata prompt */}
      {pendingFile && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(6,16,31,0.9)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: sp[6] }}>
          <div style={{ background: P.navy, border: `1px solid ${P.hairStrong}`, borderRadius: radius.md, padding: sp[5], width: 420, maxWidth: '90vw' }}>
            <Label>NEW AAR: FILE UPLOAD</Label>
            <div style={{ fontFamily: mono, fontSize: fs.xs, color: P.mute, marginBottom: sp[3], overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pendingFile.name}</div>

            <Label>TITLE</Label>
            <div style={{ marginBottom: sp[3] }}>
              <Input value={pendingTitle} onChange={(e) => setPendingTitle(e.target.value)} placeholder="AAR title…" autoFocus />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: sp[3], marginBottom: sp[3] }}>
              <div>
                <Label>DATE</Label>
                <Input type="date" value={pendingDate} onChange={(e) => setPendingDate(e.target.value)} />
              </div>
              <div>
                <Label>LINKED EVENT (optional)</Label>
                <select
                  value={pendingEventId}
                  onChange={(e) => setPendingEventId(e.target.value)}
                  style={selectStyle}
                >
                  <option value="">(standalone)</option>
                  {events.map((e) => <option key={e.id} value={e.id}>{e.title} ({e.date})</option>)}
                </select>
              </div>
            </div>

            <Label>SUMMARY (optional)</Label>
            <div style={{ marginBottom: sp[3] }}>
              <Input value={pendingSummary} onChange={(e) => setPendingSummary(e.target.value)} placeholder="Short context, useful when standalone…" multiline />
            </div>

            <Label>CONFIDENTIALITY</Label>
            <div style={{ display: 'flex', gap: sp[2], marginBottom: sp[4] }}>
              {CONFIDENTIALITY_LEVELS.map((l) => (
                <button
                  key={l.value}
                  onClick={() => setPendingLevel(l.value)}
                  style={levelBtnStyle(l, pendingLevel === l.value)}
                >
                  {l.label}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: sp[2], justifyContent: 'flex-end' }}>
              <Btn variant="ghost" size="sm" onClick={() => { setPendingFile(null); setPendingTitle(''); }} disabled={uploading}>CANCEL</Btn>
              <Btn variant="gold" size="sm" onClick={confirmUpload} disabled={!pendingTitle.trim() || uploading}>{uploading ? 'UPLOADING…' : 'UPLOAD'}</Btn>
            </div>
          </div>
        </div>
      )}

      {/* draft editor */}
      {draftOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(6,16,31,0.9)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: sp[6] }}>
          <div style={{ background: P.navy, border: `1px solid ${P.hairStrong}`, borderRadius: radius.md, padding: sp[5], width: 560, maxWidth: '92vw', maxHeight: '88vh', overflowY: 'auto' }}>
            <Label>{editingDraftId ? 'EDIT DRAFTED AAR' : 'NEW AAR: DRAFT IN DISPATCH'}</Label>

            <div style={{ marginTop: sp[3], marginBottom: sp[3] }}>
              <Label>TITLE</Label>
              <Input value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} placeholder="AAR title…" autoFocus />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: sp[3], marginBottom: sp[3] }}>
              <div>
                <Label>DATE</Label>
                <Input type="date" value={draft.date} onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))} />
              </div>
              <div>
                <Label>LINKED EVENT (optional)</Label>
                <select value={draft.eventId} onChange={(e) => setDraft((d) => ({ ...d, eventId: e.target.value }))} style={selectStyle}>
                  <option value="">(standalone)</option>
                  {events.map((e) => <option key={e.id} value={e.id}>{e.title} ({e.date})</option>)}
                </select>
              </div>
            </div>

            <div style={{ marginBottom: sp[3] }}>
              <Label>WHAT WENT WELL <span style={{ color: P.mute, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></Label>
              <Input value={draft.wentWell} onChange={(e) => setDraft((d) => ({ ...d, wentWell: e.target.value }))} multiline style={{ minHeight: 80 }} />
            </div>
            <div style={{ marginBottom: sp[3] }}>
              <Label>WHAT NEEDS IMPROVEMENT <span style={{ color: P.mute, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></Label>
              <Input value={draft.needsImprovement} onChange={(e) => setDraft((d) => ({ ...d, needsImprovement: e.target.value }))} multiline style={{ minHeight: 80 }} />
            </div>
            <div style={{ marginBottom: sp[3] }}>
              <Label>OVERALL SUMMARY <span style={{ color: P.red }}>*</span></Label>
              <Input value={draft.summary} onChange={(e) => setDraft((d) => ({ ...d, summary: e.target.value }))} multiline style={{ minHeight: 100 }} />
            </div>

            <Label>CONFIDENTIALITY</Label>
            <div style={{ display: 'flex', gap: sp[2], marginBottom: sp[4] }}>
              {CONFIDENTIALITY_LEVELS.map((l) => (
                <button key={l.value} onClick={() => setDraft((d) => ({ ...d, level: l.value }))} style={levelBtnStyle(l, draft.level === l.value)}>
                  {l.label}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: sp[2], justifyContent: 'flex-end' }}>
              <Btn variant="ghost" size="sm" onClick={cancelDraft} disabled={savingDraft}>CANCEL</Btn>
              <Btn variant="gold" size="sm" onClick={confirmDraft} disabled={!draft.title.trim() || !draft.summary.trim() || savingDraft}>
                {savingDraft ? 'SAVING…' : editingDraftId ? 'SAVE CHANGES' : 'SAVE AAR'}
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* full-view modal */}
      {preview && (
        <div
          onClick={() => setPreview(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(6,16,31,0.9)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: sp[6] }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: '90vw', maxHeight: '90vh', width: preview.source === 'drafted' ? 720 : undefined, display: 'flex', flexDirection: 'column', gap: sp[3] }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: sp[4] }}>
              <div>
                <div style={{ fontFamily: mono, fontSize: fs.xs, color: P.cream }}>{preview.title}</div>
                <div style={{ fontFamily: mono, fontSize: 9, color: P.mute, marginTop: 2 }}>
                  {preview.aar_date || '—'} · {preview.event_id ? (eventById[preview.event_id]?.title || 'linked event') : 'STANDALONE'}{preview.summary ? ` · ${preview.summary}` : ''}
                </div>
              </div>
              <div style={{ display: 'flex', gap: sp[2] }}>
                {preview.source === 'drafted' ? (
                  <>
                    <Btn onClick={() => printDraft(preview)} variant="ghost" size="sm">PRINT</Btn>
                    {!readOnly && preview.status === 'active' && <Btn onClick={() => editDraft(preview)} variant="ghost" size="sm">EDIT</Btn>}
                  </>
                ) : (
                  isPdf(preview.file_name) && <Btn onClick={() => printFile(preview)} variant="ghost" size="sm">PRINT</Btn>
                )}
                {!readOnly && (preview.status === 'active'
                  ? <Btn onClick={() => archive(preview)} variant="danger" size="sm">ARCHIVE</Btn>
                  : <Btn onClick={() => restore(preview)} variant="green" size="sm">RESTORE</Btn>)}
                <Btn onClick={() => setPreview(null)} variant="gold" size="sm">CLOSE</Btn>
              </div>
            </div>
            <div style={{ background: P.ink, border: `1px solid ${P.hairStrong}`, overflow: 'auto', display: 'flex', alignItems: preview.source === 'drafted' ? 'stretch' : 'center', justifyContent: 'center' }}>
              {preview.source === 'drafted' ? (
                <div style={{ background: '#fff', color: '#111', padding: sp[6], width: '100%', maxHeight: '76vh', overflowY: 'auto', fontFamily: inter, lineHeight: 1.6 }}>
                  {preview.content_went_well && <><h3 style={draftSectionHeadStyle}>What Went Well</h3><p style={{ whiteSpace: 'pre-wrap' }}>{preview.content_went_well}</p></>}
                  {preview.content_needs_improvement && <><h3 style={draftSectionHeadStyle}>What Needs Improvement</h3><p style={{ whiteSpace: 'pre-wrap' }}>{preview.content_needs_improvement}</p></>}
                  <h3 style={draftSectionHeadStyle}>Overall Summary</h3><p style={{ whiteSpace: 'pre-wrap' }}>{preview.content_summary}</p>
                </div>
              ) : isPdf(preview.file_name) ? (
                <iframe title={preview.file_name} src={urls[preview.storage_path]} style={{ width: '86vw', height: '76vh', border: 'none', background: '#fff' }} />
              ) : (
                <div style={{ fontFamily: mono, fontSize: fs.sm, color: P.mute, padding: sp[10] }}>No inline preview for this file type. Use GET to download.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const selectStyle = {
  width: '100%', background: P.deep, border: `1px solid ${P.hair}`, color: P.cream,
  fontFamily: inter, fontSize: fs.sm, padding: '10px 12px', outline: 'none', cursor: 'pointer', borderRadius: 5, boxSizing: 'border-box',
};

const draftSectionHeadStyle = { fontFamily: mono, fontSize: fs.tiny, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#555', borderBottom: '1px solid #ddd', paddingBottom: 4, marginTop: 20 };

function levelBtnStyle(l, active) {
  return {
    flex: 1, cursor: 'pointer', fontFamily: mono, fontSize: 9, letterSpacing: '0.08em', padding: '8px 6px', borderRadius: 5,
    background: active ? l.color : 'transparent',
    color: active ? P.ink : P.mute,
    border: `1px solid ${active ? l.color : P.hair}`,
  };
}

function choiceBtnStyle(primary) {
  return {
    textAlign: 'left', cursor: 'pointer', background: primary ? P.goldWash : 'transparent',
    border: `1px solid ${primary ? P.hairStrong : P.hair}`, borderRadius: radius.sm, padding: sp[3],
  };
}

function miniBtn(active) {
  return {
    background: active ? P.gold : 'transparent',
    border: `1px solid ${active ? P.gold : P.hair}`,
    color: active ? P.ink : P.mute,
    cursor: 'pointer', fontFamily: mono, fontSize: 8, letterSpacing: '0.08em',
    padding: '3px 6px', borderRadius: 3,
  };
}
