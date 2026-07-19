import { useState, useEffect, useCallback } from 'react';
import { supabase as SB } from '../../../../lib/supabaseClient';
import { P, mono, inter } from '../../theme';
import { Btn, Card, Label, Input, PanelHeader } from '../../shared/ui';
import { printEmailMessage } from './emailPrint';

const STATUS_META = {
  draft:             { label: 'DRAFT',             color: P.mute },
  pending_signature: { label: 'PENDING SIGNATURE', color: P.bright },
  signed:            { label: 'SIGNED · CLEARED',  color: P.green },
  sent:              { label: 'SENT',              color: P.gold },
};

export default function Messages({ adminId }) {
  const [rows, setRows] = useState([]);
  const [missing, setMissing] = useState(false);
  const [sel, setSel] = useState(null);
  const [form, setForm] = useState({ subject: '', body: '' });
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    const { data, error } = await SB.from('email_messages').select('*').order('created_at', { ascending: false });
    if (error) { setMissing(true); return; }
    setMissing(false);
    setRows(data || []);
    if (sel) setSel(data.find((r) => r.id === sel.id) || null);
  }, [sel]);
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  function newDraft() {
    setSel(null);
    setForm({ subject: '', body: '' });
  }

  async function saveDraft() {
    if (!form.subject.trim() || !form.body.trim()) { setBusy('Subject and body required'); setTimeout(() => setBusy(''), 2000); return; }
    if (sel) {
      await SB.from('email_messages').update({ subject: form.subject, body: form.body }).eq('id', sel.id);
    } else {
      const { data } = await SB.from('email_messages').insert({ subject: form.subject, body: form.body, created_by: adminId }).select().single();
      setSel(data);
    }
    setBusy('Saved ✓'); setTimeout(() => setBusy(''), 1500);
    load();
  }

  function selectMsg(r) {
    setSel(r);
    setForm({ subject: r.subject, body: r.body });
  }

  async function printForSignature(r) {
    printEmailMessage(r);
    if (r.status === 'draft') {
      await SB.from('email_messages').update({ status: 'pending_signature', pdf_generated_at: new Date().toISOString() }).eq('id', r.id);
      load();
    }
  }

  async function markSigned(r) {
    if (!confirm('Confirm the printed copy was physically signed by the SAI or 1SG. This clears the message to send.')) return;
    await SB.from('email_messages').update({ status: 'signed', signed_by: adminId, signed_at: new Date().toISOString() }).eq('id', r.id);
    load();
  }

  async function send(r) {
    if (r.status !== 'signed') return;
    if (!confirm('Send this message to all active subscribers now?')) return;
    setBusy('Sending…');
    const { data, error } = await SB.functions.invoke('send-email', { body: { message_id: r.id } });
    if (error || data?.error) {
      setBusy(`Send failed: ${data?.error || error.message}`);
      setTimeout(() => setBusy(''), 5000);
    } else {
      setBusy(`Sent to ${data.recipient_count} ✓`);
      setTimeout(() => setBusy(''), 3000);
    }
    load();
  }

  if (missing) {
    return (
      <Card>
        <div style={{ fontFamily: mono, fontSize: 10, color: P.mute, lineHeight: 1.9 }}>
          <div style={{ color: P.gold }}>EMAIL TABLES NOT FOUND</div>
          <div>Run <span style={{ color: P.cream }}>supabase/email_system.sql</span> first.</div>
        </div>
      </Card>
    );
  }

  const status = sel?.status || 'draft';
  const meta = STATUS_META[status];
  const editable = !sel || sel.status === 'draft';
  const canSend = sel?.status === 'signed';

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 12 }}>
      {/* list */}
      <div>
        <PanelHeader title="MESSAGES" action={<Btn onClick={newDraft} variant="gold" style={{ fontSize: 9 }}>+ NEW</Btn>} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {rows.map((r) => {
            const m = STATUS_META[r.status];
            return (
              <Card key={r.id} style={{ cursor: 'pointer', padding: '8px 10px', border: `1px solid ${sel?.id === r.id ? P.gold : P.hair}` }} onClick={() => selectMsg(r)}>
                <div style={{ fontFamily: inter, fontSize: 12, color: P.cream, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.subject}</div>
                <div style={{ fontFamily: mono, fontSize: 8, color: m.color, marginTop: 2 }}>{m.label}</div>
              </Card>
            );
          })}
          {!rows.length && <div style={{ fontFamily: mono, fontSize: 10, color: P.mute, textAlign: 'center', padding: 20 }}>NO MESSAGES YET</div>}
        </div>
      </div>

      {/* editor + gate */}
      <div>
        <PanelHeader title={sel ? `MESSAGE · ${meta.label}` : 'NEW MESSAGE'} action={
          editable && <Btn onClick={saveDraft} variant="gold" style={{ fontSize: 9 }}>SAVE DRAFT</Btn>
        }/>

        <Card style={{ marginBottom: 12 }}>
          <Label>SUBJECT</Label>
          <Input value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} disabled={!editable} style={{ marginBottom: 8 }} />
          <Label>BODY</Label>
          <Input value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} multiline disabled={!editable} style={{ minHeight: 160 }} />
          {busy && <div style={{ fontFamily: mono, fontSize: 9, color: busy.includes('failed') || busy.includes('required') ? P.red : P.green, marginTop: 8 }}>{busy}</div>}
        </Card>

        {sel && (
          <Card>
            <Label>SIGNATURE GATE</Label>
            <div style={{ fontFamily: mono, fontSize: 9, color: P.mute, lineHeight: 1.8, marginBottom: 12 }}>
              <div style={{ color: status === 'draft' ? P.bright : P.mute }}>1 · PRINT the message</div>
              <div style={{ color: status === 'pending_signature' ? P.bright : P.mute }}>2 · Get wet signature from SAI / 1SG, file in S-6 drawer</div>
              <div style={{ color: status === 'pending_signature' ? P.bright : P.mute }}>3 · MARK SIGNED to unlock send</div>
              <div style={{ color: canSend ? P.green : P.mute }}>4 · SEND to subscribers</div>
            </div>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {status !== 'sent' && (
                <Btn onClick={() => printForSignature(sel)} variant="ghost" style={{ fontSize: 9 }}>
                  {status === 'draft' ? '① PRINT FOR SIGNATURE' : '⟳ REPRINT'}
                </Btn>
              )}
              {status === 'pending_signature' && (
                <Btn onClick={() => markSigned(sel)} variant="gold" style={{ fontSize: 9 }}>③ MARK SIGNED · CLEAR TO SEND</Btn>
              )}
              <Btn onClick={() => send(sel)} variant={canSend ? 'green' : 'default'} disabled={!canSend} style={{ fontSize: 9 }}>
                {status === 'sent' ? 'SENT ✓' : canSend ? '④ SEND NOW' : '🔒 SEND (locked until signed)'}
              </Btn>
            </div>

            {sel.status === 'signed' && sel.signed_at && (
              <div style={{ fontFamily: mono, fontSize: 8, color: P.green, marginTop: 10 }}>Cleared by {sel.signed_by} on {new Date(sel.signed_at).toLocaleString()}</div>
            )}
            {sel.status === 'sent' && (
              <div style={{ fontFamily: mono, fontSize: 8, color: P.gold, marginTop: 10 }}>Sent to {sel.recipient_count} on {new Date(sel.sent_at).toLocaleString()}</div>
            )}
            {sel.send_error && <div style={{ fontFamily: mono, fontSize: 8, color: P.red, marginTop: 6 }}>Last error: {sel.send_error}</div>}
          </Card>
        )}
      </div>
    </div>
  );
}
