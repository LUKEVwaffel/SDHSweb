import { P, inter, sp } from '../admin/theme.js';
import { useNowTicker } from '../../hooks/useNowTicker.js';
import { useTvDailySettings } from '../../hooks/useTvDailySettings.js';
import { useTvCarouselPhotos } from '../../hooks/useTvCarouselPhotos.js';
import TvPhotoCarousel from './TvPhotoCarousel.jsx';
import TvWeatherPanel from './TvWeatherPanel.jsx';
import TvClockBellPanel from './TvClockBellPanel.jsx';
import TvBottomWidget from './TvBottomWidget.jsx';
import TvTopStrip from './TvTopStrip.jsx';
import TvCountdownBand from './TvCountdownBand.jsx';
import TvShoutoutsPanel from './TvShoutoutsPanel.jsx';
import TvEmergencyOverlay from './TvEmergencyOverlay.jsx';
import InstrumentDivider from './TvInstrumentDivider.jsx';

// Below this, the Facts/Quote/Verse widget's kicker + drop-cap treatment
// stops being readable — the column scrolls rather than compress past it.
const FACTS_MIN_HEIGHT = 260;

// Deliberately NOT three identical boxed cards — that reads as one generic
// "sidebar of widgets" template no matter how nice the type inside each box
// is. Instead the right column is one continuous instrument panel (shared
// background, no per-widget border/shadow/radius) divided by hairline rules,
// departure-board style. Each widget owns a mono-gold kicker + tick-mark rule
// as its only visual identity marker (see TvHistoryPanel's "ON THIS DAY" —
// that pattern is now the shared grammar for all three, not one panel's
// personal touch). Sizing is asymmetric on purpose: Clock is the hero
// (glanceable from across a hallway), Weather is a compact secondary strip,
// Facts gets whatever's left so its drop-cap/ghost-year treatment has room.
// (InstrumentDivider itself now lives in TvInstrumentDivider.jsx, shared with
// TvShoutoutsPanel.jsx, which needs to own its own divider to omit both
// together when it has nothing to show.)

export default function TvKiosk() {
  const now = useNowTicker();
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

  const scheduleKey = settings?.bell_schedule ?? null;
  const emergencyActive = !!settings?.emergency_active;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: P.ink,
      display: 'flex', flexDirection: 'column', fontFamily: inter,
    }}>
      <TvTopStrip scheduleKey={scheduleKey} now={now} />
      <TvCountdownBand settings={settings} now={now} />

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
          height: '100%', display: 'flex', flexDirection: 'column',
          borderLeft: `1px solid ${P.hair}`,
          background: `linear-gradient(180deg, ${P.deep} 0%, #0D1C33 100%)`,
          overflowY: 'auto',
        }}>
          {/* Clock is the hero — largest, most glanceable instrument. Clock
              and Weather are both content-sized (not a fixed % of the
              column) because their content varies day to day — a 3-lunch
              schedule or a longer forecast string would overflow a fixed
              box and bleed into the next widget (this bit both, verified via
              screenshot before landing — see git history). Facts gets a
              minHeight floor (FACTS_MIN_HEIGHT) rather than a bare flex: 1,
              so a generous Clock/Weather day can't squeeze it down to an
              unreadable sliver — the outer column scrolls if that floor
              can't be met instead of everything silently overlapping. When
              the Facts widget is hidden (emergency mode), Clock grows to
              absorb the freed space instead of leaving dead air below it. */}
          <div style={{ flex: emergencyActive ? '1 1 auto' : '0 0 auto', padding: `${sp[4]}px ${sp[5]}px ${sp[3]}px` }}>
            <TvClockBellPanel scheduleKey={scheduleKey} />
          </div>

          <InstrumentDivider />

          <div style={{ flex: '0 0 auto', padding: `${sp[3]}px ${sp[5]}px` }}>
            <TvWeatherPanel />
          </div>

          {/* Shoutouts and the bottom quote/facts widget are the other things
              the emergency message replaces. Shoutouts owns its own
              divider+padding (see TvShoutoutsPanel.jsx) so it can omit
              itself, divider included, when neither a birthday nor a manual
              entry is live today — an empty padded gap between two
              dividers would read as a layout bug otherwise. */}
          {!emergencyActive && (
            <>
              <TvShoutoutsPanel settings={settings} />

              <InstrumentDivider />
              <div style={{ flex: '1 1 auto', minHeight: FACTS_MIN_HEIGHT, padding: `${sp[4]}px ${sp[5]}px ${sp[6]}px` }}>
                <TvBottomWidget settings={settings} now={now} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
