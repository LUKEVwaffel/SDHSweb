import { useWeather } from '../../hooks/useWeather.js';
import './tvServiceLearning.css';

const START = new Date('2026-11-11T07:15:00-05:00').getTime();
const NEXT_DAY = new Date('2026-11-12T00:00:00-05:00').getTime();
const ZONE = 'America/New_York';
const clock = new Intl.DateTimeFormat('en-US', { timeZone: ZONE, hour: 'numeric', minute: '2-digit' });
const day = new Intl.DateTimeFormat('en-US', { timeZone: ZONE, weekday: 'long', month: 'long', day: 'numeric' });

function Weather() {
  const { data, error, updatedAt } = useWeather();
  return (
    <aside className="service-weather" aria-label="Soddy-Daisy weather">
      <div className="service-label">Soddy-Daisy weather</div>
      {data ? <>
        <div className="service-temperature">{data.current.temperature}<span>°F</span></div>
        <div className="service-conditions">{data.current.shortForecast}</div>
        <div className="service-high-low">HIGH {data.high ?? '—'}° <span>/</span> LOW {data.low ?? '—'}°</div>
        <div className="service-hourly">
          {data.hourly.slice(0, 3).map(hour => <div key={hour.time}>
            <span>{clock.format(new Date(hour.time))}</span>
            <strong>{hour.temperature}°</strong>
          </div>)}
        </div>
        <div className="service-weather-source">National Weather Service · °F<br />
          {error ? 'Offline · showing last available forecast' : `Updated ${clock.format(updatedAt)}`}
        </div>
      </> : <div className="service-weather-loading">{error ? 'Weather temporarily unavailable' : 'Loading local forecast…'}</div>}
    </aside>
  );
}

export default function TvServiceLearningScreen({ now }) {
  const remaining = Math.max(0, Math.ceil((START - now.getTime()) / 1000));
  const values = [Math.floor(remaining / 86400), Math.floor(remaining / 3600) % 24, Math.floor(remaining / 60) % 60, remaining % 60];
  const started = now.getTime() >= START;
  const past = now.getTime() >= NEXT_DAY;
  return (
    <main className="service-tv">
      <header className="service-header">
        <div className="service-brand"><img src="/assets/trojan-helmet.png" alt="" /><div>Trojan Battalion<span>Soddy-Daisy High School · JROTC</span></div></div>
        <div className="service-clock"><strong>{clock.format(now)}</strong><span>{day.format(now)} · Eastern</span></div>
      </header>
      <div className="service-main">
        <section className="service-hero">
          <div className="service-label">Veterans Day · November 11, 2026</div>
          <h1>ALL-CADET<br /><em>SERVICE LEARNING</em></h1>
          <p className="service-motto">Honor through action.</p>
          <div className="service-countdown-label">{past ? 'Thank you for serving our community' : started ? 'Service-learning day has started' : 'Service begins in'}</div>
          {!started ? <div className="service-countdown" aria-label="Countdown to service learning">
            {values.map((value, i) => <div className="service-unit" key={i}><strong>{String(value).padStart(2, '0')}</strong><span>{['Days', 'Hours', 'Minutes', 'Seconds'][i]}</span></div>)}
          </div> : <div className="service-started">{past ? 'SERVICE. HONOR. COMMUNITY.' : 'TODAY IS THE DAY.'}</div>}
          <div className="service-start"><span>WEDNESDAY, NOVEMBER 11</span><strong>7:15 AM <small>EST</small></strong></div>
        </section>
        <Weather />
      </div>
      <section className="service-activities" aria-label="Service-learning activities">
        <article><span className="service-activity-number">01</span><div><div className="service-label">Honor the flag</div><h2>Flag Retirement</h2><p>Veterans Park <span>·</span> Soddy-Daisy</p></div></article>
        <article><span className="service-activity-number">02</span><div><div className="service-label">Serve our school</div><h2>Grounds Work</h2><p>SDHS campus grounds</p></div></article>
      </section>
      <footer className="service-footer"><span>ALL CADETS · TWO WAYS TO SERVE</span><span>Leadership starts with service.</span></footer>
    </main>
  );
}
