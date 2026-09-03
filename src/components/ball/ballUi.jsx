import './ball.css';
import { P } from '../admin/theme';

// Shared motion primitives for the Ball signup surfaces. Keep these dumb —
// all timing/easing lives in ball.css so it stays in one place.

export function Spinner({ size = 14, style }) {
  return <span className="ball-spinner" style={{ width: size, height: size, ...style }} aria-hidden="true" />;
}

export function Skeleton({ width = '100%', height = 14, style }) {
  return <div className="ball-skel" style={{ width, height, ...style }} aria-hidden="true" />;
}

// Staggered entrance wrapper. `delay` 1–5 maps to the .ball-dN classes.
export function FadeUp({ delay = 0, as: Tag = 'div', className = '', children, ...rest }) {
  const d = delay >= 1 && delay <= 5 ? ` ball-d${delay}` : '';
  return (
    <Tag className={`ball-fade-up${d} ${className}`.trim()} {...rest}>
      {children}
    </Tag>
  );
}

// A card-shaped skeleton for the landing "facts" panel while ball_config loads.
export function FactsSkeleton() {
  return (
    <div style={{ marginTop: 20, border: `1px solid ${P.hairStrong}`, background: P.navy, padding: '20px 28px' }}>
      {[68, 82, 74, 60].map((w, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: i < 3 ? `1px solid ${P.hair}` : 'none' }}>
          <Skeleton width={70} height={12} />
          <Skeleton width={`${w}%`} height={14} style={{ maxWidth: 220 }} />
        </div>
      ))}
    </div>
  );
}
