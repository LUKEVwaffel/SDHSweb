import { useState, useEffect, useRef } from 'react';
import { P, mono, inter, fs, sp, radius, ease } from '../admin/theme.js';
import { useNowTicker } from '../../hooks/useNowTicker.js';
import InstrumentDivider from './TvInstrumentDivider.jsx';

const ROTATE_MS = 8000;

// Manual entries are staff-typed and easy to forget to clear — same
// isStale/STALE_DAYS convention TvBottomWidget.jsx uses for custom_message,
// so a forgotten shoutout doesn't linger indefinitely.
const MANUAL_STALE_DAYS = 3;
// Birthday entries are recomputed daily by compute_daily_birthday_shoutout()
// (supabase/tv_shoutouts.sql) — a much tighter window just guards against a
// missed cron run showing yesterday's (or older) birthday as if it were today.
const BDAY_STALE_HOURS = 36;

function isStale(setAt, now, ms) {
  if (!setAt) return true;
  return now - new Date(setAt) > ms;
}

function PanelStyles() {
  return (
    <style>{`
      @keyframes tvShoutIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      .tv-shout-body { animation: tvShoutIn 600ms ${ease} both; }
      @media (prefers-reduced-motion: reduce) { .tv-shout-body { animation: none; } }
    `}</style>
  );
}

function RotationDots({ count, active }) {
  if (count <= 1) return null;
  return (
    <div style={{ display: 'flex', gap: 6, marginTop: sp[2] }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{
          width: i === active ? 16 : 6, height: 3, borderRadius: 2,
          background: i === active ? P.gold : P.hairStrong,
          transition: `all 400ms ${ease}`,
        }} />
      ))}
    </div>
  );
}

/**
 * Rotates between whichever shoutouts are actually live today — an auto
 * birthday entry (compute_daily_birthday_shoutout(), see
 * supabase/tv_shoutouts.sql) and/or a manual staff-typed recognition
 * (StepShoutout.jsx). Owns its own InstrumentDivider + padded slot (rather
 * than TvKiosk.jsx wrapping it) so it can render nothing at all — divider
 * included — when neither is present, same "omit rather than show empty"
 * convention as the rest of the instrument column.
 */
export default function TvShoutoutsPanel({ settings }) {
  const now = useNowTicker();
  const [i, setI] = useState(0);
  const timerRef = useRef(null);

  const entries = [];
  if (settings?.shoutout_bday_name && !isStale(settings.shoutout_bday_set_at, now, BDAY_STALE_HOURS * 3600000)) {
    entries.push({
      key: 'bday',
      tag: settings.shoutout_bday_tag || 'BIRTHDAY',
      name: settings.shoutout_bday_name,
      note: settings.shoutout_bday_note,
    });
  }
  if (settings?.shoutout_manual_name && !isStale(settings.shoutout_manual_set_at, now, MANUAL_STALE_DAYS * 86400000)) {
    entries.push({
      key: 'manual',
      tag: settings.shoutout_manual_tag || 'RECOGNITION',
      name: settings.shoutout_manual_name,
      note: settings.shoutout_manual_note,
    });
  }

  useEffect(() => {
    if (entries.length <= 1) return;
    timerRef.current = setTimeout(() => setI((n) => (n + 1) % entries.length), ROTATE_MS);
    return () => clearTimeout(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rotate on a fixed interval, entries.length is what actually matters
  }, [i, entries.length]);

  if (!entries.length) return null;
  const entry = entries[i % entries.length];

  return (
    <>
      <InstrumentDivider />
      <div style={{ flex: '0 0 auto', padding: `${sp[3]}px ${sp[5]}px`, position: 'relative' }}>
        <PanelStyles />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: sp[3] }}>
          <div style={{ width: 14, height: 2, background: P.gold }} />
          <div style={{ fontFamily: mono, fontSize: fs.micro, color: P.gold, letterSpacing: '0.28em' }}>
            SHOUTOUTS
          </div>
          <div style={{ flex: 1, height: 1, background: P.hair }} />
        </div>

        <div key={entry.key + i} className="tv-shout-body" style={{ display: 'flex', alignItems: 'center', gap: sp[3] }}>
          <span style={{
            fontFamily: mono, fontSize: fs.micro, color: P.ink, background: P.gold,
            padding: '3px 8px', borderRadius: radius.pill, letterSpacing: '0.1em', flexShrink: 0,
          }}>
            {entry.tag}
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: inter, fontSize: fs.base, color: P.cream, fontWeight: 600 }}>{entry.name}</div>
            {entry.note && (
              <div style={{ fontFamily: inter, fontSize: fs.xs, color: P.mute }}>{entry.note}</div>
            )}
          </div>
        </div>

        <RotationDots count={entries.length} active={i % entries.length} />
      </div>
    </>
  );
}
