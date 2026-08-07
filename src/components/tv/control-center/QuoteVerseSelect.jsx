import { useState, useMemo } from 'react';
import { P, mono, inter, fs, sp, radius, ease } from '../../admin/theme.js';

/**
 * Searchable multi-select over a library of 100+ quotes/verses. The 1SGT
 * picks whichever subset should cycle through the day — empty selection
 * means "rotate the whole library," so this is additive curation, not a
 * required step.
 */
export default function QuoteVerseSelect({ library, selected, onChange, renderLabel, renderMeta, placeholder }) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return library;
    return library.filter((item) =>
      renderLabel(item).toLowerCase().includes(q) || (renderMeta(item) || '').toLowerCase().includes(q)
    );
  }, [library, search, renderLabel, renderMeta]);

  const toggle = (id) => {
    const has = selected.includes(id);
    onChange(has ? selected.filter((s) => s !== id) : [...selected, id]);
  };

  const selectAllVisible = () => {
    const visibleIds = filtered.map((i) => i.id);
    onChange(Array.from(new Set([...selected, ...visibleIds])));
  };

  const clearAll = () => onChange([]);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: sp[2], marginBottom: sp[3] }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={placeholder}
          style={{
            flex: 1, padding: `${sp[2]}px ${sp[3]}px`, borderRadius: radius.sm,
            border: `1px solid ${P.hair}`, background: P.deep, color: P.cream,
            fontFamily: inter, fontSize: 13,
          }}
        />
        <span style={{ fontFamily: mono, fontSize: fs.micro, color: P.gold, letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>
          {selected.length ? `${selected.length} SELECTED` : 'ALL (DEFAULT)'}
        </span>
      </div>

      <div style={{ display: 'flex', gap: sp[3], marginBottom: sp[3] }}>
        <button onClick={selectAllVisible} style={linkBtn}>Select all {search ? 'matching' : `${library.length}`}</button>
        {selected.length > 0 && <button onClick={clearAll} style={linkBtn}>Clear selection</button>}
      </div>

      <div style={{
        maxHeight: 260, overflowY: 'auto', border: `1px solid ${P.hair}`, borderRadius: radius.md,
        background: P.deep,
      }}>
        {filtered.length === 0 && (
          <div style={{ padding: sp[4], fontFamily: inter, fontSize: 13, color: P.mute }}>No matches.</div>
        )}
        {filtered.map((item) => {
          const active = selected.includes(item.id);
          return (
            <div
              key={item.id}
              onClick={() => toggle(item.id)}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: sp[3], padding: `${sp[2]}px ${sp[3]}px`,
                borderBottom: `1px solid ${P.hair}`, cursor: 'pointer',
                background: active ? P.goldWash : 'transparent',
                transition: `background 120ms ${ease}`,
              }}
            >
              <div style={{
                width: 16, height: 16, borderRadius: 4, flexShrink: 0, marginTop: 2,
                border: `1px solid ${active ? P.gold : P.hairStrong}`,
                background: active ? P.gold : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, color: P.ink,
              }}>
                {active ? '✓' : ''}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: inter, fontSize: 13, color: active ? P.bright : P.cream, lineHeight: 1.4 }}>
                  {renderLabel(item)}
                </div>
                {renderMeta(item) && (
                  <div style={{ fontFamily: mono, fontSize: 10, color: P.mute, marginTop: 2 }}>
                    {renderMeta(item)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const linkBtn = {
  background: 'none', border: 'none', padding: 0, cursor: 'pointer',
  fontFamily: mono, fontSize: 10, color: P.gold, letterSpacing: '0.08em', textDecoration: 'underline',
};
