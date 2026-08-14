import { P, mono, inter, fs, sp } from '../../../admin/theme.js';
import { useTvCarouselPhotos } from '../../../../hooks/useTvCarouselPhotos.js';
import { getTeam } from '../../../../lib/teams.js';
import TvClockBellPanel from '../../TvClockBellPanel.jsx';
import TvWeatherPanel from '../../TvWeatherPanel.jsx';
import TvPhotoCarousel from '../../TvPhotoCarousel.jsx';
import TvBottomWidget from '../../TvBottomWidget.jsx';
import TvShoutoutsPanel from '../../TvShoutoutsPanel.jsx';
import TvRangeRaiderPracticeWidget from '../TvRangeRaiderPracticeWidget.jsx';

function eventDateLabel(event) {
  const d = new Date(`${event.date}T${event.event_time || '00:00:00'}`);
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric',
  }).format(d);
}

function PanelHeading({ children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: sp[4] }}>
      <div style={{ width: 14, height: 2, background: P.gold }} />
      <div style={{ fontFamily: mono, fontSize: fs.micro, color: P.gold, letterSpacing: '0.28em' }}>
        {children}
      </div>
      <div style={{ flex: 1, height: 1, background: P.hair }} />
    </div>
  );
}

function EmptyState({ children }) {
  return (
    <div style={{ fontFamily: inter, fontSize: fs.sm, color: P.faint, fontStyle: 'italic' }}>
      {children}
    </div>
  );
}

function NoticeCard({ notice }) {
  return (
    <div style={{ paddingBottom: sp[4], marginBottom: sp[4], borderBottom: `1px solid ${P.hair}` }}>
      <div style={{ fontFamily: inter, fontSize: fs.base, fontWeight: 700, color: P.cream, marginBottom: sp[1] }}>
        {notice.title}
      </div>
      <div style={{ fontFamily: inter, fontSize: fs.sm, color: P.mute, lineHeight: 1.5 }}>
        {notice.message}
      </div>
    </div>
  );
}

function EventCard({ event }) {
  const teamTag = event.team ? getTeam(event.team)?.label : null;
  return (
    <div style={{ display: 'flex', gap: sp[3], paddingBottom: sp[4], marginBottom: sp[4], borderBottom: `1px solid ${P.hair}` }}>
      <div style={{
        flexShrink: 0, fontFamily: mono, fontSize: fs.xs, color: P.gold, letterSpacing: '0.04em',
        whiteSpace: 'nowrap', paddingTop: 2,
      }}>
        {eventDateLabel(event)}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: inter, fontSize: fs.base, fontWeight: 700, color: P.cream }}>
          {event.title}
        </div>
        {teamTag && <div style={{ fontFamily: inter, fontSize: fs.xs, color: P.mute }}>{teamTag}</div>}
      </div>
    </div>
  );
}

function NoticeColumn({ heading, notices, emptyLabel }) {
  return (
    <>
      <PanelHeading>{heading}</PanelHeading>
      {notices.length ? notices.map((n) => <NoticeCard key={n.id} notice={n} />) : (
        <EmptyState>{emptyLabel}</EmptyState>
      )}
    </>
  );
}

function EventColumn({ events }) {
  return (
    <>
      <PanelHeading>UPCOMING EVENTS</PanelHeading>
      {events.length ? events.map((e) => <EventCard key={e.id} event={e} />) : (
        <EmptyState>Nothing on the calendar right now.</EmptyState>
      )}
    </>
  );
}

function PhotoTile({ settings }) {
  const { photos } = useTvCarouselPhotos(settings);
  return <TvPhotoCarousel photos={photos} />;
}

// Single place every rotation-grid widget kind resolves to real content —
// shared by the live kiosk (TvRangeRotationLayout.jsx) and the admin editor
// (StepRangeLayout.jsx) so the two can never drift apart on what a kind
// renders. `photo` fills its tile edge-to-edge (own scroll/overflow handling
// via TvPhotoCarousel); every other kind gets the standard padded column.
export default function RangeGridWidgetContent({ kind, settings, now, config, announcements, staffNotes, events }) {
  switch (kind) {
    case 'clock':
      return <TvClockBellPanel scheduleKey={settings?.bell_schedule ?? 'normal'} />;
    case 'weather':
      return <TvWeatherPanel />;
    case 'photo':
      return <PhotoTile settings={settings} />;
    case 'announcements':
      return <NoticeColumn heading="ANNOUNCEMENTS" notices={announcements ?? []} emptyLabel="No announcements posted." />;
    case 'staffnotes':
      return <NoticeColumn heading="NOTES FROM STAFF" notices={staffNotes ?? []} emptyLabel="No notes from staff." />;
    case 'events':
      return <EventColumn events={events ?? []} />;
    case 'raider':
      return <TvRangeRaiderPracticeWidget groupmeUrl={config?.groupme_url ?? config?.groupmeUrl} />;
    case 'bottomWidget':
      return <TvBottomWidget settings={settings} now={now} />;
    case 'shoutouts':
      return <TvShoutoutsPanel settings={settings} />;
    default:
      return null;
  }
}
