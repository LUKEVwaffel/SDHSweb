import { useState } from 'react';
import { P, mono, oswald, fs, sp, radius, shadow, ease } from '../theme';

// Stage 1, the roster of account cards. Photo or initials, name, position, and
// a sign-in-method row (Touch ID / PIN chips, or an "awaiting setup" state when
// an account has neither yet). Click a card to authenticate as that account.
// "Other account" drops to the email/password form for first-time or unlisted
// sign-in. Email is never rendered here, the picker is name and face only.
export default function AccountGrid({ accounts, onSelect, onOther }) {
  if (accounts === null) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: sp[4], padding: sp[12] }}>
        <div style={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid ${P.hair}`, borderTopColor: P.gold, animation: 'spin 0.8s linear infinite' }} />
        <div style={{ fontFamily: mono, fontSize: fs.micro, color: P.mute, letterSpacing: '0.32em' }}>LOADING ACCOUNTS</div>
        <style>{'@keyframes spin { to { transform: rotate(360deg) } }'}</style>
      </div>
    );
  }

  const empty = accounts.length === 0;

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: sp[3], justifyContent: 'center',
        fontFamily: mono, fontSize: fs.micro, color: P.faint, letterSpacing: '0.3em', marginBottom: sp[6],
      }}>
        <Rule /> {empty ? 'NO ACCOUNTS' : 'SELECT YOUR ACCOUNT'} <Rule />
      </div>

      {empty ? (
        <div style={{
          textAlign: 'center', fontFamily: mono, fontSize: fs.tiny, color: P.mute, lineHeight: 1.7,
          border: `1px dashed ${P.hairStrong}`, borderRadius: radius.md, padding: sp[8], background: P.goldWash,
        }}>
          No accounts configured yet.<br />Use another account to sign in.
        </div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: sp[4] }}>
          {accounts.map((a, i) => <AccountCard key={a.email} a={a} index={i} onClick={() => onSelect(a)} />)}
        </div>
      )}

      <div style={{ textAlign: 'center', marginTop: sp[8] }}>
        <button onClick={onOther} style={{
          background: 'transparent', border: `1px solid ${P.hairStrong}`, color: P.gold, cursor: 'pointer',
          fontFamily: mono, fontSize: fs.micro, letterSpacing: '0.2em', padding: `${sp[2]}px ${sp[5]}px`,
          borderRadius: radius.pill, transition: `background 0.16s ${ease}, border-color 0.16s ${ease}`,
        }}
          onMouseEnter={(e) => { e.currentTarget.style.background = P.goldWash; e.currentTarget.style.borderColor = P.gold; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = P.hairStrong; }}
        >OTHER ACCOUNT &nbsp;&rarr;</button>
      </div>

      <style>{'@keyframes cardRise { from { opacity: 0; transform: translateY(12px) } to { opacity: 1; transform: none } }'}</style>
    </div>
  );
}

function Rule() {
  return <span aria-hidden="true" style={{ width: 28, height: 1, background: `linear-gradient(90deg, transparent, ${P.hairStrong})` }} />;
}

function AccountCard({ a, index, onClick }) {
  const [hover, setHover] = useState(false);
  const name = a.display_name || 'Unnamed';
  const initials = (a.display_name || '?').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const hasMethod = a.has_pin || a.has_passkey;

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative', width: 196, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: sp[3],
        background: hover
          ? `linear-gradient(180deg, ${P.navyLift} 0%, ${P.navy} 100%)`
          : `linear-gradient(180deg, ${P.navy} 0%, ${P.deep} 100%)`,
        border: `1px solid ${hover ? P.gold : P.hairStrong}`,
        borderRadius: radius.lg, padding: `${sp[6]}px ${sp[4]}px ${sp[5]}px`, cursor: 'pointer', textAlign: 'center',
        boxShadow: hover ? `${shadow.glow}, ${shadow.lg}` : shadow.sm,
        transform: hover ? 'translateY(-4px)' : 'none',
        transition: `transform 0.18s ${ease}, box-shadow 0.18s ${ease}, border-color 0.18s ${ease}, background 0.18s ${ease}`,
        animation: `cardRise 0.5s ${ease} backwards`, animationDelay: `${index * 65}ms`,
        overflow: 'hidden',
      }}
    >
      {/* top accent bar */}
      <span aria-hidden="true" style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
        background: `linear-gradient(90deg, transparent, ${hover ? P.bright : P.gold}, transparent)`,
        opacity: hover ? 1 : 0.5, transition: `opacity 0.18s ${ease}`,
      }} />

      <div style={{
        width: 116, height: 116, borderRadius: '50%', padding: 3,
        background: hover
          ? `conic-gradient(from 140deg, ${P.gold}, ${P.bright}, ${P.gold})`
          : `linear-gradient(160deg, ${P.hairStrong}, ${P.hair})`,
        transition: `background 0.18s ${ease}`,
      }}>
        <div style={{
          width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden',
          background: P.deep, display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `inset 0 2px 10px rgba(0,0,0,0.45)`,
        }}>
          {a.photo_url
            ? <img src={a.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            : <span style={{ fontFamily: oswald, fontWeight: 600, fontSize: fs.xxl, letterSpacing: '0.04em', color: P.gold }}>{initials}</span>}
        </div>
      </div>

      <div style={{ fontFamily: oswald, fontWeight: 600, fontSize: fs.lg, letterSpacing: '0.015em', color: P.cream, lineHeight: 1.15 }}>{name}</div>

      {a.title && (
        <div style={{
          fontFamily: mono, fontSize: fs.micro, fontWeight: 500, letterSpacing: '0.14em',
          color: hover ? P.bright : P.gold, textTransform: 'uppercase', lineHeight: 1.4,
          border: `1px solid ${P.hair}`, borderRadius: radius.pill, padding: '3px 10px',
          background: P.goldWash, maxWidth: '100%', transition: `color 0.18s ${ease}`,
        }}>{a.title}</div>
      )}

      <span aria-hidden="true" style={{ width: 40, height: 1, background: P.hair, margin: `${sp[1]}px 0` }} />

      {hasMethod ? (
        <div style={{ display: 'flex', gap: sp[2], minHeight: 18, alignItems: 'center' }}>
          {a.has_passkey && <MethodChip>TOUCH ID</MethodChip>}
          {a.has_pin && <MethodChip>PIN</MethodChip>}
        </div>
      ) : (
        <div title="No sign-in method set yet" style={{
          display: 'flex', gap: 6, minHeight: 18, alignItems: 'center',
          fontFamily: mono, fontSize: 8, letterSpacing: '0.16em', color: P.faint,
        }}>
          <Pip /><Pip /><Pip /><span style={{ marginLeft: 3 }}>SET UP ON SIGN-IN</span>
        </div>
      )}
    </button>
  );
}

function MethodChip({ children }) {
  return (
    <span style={{
      fontFamily: mono, fontSize: 8, fontWeight: 600, letterSpacing: '0.16em', color: P.gold,
      border: `1px solid ${P.hairStrong}`, borderRadius: radius.sm, padding: '3px 6px', lineHeight: 1,
      background: 'rgba(201,169,97,0.06)',
    }}>{children}</span>
  );
}

function Pip() {
  return <span style={{ width: 5, height: 5, borderRadius: '50%', border: `1px solid ${P.hairStrong}`, opacity: 0.7 }} />;
}
