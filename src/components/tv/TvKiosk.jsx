import { useState, useCallback } from 'react';
import { P, inter, sp, radius, shadow } from '../admin/theme.js';
import { useLocalStorage } from '../../hooks/useLocalStorage.js';
import { useNowTicker } from '../../hooks/useNowTicker.js';
import { useTvDailySettings } from '../../hooks/useTvDailySettings.js';
import { useTvCarouselPhotos } from '../../hooks/useTvCarouselPhotos.js';
import TvPhotoCarousel from './TvPhotoCarousel.jsx';
import TvWeatherPanel from './TvWeatherPanel.jsx';
import TvClockBellPanel from './TvClockBellPanel.jsx';
import TvBottomWidget from './TvBottomWidget.jsx';
import TvControlCenter from './control-center/TvControlCenter.jsx';
import TvTopStrip from './TvTopStrip.jsx';
import TvEmergencyOverlay from './TvEmergencyOverlay.jsx';

const LS_KEY = 'tb_tv_schedule_choice';
const NY_TZ = 'America/New_York';

function todayNyDate(now) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: NY_TZ }).format(now); // YYYY-MM-DD
}

// Each widget gets its own raised card — real depth (shadow + hairline
// border), not a hairline-divided list. Cards breathe with a gap instead of
// touching, so the eye reads three separate instruments, not one stacked form.
function Card({ children }) {
  return (
    <div style={{
      flex: 1, minHeight: 0, padding: `${sp[6]}px ${sp[6]}px`,
      display: 'flex', flexDirection: 'column',
      background: P.navy, border: `1px solid ${P.hair}`,
      borderRadius: radius.lg, boxShadow: shadow.md,
    }}>
      {children}
    </div>
  );
}

export default function TvKiosk() {
  const now = useNowTicker();
  const [stored, setStored] = useLocalStorage(LS_KEY, null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const { settings } = useTvDailySettings();
  const { photos: sourcedPhotos } = useTvCarouselPhotos(settings);

  // Push-to-TV spotlight overrides the normal carousel with a single photo,
  // full-bleed. Reuses TvPhotoCarousel as-is — it already renders a static
  // (non-autoplaying) single slide when given a 1-photo array, no separate
  // component needed. Picked up off the same realtime channel useTvDailySettings
  // already has open, so it appears with no kiosk reload.
  const spotlightActive = !!settings?.spotlight_active && !!settings?.spotlight_photo_url;
  const photos = spotlightActive
    ? [{ src: settings.spotlight_photo_url, alt: 'Spotlight photo', title: 'Live Spotlight' }]
    : sourcedPhotos;
  const photoSourceKey = spotlightActive ? `spotlight:${settings.spotlight_photo_url}` : [
    settings?.photo_source_mode ?? 'team',
    settings?.photo_source_event_id ?? '',
    (settings?.uploaded_photo_urls ?? []).length,
    (settings?.featured_teams ?? []).slice().sort().join('+'),
  ].join(':');

  const today = todayNyDate(now);
  const needsSetup = !stored || stored.date !== today;
  const scheduleKey = needsSetup ? null : stored.schedule;

  const handleChoose = useCallback((key) => {
    setStored({ schedule: key, date: todayNyDate(new Date()) });
  }, [setStored]);

  const overlayOpen = pickerOpen || needsSetup;
  const emergencyActive = !!settings?.emergency_active;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: P.ink,
      display: 'flex', flexDirection: 'column', fontFamily: inter,
    }}>
      <TvTopStrip scheduleKey={scheduleKey} now={now} />

      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '68% 32%' }}>
        <div style={{ height: '100%', width: '100%' }}>
          {/* Replaces only the carousel — not Weather or Clock/Bell, which
              stay mounted and visible in the right column as normal (see
              TvEmergencyOverlay for why: revised off the original
              full-takeover recommendation). */}
          {emergencyActive ? (
            <TvEmergencyOverlay
              text={settings.emergency_text}
              header={settings.emergency_header}
              photoUrl={settings.emergency_photo_url}
              textSize={settings.emergency_text_size}
            />
          ) : (
            <TvPhotoCarousel key={photoSourceKey} photos={photos} />
          )}
        </div>

        <div style={{
          height: '100%', display: 'flex', flexDirection: 'column', gap: sp[4],
          borderLeft: `1px solid ${P.hair}`, background: P.deep, padding: sp[5],
        }}>
          <Card><TvWeatherPanel /></Card>
          <Card><TvClockBellPanel scheduleKey={scheduleKey} /></Card>
          {/* Bottom quote/facts widget is the other thing the emergency
              message replaces — omitted entirely rather than shown empty;
              the two Cards above flex to fill the freed height (each is
              flex:1 in this flex-column already). */}
          {!emergencyActive && <Card><TvBottomWidget settings={settings} now={now} /></Card>}
        </div>
      </div>

      <TvControlCenter
        open={overlayOpen}
        needsSetup={needsSetup}
        scheduleChoice={needsSetup ? null : scheduleKey}
        onOpen={() => setPickerOpen(true)}
        onClose={() => setPickerOpen(false)}
        onChooseSchedule={handleChoose}
        settings={settings}
      />
    </div>
  );
}
