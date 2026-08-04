import { useState, useEffect } from 'react';
import { supabase as SB } from '../../../../lib/supabaseClient';
import { P, mono } from '../../theme';
import { Btn, Card, Label, PanelHeader } from '../../shared/ui';

export default function SettingsPanel({ adminId }) {
  const [splash, setSplash] = useState(true);
  const [saved, setSaved] = useState(false);
  const [opticsendAuto, setOpticsendAuto] = useState(true);
  const [opticsendSaved, setOpticsendSaved] = useState(false);

  useEffect(() => {
    SB.from('admin_settings').select('*').eq('key','splash_enabled').single()
      .then(({ data }) => { if (data) setSplash(data.value !== false); });
    SB.from('admin_settings').select('*').eq('key','opticsend_auto_enabled').single()
      .then(({ data }) => { if (data) setOpticsendAuto(data.value !== false); });
  }, []);

  async function saveSplash(val) {
    setSplash(val);
    await SB.from('admin_settings').upsert({ key: 'splash_enabled', value: val, updated_by: adminId });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function saveOpticsendAuto(val) {
    setOpticsendAuto(val);
    await SB.from('admin_settings').upsert({ key: 'opticsend_auto_enabled', value: val, updated_by: adminId });
    setOpticsendSaved(true);
    setTimeout(() => setOpticsendSaved(false), 2000);
  }

  return (
    <div>
      <PanelHeader title="SETTINGS" />
      <Card style={{ marginBottom: 12 }}>
        <Label>SPLASH SCREEN</Label>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <Btn onClick={() => saveSplash(true)} variant={splash ? 'gold' : 'ghost'}>ENABLED</Btn>
          <Btn onClick={() => saveSplash(false)} variant={!splash ? 'gold' : 'ghost'}>DISABLED</Btn>
        </div>
        {saved && <div style={{ fontFamily: mono, fontSize: 9, color: P.green }}>SAVED ✓</div>}
      </Card>
      <Card style={{ marginBottom: 12 }}>
        <Label>OPTICSEND AUTO-TRIGGER</Label>
        <div style={{ fontFamily: mono, fontSize: 9, color: P.mute, lineHeight: 1.7, marginBottom: 8 }}>
          When ON, the day after a Raiders photo event, a reminder draft is generated automatically
          and appears on Overview for S-6 to review and submit. Turning this OFF stops new drafts
          from being generated. It does not affect drafts already created.
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <Btn onClick={() => saveOpticsendAuto(true)} variant={opticsendAuto ? 'gold' : 'ghost'}>ON</Btn>
          <Btn onClick={() => saveOpticsendAuto(false)} variant={!opticsendAuto ? 'gold' : 'ghost'}>OFF</Btn>
        </div>
        {opticsendSaved && <div style={{ fontFamily: mono, fontSize: 9, color: P.green }}>SAVED ✓</div>}
      </Card>
      <Card>
        <Label>SESSION</Label>
        <div style={{ fontFamily: mono, fontSize: 10, color: P.mute, lineHeight: 1.8 }}>
          <div>ADMIN ID: {adminId}</div>
          <div>PROJECT: bjgyvmdzcymruunzavni</div>
          <div>CHANNEL: bn427-dispatch</div>
        </div>
      </Card>
    </div>
  );
}
