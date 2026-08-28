import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useTvDailySettings, updateTvDailySettings } from '../../../../hooks/useTvDailySettings.js';
import { useNowTicker } from '../../../../hooks/useNowTicker.js';
import { BELL_SCHEDULES, resolveBellSchedule, weekdayBellSchedule } from '../../../../lib/bellSchedules.js';
import { getRangePhase } from '../../../../lib/tvRangeSchedule.js';
import StepFeaturedTeams from '../../../tv/control-center/StepFeaturedTeams.jsx';
import StepPhotoSource from '../../../tv/control-center/StepPhotoSource.jsx';
import StepWidgetMode from '../../../tv/control-center/StepWidgetMode.jsx';
import StepShoutout from '../../../tv/control-center/StepShoutout.jsx';
import StepRangeSchedule from '../../../tv/control-center/StepRangeSchedule.jsx';
import StepRangeNotices from '../../../tv/control-center/StepRangeNotices.jsx';
import StepRangeSlideshow from '../../../tv/control-center/StepRangeSlideshow.jsx';
import EmergencyPushPanel from '../tvphotos/EmergencyPushPanel.jsx';
import { P, mono, oswald, inter, fs, sp, radius, ease } from '../../theme.js';
import { Btn, PanelHeader } from '../../shared/ui.jsx';
import { useTvRemoteOnboarding } from '../../../../hooks/useTvRemoteOnboarding.js';
import TabIntro from './TabIntro.jsx';
import TvRemoteWalkthrough from './TvRemoteWalkthrough.jsx';
import TvRemoteUpdateModal from './TvRemoteUpdateModal.jsx';
import TvRemoteGuide from './TvRemoteGuide.jsx';
import { TAB_INTRO } from './tvRemoteHelpContent.js';

// Hardcoded, not read from tv_screens — Staff Room 2 has a reserved slug in
// the registry (see supabase/tv_screens.sql) but no working kiosk yet, so it
// deliberately doesn't appear here until it's actually built out.
const SCREENS = [
  { slug: 'default', label: 'Outside', sub: 'Main JROTC entrance', path: '/tv' },
  { slug: 'range', label: 'Range', sub: 'Range room · period program', path: '/tv/range' },
];

const BASE_TABS = [
  { id: 'emergency', label: 'Emergency Push', danger: true, group: 'URGENT' },
  { id: 'schedule', label: 'Bell Schedule', group: 'EVERYDAY' },
  { id: 'teams', label: 'Featured Team', group: 'EVERYDAY' },
  { id: 'photos', label: 'Photo Source', group: 'EVERYDAY' },
  { id: 'widget', label: 'Bottom Widget', group: 'EVERYDAY' },
  { id: 'shoutout', label: 'Shoutout', group: 'EVERYDAY' },
];
const RANGE_TAB = { id: 'rangeSchedule', label: 'Schedule Editor', group: 'RANGE ROOM' };
const RANGE_LAYOUT_TAB = { id: 'rangeLayout', label: 'Rotation Screen', group: 'RANGE ROOM' };
const RANGE_NOTICE_TABS = [
  { id: 'announcements', label: 'Announcements', group: 'RANGE ROOM' },
  { id: 'staffNotes', label: 'Staff Notes', group: 'RANGE ROOM' },
];

// Matches the seed values in supabase/tv_screens.sql — used as a fallback so
// the Schedule Editor still has sane defaults before that migration has run,
// or if the 'range' row's range_schedule_config is null for any reason.
const DEFAULT_RANGE_CONFIG = {
  periodCompany: { '2': 'Alpha', '3': 'Staff/Command', '4': 'Bravo', '5': 'Charlie', '6': 'Delta' },
  welcomeWindowMinutes: 20,
  planningMessage: 'Enjoy your Planning period',
  t2Message: "It's T2 time",
  lunch1WelcomeMessage: 'Welcome First Lunch',
  lunch1ReminderText: "This is a privilege to sit in here and eat lunch, don't abuse it. All cadets wanting to eat lunch should come within the first 10 minutes of the lunch and cannot leave after that before the ending of the lunch.",
  companyWelcomeTemplate: 'Welcome {company} Company',
  attendanceReminderTemplate: '1SGT: Take attendance now',
  customBlocks: [],
  groupmeUrl: '',
  slideshowSlides: [],
};

const WIDGET_MODE_LABELS = {
  facts: 'Historical Facts', quote: 'Quote of the Day', verse: 'Bible Verse', custom: 'Custom Message',
};

// Human label for whatever getRangePhase() says is airing right now — reads
// the LIVE settings row (not the admin's in-progress draft), so this always
// matches what the physical Range TV is actually showing, independent of
// whatever an admin has mid-edited but not yet saved.
function rangePhaseLabel(result) {
  switch (result.phase) {
    case 'off-hours':
      return result.stage === 'before' ? 'Before school' : result.stage === 'after' ? 'After school' : 'Off hours';
    case 'planning': return 'Planning Period (1st)';
    case 't2': return 'T2 Block';
    case 'staff-schedule': return 'Staff Schedule (3rd)';
    case 'lunch1': return '1st Lunch';
    case 'company-welcome': return `Welcome — ${result.company ?? '—'}`;
    case 'period-ending': return `Period ending — ${result.company ?? result.periodName ?? ''}`;
    case 'rotation':
    default:
      return 'Rotation Screen';
  }
}

function rangeConfigFromRow(raw) {
  return {
    periodCompany: raw?.period_company ?? DEFAULT_RANGE_CONFIG.periodCompany,
    welcomeWindowMinutes: raw?.welcome_window_minutes ?? DEFAULT_RANGE_CONFIG.welcomeWindowMinutes,
    planningMessage: raw?.planning_message ?? DEFAULT_RANGE_CONFIG.planningMessage,
    t2Message: raw?.t2_message ?? DEFAULT_RANGE_CONFIG.t2Message,
    lunch1WelcomeMessage: raw?.lunch1_welcome_message ?? DEFAULT_RANGE_CONFIG.lunch1WelcomeMessage,
    lunch1ReminderText: raw?.lunch1_reminder_text ?? DEFAULT_RANGE_CONFIG.lunch1ReminderText,
    companyWelcomeTemplate: raw?.company_welcome_template ?? DEFAULT_RANGE_CONFIG.companyWelcomeTemplate,
    attendanceReminderTemplate: raw?.attendance_reminder_template ?? DEFAULT_RANGE_CONFIG.attendanceReminderTemplate,
    customBlocks: raw?.custom_blocks ?? DEFAULT_RANGE_CONFIG.customBlocks,
    groupmeUrl: raw?.groupme_url ?? DEFAULT_RANGE_CONFIG.groupmeUrl,
    slideshowSlides: raw?.slideshow_slides ?? DEFAULT_RANGE_CONFIG.slideshowSlides,
  };
}

function draftFromSettings(settings) {
  return {
    bellSchedule: settings?.bell_schedule ?? 'normal',
    bellScheduleMode: settings?.bell_schedule_mode ?? 'auto',
    featuredTeams: settings?.featured_teams?.length ? settings.featured_teams : ['raiders'],
    photoSourceMode: settings?.photo_source_mode ?? 'team',
    photoSourceEventId: settings?.photo_source_event_id ?? null,
    uploadedUrls: settings?.uploaded_photo_urls ?? [],
    widgetMode: settings?.bottom_widget_mode ?? 'facts',
    customMessage: settings?.custom_message ?? '',
    customSignoff: settings?.custom_signoff ?? '',
    selectedQuoteIds: settings?.selected_quote_ids ?? [],
    selectedVerseIds: settings?.selected_verse_ids ?? [],
    shoutoutName: settings?.shoutout_manual_name ?? '',
    shoutoutTag: settings?.shoutout_manual_tag ?? '',
    shoutoutNote: settings?.shoutout_manual_note ?? '',
    rangeConfig: rangeConfigFromRow(settings?.range_schedule_config),
  };
}

// Every physical /tv kiosk is a pure display now — no on-site gear icon, no
// walking up to a screen to change anything. This is the one place that
// controls all of them: writes land in tv_daily_settings (one row per
// screen — see tv_screens.sql — each broadcast over realtime to every kiosk
// watching that screen), so a save here shows up live, no reload. The screen
// selector below switches which screen's row this panel is reading/writing;
// Range additionally gets a Schedule Editor tab since it's the one screen
// with a period-based content engine (src/lib/tvRangeSchedule.js) instead of
// a flat all-day rotation.
const LAST_SCREEN_KEY = 'tvRemote.lastScreen';

export default function TvRemotePanel({ adminId, role } = {}) {
  const rootRef = useRef(null);
  const [guideOpen, setGuideOpen] = useState(false);
  // Onboarding + "what's new" is BC-scoped — Luke (s6) already knows this
  // panel and shouldn't get the tour. Passing null email makes the hook inert.
  const onb = useTvRemoteOnboarding(role === 'bc' ? (adminId ?? null) : null);
  // Remembers the last screen tab across remounts (switching admin sections
  // and coming back to TV Remote) so a mid-edit visit to another panel
  // doesn't dump the admin back on Outside/Bell Schedule.
  const [selectedScreen, setSelectedScreen] = useState(
    () => (SCREENS.some((s) => s.slug === sessionStorage.getItem(LAST_SCREEN_KEY)) && sessionStorage.getItem(LAST_SCREEN_KEY)) || 'default'
  );
  const { settings, loading } = useTvDailySettings(selectedScreen);
  const [activeTab, setActiveTab] = useState('schedule');
  const [draft, setDraft] = useState(() => draftFromSettings(null));
  const [hydratedFor, setHydratedFor] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [flash, setFlash] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [previewDatetime, setPreviewDatetime] = useState('');
  const [liveViewOpen, setLiveViewOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const now = useNowTicker();

  // Baseline snapshot to diff the draft against for an "unsaved changes"
  // indicator — captured once at hydration (and again right after a
  // successful save), NOT re-derived from `settings` on every realtime tick.
  // If it tracked live `settings` directly, another admin's save on the same
  // screen would make this admin's OWN untouched draft look "dirty" the
  // instant that update arrived, which is misleading — this only answers
  // "have I personally changed anything since I loaded/last saved."
  const savedSnapshotRef = useRef(draftFromSettings(null));

  // Hydrate once per screen, from that screen's first settings load — not on
  // every realtime tick, so someone editing here doesn't get their
  // in-progress draft clobbered by another admin's save landing mid-edit.
  // Re-keyed on selectedScreen so switching screens re-hydrates instead of
  // carrying the previous screen's draft over.
  useEffect(() => {
    if (!settings || hydratedFor === selectedScreen) return;
    const fresh = draftFromSettings(settings);
    setDraft(fresh);
    savedSnapshotRef.current = fresh;
    setHydratedFor(selectedScreen);
  }, [settings, selectedScreen, hydratedFor]);

  const isDirty = hydratedFor === selectedScreen
    && JSON.stringify(draft) !== JSON.stringify(savedSnapshotRef.current);

  // Warn before an accidental tab close/refresh throws away in-progress
  // edits nobody's pushed to the screen yet.
  useEffect(() => {
    if (!isDirty) return undefined;
    const onBeforeUnload = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty]);

  // What's actually airing on the live Range kiosk right now, read straight
  // off the live `settings` row (never the draft) — this is what makes the
  // live-status readout trustworthy even while an admin has unsaved edits
  // open in another tab.
  const liveRangePhase = useMemo(() => {
    if (selectedScreen !== 'range' || !settings) return null;
    return getRangePhase(resolveBellSchedule(settings, now), now, settings.range_schedule_config ?? null);
  }, [selectedScreen, settings, now]);

  useEffect(() => {
    // Compares against rootRef, not just truthiness — this panel isn't the
    // only thing in DISPATCH that could go fullscreen, and we only want our
    // own button/state reflecting OUR element's fullscreen state.
    const onFsChange = () => setIsFullscreen(document.fullscreenElement === rootRef.current);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const patch = useCallback((p) => setDraft((d) => ({ ...d, ...p })), []);
  const patchRange = useCallback((p) => setDraft((d) => ({ ...d, rangeConfig: { ...d.rangeConfig, ...p } })), []);

  function selectScreen(slug) {
    if (slug === selectedScreen) return;
    if (isDirty) {
      const current = SCREENS.find((s) => s.slug === selectedScreen)?.label ?? 'this screen';
      const discard = window.confirm(`You have unsaved changes for ${current}. Switch screens and discard them?`);
      if (!discard) return;
    }
    setSelectedScreen(slug);
    sessionStorage.setItem(LAST_SCREEN_KEY, slug);
    setActiveTab('schedule');
    setSaveError(null);
  }

  // Fullscreens THIS panel's own element, not document.documentElement — the
  // browser only ever paints that element's subtree while fullscreen is
  // active, so DISPATCH's sidebar/nav/branding around it is stripped
  // automatically rather than just visually hidden. Matters here specifically
  // because this runs on the same machine driving the physical Range TV,
  // alongside the /tv kiosk tab — the person managing it needs just the
  // remote, not the rest of DISPATCH's chrome.
  async function toggleFullscreen() {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await rootRef.current?.requestFullscreen();
    }
  }

  // Opens the selected screen in a new tab with ?previewAt=<ISO> — read by
  // useNowTicker.js in that tab only, so time-driven phases (bell schedule,
  // welcome windows, lunch states, period-ending warnings) render as they
  // would at that instant without waiting for the real clock. Purely
  // client-side: no write to tv_daily_settings, so it never touches what the
  // real wall-mounted kiosk is showing.
  function openPreview() {
    if (!previewDatetime) return;
    const iso = new Date(previewDatetime).toISOString();
    const path = SCREENS.find((s) => s.slug === selectedScreen)?.path ?? '/tv';
    const url = `${window.location.origin}${path}?previewAt=${encodeURIComponent(iso)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  async function save() {
    setSaving(true);
    setSaveError(null);
    const basePatch = {
      bell_schedule: draft.bellSchedule,
      bell_schedule_mode: draft.bellScheduleMode,
      featured_teams: draft.featuredTeams,
      photo_source_mode: draft.photoSourceMode,
      photo_source_event_id: draft.photoSourceMode === 'event' ? draft.photoSourceEventId : null,
      uploaded_photo_urls: draft.uploadedUrls,
      bottom_widget_mode: draft.widgetMode,
      custom_message: draft.customMessage || null,
      custom_signoff: draft.customSignoff || null,
      selected_quote_ids: draft.selectedQuoteIds,
      selected_verse_ids: draft.selectedVerseIds,
      shoutout_manual_name: draft.shoutoutName || null,
      shoutout_manual_tag: draft.shoutoutTag || null,
      shoutout_manual_note: draft.shoutoutNote || null,
    };
    const rangePatch = selectedScreen === 'range' ? {
      range_schedule_config: {
        period_company: draft.rangeConfig.periodCompany,
        welcome_window_minutes: draft.rangeConfig.welcomeWindowMinutes,
        planning_message: draft.rangeConfig.planningMessage || null,
        t2_message: draft.rangeConfig.t2Message || null,
        lunch1_welcome_message: draft.rangeConfig.lunch1WelcomeMessage || null,
        lunch1_reminder_text: draft.rangeConfig.lunch1ReminderText || null,
        company_welcome_template: draft.rangeConfig.companyWelcomeTemplate || null,
        attendance_reminder_template: draft.rangeConfig.attendanceReminderTemplate || null,
        custom_blocks: draft.rangeConfig.customBlocks,
        groupme_url: draft.rangeConfig.groupmeUrl || null,
        slideshow_slides: draft.rangeConfig.slideshowSlides,
      },
    } : {};

    const { error } = await updateTvDailySettings({ ...basePatch, ...rangePatch }, selectedScreen);
    setSaving(false);

    if (error) {
      setSaveError(error.message || 'Something went wrong saving your changes.');
      return;
    }
    savedSnapshotRef.current = draft;
    setFlash(`Pushed to ${SCREENS.find((s) => s.slug === selectedScreen)?.label ?? 'screen'} ✓`);
    setTimeout(() => setFlash(''), 2500);
  }

  const tabs = selectedScreen === 'range' ? [...BASE_TABS, RANGE_TAB, RANGE_LAYOUT_TAB, ...RANGE_NOTICE_TABS] : BASE_TABS;

  if (loading && hydratedFor !== selectedScreen) {
    return <div style={{ fontFamily: mono, fontSize: fs.xs, color: P.mute }}>LOADING…</div>;
  }

  return (
    <div
      ref={rootRef}
      style={isFullscreen ? {
        background: P.ink, minHeight: '100vh', width: '100%',
        display: 'flex', justifyContent: 'center', overflowY: 'auto',
        padding: sp[10], boxSizing: 'border-box',
      } : { maxWidth: 940 }}
    >
      <div style={{ width: '100%', maxWidth: 940 }}>
      <PanelHeader
        title="TV REMOTE"
        sub="Controls the selected screen's kiosk(s) live, no reload needed. Nothing changes until you press Save."
        action={(
          <div style={{ display: 'flex', gap: sp[2] }}>
            <Btn onClick={() => setGuideOpen(true)} variant="ghost" size="sm">? GUIDE</Btn>
            <Btn onClick={toggleFullscreen} variant="ghost" size="sm">
              {isFullscreen ? 'EXIT FULLSCREEN' : 'FULLSCREEN'}
            </Btn>
          </div>
        )}
      />

      {onb.needsWalkthrough && (
        <TvRemoteWalkthrough onDone={onb.completeWalkthrough} />
      )}
      {!onb.needsWalkthrough && onb.needsUpdate && (
        <TvRemoteUpdateModal sinceVersion={onb.lastSeenVersion} onAck={onb.acknowledgeUpdates} />
      )}
      <TvRemoteGuide
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        onReplayTour={role === 'bc' ? onb.replayWalkthrough : undefined}
      />

      <div style={{ marginBottom: sp[6] }}>
        <div style={{
          fontFamily: mono, fontSize: 9, color: P.faint, letterSpacing: '0.24em', marginBottom: sp[3],
        }}>
          WHICH SCREEN ARE YOU EDITING?
        </div>
        <div style={{ display: 'flex', gap: sp[3] }}>
          {SCREENS.map((s) => {
            const on = selectedScreen === s.slug;
            return (
              <button
                key={s.slug}
                onClick={() => selectScreen(s.slug)}
                style={{
                  flex: 1, textAlign: 'left', padding: `${sp[3]}px ${sp[4]}px`, borderRadius: radius.md,
                  border: `1px solid ${on ? P.gold : P.hair}`,
                  background: on ? P.goldWash : 'transparent',
                  cursor: 'pointer', transition: `all 150ms ${ease}`,
                }}
              >
                <div style={{
                  fontFamily: oswald, fontSize: fs.md, fontWeight: 600,
                  color: on ? P.bright : P.mute, letterSpacing: '0.04em',
                }}>
                  {s.label.toUpperCase()}
                </div>
                <div style={{ fontFamily: inter, fontSize: fs.xs, color: on ? P.mute : P.faint, marginTop: 2 }}>
                  {s.sub}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Live status — reads the LIVE settings row (never the draft), so this
          answers "what is the physical TV actually showing right now" even
          while an admin has unsaved edits open in another tab. The embedded
          view below (collapsed by default) is the real /tv route rendering
          for real, not a re-derived approximation — it can never drift out
          of sync with the kiosk the way a hand-rolled summary could. */}
      <div style={{
        marginBottom: sp[6], borderRadius: radius.md, border: `1px solid ${P.hairStrong}`,
        background: 'rgba(39,174,96,0.05)', overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: sp[3], padding: sp[4], flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: sp[3], minWidth: 0 }}>
            <span style={{
              flexShrink: 0, width: 9, height: 9, borderRadius: '50%', background: P.green,
              boxShadow: '0 0 0 4px rgba(39,174,96,0.18)',
            }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: mono, fontSize: fs.micro, color: P.green, letterSpacing: '0.2em' }}>
                LIVE NOW — {SCREENS.find((s) => s.slug === selectedScreen)?.label.toUpperCase()}
              </div>
              <div style={{ fontFamily: inter, fontSize: 15, fontWeight: 700, color: P.cream, marginTop: 3 }}>
                {!settings ? 'Loading…' : selectedScreen === 'range' && liveRangePhase
                  ? rangePhaseLabel(liveRangePhase)
                  : selectedScreen === 'default'
                    ? `${BELL_SCHEDULES[resolveBellSchedule(settings, now)]?.label ?? 'Normal'} schedule — ${WIDGET_MODE_LABELS[settings.bottom_widget_mode] ?? 'Historical Facts'}`
                    : '—'}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: sp[2], flexShrink: 0 }}>
            <a
              href={SCREENS.find((s) => s.slug === selectedScreen)?.path ?? '/tv'}
              target="_blank" rel="noopener noreferrer"
              style={{
                padding: `${sp[2]}px ${sp[4]}px`, borderRadius: radius.sm,
                border: `1px solid ${P.hairStrong}`, color: P.mute, textDecoration: 'none',
                fontFamily: mono, fontSize: fs.micro, letterSpacing: '0.1em',
              }}
            >
              OPEN LIVE ↗
            </a>
            <Btn onClick={() => setLiveViewOpen((v) => !v)} variant="ghost" size="sm">
              {liveViewOpen ? 'HIDE LIVE VIEW' : 'SHOW LIVE VIEW'}
            </Btn>
          </div>
        </div>

        {liveViewOpen && (
          <div style={{ borderTop: `1px solid ${P.hair}`, padding: sp[4] }}>
            <div style={{
              width: '100%', maxWidth: 640, aspectRatio: '16 / 9', borderRadius: radius.sm,
              border: `1px solid ${P.hair}`, overflow: 'hidden', background: P.ink, position: 'relative',
            }}>
              <div style={{ width: 1920, height: 1080, transform: 'scale(0.3333)', transformOrigin: 'top left', position: 'absolute' }}>
                <iframe
                  key={selectedScreen}
                  src={SCREENS.find((s) => s.slug === selectedScreen)?.path ?? '/tv'}
                  title={`Live ${selectedScreen} kiosk`}
                  style={{ width: 1920, height: 1080, border: 'none', pointerEvents: 'none' }}
                />
              </div>
            </div>
            <div style={{ fontFamily: inter, fontSize: 12, color: P.faint, marginTop: sp[2] }}>
              This is the actual live kiosk page, rendering for real — not a simulation.
            </div>
          </div>
        )}
      </div>

      {/* Preview/test mode — collapsed by default (a test-mode tool used far
          less often than the tabs below it; leaving it expanded just pushed
          the actual controls further down every time this panel opened).
          Punch in any date/time and see exactly what the selected screen
          would show at that moment, without waiting for the real clock to
          reach it. See openPreview()/useNowTicker.js for how the override
          works and why it's safe (browser-local, opt-in query param, real
          kiosks never load it). */}
      <div style={{
        marginBottom: sp[6], borderRadius: radius.md, border: `1px solid ${P.hair}`,
        background: 'rgba(201,169,97,0.03)', overflow: 'hidden',
      }}>
        <button
          onClick={() => setPreviewOpen((v) => !v)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: sp[4], background: 'transparent', border: 'none', cursor: 'pointer',
            fontFamily: mono, fontSize: fs.micro, color: P.gold, letterSpacing: '0.2em',
          }}
        >
          <span>TEST A DATE/TIME — {SCREENS.find((s) => s.slug === selectedScreen)?.label.toUpperCase()}</span>
          <span style={{ color: P.faint }}>{previewOpen ? '▲' : '▼'}</span>
        </button>
        {previewOpen && (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: sp[4], padding: `0 ${sp[4]}px ${sp[4]}px` }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: inter, fontSize: 13, color: P.mute, marginBottom: sp[3], lineHeight: 1.5 }}>
                Opens this screen in a new tab as of the date/time below — ticks forward in real time from there. Doesn't touch the live kiosk.
              </div>
              <input
                type="datetime-local"
                value={previewDatetime}
                onChange={(e) => setPreviewDatetime(e.target.value)}
                style={{
                  padding: sp[3], borderRadius: radius.sm, border: `1px solid ${P.hair}`,
                  background: P.deep, color: P.cream, fontFamily: inter, fontSize: 14,
                }}
              />
            </div>
            <Btn onClick={openPreview} variant="ghost" size="sm" disabled={!previewDatetime}>
              OPEN PREVIEW ↗
            </Btn>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: sp[6] }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: sp[1], width: 208, flexShrink: 0 }}>
          {tabs.map((t, idx) => {
            const on = activeTab === t.id;
            const showGroup = idx === 0 || tabs[idx - 1].group !== t.group;
            return (
              <div key={t.id}>
                {showGroup && (
                  <div style={{
                    fontFamily: mono, fontSize: 9, color: P.faint, letterSpacing: '0.22em',
                    margin: `${idx === 0 ? 0 : sp[4]}px 0 ${sp[2]}px ${sp[3]}px`,
                  }}>
                    {t.group}
                  </div>
                )}
                <button
                  onClick={() => setActiveTab(t.id)}
                  style={{
                    width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: sp[3],
                    padding: `${sp[3]}px ${sp[3]}px`, borderRadius: radius.sm,
                    borderLeft: `3px solid ${on ? (t.danger ? P.red : P.gold) : 'transparent'}`,
                    borderTop: 'none', borderRight: 'none', borderBottom: 'none',
                    background: on ? (t.danger ? 'rgba(192,57,43,0.14)' : P.goldWash) : 'transparent',
                    color: on ? (t.danger ? P.red : P.bright) : (t.danger ? P.red : P.mute),
                    fontFamily: inter, fontSize: fs.base, fontWeight: on ? 700 : 400,
                    cursor: 'pointer', transition: `all 150ms ${ease}`,
                  }}
                >
                  <span style={{ fontSize: 15, width: 20, flexShrink: 0 }} aria-hidden>
                    {TAB_INTRO[t.id]?.icon}
                  </span>
                  {t.label}
                </button>
              </div>
            );
          })}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <TabIntro id={activeTab} />

          {activeTab === 'emergency' && (
            <EmergencyPushPanel screenSlug={selectedScreen} settings={settings} />
          )}

          {activeTab === 'schedule' && (
            <div>
              <div style={{ fontFamily: mono, fontSize: 10, color: P.gold, letterSpacing: '0.24em', marginBottom: sp[2] }}>
                BELL SCHEDULE
              </div>
              <div style={{ fontFamily: inter, fontSize: 13, color: P.mute, marginBottom: sp[5], lineHeight: 1.5 }}>
                Auto follows the weekly rotation — Mon/Wed/Fri Normal, Tue/Thu T2 —
                with no admin action needed. Switch to Manual only for exception
                days (holiday, pep rally, snow day); remember to switch back to
                Auto once the exception day is over.
              </div>
              <div style={{ display: 'flex', gap: sp[3], marginBottom: sp[4] }}>
                <button
                  onClick={() => patch({ bellScheduleMode: 'auto' })}
                  style={{
                    flex: 1, padding: '16px 12px', borderRadius: radius.md,
                    border: `1px solid ${draft.bellScheduleMode === 'auto' ? P.gold : P.hair}`,
                    background: draft.bellScheduleMode === 'auto' ? P.goldWash : 'transparent',
                    color: draft.bellScheduleMode === 'auto' ? P.bright : P.mute,
                    fontFamily: oswald, fontSize: 17, cursor: 'pointer',
                    transition: `all 150ms ${ease}`,
                  }}
                >
                  AUTO — {BELL_SCHEDULES[weekdayBellSchedule(now)]?.label ?? 'Normal'} today
                </button>
                <button
                  onClick={() => patch({ bellScheduleMode: 'manual' })}
                  style={{
                    flex: 1, padding: '16px 12px', borderRadius: radius.md,
                    border: `1px solid ${draft.bellScheduleMode === 'manual' ? P.gold : P.hair}`,
                    background: draft.bellScheduleMode === 'manual' ? P.goldWash : 'transparent',
                    color: draft.bellScheduleMode === 'manual' ? P.bright : P.mute,
                    fontFamily: oswald, fontSize: 17, cursor: 'pointer',
                    transition: `all 150ms ${ease}`,
                  }}
                >
                  MANUAL OVERRIDE
                </button>
              </div>
              {draft.bellScheduleMode === 'manual' && (
                <div style={{ display: 'flex', gap: sp[3] }}>
                  {Object.entries(BELL_SCHEDULES).map(([key, schedule]) => (
                    <button
                      key={key}
                      onClick={() => patch({ bellSchedule: key })}
                      style={{
                        flex: 1, padding: '16px 12px', borderRadius: radius.md,
                        border: `1px solid ${draft.bellSchedule === key ? P.gold : P.hair}`,
                        background: draft.bellSchedule === key ? P.goldWash : 'transparent',
                        color: draft.bellSchedule === key ? P.bright : P.mute,
                        fontFamily: oswald, fontSize: 17, cursor: 'pointer',
                        transition: `all 150ms ${ease}`,
                      }}
                    >
                      {schedule.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'teams' && (
            <StepFeaturedTeams
              selected={draft.featuredTeams}
              onChange={(featuredTeams) => patch({ featuredTeams })}
            />
          )}

          {activeTab === 'photos' && (
            <StepPhotoSource
              featuredTeams={draft.featuredTeams}
              mode={draft.photoSourceMode}
              eventId={draft.photoSourceEventId}
              uploadedUrls={draft.uploadedUrls}
              onChange={({ mode, eventId, uploadedUrls }) => patch({
                ...(mode !== undefined && { photoSourceMode: mode }),
                ...(eventId !== undefined && { photoSourceEventId: eventId }),
                ...(uploadedUrls !== undefined && { uploadedUrls }),
              })}
            />
          )}

          {activeTab === 'widget' && (
            <StepWidgetMode
              mode={draft.widgetMode}
              customMessage={draft.customMessage}
              customSignoff={draft.customSignoff}
              selectedQuoteIds={draft.selectedQuoteIds}
              selectedVerseIds={draft.selectedVerseIds}
              onChange={({ mode, customMessage, customSignoff, selectedQuoteIds, selectedVerseIds }) => patch({
                ...(mode !== undefined && { widgetMode: mode }),
                ...(customMessage !== undefined && { customMessage }),
                ...(customSignoff !== undefined && { customSignoff }),
                ...(selectedQuoteIds !== undefined && { selectedQuoteIds }),
                ...(selectedVerseIds !== undefined && { selectedVerseIds }),
              })}
            />
          )}

          {activeTab === 'shoutout' && (
            <StepShoutout
              name={draft.shoutoutName}
              tag={draft.shoutoutTag}
              note={draft.shoutoutNote}
              onChange={({ name, tag, note }) => patch({
                ...(name !== undefined && { shoutoutName: name }),
                ...(tag !== undefined && { shoutoutTag: tag }),
                ...(note !== undefined && { shoutoutNote: note }),
              })}
            />
          )}

          {activeTab === 'rangeSchedule' && selectedScreen === 'range' && (
            <StepRangeSchedule config={draft.rangeConfig} onChange={patchRange} />
          )}

          {activeTab === 'rangeLayout' && selectedScreen === 'range' && (
            <StepRangeSlideshow
              config={draft.rangeConfig}
              settings={settings}
              onChange={patchRange}
              onSave={save}
              saving={saving}
              flash={flash}
              saveError={saveError}
            />
          )}

          {activeTab === 'announcements' && selectedScreen === 'range' && (
            <StepRangeNotices
              screenSlug="range"
              category="announcement"
              heading="ANNOUNCEMENTS"
              blurb="Shown in the Announcements panel of Range's rotation screen. Persists until deleted — nothing here expires on its own."
            />
          )}

          {activeTab === 'staffNotes' && selectedScreen === 'range' && (
            <StepRangeNotices
              screenSlug="range"
              category="staff_note"
              heading="NOTES FROM STAFF"
              blurb="Shown in the Notes from Staff panel of Range's rotation screen. Persists until deleted — nothing here expires on its own."
            />
          )}
        </div>
      </div>

      {saveError && (
        <div style={{
          marginTop: sp[5], padding: sp[4], borderRadius: radius.md,
          background: 'rgba(192,57,43,0.12)', border: `1px solid ${P.red}`,
          fontFamily: inter, fontSize: 14, color: P.cream, lineHeight: 1.5,
        }}>
          <strong style={{ color: P.red }}>Didn't save.</strong> {saveError} Your choices are still here — press Save again.
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: sp[4], marginTop: sp[6] }}>
        <Btn onClick={save} variant="gold" size="lg" disabled={saving}>
          {saving ? 'SAVING…' : `SAVE — PUSH TO ${SCREENS.find((s) => s.slug === selectedScreen)?.label.toUpperCase() ?? 'SCREEN'}`}
        </Btn>

        {flash ? (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: radius.sm,
            background: 'rgba(39,174,96,0.14)', border: `1px solid ${P.green}`,
            fontFamily: mono, fontSize: fs.tiny, color: P.green, letterSpacing: '0.05em',
          }}>
            <span>✓</span>{flash}
          </div>
        ) : isDirty && !saving ? (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            fontFamily: mono, fontSize: fs.tiny, color: P.bright, letterSpacing: '0.1em',
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: P.bright, flexShrink: 0 }} />
            UNSAVED CHANGES
          </div>
        ) : null}
      </div>
      </div>
    </div>
  );
}
