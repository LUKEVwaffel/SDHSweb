import { P, mono, inter, sp, radius, ease } from '../../admin/theme.js';
import StepRangeLayout from './StepRangeLayout.jsx';
import StepRangeSlideshow from './StepRangeSlideshow.jsx';
import { DEFAULT_SLIDESHOW } from '../range/slides/slideRegistry.js';

function ModeCard({ active, label, hint, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, textAlign: 'left', padding: sp[4], borderRadius: radius.md,
        border: `1px solid ${active ? P.gold : P.hair}`, background: active ? P.goldWash : 'transparent',
        cursor: 'pointer', transition: `all 150ms ${ease}`,
      }}
    >
      <div style={{ fontFamily: inter, fontSize: 16, fontWeight: 700, color: active ? P.bright : P.cream, marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: inter, fontSize: 12, color: P.mute, lineHeight: 1.4 }}>{hint}</div>
    </button>
  );
}

/**
 * Range's "Rotation Screen" tab — the period-time content shown whenever no
 * other bell-driven phase (welcome/lunch/T2/etc) is active. Top-level
 * decision is Grid vs Slideshow (rotationMode); everything below the toggle
 * is delegated to whichever editor matches, same "one obvious switch, then
 * the relevant panel" shape StepPhotoSource.jsx already uses for its 3 photo
 * modes. Switching into Slideshow for the first time on a screen seeds the
 * 3 default template slides rather than leaving it empty — TvRangeRotationLayout.jsx
 * falls back to Grid on an empty slideshow anyway, but an admin who flips the
 * toggle should see something immediately, not a blank list.
 */
export default function StepRotationScreen({ config, settings, onChange, onSave, saving, flash, saveError }) {
  const mode = config.rotationMode ?? 'grid';

  function selectMode(next) {
    if (next === mode) return;
    if (next === 'slideshow' && !(config.slideshowSlides?.length)) {
      onChange({ rotationMode: next, slideshowSlides: DEFAULT_SLIDESHOW });
    } else {
      onChange({ rotationMode: next });
    }
  }

  return (
    <div>
      <div style={{ fontFamily: mono, fontSize: 10, color: P.gold, letterSpacing: '0.24em', marginBottom: sp[2] }}>
        ROTATION SCREEN
      </div>
      <div style={{ fontFamily: inter, fontSize: 13, color: P.mute, marginBottom: sp[5], lineHeight: 1.5 }}>
        What Range shows during a normal period, once any bell-specific screen (welcome, lunch, T2…) has passed.
      </div>

      <div style={{ display: 'flex', gap: sp[3], marginBottom: sp[6] }}>
        <ModeCard
          active={mode === 'grid'} onClick={() => selectMode('grid')}
          label="Grid Layout" hint="One packed board — clock, photos, announcements and more, all visible at once. Fully custom drag-and-resize."
        />
        <ModeCard
          active={mode === 'slideshow'} onClick={() => selectMode('slideshow')}
          label="Slideshow" hint="One full-screen slide at a time, cycling in an order you set. Easier to read across the room."
        />
      </div>

      {mode === 'grid' ? (
        <StepRangeLayout config={config} settings={settings} onChange={onChange} onSave={onSave} saving={saving} flash={flash} saveError={saveError} />
      ) : (
        <StepRangeSlideshow config={config} onChange={onChange} onSave={onSave} saving={saving} flash={flash} saveError={saveError} />
      )}
    </div>
  );
}
