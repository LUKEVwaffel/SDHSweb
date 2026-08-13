import { P, mono, inter, fs, sp, radius } from '../../admin/theme.js';

const PERIODS = [2, 3, 4, 5, 6];

function Label({ children }) {
  return (
    <label style={{ display: 'block', fontFamily: mono, fontSize: fs.micro, color: P.gold, letterSpacing: '0.2em', marginBottom: sp[2] }}>
      {children}
    </label>
  );
}

const fieldStyle = {
  width: '100%', padding: sp[3], borderRadius: radius.sm,
  border: `1px solid ${P.hair}`, background: P.deep, color: P.cream,
  fontFamily: inter, fontSize: 14, boxSizing: 'border-box',
};

function Field({ label, value, onChange, placeholder, multiline }) {
  const Tag = multiline ? 'textarea' : 'input';
  return (
    <div style={{ marginBottom: sp[4] }}>
      <Label>{label}</Label>
      <Tag
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={multiline ? 3 : undefined}
        style={multiline ? { ...fieldStyle, resize: 'vertical' } : fieldStyle}
      />
    </div>
  );
}

/**
 * Range TV's period-based schedule engine (src/lib/tvRangeSchedule.js) reads
 * every string here from range_schedule_config — this tab is the only place
 * that config is edited. Only shown when Range is the selected screen (Range
 * is the only screen with a schedule engine; Outside just runs the same
 * carousel/widget rotation all day).
 */
function addCustomBlock(blocks) {
  return [...blocks, { id: crypto.randomUUID(), text: '' }];
}

function updateCustomBlock(blocks, id, text) {
  return blocks.map((b) => (b.id === id ? { ...b, text } : b));
}

function removeCustomBlock(blocks, id) {
  return blocks.filter((b) => b.id !== id);
}

export default function StepRangeSchedule({ config, onChange }) {
  const periodCompany = config.periodCompany ?? {};
  const customBlocks = config.customBlocks ?? [];

  return (
    <div>
      <div style={{ fontFamily: mono, fontSize: 10, color: P.gold, letterSpacing: '0.24em', marginBottom: sp[2] }}>
        RANGE SCHEDULE ENGINE
      </div>
      <div style={{ fontFamily: inter, fontSize: 13, color: P.mute, marginBottom: sp[5], lineHeight: 1.5 }}>
        Drives what Range shows period-by-period, using today's Bell Schedule (tab above) to know Normal vs T2 times.
        Every message here is editable — nothing about Range's schedule is hardcoded.
      </div>

      <div style={{
        padding: sp[5], borderRadius: radius.lg, border: `1px solid ${P.hairStrong}`, marginBottom: sp[5],
      }}>
        <div style={{ fontFamily: mono, fontSize: fs.micro, color: P.gold, letterSpacing: '0.2em', marginBottom: sp[3] }}>
          PERIOD → COMPANY
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: sp[3] }}>
          {PERIODS.map((n) => (
            <div key={n}>
              <Label>{n}{n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'} PERIOD</Label>
              <input
                value={periodCompany[String(n)] ?? ''}
                onChange={(e) => onChange({ periodCompany: { ...periodCompany, [String(n)]: e.target.value } })}
                style={fieldStyle}
              />
            </div>
          ))}
        </div>

        <div style={{ marginTop: sp[4] }}>
          <Label>WELCOME WINDOW (MINUTES)</Label>
          <input
            type="number" min={1} max={60}
            value={config.welcomeWindowMinutes ?? 20}
            onChange={(e) => onChange({ welcomeWindowMinutes: Number(e.target.value) || 0 })}
            style={{ ...fieldStyle, maxWidth: 120 }}
          />
        </div>
      </div>

      <div style={{ padding: sp[5], borderRadius: radius.lg, border: `1px solid ${P.hairStrong}` }}>
        <div style={{ fontFamily: mono, fontSize: fs.micro, color: P.gold, letterSpacing: '0.2em', marginBottom: sp[3] }}>
          MESSAGES
        </div>

        <Field label="1ST PERIOD — PLANNING MESSAGE" value={config.planningMessage ?? ''}
          onChange={(v) => onChange({ planningMessage: v })} />

        <Field label="T2 BLOCK MESSAGE" value={config.t2Message ?? ''}
          onChange={(v) => onChange({ t2Message: v })} />

        <Field label="1ST LUNCH — WELCOME" value={config.lunch1WelcomeMessage ?? ''}
          onChange={(v) => onChange({ lunch1WelcomeMessage: v })} />

        <Field label="1ST LUNCH — REMINDER" value={config.lunch1ReminderText ?? ''}
          onChange={(v) => onChange({ lunch1ReminderText: v })} multiline />

        <Field label="COMPANY WELCOME TEMPLATE (USE {company})" value={config.companyWelcomeTemplate ?? ''}
          onChange={(v) => onChange({ companyWelcomeTemplate: v })} placeholder="Welcome {company} Company" />

        <Field label="1SGT ATTENDANCE REMINDER" value={config.attendanceReminderTemplate ?? ''}
          onChange={(v) => onChange({ attendanceReminderTemplate: v })} />
      </div>

      {/* Item 5: flexible content structure for the welcome screens — an
          ordered array of free-text blocks (each just {id, text}), so a new
          line of content is an add-block click, never a code change. Renders
          under the attendance reminder on TvRangeCompanyWelcomeScreen.jsx,
          same order top to bottom. */}
      <div style={{ padding: sp[5], borderRadius: radius.lg, border: `1px solid ${P.hairStrong}`, marginTop: sp[5] }}>
        <div style={{ fontFamily: mono, fontSize: fs.micro, color: P.gold, letterSpacing: '0.2em', marginBottom: sp[3] }}>
          WELCOME SCREEN — EXTRA CONTENT
        </div>
        <div style={{ fontFamily: inter, fontSize: 13, color: P.mute, marginBottom: sp[4], lineHeight: 1.5 }}>
          Optional lines shown under the attendance reminder on every company welcome screen. Add as many as needed —
          nothing here requires a code change.
        </div>

        {customBlocks.map((block, i) => (
          <div key={block.id} style={{ display: 'flex', gap: sp[2], marginBottom: sp[3], alignItems: 'flex-start' }}>
            <div style={{
              flexShrink: 0, width: 24, height: 24, marginTop: sp[3] - 12, borderRadius: '50%',
              border: `1px solid ${P.hair}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: mono, fontSize: fs.micro, color: P.mute,
            }}>
              {i + 1}
            </div>
            <textarea
              value={block.text}
              onChange={(e) => onChange({ customBlocks: updateCustomBlock(customBlocks, block.id, e.target.value) })}
              placeholder="Extra line for the welcome screen…"
              rows={2}
              style={{ ...fieldStyle, resize: 'vertical', flex: 1 }}
            />
            <button
              onClick={() => onChange({ customBlocks: removeCustomBlock(customBlocks, block.id) })}
              style={{
                flexShrink: 0, padding: `${sp[2]}px ${sp[3]}px`, borderRadius: radius.sm,
                border: `1px solid ${P.hair}`, background: 'transparent', color: P.mute,
                fontFamily: mono, fontSize: fs.micro, letterSpacing: '0.1em', cursor: 'pointer',
              }}
            >
              REMOVE
            </button>
          </div>
        ))}

        <button
          onClick={() => onChange({ customBlocks: addCustomBlock(customBlocks) })}
          style={{
            padding: `${sp[2]}px ${sp[4]}px`, borderRadius: radius.sm,
            border: `1px dashed ${P.hairStrong}`, background: 'transparent', color: P.gold,
            fontFamily: mono, fontSize: fs.micro, letterSpacing: '0.1em', cursor: 'pointer',
          }}
        >
          + ADD LINE
        </button>
      </div>
    </div>
  );
}
