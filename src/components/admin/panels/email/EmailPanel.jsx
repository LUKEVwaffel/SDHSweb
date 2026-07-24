import { useState } from 'react';
import { sp } from '../../theme';
import { Btn } from '../../shared/ui';
import Subscribers from './Subscribers';
import Messages from './Messages';

export default function EmailPanel({ adminId }) {
  const [tab, setTab] = useState('messages');
  return (
    <div>
      <div style={{ display: 'flex', gap: sp[2], marginBottom: sp[4] }}>
        <Btn variant={tab === 'messages' ? 'gold' : 'ghost'} size="sm" onClick={() => setTab('messages')}>MESSAGES</Btn>
        <Btn variant={tab === 'subscribers' ? 'gold' : 'ghost'} size="sm" onClick={() => setTab('subscribers')}>SUBSCRIBERS</Btn>
      </div>
      {tab === 'messages' ? <Messages adminId={adminId} /> : <Subscribers />}
    </div>
  );
}
