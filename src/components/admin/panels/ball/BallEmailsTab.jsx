import { useState, useEffect, useCallback } from 'react';
import { supabase as SB } from '../../../../lib/supabaseClient';
import { P, mono, sp } from '../../theme';
import { Btn, Label } from '../../shared/ui';

// S-6 prose editor for every automated Military Ball email. Rows live in
// ball_email_templates (RLS: is_s6() only). Each edge-function sender loads its
// row and uses these fields for subject / heading / intro / notice / closing,
// falling back to a built-in default when a field is blank or the row is
// disabled. Dynamic parts (event particulars, the "what remains" checklist,
// the field-trip PDF) are NOT editable here — they stay in code.
//
// Preview + "send test to me" go through the ball-email-preview edge function,
// which renders the chosen email with sample data.

const FIELDS = [
  { key: 'subject', label: 'Subject line', rows: 1 },
  { key: 'heading', label: 'Heading (large serif title)', rows: 1 },
  { key: 'intro_html', label: 'Intro (blank line = new paragraph)', rows: 4 },
  { key: 'notice_html', label: 'Gold callout line (blank = hidden)', rows: 2 },
  { key: 'closing_html', label: 'Closing paragraph (blank = hidden)', rows: 3 },
];

const ta = {
  width: '100%', boxSizing: 'border-box', background: P.deep, border: `1px solid ${P.hair}`,
  color: P.cream, fontFamily: mono, fontSize: 12, padding: '8px 10px', lineHeight: 1.5, resize: 'vertical',
};

export default function BallEmailsTab() {
  const [rows, setRows] = useState(null);
  const [draft, setDraft] = useState({});      // key -> edited fields
  const [openKey, setOpenKey] = useState(null);
  const [flash, setFlash] = useState({});      // key -> message
  const [busy, setBusy] = useState(null);      // `${key}:${action}`
  const [preview, setPreview] = useState(null); // { key, subject, html }
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    const { data, error } = await SB.from('ball_email_templates').select('*').order('key');
    if (error) { setErr(error.message); setRows([]); return; }
    setErr('');
    setRows(data || []);
    const d = {};
    (data || []).forEach((r) => {
      d[r.key] = {
        enabled: r.enabled,
        subject: r.subject || '', heading: r.heading || '',
        intro_html: r.intro_html || '', notice_html: r.notice_html || '', closing_html: r.closing_html || '',
      };
    });
    setDraft(d);
  }, []);

  useEffect(() => { load(); }, [load]);

  const setF = (key, field, value) => setDraft((d) => ({ ...d, [key]: { ...d[key], [field]: value } }));

  async function save(key) {
    setBusy(`${key}:save`);
    setFlash((f) => ({ ...f, [key]: '' }));
    const d = draft[key];
    const { data: { user } } = await SB.auth.getUser();
    const { error } = await SB.from('ball_email_templates').update({
      enabled: d.enabled,
      subject: d.subject.trim() || null,
      heading: d.heading.trim() || null,
      intro_html: d.intro_html.trim() || null,
      notice_html: d.notice_html.trim() || null,
      closing_html: d.closing_html.trim() || null,
      updated_at: new Date().toISOString(),
      updated_by: user?.email || null,
    }).eq('key', key);
    setBusy(null);
    setFlash((f) => ({ ...f, [key]: error ? `Save failed: ${error.message}` : 'Saved ✓' }));
    if (!error) load();
    setTimeout(() => setFlash((f) => ({ ...f, [key]: '' })), 3000);
  }

  async function runPreview(key, sendTest) {
    setBusy(`${key}:${sendTest ? 'test' : 'preview'}`);
    setFlash((f) => ({ ...f, [key]: '' }));
    const { data, error } = await SB.functions.invoke('ball-email-preview', {
      body: { key, send_test: !!sendTest },
    });
    setBusy(null);
    if (error || data?.error) {
      setFlash((f) => ({ ...f, [key]: `Failed: ${data?.error || error.message}` }));
      return;
    }
    if (sendTest) {
      setFlash((f) => ({ ...f, [key]: `Test sent to ${data.sent_to || 'your email'} ✓` }));
      setTimeout(() => setFlash((f) => ({ ...f, [key]: '' })), 4000);
    } else {
      setPreview({ key, subject: data.subject, html: data.html });
    }
  }

  if (rows === null) return <div style={{ fontFamily: mono, fontSize: 13, color: P.mute }}>LOADING…</div>;
  if (err) return <div style={{ fontFamily: mono, fontSize: 12, color: P.red }}>{err} — has ball_email_templates.sql been run?</div>;

  return (
    <div style={{ maxWidth: 760 }}>
      <p style={{ fontFamily: mono, fontSize: 12, color: P.mute, lineHeight: 1.7, marginBottom: sp[4] }}>
        Every automated ball email. Blank field → the built-in default is used. <code style={{ color: P.gold }}>{'{{tokens}}'}</code> are
        filled in when the email sends. The event details block, the “what remains” checklist and the field-trip PDF are built
        automatically and can’t be edited here. Disabling a row stops that email entirely.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: sp[2] }}>
        {rows.map((r) => {
          const d = draft[r.key] || {};
          const open = openKey === r.key;
          return (
            <div key={r.key} style={{ border: `1px solid ${open ? P.hairStrong : P.hair}`, background: P.navy }}>
              <button
                onClick={() => setOpenKey(open ? null : r.key)}
                style={{ width: '100%', textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer', padding: `${sp[3]}px ${sp[4]}px`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: sp[3] }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: mono, fontSize: 13, color: P.cream }}>{r.label}</div>
                  <div style={{ fontFamily: mono, fontSize: 11, color: P.mute, marginTop: 2 }}>{r.description}</div>
                </div>
                <span style={{ fontFamily: mono, fontSize: 10, letterSpacing: '0.1em', padding: '3px 8px', border: `1px solid ${d.enabled ? P.green : P.red}`, color: d.enabled ? P.green : P.red, whiteSpace: 'nowrap' }}>
                  {d.enabled ? 'ON' : 'OFF'}
                </span>
              </button>

              {open && (
                <div style={{ padding: `${sp[2]}px ${sp[4]}px ${sp[4]}px`, borderTop: `1px solid ${P.hair}`, display: 'flex', flexDirection: 'column', gap: sp[3] }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: sp[2], fontFamily: mono, fontSize: 12, color: P.cream, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!d.enabled} onChange={(e) => setF(r.key, 'enabled', e.target.checked)} />
                    Email enabled
                  </label>

                  <div style={{ fontFamily: mono, fontSize: 11, color: P.gold }}>
                    Placeholders: {r.placeholders || '(none)'}
                  </div>

                  {FIELDS.map((f) => (
                    <div key={f.key}>
                      <Label>{f.label}</Label>
                      {f.rows === 1 ? (
                        <input value={d[f.key] ?? ''} onChange={(e) => setF(r.key, f.key, e.target.value)} style={{ ...ta, fontSize: 13 }} />
                      ) : (
                        <textarea rows={f.rows} value={d[f.key] ?? ''} onChange={(e) => setF(r.key, f.key, e.target.value)} style={ta} />
                      )}
                    </div>
                  ))}

                  <div style={{ display: 'flex', gap: sp[2], alignItems: 'center', flexWrap: 'wrap' }}>
                    <Btn size="sm" variant="gold" disabled={busy === `${r.key}:save`} onClick={() => save(r.key)}>
                      {busy === `${r.key}:save` ? 'SAVING…' : 'SAVE'}
                    </Btn>
                    <Btn size="sm" variant="ghost" disabled={busy === `${r.key}:preview`} onClick={() => runPreview(r.key, false)}>
                      {busy === `${r.key}:preview` ? 'RENDERING…' : 'PREVIEW'}
                    </Btn>
                    <Btn size="sm" variant="ghost" disabled={busy === `${r.key}:test`} onClick={() => runPreview(r.key, true)}>
                      {busy === `${r.key}:test` ? 'SENDING…' : 'SEND TEST TO ME'}
                    </Btn>
                    {flash[r.key] && <span style={{ fontFamily: mono, fontSize: 11, color: P.mute }}>{flash[r.key]}</span>}
                  </div>
                  <div style={{ fontFamily: mono, fontSize: 10, color: P.faint }}>
                    Preview / test use sample data. Saved edits apply to the next real send.
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {preview && (
        <div
          onClick={() => setPreview(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: sp[4] }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: P.navy, border: `1px solid ${P.hairStrong}`, width: 'min(680px, 96vw)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: `${sp[3]}px ${sp[4]}px`, borderBottom: `1px solid ${P.hair}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: sp[3] }}>
              <div style={{ fontFamily: mono, fontSize: 12, color: P.cream, minWidth: 0 }}>
                <span style={{ color: P.mute }}>Subject:</span> {preview.subject}
              </div>
              <button onClick={() => setPreview(null)} style={{ background: 'none', border: 'none', color: P.mute, cursor: 'pointer', fontFamily: mono, fontSize: 12 }}>CLOSE ✕</button>
            </div>
            <iframe title="Email preview" sandbox="" srcDoc={preview.html} style={{ border: 'none', width: '100%', height: '70vh', background: '#fff' }} />
          </div>
        </div>
      )}
    </div>
  );
}
