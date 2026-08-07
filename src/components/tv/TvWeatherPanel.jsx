import { P, mono, oswald, inter, fs, sp, radius } from '../admin/theme.js';
import { useWeather } from '../../hooks/useWeather.js';

function hourLabel(isoTime) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', hour: 'numeric', hour12: true,
  }).format(new Date(isoTime)).replace(' ', '');
}

// NWS shortForecast text -> a small inline glyph. Kept intentionally simple
// (no icon library dependency) rather than mapping every NWS icon variant.
function conditionGlyph(shortForecast = '') {
  const s = shortForecast.toLowerCase();
  if (s.includes('thunder')) return '⛈';
  if (s.includes('snow')) return '❄';
  if (s.includes('rain') || s.includes('shower')) return '🌧';
  if (s.includes('fog') || s.includes('haze')) return '🌫';
  if (s.includes('cloud') && s.includes('partly')) return '⛅';
  if (s.includes('cloud') || s.includes('overcast')) return '☁';
  if (s.includes('clear') || s.includes('sunny')) return '☀';
  return '☀';
}

function minutesAgo(date) {
  if (!date) return null;
  return Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
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

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: sp[4] }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: sp[4] }}>
          <span style={{ fontSize: 40, lineHeight: 1 }}>{conditionGlyph(data.current.shortForecast)}</span>
          <div>
            <div style={{ fontFamily: oswald, fontSize: fs.xxl, fontWeight: 600, color: P.cream, lineHeight: 1 }}>
              {data.current.temperature}°
            </div>
            <div style={{ fontFamily: inter, fontSize: fs.sm, color: P.mute, marginTop: 2 }}>
              {data.current.shortForecast}
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right', fontFamily: mono, fontSize: fs.xs, color: P.mute }}>
          <div>H {data.high ?? '—'}°</div>
          <div>L {data.low ?? '—'}°</div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: sp[2] }}>
        {data.hourly.map((h) => (
          <div key={h.time} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: sp[1], flex: 1,
            padding: `${sp[2]}px ${sp[1]}px`, borderRadius: radius.sm, background: P.goldWash,
          }}>
            <span style={{ fontFamily: mono, fontSize: fs.micro, color: P.mute, letterSpacing: '0.04em' }}>
              {hourLabel(h.time)}
            </span>
            <span style={{ fontSize: 16 }}>{conditionGlyph(h.shortForecast)}</span>
            <span style={{ fontFamily: mono, fontSize: fs.xs, color: P.cream }}>{h.temperature}°</span>
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
