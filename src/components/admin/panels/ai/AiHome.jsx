import { useState } from 'react';
import ConversationHistory from './ConversationHistory';
import { P, mono, inter, fraunces, fs, sp, radius, glass } from '../../theme';

// Home screen: input box plus past conversations. No morning brief yet —
// that is role-aware, cached-for-the-day, and pulls from open
// problems/this-week/people data that does not exist in this phase. Adding
// placeholder cards now would just be thrown away when that phase lands.
const STARTER_PROMPTS = [
  'Create a printable PDF briefing for this week’s events',
  'How many cadets have no photo consent on file',
  'Who is overdue on a liability release for an upcoming Raiders event',
  'Review this interface for hierarchy, accessibility, mobile behavior, and missing states',
  'Design a polished, accessible admin workflow for reviewing and applying changes',
  'Write production-ready React and CSS for a responsive DISPATCH panel',
];

export default function AiHome({ role, conversations, onSend, onOpenConversation, onOpenRifleImport }) {
  const [value, setValue] = useState('');

  const submit = () => {
    const text = value.trim();
    if (!text) return;
    setValue('');
    onSend(text);
  };

  return (
    <div className="dispatch-ai-home">
      <div style={{ display: 'flex', flexDirection: 'column', gap: sp[2] }}>
        <div style={{ fontFamily: fraunces, fontStyle: 'italic', fontWeight: 800, fontSize: 'clamp(32px, 4vw, 48px)', color: P.cream, lineHeight: 1.05 }}>
          Ask DISPATCH.
        </div>
        <div style={{ fontFamily: inter, fontSize: fs.base, color: P.mute }}>
          {role === 's5' ? 'S-5 · scoped access' : 'S-6 · full access'}
        </div>
      </div>

      <div style={{
        borderRadius: radius.xl, background: glass.panelFill, backdropFilter: glass.blur, WebkitBackdropFilter: glass.blur,
        border: glass.border, boxShadow: `${glass.insetHi}, ${glass.outerGlowLg}`,
      }}>
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
          placeholder="Tell DISPATCH what you need"
          rows={2}
          style={{
            boxSizing: 'border-box', width: '100%', background: 'transparent', border: 'none', outline: 'none', resize: 'none',
            color: P.cream, fontFamily: inter, fontSize: fs.lg, padding: `${sp[5]}px ${sp[6]}px ${sp[3]}px`,
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: sp[2], padding: `0 ${sp[3]}px ${sp[3]}px ${sp[5]}px` }}>
          <span style={{ flex: 1, fontFamily: mono, fontSize: fs.micro, color: P.faint, letterSpacing: '0.08em' }}>
            Enter to send, Shift+Enter for a new line
          </span>
          <button
            onClick={submit}
            disabled={!value.trim()}
            title="Send"
            style={{
              width: 36, height: 36, borderRadius: '50%', border: 'none', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: glass.goldFill, color: P.ink, fontSize: fs.md, fontWeight: 600,
              boxShadow: `${glass.insetHi}, 0 6px 18px rgba(201,169,97,0.35)`,
              cursor: value.trim() ? 'pointer' : 'not-allowed', opacity: value.trim() ? 1 : 0.5,
            }}
          >
            ↑
          </button>
        </div>
      </div>

      {onOpenRifleImport && (
        <button type="button" onClick={onOpenRifleImport} style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', padding: '15px 18px', borderRadius: radius.lg, border: '1px solid rgba(201,169,97,0.24)', background: 'linear-gradient(105deg,rgba(201,169,97,0.12),rgba(20,40,71,0.26))', color: P.cream, textAlign: 'left', cursor: 'pointer' }}>
          <span aria-hidden="true" style={{ display: 'grid', placeItems: 'center', width: 36, height: 36, borderRadius: radius.md, background: 'rgba(201,169,97,0.16)', color: P.bright, fontSize: 18 }}>↥</span>
          <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <strong style={{ fontFamily: inter, fontSize: fs.base, fontWeight: 600 }}>Import rifle scores</strong>
            <span style={{ fontFamily: inter, fontSize: fs.sm, color: P.mute }}>Upload a sheet or photo, verify shooter matches, then publish scores.</span>
          </span>
          <span aria-hidden="true" style={{ color: P.gold, fontSize: 18 }}>→</span>
        </button>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: sp[2] }}>
        {(role === 's6' ? [
          'Make a PDF roster of all LET 2 cadets in Alpha company',
          'Bundle all guests awaiting Ball verification into one printable PDF',
          'Create a PDF checklist of missing Ball guest field-trip forms',
          'Review this interface for hierarchy, accessibility, mobile behavior, and missing states',
          'Design an accessible admin workflow with loading, empty, error, and success states',
          'Write production-ready React and CSS for a responsive DISPATCH panel',
        ] : STARTER_PROMPTS).map((p) => (
          <button
            key={p}
            onClick={() => setValue(p)}
            style={{
              padding: '8px 15px', borderRadius: radius.pill, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))',
              boxShadow: `inset 0 1px 0 rgba(255,255,255,0.07), 0 0 0 1px rgba(255,255,255,0.06)`,
              fontFamily: inter, fontSize: fs.sm, color: P.cream,
            }}
          >
            {p}
          </button>
        ))}
      </div>

      <ConversationHistory conversations={conversations} onOpenConversation={onOpenConversation} />
    </div>
  );
}
