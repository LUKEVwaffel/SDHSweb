import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { supabase as SB } from '../../lib/supabaseClient';
import AdminGate from './AdminGate';
import { useRheaPhotos, useRheaSubEvents } from '../../hooks/useRheaPhotos';
import { RHEA_EVENT_ID, RHEA_EVENT_TITLE, raiderTeamLabel } from '../../lib/rheaComp';
import { installPwaHooks, isStandalone, isIos } from './pwa';
import './lukepwa.css';

const TEAMS = [
  { id: 'male', label: 'MALE' },
  { id: 'coed', label: 'COED' },
  { id: 'both', label: 'BOTH' },
];
const TABS = ['tag', 'parents', 'subs'];
const PARENT_SEEN_KEY = 'rhea_pwa_parent_seen';

// Android gives real haptics; iOS Safari ignores vibrate() harmlessly. Cheap
// win for how physical the console feels on a phone.
const haptic = (p) => { try { navigator.vibrate?.(p); } catch { /* unsupported */ } };

// ── /lukepwa — OPTIC command console. Luke's homebase for the 12h day: every
// tap answers instantly, selection feels physical, publishing commits with a
// visible pulse. All curation / tagging / moderation happens here, from a
// phone, and nothing in this file can reach the parent or cadet UIs.
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

  const [tab, setTab] = useState('tag');
  const [sel, setSel] = useState(() => new Set());
  const [actionErr, setActionErr] = useState('');
  const [overrides, setOverrides] = useState({});      // optimistic patch overlay
  const [pulseIds, setPulseIds] = useState(() => new Set()); // tiles flashing "changed"
  const [bump, setBump] = useState({});                // tab counts that just grew
  const [seenAt, setSeenAt] = useState(() => Number(localStorage.getItem(PARENT_SEEN_KEY) || 0));

  const email = useRef(null);
  const flashTimers = useRef({});
  const prevCounts = useRef({ luke: 0, parent: 0, subs: 0 });

  useEffect(() => {
    SB.auth.getSession().then(({ data }) => { email.current = data.session?.user?.email || null; });
  }, []);

  // A fresh photos array from realtime/refetch is server truth — drop the
  // optimistic overlay so the two can't drift.
  useEffect(() => { setOverrides({}); }, [photos]);

  const merged = useMemo(
    () => photos.map((p) => (overrides[p.id] ? { ...p, ...overrides[p.id] } : p)),
    [photos, overrides],
  );
  const lukePhotos = useMemo(
    () => merged.filter((p) => p.source === 'luke')
      .sort((a, b) => (a.visibility === b.visibility ? 0 : a.visibility === 'staged' ? -1 : 1)),
    [merged],
  );
  const parentPhotos = useMemo(() => merged.filter((p) => p.source === 'parent'), [merged]);
  const stagedIds = useMemo(
    () => lukePhotos.filter((p) => p.visibility === 'staged').map((p) => p.id),
    [lukePhotos],
  );
  const liveCount = lukePhotos.length - stagedIds.length;
  const newParentCount = useMemo(
    () => parentPhotos.filter((p) => new Date(p.created_at).getTime() > seenAt).length,
    [parentPhotos, seenAt],
  );
  const subCounts = useMemo(() => {
    const m = {};
    for (const p of merged) if (p.sub_event_id) m[p.sub_event_id] = (m[p.sub_event_id] || 0) + 1;
    return m;
  }, [merged]);

  // Bump a tab's count when it grows (new dump / new parent photo / new sub-event).
  useEffect(() => {
    const cur = { luke: lukePhotos.length, parent: parentPhotos.length, subs: subEvents.length };
    const grew = {};
    for (const k of ['luke', 'parent', 'subs']) {
      if (cur[k] > prevCounts.current[k]) grew[k] = true;
    }
    prevCounts.current = cur;
    if (Object.keys(grew).length) {
      setBump(grew);
      const t = setTimeout(() => setBump({}), 340);
      return () => clearTimeout(t);
    }
  }, [lukePhotos.length, parentPhotos.length, subEvents.length]);

  const flash = useCallback((ids) => {
    setPulseIds((s) => { const n = new Set(s); ids.forEach((i) => n.add(i)); return n; });
    ids.forEach((i) => {
      clearTimeout(flashTimers.current[i]);
      flashTimers.current[i] = setTimeout(() => {
        setPulseIds((s) => { const n = new Set(s); n.delete(i); return n; });
      }, 660);
    });
  }, []);

  const toggleSel = useCallback((id) => {
    haptic(9);
    setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }, []);
  const clearSel = useCallback(() => setSel(new Set()), []);
  const selectAllStaged = useCallback(() => { haptic(14); setSel(new Set(stagedIds)); }, [stagedIds]);

  const go = useCallback((t) => { haptic(9); setTab(t); }, []);
  const openParents = useCallback(() => {
    haptic(9);
    setTab('parents');
    const now = Date.now();
    localStorage.setItem(PARENT_SEEN_KEY, String(now));
    setSeenAt(now);
  }, []);

  async function applyPatch(patch, ids) {
    const list = [...ids];
    if (!list.length) return;
    setActionErr('');
    haptic(12);
    setOverrides((o) => {
      const n = { ...o };
      list.forEach((id) => { n[id] = { ...(n[id] || {}), ...patch }; });
      return n;
    });
    flash(list);
    const { error: e } = await SB.from('photos').update(patch).in('id', list);
    if (e) {
      setActionErr(e.message || 'Update failed — check signal and tap again.');
      setOverrides((o) => { const n = { ...o }; list.forEach((id) => delete n[id]); return n; });
      haptic([8, 40, 8]);
      return;
    }
    refresh();
  }

  async function hardDelete(photo) {
    if (!window.confirm('Permanently delete this photo? The file is removed for good.')) return;
    setActionErr('');
    haptic([10, 40, 10]);
    const thumb = photo.storage_path?.replace(/\.jpg$/i, '_t.jpg');
    await SB.storage.from('team-photos').remove([photo.storage_path, thumb].filter(Boolean));
    const { error: e } = await SB.from('photos').delete().eq('id', photo.id);
    if (e) { setActionErr(e.message || 'Delete failed — tap again.'); return; }
    setSel((s) => { const n = new Set(s); n.delete(photo.id); return n; });
    refresh();
  }

  const drawerOpen = sel.size > 0 && tab === 'tag';
  const tabIndex = TABS.indexOf(tab);

  return (
    <div className="lp" data-drawer={drawerOpen}>
      <header className="lp-head">
        <div>
          <div className="lp-kicker">DISPATCH · OPTIC</div>
          <div className="lp-title">{RHEA_EVENT_TITLE.toUpperCase()}</div>
        </div>
        <div className="lp-sync">
          <span className="lp-dot" data-stale={!!error} />
          {error ? 'OFFLINE' : loading ? 'SYNC' : 'LIVE'}
        </div>
      </header>

      {!isStandalone() && <InstallStrip />}

      <nav className="lp-tabs">
        <button className="lp-tab" data-active={tab === 'tag'} onClick={() => go('tag')}>
          TAGGING <Count n={lukePhotos.length} bump={bump.luke} />
        </button>
        <button className="lp-tab" data-active={tab === 'parents'} onClick={openParents}>
          PARENTS <Count n={parentPhotos.length} bump={bump.parent} />
          {newParentCount > 0 && <span className="lp-tabbadge">{newParentCount}</span>}
        </button>
        <button className="lp-tab" data-active={tab === 'subs'} onClick={() => go('subs')}>
          EVENTS <Count n={subEvents.length} bump={bump.subs} />
        </button>
        <span className="lp-tab-ind" style={{ transform: `translateX(${tabIndex * 100}%)` }} />
      </nav>

      {error && <div className="lp-banner">FEED ERROR — {error}</div>}
      {actionErr && (
        <div className="lp-banner">
          <span style={{ flex: 1 }}>{actionErr}</span>
          <button onClick={() => setActionErr('')} aria-label="Dismiss">×</button>
        </div>
      )}

      {loading && <LoadingGrid />}

      {!loading && tab === 'tag' && (
        <div className="lp-panel" key="tag">
          <div className="lp-strip">
            <span><b>{stagedIds.length}</b> STAGED</span>
            <span><b>{liveCount}</b> LIVE</span>
            {stagedIds.length > 0 && (
              <button className="lp-btn lp-btn--ghost lp-btn--sm" style={{ marginLeft: 'auto' }} onClick={selectAllStaged}>
                SELECT ALL STAGED
              </button>
            )}
          </div>
          <TagGrid photos={lukePhotos} sel={sel} pulseIds={pulseIds} toggleSel={toggleSel} />
        </div>
      )}

      {!loading && tab === 'parents' && (
        <div className="lp-panel" key="parents">
          <ParentGrid
            photos={parentPhotos}
            pulseIds={pulseIds}
            onHideToggle={(p) => applyPatch({ status: p.status === 'hidden' ? 'live' : 'hidden' }, [p.id])}
            onDelete={hardDelete}
          />
        </div>
      )}

      {!loading && tab === 'subs' && (
        <div className="lp-panel" key="subs">
          <SubEvents
            subEvents={subEvents}
            counts={subCounts}
            emailRef={email}
            refreshSubs={refreshSubs}
            setActionErr={setActionErr}
          />
        </div>
      )}

      <BulkDrawer
        open={drawerOpen}
        count={sel.size}
        subEvents={subEvents}
        onTeam={(t) => applyPatch({ raider_team: t }, sel)}
        onSubEvent={(s) => applyPatch({ sub_event_id: s.id, ...(s.team !== 'both' ? { raider_team: s.team } : {}) }, sel)}
        onClearSub={() => applyPatch({ sub_event_id: null }, sel)}
        onPublish={() => { haptic(22); applyPatch({ visibility: 'public' }, sel); clearSel(); }}
        onUnpublish={() => { applyPatch({ visibility: 'staged' }, sel); clearSel(); }}
        onClear={clearSel}
      />
    </div>
  );
}

function Count({ n, bump }) {
  return <span className="lp-count" data-bump={bump ? 'true' : 'false'}>{n}</span>;
}

function InstallStrip() {
  const [prompt, setPrompt] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    const h = (e) => { e.preventDefault(); setPrompt(e); };
    window.addEventListener('beforeinstallprompt', h);
    return () => window.removeEventListener('beforeinstallprompt', h);
  }, []);
  if (dismissed) return null;
  return (
    <div className="lp-install">
      {prompt ? (
        <>
          <span>Install OPTIC as an app for the day.</span>
          <button
            className="lp-btn lp-btn--sm"
            onClick={async () => { prompt.prompt(); await prompt.userChoice; setPrompt(null); }}
          >
            INSTALL
          </button>
        </>
      ) : (
        <span style={{ color: 'var(--mute)' }}>
          {isIos() ? 'Install: Share icon → Add to Home Screen.' : 'Install: browser menu → Install app.'}
        </span>
      )}
      <button
        className="lp-btn lp-btn--ghost lp-btn--sm"
        style={{ marginLeft: 'auto' }}
        onClick={() => setDismissed(true)}
      >
        DISMISS
      </button>
    </div>
  );
}

function LoadingGrid() {
  return (
    <>
      <div className="lp-bar" />
      <div className="lp-grid">
        {Array.from({ length: 12 }).map((_, i) => <div key={i} className="lp-skel" />)}
      </div>
    </>
  );
}

function TagGrid({ photos, sel, pulseIds, toggleSel }) {
  if (!photos.length) {
    return (
      <Empty k="STANDING BY">
        No dump yet. Photos from the SD-card tool appear here the moment they finish uploading.
      </Empty>
    );
  }
  return (
    <div className="lp-grid">
      {photos.map((p, i) => {
        const on = sel.has(p.id);
        const cap = [raiderTeamLabel(p.raider_team), p.raider_sub_events?.name].filter(Boolean).join(' · ');
        return (
          <button
            key={p.id}
            className="lp-tile"
            aria-pressed={on}
            data-sel={on}
            data-pulse={pulseIds.has(p.id)}
            style={{ animationDelay: `${Math.min(i * 24, 300)}ms` }}
            onClick={() => toggleSel(p.id)}
          >
            <img src={p.thumb_url || p.photo_url} alt="" loading="lazy" />
            <span className="lp-tilepill" data-live={p.visibility === 'public'}>
              {p.visibility === 'public' ? 'LIVE' : 'STAGED'}
            </span>
            {on && <span className="lp-check">✓</span>}
            {cap && <span className="lp-cap">{cap}</span>}
          </button>
        );
      })}
    </div>
  );
}

function ParentGrid({ photos, pulseIds, onHideToggle, onDelete }) {
  if (!photos.length) {
    return (
      <Empty k="ALL QUIET">
        No parent uploads yet. They land here live as families post from the stands.
      </Empty>
    );
  }
  return (
    <div className="lp-grid">
      {photos.map((p, i) => {
        const hidden = p.status === 'hidden';
        return (
          <div
            key={p.id}
            className="lp-tile"
            data-dim={hidden}
            data-pulse={pulseIds.has(p.id)}
            style={{ animationDelay: `${Math.min(i * 24, 300)}ms`, cursor: 'default' }}
          >
            <img src={p.thumb_url || p.photo_url} alt="" loading="lazy" />
            {hidden && <span className="lp-tilepill" data-hidden="true">HIDDEN</span>}
            {!hidden && p.uploader_name && <span className="lp-cap lp-cap--top">{p.uploader_name}</span>}
            <div className="lp-tileact">
              <button onClick={() => onHideToggle(p)}>{hidden ? 'UNHIDE' : 'HIDE'}</button>
              <button className="x" onClick={() => onDelete(p)} aria-label="Delete permanently">✕</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SubEvents({ subEvents, counts, emailRef, refreshSubs, setActionErr }) {
  const [name, setName] = useState('');
  const [team, setTeam] = useState('both');
  const [busy, setBusy] = useState(false);
  const [freshId, setFreshId] = useState(null);

  async function create() {
    const n = name.trim();
    if (!n || busy) return;
    setBusy(true); setActionErr('');
    haptic(14);
    const { data, error } = await SB.from('raider_sub_events')
      .insert({ event_id: RHEA_EVENT_ID, name: n, team, created_by: emailRef.current || null })
      .select().single();
    setBusy(false);
    if (error) { setActionErr(error.message || 'Could not create sub-event.'); haptic([8, 40, 8]); return; }
    setName(''); setTeam('both');
    if (data?.id) { setFreshId(data.id); setTimeout(() => setFreshId(null), 950); }
    refreshSubs();
  }

  return (
    <>
      <div className="lp-create">
        <input
          className="lp-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New sub-event  ·  e.g. Rope Bridge"
          onKeyDown={(e) => { if (e.key === 'Enter') create(); }}
        />
        <div className="lp-seg" role="group" aria-label="Team">
          {TEAMS.map((t) => (
            <button
              key={t.id}
              data-on={team === t.id}
              aria-pressed={team === t.id}
              onClick={() => { haptic(8); setTeam(t.id); }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button className="lp-btn" onClick={create} disabled={busy || !name.trim()}>
          {busy ? 'CREATING…' : 'CREATE SUB-EVENT'}
        </button>
      </div>

      <div style={{ padding: '4px 14px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {subEvents.length === 0 && (
          <Empty k="NO SUB-EVENTS">
            Create the first one above, then tag photos to it from the Tagging tab.
          </Empty>
        )}
        {subEvents.map((s) => {
          const n = counts[s.id] || 0;
          return (
            <div key={s.id} className="lp-row" data-fresh={s.id === freshId}>
              <span className="lp-row-name">{s.name}</span>
              <span className="lp-row-n">{n} PHOTO{n === 1 ? '' : 'S'}</span>
              <span className="lp-row-team">{s.team.toUpperCase()}</span>
            </div>
          );
        })}
      </div>
    </>
  );
}

function BulkDrawer({ open, count, subEvents, onTeam, onSubEvent, onClearSub, onPublish, onUnpublish, onClear }) {
  return (
    <div className="lp-drawer" data-open={open} aria-hidden={!open}>
      <div className="lp-drawer-hd">
        <b>{count} SELECTED</b>
        <button className="lp-btn lp-btn--ghost lp-btn--sm" style={{ marginLeft: 'auto' }} onClick={onClear}>
          CLEAR
        </button>
      </div>

      <div className="lp-drawer-lbl">TEAM</div>
      <div className="lp-seg">
        {TEAMS.map((t) => <button key={t.id} onClick={() => onTeam(t.id)}>{t.label}</button>)}
      </div>

      <div className="lp-drawer-lbl">SUB-EVENT</div>
      <div className="lp-chips">
        {subEvents.length === 0 && (
          <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--faint)', padding: '10px 2px', whiteSpace: 'nowrap' }}>
            none yet — make one in EVENTS
          </span>
        )}
        {subEvents.map((s) => (
          <button key={s.id} className="lp-chip" onClick={() => onSubEvent(s)}>{s.name}</button>
        ))}
        {subEvents.length > 0 && <button className="lp-chip" onClick={onClearSub}>✕ CLEAR</button>}
      </div>

      <div style={{ display: 'flex', gap: 6, marginTop: 14 }}>
        <button className="lp-btn" style={{ flex: 2 }} onClick={onPublish}>PUBLISH</button>
        <button className="lp-btn lp-btn--ghost" style={{ flex: 1 }} onClick={onUnpublish}>UNPUBLISH</button>
      </div>
    </div>
  );
}

function Empty({ k, children }) {
  return (
    <div className="lp-empty">
      <span className="k">{k}</span>
      {children}
    </div>
  );
}
