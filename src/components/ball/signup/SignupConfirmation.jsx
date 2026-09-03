import { P, mono } from '../../admin/theme';
import '../ball.css';

// Locked confirmation screen — nothing can be edited after submit. `result`
// is the ball-submit-signup response (host amount_due, whether a field trip
// form is required, and — for a friend guest — the friend's own share).
function money(n) {
  return n == null ? null : `$${Number(n).toFixed(Number.isInteger(Number(n)) ? 0 : 2)}`;
}

export default function SignupConfirmation({ cadetName, hasGuest, guestName, guestType, notificationEmail, result }) {
  const formRequired = result ? result.field_trip_form_required !== false : true;
  const amount = money(result?.amount_due);
  const isFriend = (guestType || result?.guest_type) === 'friend';
  const friendAmount = money(result?.friend_amount_due);
  const friendMethod = result?.friend_payment_method;

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
        Thanks, {cadetName}.{' '}
        {hasGuest
          ? `Your guest, ${guestName}, will get an email to finish their part. Your signup isn't fully verified until they do.`
          : "You're not bringing a guest, so there's nothing else pending on that front."}
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
          A confirmation is on its way to {notificationEmail}. We'll email again{hasGuest ? ' when your guest verifies, and' : ''} when cash{formRequired ? ' and your field trip form are' : ' is'} marked received.
        </p>
      )}
    </div>
  );
}

const para = { fontFamily: mono, fontSize: 13, color: P.mute, lineHeight: 1.7 };
