import { useState } from 'react';
import { P, mono, oswald, inter, fs, sp, radius, shadow, ease } from '../../admin/theme.js';
import QuoteVerseSelect from './QuoteVerseSelect.jsx';
import quotes from '../../../data/quotes.json';
import verses from '../../../data/verses.json';

const MODES = [
  { id: 'facts', label: 'Historical Facts', glyph: '◷', hint: 'On this day in history — the default rotator.' },
  { id: 'quote', label: 'Quote of the Day', glyph: '❝', hint: 'WWII & military leaders, Churchill — real attribution.' },
  { id: 'verse', label: 'Bible Verse', glyph: '✝', hint: 'Curated, encouraging verses.' },
  { id: 'custom', label: 'Custom Message', glyph: '✎', hint: 'Your call — write it, sign it, own it.' },
];

const MESSAGE_MAX = 280;

// The one part of this screen the 1SGT will personally touch and feel
// ownership over — mode cards get a real glow (not just a border swap), and
// Custom mode gets a live preview so he sees exactly what cadets will see as
// he types, instead of trusting a blind text field.
function LibraryPicker({ library, selectedIds, onChange, itemNoun, ...selectProps }) {
  const [expanded, setExpanded] = useState(selectedIds.length > 0);

  if (!expanded) {
    return (
      <div style={{
        padding: sp[4], borderRadius: radius.md, border: `1px solid ${P.hair}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: sp[3],
      }}>
        <span style={{ fontFamily: inter, fontSize: 14, color: P.mute }}>
          Cycling through all {library.length} {itemNoun} today. That's the easy default — no setup needed.
        </span>
        <button onClick={() => setExpanded(true)} style={linkBtn}>Pick specific ones instead</button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: sp[2] }}>
        <button onClick={() => { setExpanded(false); onChange([]); }} style={linkBtn}>
          Never mind, cycle all {library.length}
        </button>
      </div>
      <QuoteVerseSelect library={library} selected={selectedIds} onChange={onChange} {...selectProps} />
    </div>
  );
}

const linkBtn = {
  background: 'none', border: 'none', padding: 0, cursor: 'pointer',
  fontFamily: mono, fontSize: 11, color: P.gold, letterSpacing: '0.04em', textDecoration: 'underline',
};

export default function StepWidgetMode({ mode, customMessage, customSignoff, selectedQuoteIds, selectedVerseIds, onChange }) {
  return (
    <div>
      <div style={{ fontFamily: mono, fontSize: 10, color: P.gold, letterSpacing: '0.24em', marginBottom: sp[2] }}>
        BOTTOM WIDGET
      </div>
      <div style={{ fontFamily: inter, fontSize: 13, color: P.mute, marginBottom: sp[5], lineHeight: 1.5 }}>
        Whatever you pick stays live until you change it — it won't reset overnight.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: sp[3], marginBottom: mode !== 'facts' ? sp[5] : 0 }}>
        {MODES.map((m) => {
          const active = mode === m.id;
          return (
            <button
              key={m.id}
              onClick={() => onChange({ mode: m.id })}
              style={{
                textAlign: 'left', padding: sp[4], borderRadius: radius.md,
                border: `1px solid ${active ? P.gold : P.hair}`,
                background: active ? P.goldWash : 'transparent',
                boxShadow: active ? shadow.glow : 'none',
                cursor: 'pointer', transition: `all 200ms ${ease}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: sp[2], marginBottom: sp[1] }}>
                <span style={{ fontSize: 18, color: active ? P.bright : P.gold }}>{m.glyph}</span>
                <span style={{ fontFamily: oswald, fontSize: 16, color: active ? P.bright : P.cream }}>{m.label}</span>
              </div>
              <div style={{ fontFamily: inter, fontSize: 12, color: P.mute, lineHeight: 1.4 }}>{m.hint}</div>
            </button>
          );
        })}
      </div>

      {mode === 'quote' && (
        <LibraryPicker
          library={quotes}
          selectedIds={selectedQuoteIds}
          onChange={(ids) => onChange({ selectedQuoteIds: ids })}
          itemNoun="quotes"
          renderLabel={(q) => `"${q.text}"`}
          renderMeta={(q) => `— ${q.author}${q.source ? `, ${q.source}` : ''}`}
          placeholder="Search quotes by text or author…"
        />
      )}

      {mode === 'verse' && (
        <LibraryPicker
          library={verses}
          selectedIds={selectedVerseIds}
          onChange={(ids) => onChange({ selectedVerseIds: ids })}
          itemNoun="verses"
          renderLabel={(v) => v.text}
          renderMeta={(v) => v.reference}
          placeholder="Search verses by text or reference…"
        />
      )}

      {mode === 'custom' && (
        <div style={{
          padding: sp[5], borderRadius: radius.lg,
          background: `linear-gradient(160deg, ${P.goldWash}, transparent)`,
          border: `1px solid ${P.hairStrong}`, boxShadow: shadow.md,
        }}>
          <label style={{ display: 'block', fontFamily: mono, fontSize: fs.micro, color: P.gold, letterSpacing: '0.2em', marginBottom: sp[2] }}>
            MESSAGE
          </label>
          <textarea
            value={customMessage}
            onChange={(e) => onChange({ customMessage: e.target.value.slice(0, MESSAGE_MAX) })}
            rows={3}
            placeholder="Type today's message to the battalion…"
            style={{
              width: '100%', resize: 'none', padding: sp[3], borderRadius: radius.sm,
              border: `1px solid ${P.hair}`, background: P.deep, color: P.cream,
              fontFamily: inter, fontSize: 14, lineHeight: 1.5, marginBottom: sp[1],
            }}
          />
          <div style={{ textAlign: 'right', fontFamily: mono, fontSize: fs.micro, color: P.faint, marginBottom: sp[4] }}>
            {customMessage.length}/{MESSAGE_MAX}
          </div>

          <label style={{ display: 'block', fontFamily: mono, fontSize: fs.micro, color: P.gold, letterSpacing: '0.2em', marginBottom: sp[2] }}>
            SIGNED
          </label>
          <input
            value={customSignoff}
            onChange={(e) => onChange({ customSignoff: e.target.value.slice(0, 60) })}
            placeholder="1SGT Smith"
            style={{
              width: '100%', padding: sp[3], borderRadius: radius.sm,
              border: `1px solid ${P.hair}`, background: P.deep, color: P.cream,
              fontFamily: oswald, fontSize: 15, marginBottom: sp[5],
            }}
          />

          <div style={{ fontFamily: mono, fontSize: fs.micro, color: P.faint, letterSpacing: '0.2em', marginBottom: sp[2] }}>
            LIVE PREVIEW — WHAT THE KIOSK SHOWS
          </div>
          <div style={{
            padding: sp[5], borderRadius: radius.lg, background: P.navy,
            border: `1px solid ${P.hair}`, boxShadow: shadow.sm,
          }}>
            <div style={{ fontFamily: mono, fontSize: fs.micro, color: P.gold, letterSpacing: '0.24em', marginBottom: sp[2] }}>
              MESSAGE OF THE DAY
            </div>
            <div style={{ fontFamily: inter, fontSize: fs.base, color: P.cream, lineHeight: 1.5, minHeight: 24 }}>
              {customMessage || <span style={{ color: P.faint }}>Your message will appear here…</span>}
            </div>
            <div style={{ fontFamily: oswald, fontSize: fs.sm, color: P.gold, marginTop: sp[3] }}>
              — {customSignoff || 'Signature'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
