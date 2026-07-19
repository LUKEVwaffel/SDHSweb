import { useState } from 'react';
import { supabase as SB } from '../lib/supabaseClient';

const P = {
  gold: '#C9A961', goldBright: '#E8C77A', cream: '#F4ECD8',
  mute: 'rgba(244,236,216,0.6)', hairline: 'rgba(201,169,97,0.25)',
  deep: '#0A1628', green: '#27AE60', red: '#C0392B',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Public parent/cadet signup → feeds `email_subscribers` (source='signup').
// Honeypot field (`company_website`) catches naive bots without a CAPTCHA.
export default function NewsletterSignup() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [state, setState] = useState('idle'); // idle | ok | err
  const [msg, setMsg] = useState('');

  async function submit(e) {
    e.preventDefault();
    if (honeypot) return; // bot
    const clean = email.trim().toLowerCase();
    if (!EMAIL_RE.test(clean)) { setState('err'); setMsg('Enter a valid email.'); return; }
    const { error } = await SB.from('email_subscribers').insert({
      email: clean, name: name.trim() || null, source: 'signup',
    });
    if (error && error.code !== '23505') { setState('err'); setMsg('Could not subscribe. Try again.'); return; }
    setState('ok'); setMsg(error?.code === '23505' ? "You're already on the list." : 'Subscribed — thank you.');
    setEmail(''); setName('');
  }

  const inputStyle = {
    background: P.deep, border: `1px solid ${P.hairline}`, color: P.cream,
    fontFamily: 'Inter, sans-serif', fontSize: 13, padding: '9px 11px', outline: 'none',
    boxSizing: 'border-box', width: '100%',
  };

  return (
    <div style={{ maxWidth: 420 }}>
      <div style={{ color: P.gold, fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.32em', marginBottom: 12 }}>
        BATTALION UPDATES
      </div>
      <p style={{ color: P.mute, fontFamily: 'Inter, sans-serif', fontSize: 13, lineHeight: 1.6, margin: '0 0 14px' }}>
        Parents &amp; cadets — get event notices and announcements by email.
      </p>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <input aria-label="Name (optional)" placeholder="Name (optional)" value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
        <input aria-hidden="true" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)}
          name="company_website" style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <input type="email" aria-label="Email address" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
          <button type="submit" style={{
            background: P.gold, color: '#06101F', border: 'none', cursor: 'pointer',
            fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.15em',
            fontWeight: 600, padding: '0 16px', whiteSpace: 'nowrap',
          }}>SUBSCRIBE</button>
        </div>
        {state !== 'idle' && (
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: state === 'ok' ? P.green : P.red }}>{msg}</div>
        )}
      </form>
    </div>
  );
}
