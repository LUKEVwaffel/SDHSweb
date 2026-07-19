import { useState } from 'react';
import { Btn } from '../../shared/ui';
import Subscribers from './Subscribers';
import Messages from './Messages';

export default function EmailPanel({ adminId }) {
  const [tab, setTab] = useState('messages');
  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        <Btn variant={tab === 'messages' ? 'gold' : 'ghost'} onClick={() => setTab('messages')} style={{ fontSize: 9 }}>MESSAGES</Btn>
        <Btn variant={tab === 'subscribers' ? 'gold' : 'ghost'} onClick={() => setTab('subscribers')} style={{ fontSize: 9 }}>SUBSCRIBERS</Btn>
      </div>
      {tab === 'messages' ? <Messages adminId={adminId} /> : <Subscribers />}
    </div>
  );
}
