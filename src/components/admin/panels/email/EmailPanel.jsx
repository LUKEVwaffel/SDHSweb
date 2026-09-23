import { useState, useEffect } from 'react';
import { supabase as SB } from '../../../../lib/supabaseClient';
import { P, mono, fs, sp } from '../../theme';
import { Btn } from '../../shared/ui';
import Subscribers from './Subscribers';
import Messages from './Messages';
import Inbox from './Inbox';

export default function EmailPanel({ adminId }) {
  const [tab, setTab] = useState('messages');
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    SB.from('email_replies').select('id', { count: 'exact', head: true }).is('read_at', null)
      .then(({ count, error }) => { if (!error) setUnread(count || 0); });
  }, [tab]);

  return (
    <div>
      <div style={{ display: 'flex', gap: sp[2], marginBottom: sp[4] }}>
        <Btn variant={tab === 'messages' ? 'gold' : 'ghost'} size="sm" onClick={() => setTab('messages')}>MESSAGES</Btn>
        <Btn variant={tab === 'subscribers' ? 'gold' : 'ghost'} size="sm" onClick={() => setTab('subscribers')}>SUBSCRIBERS</Btn>
        <Btn variant={tab === 'inbox' ? 'gold' : 'ghost'} size="sm" onClick={() => setTab('inbox')}>
          INBOX{unread > 0 && <span style={{ fontFamily: mono, fontSize: fs.tiny, color: tab === 'inbox' ? P.deep : P.gold, marginLeft: 6 }}>{unread}</span>}
        </Btn>
      </div>
      {tab === 'messages' ? <Messages adminId={adminId} /> : tab === 'subscribers' ? <Subscribers /> : <Inbox />}
    </div>
  );
}
