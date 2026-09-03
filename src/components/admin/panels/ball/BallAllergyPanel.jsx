import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase as SB } from '../../../../lib/supabaseClient';
import { P, mono, sp, fs } from '../../theme';
import { Btn, Input, Label, PanelHeader } from '../../shared/ui';

// S-5 food-logistics surface. Cadets who flagged a food allergy on their
// Military Ball signup. No allergy details are stored — S-5 emails the cadet
// directly (send-allergy-email, its own narrow path, NOT the 3-reviewer
// pipeline), which flips the record to 'contacted'. "Mark contacted" covers
// the case where S-5 reached them another way (in person, phone).
function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function fmt(d) {
  return d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '--';
}

export default function BallAllergyPanel() {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  const [openId, setOpenId] = useState(null);
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    const { data, error } = await SB.rpc('ball_allergy_list');
    if (error) { setErr(error.message); setRows([]); return; }
    setErr('');
    setRows(data || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const { pending, contacted } = useMemo(() => {
    const term = q.trim().toLowerCase();
    const v = (rows || []).filter((r) => !term
      || (r.cadet_name || '').toLowerCase().includes(term)
      || (r.cadet_allergy_email || '').toLowerCase().includes(term));
    return {
      pending: v.filter((r) => r.allergy_status === 'pending'),
      contacted: v.filter((r) => r.allergy_status === 'contacted'),
    };
  }, [rows, q]);

  if (rows === null) return <div style={{ fontFamily: mono, fontSize: 13, color: P.mute }}>LOADING…</div>;

  return (
    <div style={{ maxWidth: 780 }}>
      <PanelHeader title="BALL · FOOD ALLERGIES" sub="Cadets who flagged an allergy on their Military Ball signup" />

      <div style={{ display: 'flex', alignItems: 'center', gap: sp[2], marginBottom: sp[4], flexWrap: 'wrap' }}>
        <span style={{
          fontFamily: mono, fontSize: fs.sm, fontWeight: 700, letterSpacing: '0.08em',
          padding: '7px 16px', border: `1px solid ${pending.length ? P.gold : P.hair}`,
          background: pending.length ? P.goldWash : 'transparent',
          color: pending.length ? P.gold : P.mute,
        }}>
          {pending.length} PENDING
        </span>
        <span style={{ fontFamily: mono, fontSize: fs.xs, color: P.mute }}>{rows.length} flagged total</span>
        <Btn size="sm" variant="ghost" onClick={load} style={{ marginLeft: 'auto' }}>REFRESH</Btn>
      </div>

      {rows.length > 6 && (
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or email…" style={{ marginBottom: sp[4] }} />
      )}

      {err && <div style={{ fontFamily: mono, fontSize: 12, color: P.red, marginBottom: sp[3] }}>{err}</div>}

      {rows.length === 0 ? (
        <div style={{ fontFamily: mono, fontSize: 13, color: P.mute, border: `1px dashed ${P.hairStrong}`, padding: sp[5], textAlign: 'center' }}>
          No allergy flags yet.
        </div>
      ) : (
        <>
          <SectionGroup title={`Needs contact · ${pending.length}`} hide={!pending.length}>
            {pending.map((r) => (
              <Row key={r.id} row={r} open={openId === r.id} onToggle={() => setOpenId(openId === r.id ? null : r.id)} onDone={load} />
            ))}
          </SectionGroup>
          <SectionGroup title={`Contacted · ${contacted.length}`} hide={!contacted.length} dim>
            {contacted.map((r) => (
              <Row key={r.id} row={r} open={openId === r.id} onToggle={() => setOpenId(openId === r.id ? null : r.id)} onDone={load} />
            ))}
          </SectionGroup>
        </>
      )}
    </div>
  );
}

function SectionGroup({ title, hide, dim, children }) {
  if (hide) return null;
  return (
    <div style={{ marginBottom: sp[5], opacity: dim ? 0.75 : 1 }}>
      <div style={{ fontFamily: mono, fontSize: fs.micro, letterSpacing: '0.16em', color: P.mute, textTransform: 'uppercase', margin: `0 0 ${sp[2]}px`, display: 'flex', alignItems: 'center', gap: sp[2] }}>
        {title}
        <span style={{ flex: 1, height: 1, background: P.hair }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: sp[2] }}>{children}</div>
    </div>
  );
}

function Row({ row, open, onToggle, onDone }) {
  const contacted = row.allergy_status === 'contacted';
  const [subject, setSubject] = useState('Military Ball food allergy follow-up');
  const [body, setBody] = useState(
    `Hi ${row.cadet_name.split(' ')[0] || row.cadet_name},\n\nYou flagged a food allergy on your Military Ball signup. Reply here and let me know the details so we can sort out food options with the caterer.\n\nThanks,\nS-5`,
  );
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState('');

  async function send() {
    if (!body.trim()) { setFlash('Message body is required.'); return; }
    setBusy(true);
    setFlash('');
    const html = esc(body).replace(/\n/g, '<br>');
    const { data, error } = await SB.functions.invoke('send-allergy-email', {
      body: { signup_id: row.id, subject: subject.trim(), html },
    });
    setBusy(false);
    if (error || data?.error) { setFlash(`Failed: ${data?.error || error.message}`); return; }
    setFlash('Sent ✓');
    onDone();
  }

  async function markContacted() {
    setBusy(true);
    setFlash('');
    const { error } = await SB.from('ball_signups')
      .update({ allergy_status: 'contacted', allergy_contacted_at: new Date().toISOString() })
      .eq('id', row.id);
    setBusy(false);
    if (error) { setFlash(`Failed: ${error.message}`); return; }
    onDone();
  }

  return (
    <div style={{ border: `1px solid ${open ? P.hairStrong : P.hair}`, borderLeft: `3px solid ${contacted ? P.green : P.gold}`, background: P.navy }}>
      <button
        onClick={onToggle}
        style={{
          width: '100%', textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer',
          padding: `${sp[3]}px ${sp[4]}px`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: sp[3],
        }}
      >
        <div>
          <div style={{ fontFamily: mono, fontSize: fs.sm, color: P.cream }}>{row.cadet_name}</div>
          <div style={{ fontFamily: mono, fontSize: fs.xs, color: P.mute, marginTop: 2 }}>
            {row.cadet_allergy_email} · flagged {fmt(row.submitted_at)}
          </div>
        </div>
        <span style={{
          fontFamily: mono, fontSize: fs.micro, letterSpacing: '0.1em', padding: '4px 8px',
          border: `1px solid ${contacted ? P.green : P.gold}`, color: contacted ? P.green : P.gold, whiteSpace: 'nowrap',
        }}>
          {contacted ? `CONTACTED ${fmt(row.allergy_contacted_at)}` : 'PENDING'}
        </span>
      </button>

      {open && (
        <div style={{ padding: `0 ${sp[4]}px ${sp[4]}px`, borderTop: `1px solid ${P.hair}` }}>
          <div style={{ marginTop: sp[3] }}><Label>SUBJECT</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
          <div style={{ marginTop: sp[3] }}>
            <Label>MESSAGE (sent to {row.cadet_allergy_email})</Label>
            <textarea
              value={body} onChange={(e) => setBody(e.target.value)} rows={8}
              style={{ width: '100%', boxSizing: 'border-box', background: P.deep, border: `1px solid ${P.hair}`, color: P.cream, fontFamily: mono, fontSize: 13, padding: 12 }}
            />
          </div>
          <div style={{ marginTop: sp[3], display: 'flex', alignItems: 'center', gap: sp[3], flexWrap: 'wrap' }}>
            <Btn variant="gold" size="sm" disabled={busy} onClick={send}>{busy ? 'SENDING…' : contacted ? 'SEND AGAIN' : 'SEND EMAIL'}</Btn>
            {!contacted && <Btn variant="ghost" size="sm" disabled={busy} onClick={markContacted}>MARK CONTACTED (no email)</Btn>}
            {flash && <span style={{ fontFamily: mono, fontSize: 12, color: P.mute }}>{flash}</span>}
          </div>
          <div style={{ fontFamily: mono, fontSize: 11, color: P.mute, marginTop: sp[2] }}>
            Email goes straight to the cadet, not through the review portal. Either action marks this "contacted".
          </div>
        </div>
      )}
    </div>
  );
}
