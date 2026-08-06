import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase as SB } from '../../../../lib/supabaseClient';
import { P, mono, inter, fs, sp } from '../../theme';
import { Card, Btn } from '../../shared/ui';
import { PRESENCE_ONLINE_WINDOW_MS } from '../../../../hooks/useAdminPresence';
import Composer from './Composer';

const ATTACH_BUCKET = 'chat-attachments';
const SIGNED_URL_TTL = 60 * 10; // 10 min, matches AarsPanel's DOCS_BUCKET convention

function conversationName(convo, roster, own) {
  if (convo.is_group) return convo.title || `Group (${convo.participants.length})`;
  const otherEmail = convo.participants.find((e) => e.toLowerCase() !== own);
  const other = otherEmail ? roster[otherEmail.toLowerCase()] : null;
  return other?.display_name || otherEmail || 'Unknown';
}

// DM-only, same reasoning as ConversationList — a group has no single online state.
function isOtherOnline(convo, presence, own) {
  if (convo.is_group) return false;
  const otherEmail = convo.participants.find((e) => e.toLowerCase() !== own);
  const lastSeen = otherEmail && presence[otherEmail.toLowerCase()];
  return !!lastSeen && Date.now() - new Date(lastSeen).getTime() < PRESENCE_ONLINE_WINDOW_MS;
}

function timeLabel(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export default function ThreadView({ conversation, roster, presence, own, onBack, onChanged, onLeft }) {
  const [messages, setMessages] = useState(null);
  const [err, setErr] = useState('');
  const bottomRef = useRef(null);
  const convoId = conversation.id;

  const load = useCallback(async () => {
    const { data, error } = await SB
      .from('messages').select('*').eq('conversation_id', convoId)
      .order('created_at', { ascending: true }).limit(200);
    if (error) { setErr(`Load failed: ${error.message}`); return; }
    setMessages(data || []);
  }, [convoId]);

  useEffect(() => { setMessages(null); load(); }, [load]);

  useEffect(() => {
    const channel = SB.channel(`dispatch-chat-thread-${convoId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${convoId}` },
        (payload) => setMessages((prev) => (prev ? [...prev, payload.new] : prev)))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${convoId}` },
        (payload) => setMessages((prev) => (prev ? prev.map((m) => (m.id === payload.new.id ? payload.new : m)) : prev)))
      .subscribe();
    return () => { SB.removeChannel(channel); };
  }, [convoId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ block: 'end' }); }, [messages]);

  // chat-attachments is a PRIVATE bucket — attachment_path is a storage
  // object path, not a fetchable URL, so opening it needs a fresh signed URL
  // on demand rather than a plain href. Same on-demand pattern AarsPanel uses
  // for aar-documents.
  async function openAttachment(path) {
    const { data, error } = await SB.storage.from(ATTACH_BUCKET).createSignedUrl(path, SIGNED_URL_TTL);
    if (error || !data?.signedUrl) { setErr(`Could not open attachment: ${error?.message || 'unknown error'}`); return; }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  }

  // Soft-delete, own messages only — tombstoned (renders "(message deleted)"
  // for everyone else) rather than actually removed, per the confirmed scope.
  async function deleteMessage(id) {
    if (!confirm('Delete this message? Other participants will see "(message deleted)" instead.')) return;
    const { error } = await SB.from('messages').update({ deleted_at: new Date().toISOString() }).eq('id', id);
    if (error) { setErr(`Delete failed: ${error.message}`); return; }
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, deleted_at: new Date().toISOString() } : m)));
    onChanged?.();
  }

  // Group-only (RLS enforces this server-side too — conversation_participants_leave
  // requires is_group). A fixed 2-person DM has no "leave" concept.
  async function leaveGroup() {
    if (!confirm(`Leave "${name}"? You'll stop receiving new messages here, but your own past messages stay visible to the others.`)) return;
    const { error } = await SB.from('conversation_participants').delete().eq('conversation_id', convoId).eq('email', own);
    if (error) { setErr(`Could not leave: ${error.message}`); return; }
    onLeft?.();
    onChanged?.();
  }

  const name = conversationName(conversation, roster, own);
  const online = isOtherOnline(conversation, presence, own);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: sp[3],
        padding: `0 0 ${sp[3]}px`, borderBottom: `1px solid ${P.hair}`, marginBottom: sp[3],
      }}>
        {onBack && (
          <button onClick={onBack} style={{
            all: 'unset', cursor: 'pointer', color: P.gold, fontFamily: mono, fontSize: fs.md, padding: '0 4px',
          }}>←</button>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: inter, fontSize: fs.md, color: P.cream }}>{name}</div>
          {conversation.is_group ? (
            <div style={{ fontFamily: mono, fontSize: fs.micro, color: P.faint, letterSpacing: '0.06em' }}>
              {conversation.participants.length} PARTICIPANTS
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: mono, fontSize: fs.micro, color: online ? P.green : P.faint, letterSpacing: '0.06em' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: online ? P.green : P.faint }} />
              {online ? 'ONLINE' : 'OFFLINE'}
            </div>
          )}
        </div>
        {conversation.is_group && <Btn onClick={leaveGroup} variant="ghost" size="sm">LEAVE GROUP</Btn>}
      </div>

      {err && <div style={{ color: P.red, fontFamily: mono, fontSize: 12, marginBottom: sp[3] }}>{err}</div>}

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: sp[2], paddingBottom: sp[3] }}>
        {messages === null && <div style={{ fontFamily: mono, fontSize: fs.xs, color: P.faint }}>LOADING…</div>}
        {messages?.length === 0 && (
          <div style={{ fontFamily: mono, fontSize: fs.xs, color: P.faint, textAlign: 'center', marginTop: sp[8] }}>
            No messages yet — say hello.
          </div>
        )}
        {messages?.map((m) => {
          const mine = m.sender_email?.toLowerCase() === own;
          const senderName = mine ? 'You' : (roster[m.sender_email?.toLowerCase()]?.display_name || m.sender_email);
          return (
            <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start' }}>
              {conversation.is_group && !mine && (
                <div style={{ fontFamily: mono, fontSize: fs.micro, color: P.faint, marginBottom: 2, marginLeft: 4 }}>{senderName}</div>
              )}
              <Card style={{
                maxWidth: '70%', padding: '9px 13px',
                background: mine ? P.gold : P.navy,
                border: `1px solid ${mine ? P.gold : P.hair}`,
                boxShadow: 'none',
              }}>
                {m.deleted_at ? (
                  <div style={{ fontFamily: inter, fontSize: fs.sm, color: mine ? 'rgba(6,16,31,0.55)' : P.faint, fontStyle: 'italic' }}>
                    (message deleted)
                  </div>
                ) : (
                  <>
                    {m.body && (
                      <div style={{ fontFamily: inter, fontSize: fs.sm, color: mine ? P.ink : P.cream, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {m.body}
                      </div>
                    )}
                    {m.attachment_filename && (
                      <button onClick={() => openAttachment(m.attachment_path)} style={{
                        all: 'unset', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5,
                        marginTop: m.body ? 6 : 0,
                        fontFamily: mono, fontSize: fs.micro, color: mine ? P.ink : P.gold, textDecoration: 'underline',
                      }}>📎 {m.attachment_filename}</button>
                    )}
                  </>
                )}
              </Card>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                fontFamily: mono, fontSize: 9, color: P.faint, marginTop: 2,
                marginRight: mine ? 4 : 0, marginLeft: mine ? 0 : 4,
              }}>
                {timeLabel(m.created_at)}
                {mine && !m.deleted_at && (
                  <button onClick={() => deleteMessage(m.id)} style={{
                    all: 'unset', cursor: 'pointer', color: P.faint, fontSize: 9,
                  }}>DELETE</button>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <Composer conversationId={convoId} own={own} onSent={onChanged} />
    </div>
  );
}
