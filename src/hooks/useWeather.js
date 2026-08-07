import { useState, useEffect, useRef, useCallback } from 'react';

// Soddy-Daisy, TN (approximate town center). NWS forecasts are per-gridpoint
// (~2.5km resolution) so exact-address precision doesn't meaningfully change
// the numbers shown.
const LAT = 35.2415;
const LON = -85.1922;

const POINTS_URL = `https://api.weather.gov/points/${LAT},${LON}`;
const REFRESH_MS = 15 * 60 * 1000;
const NWS_HEADERS = { Accept: 'application/geo+json' };

async function fetchJson(url) {
  const res = await fetch(url, { headers: NWS_HEADERS });
  if (!res.ok) throw new Error(`NWS fetch failed: ${res.status} ${url}`);
  return res.json();
}

/**
 * Fetches current-ish conditions (from the hourly forecast's first entry),
 * today's high/low, and a short hourly strip from api.weather.gov.
 * Keeps last-good data on fetch failure instead of blanking the panel —
 * this runs unattended on a kiosk, it can't visibly break on a network blip.
 */
export function useWeather() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const gridUrlsRef = useRef(null);

  const load = useCallback(async () => {
    try {
      if (!gridUrlsRef.current) {
        const points = await fetchJson(POINTS_URL);
        gridUrlsRef.current = {
          forecast: points.properties.forecast,
          forecastHourly: points.properties.forecastHourly,
        };
      }

      const [daily, hourly] = await Promise.all([
        fetchJson(gridUrlsRef.current.forecast),
        fetchJson(gridUrlsRef.current.forecastHourly),
      ]);

      const dailyPeriods = daily.properties.periods;
      const todayPeriod = dailyPeriods.find(p => p.isDaytime) ?? dailyPeriods[0];
      const tonightPeriod = dailyPeriods.find(p => !p.isDaytime) ?? dailyPeriods[1];

      const hourlyPeriods = hourly.properties.periods.slice(0, 6).map(p => ({
        time: p.startTime,
        temperature: p.temperature,
        shortForecast: p.shortForecast,
        icon: p.icon,
      }));

      const current = hourly.properties.periods[0];

      setData({
        current: {
          temperature: current.temperature,
          shortForecast: current.shortForecast,
          icon: current.icon,
        },
        high: todayPeriod?.temperature ?? null,
        low: tonightPeriod?.temperature ?? null,
        hourly: hourlyPeriods,
      });
      setError(null);
      setUpdatedAt(new Date());
    } catch (err) {
      setError(err);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  return { data, error, updatedAt };
}
