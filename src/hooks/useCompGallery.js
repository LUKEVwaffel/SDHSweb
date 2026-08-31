import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase as SB } from '../lib/supabaseClient';
import { COMP_EVENT_ID, COMP_EVENTS, sortSubEvents, compEventMeta } from '../lib/raiderCompGallery';

// Public read model for /raiders/comp. One fetch on mount - retrospective
// gallery, no live-event pressure.
//
// A photo shows here when ALL of:
//   event_id   = the comp
//   source     = 'luke'          → only Luke's own uploads
//   status     = 'live'          → not hidden in /lukepwa
//   sub_event_id is not null     → tagged to a sub-event
//
// Parent uploads (source='parent') are excluded on purpose. `visibility` is
// NOT filtered - Luke's dump defaults 'staged'; "tagged by Luke" is the
// intent signal for this permanent gallery.
//
// ALL 6 canonical events are always returned, even with zero photos, so the
// grid can show a "coming soon" state for the ones Luke hasn't posted yet.
// Extra sub-event buckets (Luke's staging labels) show only once they have
// photos.

const slugify = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function useCompGallery() {
  const [subEvents, setSubEvents] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const alive = useRef(true);

  const load = useCallback(async () => {
    const [se, ph] = await Promise.all([
      SB.from('raider_sub_events').select('*').eq('event_id', COMP_EVENT_ID),
      SB.from('photos')
        .select('id, photo_url, thumb_url, uploader_name, sub_event_id, created_at')
        .eq('event_id', COMP_EVENT_ID)
        .eq('source', 'luke')
        .eq('status', 'live')
        .not('sub_event_id', 'is', null)
        .order('created_at', { ascending: true }),
    ]);
    if (!alive.current) return;
    const firstErr = se.error || ph.error;
    setError(firstErr ? (firstErr.message || String(firstErr)) : null);
    setSubEvents(sortSubEvents(se.data || []));
    setPhotos(ph.data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    alive.current = true;
    load();
    return () => { alive.current = false; };
  }, [load]);

  const photosFor = (subEventId) => photos.filter((p) => p.sub_event_id === subEventId);
  const groupOf = (name, blurb, photoList, slug, hasVideo = false) => ({
    slug,
    name,
    blurb: blurb || null,
    photos: photoList,
    cover: photoList[0]?.thumb_url || photoList[0]?.photo_url || null,
    hasContent: photoList.length > 0,
    hasVideo,
  });

  // 1. The canonical events, in chronological order - matched to a real
  //    sub-event row if one exists, otherwise a placeholder with no photos.
  //    Position = its index in COMP_EVENTS.
  const matchedIds = new Set();
  const canonical = COMP_EVENTS.map((ev, i) => {
    const row = subEvents.find((s) => compEventMeta(s)?.name === ev.name);
    if (row) matchedIds.add(row.id);
    return { ...groupOf(ev.name, ev.blurb, row ? photosFor(row.id) : [], ev.key, ev.hasVideo), pos: i };
  });

  // 2. Any other sub-event bucket (Luke's staging labels) that has photos.
  //    A name like "Before CCR" / "Pre Tire Stacker" anchors just before the
  //    canonical event it names; "After …" anchors just after. Anything else
  //    trails at the end in creation order.
  const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const ANCHOR_RE = /^(before|pre|after|post)\s+(.+)$/;
  const eventIndex = (name) => {
    const meta = compEventMeta({ name });
    return meta ? COMP_EVENTS.findIndex((e) => e.name === meta.name) : -1;
  };

  const extras = subEvents
    .filter((s) => !matchedIds.has(s.id))
    .map((s, idx) => {
      const g = groupOf(s.name, compEventMeta(s)?.blurb, photosFor(s.id), slugify(s.name));
      let pos = 500 + idx;
      const m = norm(s.name).match(ANCHOR_RE);
      const ai = m ? eventIndex(m[2]) : -1;
      if (ai >= 0) pos = ai + (m[1] === 'before' || m[1] === 'pre' ? -0.4 : 0.4);
      return { ...g, pos };
    })
    .filter((g) => g.hasContent);

  const groups = [...canonical, ...extras].sort((a, b) => a.pos - b.pos);

  return {
    groups,
    totals: {
      events: groups.length,
      withPhotos: groups.filter((g) => g.hasContent).length,
      photos: photos.length,
    },
    loading,
    error,
    refresh: load,
  };
}
