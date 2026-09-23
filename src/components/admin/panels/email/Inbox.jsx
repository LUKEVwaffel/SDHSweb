import { useState, useEffect, useCallback } from 'react';
import { supabase as SB } from '../../../../lib/supabaseClient';
import { P, mono, inter, fs, sp } from '../../theme';
import { Btn, Card, PanelHeader, EmptyState } from '../../shared/ui';

// Naive tag strip for the html-only fallback below — output is still
// rendered as plain text (never dangerouslySetInnerHTML), so this only
// needs to make the snippet readable, not to sanitize anything.
function stripTags(html) {
  return String(html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

export default function Inbox() {
  const [rows, setRows] = useState([]);
  const [missing, setMissing] = useState(false);
  const [sel, setSel] = useState(null);

  const load = useCallback(async () => {
    const { data, error } = await SB.from('email_replies').select('*').order('received_at', { ascending: false });
    if (error) { setMissing(true); return; }
    setMissing(false);
    setRows(data || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function open(r) {
    setSel(r);
    if (!r.read_at) {
      const read_at = new Date().toISOString();
      await SB.from('email_replies').update({ read_at }).eq('id', r.id);
      setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, read_at } : x)));
    }
  }

  if (missing) {
    return (
      <Card>
        <div style={{ fontFamily: mono, fontSize: fs.xs, color: P.mute, lineHeight: 1.9 }}>
          <div style={{ color: P.gold }}>INBOX TABLE NOT FOUND</div>
          <div>Run <span style={{ color: P.cream }}>supabase/email_inbound.sql</span>, then deploy <span style={{ color: P.cream }}>resend-inbound-webhook</span> and enable receiving in the Resend dashboard (see that file's header comment).</div>
        </div>
      </Card>
    );
  }

  const unread = rows.filter((r) => !r.read_at).length;

  if (sel) {
    return (
      <div style={{ maxWidth: 760 }}>
        <PanelHeader
          title={sel.subject || '(no subject)'}
          sub={`${sel.from_name ? `${sel.from_name} · ` : ''}${sel.from_address}`}
          action={<Btn onClick={() => setSel(null)} variant="ghost" size="sm">‹ INBOX</Btn>}
        />
        <Card>
          <div style={{ fontFamily: mono, fontSize: fs.tiny, color: P.mute, marginBottom: sp[3] }}>
            {new Date(sel.received_at).toLocaleString()}
            {sel.to_address ? ` · to ${sel.to_address}` : ''}
          </div>
          <div style={{ fontFamily: inter, fontSize: fs.base, color: P.cream, whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
            {sel.text_body || stripTags(sel.html_body) || '(empty message)'}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 760 }}>
      <PanelHeader title="INBOX" sub={`${rows.length} total${unread ? ` · ${unread} unread` : ''}`} />
      {rows.length === 0 ? (
        <EmptyState icon="✉" title="NO REPLIES YET" hint="Replies to outbound mail will show up here once Resend's inbound webhook is wired up." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: sp[2] }}>
          {rows.map((r) => (
            <Card key={r.id} hover style={{ cursor: 'pointer', padding: `${sp[3]}px ${sp[4]}px` }} onClick={() => open(r)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: sp[3] }}>
                {!r.read_at && <span style={{ width: 8, height: 8, borderRadius: '50%', background: P.gold, flexShrink: 0 }} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: inter, fontSize: fs.base, color: P.cream, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.subject || '(no subject)'}
                  </div>
                  <div style={{ fontFamily: mono, fontSize: fs.tiny, color: P.mute, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.from_name ? `${r.from_name} · ` : ''}{r.from_address}
                  </div>
                </div>
                <span style={{ fontFamily: mono, fontSize: fs.tiny, color: P.mute, whiteSpace: 'nowrap' }}>
                  {new Date(r.received_at).toLocaleDateString()}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
