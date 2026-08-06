import { P, mono, inter, fs, sp, radius, ease } from '../../theme';
import { EmptyState } from '../../shared/ui';
import { PRESENCE_ONLINE_WINDOW_MS } from '../../../../hooks/useAdminPresence';

function conversationName(convo, roster, own) {
  if (convo.is_group) return convo.title || `Group (${convo.participants.length})`;
  const otherEmail = convo.participants.find((e) => e.toLowerCase() !== own);
  const other = otherEmail ? roster[otherEmail.toLowerCase()] : null;
  return other?.display_name || otherEmail || 'Unknown';
}

function conversationAvatar(convo, roster, own) {
  if (convo.is_group) return null;
  const otherEmail = convo.participants.find((e) => e.toLowerCase() !== own);
  return otherEmail ? roster[otherEmail.toLowerCase()]?.photo_url : null;
}

// DM-only — a group's "online" state isn't one person, so no dot for those.
function isOtherOnline(convo, presence, own) {
  if (convo.is_group) return false;
  const otherEmail = convo.participants.find((e) => e.toLowerCase() !== own);
  const lastSeen = otherEmail && presence[otherEmail.toLowerCase()];
  return !!lastSeen && Date.now() - new Date(lastSeen).getTime() < PRESENCE_ONLINE_WINDOW_MS;
}

function previewText(msg) {
  if (!msg) return 'No messages yet';
  if (msg.deleted_at) return '(message deleted)';
  return msg.body || (msg.attachment_filename ? `📎 ${msg.attachment_filename}` : '');
}

function timeLabel(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function ConversationList({ conversations, roster, presence, own, selectedId, onSelect }) {
  if (conversations === null) {
    return <div style={{ fontFamily: mono, fontSize: fs.xs, color: P.faint, padding: sp[4] }}>LOADING…</div>;
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: sp[2],
      overflowY: 'auto', paddingRight: 4,
    }}>
      {conversations.length === 0 && (
        <EmptyState icon="✉" title="NO CONVERSATIONS" hint="Start a new message to reach another admin." />
      )}
      {conversations.map((c) => {
        const name = conversationName(c, roster, own);
        const avatar = conversationAvatar(c, roster, own);
        const online = isOtherOnline(c, presence, own);
        const on = c.id === selectedId;
        return (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: sp[3], textAlign: 'left', cursor: 'pointer',
              background: on ? P.navy : 'transparent',
              border: `1px solid ${on ? P.gold : P.hair}`,
              borderRadius: radius.sm, padding: '10px 12px', transition: `all 0.14s ${ease}`,
            }}
          >
            <div style={{ position: 'relative', flexShrink: 0 }}>
              {avatar
                ? <img src={avatar} alt="" style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover', border: `1px solid ${P.hairStrong}` }} />
                : <div style={{
                    width: 38, height: 38, borderRadius: '50%',
                    background: c.is_group ? P.goldWash : P.navy, border: `1px solid ${P.hair}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: mono, fontSize: fs.sm, color: P.gold,
                  }}>{c.is_group ? '⚭' : name.charAt(0).toUpperCase()}</div>}
              {online && (
                <span style={{
                  position: 'absolute', bottom: -1, right: -1, width: 10, height: 10, borderRadius: '50%',
                  background: P.green, border: `2px solid ${P.deep}`,
                }} />
              )}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: sp[2] }}>
                <span style={{
                  fontFamily: inter, fontSize: fs.sm, color: P.cream,
                  fontWeight: c.hasUnread ? 700 : 400,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{name}</span>
                <span style={{ fontFamily: mono, fontSize: fs.micro, color: P.faint, flexShrink: 0 }}>
                  {timeLabel(c.lastMessage?.created_at || c.created_at)}
                </span>
              </div>
              <div style={{
                fontFamily: inter, fontSize: fs.xs, color: c.hasUnread ? P.mute : P.faint,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {c.lastMessage?.sender_email?.toLowerCase() === own ? 'You: ' : ''}{previewText(c.lastMessage)}
              </div>
            </div>

            {c.hasUnread && <span style={{ width: 8, height: 8, borderRadius: '50%', background: P.gold, flexShrink: 0 }} />}
          </button>
        );
      })}
    </div>
  );
}
