import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase as SB } from '../lib/supabaseClient';
import useIsMobile from '../hooks/useIsMobile';

const P = {
  ink: '#06101F', navy: '#142847', deep: '#0A1628',
  gold: '#C9A961', bright: '#E8C77A', cream: '#F4ECD8',
  mute: 'rgba(244,236,216,0.55)', hair: 'rgba(201,169,97,0.22)',
};

const COMPANIES = [
  { id: 'alpha',   section: 'company-alpha',   label: 'ALPHA',   phonetic: 'ALPHA COMPANY',   color: '#1a3a5c' },
  { id: 'bravo',   section: 'company-bravo',   label: 'BRAVO',   phonetic: 'BRAVO COMPANY',   color: '#1a3a2a' },
  { id: 'charlie', section: 'company-charlie', label: 'CHARLIE', phonetic: 'CHARLIE COMPANY', color: '#3a2a1a' },
  { id: 'delta',   section: 'company-delta',   label: 'DELTA',   phonetic: 'DELTA COMPANY',   color: '#2a1a3a' },
];

const ROLE_ORDER = ['CDR', 'XO', '1SG'];

// Keyboard activation for click-through cards.
function activate(e, fn) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    fn();
  }
}

function CadetCard({ person, onViewProfile }) {
  const [expanded, setExpanded] = useState(false);
  const view = () => onViewProfile(person);
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`View profile: ${person.name}, ${person.role_long || person.role_short}`}
      onClick={view}
      onKeyDown={(e) => activate(e, view)}
      style={{ background: P.navy, border: `1px solid ${P.hair}`, display: 'flex', flexDirection: 'column', cursor: 'pointer' }}>
      <div style={{ position: 'relative', aspectRatio: '3/4', overflow: 'hidden', background: P.deep }}>
        {person.photo_url ? (
          <img src={person.photo_url} alt={person.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', display: 'block' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 48, color: P.hair }}>◉</div>
          </div>
        )}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 45%, rgba(6,16,31,0.9) 100%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '14px 12px' }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: P.gold, letterSpacing: '0.2em', marginBottom: 3 }}>
            {person.role_short} · {person.role_long}
          </div>
          <div style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 700, fontSize: 16, color: P.cream, letterSpacing: '0.06em' }}>
            {person.name.toUpperCase()}
          </div>
        </div>
      </div>
      {person.bio && (
        <div style={{ padding: '10px 12px', borderTop: `1px solid ${P.hair}`, flex: 1 }}>
          <p style={{
            fontFamily: 'Inter, sans-serif', fontSize: 12, color: P.mute,
            lineHeight: 1.6, margin: 0,
            maxHeight: expanded ? 'none' : 72, overflow: 'hidden',
          }}>{person.bio}</p>
          {person.bio.length > 130 && (
            <button onClick={(e) => { e.stopPropagation(); setExpanded(x => !x); }} style={{
              background: 'none', border: 'none', color: P.gold, cursor: 'pointer',
              fontFamily: "'JetBrains Mono', monospace", fontSize: 9,
              letterSpacing: '0.15em', padding: '4px 0', marginTop: 2,
            }}>{expanded ? '▲ LESS' : '▼ MORE'}</button>
          )}
        </div>
      )}
    </div>
  );
}

export default function Companies() {
  const navigate = useNavigate();
  const { id } = useParams();
  const activeCompany = id || 'alpha';
  const isMobile = useIsMobile();
  const [personnel, setPersonnel] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await SB.from('personnel').select('*').eq('visible', true)
        .in('section', COMPANIES.map(c => c.section)).order('sort_order');
      const grouped = {};
      (data || []).forEach(p => { if (!grouped[p.section]) grouped[p.section] = []; grouped[p.section].push(p); });
      setPersonnel(grouped);
      setLoading(false);
    }
    load();
  }, []);

  const company = COMPANIES.find(c => c.id === activeCompany);
  const members = (personnel[company?.section] || []).sort((a, b) =>
    ROLE_ORDER.indexOf(a.role_short) - ROLE_ORDER.indexOf(b.role_short)
  );

  function goProfile(person) { navigate(`/profile/${person.id}`, { state: { from: 'companies' } }); }

  if (isMobile) {
    return (
      <section style={{ background: P.ink, minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
        <div style={{ padding: '24px 20px 40px' }}>
          <button onClick={() => navigate('/')} style={{
            background: 'none', border: 'none', color: P.gold, cursor: 'pointer',
            fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.24em',
            padding: 0, marginBottom: 18,
          }}>← HOME</button>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: P.gold, letterSpacing: '0.28em' }}>
            // UNIT STRUCTURE
          </div>
          <div style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 700, fontSize: 42, color: P.cream, letterSpacing: '0.02em', lineHeight: 0.92, marginTop: 8 }}>
            COMPANIES
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 20 }}>
            {COMPANIES.map(co => (
              <button key={co.id} onClick={() => navigate(`/company/${co.id}`)} style={{
                background: activeCompany === co.id ? P.gold : 'transparent',
                border: `1px solid ${activeCompany === co.id ? P.gold : P.hair}`,
                color: activeCompany === co.id ? P.ink : P.mute,
                fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.14em',
                padding: 13, cursor: 'pointer', fontWeight: 700, minHeight: 44, boxSizing: 'border-box',
              }}>{co.label}</button>
            ))}
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 60, fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: P.mute, letterSpacing: '0.2em' }}>LOADING…</div>
          ) : (
            <>
              <div style={{ background: company.color, border: `1px solid ${P.hair}`, padding: 22, marginTop: 18, boxSizing: 'border-box' }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: P.gold, letterSpacing: '0.28em' }}>TROJAN BATTALION</div>
                <div style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 700, fontSize: 26, color: P.cream, letterSpacing: '0.1em', marginTop: 6 }}>
                  {company.phonetic}
                </div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: P.mute, marginTop: 10 }}>
                  {members.length} CADETS DISPLAYED
                </div>
              </div>

              {members.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
                  {members.map(p => (
                    <div key={p.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`View profile: ${p.name}, ${p.role_long || p.role_short}`}
                      onClick={() => goProfile(p)}
                      onKeyDown={(e) => activate(e, () => goProfile(p))}
                      style={{
                      display: 'grid', gridTemplateColumns: '84px 1fr', gap: 14,
                      border: `1px solid ${P.hair}`, background: P.navy, padding: 12, boxSizing: 'border-box',
                      cursor: 'pointer',
                    }}>
                      <div style={{ aspectRatio: '3/4', overflow: 'hidden', background: P.deep }}>
                        {p.photo_url ? (
                          <img src={p.photo_url} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', display: 'block' }} />
                        ) : (
                          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 24, color: P.hair }}>◉</div>
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: P.gold, letterSpacing: '0.2em' }}>
                          {p.role_short} · {p.role_long}
                        </div>
                        <div style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 700, fontSize: 16, color: P.cream, letterSpacing: '0.03em', marginTop: 6 }}>
                          {p.name.toUpperCase()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: P.mute, textAlign: 'center', padding: 40 }}>
                  NO PERSONNEL ON FILE
                </div>
              )}
            </>
          )}
        </div>
      </section>
    );
  }

  return (
    <section style={{ background: P.ink, minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
      {/* Header */}
      <div style={{ borderBottom: `1px solid ${P.hair}`, padding: '60px 40px 0', maxWidth: 1400, margin: '0 auto' }}>
        <button onClick={() => navigate('/')} style={{
          background: 'none', border: 'none', color: P.gold, cursor: 'pointer',
          fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
          letterSpacing: '0.28em', padding: 0, marginBottom: 20, display: 'block',
        }}>← BACK</button>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: P.gold, letterSpacing: '0.32em', marginBottom: 12 }}>
          // UNIT STRUCTURE
        </div>
        <h1 style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 700, fontSize: 72, color: P.cream, letterSpacing: '0.02em', margin: 0, lineHeight: 0.9 }}>
          COMPANIES
        </h1>
        <p style={{ color: P.mute, fontSize: 15, lineHeight: 1.7, marginTop: 16, maxWidth: 560, margin: '16px 0 0' }}>
          The Trojan Battalion is organized into four companies, each led by cadet officers and NCOs responsible for their unit's training and welfare.
        </p>

        {/* Company Tabs */}
        <div style={{ display: 'flex', gap: 0, marginTop: 36 }}>
          {COMPANIES.map(co => (
            <button key={co.id} onClick={() => navigate(`/company/${co.id}`)} style={{
              background: activeCompany === co.id ? P.gold : 'transparent',
              border: `1px solid ${activeCompany === co.id ? P.gold : P.hair}`,
              borderBottom: activeCompany === co.id ? `1px solid ${P.gold}` : `1px solid ${P.hair}`,
              color: activeCompany === co.id ? P.ink : P.mute,
              fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
              letterSpacing: '0.2em', padding: '12px 28px', cursor: 'pointer',
              fontWeight: 700, marginRight: -1,
              transition: 'all 0.15s',
            }}>
              {co.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 80, fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: P.mute, letterSpacing: '0.2em' }}>LOADING…</div>
      ) : (
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '48px 40px 80px' }}>
          {/* Company Hero Strip */}
          <div style={{
            background: company.color, border: `1px solid ${P.hair}`,
            padding: '28px 32px', marginBottom: 36,
            display: 'flex', alignItems: 'center', gap: 24,
          }}>
            <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 64, color: P.gold, fontWeight: 700, lineHeight: 1, opacity: 0.25, userSelect: 'none' }}>
              {company.label[0]}
            </div>
            <div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: P.gold, letterSpacing: '0.3em' }}>
                TROJAN BATTALION
              </div>
              <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 32, color: P.cream, letterSpacing: '0.12em', marginTop: 4 }}>
                {company.phonetic}
              </div>
            </div>
            <div style={{ marginLeft: 'auto', fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: P.mute }}>
              {members.length} CADETS DISPLAYED
            </div>
          </div>

          {/* Leadership Cards */}
          {members.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
              {members.map(p => <CadetCard key={p.id} person={p} onViewProfile={goProfile} />)}
            </div>
          ) : (
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: P.mute, textAlign: 'center', padding: 60 }}>
              NO PERSONNEL ON FILE
            </div>
          )}
        </div>
      )}
    </section>
  );
}
