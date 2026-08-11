import { P, mono, inter, fs, sp, radius, shadow } from '../../admin/theme.js';

const NAME_MAX = 60;
const NOTE_MAX = 120;
const TAG_MAX = 20;

/**
 * Manual (staff-typed) shoutout entry — attendance, honors, whatever isn't a
 * birthday. No PII beyond what staff chooses to type, same trust level as
 * the Custom Message step, so it writes straight through tv_daily_settings'
 * normal anon+authenticated policy (see supabase/tv_shoutouts.sql) — the
 * birthday half of the widget is separate, computed server-side, and never
 * editable here. Live-preview pattern copied from StepWidgetMode.jsx's
 * Custom Message step so the 1SGT sees exactly what the kiosk will show.
 */
export default function StepShoutout({ name, note, tag, onChange }) {
  return (
    <div>
      <div style={{ fontFamily: mono, fontSize: 10, color: P.gold, letterSpacing: '0.24em', marginBottom: sp[2] }}>
        SHOUTOUT
      </div>
      <div style={{ fontFamily: inter, fontSize: 13, color: P.mute, marginBottom: sp[5], lineHeight: 1.5 }}>
        A quick recognition — perfect attendance, an honor, whatever's worth calling out. Birthdays show up here
        automatically from the roster and don't need anything from you. Clear the name to take this one down.
      </div>

      <div style={{
        padding: sp[5], borderRadius: radius.lg,
        background: `linear-gradient(160deg, ${P.goldWash}, transparent)`,
        border: `1px solid ${P.hairStrong}`, boxShadow: shadow.md,
      }}>
        <label style={{ display: 'block', fontFamily: mono, fontSize: fs.micro, color: P.gold, letterSpacing: '0.2em', marginBottom: sp[2] }}>
          NAME
        </label>
        <input
          value={name}
          onChange={(e) => onChange({ name: e.target.value.slice(0, NAME_MAX) })}
          placeholder="C/CPL Jamie Ortiz"
          style={{
            width: '100%', padding: sp[3], borderRadius: radius.sm,
            border: `1px solid ${P.hair}`, background: P.deep, color: P.cream,
            fontFamily: inter, fontSize: 14, marginBottom: sp[4], boxSizing: 'border-box',
          }}
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: `0 ${sp[3]}px`, marginBottom: sp[4] }}>
          <div>
            <label style={{ display: 'block', fontFamily: mono, fontSize: fs.micro, color: P.gold, letterSpacing: '0.2em', marginBottom: sp[2] }}>
              TAG
            </label>
            <input
              value={tag}
              onChange={(e) => onChange({ tag: e.target.value.slice(0, TAG_MAX).toUpperCase() })}
              placeholder="HONOR"
              style={{
                width: '100%', padding: sp[3], borderRadius: radius.sm,
                border: `1px solid ${P.hair}`, background: P.deep, color: P.cream,
                fontFamily: mono, fontSize: 13, letterSpacing: '0.08em', boxSizing: 'border-box',
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontFamily: mono, fontSize: fs.micro, color: P.gold, letterSpacing: '0.2em', marginBottom: sp[2] }}>
              NOTE
            </label>
            <input
              value={note}
              onChange={(e) => onChange({ note: e.target.value.slice(0, NOTE_MAX) })}
              placeholder="Perfect attendance, 3rd month running"
              style={{
                width: '100%', padding: sp[3], borderRadius: radius.sm,
                border: `1px solid ${P.hair}`, background: P.deep, color: P.cream,
                fontFamily: inter, fontSize: 14, boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        <div style={{ fontFamily: mono, fontSize: fs.micro, color: P.faint, letterSpacing: '0.2em', marginBottom: sp[2] }}>
          LIVE PREVIEW — WHAT THE KIOSK SHOWS
        </div>
        <div style={{
          padding: sp[5], borderRadius: radius.lg, background: P.navy,
          border: `1px solid ${P.hair}`, boxShadow: shadow.sm,
        }}>
          <div style={{ fontFamily: mono, fontSize: fs.micro, color: P.gold, letterSpacing: '0.24em', marginBottom: sp[3] }}>
            SHOUTOUTS
          </div>
          {name ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: sp[3] }}>
              <span style={{
                fontFamily: mono, fontSize: fs.micro, color: P.ink, background: P.gold,
                padding: '3px 8px', borderRadius: radius.pill, letterSpacing: '0.1em', flexShrink: 0,
              }}>
                {tag || 'RECOGNITION'}
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: inter, fontSize: fs.base, color: P.cream, fontWeight: 600 }}>{name}</div>
                {note && <div style={{ fontFamily: inter, fontSize: fs.xs, color: P.mute }}>{note}</div>}
              </div>
            </div>
          ) : (
            <span style={{ fontFamily: inter, fontSize: fs.sm, color: P.faint }}>Nothing set — this section won't show on the kiosk.</span>
          )}
        </div>
      </div>
    </div>
  );
}
