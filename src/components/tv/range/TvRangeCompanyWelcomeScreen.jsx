import { P, mono, fraunces, inter, fs, sp, radius, shadow } from '../../admin/theme.js';
import { renderTemplate } from '../../../lib/tvRangeSchedule.js';
import { useTvConsentDue } from '../../../hooks/useTvConsentDue.js';

// Item 3 (visual redesign) + item 5 (editable custom_blocks). Still the
// sparsest screen in the set per spec — no carousel, no widgets — but "sparse"
// now means real depth (layered radial glow, hairline grid texture, staggered
// reveal) instead of flat centered text on solid ink. Motion stays
// transform/opacity only (see performance rules); reduced-motion disables it.
function WelcomeStyles() {
  return (
    <style>{`
      @keyframes tvWelcomeRise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
      .tv-welcome-title { animation: tvWelcomeRise 700ms cubic-bezier(0.16,1,0.3,1) both; }
      .tv-welcome-pill { animation: tvWelcomeRise 700ms cubic-bezier(0.16,1,0.3,1) 180ms both; }
      .tv-welcome-block { animation: tvWelcomeRise 700ms cubic-bezier(0.16,1,0.3,1) both; }
      @media (prefers-reduced-motion: reduce) {
        .tv-welcome-title, .tv-welcome-pill, .tv-welcome-block { animation: none; }
      }
    `}</style>
  );
}

export default function TvRangeCompanyWelcomeScreen({ config, company }) {
  const welcome = renderTemplate(config?.company_welcome_template || 'Welcome {company} Company', { company });
  const reminder = config?.attendance_reminder_template || '1SGT: Take attendance now';
  const customBlocks = config?.custom_blocks ?? [];
  const consentDue = useTvConsentDue(company);

  return (
    <div style={{
      position: 'fixed', inset: 0, background: P.ink, fontFamily: inter,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: sp[12], textAlign: 'center', gap: sp[6], overflow: 'hidden',
    }}>
      <WelcomeStyles />

      {/* Layered depth, not flat ink — a soft off-center gold glow plus a
          faint hairline grid, both purely decorative/background so they never
          compete with the title's legibility from across the room. */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: `radial-gradient(ellipse 60% 50% at 30% 20%, ${P.goldWash} 0%, transparent 60%),
                     radial-gradient(ellipse 50% 40% at 80% 85%, rgba(201,169,97,0.06) 0%, transparent 65%)`,
      }} />
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.5,
        backgroundImage: `linear-gradient(${P.hair} 1px, transparent 1px), linear-gradient(90deg, ${P.hair} 1px, transparent 1px)`,
        backgroundSize: '64px 64px',
        maskImage: 'radial-gradient(ellipse 70% 60% at 50% 50%, black 0%, transparent 75%)',
        WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 50% 50%, black 0%, transparent 75%)',
      }} />

      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: sp[6] }}>
        <div
          className="tv-welcome-title"
          style={{
            fontFamily: fraunces, fontWeight: 800, fontStyle: 'italic', color: P.cream,
            fontSize: 'clamp(48px, 9vh, 128px)', lineHeight: 1.02, maxWidth: '90vw',
            textShadow: `0 4px 40px rgba(201,169,97,0.18)`,
          }}
        >
          {welcome}
        </div>

        <div
          className="tv-welcome-pill"
          style={{
            padding: `${sp[3]}px ${sp[6]}px`, border: `1px solid ${P.hairStrong}`,
            borderRadius: 999, background: `linear-gradient(160deg, ${P.goldWash}, transparent)`,
            fontFamily: mono, fontSize: fs.md, color: P.gold, letterSpacing: '0.06em',
          }}
        >
          {reminder}
        </div>

        <div
          className="tv-welcome-block"
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: sp[4],
            padding: `${sp[5]}px ${sp[7]}px`, maxWidth: '84vw',
            border: `1px solid ${P.hairStrong}`, borderRadius: radius.lg,
            background: `linear-gradient(160deg, rgba(201,169,97,0.1), rgba(201,169,97,0.02))`,
            boxShadow: shadow.lg,
          }}
        >
          <div style={{
            fontFamily: mono, fontSize: fs.md, color: P.gold, letterSpacing: '0.08em', fontWeight: 700,
          }}>
            ALL CADET CONSENT FORMS DUE AUGUST 31ST
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

        {customBlocks.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: sp[3], maxWidth: '70vw' }}>
            {customBlocks.map((block, i) => (
              <div
                key={block.id ?? i}
                className="tv-welcome-block"
                style={{
                  animationDelay: `${360 + i * 120}ms`,
                  fontFamily: inter, fontSize: fs.lg, color: P.mute, lineHeight: 1.5,
                }}
              >
                {block.text}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
