import { useRef, useState, useCallback } from 'react';
import { P, mono, fs, sp, radius } from '../../theme';
import { TV_CAROUSEL_ASPECT_RATIO } from '../../../../lib/tvCarouselAspect';

// Click-or-drag focal point picker. Renders the photo at the carousel's real
// on-screen aspect ratio (see tvCarouselAspect.js) with object-fit: cover +
// object-position driven live by the chosen point, so what's shown here is
// exactly what the crop will look like on the actual TV — not a generic
// square/16:9 approximation that hides the real problem.
export default function FocalPointPicker({ src, focalX, focalY, onChange, disabled = false }) {
  const frameRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const setFromPointer = useCallback((e) => {
    const rect = frameRef.current.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    onChange(x, y);
  }, [onChange]);

  function handlePointerDown(e) {
    if (disabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    setFromPointer(e);
  }

  function handlePointerMove(e) {
    if (!dragging || disabled) return;
    setFromPointer(e);
  }

  function handlePointerUp(e) {
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    setDragging(false);
  }

  return (
    <div>
      <div
        ref={frameRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{
          position: 'relative', width: '100%', aspectRatio: String(TV_CAROUSEL_ASPECT_RATIO),
          overflow: 'hidden', borderRadius: radius.sm, border: `1px solid ${P.hairStrong}`,
          cursor: disabled ? 'default' : dragging ? 'grabbing' : 'crosshair',
          touchAction: 'none', userSelect: 'none',
        }}
      >
        <img
          src={src}
          alt=""
          draggable={false}
          style={{
            width: '100%', height: '100%', objectFit: 'cover',
            objectPosition: `${focalX * 100}% ${focalY * 100}%`, display: 'block', pointerEvents: 'none',
          }}
        />

        {/* Rule-of-thirds guides — reference lines only, not clickable targets. */}
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          {[1 / 3, 2 / 3].map((f) => (
            <div key={`v${f}`} style={{ position: 'absolute', top: 0, bottom: 0, left: `${f * 100}%`, width: 1, background: 'rgba(244,236,216,0.18)' }} />
          ))}
          {[1 / 3, 2 / 3].map((f) => (
            <div key={`h${f}`} style={{ position: 'absolute', left: 0, right: 0, top: `${f * 100}%`, height: 1, background: 'rgba(244,236,216,0.18)' }} />
          ))}
        </div>

        <div
          aria-hidden="true"
          style={{
            position: 'absolute', left: `${focalX * 100}%`, top: `${focalY * 100}%`,
            transform: 'translate(-50%, -50%)', pointerEvents: 'none',
          }}
        >
          <div style={{ width: 28, height: 28, borderRadius: '50%', border: `2px solid ${P.gold}`, boxShadow: '0 0 0 2px rgba(6,16,31,0.6), 0 0 12px rgba(0,0,0,0.5)' }} />
          <div style={{ position: 'absolute', top: '50%', left: '50%', width: 4, height: 4, borderRadius: '50%', background: P.gold, transform: 'translate(-50%, -50%)' }} />
        </div>
      </div>

      <div style={{ fontFamily: mono, fontSize: fs.micro, color: P.mute, letterSpacing: '0.06em', marginTop: sp[2] }}>
        CLICK OR DRAG THE IMAGE TO SET THE FOCAL POINT — THIS STAYS IN FRAME ON THE TV
      </div>
    </div>
  );
}
