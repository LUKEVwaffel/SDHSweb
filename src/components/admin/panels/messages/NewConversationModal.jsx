import { useState, useMemo } from 'react';
import { supabase as SB } from '../../../../lib/supabaseClient';
import { P, mono, inter, fs, sp, radius } from '../../theme';
import { Modal, Btn, Label, Input } from '../../shared/ui';

export default function NewConversationModal({ open, onClose, roster, own, onCreated }) {
  const [groupMode, setGroupMode] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const others = useMemo(
    () => Object.values(roster).filter((r) => r.email.toLowerCase() !== own).sort((a, b) => (a.display_name || a.email).localeCompare(b.display_name || b.email)),
    [roster, own]
  );

  function reset() {
    setGroupMode(false); setSelected(new Set()); setTitle(''); setErr(''); setBusy(false);
  }
  function close() { reset(); onClose(); }

  function toggle(email) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email); else next.add(email);
      return next;
    });
  }

  async function startDM(email) {
    setBusy(true); setErr('');
    const { data, error } = await SB.rpc('create_conversation', { p_participant_emails: [email], p_is_group: false, p_title: null });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    reset();
    onCreated(data);
  }

  async function startGroup() {
    if (selected.size < 2) { setErr('Pick at least 2 other admins for a group.'); return; }
    setBusy(true); setErr('');
    const { data, error } = await SB.rpc('create_conversation', {
      p_participant_emails: Array.from(selected), p_is_group: true, p_title: title.trim() || null,
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    reset();
    onCreated(data);
  }

  return (
    <Modal open={open} onClose={close} title="NEW MESSAGE" width={440}>
      <div style={{ display: 'flex', gap: sp[2], marginBottom: sp[4] }}>
        <Btn size="sm" variant={!groupMode ? 'gold' : 'ghost'} onClick={() => setGroupMode(false)}>DIRECT MESSAGE</Btn>
        <Btn size="sm" variant={groupMode ? 'gold' : 'ghost'} onClick={() => setGroupMode(true)}>GROUP</Btn>
      </div>

      {groupMode && (
        <>
          <Label>Group name (optional)</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. S-6 Staff" style={{ marginBottom: sp[3] }} />
          <Label>Participants ({selected.size} selected)</Label>
        </>
      )}
      {!groupMode && <Label>Message who?</Label>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: sp[2], maxHeight: 280, overflowY: 'auto', marginBottom: sp[4] }}>
        {others.map((r) => {
          const isSel = selected.has(r.email);
          return (
            <div
              key={r.email}
              onClick={() => (groupMode ? toggle(r.email) : startDM(r.email))}
              style={{
                display: 'flex', alignItems: 'center', gap: sp[3], cursor: busy ? 'default' : 'pointer',
                opacity: busy ? 0.6 : 1, padding: '8px 10px', borderRadius: radius.sm,
                background: groupMode && isSel ? P.navy : 'transparent',
                border: `1px solid ${groupMode && isSel ? P.gold : P.hair}`,
              }}
            >
              {groupMode && (
                <div style={{
                  width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                  border: `1px solid ${isSel ? P.gold : P.hairStrong}`, background: isSel ? P.gold : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: P.ink, fontSize: 11,
                }}>{isSel ? '✓' : ''}</div>
              )}
              {r.photo_url
                ? <img src={r.photo_url} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                : <div style={{
                    width: 32, height: 32, borderRadius: '50%', background: P.deep, border: `1px solid ${P.hair}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: mono, fontSize: fs.xs, color: P.gold,
                  }}>{(r.display_name || r.email).charAt(0).toUpperCase()}</div>}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: inter, fontSize: fs.sm, color: P.cream }}>{r.display_name || r.email}</div>
                {r.title && <div style={{ fontFamily: mono, fontSize: fs.micro, color: P.faint }}>{r.title}</div>}
              </div>
            </div>
          );
        })}
      </div>

      {err && <div style={{ color: P.red, fontFamily: mono, fontSize: 12, marginBottom: sp[3] }}>{err}</div>}

      {groupMode && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Btn onClick={startGroup} variant="gold" disabled={busy || selected.size < 2}>
            {busy ? 'CREATING…' : 'CREATE GROUP'}
          </Btn>
        </div>
      )}
    </Modal>
  );
}
