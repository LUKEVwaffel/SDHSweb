import { P, mono, fraunces, inter, fs, sp, radius, ease } from '../admin/theme.js';
import { useWeather } from '../../hooks/useWeather.js';

function hourLabel(isoTime) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', hour: 'numeric', hour12: true,
  }).format(new Date(isoTime)).replace(' ', '');
}

// NWS shortForecast text -> a condition key driving the icon set below.
// Kept intentionally simple (no icon library dependency) rather than mapping
// every NWS icon variant.
function conditionKey(shortForecast = '') {
  const s = shortForecast.toLowerCase();
  if (s.includes('thunder')) return 'thunder';
  if (s.includes('snow')) return 'snow';
  if (s.includes('rain') || s.includes('shower')) return 'rain';
  if (s.includes('fog') || s.includes('haze')) return 'fog';
  if (s.includes('cloud') && s.includes('partly')) return 'partlyCloudy';
  if (s.includes('cloud') || s.includes('overcast')) return 'cloudy';
  return 'clear';
}

function minutesAgo(date) {
  if (!date) return null;
  return Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
}

function IconStyles() {
  return (
    <style>{`
      @keyframes tvSunSpin { to { transform: rotate(360deg); } }
      @keyframes tvDrift { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(3px); } }
      @keyframes tvDropFall { 0% { transform: translateY(-2px); opacity: 0; } 30% { opacity: 1; } 100% { transform: translateY(6px); opacity: 0; } }
      @keyframes tvFlakeDrift { 0% { transform: translateY(-1px) translateX(0); } 50% { transform: translateY(3px) translateX(1.5px); } 100% { transform: translateY(-1px) translateX(0); } }
      @keyframes tvBoltFlash { 0%, 100% { opacity: 1; } 92% { opacity: 1; } 94% { opacity: 0.25; } 96% { opacity: 1; } }
      .tv-wx-sun-rays { transform-origin: center; animation: tvSunSpin 22s linear infinite; }
      .tv-wx-fog-line { animation: tvDrift 4s ease-in-out infinite; }
      .tv-wx-drop { animation: tvDropFall 1.1s ease-in infinite; }
      .tv-wx-flake { animation: tvFlakeDrift 2.6s ease-in-out infinite; }
      .tv-wx-bolt { animation: tvBoltFlash 3.2s ease-in-out infinite; }
      @media (prefers-reduced-motion: reduce) {
        .tv-wx-sun-rays, .tv-wx-fog-line, .tv-wx-drop, .tv-wx-flake, .tv-wx-bolt { animation: none; }
      }
    `}</style>
  );
}

function WeatherIcon({ condition, size = 40 }) {
  const gold = P.gold, cream = P.cream, mute = P.mute;
  const common = { width: size, height: size, viewBox: '0 0 48 48', fill: 'none' };

  if (condition === 'clear') {
    return (
      <svg {...common}>
        <g className="tv-wx-sun-rays" stroke={gold} strokeWidth="2.4" strokeLinecap="round">
          {Array.from({ length: 8 }).map((_, i) => {
            const a = (i * Math.PI) / 4;
            const x1 = 24 + Math.cos(a) * 15, y1 = 24 + Math.sin(a) * 15;
            const x2 = 24 + Math.cos(a) * 20, y2 = 24 + Math.sin(a) * 20;
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />;
          })}
        </g>
        <circle cx="24" cy="24" r="10" fill={gold} />
      </svg>
    );
  }
  if (condition === 'partlyCloudy') {
    return (
      <svg {...common}>
        <g className="tv-wx-sun-rays" stroke={gold} strokeWidth="2.2" strokeLinecap="round" opacity="0.85">
          {Array.from({ length: 6 }).map((_, i) => {
            const a = (i * Math.PI) / 3;
            const x1 = 18 + Math.cos(a) * 12, y1 = 18 + Math.sin(a) * 12;
            const x2 = 18 + Math.cos(a) * 16, y2 = 18 + Math.sin(a) * 16;
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />;
          })}
        </g>
        <circle cx="18" cy="18" r="7" fill={gold} />
        <path d="M14 34a8 8 0 0 1 1-16 9 9 0 0 1 17 3 7 7 0 0 1-2 13H14z" fill={cream} opacity="0.92" />
      </svg>
    );
  }
  if (condition === 'cloudy') {
    return (
      <svg {...common}>
        <path d="M12 34a9 9 0 0 1 1.5-18 10 10 0 0 1 19 3.4 8 8 0 0 1-2 14.6H12z" fill={cream} opacity="0.9" />
      </svg>
    );
  }
  if (condition === 'rain') {
    return (
      <svg {...common}>
        <path d="M12 26a8 8 0 0 1 1.3-16 9 9 0 0 1 17 3 7 7 0 0 1-1.8 13.9H12z" fill={mute} opacity="0.95" />
        {[16, 24, 32].map((x, i) => (
          <line key={x} className="tv-wx-drop" style={{ animationDelay: `${i * 0.2}s` }} x1={x} y1="30" x2={x - 2} y2="38" stroke={gold} strokeWidth="2.4" strokeLinecap="round" />
        ))}
      </svg>
    );
  }
  if (condition === 'snow') {
    return (
      <svg {...common}>
        <path d="M12 26a8 8 0 0 1 1.3-16 9 9 0 0 1 17 3 7 7 0 0 1-1.8 13.9H12z" fill={mute} opacity="0.95" />
        {[16, 24, 32].map((x, i) => (
          <circle key={x} className="tv-wx-flake" style={{ animationDelay: `${i * 0.3}s` }} cx={x} cy="34" r="2" fill={gold} />
        ))}
      </svg>
    );
  }
  if (condition === 'thunder') {
    return (
      <svg {...common}>
        <path d="M12 24a8 8 0 0 1 1.3-16 9 9 0 0 1 17 3 7 7 0 0 1-1.8 13.9H12z" fill={mute} opacity="0.95" />
        <polygon className="tv-wx-bolt" points="26,22 19,34 24,34 21,44 32,29 26,29" fill={gold} />
      </svg>
    );
  }
  // fog
  return (
    <svg {...common}>
      {[15, 22, 29].map((y, i) => (
        <line key={y} className="tv-wx-fog-line" style={{ animationDelay: `${i * 0.4}s` }} x1="10" y1={y} x2="38" y2={y} stroke={mute} strokeWidth="3" strokeLinecap="round" />
      ))}
    </svg>
  );
}

export default function TvWeatherPanel() {
  const { data, error, updatedAt } = useWeather();

  if (!data) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', color: P.mute, fontFamily: inter, fontSize: 13 }}>
        {error ? 'Weather unavailable' : 'Loading weather…'}
      </div>
    );
  }

  const staleMin = minutesAgo(updatedAt);
  const key = conditionKey(data.current.shortForecast);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: sp[3] }}>
      <IconStyles />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: sp[3] }}>
          <WeatherIcon condition={key} size={44} />
          <div>
            <div style={{ display: 'flex', alignItems: 'flex-start' }}>
              <span style={{ fontFamily: fraunces, fontWeight: 800, fontSize: 'clamp(28px, 5.5vh, 50px)', color: P.cream, lineHeight: 0.95, letterSpacing: '-0.02em' }}>
                {data.current.temperature}
              </span>
              <span style={{ fontFamily: fraunces, fontWeight: 700, fontSize: 'clamp(14px, 2.5vh, 22px)', color: P.gold, marginTop: 2 }}>°</span>
            </div>
            <div style={{
              fontFamily: inter, fontSize: fs.sm, color: P.mute, marginTop: 2,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 220,
            }}>
              {data.current.shortForecast}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: sp[1], alignItems: 'flex-end' }}>
          <span style={{
            fontFamily: mono, fontSize: fs.xs, color: P.bright, letterSpacing: '0.04em',
            padding: `2px ${sp[2]}px`, border: `1px solid ${P.hair}`, borderRadius: radius.pill,
          }}>
            H {data.high ?? '—'}°
          </span>
          <span style={{
            fontFamily: mono, fontSize: fs.xs, color: P.mute, letterSpacing: '0.04em',
            padding: `2px ${sp[2]}px`, border: `1px solid ${P.hair}`, borderRadius: radius.pill,
          }}>
            L {data.low ?? '—'}°
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: sp[2] }}>
        {data.hourly.map((h, i) => (
          <div key={h.time} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: 1,
            padding: `${sp[1]}px ${sp[1]}px`, borderRadius: radius.sm,
            background: i === 0 ? P.goldWash : 'transparent',
            border: `1px solid ${i === 0 ? P.hairStrong : 'transparent'}`,
            borderTop: `1px dashed ${P.hair}`,
            transition: `background 400ms ${ease}`,
          }}>
            <span style={{ fontFamily: mono, fontSize: fs.micro, color: i === 0 ? P.gold : P.mute, letterSpacing: '0.04em' }}>
              {hourLabel(h.time)}
            </span>
            <WeatherIcon condition={conditionKey(h.shortForecast)} size={16} />
            <span style={{ fontFamily: fraunces, fontWeight: 700, fontSize: fs.sm, color: P.cream }}>{h.temperature}°</span>
          </div>
        ))}
      </div>

      {(error || staleMin > 30) && (
        <div style={{ fontFamily: mono, fontSize: 9, color: `${P.gold}88`, letterSpacing: '0.1em' }}>
          {error ? 'showing last known conditions' : `updated ${staleMin}m ago`}
        </div>
      )}
    </div>
  );
}
