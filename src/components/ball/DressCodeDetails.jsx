import { P, mono } from '../admin/theme';
import { DRESS_APPROVERS, WESTON } from '../../lib/ballApprovers';
import {
  FEMALE_AVOID, FEMALE_WEAR, MALE_AVOID, MALE_WEAR, DRESS_APPROVAL_RULES,
} from '../../lib/ballDressCode';
import { openBallDressCodePdf } from '../../lib/ballDressCodePdf';

// Full Military Ball dress code — female + male, what to wear / what not to
// wear, plus the approval process and approver contacts. Shared by the guest
// verify page and the signup wizard's last step. Standalone styling (public
// pages, no admin session).
//
// Props:
//   note   — optional extra line from ball_config.dress_code_text, shown last.
//   only   — 'female' | 'male' to render just one side (wizard uniform vs
//            dress sections). Omit to show both.

function List({ title, items, tone }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontFamily: mono, fontSize: 11, color: tone === 'bad' ? P.red : P.gold, letterSpacing: '0.12em', marginBottom: 6 }}>
        {title}
      </div>
      <ul style={{ margin: 0, paddingLeft: 18, fontFamily: mono, fontSize: 13, color: P.mute, lineHeight: 1.65 }}>
        {items.map((t) => <li key={t}>{t}</li>)}
      </ul>
    </div>
  );
}

function Block({ heading, avoid, wear }) {
  return (
    <div style={{ border: `1px solid ${P.hair}`, background: P.navy, padding: 18, marginBottom: 14 }}>
      <div style={{ fontFamily: mono, fontSize: 11, color: P.cream, letterSpacing: '0.16em', marginBottom: 12 }}>{heading}</div>
      <List title="DO NOT WEAR" items={avoid} tone="bad" />
      <List title="WEAR" items={wear} tone="good" />
    </div>
  );
}

export default function DressCodeDetails({ note, only }) {
  return (
    <div>
      {only !== 'male' && <Block heading="FEMALES" avoid={FEMALE_AVOID} wear={FEMALE_WEAR} />}
      {only !== 'female' && <Block heading="MALES" avoid={MALE_AVOID} wear={MALE_WEAR} />}

      {only !== 'male' ? (
        <div style={{ border: `1px solid ${P.hair}`, background: P.navy, padding: 18, marginBottom: 14 }}>
          <div style={{ fontFamily: mono, fontSize: 11, color: P.gold, letterSpacing: '0.16em', marginBottom: 10 }}>DRESS APPROVAL</div>
          <ul style={{ margin: 0, paddingLeft: 18, fontFamily: mono, fontSize: 13, color: P.mute, lineHeight: 1.65 }}>
            {DRESS_APPROVAL_RULES.map((t) => <li key={t}>{t}</li>)}
          </ul>
          <div style={{ marginTop: 12, fontFamily: mono, fontSize: 13, color: P.cream, lineHeight: 1.9 }}>
            {DRESS_APPROVERS.map((a) => (
              <div key={a.name}>{a.name} — {a.phone} <span style={{ color: P.mute }}>(females)</span></div>
            ))}
            {only !== 'female' && (
              <div>{WESTON.name} — {WESTON.phone} <span style={{ color: P.mute }}>(males)</span></div>
            )}
          </div>
        </div>
      ) : (
        <div style={{ border: `1px solid ${P.hair}`, background: P.navy, padding: 18, marginBottom: 14, fontFamily: mono, fontSize: 13, color: P.mute, lineHeight: 1.65 }}>
          Questions about your suit or Class A? Message {WESTON.name} — {WESTON.phone}.
          Turn in your field trip form when you pay for your tickets.
        </div>
      )}

      {note && (
        <p style={{ fontFamily: mono, fontSize: 12, color: P.mute, lineHeight: 1.6, whiteSpace: 'pre-line', marginBottom: 14 }}>{note}</p>
      )}

      <button
        type="button"
        onClick={() => openBallDressCodePdf({ only, note })}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer',
          background: 'transparent', border: `1px solid ${P.gold}`, color: P.gold,
          fontFamily: mono, fontSize: 12, letterSpacing: '0.08em', padding: '10px 16px',
        }}
      >
        ↓ SAVE / PRINT THIS DRESS CODE (PDF)
      </button>
      <div style={{ fontFamily: mono, fontSize: 11, color: P.mute, marginTop: 6, lineHeight: 1.5 }}>
        Opens a clean one-page version — save it as a PDF and keep it on your phone while you shop.
      </div>
    </div>
  );
}
