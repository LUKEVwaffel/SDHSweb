import { useState, useEffect, useCallback, useRef } from 'react';
import { useTvDailySettings, updateTvDailySettings } from '../../../../hooks/useTvDailySettings.js';
import { BELL_SCHEDULES } from '../../../../lib/bellSchedules.js';
import StepFeaturedTeams from '../../../tv/control-center/StepFeaturedTeams.jsx';
import StepPhotoSource from '../../../tv/control-center/StepPhotoSource.jsx';
import StepWidgetMode from '../../../tv/control-center/StepWidgetMode.jsx';
import StepShoutout from '../../../tv/control-center/StepShoutout.jsx';
import StepRangeSchedule from '../../../tv/control-center/StepRangeSchedule.jsx';
import StepRangeNotices from '../../../tv/control-center/StepRangeNotices.jsx';
import { P, mono, oswald, inter, fs, sp, radius, ease } from '../../theme.js';
import { Btn, PanelHeader } from '../../shared/ui.jsx';

// Hardcoded, not read from tv_screens — Staff Room 2 has a reserved slug in
// the registry (see supabase/tv_screens.sql) but no working kiosk yet, so it
// deliberately doesn't appear here until it's actually built out.
const SCREENS = [
  { slug: 'default', label: 'Outside' },
  { slug: 'range', label: 'Range' },
];

const BASE_TABS = [
  { id: 'schedule', label: 'Bell Schedule' },
  { id: 'teams', label: 'Featured Team' },
  { id: 'photos', label: 'Photo Source' },
  { id: 'widget', label: 'Bottom Widget' },
  { id: 'shoutout', label: 'Shoutout' },
];
const RANGE_TAB = { id: 'rangeSchedule', label: 'Schedule Editor' };
const RANGE_NOTICE_TABS = [
  { id: 'announcements', label: 'Announcements' },
  { id: 'staffNotes', label: 'Staff Notes' },
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
};

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
  };
}

function draftFromSettings(settings) {
  return {
    bellSchedule: settings?.bell_schedule ?? 'normal',
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
export default function TvRemotePanel() {
  const rootRef = useRef(null);
  const [selectedScreen, setSelectedScreen] = useState('default');
  const { settings, loading } = useTvDailySettings(selectedScreen);
  const [activeTab, setActiveTab] = useState('schedule');
  const [draft, setDraft] = useState(() => draftFromSettings(null));
  const [hydratedFor, setHydratedFor] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [flash, setFlash] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Hydrate once per screen, from that screen's first settings load — not on
  // every realtime tick, so someone editing here doesn't get their
  // in-progress draft clobbered by another admin's save landing mid-edit.
  // Re-keyed on selectedScreen so switching screens re-hydrates instead of
  // carrying the previous screen's draft over.
  useEffect(() => {
    if (!settings || hydratedFor === selectedScreen) return;
    setDraft(draftFromSettings(settings));
    setHydratedFor(selectedScreen);
  }, [settings, selectedScreen, hydratedFor]);

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
    setSelectedScreen(slug);
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

  async function save() {
    setSaving(true);
    setSaveError(null);
    const basePatch = {
      bell_schedule: draft.bellSchedule,
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
      },
    } : {};

    const { error } = await updateTvDailySettings({ ...basePatch, ...rangePatch }, selectedScreen);
    setSaving(false);

    if (error) {
      setSaveError(error.message || 'Something went wrong saving your changes.');
      return;
    }
    setFlash(`Pushed to ${SCREENS.find((s) => s.slug === selectedScreen)?.label ?? 'screen'} ✓`);
    setTimeout(() => setFlash(''), 2500);
  }

  const tabs = selectedScreen === 'range' ? [...BASE_TABS, RANGE_TAB, ...RANGE_NOTICE_TABS] : BASE_TABS;

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
          <Btn onClick={toggleFullscreen} variant="ghost" size="sm">
            {isFullscreen ? 'EXIT FULLSCREEN' : 'FULLSCREEN'}
          </Btn>
        )}
      />

      <div style={{ display: 'flex', gap: sp[2], marginBottom: sp[6] }}>
        {SCREENS.map((s) => (
          <button
            key={s.slug}
            onClick={() => selectScreen(s.slug)}
            style={{
              padding: `${sp[2]}px ${sp[5]}px`, borderRadius: radius.pill,
              border: `1px solid ${selectedScreen === s.slug ? P.gold : P.hair}`,
              background: selectedScreen === s.slug ? P.goldWash : 'transparent',
              color: selectedScreen === s.slug ? P.bright : P.mute,
              fontFamily: mono, fontSize: fs.xs, letterSpacing: '0.12em',
              cursor: 'pointer', transition: `all 150ms ${ease}`,
            }}
          >
            {s.label.toUpperCase()}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: sp[6] }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: sp[2], width: 180, flexShrink: 0 }}>
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                textAlign: 'left', padding: `${sp[4]}px ${sp[3]}px`, borderRadius: radius.sm,
                border: 'none', background: activeTab === t.id ? P.goldWash : 'transparent',
                color: activeTab === t.id ? P.bright : P.mute,
                fontFamily: inter, fontSize: 15, fontWeight: activeTab === t.id ? 700 : 400,
                cursor: 'pointer', transition: `all 150ms ${ease}`,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {activeTab === 'schedule' && (
            <div>
              <div style={{ fontFamily: mono, fontSize: 10, color: P.gold, letterSpacing: '0.24em', marginBottom: sp[2] }}>
                TODAY'S BELL SCHEDULE
              </div>
              <div style={{ fontFamily: inter, fontSize: 13, color: P.mute, marginBottom: sp[5], lineHeight: 1.5 }}>
                Applies to this screen. Remember to switch back to Normal once a T2 day is over.
              </div>
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
        {flash && <div style={{ fontFamily: mono, fontSize: fs.tiny, color: P.green }}>{flash}</div>}
      </div>
      </div>
    </div>
  );
}
