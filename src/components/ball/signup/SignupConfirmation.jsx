import { useEffect, useState } from 'react';
import { P, mono } from '../../admin/theme';
import '../ball.css';

// Locked confirmation screen — nothing can be edited after submit. `result`
// is the ball-submit-signup response (host amount_due, whether a field trip
// form is required, and — for a friend guest — the friend's own share).
function money(n) {
  return n == null ? null : `$${Number(n).toFixed(Number.isInteger(Number(n)) ? 0 : 2)}`;
}

const REDIRECT_SECONDS = 12;

export default function SignupConfirmation({ cadetName, hasGuest, guestName, guestType, notificationEmail, result }) {
  const formRequired = result ? result.field_trip_form_required !== false : true;
  const amount = money(result?.amount_due);
  const isFriend = (guestType || result?.guest_type) === 'friend';
  const friendAmount = money(result?.friend_amount_due);
  const friendMethod = result?.friend_payment_method;

  const [count, setCount] = useState(REDIRECT_SECONDS);
  useEffect(() => {
    const tick = setInterval(() => setCount((c) => c - 1), 1000);
    const go = setTimeout(() => { window.location.href = '/'; }, REDIRECT_SECONDS * 1000);
    return () => { clearInterval(tick); clearTimeout(go); };
  }, []);

  return (
    <div style={{ border: `1px solid ${P.gold}`, background: P.navy, padding: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <svg className="ball-check" width="30" height="30" viewBox="0 0 60 60" fill="none" aria-hidden="true">
          <circle cx="30" cy="30" r="26" stroke={P.gold} strokeWidth="3" />
          <path d="M18 31l9 9 16-19" stroke={P.gold} strokeWidth="4" strokeLinecap="square" strokeLinejoin="miter" />
        </svg>
        <div style={{ fontFamily: mono, fontSize: 12, color: P.gold, letterSpacing: '0.14em' }}>SIGNUP SUBMITTED</div>
      </div>

      <p className="ball-fade-up ball-d1" style={para}>
        Thanks, {cadetName}. Your Military Ball signup is in.{' '}
        {notificationEmail
          ? `A confirmation email is on its way to ${notificationEmail}.`
          : 'No email was given, so watch for word from 1SG Kaz or Chief.'}
      </p>
      <p className="ball-fade-up ball-d1" style={para}>
        {hasGuest
          ? `Your guest, ${guestName || 'your guest'}, will get their own email to finish their part. You're not fully verified until they do — you'll get another email once they're confirmed.`
          : "You're not bringing a guest, so nothing else is pending on that front — you're fully verified."}
      </p>
      <p className="ball-fade-up ball-d2" style={para}>
        Next: bring {formRequired ? 'your signed field trip form and ' : ''}your payment{amount ? ` of ${amount}` : ''} (cash or check, in full) directly to 1SG Kaz or Chief.
      </p>
      {isFriend && (
        <p className="ball-fade-up ball-d2" style={para}>
          {guestName || 'Your friend'} owes their own {friendAmount || 'ticket'},{' '}
          {friendMethod === 'host_delivers' ? "which you'll bring in with yours" : 'which they will pay or deliver themselves'} — separate from your total.
        </p>
      )}
      {notificationEmail && (
        <p className="ball-fade-up ball-d3" style={para}>
          We'll email {notificationEmail} again{hasGuest ? ' when your guest verifies, and' : ''} when your cash{formRequired ? ' and field trip form are' : ' is'} marked received.
        </p>
      )}

      <div className="ball-fade-up ball-d3" style={{ marginTop: 22, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <a
          href="/"
          style={{ fontFamily: mono, fontSize: 12, letterSpacing: '0.08em', color: P.gold, border: `1px solid ${P.gold}`, padding: '9px 16px', textDecoration: 'none' }}
        >
          RETURN TO HOME →
        </a>
        <span style={{ fontFamily: mono, fontSize: 11, color: P.mute }}>
          Taking you back in {count > 0 ? count : 0}s…
        </span>
      </div>
    </div>
  );
}

const para = { fontFamily: mono, fontSize: 13, color: P.mute, lineHeight: 1.7 };
