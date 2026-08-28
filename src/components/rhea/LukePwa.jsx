import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { supabase as SB } from '../../lib/supabaseClient';
import AdminGate, { GATE_P as P, GATE_MONO as mono, GATE_INTER as inter } from './AdminGate';
import { useRheaPhotos, useRheaSubEvents } from '../../hooks/useRheaPhotos';
import { RHEA_EVENT_ID, RHEA_EVENT_TITLE, raiderTeamLabel } from '../../lib/rheaComp';
import { installPwaHooks, isStandalone, isIos } from './pwa';

const oswald = 'Oswald, sans-serif';
const TEAMS = [
  { id: 'male', label: 'Male' },
  { id: 'coed', label: 'Coed' },
  { id: 'both', label: 'Both' },
];
const PARENT_SEEN_KEY = 'rhea_pwa_parent_seen';

// ── /lukepwa — Luke's installable admin homebase for the 12h day. All
// curation, tagging, publishing, moderation happens here, from his phone.
// Design priority is speed + clarity of the tagging workflow, not polish.
export default function LukePwaRoute() {
  useEffect(() => { installPwaHooks(); }, []);
  return (
    <AdminGate label="RHEA COMP · CURATION">
      <LukePwa />
    </AdminGate>
  );
}

function LukePwa() {
  const { photos, loading, error, refresh } = useRheaPhotos({ scope: 'all' });
  const { subEvents, refresh: refreshSubs } = useRheaSubEvents();
  const [tab, setTab] = useState('tag'); // tag | parents | subs
  const [sel, setSel] = useState(() => new Set());
  const [actionErr, setActionErr] = useState('');
  const [seenAt, setSeenAt] = useState(() => Number(localStorage.getItem(PARENT_SEEN_KEY) || 0));

  const email = useRef(null);
  useEffect(() => { SB.auth.getSession().then(({ data }) => { email.current = data.session?.user?.email || null; }); }, []);

  const lukePhotos = useMemo(
    () => photos.filter((p) => p.source === 'luke')
      .sort((a, b) => (a.visibility === b.visibility ? 0 : a.visibility === 'staged' ? -1 : 1)),
    [photos],
  );
  const parentPhotos = useMemo(() => photos.filter((p) => p.source === 'parent'), [photos]);
  const newParentCount = useMemo(
    () => parentPhotos.filter((p) => new Date(p.created_at).getTime() > seenAt).length,
    [parentPhotos, seenAt],
  );

  const clearSel = () => setSel(new Set());
  const toggleSel = (id) => setSel((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  const openParents = useCallback(() => {
    setTab('parents');
    const now = Date.now();
    localStorage.setItem(PARENT_SEEN_KEY, String(now));
    setSeenAt(now);
  }, []);

  async function patchPhotos(patch, ids) {
    setActionErr('');
    const list = [...ids];
    if (!list.length) return;
    const { error: e } = await SB.from('photos').update(patch).in('id', list);
    if (e) { setActionErr(e.message || 'Update failed — check signal and retry.'); return; }
    refresh();
  }

  async function hardDelete(photo) {
    setActionErr('');
    if (!window.confirm('Permanently delete this photo? This removes the file for good.')) return;
    const thumb = photo.storage_path?.replace(/\.jpg$/i, '_t.jpg');
    await SB.storage.from('team-photos').remove([photo.storage_path, thumb].filter(Boolean));
    const { error: e } = await SB.from('photos').delete().eq('id', photo.id);
    if (e) { setActionErr(e.message || 'Delete failed — retry.'); return; }
    setSel((s) => { const n = new Set(s); n.delete(photo.id); return n; });
    refresh();
  }

  return (
    <div style={{ minHeight: '100vh', background: P.ink, color: P.cream, fontFamily: inter, paddingBottom: sel.size ? 132 : 72 }}>
      <TopBar />
      <InstallHint />

      <nav style={{ display: 'flex', borderBottom: `1px solid ${P.hair}`, position: 'sticky', top: 0, background: P.ink, zIndex: 10 }}>
        <TabBtn active={tab === 'tag'} onClick={() => setTab('tag')} label={`TAGGING (${lukePhotos.length})`} />
        <TabBtn active={tab === 'parents'} onClick={openParents} label="PARENT UPLOADS" badge={newParentCount} />
        <TabBtn active={tab === 'subs'} onClick={() => setTab('subs')} label={`SUB-EVENTS (${subEvents.length})`} />
      </nav>

      {error && <Banner tone="err">FEED ERROR — {error}</Banner>}
      {actionErr && <Banner tone="err" onDismiss={() => setActionErr('')}>{actionErr}</Banner>}
      {loading && <div style={{ padding: 24, fontFamily: mono, fontSize: 10, letterSpacing: '0.2em', color: P.mute }}>LOADING PHOTOS…</div>}

      {!loading && tab === 'tag' && (
        <TagGrid photos={lukePhotos} sel={sel} toggleSel={toggleSel} />
      )}
      {!loading && tab === 'parents' && (
        <ParentGrid photos={parentPhotos} onHideToggle={(p) => patchPhotos({ status: p.status === 'hidden' ? 'live' : 'hidden' }, [p.id])} onDelete={hardDelete} />
      )}
      {tab === 'subs' && (
        <SubEvents subEvents={subEvents} createdBy={email} refreshSubs={refreshSubs} setActionErr={setActionErr} />
      )}

      {sel.size > 0 && tab === 'tag' && (
        <BulkBar
          count={sel.size}
          subEvents={subEvents}
          onTeam={(t) => patchPhotos({ raider_team: t }, sel)}
          onSubEvent={(s) => patchPhotos(
            { sub_event_id: s.id, ...(s.team !== 'both' ? { raider_team: s.team } : {}) },
            sel,
          )}
          onClearSub={() => patchPhotos({ sub_event_id: null }, sel)}
          onPublish={() => patchPhotos({ visibility: 'public' }, sel)}
          onUnpublish={() => patchPhotos({ visibility: 'staged' }, sel)}
          onClear={clearSel}
        />
      )}
    </div>
  );
}

function TopBar() {
  return (
    <header style={{ padding: '14px 16px 12px', borderBottom: `1px solid ${P.hair}`, background: P.navy }}>
      <div style={{ fontFamily: mono, fontSize: 8.5, letterSpacing: '0.3em', color: P.gold }}>DISPATCH · OPTIC</div>
      <div style={{ fontFamily: oswald, fontSize: 19, letterSpacing: '0.04em', color: P.cream, lineHeight: 1.1, marginTop: 2 }}>
        {RHEA_EVENT_TITLE.toUpperCase()}
      </div>
    </header>
  );
}

function InstallHint() {
  const [prompt, setPrompt] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    const h = (e) => { e.preventDefault(); setPrompt(e); };
    window.addEventListener('beforeinstallprompt', h);
    return () => window.removeEventListener('beforeinstallprompt', h);
  }, []);

  if (isStandalone()) {
    return <div style={{ padding: '6px 16px', fontFamily: mono, fontSize: 8.5, letterSpacing: '0.16em', color: P.mute, background: P.navy }}>INSTALLED ✓ — RUNNING AS APP</div>;
  }
  if (dismissed) return null;

  return (
    <div style={{ padding: '10px 16px', background: 'rgba(201,169,97,0.08)', borderBottom: `1px solid ${P.hair}`, fontFamily: inter, fontSize: 12, color: P.cream, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
      {prompt ? (
        <>
          <span>Install this as an app for the day.</span>
          <button
            onClick={async () => { prompt.prompt(); await prompt.userChoice; setPrompt(null); }}
            style={miniGold}>INSTALL</button>
        </>
      ) : (
        <span style={{ color: P.mute }}>
          {isIos()
            ? 'To install: tap the Share icon, then "Add to Home Screen".'
            : 'To install: open your browser menu and choose "Install app" / "Add to Home screen".'}
        </span>
      )}
      <button onClick={() => setDismissed(true)} style={{ ...miniGhost, marginLeft: 'auto' }}>DISMISS</button>
    </div>
  );
}

function TabBtn({ active, onClick, label, badge }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, position: 'relative', background: active ? P.navy : 'transparent',
      border: 'none', borderBottom: `2px solid ${active ? P.gold : 'transparent'}`,
      color: active ? P.cream : P.mute, fontFamily: mono, fontSize: 9, letterSpacing: '0.12em',
      padding: '13px 4px', cursor: 'pointer',
    }}>
      {label}
      {badge > 0 && (
        <span style={{
          position: 'absolute', top: 6, right: 8, minWidth: 15, height: 15, lineHeight: '15px',
          background: P.gold, color: P.ink, borderRadius: 999, fontSize: 8.5, fontWeight: 700, padding: '0 3px',
        }}>{badge}</span>
      )}
    </button>
  );
}

function Banner({ tone, children, onDismiss }) {
  const c = tone === 'err' ? P.red : P.gold;
  return (
    <div style={{ margin: '10px 12px', border: `1px solid ${c}`, background: 'rgba(192,57,43,0.08)', padding: '9px 11px', fontFamily: mono, fontSize: 10, color: '#EBB4AC', letterSpacing: '0.04em', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
      <span style={{ flex: 1, lineHeight: 1.5 }}>{children}</span>
      {onDismiss && <button onClick={onDismiss} style={{ background: 'none', border: 'none', color: P.mute, cursor: 'pointer', fontSize: 13, lineHeight: 1 }}>×</button>}
    </div>
  );
}

function photoGridWrap(children) {
  return (
    <div style={{ padding: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(104px, 1fr))', gap: 8 }}>
      {children}
    </div>
  );
}

function TagGrid({ photos, sel, toggleSel }) {
  if (!photos.length) {
    return <Empty>No dump yet. Photos from /lukeupload land here automatically.</Empty>;
  }
  return photoGridWrap(photos.map((p) => {
    const on = sel.has(p.id);
    const tags = [raiderTeamLabel(p.raider_team), p.raider_sub_events?.name].filter(Boolean).join(' · ');
    return (
      <button key={p.id} onClick={() => toggleSel(p.id)} style={{
        position: 'relative', padding: 0, border: `2px solid ${on ? P.gold : P.hair}`,
        background: P.navyDeep, cursor: 'pointer', aspectRatio: '1 / 1', overflow: 'hidden',
      }}>
        <img src={p.thumb_url || p.photo_url} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: on ? 0.75 : 1 }} />
        <span style={{
          position: 'absolute', top: 4, left: 4, fontFamily: mono, fontSize: 7.5, letterSpacing: '0.08em',
          padding: '2px 4px', background: p.visibility === 'public' ? P.gold : 'rgba(6,16,31,0.8)',
          color: p.visibility === 'public' ? P.ink : P.mute,
        }}>{p.visibility === 'public' ? 'LIVE' : 'STAGED'}</span>
        {on && <span style={{ position: 'absolute', top: 4, right: 4, width: 16, height: 16, lineHeight: '16px', textAlign: 'center', background: P.gold, color: P.ink, fontSize: 10, fontWeight: 700 }}>✓</span>}
        {tags && (
          <span style={{ position: 'absolute', left: 0, right: 0, bottom: 0, fontFamily: mono, fontSize: 7.5, color: P.cream, background: 'rgba(6,16,31,0.82)', padding: '3px 4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tags}</span>
        )}
      </button>
    );
  }));
}

function ParentGrid({ photos, onHideToggle, onDelete }) {
  if (!photos.length) return <Empty>No parent uploads yet.</Empty>;
  return photoGridWrap(photos.map((p) => (
    <div key={p.id} style={{ position: 'relative', border: `1px solid ${p.status === 'hidden' ? P.red : P.hair}`, background: P.navyDeep, aspectRatio: '1 / 1', overflow: 'hidden' }}>
      <img src={p.thumb_url || p.photo_url} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: p.status === 'hidden' ? 0.35 : 1 }} />
      {p.uploader_name && (
        <span style={{ position: 'absolute', top: 0, left: 0, right: 0, fontFamily: mono, fontSize: 7.5, color: P.cream, background: 'rgba(6,16,31,0.8)', padding: '2px 4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.uploader_name}</span>
      )}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, display: 'flex' }}>
        <button onClick={() => onHideToggle(p)} style={{ flex: 1, border: 'none', background: 'rgba(6,16,31,0.85)', color: p.status === 'hidden' ? P.gold : P.cream, fontFamily: mono, fontSize: 7.5, letterSpacing: '0.06em', padding: '5px 2px', cursor: 'pointer' }}>
          {p.status === 'hidden' ? 'UNHIDE' : 'HIDE'}
        </button>
        <button onClick={() => onDelete(p)} style={{ border: 'none', borderLeft: `1px solid ${P.hair}`, background: 'rgba(6,16,31,0.85)', color: '#EBB4AC', fontFamily: mono, fontSize: 8.5, padding: '5px 7px', cursor: 'pointer' }}>✕</button>
      </div>
    </div>
  )));
}

function SubEvents({ subEvents, createdBy, refreshSubs, setActionErr }) {
  const [name, setName] = useState('');
  const [team, setTeam] = useState('both');
  const [busy, setBusy] = useState(false);

  async function create() {
    const n = name.trim();
    if (!n || busy) return;
    setBusy(true); setActionErr('');
    const { error } = await SB.from('raider_sub_events').insert({
      event_id: RHEA_EVENT_ID, name: n, team, created_by: createdBy.current || null,
    });
    setBusy(false);
    if (error) { setActionErr(error.message || 'Could not create sub-event.'); return; }
    setName(''); setTeam('both'); refreshSubs();
  }

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Sub-event name (e.g. Rope Bridge)"
          onKeyDown={(e) => { if (e.key === 'Enter') create(); }}
          style={{ flex: '1 1 180px', boxSizing: 'border-box', background: P.navyDeep, border: `1px solid ${P.hair}`, color: P.cream, fontFamily: inter, fontSize: 14, padding: '10px 12px', outline: 'none' }} />
        <select value={team} onChange={(e) => setTeam(e.target.value)}
          style={{ background: P.navyDeep, border: `1px solid ${P.hair}`, color: P.cream, fontFamily: mono, fontSize: 12, padding: '10px 8px' }}>
          {TEAMS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
        <button onClick={create} disabled={busy || !name.trim()} style={{ ...miniGold, opacity: busy || !name.trim() ? 0.4 : 1 }}>ADD</button>
      </div>

      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {subEvents.length === 0 && <Empty>None yet. Create the first sub-event above.</Empty>}
        {subEvents.map((s) => (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, border: `1px solid ${P.hair}`, background: P.navy, padding: '10px 12px' }}>
            <span style={{ fontFamily: inter, fontSize: 14, color: P.cream, flex: 1 }}>{s.name}</span>
            <span style={{ fontFamily: mono, fontSize: 9, letterSpacing: '0.1em', color: P.gold, border: `1px solid ${P.hair}`, padding: '2px 6px' }}>{s.team.toUpperCase()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BulkBar({ count, subEvents, onTeam, onSubEvent, onClearSub, onPublish, onUnpublish, onClear }) {
  return (
    <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, background: P.navy, borderTop: `1px solid ${P.gold}`, padding: '10px 12px 14px', zIndex: 30 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontFamily: mono, fontSize: 10, letterSpacing: '0.1em', color: P.bright }}>{count} SELECTED</span>
        <button onClick={onClear} style={{ ...miniGhost, marginLeft: 'auto' }}>CLEAR</button>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {TEAMS.map((t) => (
          <button key={t.id} onClick={() => onTeam(t.id)} style={miniGhost}>{t.label.toUpperCase()}</button>
        ))}
        <select
          defaultValue=""
          onChange={(e) => {
            if (e.target.value === '__clear') { onClearSub(); e.target.value = ''; return; }
            const s = subEvents.find((x) => x.id === e.target.value);
            if (s) onSubEvent(s);
            e.target.value = '';
          }}
          style={{ background: P.navyDeep, border: `1px solid ${P.hair}`, color: P.cream, fontFamily: mono, fontSize: 11, padding: '8px 6px', flex: '1 1 120px' }}>
          <option value="" disabled>SET SUB-EVENT…</option>
          {subEvents.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.team})</option>)}
          <option value="__clear">— clear sub-event —</option>
        </select>
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
        <button onClick={onPublish} style={{ ...miniGold, flex: 1 }}>PUBLISH</button>
        <button onClick={onUnpublish} style={{ ...miniGhost, flex: 1 }}>UNPUBLISH</button>
      </div>
    </div>
  );
}

function Empty({ children }) {
  return <div style={{ margin: 16, border: `1px dashed ${P.hair}`, padding: '28px 16px', textAlign: 'center', fontFamily: inter, fontSize: 13, color: P.mute }}>{children}</div>;
}

const miniGold = { background: P.gold, color: P.ink, border: 'none', fontFamily: mono, fontSize: 9.5, letterSpacing: '0.12em', fontWeight: 600, padding: '9px 12px', cursor: 'pointer' };
const miniGhost = { background: 'transparent', border: `1px solid ${P.hair}`, color: P.cream, fontFamily: mono, fontSize: 9.5, letterSpacing: '0.12em', padding: '9px 12px', cursor: 'pointer' };
