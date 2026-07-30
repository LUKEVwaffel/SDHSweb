import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase as SB } from '../lib/supabaseClient';
import { TEAMS } from '../lib/teams';
import { getDeviceId } from '../lib/fingerprint';

const P = {
  ink: '#06101F', navy: '#142847', deep: '#0A1628',
  gold: '#C9A961', bright: '#E8C77A', cream: '#F4ECD8',
  mute: 'rgba(244,236,216,0.55)', faint: 'rgba(244,236,216,0.4)',
  hair: 'rgba(201,169,97,0.22)', green: '#27AE60', red: '#C0392B',
};

// FAQ.teams (optional string[] of team ids from lib/teams.js) renders a
// pill-button under that answer, one per referenced team, navigating to
// team.route.
// Only one question is open at a time across the whole section (openId lifted
// to FaqSection) so the closed-state list stays compact instead of every row
// being able to expand independently.
function FaqItem({ item, qNum, isOpen, onToggle }) {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(false);
  const linkedTeams = (item.teams || []).map((id) => TEAMS.find((t) => t.id === id)).filter(Boolean);

  return (
    <div style={{ borderBottom: `1px solid ${P.hair}` }}>
      <button
        onClick={onToggle}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        aria-expanded={isOpen}
        style={{
          width: '100%', textAlign: 'left', cursor: 'pointer', background: hovered ? 'rgba(201,169,97,0.04)' : 'none',
          border: 'none', padding: '12px 4px', display: 'flex', alignItems: 'center',
          gap: 14, transition: 'background 0.15s',
        }}
      >
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: P.mute, letterSpacing: '0.08em', width: 30, flexShrink: 0 }}>Q{qNum}</span>
        <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 14.5, color: P.cream, letterSpacing: '0.01em', fontWeight: 500, flex: 1 }}>{item.q}</span>
        <span style={{
          width: 18, height: 18, flexShrink: 0, borderRadius: '50%', border: `1px solid ${P.hair.replace('0.22', '0.4')}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
          color: isOpen ? P.ink : P.gold, background: isOpen ? P.gold : 'transparent',
          transform: isOpen ? 'rotate(45deg)' : 'none', transition: 'transform 0.2s, background 0.2s, color 0.2s',
        }}>+</span>
      </button>
      <div style={{ display: 'grid', gridTemplateRows: isOpen ? '1fr' : '0fr', transition: 'grid-template-rows 0.25s ease' }}>
        <div style={{ overflow: 'hidden' }}>
          <div style={{ padding: '0 4px 16px 44px', maxWidth: 660 }}>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13.5, color: P.mute, lineHeight: 1.7, margin: 0 }}>{item.a}</p>
            {linkedTeams.length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                {linkedTeams.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => navigate(`/${t.route}`)}
                    style={{
                      background: 'transparent', border: `1px solid ${t.accent}`, color: t.accent,
                      fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, letterSpacing: '0.12em',
                      padding: '5px 11px', cursor: 'pointer',
                    }}
                  >{t.label.toUpperCase()} →</button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function FaqCategory({ category, startIndex, openId, setOpenId }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2 }}>
        <div style={{ width: 16, height: 1, background: P.hair.replace('0.22', '0.4') }} />
        <h4 style={{ fontFamily: 'Oswald, sans-serif', fontSize: 12.5, color: P.bright, letterSpacing: '0.14em', fontWeight: 600, textTransform: 'uppercase', margin: 0 }}>{category.category}</h4>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: P.mute, letterSpacing: '0.08em' }}>
          {category.items.length} Q{category.items.length > 1 ? 'S' : ''}
        </span>
      </div>
      {category.items.map((item, i) => {
        const id = startIndex + i;
        return (
          <FaqItem
            key={id}
            item={item}
            qNum={String(id + 1).padStart(2, '0')}
            isOpen={openId === id}
            onToggle={() => setOpenId((cur) => (cur === id ? null : id))}
          />
        );
      })}
    </div>
  );
}

function FocusField({ as = 'input', style: extraStyle = {}, ...rest }) {
  const [focused, setFocused] = useState(false);
  const Tag = as;
  return (
    <Tag
      {...rest}
      onFocus={(e) => { setFocused(true); rest.onFocus?.(e); }}
      onBlur={(e) => { setFocused(false); rest.onBlur?.(e); }}
      style={{
        width: '100%', background: focused ? 'rgba(6,16,31,0.8)' : 'rgba(6,16,31,0.55)',
        border: `1px solid ${focused ? P.gold : P.hair}`, color: P.cream,
        fontFamily: 'Inter, sans-serif', fontSize: 14, padding: '13px 15px', outline: 'none',
        boxSizing: 'border-box', resize: 'vertical', transition: 'border-color 0.15s, background 0.15s',
        ...extraStyle,
      }}
    />
  );
}

function SubmitQuestion() {
  const [question, setQuestion] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [state, setState] = useState('idle'); // idle | busy | ok | err
  const [msg, setMsg] = useState('');

  async function submit(e) {
    e.preventDefault();
    if (honeypot) return; // bot
    const clean = question.trim();
    const cleanEmail = email.trim();
    if (!clean) { setState('err'); setMsg('Enter a question.'); return; }
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setState('err'); setMsg('Enter a valid email — we reply there.'); return;
    }
    setState('busy'); setMsg('');
    const fp = await getDeviceId().catch(() => null);
    const { data, error } = await SB.from('faq_questions').insert({
      question: clean,
      submitter_name: name.trim() || null,
      submitter_email: cleanEmail,
      submitter_fp: fp,
    }).select('id').single();
    if (error) { setState('err'); setMsg('Could not submit — please try again.'); return; }
    // Best-effort notify — insert already succeeded regardless of outcome.
    SB.functions.invoke('notify-question-submitted', { body: { question_id: data.id } }).catch(() => {});
    setState('ok');
    setMsg('Question submitted — thanks for asking.');
    setQuestion(''); setName(''); setEmail('');
  }

  const boxStyle = {
    background: `linear-gradient(160deg, ${P.navy} 0%, #16294a 100%)`, border: `1px solid ${P.hair.replace('0.22', '0.4')}`,
    padding: '36px 40px', position: 'relative', overflow: 'hidden',
  };
  const glow = (
    <div style={{
      position: 'absolute', top: '-50%', right: '-10%', width: 240, height: 240, pointerEvents: 'none',
      background: 'radial-gradient(circle, rgba(201,169,97,0.12), transparent 70%)',
    }} />
  );

  if (state === 'ok') {
    return (
      <div style={{ ...boxStyle, textAlign: 'center' }}>
        {glow}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: P.green, letterSpacing: '0.18em' }}>✓ SUBMITTED</div>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: P.mute, margin: '8px 0 0' }}>{msg}</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} style={boxStyle}>
      {glow}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 24, height: 1, background: P.gold }} />
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: P.gold, letterSpacing: '0.28em' }}>DON'T SEE YOUR QUESTION?</div>
        </div>
        <h3 style={{ fontFamily: 'Oswald, sans-serif', fontSize: 22, color: P.cream, margin: '14px 0 8px', fontWeight: 700, letterSpacing: '0.01em' }}>
          Ask us directly — we reply by email
        </h3>
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13.5, color: P.mute, margin: '0 0 22px' }}>
          A real instructor answers, usually within a couple of days.
        </p>
        <FocusField
          as="textarea" value={question} onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask your question…" rows={3} style={{ marginBottom: 14 }}
        />
        <input aria-hidden="true" tabIndex={-1} autoComplete="off" value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)} name="company_website"
          style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <FocusField value={name} onChange={(e) => setName(e.target.value)} placeholder="Name · optional" />
          <FocusField type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email · we'll reply here" />
        </div>
        <button type="submit" disabled={state === 'busy'} style={{
          background: state === 'busy' ? P.hair : P.gold, color: P.ink, border: 'none',
          cursor: state === 'busy' ? 'wait' : 'pointer', fontFamily: "'JetBrains Mono', monospace",
          fontSize: 12, letterSpacing: '0.18em', fontWeight: 700, padding: '15px 26px',
        }}>{state === 'busy' ? 'SUBMITTING…' : 'SUBMIT QUESTION →'}</button>
        {state === 'err' && <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: P.red, marginTop: 10 }}>{msg}</div>}
      </div>
    </form>
  );
}

// categories: [{ category, items: [{ q, a, teams?: string[] }] }]. teams
// entries must match ids in lib/teams.js. Question numbering (Q01, Q02...) is
// continuous across categories. Only one question is open at a time.
// Section heading/divider is owned by the parent band (see About.jsx) — this
// component only lays out its own content.
export default function FaqSection({ categories }) {
  const [openId, setOpenId] = useState(null);
  let cursor = 0;

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 26, marginBottom: 30 }}>
        {categories.map((cat) => {
          const startIndex = cursor;
          cursor += cat.items.length;
          return (
            <FaqCategory
              key={cat.category}
              category={cat}
              startIndex={startIndex}
              openId={openId}
              setOpenId={setOpenId}
            />
          );
        })}
      </div>
      <SubmitQuestion />
    </div>
  );
}
