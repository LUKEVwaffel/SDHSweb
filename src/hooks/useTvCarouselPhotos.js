import { useState, useEffect } from 'react';
import { supabase as SB } from '../lib/supabaseClient';
import { TV_PHOTOS } from '../lib/tvPhotos.js';
import { getTeam } from '../lib/teams.js';
import { resolveTvPhotoCaption } from '../lib/tvPhotoCaption.js';

/**
 * Resolves today's carousel photo list + display title from the daily
 * control-center settings:
 *  - 'team'   (the default): admin-curated TV Photos folders (tv_photos —
 *              see supabase/tv_photos.sql) for the featured team(s) PLUS the
 *              Battalion folder, always mixed in. Previously queried the
 *              public submission pool (public.photos) — reconciled to the
 *              dedicated admin-only table so an unmoderated public upload can
 *              never land on the kiosk. Live-synced (see the realtime
 *              subscription below), so a folder upload appears without a
 *              kiosk reload.
 *  - 'event'  a specific past event's photos.
 *  - 'upload' the 1SGT's fresh batch for today.
 * Falls back to the original hardcoded Raiders set only when there's
 * genuinely nothing else to show (e.g. a brand-new team with zero photos on
 * file yet), so the kiosk never shows a blank carousel.
 */
export function useTvCarouselPhotos(settings) {
  const mode = settings?.photo_source_mode ?? 'team';
  const eventId = settings?.photo_source_event_id ?? null;
  const featuredTeams = settings?.featured_teams ?? [];
  const teamsKey = featuredTeams.slice().sort().join(',');
  const [queriedPhotos, setQueriedPhotos] = useState([]);

  useEffect(() => {
    let alive = true;

    if (mode === 'event' && eventId) {
      SB.from('photos').select('id,photo_url').eq('event_id', eventId).eq('status', 'live')
        .order('created_at', { ascending: false }).limit(30)
        .then(({ data }) => { if (alive) setQueriedPhotos(data || []); });
      return () => { alive = false; };
    }

    if (mode === 'team' && featuredTeams.length) {
      const folders = Array.from(new Set([...featuredTeams, 'battalion']));
      const load = () => SB.from('tv_photos').select('id,photo_url,title,folders,focal_x,focal_y').overlaps('folders', folders)
        .order('created_at', { ascending: false }).limit(30)
        .then(({ data }) => { if (alive) setQueriedPhotos(data || []); });
      load();

      // Live sync: a folder upload/delete from the TV Photos tab reflects on
      // every open kiosk in memory, no reload — same pattern as
      // useTvDailySettings.js. A light poll rides alongside as a fallback in
      // case a kiosk's socket silently drops during an all-day-open session.
      const channel = SB.channel(`tv-photos-live-${folders.join('-')}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tv_photos' }, (payload) => {
          const row = payload.new?.folders ? payload.new : payload.old;
          if (row?.folders?.some((f) => folders.includes(f))) load();
        })
        .subscribe();
      const pollId = setInterval(load, 60_000);

      return () => { alive = false; SB.removeChannel(channel); clearInterval(pollId); };
    }

    setQueriedPhotos([]);
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- teamsKey is the stable serialization of featuredTeams
  }, [mode, eventId, teamsKey]);

  const teamLabel = featuredTeams.map((id) => getTeam(id)?.label).filter(Boolean).join(' · ') || null;

  if (mode === 'upload' && settings?.uploaded_photo_urls?.length) {
    return {
      photos: settings.uploaded_photo_urls.map((src, i) => ({ src, alt: `Daily upload ${i + 1}`, title: teamLabel || 'Today' })),
      teamLabel,
    };
  }

  if (mode === 'event' && queriedPhotos.length) {
    return {
      photos: queriedPhotos.map((p, i) => ({ src: p.photo_url, alt: `Photo ${i + 1}`, title: teamLabel || 'Today' })),
      teamLabel,
    };
  }

  if (mode === 'team' && queriedPhotos.length) {
    return {
      photos: queriedPhotos.map((p, i) => ({
        src: p.photo_url, alt: `Photo ${i + 1}`, title: resolveTvPhotoCaption(p),
        focalX: p.focal_x ?? 0.5, focalY: p.focal_y ?? 0.5,
      })),
      teamLabel,
    };
  }

  return { photos: TV_PHOTOS, teamLabel: teamLabel || 'JROTC Raider Team' };
}
