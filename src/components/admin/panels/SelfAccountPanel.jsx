import { useState, useEffect, useCallback } from 'react';
import { supabase as SB } from '../../../lib/supabaseClient';
import { P, mono, inter, fs, sp } from '../theme';
import { Card, PanelHeader, EmptyState } from '../shared/ui';
import SelfCredentialControls from './advanced/SelfCredentialControls';

// Lightweight self-service settings for roles without Advanced access (S-5).
// PIN + Touch ID for the signed-in account only — no roster, no editing
// anyone else's name/photo/title (that stays an S-6 tool under Advanced >
// Accounts). Reuses the same SelfCredentialControls + set-pin/clear-pin/
// revoke-passkeys wiring; the server already rejects non-self regardless.
export default function SelfAccountPanel({ adminId }) {
  const [row, setRow] = useState(null);
  const [missing, setMissing] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await SB.from('login_accounts').select('*').eq('email', adminId).maybeSingle();
    if (error) { setMissing(true); return; }
    setMissing(false);
    setRow(data || null);
  }, [adminId]);
  useEffect(() => { load(); }, [load]);

  if (missing) {
    return (
      <Card>
        <div style={{ fontFamily: mono, fontSize: fs.xs, color: P.mute, lineHeight: 1.9 }}>
          <div style={{ color: P.gold }}>ACCOUNT NOT FOUND</div>
          <div>Ask the S-6 to check your admin_roles entry.</div>
        </div>
      </Card>
    );
  }

  if (!row) return <EmptyState icon="⚿" title="LOADING…" />;

  return (
    <div>
      <PanelHeader title="MY ACCOUNT" sub="PIN & Touch ID for your own sign-in" />
      <Card style={{ maxWidth: 480 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: sp[4], marginBottom: sp[5] }}>
          {row.photo_url
            ? <img src={row.photo_url} alt="" style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${P.gold}` }} />
            : <div style={{ width: 64, height: 64, borderRadius: '50%', background: P.deep, border: `1px solid ${P.hair}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: mono, fontSize: fs.xl, color: P.gold }}>{(row.display_name || row.email).charAt(0).toUpperCase()}</div>}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: inter, fontSize: fs.md, color: P.cream }}>{row.display_name || 'Unnamed account'}</div>
            <div style={{ fontFamily: mono, fontSize: fs.tiny, color: P.mute, marginTop: 3 }}>{row.email}</div>
          </div>
        </div>
        <SelfCredentialControls email={row.email} hasPin={row.has_pin} hasPasskey={row.has_passkey} onChange={load} />
      </Card>
    </div>
  );
}
