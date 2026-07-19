import { useState, useEffect, useRef } from 'react';
import { supabase as SB } from '../../../lib/supabaseClient';
import { P, mono } from '../theme';
import { Btn, Card, Input, PanelHeader } from '../shared/ui';

const BUCKETS = ['team-photos', 'personnel-photos', 'site-assets'];

export default function MediaPanel() {
  const [bucket, setBucket] = useState('site-assets');
  const [files, setFiles] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(null);
  const fileRef = useRef();

  useEffect(() => { loadFiles(); }, [bucket]);

  async function loadFiles() {
    setLoading(true);
    const { data } = await SB.storage.from(bucket).list('', { limit: 100 });
    setFiles((data || []).filter(f => f.name !== '.emptyFolderPlaceholder'));
    setLoading(false);
  }

  function getUrl(name) {
    return SB.storage.from(bucket).getPublicUrl(name).data.publicUrl;
  }

  async function upload(e) {
    const file = e.target.files[0];
    if (!file) return;
    await SB.storage.from(bucket).upload(file.name, file, { upsert: true });
    loadFiles();
  }

  async function deleteFile(name) {
    if (!confirm(`Delete ${name}?`)) return;
    await SB.storage.from(bucket).remove([name]);
    loadFiles();
  }

  function copyUrl(name) {
    navigator.clipboard.writeText(getUrl(name));
    setCopied(name);
    setTimeout(() => setCopied(null), 1500);
  }

  const filtered = search ? files.filter(f => f.name.toLowerCase().includes(search.toLowerCase())) : files;

  return (
    <div>
      <PanelHeader title="MEDIA LIBRARY" action={<Btn onClick={() => fileRef.current.click()} variant="gold" style={{ fontSize: 9 }}>+ UPLOAD</Btn>} />
      <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={upload} />
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
        {BUCKETS.map(b => <Btn key={b} variant={bucket===b?'gold':'ghost'} onClick={() => setBucket(b)} style={{ fontSize: 9 }}>{b.toUpperCase()}</Btn>)}
      </div>
      <div style={{ marginBottom: 10 }}>
        <Input value={search} onChange={e => setSearch(e.target.value)} style={{ fontSize: 11 }} />
      </div>
      {loading ? (
        <div style={{ fontFamily: mono, fontSize: 10, color: P.mute, textAlign: 'center', marginTop: 20 }}>LOADING…</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {filtered.map(f => (
            <Card key={f.name} style={{ padding: '6px 10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: mono, fontSize: 10, color: P.cream, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
                  <div style={{ fontFamily: mono, fontSize: 9, color: P.mute }}>{f.metadata?.size ? (f.metadata.size / 1024).toFixed(1) + ' KB' : ''}</div>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <Btn onClick={() => copyUrl(f.name)} variant="ghost" style={{ fontSize: 9 }}>{copied===f.name ? 'COPIED!' : 'COPY URL'}</Btn>
                  <Btn onClick={() => deleteFile(f.name)} variant="danger" style={{ fontSize: 9 }}>DEL</Btn>
                </div>
              </div>
            </Card>
          ))}
          {!filtered.length && <div style={{ fontFamily: mono, fontSize: 10, color: P.mute, textAlign: 'center', marginTop: 20 }}>NO FILES</div>}
        </div>
      )}
    </div>
  );
}
