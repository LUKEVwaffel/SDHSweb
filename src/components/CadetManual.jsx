import { useState } from 'react';

const P = {
  ink: '#06101F',
  navy: '#142847',
  navyDeep: '#0A1628',
  gold: '#C9A961',
  goldBright: '#E8C77A',
  cream: '#F4ECD8',
  mute: 'rgba(244,236,216,0.6)',
  hairline: 'rgba(201,169,97,0.25)',
  hairlineStrong: 'rgba(201,169,97,0.55)',
};

const UNITS = [
  {
    id: 'u0',
    label: 'Front Matter',
    code: 'FM',
    chapters: [
      { id: 'cover',  label: 'Cover Page',          page: 1,  tags: ['cover'] },
      { id: 'intro',  label: 'Introduction',         page: 3,  tags: ['intro', 'welcome'] },
      { id: 'toc',    label: 'Table of Contents',    page: 4,  tags: ['contents', 'toc'] },
      { id: 'creed',  label: 'The Cadet Creed',      page: 6,  tags: ['creed', 'values'] },
    ],
  },
  {
    id: 'u1',
    label: 'Unit 1: Citizenship in Action',
    code: 'U1',
    chapters: [
      { id: 'u1-rank',       label: 'Rank & Battalion Structure',      page: 7,  tags: ['rank', 'structure', 'org'] },
      { id: 'u1-org',        label: 'Battalion Organization Chart',     page: 8,  tags: ['battalion', 'org chart'] },
      { id: 'u1-success',    label: 'Signs of Success',                page: 9,  tags: ['awards', 'success'] },
      { id: 'u1-uniform',    label: 'Personal Appearance & Uniform',   page: 11, tags: ['uniform', 'dress', 'appearance'] },
      { id: 'u1-flag',       label: 'The Stars and Stripes',           page: 17, tags: ['flag', 'stars', 'stripes'] },
      { id: 'u1-fold',       label: 'How to Fold the Flag',            page: 18, tags: ['flag', 'fold'] },
      { id: 'u1-anthem',     label: 'The National Anthem',             page: 19, tags: ['anthem', 'song'] },
      { id: 'u1-customs',    label: 'Military Traditions & Customs',   page: 20, tags: ['traditions', 'customs', 'courtesies'] },
      { id: 'u1-dod',        label: 'Service to the Nation / DoD',     page: 21, tags: ['dod', 'defense', 'service'] },
    ],
  },
  {
    id: 'u2',
    label: 'Unit 2: Leadership',
    code: 'U2',
    chapters: [
      { id: 'u2-lead',       label: 'Leadership from the Inside Out',  page: 22, tags: ['leadership', 'character'] },
      { id: 'u2-stat',       label: 'Stationary Drill Movements',      page: 23, tags: ['drill', 'stationary', 'movements'] },
      { id: 'u2-squad',      label: 'Squad Drill',                     page: 25, tags: ['drill', 'squad'] },
      { id: 'u2-perf',       label: 'Performance Indicators',          page: 27, tags: ['performance', 'evaluation'] },
      { id: 'u2-qbol',       label: 'QBOL Decision-Making Process',    page: 28, tags: ['qbol', 'decision', 'process'] },
      { id: 'u2-column',     label: 'Column & Company Drill',          page: 29, tags: ['drill', 'column', 'company', 'platoon'] },
      { id: 'u2-battalion',  label: 'Battalion Drill Formations',      page: 33, tags: ['drill', 'battalion', 'formation'] },
    ],
  },
  {
    id: 'u3',
    label: 'Unit 3: Foundations for Success',
    code: 'U3',
    chapters: [
      { id: 'u3-self',       label: 'Self-Awareness',                  page: 34, tags: ['self', 'awareness', 'know yourself'] },
      { id: 'u3-pathways',   label: 'Pathways to Success (QBOL)',      page: 35, tags: ['qbol', 'pathways', 'success'] },
      { id: 'u3-conflict',   label: 'Conflict Resolution',             page: 37, tags: ['conflict', 'resolution'] },
      { id: 'u3-service',    label: 'Service Learning',                page: 38, tags: ['service', 'community', 'learning'] },
      { id: 'u3-career',     label: 'Career Planning & Portfolio',     page: 39, tags: ['career', 'portfolio', 'planning'] },
      { id: 'u3-choices',    label: 'Making the Right Choices',        page: 40, tags: ['choices', 'decisions', 'responsibility'] },
      { id: 'u3-teach',      label: 'Teaching Skills & Graphic Organizers', page: 41, tags: ['teaching', 'graphic', 'organizers', 'thinking'] },
    ],
  },
  {
    id: 'u4',
    label: 'Unit 4: Wellness & Fitness',
    code: 'U4',
    chapters: [
      { id: 'u4-challenge',  label: 'Cadet Challenge Fitness Test',    page: 44, tags: ['fitness', 'pt', 'challenge', 'test'] },
      { id: 'u4-nutrition',  label: 'Nutrition: You Are What You Eat',page: 47, tags: ['nutrition', 'food', 'health'] },
      { id: 'u4-suicide',    label: 'Suicide Awareness & Prevention',  page: 48, tags: ['mental health', 'awareness', 'prevention'] },
    ],
  },
  {
    id: 'u6',
    label: 'Unit 6: American History',
    code: 'U6',
    chapters: [
      { id: 'u6-preamble',    label: 'The Preamble',                  page: 49, tags: ['preamble', 'constitution', 'citizenship'] },
      { id: 'u6-declaration', label: 'Declaration of Independence',    page: 50, tags: ['declaration', 'independence', 'founding'] },
    ],
  },
];

const ALL_CHAPTERS = UNITS.flatMap(u => u.chapters.map(c => ({ ...c, unit: u.label, unitCode: u.code })));

export default function CadetManual() {
  const [selected, setSelected] = useState(null); // null = list view, chapter = pdf view
  const [search, setSearch] = useState('');
  const [openUnits, setOpenUnits] = useState({ u0: true, u1: false, u2: false, u3: false, u4: false, u6: false });

  const filtered = search.trim()
    ? ALL_CHAPTERS.filter(c =>
        c.label.toLowerCase().includes(search.toLowerCase()) ||
        c.tags.some(t => t.includes(search.toLowerCase()))
      )
    : null;

  function openChapter(chapter) {
    setSelected(chapter);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function closeChapter() {
    setSelected(null);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function toggleUnit(id) {
    setOpenUnits(prev => ({ ...prev, [id]: !prev[id] }));
  }

  const currentIdx = selected ? ALL_CHAPTERS.findIndex(c => c.id === selected.id) : -1;
  const prevChapter = currentIdx > 0 ? ALL_CHAPTERS[currentIdx - 1] : null;
  const nextChapter = currentIdx < ALL_CHAPTERS.length - 1 ? ALL_CHAPTERS[currentIdx + 1] : null;

  // ── PDF viewer ──────────────────────────────────────────────────────────────
  if (selected) {
    return (
      <div style={{ background: P.ink, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {/* top bar */}
        <div style={{
          background: `linear-gradient(180deg, ${P.navy} 0%, ${P.navyDeep} 100%)`,
          borderBottom: `1px solid ${P.hairline}`,
          padding: '0 16px',
          display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
          minHeight: 56,
          flexWrap: 'wrap',
        }}>
          <button onClick={closeChapter} style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: P.gold, fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10, letterSpacing: '0.28em', padding: '16px 0',
            whiteSpace: 'nowrap', flexShrink: 0,
          }}>← CHAPTERS</button>

          <div style={{ width: 1, height: 20, background: P.hairline, flexShrink: 0 }} />

          <div style={{
            color: P.cream, fontFamily: 'Oswald, sans-serif', fontWeight: 700,
            fontSize: 15, letterSpacing: '0.16em', flex: 1, minWidth: 0,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            padding: '16px 0',
          }}>{selected.label.toUpperCase()}</div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <button onClick={() => prevChapter && openChapter(prevChapter)}
              disabled={!prevChapter}
              style={{
                background: 'transparent',
                border: `1px solid ${prevChapter ? P.hairlineStrong : P.hairline}`,
                cursor: prevChapter ? 'pointer' : 'default',
                color: prevChapter ? P.gold : 'rgba(201,169,97,0.3)',
                fontFamily: "'JetBrains Mono', monospace", fontSize: 9,
                letterSpacing: '0.18em', padding: '6px 12px',
              }}>← PREV</button>

            <div style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: 8,
              letterSpacing: '0.2em', color: P.mute, whiteSpace: 'nowrap',
            }}>PG {selected.page}</div>

            <button onClick={() => nextChapter && openChapter(nextChapter)}
              disabled={!nextChapter}
              style={{
                background: 'transparent',
                border: `1px solid ${nextChapter ? P.hairlineStrong : P.hairline}`,
                cursor: nextChapter ? 'pointer' : 'default',
                color: nextChapter ? P.gold : 'rgba(201,169,97,0.3)',
                fontFamily: "'JetBrains Mono', monospace", fontSize: 9,
                letterSpacing: '0.18em', padding: '6px 12px',
              }}>NEXT →</button>

            <a href="/assets/cadet-manual.pdf" download="Cadet-Reference-6th-Edition.pdf"
              style={{
                background: P.gold, color: P.ink,
                fontFamily: 'Oswald, sans-serif', fontWeight: 700,
                fontSize: 10, letterSpacing: '0.18em',
                padding: '7px 14px', textDecoration: 'none', flexShrink: 0,
              }}>↓ PDF</a>
          </div>
        </div>

        <iframe
          key={selected.page}
          src={`/assets/cadet-manual.pdf#page=${selected.page}`}
          title="Cadet Reference Manual"
          style={{ flex: 1, border: 'none', display: 'block', background: '#fff', minHeight: 'calc(100vh - 56px)' }}
        />
      </div>
    );
  }

  // ── Chapter browser ──────────────────────────────────────────────────────────
  return (
    <div style={{ background: P.ink, minHeight: '100vh' }}>

      {/* page header */}
      <div style={{
        background: `linear-gradient(180deg, ${P.navy} 0%, ${P.navyDeep} 100%)`,
        borderBottom: `1px solid ${P.hairline}`,
        padding: '28px 24px 24px',
      }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <div style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 9,
            letterSpacing: '0.32em', color: P.gold, opacity: 0.6, marginBottom: 8,
          }}>// TB·001 · CADET REFERENCE 6TH EDITION · 52 PAGES</div>
          <div style={{
            color: P.cream, fontFamily: 'Oswald, sans-serif', fontWeight: 700,
            fontSize: 32, letterSpacing: '0.12em', marginBottom: 20,
          }}>CADET MANUAL</div>

          {/* search */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            border: `1px solid ${P.hairlineStrong}`,
            padding: '10px 16px',
            background: 'rgba(0,0,0,0.35)',
            maxWidth: 480,
          }}>
            <span style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: 14,
              color: P.gold, opacity: 0.7, flexShrink: 0,
            }}>⌕</span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search chapters..."
              style={{
                background: 'transparent', border: 'none', outline: 'none',
                color: P.cream, fontFamily: 'Inter, sans-serif',
                fontSize: 14, width: '100%',
              }}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: P.gold, fontSize: 16, padding: 0, lineHeight: 1,
              }}>×</button>
            )}
          </div>
        </div>
      </div>

      {/* content */}
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 24px 64px' }}>

        {filtered ? (
          /* search results */
          <div>
            <div style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: 9,
              letterSpacing: '0.28em', color: P.gold, opacity: 0.6, marginBottom: 16,
            }}>{filtered.length} RESULT{filtered.length !== 1 ? 'S' : ''}</div>

            {filtered.length === 0 ? (
              <div style={{
                padding: '48px 0', textAlign: 'center',
                fontFamily: 'Inter, sans-serif', fontSize: 15, color: P.mute,
              }}>No chapters match "{search}"</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {filtered.map(c => (
                  <ChapterCard key={c.id} chapter={c} showUnit onClick={() => openChapter(c)} />
                ))}
              </div>
            )}
          </div>
        ) : (
          /* unit accordion */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {UNITS.map(unit => (
              <div key={unit.id} style={{
                border: `1px solid ${P.hairline}`,
                background: P.navyDeep,
                overflow: 'hidden',
              }}>
                {/* unit header */}
                <button onClick={() => toggleUnit(unit.id)} style={{
                  width: '100%', textAlign: 'left',
                  background: openUnits[unit.id] ? 'rgba(201,169,97,0.06)' : 'transparent',
                  border: 'none', cursor: 'pointer',
                  padding: '16px 20px',
                  display: 'flex', alignItems: 'center', gap: 14,
                }}>
                  <div style={{
                    fontFamily: "'JetBrains Mono', monospace", fontSize: 9,
                    letterSpacing: '0.22em', color: P.gold,
                    background: 'rgba(201,169,97,0.12)', padding: '3px 8px',
                    border: `1px solid ${P.hairline}`, flexShrink: 0,
                  }}>{unit.code}</div>
                  <div style={{
                    fontFamily: 'Oswald, sans-serif', fontWeight: 700,
                    fontSize: 16, letterSpacing: '0.12em', color: P.cream, flex: 1,
                    textAlign: 'left',
                  }}>{unit.label.toUpperCase()}</div>
                  <div style={{
                    fontFamily: "'JetBrains Mono', monospace", fontSize: 9,
                    letterSpacing: '0.2em', color: P.gold, opacity: 0.5,
                  }}>{unit.chapters.length} CH</div>
                  <span style={{
                    color: P.gold, fontSize: 16, opacity: 0.7,
                    transform: openUnits[unit.id] ? 'rotate(90deg)' : 'none',
                    transition: 'transform 0.2s', display: 'inline-block', flexShrink: 0,
                  }}>›</span>
                </button>

                {/* chapter list */}
                {openUnits[unit.id] && (
                  <div style={{ borderTop: `1px solid ${P.hairline}` }}>
                    {unit.chapters.map((c, i) => (
                      <ChapterCard
                        key={c.id}
                        chapter={{ ...c, unit: unit.label, unitCode: unit.code }}
                        divider={i < unit.chapters.length - 1}
                        onClick={() => openChapter({ ...c, unit: unit.label, unitCode: unit.code })}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* download strip */}
        <div style={{
          marginTop: 40, borderTop: `1px solid ${P.hairline}`,
          paddingTop: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 16,
        }}>
          <div style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 9,
            letterSpacing: '0.22em', color: P.mute,
          }}>CADET REFERENCE · 6TH EDITION · {ALL_CHAPTERS.length} SECTIONS</div>
          <a href="/assets/cadet-manual.pdf" download="Cadet-Reference-6th-Edition.pdf"
            style={{
              background: P.gold, color: P.ink,
              fontFamily: 'Oswald, sans-serif', fontWeight: 700,
              fontSize: 12, letterSpacing: '0.2em',
              padding: '10px 22px', textDecoration: 'none',
            }}>DOWNLOAD PDF ↓</a>
        </div>
      </div>
    </div>
  );
}

function ChapterCard({ chapter, onClick, showUnit, divider }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%', textAlign: 'left', border: 'none',
        borderBottom: divider !== false ? `1px solid rgba(201,169,97,0.08)` : 'none',
        cursor: 'pointer',
        background: hovered ? 'rgba(201,169,97,0.06)' : 'transparent',
        padding: '14px 20px',
        display: 'flex', alignItems: 'center', gap: 16,
        transition: 'background 0.15s',
      }}>
      <div style={{
        fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
        letterSpacing: '0.12em', color: P.gold,
        opacity: 0.6, flexShrink: 0, width: 28, textAlign: 'right',
      }}>{String(chapter.page).padStart(2, '0')}</div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {showUnit && (
          <div style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 7,
            letterSpacing: '0.2em', color: P.gold, opacity: 0.5, marginBottom: 3,
          }}>{chapter.unitCode}</div>
        )}
        <div style={{
          fontFamily: 'Inter, sans-serif', fontSize: 15, fontWeight: 500,
          color: hovered ? P.cream : P.mute,
          transition: 'color 0.15s',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{chapter.label}</div>
      </div>

      <div style={{
        color: P.gold, fontSize: 16, opacity: hovered ? 0.9 : 0.3,
        transition: 'opacity 0.15s', flexShrink: 0,
      }}>›</div>
    </button>
  );
}
