import { useState } from 'react';
import { P, mono, oswald, inter, fs, sp, radius, shadow, ease } from '../theme';

// Stage 1 — the roster of account cards. Photo + name + rank title + rank stars,
// with a method footer (passkey/PIN glyphs, or an "awaiting setup" state when an
// account has neither yet). Click a card to authenticate as that account;
// "Other account" drops to the email/password form for first-time / unlisted
// sign-in. Email is never rendered here — the picker is name + face only.
export default function AccountGrid({ accounts, onSelect, onOther }) {
  if (accounts === null) {
    return <div style={{ textAlign: 'center', fontFamily: mono, fontSize: fs.micro, color: P.mute, letterSpacing: '0.3em', padding: sp[10] }}>LOADING ACCOUNTS…</div>;
  }

  return (
    <div>
      {accounts.length === 0 ? (
        <div style={{ textAlign: 'center', fontFamily: mono, fontSize: fs.tiny, color: P.mute, padding: sp[8] }}>
          No accounts configured. Use another account to sign in.
        </div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: sp[4] }}>
          {accounts.map((a, i) => <AccountCard key={a.email} a={a} index={i} onClick={() => onSelect(a)} />)}
        </div>
      )}
      <div style={{ textAlign: 'center', marginTop: sp[6] }}>
        <button onClick={onOther} style={{
          background: 'transparent', border: 'none', color: P.gold, cursor: 'pointer',
          fontFamily: mono, fontSize: fs.tiny, letterSpacing: '0.14em', padding: sp[2],
        }}>OTHER ACCOUNT →</button>
      </div>
      <style>{`@keyframes cardRise { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: none } }`}</style>
    </div>
  );
}

function AccountCard({ a, index, onClick }) {
  const [hover, setHover] = useState(false);
  const name = a.display_name || 'Unnamed';
  const initials = (a.display_name || '?').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const ring = hover ? P.gold : P.hairStrong;
  const hasMethod = a.has_pin || a.has_passkey;

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 184, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: sp[3],
        background: hover ? P.navy : P.deep,
        border: `1px solid ${hover ? P.gold : P.hairStrong}`,
        borderRadius: radius.lg, padding: `${sp[5]}px ${sp[4]}px ${sp[4]}px`, cursor: 'pointer',
        textAlign: 'center',
        boxShadow: hover ? `${shadow.glow}, ${shadow.lg}` : 'none',
        transform: hover ? 'translateY(-3px)' : 'none',
        transition: `all 0.16s ${ease}`,
        animation: `cardRise 0.5s ${ease} backwards`, animationDelay: `${index * 70}ms`,
      }}
    >
      <div style={{
        width: 112, height: 112, borderRadius: '50%', overflow: 'hidden',
        border: `2px solid ${ring}`, boxShadow: `inset 0 0 0 2px ${P.deep}`,
        background: P.navy, display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: `border-color 0.16s ${ease}`,
      }}>
        {a.photo_url
          ? <img src={a.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          : <span style={{ fontFamily: oswald, fontWeight: 600, fontSize: fs.xl, letterSpacing: '0.04em', color: P.gold }}>{initials}</span>}
      </div>

      <div style={{ fontFamily: oswald, fontWeight: 600, fontSize: fs.lg, letterSpacing: '0.015em', color: P.cream, lineHeight: 1.15 }}>{name}</div>

      {a.title && (
        <div style={{
          fontFamily: mono, fontSize: fs.micro, fontWeight: 500, letterSpacing: '0.15em',
          color: P.gold, textTransform: 'uppercase', lineHeight: 1.4,
          border: `1px solid ${P.hair}`, borderRadius: radius.sm, padding: '3px 7px',
          background: P.goldWash, maxWidth: '100%',
        }}>{a.title}</div>
      )}

      {/* rank stars — three gold pips under the position */}
      <div aria-hidden="true" style={{ display: 'flex', gap: 4, fontSize: fs.tiny, lineHeight: 1, color: P.gold, letterSpacing: '0.18em', textShadow: '0 0 6px rgba(201,169,97,0.35)' }}>★★★</div>

      {hasMethod ? (
        <div style={{ display: 'flex', gap: 5, minHeight: 14, alignItems: 'center' }}>
          {a.has_passkey && <Glyph title="Touch ID">☉</Glyph>}
          {a.has_pin && <Glyph title="PIN">••••</Glyph>}
        </div>
      ) : (
        <div title="No sign-in method yet" style={{ display: 'flex', gap: 6, minHeight: 14, alignItems: 'center' }}>
          <Pip /><Pip /><Pip />
          <span style={{ fontFamily: mono, fontSize: 8, letterSpacing: '0.14em', color: P.faint, marginLeft: 3 }}>SET UP</span>
        </div>
      )}
    </button>
  );
}

function Glyph({ children, title }) {
  return <span title={title} style={{ fontFamily: mono, fontSize: 9, color: P.gold, letterSpacing: '0.08em', opacity: 0.85 }}>{children}</span>;
}

function Pip() {
  return <span style={{ width: 5, height: 5, borderRadius: '50%', border: `1px solid ${P.hairStrong}`, opacity: 0.7 }} />;
}
