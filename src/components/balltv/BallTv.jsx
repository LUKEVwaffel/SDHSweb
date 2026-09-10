import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase as SB } from '../../lib/supabaseClient';
import { P, mono, oswald, fraunces } from '../admin/theme.js';
import { useQrDataUrl } from '../raidertv/useQrDataUrl.js';
import { FALLBACK_MENU, ALLERGY_NOTE } from '../../lib/ballMenu.js';
import './balltv.css';

// /balltv — the hallway-TV promo loop for the Military Ball. Read-only, no
// remote, no controls: it opens ball_config + ball_gallery (both anon-readable,
// same as /ball) and runs an auto-advancing slideshow forever. A passer-by can
// act from any slide — the QR to /ball and the countdown are pinned rails that
// never leave the screen.
//
// Self-contained full-screen anon route (App.jsx bypass), same pattern as
// /raidertv, /tv and /tv/range.

const MS_DAY = 86400000;
const SLIDE_MS = 10000;       // hero / venue / details / dinner
const PHOTO_MS = 8000;        // past-ball gallery frames
const MAX_GALLERY_SLIDES = 6; // cap so the loop stays a reasonable length
const RELOAD_MS = 15 * 60 * 1000; // pick up config edits without a manual refresh

function parseDate(d) {
  return d ? new Date(`${d}T00:00:00`) : null;
}
function fmtFull(d) {
  return d ? d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : null;
}
function fmtShort(d) {
  return d ? d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : null;
}
function money(n) {
  return n == null ? null : `$${Number(n).toFixed(0)}`;
}

function useBallData() {
  const [state, setState] = useState({ config: undefined, gallery: [] });
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [{ data: cfg }, { data: photos }] = await Promise.all([
        SB.from('ball_config')
          .select('ball_date, event_time_text, venue_address, venue_phone, dinner_caterer, dinner_menu, price_cadet, price_couple, signup_deadline, dress_code_text')
          .maybeSingle(),
        SB.from('ball_gallery').select('photo_url, caption').order('sort_order', { ascending: true }),
      ]);
      if (!cancelled) setState({ config: cfg || null, gallery: photos || [] });
    };
    load();
    const id = setInterval(load, RELOAD_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, []);
  return state;
}

export default function BallTv() {
  const { config, gallery } = useBallData();

  const ballUrl = `${window.location.origin}/ball`;
  const qr = useQrDataUrl(ballUrl);

  const eventDate = parseDate(config?.ball_date);
  const deadlineDate = parseDate(config?.signup_deadline);
  const detailsReady = !!(config && config.ball_date && config.price_cadet != null);

  // "Closed" / days-left decided on the calendar day in the event's zone
  // (US Central) — matches /ball, the wizard and the server.
  const todayCentral = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
  const closed = config?.signup_deadline ? todayCentral > config.signup_deadline : false;
  const daysLeft = config?.signup_deadline
    ? Math.round((Date.parse(`${config.signup_deadline}T00:00:00`) - Date.parse(`${todayCentral}T00:00:00`)) / MS_DAY)
    : null;

  const mon = eventDate ? eventDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase() : '';
  const day = eventDate ? eventDate.getDate() : '';
  const yr = eventDate ? eventDate.getFullYear() : '';
  const weekday = eventDate ? eventDate.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase() : '';
  const timeText = config?.event_time_text || '';

  // ── Build the deck ───────────────────────────────────────────────────────
  const slides = useMemo(() => {
    const menu = Array.isArray(config?.dinner_menu) ? config.dinner_menu : [];
    const deck = [];

    deck.push({
      key: 'hero',
      ms: SLIDE_MS,
      render: () => (
        <>
          <div style={kicker}>Trojan Battalion · JROTC · Annual</div>
          <h1 style={heroTitle}>Military&nbsp;Ball</h1>
          {detailsReady ? (
            <div style={datePlate}>
              <div style={{ fontFamily: mono, fontSize: 'clamp(14px,1.5vw,22px)', color: P.gold, letterSpacing: '0.34em' }}>{mon}</div>
              <div style={{ fontFamily: oswald, fontWeight: 600, fontSize: 'clamp(6rem,16vw,13rem)', lineHeight: 0.85, color: P.cream, margin: '0.1em 0' }}>{day}</div>
              <div style={{ fontFamily: oswald, fontSize: 'clamp(20px,2.2vw,34px)', color: P.mute, letterSpacing: '0.14em' }}>{yr}</div>
              <div style={plateRule} />
              <div style={{ fontFamily: mono, fontSize: 'clamp(13px,1.4vw,20px)', color: P.cream, letterSpacing: '0.18em' }}>
                {weekday}{timeText ? ` · ${timeText}` : ''}
              </div>
            </div>
          ) : (
            <p style={leadText}>Date, pricing and the signup deadline are posted at the link below.</p>
          )}
        </>
      ),
    });

    if (detailsReady && config?.venue_address) {
      deck.push({
        key: 'venue',
        ms: SLIDE_MS,
        render: () => (
          <>
            <div style={eyebrow}>The Venue</div>
            <div style={{ fontFamily: oswald, fontWeight: 500, fontSize: 'clamp(2.4rem,6vw,5.5rem)', color: P.cream, lineHeight: 1.15, letterSpacing: '0.01em', maxWidth: '16ch' }}>
              {config.venue_address}
            </div>
            {config.venue_phone && (
              <div style={{ fontFamily: mono, fontSize: 'clamp(14px,1.6vw,24px)', color: P.mute, marginTop: '1.2em', letterSpacing: '0.1em' }}>
                {config.venue_phone}
              </div>
            )}
            {eventDate && (
              <div style={{ fontFamily: mono, fontSize: 'clamp(13px,1.4vw,20px)', color: P.gold, marginTop: '2em', letterSpacing: '0.14em' }}>
                {fmtFull(eventDate)}{timeText ? ` · ${timeText}` : ''}
              </div>
            )}
          </>
        ),
      });
    }

    if (detailsReady) {
      deck.push({
        key: 'details',
        ms: SLIDE_MS,
        render: () => (
          <>
            <div style={eyebrow}>The Details</div>
            <div style={detailGrid}>
              <TvCell label="When">{fmtFull(eventDate)}{timeText ? <span style={cellSub}>{timeText}</span> : null}</TvCell>
              <TvCell label="Dress">Formal<span style={cellSub}>Long formal dress, approved · black-and-white suit or Class A</span></TvCell>
              <TvCell label="Deadline">
                {fmtShort(deadlineDate) || 'TBA'}
                <span style={cellSub}>{closed ? 'Registration closed' : daysLeft != null && daysLeft >= 0 ? `${daysLeft} day${daysLeft === 1 ? '' : 's'} left` : 'Sign up before this date'}</span>
              </TvCell>
            </div>
            <div style={{ display: 'flex', gap: '1.2vw', marginTop: '2vh', flexWrap: 'wrap', justifyContent: 'center' }}>
              <TvStub price={money(config.price_cadet)} kind="Cadet" note="one cadet" year={yr} />
              {config.price_couple != null && <TvStub price={money(config.price_couple)} kind="Couple" note="cadet + one guest" year={yr} />}
            </div>
          </>
        ),
      });
    }

    if (detailsReady) {
      // Prefer staff-entered rows; otherwise fall back to the known menu so the
      // slide is never blank. Both render as titled sections.
      const sections = menu.length > 0
        ? [{ section: 'Menu', items: menu.map((m) => (m.note ? `${m.item} · ${m.note}` : m.item)) }]
        : FALLBACK_MENU;
      deck.push({
        key: 'dinner',
        ms: SLIDE_MS,
        render: () => (
          <>
            <div style={eyebrow}>Dinner{config?.dinner_caterer ? ' · Catered by' : ''}</div>
            {config?.dinner_caterer && (
              <div style={{ fontFamily: oswald, fontWeight: 500, fontSize: 'clamp(1.8rem,4vw,3.4rem)', color: P.cream, marginBottom: '0.6em' }}>
                {config.dinner_caterer}
              </div>
            )}
            <div style={{ display: 'flex', gap: '4vw', flexWrap: 'wrap', justifyContent: 'center', maxWidth: '78vw' }}>
              {sections.map((sec) => (
                <div key={sec.section} style={{ textAlign: 'left', minWidth: 'min(340px, 40vw)' }}>
                  <div style={{ fontFamily: mono, fontSize: 'clamp(11px,1.1vw,16px)', color: P.gold, letterSpacing: '0.24em', textTransform: 'uppercase', paddingBottom: '0.4em', borderBottom: `1px solid ${P.hairStrong}`, marginBottom: '0.2em' }}>
                    {sec.section}
                  </div>
                  {sec.items.map((it, i) => (
                    <div key={i} style={{ fontFamily: oswald, fontSize: 'clamp(15px,1.6vw,25px)', color: P.cream, padding: '0.3em 0', borderBottom: `1px solid ${P.hair}` }}>
                      {it}
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div style={{ fontFamily: mono, fontSize: 'clamp(11px,1.15vw,16px)', color: P.bright, letterSpacing: '0.06em', marginTop: '1.4vh', maxWidth: '52ch', lineHeight: 1.55 }}>
              {ALLERGY_NOTE}
            </div>
          </>
        ),
      });
    }

    gallery.slice(0, MAX_GALLERY_SLIDES).forEach((g, i) => {
      deck.push({
        key: `photo-${i}`,
        ms: PHOTO_MS,
        photo: true,
        render: () => (
          <>
            <img className="btv-photo" src={g.photo_url} alt="" />
            <div className="btv-photo-scrim" />
            <div style={photoCaption}>
              <div style={{ fontFamily: mono, fontSize: 'clamp(11px,1.1vw,16px)', color: P.gold, letterSpacing: '0.3em', marginBottom: '0.5em' }}>PAST BALLS</div>
              {g.caption && <div style={{ fontFamily: oswald, fontSize: 'clamp(20px,2.6vw,40px)', color: P.cream }}>{g.caption}</div>}
            </div>
          </>
        ),
      });
    });

    return deck;
  }, [config, gallery, detailsReady, eventDate, deadlineDate, mon, day, yr, weekday, timeText, closed, daysLeft]);

  // ── Advance ──────────────────────────────────────────────────────────────
  const [idx, setIdx] = useState(0);
  const idxRef = useRef(0);
  idxRef.current = idx;

  useEffect(() => {
    if (idx >= slides.length && slides.length > 0) setIdx(0);
  }, [slides.length, idx]);

  useEffect(() => {
    if (slides.length === 0) return undefined;
    const cur = slides[Math.min(idx, slides.length - 1)];
    const id = setTimeout(() => {
      setIdx((n) => (n + 1) % slides.length);
    }, cur?.ms || SLIDE_MS);
    return () => clearTimeout(id);
  }, [idx, slides]);

  const active = slides.length ? slides[Math.min(idx, slides.length - 1)] : null;

  const countdownLabel = closed
    ? 'Registration closed'
    : daysLeft === 0
      ? 'Last day to sign up'
      : daysLeft != null && daysLeft > 0
        ? `${daysLeft} day${daysLeft === 1 ? '' : 's'} left to sign up`
        : 'Sign up now';

  return (
    <div className="btv-root">
      <div className="btv-grid" />

      {/* progress ticks */}
      <div className="btv-ticks">
        {slides.map((s, i) => (
          <div key={s.key} className={`btv-tick${i === idx ? ' is-active' : ''}${i < idx ? ' is-done' : ''}`}>
            <span style={i === idx ? { animationDuration: `${(s.ms || SLIDE_MS)}ms` } : undefined} />
          </div>
        ))}
      </div>

      {/* brand lockup — always on */}
      <div style={brandLockup}>
        <span style={{ width: 10, height: 10, background: P.gold, display: 'inline-block' }} />
        Trojan Battalion
      </div>

      {/* countdown — always on */}
      <div style={{ ...countPill, borderColor: closed ? P.mute : P.gold, background: closed ? 'transparent' : P.goldWash }}>
        <span className={closed ? undefined : 'btv-pulse'} style={{ width: 9, height: 9, borderRadius: '50%', background: closed ? P.mute : P.gold }} />
        {countdownLabel}
      </div>

      {/* slide stage */}
      <div className="btv-stage">
        {active && (
          <div key={active.key} className={active.photo ? 'btv-photo-slide' : 'btv-slide'}>
            {active.render()}
          </div>
        )}
      </div>

      {/* action rail — QR + URL, always on */}
      <div style={actionRail}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4em' }}>
          <div style={{ fontFamily: mono, fontSize: 'clamp(12px,1.3vw,18px)', letterSpacing: '0.3em', color: P.gold }}>
            {closed ? 'MORE INFO' : 'SCAN TO SIGN UP'}
          </div>
          <div style={{ fontFamily: oswald, fontWeight: 600, fontSize: 'clamp(22px,3vw,48px)', color: P.cream, letterSpacing: '0.02em' }}>
            {window.location.host}/ball
          </div>
          <div style={{ fontFamily: mono, fontSize: 'clamp(11px,1.15vw,16px)', color: P.mute, letterSpacing: '0.08em' }}>
            School email · about 3 minutes
          </div>
        </div>
        {qr && (
          <div style={qrCard}>
            <img src={qr} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
          </div>
        )}
      </div>
    </div>
  );
}

// ── slide primitives ──────────────────────────────────────────────────────
function TvCell({ label, children }) {
  return (
    <div style={{ border: `1px solid ${P.hair}`, background: P.navy, padding: '1.4vw 1.6vw', minWidth: 'min(320px, 26vw)' }}>
      <div style={{ width: 28, height: 3, background: P.gold, marginBottom: '0.8em' }} />
      <div style={{ fontFamily: mono, fontSize: 'clamp(11px,1.1vw,16px)', color: P.gold, letterSpacing: '0.26em', marginBottom: '0.5em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontFamily: oswald, fontSize: 'clamp(16px,1.7vw,26px)', color: P.cream, lineHeight: 1.3 }}>{children}</div>
    </div>
  );
}

function TvStub({ price, kind, note, year }) {
  return (
    <div style={{ display: 'flex', border: `1px solid ${P.hairStrong}`, background: P.navy }}>
      <div style={{ padding: '1.2vw 1.8vw' }}>
        <div style={{ fontFamily: mono, fontSize: 'clamp(11px,1.1vw,16px)', color: P.gold, letterSpacing: '0.24em', marginBottom: '0.4em', textTransform: 'uppercase' }}>{kind}</div>
        <div style={{ fontFamily: oswald, fontWeight: 600, fontSize: 'clamp(2.4rem,4.6vw,4rem)', color: P.cream, lineHeight: 1 }}>{price}</div>
        <div style={{ fontFamily: mono, fontSize: 'clamp(11px,1.1vw,16px)', color: P.mute, marginTop: '0.4em' }}>{note}</div>
      </div>
      <div style={{ borderLeft: `1px dashed ${P.hairStrong}`, margin: '0.8vw 0' }} />
      <div style={{ width: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', writingMode: 'vertical-rl', fontFamily: mono, fontSize: 'clamp(8px,0.7vw,11px)', color: P.faint, letterSpacing: '0.3em' }}>
        BALL {year || new Date().getFullYear()}
      </div>
    </div>
  );
}

// ── styles ────────────────────────────────────────────────────────────────
const kicker = {
  fontFamily: mono, fontSize: 'clamp(12px,1.4vw,22px)', color: P.gold,
  letterSpacing: '0.34em', textTransform: 'uppercase', marginBottom: '0.8em',
};
const heroTitle = {
  fontFamily: fraunces, fontStyle: 'italic', fontWeight: 700,
  fontSize: 'clamp(3rem,9.5vw,9rem)', lineHeight: 0.9, color: P.cream,
  margin: 0, textTransform: 'uppercase', letterSpacing: '0.01em',
};
const datePlate = {
  marginTop: '4vh', border: `1px solid ${P.hairStrong}`, background: P.deep,
  padding: '3vh 4vw', display: 'flex', flexDirection: 'column', alignItems: 'center',
};
const plateRule = { width: '100%', height: 1, background: P.hairStrong, margin: '1em 0' };
const leadText = {
  fontFamily: 'Inter, sans-serif', fontSize: 'clamp(16px,2vw,30px)', color: P.mute,
  lineHeight: 1.6, maxWidth: '22ch', marginTop: '3vh',
};
const eyebrow = {
  fontFamily: mono, fontSize: 'clamp(12px,1.3vw,20px)', color: P.gold,
  letterSpacing: '0.34em', textTransform: 'uppercase', marginBottom: '1.2em',
};
const detailGrid = { display: 'flex', gap: '1.2vw', flexWrap: 'wrap', justifyContent: 'center' };
const cellSub = {
  display: 'block', fontFamily: mono, fontSize: 'clamp(11px,1.05vw,15px)',
  color: P.mute, marginTop: '0.5em', letterSpacing: '0.04em', textTransform: 'none', maxWidth: '24ch',
};
const brandLockup = {
  position: 'absolute', top: 30, left: 34, zIndex: 4,
  display: 'flex', alignItems: 'center', gap: 12,
  fontFamily: mono, fontSize: 'clamp(11px,1.15vw,17px)', color: P.cream,
  letterSpacing: '0.22em', textTransform: 'uppercase',
};
const countPill = {
  position: 'absolute', top: 26, right: 34, zIndex: 4,
  display: 'inline-flex', alignItems: 'center', gap: 12,
  border: `1px solid ${P.gold}`, padding: '0.7em 1.1em',
  fontFamily: mono, fontSize: 'clamp(11px,1.15vw,17px)', color: P.cream,
  letterSpacing: '0.14em', textTransform: 'uppercase',
};
const actionRail = {
  position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 4,
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  gap: '4vw', padding: '3vh 5vw', background: 'linear-gradient(180deg, transparent, rgba(6,16,31,0.9) 40%)',
};
const qrCard = {
  width: 'min(15vw, 200px)', aspectRatio: '1 / 1', background: P.cream,
  borderRadius: 12, overflow: 'hidden', flexShrink: 0,
  boxShadow: `0 18px 44px rgba(0,0,0,0.45), 0 0 0 1px ${P.hairStrong}`,
};
const photoCaption = {
  position: 'absolute', left: '5vw', bottom: '22vh', textAlign: 'left', maxWidth: '60vw',
};
