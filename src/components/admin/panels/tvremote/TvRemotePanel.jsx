import { useState, useEffect, useCallback } from 'react';
import { useTvDailySettings, updateTvDailySettings } from '../../../../hooks/useTvDailySettings.js';
import { BELL_SCHEDULES } from '../../../../lib/bellSchedules.js';
import StepFeaturedTeams from '../../../tv/control-center/StepFeaturedTeams.jsx';
import StepPhotoSource from '../../../tv/control-center/StepPhotoSource.jsx';
import StepWidgetMode from '../../../tv/control-center/StepWidgetMode.jsx';
import StepShoutout from '../../../tv/control-center/StepShoutout.jsx';
import { P, mono, oswald, inter, fs, sp, radius, ease } from '../../theme.js';
import { Btn, PanelHeader } from '../../shared/ui.jsx';

const TABS = [
  { id: 'schedule', label: 'Bell Schedule' },
  { id: 'teams', label: 'Featured Team' },
  { id: 'photos', label: 'Photo Source' },
  { id: 'widget', label: 'Bottom Widget' },
  { id: 'shoutout', label: 'Shoutout' },
];

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
  };
}

// Every physical /tv kiosk is a pure display now — no on-site gear icon, no
// walking up to a screen to change anything. This is the one place that
// controls all of them: writes land in tv_daily_settings (the singleton row
// every kiosk subscribes to over realtime), so a save here shows up on
// every screen in the building within a second, no reload. Replaces the old
// kiosk-side "1SGTnator" overlay (TvControlCenter) — that overlay's
// step components are reused here as-is.
export default function TvRemotePanel() {
  const { settings, loading } = useTvDailySettings();
  const [activeTab, setActiveTab] = useState('schedule');
  const [draft, setDraft] = useState(() => draftFromSettings(null));
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [flash, setFlash] = useState('');

  // Hydrate once, from the first settings load — not on every realtime tick,
  // so someone editing here doesn't get their in-progress draft clobbered by
  // another admin's save landing mid-edit.
  useEffect(() => {
    if (hydrated || !settings) return;
    setDraft(draftFromSettings(settings));
    setHydrated(true);
  }, [settings, hydrated]);

  const patch = useCallback((p) => setDraft((d) => ({ ...d, ...p })), []);

  async function save() {
    setSaving(true);
    setSaveError(null);
    const { error } = await updateTvDailySettings({
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
    });
    setSaving(false);

    if (error) {
      setSaveError(error.message || 'Something went wrong saving your changes.');
      return;
    }
    setFlash('Pushed to every TV ✓');
    setTimeout(() => setFlash(''), 2500);
  }

  if (loading && !hydrated) {
    return <div style={{ fontFamily: mono, fontSize: fs.xs, color: P.mute }}>LOADING…</div>;
  }

  return (
    <div style={{ maxWidth: 940 }}>
      <PanelHeader
        title="TV REMOTE"
        sub="Controls every /tv kiosk in the building — live, no reload needed. Nothing changes until you press Save."
      />

      <div style={{ display: 'flex', gap: sp[6] }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: sp[2], width: 180, flexShrink: 0 }}>
          {TABS.map((t) => (
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
                Applies to every kiosk. Remember to switch back to Normal once a T2 day is over.
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
          {saving ? 'SAVING…' : 'SAVE — PUSH TO ALL TVS'}
        </Btn>
        {flash && <div style={{ fontFamily: mono, fontSize: fs.tiny, color: P.green }}>{flash}</div>}
      </div>
    </div>
  );
}
