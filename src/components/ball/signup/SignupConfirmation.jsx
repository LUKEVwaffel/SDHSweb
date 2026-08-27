import { P, mono } from '../../admin/theme';

// Locked confirmation screen — nothing can be edited after submit.
export default function SignupConfirmation({ cadetName, hasGuest, guestName, notificationEmail }) {
  return (
    <div style={{ border: `1px solid ${P.gold}`, background: P.navy, padding: 28 }}>
      <div style={{ fontFamily: mono, fontSize: 12, color: P.gold, letterSpacing: '0.14em', marginBottom: 14 }}>SIGNUP SUBMITTED ✓</div>
      <p style={{ fontFamily: mono, fontSize: 13, color: P.mute, lineHeight: 1.7 }}>
        Thanks, {cadetName}.{' '}
        {hasGuest
          ? `Your guest, ${guestName}, will get an email to finish their part — your signup isn't fully verified until they do.`
          : "You're not bringing a guest, so there's nothing else pending on that front."}
      </p>
      <p style={{ fontFamily: mono, fontSize: 13, color: P.mute, lineHeight: 1.7 }}>
        Next: bring your signed field trip form and cash/check payment (in full) directly to 1SG Kaz or Chief.
      </p>
      {notificationEmail && (
        <p style={{ fontFamily: mono, fontSize: 13, color: P.mute, lineHeight: 1.7 }}>
          We'll email {notificationEmail}{hasGuest ? ' when your guest verifies, and' : ''} when cash and your field trip form are marked received.
        </p>
      )}
    </div>
  );
}
