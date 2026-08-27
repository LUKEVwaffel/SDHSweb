import { P, mono, fraunces, inter, fs, sp, radius, shadow } from '../../admin/theme.js';
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
  const allClear = consentDue.length === 0;

  return (
    <div
      className={className}
      style={{
        position: 'relative', maxWidth: '84vw', borderRadius: radius.lg,
        padding: 1, background: `linear-gradient(160deg, ${P.hairStrong}, rgba(201,169,97,0.08) 60%, transparent)`,
        boxShadow: `${shadow.lg}, ${shadow.glow}`,
      }}
    >
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: sp[4],
        padding: `${sp[6]}px ${sp[8]}px`, borderRadius: radius.lg - 1,
        background: `linear-gradient(160deg, rgba(201,169,97,0.12), ${P.deep} 65%)`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: sp[2] }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
            <path d="M12 3 L22 20 H2 Z" stroke={P.gold} strokeWidth="1.8" strokeLinejoin="round" />
            <path d="M12 9.5 V14" stroke={P.gold} strokeWidth="1.8" strokeLinecap="round" />
            <circle cx="12" cy="17" r="1" fill={P.gold} />
          </svg>
          <div style={{
            fontFamily: mono, fontSize: fs.xs, color: P.gold, letterSpacing: '0.14em', fontWeight: 700,
          }}>
            ALL CADET PACKETS DUE
          </div>
        </div>

        <div style={{
          fontFamily: fraunces, fontWeight: 800, fontStyle: 'italic', color: P.bright,
          fontSize: fs.xxl, letterSpacing: '0.01em',
        }}>
          August 31st
        </div>

        {allClear ? (
          <div style={{
            display: 'flex', alignItems: 'center', gap: sp[2],
            fontFamily: inter, fontSize: fs.sm, color: P.green,
            padding: `${sp[1]}px ${sp[4]}px`, borderRadius: radius.pill,
            border: `1px solid rgba(39,174,96,0.4)`, background: 'rgba(39,174,96,0.1)',
          }}>
            All cadets are turned in
          </div>
        ) : (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: sp[3],
            paddingTop: sp[3], width: '100%',
            borderTop: `1px solid ${P.hair}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: sp[2] }}>
              <div style={{ fontFamily: mono, fontSize: fs.tiny, color: P.mute, letterSpacing: '0.12em' }}>
                STILL OUTSTANDING
              </div>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                minWidth: 20, height: 20, padding: `0 ${sp[1]}px`, borderRadius: radius.pill,
                background: P.red, color: P.cream, fontFamily: mono, fontSize: fs.micro, fontWeight: 700,
              }}>
                {consentDue.length}
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: sp[2], maxWidth: '70vw' }}>
              {consentDue.map((name) => (
                <span key={name} style={{
                  display: 'flex', alignItems: 'center', gap: sp[1],
                  fontFamily: inter, fontSize: fs.sm, color: P.cream,
                  padding: `${sp[1]}px ${sp[3]}px`, borderRadius: radius.pill,
                  border: `1px solid ${P.hairStrong}`, background: P.navyLift,
                }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%', background: P.red, flexShrink: 0,
                  }} />
                  {name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
