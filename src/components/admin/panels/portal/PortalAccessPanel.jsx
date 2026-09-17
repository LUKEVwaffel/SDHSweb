import { useState } from 'react';
import { Btn, PanelHeader } from '../../shared/ui';
import { sp } from '../../theme';
import BallDressStaffTab from '../ball/BallDressStaffTab';
import BallReviewerAccountsTab from '../ball/BallReviewerAccountsTab';
import RifleAdminAccountsTab from './RifleAdminAccountsTab';

// S-6 view of who has access to which non-DISPATCH staff portal — every one
// of them fed by /portal (src/components/portal/PortalHub.jsx). Used to be
// scattered: dress/attire accounts lived inside the Ball panel, reviewer
// accounts (Email Review + Ball Ops + Rifle Signups) ALSO lived inside the
// Ball panel despite having nothing to do with the Ball, and rifle-admin
// accounts had no DISPATCH UI at all — pure SQL-editor provisioning. This is
// the one place for all of it now. DISPATCH access itself (admin_roles) is
// NOT here — that's a separate, more guarded population (see People panel).
const TABS = [
  { id: 'dress', label: 'DRESS / ATTIRE' },
  { id: 'reviewer', label: 'REVIEWER PORTAL' },
  { id: 'rifle', label: 'RIFLE TEAM ADMIN' },
];

export default function PortalAccessPanel() {
  const [tab, setTab] = useState('dress');

  return (
    <div>
      <PanelHeader title="PORTAL ACCESS" sub="Who can sign in to which staff portal at /portal. Not DISPATCH access — see People." />
      <div style={{ display: 'flex', gap: sp[1], flexWrap: 'wrap', marginBottom: sp[4] }}>
        {TABS.map((t) => <Btn key={t.id} variant={tab === t.id ? 'gold' : 'ghost'} size="sm" onClick={() => setTab(t.id)}>{t.label}</Btn>)}
      </div>

      {tab === 'dress' && <BallDressStaffTab />}
      {tab === 'reviewer' && <BallReviewerAccountsTab />}
      {tab === 'rifle' && <RifleAdminAccountsTab />}
    </div>
  );
}
