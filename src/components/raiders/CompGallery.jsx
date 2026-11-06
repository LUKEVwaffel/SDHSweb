import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Link, useSearchParams } from 'react-router-dom';
import { useCompGallery } from '../../hooks/useCompGallery';
import './compGallery.css';
import { compEventMeta } from '../../lib/raiderCompGallery';

const teamName = (team) => ({ male: 'Male team', coed: 'Coed team', both: 'Both teams' }[team] || 'Team not tagged');
const eventName = (photo) => compEventMeta(photo.raider_sub_events)?.name || photo.raider_sub_events?.name || 'General photos';
const eventKey = (photo) => compEventMeta(photo.raider_sub_events)?.key || eventName(photo).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const dateLabel = (date) => date ? new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';

function Viewer({ photos, initial, onClose }) {
  const [index, setIndex] = useState(initial);
  const [failed, setFailed] = useState(false);
  const closeRef = useRef(null);
  const touch = useRef(null);
  const step = useCallback((direction) => setIndex((i) => (i + direction + photos.length) % photos.length), [photos.length]);
  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); step(e.key === 'ArrowRight' ? 1 : -1); }
      if (e.key === 'Tab') {
        const controls = [...closeRef.current.closest('[role="dialog"]').querySelectorAll('button,a[href]')].filter((el) => !el.disabled);
        const current = controls.indexOf(document.activeElement);
        e.preventDefault();
        controls[(current + (e.shiftKey ? -1 : 1) + controls.length) % controls.length]?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = overflow; window.removeEventListener('keydown', onKey); previous?.focus(); };
  }, [onClose, step]);
  useEffect(() => {
    setFailed(false);
    for (const offset of [-1, 1]) {
      const next = photos[(index + offset + photos.length) % photos.length];
      const image = new Image(); image.src = next.photo_url || next.thumb_url;
    }
  }, [index, photos]);
  const photo = photos[Math.min(index, photos.length - 1)];
  return createPortal(
    <div className="rg-viewer" role="dialog" aria-modal="true" aria-label="Raider photo viewer">
      <header><span>RAIDER ARCHIVE</span><button ref={closeRef} onClick={onClose} aria-label="Close photo viewer">Close ×</button></header>
      <div className="rg-stage" onTouchStart={(e) => { const p = e.touches[0]; touch.current = { x: p.clientX, y: p.clientY }; }} onTouchEnd={(e) => {
        if (!touch.current) return;
        const p = e.changedTouches[0], dx = p.clientX - touch.current.x, dy = p.clientY - touch.current.y;
        if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy)) step(dx < 0 ? 1 : -1);
        touch.current = null;
      }}>
        {failed ? <p>Photo could not load. Try opening the full-size image below.</p> : <img key={photo.id} src={photo.photo_url || photo.thumb_url} alt={`${eventName(photo)} · ${teamName(photo.raider_team)}`} onError={() => setFailed(true)} />}
      </div>
      <footer>
        <div className="rg-view-controls"><button onClick={() => step(-1)} disabled={photos.length < 2} aria-label="Previous photo">←</button><span aria-live="polite">{index + 1} / {photos.length}</span><button onClick={() => step(1)} disabled={photos.length < 2} aria-label="Next photo">→</button></div>
        <div className="rg-caption">{eventName(photo)} · {teamName(photo.raider_team)}{photo.uploader_name ? ` · ${photo.uploader_name}` : ''}</div>
        <a href={photo.photo_url || photo.thumb_url} target="_blank" rel="noopener noreferrer">Open full-size photo ↗</a>
      </footer>
    </div>, document.body,
  );
}

export default function CompGallery() {
  const { photos, competitions, loading, error, refresh } = useCompGallery();
  const [params, setParams] = useSearchParams();
  const [viewer, setViewer] = useState(null);
  const [page, setPage] = useState(0);
  const close = useCallback(() => setViewer(null), []);
  const filterKey = params.toString();
  useEffect(() => { setViewer(null); setPage(0); }, [filterKey]);
  const selected = competitions.find((c) => c.id === params.get('comp'));
  const team = params.get('team') || 'all';
  const event = params.get('event') || 'all';
  const base = selected?.photos || photos;
  const events = useMemo(() => [...new Map(base.map((p) => [eventKey(p), eventName(p)])).entries()].sort((a, b) => a[1].localeCompare(b[1])), [base]);
  const filtered = useMemo(() => base.filter((p) => (team === 'all' || (team === 'untagged' ? !p.raider_team : p.raider_team === team)) && (event === 'all' || (eventKey(p) === event || p.sub_event_id === event))), [base, team, event]);
  const pageSize = 60;
  const pages = Math.ceil(filtered.length / pageSize);
  const currentPage = Math.min(page, Math.max(0, pages - 1));
  const change = (key, value) => {
    const next = new URLSearchParams(params);
    if (value === 'all') next.delete(key); else next.set(key, value);
    if (key === 'comp') next.delete('event');
    setViewer(null); setPage(0); setParams(next);
  };
  const movePage = (direction) => { setPage(currentPage + direction); document.getElementById('rg-results')?.scrollIntoView({ block: 'start' }); };
  return <main className="rg">
    <div className="rg-wrap">
      <Link className="rg-back" to="/raiders">← Raiders</Link>
      <div className="rg-eyebrow">THE SEASON IN PHOTOS</div>
      <h1>RAIDER PHOTO ARCHIVE</h1>
      <p className="rg-intro">Every available competition, in one place. Choose a competition, team, or event, then open a photo and browse with the arrows. Swipe on your phone or use your keyboard’s arrow keys.</p>
      {!loading && !error && <p className="rg-total">{photos.length.toLocaleString()} photos · {competitions.length} albums</p>}
      {loading ? <p role="status">Loading the photo archive…</p> : error ? <div role="alert"><p>We couldn’t load the archive. Please try again.</p><button onClick={refresh}>Try again</button></div> : <>
        <div className="rg-albums" aria-label="Competition albums">
          <button className={!selected ? 'active' : ''} onClick={() => change('comp', 'all')}>All competitions <span>{photos.length}</span></button>
          {competitions.map((c) => <button key={c.id} className={selected?.id === c.id ? 'active' : ''} onClick={() => change('comp', c.id)}>{c.title}<small>{dateLabel(c.date)} · {c.photos.length} photos</small></button>)}
        </div>
        <div className="rg-filters">
          <label>Raider team<select value={team} onChange={(e) => change('team', e.target.value)}><option value="all">All teams</option><option value="male">Male team</option><option value="coed">Coed team</option><option value="both">Both teams</option><option value="untagged">Team not tagged</option></select></label>
          <label>Event<select value={events.some(([id]) => id === event) ? event : 'all'} onChange={(e) => change('event', e.target.value)}><option value="all">All events</option>{events.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
          <p>Company labels are not available for these photos. Untagged shots are included in General photos.</p>
        </div>
        <div className="rg-result-heading" id="rg-results"><h2>{selected?.title || 'All competitions'}</h2><span role="status">{filtered.length.toLocaleString()} photos</span></div>
        {!filtered.length && <p>No photos match these filters. Choose another team or event.</p>}
        <div className="rg-grid">
          {filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize).map((p, i) => <button key={p.id} className="rg-tile" onClick={() => setViewer(currentPage * pageSize + i)} aria-label={`View ${eventName(p)}, ${teamName(p.raider_team)}, photo ${currentPage * pageSize + i + 1}`}>
            <img src={p.grid_url || p.thumb_url || p.photo_url} alt="" loading="lazy" onError={(e) => { if (e.currentTarget.dataset.fallback) return; e.currentTarget.dataset.fallback = '1'; e.currentTarget.src = p.thumb_url || p.photo_url; }} />
            <span>{eventName(p)}<small>{teamName(p.raider_team)}</small></span>
          </button>)}
        </div>
        {pages > 1 && <nav className="rg-pagination" aria-label="Photo pages"><button disabled={currentPage === 0} onClick={() => movePage(-1)}>← Previous</button><span>Page {currentPage + 1} of {pages}</span><button disabled={currentPage === pages - 1} onClick={() => movePage(1)}>Next →</button></nav>}
      </>}
    </div>
    {viewer != null && filtered.length > 0 && <Viewer photos={filtered} initial={viewer} onClose={close} />}
  </main>;
}
