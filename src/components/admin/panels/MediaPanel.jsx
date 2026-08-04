import { useState, useEffect, useRef } from 'react';
import { supabase as SB } from '../../../lib/supabaseClient';
import { P, mono, oswald, fs, sp, radius } from '../theme';
import { Btn, Input, Label, PanelHeader, EmptyState } from '../shared/ui';

// Storage buckets DISPATCH manages. `documents` is private (signed URLs,
// s6-only — see supabase/documents.sql) and carries title + confidentiality
// metadata in public.document_meta. The others stay public site images.
const BUCKETS = ['site-assets', 'team-photos', 'personnel-photos', 'achievement-icons', 'documents'];
const DOCS_BUCKET = 'documents';
const SIGNED_URL_TTL = 60 * 10; // 10 min — plenty for a preview/copy/print session

const IMG_RE = /\.(png|jpe?g|gif|webp|avif|svg)$/i;
const PDF_RE = /\.pdf$/i;
const isImage = (name) => IMG_RE.test(name);
const isPdf = (name) => PDF_RE.test(name);
const ext = (name) => (name.split('.').pop() || '').toUpperCase();
const baseName = (name) => name.replace(/\.[^.]+$/, '');

const CONFIDENTIALITY_LEVELS = [
  { value: 'public', label: 'PUBLIC', color: P.green },
  { value: 'internal', label: 'INTERNAL', color: P.gold },
  { value: 'confidential', label: 'CONFIDENTIAL', color: P.red },
];
const levelInfo = (value) => CONFIDENTIALITY_LEVELS.find((l) => l.value === value) || CONFIDENTIALITY_LEVELS[1];

export default function MediaPanel({ adminId }) {
  const [bucket, setBucket] = useState('site-assets');
  const [files, setFiles] = useState([]);
  const [docMeta, setDocMeta] = useState({}); // storage_path -> {title, confidentiality}
  const [urls, setUrls] = useState({}); // name -> resolved url (signed for documents, public otherwise)
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(null);
  const [preview, setPreview] = useState(null); // {name,url}
  const [pendingFile, setPendingFile] = useState(null); // file awaiting title/confidentiality
  const [pendingTitle, setPendingTitle] = useState('');
  const [pendingLevel, setPendingLevel] = useState('internal');
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef();
  const isDocs = bucket === DOCS_BUCKET;

  useEffect(() => { loadFiles(); /* eslint-disable-next-line */ }, [bucket]);

  async function loadFiles() {
    setLoading(true);
    const { data } = await SB.storage.from(bucket).list('', { limit: 200, sortBy: { column: 'name', order: 'asc' } });
    const list = (data || []).filter((f) => f.name !== '.emptyFolderPlaceholder');
    setFiles(list);

    if (bucket === DOCS_BUCKET && list.length) {
      const paths = list.map((f) => f.name);
      const [{ data: metaRows }, { data: signed }] = await Promise.all([
        SB.from('document_meta').select('storage_path,title,confidentiality').in('storage_path', paths),
        SB.storage.from(bucket).createSignedUrls(paths, SIGNED_URL_TTL),
      ]);
      const metaMap = {};
      (metaRows || []).forEach((r) => { metaMap[r.storage_path] = r; });
      setDocMeta(metaMap);
      const urlMap = {};
      (signed || []).forEach((s) => { if (s.path) urlMap[s.path] = s.signedUrl; });
      setUrls(urlMap);
    } else if (list.length) {
      const urlMap = {};
      list.forEach((f) => { urlMap[f.name] = SB.storage.from(bucket).getPublicUrl(f.name).data.publicUrl; });
      setUrls(urlMap);
    } else {
      setDocMeta({});
      setUrls({});
    }
    setLoading(false);
  }

  function getUrl(name) {
    return urls[name] || '';
  }

  // Shared entry point for both the file-picker button and drag-and-drop.
  function handleFileChosen(file) {
    if (!file) return;
    if (isDocs) {
      setPendingFile(file);
      setPendingTitle(baseName(file.name));
      setPendingLevel('internal');
    } else {
      uploadFile(file);
    }
  }

  async function uploadFile(file, meta = null) {
    await SB.storage.from(bucket).upload(file.name, file, { upsert: true });
    if (meta) {
      await SB.from('document_meta').upsert({
        storage_path: file.name,
        title: meta.title,
        confidentiality: meta.level,
        uploaded_by: adminId || null,
      });
    }
    loadFiles();
  }

  async function confirmPendingUpload() {
    if (!pendingFile || !pendingTitle.trim()) return;
    await uploadFile(pendingFile, { title: pendingTitle.trim(), level: pendingLevel });
    setPendingFile(null);
    setPendingTitle('');
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

  async function deleteFile(name) {
    if (!confirm(`Delete ${name}? This removes the file from storage permanently.`)) return;
    await SB.storage.from(bucket).remove([name]);
    if (isDocs) await SB.from('document_meta').delete().eq('storage_path', name);
    if (preview?.name === name) setPreview(null);
    loadFiles();
  }

  function copyUrl(name) {
    navigator.clipboard.writeText(getUrl(name));
    setCopied(name);
    setTimeout(() => setCopied(null), 1500);
  }

  // Open the file in a new tab and trigger print — used for the consent-form PDF.
  function printFile(name) {
    const win = window.open(getUrl(name), '_blank');
    if (!win) { alert('Popup blocked, allow popups to print.'); return; }
    win.addEventListener('load', () => win.print());
  }

  const displayName = (f) => (isDocs && docMeta[f.name]?.title) || f.name;

  const filtered = files
    .filter((f) => (search ? displayName(f).toLowerCase().includes(search.toLowerCase()) : true))
    .filter((f) => (isDocs && levelFilter !== 'all' ? (docMeta[f.name]?.confidentiality || 'internal') === levelFilter : true));

  return (
    <div style={{ maxWidth: 1040 }}>
      <PanelHeader title="MEDIA LIBRARY" sub={`${files.length} file(s) in ${bucket}`} action={<Btn onClick={() => fileRef.current.click()} variant="gold" size="sm">+ UPLOAD</Btn>} />
      <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={onPickFile} />
      <div style={{ display: 'flex', gap: sp[2], marginBottom: sp[3], flexWrap: 'wrap' }}>
        {BUCKETS.map((b) => <Btn key={b} variant={bucket === b ? 'gold' : 'ghost'} size="sm" onClick={() => setBucket(b)}>{b.toUpperCase()}</Btn>)}
      </div>
      <div style={{ display: 'flex', gap: sp[2], marginBottom: sp[3], flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search files…" />
        </div>
        {isDocs && (
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            style={{ background: P.deep, border: `1px solid ${P.hair}`, color: P.cream, fontFamily: mono, fontSize: fs.xs, padding: '0 10px', borderRadius: 5 }}
          >
            <option value="all">ALL LEVELS</option>
            {CONFIDENTIALITY_LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
        )}
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        style={{
          border: dragOver ? `2px dashed ${P.gold}` : '2px dashed transparent',
          background: dragOver ? P.goldWash : 'transparent',
          borderRadius: radius.md, transition: 'border-color 0.15s, background 0.15s', padding: dragOver ? sp[2] : 0,
        }}
      >
        {loading ? (
          <div style={{ fontFamily: mono, fontSize: fs.xs, color: P.mute, textAlign: 'center', marginTop: sp[6] }}>LOADING…</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon="⊡" title={search ? 'NO MATCHING FILES' : 'NO FILES IN THIS BUCKET'} hint={dragOver ? 'Drop to upload.' : (search ? 'Try a different search term.' : 'Upload or drag & drop photos, logos, or documents, then copy URLs or print directly.')} />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: sp[2] }}>
            {filtered.map((f) => {
              const url = getUrl(f.name);
              const img = isImage(f.name);
              const meta = docMeta[f.name];
              const level = isDocs ? levelInfo(meta?.confidentiality) : null;
              return (
                <div key={f.name} style={{ background: P.deep, border: `1px solid ${P.hair}`, display: 'flex', flexDirection: 'column' }}>
                  <button
                    onClick={() => setPreview({ name: f.name, url })}
                    style={{ border: 'none', padding: 0, cursor: 'pointer', background: P.ink, aspectRatio: '4/3', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}
                  >
                    {level && (
                      <div style={{ position: 'absolute', top: 4, right: 4, background: level.color, color: P.ink, fontFamily: mono, fontSize: 7, letterSpacing: '0.08em', padding: '2px 5px', borderRadius: 3 }}>
                        {level.label}
                      </div>
                    )}
                    {img
                      ? <img src={url} alt={displayName(f)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <div style={{ textAlign: 'center' }}>
                          <div style={{ fontFamily: oswald, fontSize: 26, color: P.gold, lineHeight: 1 }}>{ext(f.name) || 'FILE'}</div>
                          <div style={{ fontFamily: mono, fontSize: 8, color: P.mute, marginTop: 4, letterSpacing: '0.1em' }}>DOCUMENT</div>
                        </div>}
                  </button>
                  <div style={{ padding: '6px 8px', minWidth: 0 }}>
                    <div title={f.name} style={{ fontFamily: mono, fontSize: 9, color: P.cream, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName(f)}</div>
                    <div style={{ fontFamily: mono, fontSize: 8, color: P.mute, marginTop: 1 }}>{f.metadata?.size ? (f.metadata.size / 1024).toFixed(0) + ' KB' : ''}</div>
                    <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                      <button onClick={() => copyUrl(f.name)} style={miniBtn(copied === f.name)}>{copied === f.name ? '✓' : 'COPY'}</button>
                      <a href={url} download={f.name} style={{ ...miniBtn(false), textDecoration: 'none', display: 'inline-block' }}>GET</a>
                      {isPdf(f.name) && <button onClick={() => printFile(f.name)} style={miniBtn(false)}>PRINT</button>}
                      <button onClick={() => deleteFile(f.name)} style={{ ...miniBtn(false), color: P.red, borderColor: 'rgba(192,57,43,0.4)' }}>DEL</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* title + confidentiality prompt — documents bucket only, fires from both the picker and drag-and-drop */}
      {pendingFile && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(6,16,31,0.9)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: sp[6] }}>
          <div style={{ background: P.navy, border: `1px solid ${P.hairStrong}`, borderRadius: radius.md, padding: sp[5], width: 380, maxWidth: '90vw' }}>
            <Label>NEW DOCUMENT</Label>
            <div style={{ fontFamily: mono, fontSize: fs.xs, color: P.mute, marginBottom: sp[3], overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pendingFile.name}</div>
            <Label>TITLE</Label>
            <div style={{ marginBottom: sp[3] }}>
              <Input value={pendingTitle} onChange={(e) => setPendingTitle(e.target.value)} placeholder="Document title…" autoFocus />
            </div>
            <Label>CONFIDENTIALITY</Label>
            <div style={{ display: 'flex', gap: sp[2], marginBottom: sp[4] }}>
              {CONFIDENTIALITY_LEVELS.map((l) => (
                <button
                  key={l.value}
                  onClick={() => setPendingLevel(l.value)}
                  style={{
                    flex: 1, cursor: 'pointer', fontFamily: mono, fontSize: 9, letterSpacing: '0.08em', padding: '8px 6px', borderRadius: 5,
                    background: pendingLevel === l.value ? l.color : 'transparent',
                    color: pendingLevel === l.value ? P.ink : P.mute,
                    border: `1px solid ${pendingLevel === l.value ? l.color : P.hair}`,
                  }}
                >
                  {l.label}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: sp[2], justifyContent: 'flex-end' }}>
              <Btn variant="ghost" size="sm" onClick={() => { setPendingFile(null); setPendingTitle(''); }}>CANCEL</Btn>
              <Btn variant="gold" size="sm" onClick={confirmPendingUpload} disabled={!pendingTitle.trim()}>UPLOAD</Btn>
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
          <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: '90vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', gap: sp[3] }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: sp[4] }}>
              <div style={{ fontFamily: mono, fontSize: fs.xs, color: P.cream, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(isDocs && docMeta[preview.name]?.title) || preview.name}</div>
              <div style={{ display: 'flex', gap: sp[2] }}>
                <Btn onClick={() => copyUrl(preview.name)} variant="ghost" size="sm">{copied === preview.name ? 'COPIED ✓' : 'COPY URL'}</Btn>
                {isPdf(preview.name) && <Btn onClick={() => printFile(preview.name)} variant="ghost" size="sm">PRINT</Btn>}
                <Btn onClick={() => deleteFile(preview.name)} variant="danger" size="sm">DELETE</Btn>
                <Btn onClick={() => setPreview(null)} variant="gold" size="sm">CLOSE</Btn>
              </div>
            </div>
            <div style={{ background: P.ink, border: `1px solid ${P.hairStrong}`, overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {isImage(preview.name)
                ? <img src={preview.url} alt={preview.name} style={{ maxWidth: '86vw', maxHeight: '76vh', objectFit: 'contain', display: 'block' }} />
                : isPdf(preview.name)
                  ? <iframe title={preview.name} src={preview.url} style={{ width: '86vw', height: '76vh', border: 'none', background: '#fff' }} />
                  : <div style={{ fontFamily: mono, fontSize: fs.sm, color: P.mute, padding: sp[10] }}>No inline preview. Use GET to download.</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
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
