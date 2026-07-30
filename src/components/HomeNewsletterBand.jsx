import { useState } from 'react';
import { supabase as SB } from '../lib/supabaseClient';

const P = {
  ink: '#06101F', navy: '#142847', deep: '#0A1628',
  gold: '#C9A961', bright: '#E8C77A', cream: '#F4ECD8',
  mute: 'rgba(244,236,216,0.6)', faint: 'rgba(244,236,216,0.4)',
  hairline: 'rgba(201,169,97,0.25)', green: '#27AE60', red: '#C0392B',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Home-page battalion-updates band. Relocated out of the footer (too cramped,
// low visibility). Sits after the calendar so parents/cadets hit it right where
// intent is highest. Feeds `email_subscribers` (source='signup'); honeypot
// (`company_website`) filters naive bots without a CAPTCHA.
export default function HomeNewsletterBand() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [state, setState] = useState('idle'); // idle | busy | ok | err
  const [msg, setMsg] = useState('');
  const [focused, setFocused] = useState(null);

  async function submit(e) {
    e.preventDefault();
    if (honeypot) return; // bot
    const clean = email.trim().toLowerCase();
    if (!EMAIL_RE.test(clean)) { setState('err'); setMsg('Enter a valid email address.'); return; }
    setState('busy'); setMsg('');
    const { error } = await SB.from('email_subscribers').insert({
      email: clean, name: name.trim() || null, source: 'signup',
    });
    if (error && error.code !== '23505') { setState('err'); setMsg('Could not subscribe — please try again.'); return; }
    setState('ok');
    setMsg(error?.code === '23505' ? "You're already on the roster — welcome back." : 'Subscribed. Watch your inbox for battalion updates.');
    setEmail(''); setName('');
  }

  const done = state === 'ok';

  const fieldStyle = (key) => ({
    background: P.ink, border: `1px solid ${focused === key ? P.gold : P.hairline}`,
    color: P.cream, fontFamily: 'Inter, sans-serif', fontSize: 15,
    padding: '14px 16px', outline: 'none', boxSizing: 'border-box', width: '100%',
    transition: 'border-color 0.15s, box-shadow 0.15s',
    boxShadow: focused === key ? `0 0 0 3px rgba(201,169,97,0.15)` : 'none',
  });

  return (
    <section className="nl-section" style={{
      background: `linear-gradient(160deg, ${P.navy} 0%, ${P.deep} 60%, ${P.ink} 100%)`,
      padding: '72px 32px', borderBottom: `1px solid ${P.hairline}`,
      position: 'relative', overflow: 'hidden',
    }}>
      {/* faint chevron atmosphere */}
      <div aria-hidden="true" style={{
        position: 'absolute', inset: 0, opacity: 0.04, pointerEvents: 'none',
        backgroundImage: `repeating-linear-gradient(135deg, ${P.gold} 0 2px, transparent 2px 22px)`,
      }} />

      <div style={{
        maxWidth: 1400, margin: '0 auto', position: 'relative',
        display: 'grid', gridTemplateColumns: 'minmax(0,1.1fr) minmax(0,0.9fr)',
        gap: 56, alignItems: 'center',
      }} className="nl-grid">
        {/* pitch */}
        <div>
          <div style={{
            color: P.gold, opacity: 0.75, fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10, letterSpacing: '0.32em', marginBottom: 14,
          }}>// S-6 NET CONTROL · BATTALION UPDATES</div>
          <h2 style={{
            color: P.cream, fontFamily: 'Oswald, sans-serif', fontWeight: 700,
            fontSize: 'clamp(34px, 5vw, 52px)', letterSpacing: '0.03em',
            lineHeight: 0.98, margin: '0 0 18px',
          }}>STAY IN<br />FORMATION</h2>
          <p style={{
            color: P.mute, fontFamily: 'Inter, sans-serif', fontSize: 16,
            lineHeight: 1.7, maxWidth: 460, margin: 0,
          }}>
            Parents and cadets — get event notices, competition results, and
            battalion announcements delivered straight to your inbox. No spam,
            just the signal.
          </p>
          <div style={{
            display: 'flex', gap: 20, marginTop: 26, flexWrap: 'wrap',
            fontFamily: "'JetBrains Mono', monospace", fontSize: 9,
            letterSpacing: '0.16em', color: P.faint,
          }}>
            <span>◦ EVENT REMINDERS</span>
            <span>◦ COMPETITION RESULTS</span>
            <span>◦ UNIT ANNOUNCEMENTS</span>
          </div>
        </div>

        {/* form card */}
        <div style={{
          background: 'rgba(10,22,40,0.72)', border: `1px solid ${P.hairline}`,
          padding: 28,
          boxShadow: '0 20px 50px rgba(0,0,0,0.35)',
        }}>
          {done ? (
            <div style={{ textAlign: 'center', padding: '24px 8px' }}>
              <div style={{
                fontFamily: 'Oswald, sans-serif', fontSize: 40, color: P.green, lineHeight: 1,
              }}>✓</div>
              <div style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: P.green,
                letterSpacing: '0.18em', margin: '14px 0 8px',
              }}>SUBSCRIBED</div>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: P.mute, lineHeight: 1.6, margin: 0 }}>{msg}</p>
            </div>
          ) : (
            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label htmlFor="nl-name" style={{
                  display: 'block', fontFamily: "'JetBrains Mono', monospace", fontSize: 9,
                  color: P.gold, letterSpacing: '0.2em', marginBottom: 7,
                }}>NAME · OPTIONAL</label>
                <input id="nl-name" value={name} onChange={(e) => setName(e.target.value)}
                  onFocus={() => setFocused('name')} onBlur={() => setFocused(null)}
                  placeholder="Cadet or parent name" style={fieldStyle('name')} />
              </div>

              <input aria-hidden="true" tabIndex={-1} autoComplete="off" value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)} name="company_website"
                style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }} />

              <div>
                <label htmlFor="nl-email" style={{
                  display: 'block', fontFamily: "'JetBrains Mono', monospace", fontSize: 9,
                  color: P.gold, letterSpacing: '0.2em', marginBottom: 7,
                }}>EMAIL ADDRESS</label>
                <input id="nl-email" type="email" value={email}
                  onChange={(e) => { setEmail(e.target.value); if (state === 'err') { setState('idle'); setMsg(''); } }}
                  onFocus={() => setFocused('email')} onBlur={() => setFocused(null)}
                  placeholder="you@example.com" style={fieldStyle('email')} />
              </div>

              <button type="submit" disabled={state === 'busy'} style={{
                background: state === 'busy' ? P.hairline : P.gold, color: P.ink, border: 'none',
                cursor: state === 'busy' ? 'wait' : 'pointer',
                fontFamily: "'JetBrains Mono', monospace", fontSize: 12, letterSpacing: '0.18em',
                fontWeight: 700, padding: '15px', marginTop: 4, transition: 'background 0.15s, transform 0.1s',
              }}
                onMouseDown={(e) => { e.currentTarget.style.transform = 'translateY(1px)'; }}
                onMouseUp={(e) => { e.currentTarget.style.transform = 'none'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; }}
              >{state === 'busy' ? 'SUBSCRIBING…' : 'SUBSCRIBE →'}</button>

              {state === 'err' && (
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: P.red, letterSpacing: '0.05em' }}>{msg}</div>
              )}
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: P.faint, lineHeight: 1.5, margin: '2px 0 0' }}>
                We use your email only for battalion updates. Unsubscribe anytime.
              </p>
            </form>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 760px) { .nl-grid { grid-template-columns: 1fr !important; gap: 36px !important; } }
        @media (max-width: 767px) { .nl-section { padding: 32px 20px !important; } }
      `}</style>
    </section>
  );
}
