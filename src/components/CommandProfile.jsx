import { useState, useEffect } from 'react';
import { supabase as SB } from '../lib/supabaseClient';

const P = {
  ink: '#06101F', navy: '#142847', deep: '#0A1628',
  gold: '#C9A961', bright: '#E8C77A', cream: '#F4ECD8',
  mute: 'rgba(244,236,216,0.55)', hair: 'rgba(201,169,97,0.22)',
};

// Light-tier grid — matches Raiders.jsx PageBg / About.jsx hero, not the
// heavier BattalionCommand tactical overlay (that one's landing-hero-only).
function PageGrid() {
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `linear-gradient(${P.hair} 1px, transparent 1px), linear-gradient(90deg, ${P.hair} 1px, transparent 1px)`,
        backgroundSize: '52px 52px', opacity: 0.22,
      }} />
    </div>
  );
}

const ROLE_LABELS = {
  BC:  'Battalion Commander',
  XO:  'Executive Officer',
  CSM: 'Command Sergeant Major',
  S1:  'Personnel Officer',
  AS1: 'Asst. Personnel Officer',
  S2:  'Intelligence Officer',
  S3:  'Operations Officer',
  DS3: 'Deputy Operations Officer',
  AS3: 'Asst. Operations Officer',
  S4:  'Logistics Officer',
  S5:  'Civil Affairs Officer',
  S6:  'Communications Officer',
};

export default function CommandProfile({ personId, backTarget, backLabel, setActive }) {
  const [person, setPerson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [achievements, setAchievements] = useState([]);

  useEffect(() => {
    async function load() {
      // Try direct id match first, then slug, then role_short — strict priority
      // so an id that happens to equal another row's shared role_short (e.g.
      // 'xo') can't lose to that row. See: Mya Sneidman routing bug.
      const list = await SB.from('personnel').select('*').eq('visible', true).limit(200).then(r => r.data || []);
      const match =
        list.find(p => String(p.id) === String(personId)) ||
        list.find(p => p.slug === personId) ||
        list.find(p => p.role_short && p.role_short.toLowerCase() === personId.toLowerCase()) ||
        null;
      let resolved = match;
      // Mya guaranteed: synthesize XO placeholder if no row exists.
      if (!resolved && personId && personId.toLowerCase() === 'xo') {
        resolved = {
          id: 'xo', name: 'Mya Sneidman',
          role_short: 'XO', role_long: 'Executive Officer',
          bio: null, photo_url: null, synthetic: true,
        };
      }
      setPerson(resolved);
      setLoading(false);

      if (resolved && !resolved.synthetic) {
        const { data } = await SB
          .from('cadet_achievements')
          .select('date_earned, achievements(id, name, description, icon_url)')
          .eq('personnel_id', resolved.id);
        setAchievements((data || []).filter(r => r.achievements));
      } else {
        setAchievements([]);
      }
    }
    load();
  }, [personId]);

  const back = () => setActive(backTarget || 'staff');

  if (loading) {
    return (
      <div style={{ background: P.ink, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        <PageGrid />
        <div style={{ position: 'relative', zIndex: 1, fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: P.mute, letterSpacing: '0.2em' }}>
          LOADING…
        </div>
      </div>
    );
  }

  if (!person) {
    return (
      <div style={{ background: P.ink, minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, position: 'relative' }}>
        <PageGrid />
        <div style={{ position: 'relative', zIndex: 1, fontFamily: 'Oswald, sans-serif', fontSize: 28, color: P.cream }}>PROFILE NOT FOUND</div>
        <button onClick={back} style={{
          position: 'relative', zIndex: 1,
          background: 'none', border: `1px solid ${P.hair}`, color: P.gold, cursor: 'pointer',
          fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.2em', padding: '10px 20px',
        }}>← {backLabel || 'BACK'}</button>
      </div>
    );
  }

  const roleLabel = ROLE_LABELS[person.role_short] || person.role_long || person.role_short;
  const bioText = person.bio_long || person.bio;

  return (
    <section style={{ background: P.ink, minHeight: '100vh', fontFamily: 'Inter, sans-serif', position: 'relative' }}>
      <PageGrid />
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '60px 40px 80px', position: 'relative', zIndex: 1 }}>

        {/* Back button */}
        <button onClick={back} style={{
          background: 'none', border: 'none', color: P.gold, cursor: 'pointer',
          fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
          letterSpacing: '0.28em', padding: 0, marginBottom: 48, display: 'block',
        }}>← BACK TO {(backLabel || 'STAFF').toUpperCase()}</button>

        {/* Main layout: photo left, content right */}
        <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 60, alignItems: 'start' }}>

          {/* ── Left: Photo + metadata ─────────────── */}
          <div>
            {/* Portrait photo */}
            <div style={{
              position: 'relative',
              background: P.navy,
              border: `1px solid ${P.hair}`,
              overflow: 'hidden',
              aspectRatio: '3/4',
            }}>
              {person.photo_url ? (
                <img
                  src={person.photo_url}
                  alt={person.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', display: 'block' }}
                />
              ) : (
                <div style={{
                  width: '100%', height: '100%', position: 'relative',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14,
                  background: `repeating-linear-gradient(135deg, ${P.deep} 0px, ${P.deep} 11px, ${P.navy} 11px, ${P.navy} 12px)`,
                }}>
                  <svg width="56" height="56" viewBox="0 0 48 48" fill="none" style={{ opacity: 0.28 }}>
                    <circle cx="24" cy="24" r="8" stroke={P.gold} strokeWidth="1.2" />
                    <line x1="24" y1="3"  x2="24" y2="13" stroke={P.gold} strokeWidth="1.2" />
                    <line x1="24" y1="35" x2="24" y2="45" stroke={P.gold} strokeWidth="1.2" />
                    <line x1="3"  y1="24" x2="13" y2="24" stroke={P.gold} strokeWidth="1.2" />
                    <line x1="35" y1="24" x2="45" y2="24" stroke={P.gold} strokeWidth="1.2" />
                  </svg>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: `${P.gold}66`, letterSpacing: '0.24em' }}>
                    AWAITING PORTRAIT
                  </div>
                </div>
              )}

              {/* Role tag bottom-left */}
              <div style={{
                position: 'absolute', bottom: 0, left: 0,
                background: 'rgba(6,16,31,0.7)',
                padding: '6px 12px',
                fontFamily: "'JetBrains Mono', monospace", fontSize: 9,
                color: P.gold, letterSpacing: '0.2em',
                backdropFilter: 'blur(4px)',
              }}>
                {person.role_short}
              </div>

              {/* Commendation count teaser — top-right, only when achievements exist */}
              {achievements.length > 0 && (
                <div style={{
                  position: 'absolute', top: 0, right: 0,
                  background: 'rgba(6,16,31,0.78)',
                  padding: '6px 10px 6px 12px',
                  backdropFilter: 'blur(4px)',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={P.gold} strokeWidth="1.6">
                    <path d="M12 2l2.4 6.6L21 10l-5 4.6L17.4 21 12 17.3 6.6 21 8 14.6 3 10l6.6-1.4z" />
                  </svg>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: P.gold, letterSpacing: '0.14em' }}>
                    {achievements.length} COMMENDATION{achievements.length === 1 ? '' : 'S'}
                  </span>
                </div>
              )}
            </div>

            {/* Metadata rows below photo */}
            <div style={{ marginTop: 1, border: `1px solid ${P.hair}`, borderTop: 'none' }}>
              {[
                ['ROLE',   roleLabel],
                ['UNIT',   `Trojan Battalion · TN-051`],
                ['SCHOOL', 'Soddy Daisy High School'],
                ['AY',     '2025–26'],
              ].map(([label, value]) => (
                <div key={label} style={{
                  display: 'flex', borderBottom: `1px solid ${P.hair}`,
                  ':lastChild': { borderBottom: 'none' },
                }}>
                  <div style={{
                    width: 80, flexShrink: 0,
                    padding: '10px 14px',
                    fontFamily: "'JetBrains Mono', monospace", fontSize: 9,
                    color: P.gold, letterSpacing: '0.15em',
                    background: P.deep,
                    borderRight: `1px solid ${P.hair}`,
                  }}>{label}</div>
                  <div style={{
                    padding: '10px 14px',
                    fontFamily: 'Inter, sans-serif', fontSize: 12,
                    color: P.cream, lineHeight: 1.4,
                  }}>{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Right: Name + Bio ──────────────────── */}
          <div>
            {/* Name */}
            <h1 style={{
              fontFamily: 'Oswald, sans-serif', fontWeight: 700,
              fontSize: 56, color: P.cream, letterSpacing: '0.02em',
              margin: '0 0 8px', lineHeight: 1,
            }}>
              {person.name.toUpperCase()}
            </h1>

            {/* Gold divider */}
            <div style={{ width: 48, height: 2, background: P.gold, marginBottom: 32 }} />

            {/* Biography box */}
            <div style={{ border: `1px solid ${P.hair}`, background: P.deep }}>
              <div style={{
                padding: '12px 20px',
                borderBottom: `1px solid ${P.hair}`,
                fontFamily: "'JetBrains Mono', monospace", fontSize: 9,
                color: P.gold, letterSpacing: '0.25em',
              }}>
                // BIOGRAPHY
              </div>
              <div style={{ padding: '20px 20px' }}>
                {bioText ? (
                  <p style={{
                    fontFamily: 'Inter, sans-serif', fontSize: 14,
                    color: P.mute, lineHeight: 1.8, margin: 0,
                  }}>
                    {bioText}
                  </p>
                ) : (
                  <div style={{
                    border: `1px dashed ${P.gold}3a`,
                    padding: '20px 22px',
                    display: 'flex', flexDirection: 'column', gap: 8,
                    background: `repeating-linear-gradient(135deg, transparent 0px, transparent 13px, rgba(201,169,97,0.03) 13px, rgba(201,169,97,0.03) 14px)`,
                  }}>
                    <span style={{
                      fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
                      color: `${P.gold}aa`, letterSpacing: '0.22em',
                    }}>// AWAITING BIOGRAPHY</span>
                    <span style={{
                      fontFamily: "'JetBrains Mono', monospace", fontSize: 9,
                      color: `${P.gold}55`, letterSpacing: '0.16em',
                    }}>{person.role_short} · RECORD PENDING</span>
                  </div>
                )}
              </div>
            </div>

            {/* Accomplishments — omitted entirely when cadet has none */}
            {achievements.length > 0 && (
              <div style={{ border: `1px solid ${P.hair}`, background: P.deep, marginTop: 24 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 20px',
                  borderBottom: `1px solid ${P.hair}`,
                  fontFamily: "'JetBrains Mono', monospace", fontSize: 9,
                  color: P.gold, letterSpacing: '0.25em',
                }}>
                  <span>// ACCOMPLISHMENTS</span>
                  <span style={{ color: P.mute, letterSpacing: '0.1em' }}>{achievements.length} EARNED</span>
                </div>
                <div style={{
                  padding: 20,
                  display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 10,
                }}>
                  {achievements.map((a) => (
                    <div
                      key={a.achievements.id}
                      title={a.achievements.description || a.achievements.name}
                      style={{
                        background: P.navy, border: `1px solid ${P.hair}`, padding: '16px 12px',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center',
                      }}
                    >
                      <img
                        src={a.achievements.icon_url}
                        alt={a.achievements.name}
                        style={{ width: 40, height: 40, objectFit: 'contain' }}
                      />
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, color: P.cream, letterSpacing: '0.06em', lineHeight: 1.4 }}>
                        {a.achievements.name.toUpperCase()}
                      </div>
                      {a.date_earned && (
                        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: P.mute, letterSpacing: '0.08em' }}>
                          {new Date(a.date_earned).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toUpperCase()}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Rank / LET if available */}
            {(person.rank || person.let_level) && (
              <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
                {person.rank && (
                  <div style={{
                    border: `1px solid ${P.hair}`, padding: '6px 14px',
                    fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
                    color: P.mute, letterSpacing: '0.14em',
                  }}>{person.rank}</div>
                )}
                {person.let_level && (
                  <div style={{
                    border: `1px solid ${P.hair}`, padding: '6px 14px',
                    fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
                    color: P.mute, letterSpacing: '0.14em',
                  }}>{person.let_level}</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
