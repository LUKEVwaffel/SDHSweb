import { useState, useEffect, useCallback } from 'react';
import { P, mono, oswald, inter, sp, radius, shadow, ease } from '../../admin/theme.js';
import { BELL_SCHEDULES } from '../../../lib/bellSchedules.js';
import { updateTvDailySettings } from '../../../hooks/useTvDailySettings.js';
import StepFeaturedTeams from './StepFeaturedTeams.jsx';
import StepPhotoSource from './StepPhotoSource.jsx';
import StepWidgetMode from './StepWidgetMode.jsx';

const TABS = [
  { id: 'schedule', label: '1. Schedule' },
  { id: 'teams', label: '2. Featured Team' },
  { id: 'photos', label: '3. Photos' },
  { id: 'widget', label: '4. Bottom Widget' },
];

function draftFromSettings(settings) {
  return {
    featuredTeams: settings?.featured_teams?.length ? settings.featured_teams : ['raiders'],
    photoSourceMode: settings?.photo_source_mode ?? 'team',
    photoSourceEventId: settings?.photo_source_event_id ?? null,
    uploadedUrls: settings?.uploaded_photo_urls ?? [],
    widgetMode: settings?.bottom_widget_mode ?? 'facts',
    customMessage: settings?.custom_message ?? '',
    customSignoff: settings?.custom_signoff ?? '',
    selectedQuoteIds: settings?.selected_quote_ids ?? [],
    selectedVerseIds: settings?.selected_verse_ids ?? [],
  };
}

/**
 * The "1SGTnator" — same no-login gear-icon pattern as the old schedule-only
 * picker, extended into a full daily control center. Schedule is still the
 * one thing forced every morning (needsSetup); the rest persists across days
 * and just shows its current value, so touching this mid-day to swap the
 * bottom-widget message doesn't force a walk through every tab.
 */
export default function TvControlCenter({ open, onOpen, onClose, needsSetup, scheduleChoice, onChooseSchedule, settings }) {
  const [activeTab, setActiveTab] = useState('schedule');
  const [pendingSchedule, setPendingSchedule] = useState(scheduleChoice ?? 'normal');
  const [draft, setDraft] = useState(() => draftFromSettings(settings));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  // Hydrate from the latest committed values only when the overlay opens —
  // not on every realtime tick — so a change from another kiosk mid-edit
  // never clobbers what the 1SGT is actively typing here.
  useEffect(() => {
    if (!open) return;
    setPendingSchedule(scheduleChoice ?? 'normal');
    setDraft(draftFromSettings(settings));
    setActiveTab('schedule');
    setSaveError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: re-hydrate only on the open transition
  }, [open]);

  const patch = useCallback((p) => setDraft((d) => ({ ...d, ...p })), []);

  const finish = async () => {
    setSaving(true);
    setSaveError(null);
    const { error } = await updateTvDailySettings({
      featured_teams: draft.featuredTeams,
      photo_source_mode: draft.photoSourceMode,
      photo_source_event_id: draft.photoSourceMode === 'event' ? draft.photoSourceEventId : null,
      uploaded_photo_urls: draft.uploadedUrls,
      bottom_widget_mode: draft.widgetMode,
      custom_message: draft.customMessage || null,
      custom_signoff: draft.customSignoff || null,
      selected_quote_ids: draft.selectedQuoteIds,
      selected_verse_ids: draft.selectedVerseIds,
    });
    setSaving(false);

    if (error) {
      // Never close on a failed save — the 1SGT keeps his in-progress edits
      // and sees exactly why, instead of the screen closing as if it worked.
      setSaveError(error.message || 'Something went wrong saving your changes.');
      return;
    }

    onChooseSchedule(pendingSchedule);
    const el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
    onClose();
  };

  return (
    <>
      <button
        onClick={onOpen}
        aria-label="Kiosk control center"
        style={{
          position: 'fixed', bottom: 16, right: 16, zIndex: 100,
          width: 56, height: 56, borderRadius: radius.pill,
          background: 'rgba(6,16,31,0.5)', border: `1px solid ${P.hair}`,
          color: P.gold, opacity: open ? 1 : 0.24, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: `opacity 200ms ${ease}`, fontSize: 22,
        }}
      >
        ⚙
      </button>

      {open && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 101,
          background: 'rgba(6,16,31,0.92)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            width: 780, maxWidth: '92vw', maxHeight: '88vh', overflow: 'auto',
            background: P.navy, border: `1px solid ${P.hairStrong}`, borderRadius: radius.lg,
            boxShadow: shadow.lg, padding: 32,
          }}>
            <div style={{ fontFamily: mono, fontSize: 10, color: P.gold, letterSpacing: '0.24em', marginBottom: 8 }}>
              1SGTNATOR — DAILY CONTROL CENTER
            </div>
            <div style={{ fontFamily: oswald, fontSize: 24, color: P.cream, marginBottom: 6 }}>
              Set today's kiosk
            </div>
            <div style={{ fontFamily: inter, fontSize: 14, color: P.mute, marginBottom: 24, lineHeight: 1.5 }}>
              Go through the 4 tabs on the left, then press the gold button at the bottom when you're done. Nothing changes until you press it.
            </div>

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
                    <div style={{ display: 'flex', gap: sp[3] }}>
                      {Object.entries(BELL_SCHEDULES).map(([key, schedule]) => (
                        <button
                          key={key}
                          onClick={() => setPendingSchedule(key)}
                          style={{
                            flex: 1, padding: '16px 12px', borderRadius: radius.md,
                            border: `1px solid ${pendingSchedule === key ? P.gold : P.hair}`,
                            background: pendingSchedule === key ? P.goldWash : 'transparent',
                            color: pendingSchedule === key ? P.bright : P.mute,
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
              </div>
            </div>

            {saveError && (
              <div style={{
                marginTop: sp[5], padding: sp[4], borderRadius: radius.md,
                background: 'rgba(192,57,43,0.12)', border: `1px solid ${P.red}`,
                fontFamily: inter, fontSize: 14, color: P.cream, lineHeight: 1.5,
              }}>
                <strong style={{ color: P.red }}>Didn't save.</strong> {saveError} Your choices are still here — press the button again, or ask Luke for help.
              </div>
            )}

            <div style={{ display: 'flex', gap: sp[3], marginTop: sp[6] }}>
              <button
                onClick={finish}
                disabled={saving}
                style={{
                  flex: 1, padding: '18px 12px', borderRadius: radius.md,
                  border: 'none', background: P.gold, color: P.ink,
                  fontFamily: inter, fontWeight: 700, fontSize: 17,
                  cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? 'SAVING…' : 'SAVE & START KIOSK'}
              </button>

              {!needsSetup && (
                <button
                  onClick={onClose}
                  style={{
                    padding: '18px 24px', borderRadius: radius.md,
                    border: `1px solid ${P.hair}`, background: 'transparent', color: P.mute,
                    fontFamily: inter, fontSize: 15, cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
