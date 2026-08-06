import { useState, useRef } from 'react';
import { supabase as SB } from '../../../../lib/supabaseClient';
import { P, mono, inter, fs, sp, radius, ease } from '../../theme';
import { Btn } from '../../shared/ui';

const ATTACH_BUCKET = 'chat-attachments';
const MAX_ATTACH = 8 * 1024 * 1024;
// Mirrors the bucket's allowed_mime_types in supabase/dispatch_chat.sql —
// this is just the friendly first line, the bucket policy is the real gate.
const ALLOWED_MIME = new Set([
  'application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

export default function Composer({ conversationId, own, onSent }) {
  const [text, setText] = useState('');
  const [pending, setPending] = useState(null); // {path, filename, size}
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');
  const [focused, setFocused] = useState(false);
  const fileRef = useRef(null);

  async function onFileChosen(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setErr('');
    if (file.size > MAX_ATTACH) { setErr('File exceeds 8 MB.'); return; }
    if (!ALLOWED_MIME.has(file.type)) { setErr('Unsupported file type — PDF, image, or Word doc only.'); return; }
    setUploading(true);
    const path = `${conversationId}/${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`;
    const { error } = await SB.storage.from(ATTACH_BUCKET).upload(path, file);
    setUploading(false);
    if (error) { setErr(error.message); return; }
    setPending({ path, filename: file.name, size: file.size });
  }

  async function send() {
    const body = text.trim();
    if ((!body && !pending) || sending) return;
    setSending(true);
    setErr('');
    const { data, error } = await SB.from('messages').insert({
      conversation_id: conversationId,
      body: body || null,
      attachment_path: pending?.path || null,
      attachment_filename: pending?.filename || null,
      attachment_size: pending?.size || null,
    }).select('id').single();
    if (error) { setSending(false); setErr(error.message); return; }
    // Sending counts as reading — otherwise the sender's own message would
    // flag their own conversation as unread (last_read_at stays in the past).
    await SB.from('conversation_participants').update({ last_read_at: new Date().toISOString() }).eq('conversation_id', conversationId).eq('email', own);
    // Best-effort — a failed notify call must never block the message itself,
    // which already landed. Fire-and-forget, same as every other notify-*
    // invocation in this codebase (see notify-question-submitted's caller).
    SB.functions.invoke('notify-new-message', { body: { message_id: data.id } }).catch(() => {});
    setText('');
    setPending(null);
    setSending(false);
    onSent?.();
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div style={{ borderTop: `1px solid ${P.hair}`, paddingTop: sp[3] }}>
      {err && <div style={{ color: P.red, fontFamily: 'monospace', fontSize: 12, marginBottom: sp[2] }}>{err}</div>}
      {pending && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: sp[2], marginBottom: sp[2],
          background: P.deep, border: `1px solid ${P.hair}`, borderRadius: radius.sm, padding: '5px 10px',
        }}>
          <span style={{ fontFamily: mono, fontSize: fs.micro, color: P.gold }}>📎 {pending.filename}</span>
          <button onClick={() => setPending(null)} style={{ all: 'unset', cursor: 'pointer', color: P.faint, fontSize: 12 }}>✕</button>
        </div>
      )}
      <div style={{ display: 'flex', gap: sp[2], alignItems: 'flex-end' }}>
        <input ref={fileRef} type="file" accept={Array.from(ALLOWED_MIME).join(',')} onChange={onFileChosen} style={{ display: 'none' }} />
        <Btn onClick={() => fileRef.current?.click()} variant="ghost" disabled={uploading || sending}>
          {uploading ? '…' : '📎'}
        </Btn>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Write a message… (Enter to send, Shift+Enter for a new line)"
          rows={1}
          style={{
            flex: 1, resize: 'none', minHeight: 42, maxHeight: 140,
            background: P.deep, border: `1px solid ${focused ? P.gold : P.hair}`,
            color: P.cream, fontFamily: inter, fontSize: fs.sm, padding: '11px 13px',
            outline: 'none', borderRadius: radius.sm, boxSizing: 'border-box',
            transition: `border-color 0.15s ${ease}`,
          }}
        />
        <Btn onClick={send} variant="gold" disabled={(!text.trim() && !pending) || sending}>
          {sending ? '…' : 'SEND'}
        </Btn>
      </div>
    </div>
  );
}
