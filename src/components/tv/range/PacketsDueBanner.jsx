import { P, mono, inter, fs, sp, radius, shadow } from '../../admin/theme.js';
import { useTvConsentDue } from '../../../hooks/useTvConsentDue.js';

// Reminder + outstanding-cadet list for the two forms due Aug 31 (DD Form
// 3203 + JROTC Personal Datasheet — see cadet_consent_dd_forms.sql). Shared
// by the company Welcome screen, the Staff schedule screen, and the Packets
// Due rotation slide so all three read the same source (useTvConsentDue)
// instead of drifting. Renders the reminder even when nothing is
// outstanding — every cadet (and staff) has to turn this in, so the
// deadline stays visible regardless of current status.
export default function PacketsDueBanner({ company, className }) {
  const consentDue = useTvConsentDue(company);

  return (
    <div
      className={className}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: sp[4],
        padding: `${sp[5]}px ${sp[7]}px`, maxWidth: '84vw',
        border: `1px solid ${P.hairStrong}`, borderRadius: radius.lg,
        background: `linear-gradient(160deg, rgba(201,169,97,0.1), rgba(201,169,97,0.02))`,
        boxShadow: shadow.lg,
      }}
    >
      <div style={{ fontFamily: mono, fontSize: fs.md, color: P.gold, letterSpacing: '0.08em', fontWeight: 700 }}>
        ALL CADET PACKETS DUE AUGUST 31ST
      </div>

      {consentDue.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: sp[2] }}>
          <div style={{ fontFamily: mono, fontSize: fs.tiny, color: P.mute, letterSpacing: '0.1em' }}>
            STILL OUTSTANDING
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: sp[2], maxWidth: '70vw' }}>
            {consentDue.map((name) => (
              <span key={name} style={{
                fontFamily: inter, fontSize: fs.sm, color: P.cream,
                padding: `${sp[1]}px ${sp[3]}px`, borderRadius: radius.pill,
                border: `1px solid ${P.hairStrong}`, background: P.navyLift,
              }}>
                {name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
