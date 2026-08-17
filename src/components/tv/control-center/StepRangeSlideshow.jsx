import { useState, useEffect, useRef } from 'react';
import { P, mono, inter, fs, sp, radius, shadow, ease } from '../../admin/theme.js';
import { useTvUpcomingEvents } from '../../../hooks/useTvUpcomingEvents.js';
import { useTvNotices } from '../../../hooks/useTvNotices.js';
import { SLIDE_TYPES, makeSlide } from '../range/slides/slideRegistry.js';
import { FONT_FAMILY_OPTIONS } from '../range/rangeGrid/gridDefaults.js';
import TvRangeSlideshowScreen from '../range/TvRangeSlideshowScreen.jsx';
import RichTextField from '../range/rangeGrid/RichTextField.jsx';
import { storageStringToRuns, runsToStorageString } from '../range/rangeGrid/richText.jsx';

const SLIDE_TITLE_MAX = 80;
const SLIDE_MESSAGE_MAX = 280;

function addSlide(slides, type) {
  return [...slides, makeSlide(type)];
}
function removeSlide(slides, id) {
  return slides.filter((s) => s.id !== id);
}
function moveSlide(slides, id, dir) {
  const i = slides.findIndex((s) => s.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= slides.length) return slides;
  const next = slides.slice();
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}
function updateSlide(slides, id, patch) {
  return slides.map((s) => (s.id === id ? { ...s, ...patch } : s));
}
function updateSlideConfig(slides, id, patch) {
  return slides.map((s) => (s.id === id ? { ...s, config: { ...s.config, ...patch } } : s));
}

const cardBase = {
  flex: 1, textAlign: 'left', padding: sp[4], borderRadius: radius.md,
  border: `1px solid ${P.hair}`, background: 'transparent', cursor: 'pointer',
  transition: `all 150ms ${ease}`,
};

const rowFieldStyle = {
  padding: '6px 10px', borderRadius: radius.sm, border: `1px solid ${P.hairStrong}`,
  background: P.deep, color: P.cream, fontFamily: inter, fontSize: 13,
};

const chromeBtnBase = {
  background: 'none', border: `1px solid ${P.hairStrong}`, color: P.mute,
  fontFamily: inter, fontSize: 13, fontWeight: 600, padding: '8px 16px',
  borderRadius: radius.sm, cursor: 'pointer',
};

function AddSlideGallery({ onAdd }) {
  return (
    <div style={{ marginBottom: sp[6] }}>
      <div style={{ fontFamily: mono, fontSize: fs.micro, color: P.faint, letterSpacing: '0.2em', marginBottom: sp[3] }}>
        ADD A SLIDE
      </div>
      <div style={{ display: 'flex', gap: sp[3] }}>
        {Object.entries(SLIDE_TYPES).map(([type, def]) => (
          <button key={type} onClick={() => onAdd(type)} style={cardBase}>
            <div style={{ fontFamily: inter, fontSize: 15, fontWeight: 700, color: P.cream, marginBottom: 4 }}>
              + {def.label}
            </div>
            <div style={{ fontFamily: inter, fontSize: 12, color: P.mute, lineHeight: 1.4 }}>{def.blurb}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function SlideExtraControls({ slide, onPatchConfig, upcomingEvents }) {
  if (slide.type === 'announcements') {
    return (
      <>
        <select
          value={slide.config?.style?.fontFamily ?? ''}
          onChange={(e) => onPatchConfig({ style: { ...slide.config?.style, fontFamily: e.target.value || undefined } })}
          style={rowFieldStyle}
        >
          <option value="">Default font</option>
          {FONT_FAMILY_OPTIONS.map((f) => <option key={f.key} value={f.value}>{f.label}</option>)}
        </select>
        <input
          type="number" min={12} max={72} placeholder="Size"
          value={slide.config?.style?.fontSize ?? ''}
          onChange={(e) => onPatchConfig({ style: { ...slide.config?.style, fontSize: e.target.value ? Number(e.target.value) : undefined } })}
          style={{ ...rowFieldStyle, width: 60 }}
        />
      </>
    );
  }

  if (slide.type === 'uniformCountdown') {
    return (
      <select
        value={slide.config?.countdownEventId ?? ''}
        onChange={(e) => onPatchConfig({ countdownEventId: e.target.value || null })}
        style={{ ...rowFieldStyle, flex: 1, minWidth: 0 }}
      >
        <option value="">Auto — soonest upcoming event</option>
        {upcomingEvents.map((ev) => <option key={ev.id} value={ev.id}>{ev.title} — {ev.date}</option>)}
      </select>
    );
  }

  return null;
}

// Inline title/message editor for the Single Announcement slide — its own
// content, written right here, not a pointer into the Announcements tab's
// tv_notices list (that's what the "Announcements" slide type is for).
// Same rich-text run storage convention as tv_notices (richText.js), just
// living in this slide's own `config.title`/`config.message` instead.
function AnnouncementSingleEditor({ slide, onPatchConfig }) {
  const titleRuns = storageStringToRuns(slide.config?.title);
  const messageRuns = storageStringToRuns(slide.config?.message);

  return (
    <div style={{ marginTop: sp[3], paddingTop: sp[3], borderTop: `1px dashed ${P.hair}`, display: 'flex', flexDirection: 'column', gap: sp[2] }}>
      <RichTextField
        value={titleRuns}
        onChange={(runs) => onPatchConfig({ title: runsToStorageString(runs) })}
        maxLength={SLIDE_TITLE_MAX}
        placeholder="Title — e.g. Uniform inspection Friday"
        baseStyle={rowFieldStyle}
      />
      <RichTextField
        multiline
        value={messageRuns}
        onChange={(runs) => onPatchConfig({ message: runsToStorageString(runs) })}
        maxLength={SLIDE_MESSAGE_MAX}
        placeholder="Message — the full text shown on the slide"
        baseStyle={{ ...rowFieldStyle, minHeight: '3.6em' }}
      />
    </div>
  );
}

function SlideRow({ slide, index, count, onMove, onRemove, onUpdate, onPatchConfig, upcomingEvents }) {
  return (
    <div style={{
      padding: sp[4], borderRadius: radius.md, border: `1px solid ${P.hair}`, marginBottom: sp[3],
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: sp[3] }}>
        <div style={{
          flexShrink: 0, width: 26, height: 26, borderRadius: '50%',
          border: `1px solid ${P.hair}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: mono, fontSize: fs.micro, color: P.mute,
        }}>
          {index + 1}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <button
            onClick={() => onMove(-1)} disabled={index === 0}
            aria-label="Move up"
            style={{ ...chromeBtnBase, padding: '2px 8px', opacity: index === 0 ? 0.3 : 1, fontSize: 11 }}
          >
            ▲
          </button>
          <button
            onClick={() => onMove(1)} disabled={index === count - 1}
            aria-label="Move down"
            style={{ ...chromeBtnBase, padding: '2px 8px', opacity: index === count - 1 ? 0.3 : 1, fontSize: 11 }}
          >
            ▼
          </button>
        </div>

        <div style={{ minWidth: 140, flexShrink: 0 }}>
          <div style={{ fontFamily: inter, fontSize: 14, fontWeight: 700, color: P.cream }}>
            {SLIDE_TYPES[slide.type]?.label ?? slide.type}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: sp[2], flex: 1, minWidth: 0 }}>
          <SlideExtraControls slide={slide} onPatchConfig={onPatchConfig} upcomingEvents={upcomingEvents} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: sp[1], flexShrink: 0 }}>
          <input
            type="number" min={3} max={120}
            value={slide.durationSec}
            onChange={(e) => onUpdate({ durationSec: Math.max(3, Number(e.target.value) || 3) })}
            style={{ ...rowFieldStyle, width: 52, textAlign: 'right' }}
          />
          <span style={{ fontFamily: mono, fontSize: fs.micro, color: P.faint }}>SEC</span>
        </div>

        <button
          onClick={onRemove}
          style={{
            flexShrink: 0, padding: `${sp[2]}px ${sp[3]}px`, borderRadius: radius.sm,
            border: `1px solid ${P.red}`, background: 'transparent', color: P.red,
            fontFamily: mono, fontSize: fs.micro, letterSpacing: '0.1em', cursor: 'pointer',
          }}
        >
          REMOVE
        </button>
      </div>

      {slide.type === 'announcementSingle' && (
        <AnnouncementSingleEditor slide={slide} onPatchConfig={onPatchConfig} />
      )}
    </div>
  );
}

/**
 * Slideshow editor for Range's Rotation Screen — sibling of StepRangeLayout
 * (Grid mode), swapped in by StepRotationScreen.jsx when `rotationMode` is
 * 'slideshow'. Slides are built from the template catalog in slideRegistry.js
 * and reordered top-to-bottom (↑/↓, not drag — same numbered-list pattern
 * StepRangeSchedule.jsx's Welcome Screen blocks already use, and more
 * reliable than drag-and-drop for a short list). TV Preview runs the exact
 * same TvRangeSlideshowScreen component the live kiosk renders, timers and
 * all, so what's previewed here is exactly what airs — same principle
 * StepRangeLayout's preview mode already follows.
 */
export default function StepRangeSlideshow({ config, onChange, onSave, saving, flash, saveError }) {
  const [mode, setMode] = useState('edit');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const wrapRef = useRef(null);
  const slides = config.slideshowSlides ?? [];

  // Fetched once here, not per-row — useTvNotices opens a Supabase realtime
  // channel keyed by screen slug; calling it once per SlideRow (3+ rows once
  // the default slideshow is seeded) opened multiple subscriptions racing
  // for the same channel name and crashed the tree ("cannot add
  // postgres_changes callbacks... after subscribe()"). One fetch here, and
  // the row-level dropdowns (SlideExtraControls) just read the result.
  const upcomingEvents = useTvUpcomingEvents(30);
  const { notices } = useTvNotices('range');
  const announcements = notices.filter((n) => n.category === 'announcement');

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(document.fullscreenElement === wrapRef.current);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  async function toggleFullscreen() {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await wrapRef.current?.requestFullscreen();
    }
  }

  return (
    <div>
      <div style={{ fontFamily: mono, fontSize: 10, color: P.gold, letterSpacing: '0.24em', marginBottom: sp[2] }}>
        ROTATION SCREEN — SLIDESHOW
      </div>
      <div style={{ fontFamily: inter, fontSize: 13, color: P.mute, marginBottom: sp[5], lineHeight: 1.5 }}>
        Cycles one full-screen slide at a time, in the order below. Go fullscreen for TV Preview to watch it run in real time.
      </div>

      <div
        ref={wrapRef}
        style={isFullscreen ? {
          background: P.ink, minHeight: '100vh', width: '100%', boxSizing: 'border-box',
          display: 'flex', flexDirection: 'column', padding: sp[8], overflowY: 'auto',
        } : undefined}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: sp[3], marginBottom: sp[5], flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', background: P.navy, borderRadius: radius.md, padding: 3, gap: 2 }}>
            <button
              onClick={() => setMode('edit')}
              style={{
                padding: '8px 18px', borderRadius: radius.sm, border: 'none', fontFamily: inter, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                background: mode === 'edit' ? P.gold : 'transparent', color: mode === 'edit' ? P.ink : P.mute,
              }}
            >
              Slides
            </button>
            <button
              onClick={() => setMode('preview')}
              style={{
                padding: '8px 18px', borderRadius: radius.sm, border: 'none', fontFamily: inter, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                background: mode === 'preview' ? P.gold : 'transparent', color: mode === 'preview' ? P.ink : P.mute,
              }}
            >
              TV Preview
            </button>
          </div>
          <button
            onClick={toggleFullscreen}
            style={{ ...chromeBtnBase, border: `1px solid ${P.gold}`, color: P.bright }}
          >
            {isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          </button>
        </div>

        {mode === 'edit' ? (
          <div>
            <AddSlideGallery onAdd={(type) => onChange({ slideshowSlides: addSlide(slides, type) })} />

            <div style={{ fontFamily: mono, fontSize: fs.micro, color: P.faint, letterSpacing: '0.2em', marginBottom: sp[3] }}>
              YOUR SLIDESHOW — {slides.length} SLIDE{slides.length === 1 ? '' : 'S'}
            </div>
            {slides.length ? (
              slides.map((slide, i) => (
                <SlideRow
                  key={slide.id}
                  slide={slide}
                  index={i}
                  count={slides.length}
                  onMove={(dir) => onChange({ slideshowSlides: moveSlide(slides, slide.id, dir) })}
                  onRemove={() => onChange({ slideshowSlides: removeSlide(slides, slide.id) })}
                  onUpdate={(patch) => onChange({ slideshowSlides: updateSlide(slides, slide.id, patch) })}
                  onPatchConfig={(patch) => onChange({ slideshowSlides: updateSlideConfig(slides, slide.id, patch) })}
                  upcomingEvents={upcomingEvents}
                />
              ))
            ) : (
              <div style={{ fontFamily: inter, fontSize: fs.sm, color: P.faint, fontStyle: 'italic' }}>
                No slides yet — add one above.
              </div>
            )}
          </div>
        ) : (
          <div style={{
            position: 'relative', width: '100%', aspectRatio: isFullscreen ? undefined : '16 / 9', flex: isFullscreen ? 1 : undefined,
            minHeight: isFullscreen ? 0 : undefined, borderRadius: radius.lg, border: `1px solid ${P.hair}`, overflow: 'hidden', background: P.ink,
          }}>
            {slides.length ? (
              <div style={{ position: 'absolute', inset: 0 }}>
                <TvRangeSlideshowScreen slides={slides} announcements={announcements} />
              </div>
            ) : (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: inter, fontSize: fs.sm, color: P.faint, fontStyle: 'italic' }}>
                Add a slide to preview it here.
              </div>
            )}
          </div>
        )}

        {isFullscreen && (
          <div style={{ display: 'flex', alignItems: 'center', gap: sp[4], marginTop: sp[6] }}>
            <button
              onClick={onSave}
              disabled={saving}
              style={{
                background: P.gold, border: 'none', color: P.ink, fontFamily: inter,
                fontSize: 15, fontWeight: 700, padding: '12px 28px', borderRadius: radius.md,
                cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? 'SAVING…' : 'SAVE — PUSH TO RANGE'}
            </button>
            {flash && <div style={{ fontFamily: mono, fontSize: fs.tiny, color: P.green }}>{flash}</div>}
            {saveError && <div style={{ fontFamily: inter, fontSize: 13, color: P.red }}>{saveError}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
