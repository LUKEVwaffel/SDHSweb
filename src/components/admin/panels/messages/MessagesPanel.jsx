import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase as SB } from '../../../../lib/supabaseClient';
import { P, sp } from '../../theme';
import { PanelHeader, Btn, EmptyState } from '../../shared/ui';
import useIsMobile from '../../../../hooks/useIsMobile';
import { PRESENCE_HEARTBEAT_MS } from '../../../../hooks/useAdminPresence';
import ConversationList from './ConversationList';
import ThreadView from './ThreadView';
import NewConversationModal from './NewConversationModal';

// DISPATCH internal chat — admin-only (all 5 accounts, both s6 and s5). See
// supabase/dispatch_chat.sql for the schema/RLS this relies on: a caller only
// ever sees rows for conversations they're a participant of, enforced the
// same way for a normal SELECT and for the realtime subscription below (this
// panel subscribes UNFILTERED on purpose — proven safe in the Phase 1 smoke
// test, see that file's header comment).
//
// This panel owns the conversation list + unread state; ThreadView owns its
// own separate, conversation-scoped subscription for the open thread's
// message stream. Two small subscriptions, not one shared one — matches how
// every other panel in this codebase keeps its own Supabase calls local
// rather than lifting a shared data layer.
export default function MessagesPanel({ adminId }) {
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();
  const own = String(adminId || '').toLowerCase();

  const [roster, setRoster] = useState({});          // email -> {display_name, photo_url, title}
  const [presence, setPresence] = useState({});      // email -> last_seen_at
  const [conversations, setConversations] = useState(null); // null = loading
  const [selectedId, setSelectedId] = useState(searchParams.get('c') || null);
  const [showNew, setShowNew] = useState(false);
  const [err, setErr] = useState('');
  const conversationsRef = useRef(conversations);
  conversationsRef.current = conversations;

  const loadRoster = useCallback(async () => {
    const { data, error } = await SB.from('login_accounts').select('email, display_name, photo_url, title');
    if (error) { setErr(`Roster load failed: ${error.message}`); return; }
    const map = {};
    (data || []).forEach((r) => { map[r.email.toLowerCase()] = r; });
    setRoster(map);
  }, []);

  // Rebuilds the full conversation list: my participant rows, the
  // conversations themselves, every participant (for DM display names / group
  // counts), and the latest message per conversation (for the preview line +
  // unread flag). Small dataset (5 admins, a handful of threads) so plain
  // client-composed queries are simpler than adding a DB view for this.
  const loadConversations = useCallback(async () => {
    const { data: mine, error: mErr } = await SB
      .from('conversation_participants').select('conversation_id, last_read_at').eq('email', own);
    if (mErr) { setErr(`Load failed: ${mErr.message}`); return; }
    const ids = (mine || []).map((r) => r.conversation_id);
    if (!ids.length) { setConversations([]); return; }
    const readMap = {};
    mine.forEach((r) => { readMap[r.conversation_id] = r.last_read_at; });

    const [{ data: convos, error: cErr }, { data: parts, error: pErr }, { data: msgs, error: msgErr }] = await Promise.all([
      SB.from('conversations').select('id, is_group, title, created_at').in('id', ids),
      SB.from('conversation_participants').select('conversation_id, email').in('conversation_id', ids),
      SB.from('messages').select('conversation_id, sender_email, body, deleted_at, created_at').in('conversation_id', ids).order('created_at', { ascending: false }),
    ]);
    if (cErr || pErr || msgErr) { setErr(`Load failed: ${(cErr || pErr || msgErr).message}`); return; }

    const participantsByConvo = {};
    (parts || []).forEach((p) => {
      (participantsByConvo[p.conversation_id] ||= []).push(p.email);
    });
    const lastMsgByConvo = {};
    (msgs || []).forEach((m) => { if (!lastMsgByConvo[m.conversation_id]) lastMsgByConvo[m.conversation_id] = m; });

    const rows = (convos || []).map((c) => {
      const last = lastMsgByConvo[c.id] || null;
      const readAt = readMap[c.id];
      return {
        ...c,
        participants: participantsByConvo[c.id] || [],
        lastMessage: last,
        hasUnread: !!(last && readAt && new Date(last.created_at) > new Date(readAt)),
      };
    }).sort((a, b) => {
      const at = a.lastMessage?.created_at || a.created_at;
      const bt = b.lastMessage?.created_at || b.created_at;
      return new Date(bt) - new Date(at);
    });

    setConversations(rows);
  }, [own]);

  const loadPresence = useCallback(async () => {
    const { data, error } = await SB.from('admin_presence').select('email, last_seen_at');
    if (error) return; // best-effort — a failed presence read shouldn't break the chat UI
    const map = {};
    (data || []).forEach((r) => { map[r.email.toLowerCase()] = r.last_seen_at; });
    setPresence(map);
  }, []);

  useEffect(() => { loadRoster(); loadConversations(); loadPresence(); }, [loadRoster, loadConversations, loadPresence]);

  // Polled rather than realtime — admin_presence isn't in the Realtime
  // publication (see dispatch_chat.sql), and up-to-30s staleness on an
  // online dot is a non-issue. Same cadence as the heartbeat itself, so a
  // dot is never more than one heartbeat interval stale either direction.
  useEffect(() => {
    const id = setInterval(loadPresence, PRESENCE_HEARTBEAT_MS);
    return () => clearInterval(id);
  }, [loadPresence]);

  // Live updates: any message I'm authorized to see (RLS-scoped) reorders /
  // refreshes the list; being added to a brand-new conversation (my own
  // participant row appearing) pulls that conversation in too.
  useEffect(() => {
    const channel = SB.channel('dispatch-chat-list')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => loadConversations())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, () => loadConversations())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversation_participants', filter: `email=eq.${own}` }, () => loadConversations())
      .subscribe();
    return () => { SB.removeChannel(channel); };
  }, [own, loadConversations]);

  const select = useCallback(async (id) => {
    setSelectedId(id);
    setSearchParams(id ? { c: id } : {}, { replace: true });
    await SB.from('conversation_participants').update({ last_read_at: new Date().toISOString() }).eq('conversation_id', id).eq('email', own);
    setConversations((prev) => (prev || []).map((c) => (c.id === id ? { ...c, hasUnread: false } : c)));
  }, [own, setSearchParams]);

  const onCreated = useCallback(async (id) => {
    setShowNew(false);
    await loadConversations();
    select(id);
  }, [loadConversations, select]);

  const selected = (conversations || []).find((c) => c.id === selectedId) || null;

  return (
    <div>
      <PanelHeader
        title="MESSAGES"
        sub="Internal DISPATCH chat — S-6 / S-5 only"
        action={<Btn onClick={() => setShowNew(true)} variant="gold" size="sm">NEW MESSAGE</Btn>}
      />
      {err && <div style={{ color: P.red, fontFamily: 'monospace', fontSize: 12, marginBottom: sp[3] }}>{err}</div>}

      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '320px 1fr',
        gap: sp[4],
        height: isMobile ? 'auto' : 'calc(100vh - 220px)',
        minHeight: 420,
      }}>
        {(!isMobile || !selectedId) && (
          <ConversationList
            conversations={conversations}
            roster={roster}
            presence={presence}
            own={own}
            selectedId={selectedId}
            onSelect={select}
          />
        )}
        {(!isMobile || selectedId) && (
          selected
            ? <ThreadView conversation={selected} roster={roster} presence={presence} own={own} onBack={isMobile ? () => select(null) : undefined} onChanged={loadConversations} onLeft={() => select(null)} />
            : <EmptyState icon="✉" title="SELECT A CONVERSATION" hint="Pick a thread on the left, or start a new one." />
        )}
      </div>

      <NewConversationModal
        open={showNew}
        onClose={() => setShowNew(false)}
        roster={roster}
        own={own}
        onCreated={onCreated}
      />
    </div>
  );
}
