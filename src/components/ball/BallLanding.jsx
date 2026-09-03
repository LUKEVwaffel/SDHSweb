import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase as SB } from '../../lib/supabaseClient';
import { P, mono, oswald } from '../admin/theme';
import './ball.css';
import { FadeUp, Skeleton } from './ballUi';

// Step 0 — public landing. Ceremonial / editorial treatment: a date monolith,
// an engraved invitation frame, a detail grid, and perforated price stubs —
// not a flat label/value list. Reads ball_config directly (anon-readable).
// Navy/gold/cream, sharp edges. "Details coming soon" only while the core
// facts (date + per-cadet price) are still blank.

const MS_DAY = 86400000;

function parseDate(d) {
  return d ? new Date(`${d}T00:00:00`) : null;
}
function fmtFull(d) {
  return d ? d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : null;
}
function fmtShort(d) {
  return d ? d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) : null;
}
function money(n) {
  return n == null ? null : `$${Number(n).toFixed(0)}`;
}

export default function BallLanding() {
  const navigate = useNavigate();
  const [config, setConfig] = useState(undefined);
  const [gallery, setGallery] = useState([]);

  useEffect(() => {
    (async () => {
      const [{ data: cfg }, { data: photos }] = await Promise.all([
        SB.from('ball_config')
          .select('ball_date, event_time_text, venue_address, venue_phone, dinner_caterer, dinner_menu, price_cadet, price_couple, signup_deadline, dress_code_text')
          .maybeSingle(),
        SB.from('ball_gallery').select('photo_url, caption').order('sort_order', { ascending: true }),
      ]);
      setConfig(cfg || null);
      setGallery(photos || []);
    })();
  }, []);

  const detailsReady = config && config.ball_date && config.price_cadet != null;
  const menu = Array.isArray(config?.dinner_menu) ? config.dinner_menu : [];
  const eventDate = parseDate(config?.ball_date);
  const deadlineDate = parseDate(config?.signup_deadline);
  const daysLeft = deadlineDate ? Math.ceil((deadlineDate.getTime() - Date.now()) / MS_DAY) : null;
  const closed = daysLeft != null && daysLeft < 0;

  const mon = eventDate ? eventDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase() : '';
  const day = eventDate ? eventDate.getDate() : '';
  const yr = eventDate ? eventDate.getFullYear() : '';
  const weekday = eventDate ? eventDate.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase() : '';

  return (
    <div className="ball-root">
      <div style={{ maxWidth: 940, margin: '0 auto', padding: '64px 24px 110px' }}>
        <FadeUp style={{ fontFamily: mono, fontSize: 11, color: P.gold, letterSpacing: '0.34em', marginBottom: 18 }}>
          TROJAN BATTALION · JROTC · ANNUAL
        </FadeUp>

        {config === undefined ? (
          <FadeUp delay={1}>
            <Skeleton width={360} height={64} style={{ marginBottom: 24 }} />
            <Skeleton width="100%" height={180} />
          </FadeUp>
        ) : !detailsReady ? (
          <FadeUp delay={1}>
            <h1 style={hero}>Military&nbsp;Ball</h1>
            <div style={{ ...rule, margin: '20px 0 0' }} />
            <p style={{ fontFamily: mono, fontSize: 13, color: P.mute, marginTop: 28, maxWidth: 460, lineHeight: 1.7 }}>
              Date, pricing, and the signup deadline will be posted here soon.
            </p>
          </FadeUp>
        ) : (
          <>
            {/* HERO — headline + date monolith */}
            <div className="ball-hero-grid">
              <FadeUp delay={1}>
                <h1 style={hero}>Military&nbsp;Ball</h1>
                <div style={{ ...rule, margin: '18px 0 22px' }} />
                <p style={lede}>
                  One formal evening of dinner, tradition, and the whole battalion in its best. Cadets and their guests welcome.
                </p>
                <div style={{ ...deadlinePill, borderColor: closed ? P.mute : P.gold, background: closed ? 'transparent' : P.goldWash }}>
                  <span className="ball-dot" style={{ background: closed ? P.mute : P.gold }} />
                  {closed
                    ? <span>REGISTRATION CLOSED</span>
                    : <span>REGISTRATION CLOSES {fmtShort(deadlineDate)}{daysLeft != null && daysLeft <= 45 ? ` · ${daysLeft} DAY${daysLeft === 1 ? '' : 'S'} LEFT` : ''}</span>}
                </div>
              </FadeUp>

              <FadeUp delay={2} className="ball-date-plate" style={datePlate}>
                <div style={{ fontFamily: mono, fontSize: 12, color: P.gold, letterSpacing: '0.34em' }}>{mon}</div>
                <div style={{ fontFamily: oswald, fontWeight: 600, fontSize: 'clamp(4.5rem, 13vw, 7.5rem)', lineHeight: 0.9, color: P.cream, margin: '4px 0' }}>
                  {day}
                </div>
                <div style={{ fontFamily: oswald, fontSize: 20, color: P.mute, letterSpacing: '0.12em' }}>{yr}</div>
                <div style={{ height: 1, background: P.hairStrong, margin: '14px 0' }} />
                <div style={{ fontFamily: mono, fontSize: 11, color: P.cream, letterSpacing: '0.14em' }}>
                  {weekday}{config.event_time_text ? ` · ${config.event_time_text}` : ''}
                </div>
              </FadeUp>
            </div>

            {/* INVITATION FRAME — venue */}
            {config.venue_address && (
              <FadeUp delay={3} style={{ position: 'relative', border: `1px solid ${P.hairStrong}`, background: P.navy, padding: '40px 28px', marginTop: 30, textAlign: 'center' }}>
                <Corners />
                <div style={{ fontFamily: mono, fontSize: 10, color: P.gold, letterSpacing: '0.34em', marginBottom: 14 }}>THE VENUE</div>
                <div style={{ fontFamily: oswald, fontWeight: 500, fontSize: 'clamp(1.3rem, 3.4vw, 1.85rem)', color: P.cream, letterSpacing: '0.02em', lineHeight: 1.3 }}>
                  {config.venue_address}
                </div>
                {config.venue_phone && (
                  <div style={{ fontFamily: mono, fontSize: 12, color: P.mute, marginTop: 10, letterSpacing: '0.08em' }}>{config.venue_phone}</div>
                )}
              </FadeUp>
            )}

            {/* DETAIL GRID */}
            <FadeUp delay={3} style={grid3}>
              <Cell label="WHEN">
                {fmtFull(eventDate)}
                {config.event_time_text && <span style={cellSub}>{config.event_time_text}</span>}
              </Cell>
              <Cell label="DRESS">
                {config.dress_code_text
                  ? <span style={{ fontSize: 13, lineHeight: 1.5 }}>{config.dress_code_text}</span>
                  : <>Cadets: full Class A<span style={cellSub}>Guests: formal (dress, or suit &amp; tie)</span></>}
              </Cell>
              <Cell label="DEADLINE">
                {fmtShort(deadlineDate)}
                <span style={cellSub}>Sign up before this date</span>
              </Cell>
            </FadeUp>

            {/* PRICING — perforated stubs */}
            <FadeUp delay={4} style={{ display: 'flex', gap: 14, marginTop: 14, flexWrap: 'wrap' }}>
              <Stub price={money(config.price_cadet)} kind="CADET" note="one cadet" />
              {config.price_couple != null && <Stub price={money(config.price_couple)} kind="COUPLE" note="cadet + one guest" />}
            </FadeUp>

            {/* DINNER */}
            <FadeUp delay={4} style={{ border: `1px solid ${P.hair}`, background: P.navy, padding: '24px 28px', marginTop: 14 }}>
              <div style={{ fontFamily: mono, fontSize: 10, color: P.gold, letterSpacing: '0.34em', marginBottom: 8 }}>DINNER · CATERED BY</div>
              <div style={{ fontFamily: oswald, fontWeight: 500, fontSize: 24, color: P.cream, marginBottom: menu.length ? 16 : 6 }}>
                {config.dinner_caterer || 'Caterer TBA'}
              </div>
              {menu.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '2px 24px' }}>
                  {menu.map((m, i) => (
                    <div key={i} style={{ fontFamily: mono, fontSize: 13, color: P.cream, padding: '7px 0', borderBottom: `1px solid ${P.hair}` }}>
                      {m.item}{m.note && <span style={{ color: P.mute }}> · {m.note}</span>}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontFamily: mono, fontSize: 12, color: P.mute }}>Full menu announced soon.</div>
              )}
            </FadeUp>

            {/* CTA */}
            <FadeUp delay={5} style={{ marginTop: 34, display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
              <button className="ball-cta" disabled={closed} onClick={() => navigate('/ball/signup')}>
                {closed ? 'SIGNUP CLOSED' : 'START SIGNUP →'}
              </button>
              {!closed && (
                <span style={{ fontFamily: mono, fontSize: 11, color: P.mute, letterSpacing: '0.08em' }}>
                  School email only · about 3 minutes · read each step before submitting
                </span>
              )}
            </FadeUp>
          </>
        )}

        {gallery.length > 0 && (
          <FadeUp delay={5} style={{ marginTop: 72 }}>
            <div style={{ fontFamily: mono, fontSize: 10, color: P.gold, letterSpacing: '0.34em', marginBottom: 16 }}>PAST BALLS</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 10 }}>
              {gallery.map((g, i) => (
                <div key={i} className="ball-gallery-cell" style={{ border: `1px solid ${P.hair}`, aspectRatio: '4/3', overflow: 'hidden', background: P.navy }}>
                  <img src={g.photo_url} alt={g.caption || ''} className="ball-gallery-img" />
                </div>
              ))}
            </div>
          </FadeUp>
        )}
      </div>
    </div>
  );
}

const hero = {
  fontFamily: oswald, fontSize: 'clamp(2.4rem, 6vw, 4rem)', fontWeight: 600,
  letterSpacing: '0.02em', margin: 0, lineHeight: 1, color: P.cream, textTransform: 'uppercase',
};
const rule = { width: 72, height: 3, background: P.gold };
const lede = { fontFamily: 'Inter, sans-serif', fontSize: 15, color: P.mute, lineHeight: 1.65, maxWidth: 420, margin: '0 0 22px' };
const datePlate = {
  border: `1px solid ${P.hairStrong}`, background: P.deep, padding: '22px 30px', textAlign: 'center', minWidth: 168,
};
const deadlinePill = {
  display: 'inline-flex', alignItems: 'center', gap: 10, border: `1px solid ${P.gold}`,
  padding: '9px 14px', fontFamily: mono, fontSize: 11, color: P.cream, letterSpacing: '0.12em',
};
const grid3 = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginTop: 14 };
const cellSub = { display: 'block', fontFamily: mono, fontSize: 11, color: P.mute, marginTop: 6, letterSpacing: '0.04em', textTransform: 'none' };

function Cell({ label, children }) {
  return (
    <div style={{ border: `1px solid ${P.hair}`, background: P.navy, padding: '18px 20px' }}>
      <div style={{ width: 24, height: 2, background: P.gold, marginBottom: 12 }} />
      <div style={{ fontFamily: mono, fontSize: 10, color: P.gold, letterSpacing: '0.24em', marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: oswald, fontSize: 15, color: P.cream, letterSpacing: '0.02em', lineHeight: 1.35 }}>{children}</div>
    </div>
  );
}

function Stub({ price, kind, note }) {
  return (
    <div style={{ flex: '1 1 200px', display: 'flex', border: `1px solid ${P.hairStrong}`, background: P.navy }}>
      <div style={{ padding: '18px 22px', flex: 1 }}>
        <div style={{ fontFamily: mono, fontSize: 10, color: P.gold, letterSpacing: '0.24em', marginBottom: 6 }}>{kind}</div>
        <div style={{ fontFamily: oswald, fontWeight: 600, fontSize: 34, color: P.cream, lineHeight: 1 }}>{price}</div>
        <div style={{ fontFamily: mono, fontSize: 11, color: P.mute, marginTop: 6 }}>{note}</div>
      </div>
      <div style={{ width: 0, borderLeft: `1px dashed ${P.hairStrong}`, margin: '10px 0' }} />
      <div style={{ width: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', writingMode: 'vertical-rl', fontFamily: mono, fontSize: 8, color: P.faint, letterSpacing: '0.3em' }}>
        BALL 2026
      </div>
    </div>
  );
}

function Corners() {
  const s = 12;
  const base = { position: 'absolute', width: s, height: s, borderColor: P.gold };
  return (
    <>
      <span style={{ ...base, top: -1, left: -1, borderTop: `2px solid ${P.gold}`, borderLeft: `2px solid ${P.gold}` }} />
      <span style={{ ...base, top: -1, right: -1, borderTop: `2px solid ${P.gold}`, borderRight: `2px solid ${P.gold}` }} />
      <span style={{ ...base, bottom: -1, left: -1, borderBottom: `2px solid ${P.gold}`, borderLeft: `2px solid ${P.gold}` }} />
      <span style={{ ...base, bottom: -1, right: -1, borderBottom: `2px solid ${P.gold}`, borderRight: `2px solid ${P.gold}` }} />
    </>
  );
}
