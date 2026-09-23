import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase as SB } from '../../../lib/supabaseClient';
import { P, mono } from '../theme';
import { Card, SectionLabel, StatGrid, Stat, EmptyState, PrimaryBtn, GhostBtn, DangerBtn } from './ui';

// Roster CRUD — direct table reads/writes through Supabase-js. No edge
// function needed: rifle_shooters' RLS (is_rifle_admin() or is_s6()) is
// itself the whole access control, same pattern the DISPATCH Accounts panel
// uses for personnel edits.
//
// school_email here is what lets rifle-submit-signup auto-flag a returning
// shooter's interest signup as varsity — back-fill it for last season's
// roster (rows added before this column existed have it blank until edited).
export default function RosterTab() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [name, setName] = useState('');
  const [rifleNo, setRifleNo] = useState('');
  const [schoolEmail, setSchoolEmail] = useState('');

  const load = useCallback(async () => {
    const { data, error } = await SB.from('rifle_shooters').select('*').order('name');
    if (error) { setErr(error.message); setLoading(false); return; }
    setRows(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function addShooter() {
    if (!name.trim()) return;
    setErr('');
    const { error } = await SB.from('rifle_shooters').insert({
      name: name.trim(),
      rifle_no: rifleNo.trim() ? Number(rifleNo.trim()) : null,
      school_email: schoolEmail.trim() ? schoolEmail.trim().toLowerCase() : null,
    });
    if (error) { setErr(error.message); return; }
    setName(''); setRifleNo(''); setSchoolEmail('');
    load();
  }

  async function toggleActive(row) {
    setErr('');
    const { error } = await SB.from('rifle_shooters').update({ active: !row.active }).eq('id', row.id);
    if (error) { setErr(error.message); return; }
    load();
  }

  async function updateEmail(row, value) {
    const next = value.trim() ? value.trim().toLowerCase() : null;
    if (next === (row.school_email || null)) return;
    setErr('');
    const { error } = await SB.from('rifle_shooters').update({ school_email: next }).eq('id', row.id);
    if (error) { setErr(error.message); return; }
    load();
  }

  async function removeShooter(row) {
    setErr('');
    const { error } = await SB.from('rifle_shooters').delete().eq('id', row.id);
    if (error) { setErr(error.message); return; }
    load();
  }

  const rowStyle = { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: `1px solid ${P.hair}` };
  const label = { fontFamily: mono, fontSize: 11, color: P.gold, letterSpacing: '0.1em' };

  const activeCount = useMemo(() => rows.filter((r) => r.active).length, [rows]);
  const emailedCount = useMemo(() => rows.filter((r) => r.school_email).length, [rows]);

  return (
    <div>
      <SectionLabel tag="// TEAM · ROSTER" title="Shooters" sub="Every cadet on the rifle roster — school email links a returning shooter to their signup automatically." />

      <StatGrid>
        <Stat label="TOTAL" value={rows.length} />
        <Stat label="ACTIVE" value={activeCount} tone="up" sub={`${rows.length - activeCount} inactive`} />
        <Stat label="EMAIL ON FILE" value={emailedCount} sub="for signup match" />
      </StatGrid>

      <div style={{ height: 22 }} />

      <Card style={{ marginBottom: 22 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <div style={{ ...label, marginBottom: 6 }}>NAME</div>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Shooter name"
              style={{ background: P.deep, border: `1px solid ${P.hair}`, color: P.cream, fontFamily: mono, fontSize: 13, padding: '10px 12px', outline: 'none' }} />
          </div>
          <div>
            <div style={{ ...label, marginBottom: 6 }}>RIFLE #</div>
            <input value={rifleNo} onChange={(e) => setRifleNo(e.target.value.replace(/\D/g, ''))} placeholder="#" style={{ width: 70, background: P.deep, border: `1px solid ${P.hair}`, color: P.cream, fontFamily: mono, fontSize: 13, padding: '10px 12px', outline: 'none' }} />
          </div>
          <div>
            <div style={{ ...label, marginBottom: 6 }}>SCHOOL EMAIL (for signup match)</div>
            <input value={schoolEmail} onChange={(e) => setSchoolEmail(e.target.value)} placeholder="jsmith123@students.hcde.org"
              style={{ width: 220, background: P.deep, border: `1px solid ${P.hair}`, color: P.cream, fontFamily: mono, fontSize: 13, padding: '10px 12px', outline: 'none' }} />
          </div>
          <PrimaryBtn onClick={addShooter}>ADD SHOOTER</PrimaryBtn>
        </div>
      </Card>

      {err && <div style={{ fontFamily: mono, fontSize: 12, color: P.red, marginBottom: 14 }}>{err}</div>}
      {loading ? (
        <div style={{ fontFamily: mono, fontSize: 12, color: P.mute }}>Loading roster…</div>
      ) : rows.length === 0 ? (
        <EmptyState>No shooters yet — add one above.</EmptyState>
      ) : (
        rows.map((r) => (
          <div key={r.id} style={rowStyle}>
            <div style={{ flex: 1, fontFamily: 'Inter, sans-serif', fontSize: 14, color: r.active ? P.cream : P.faint }}>{r.name}</div>
            <div style={{ fontFamily: mono, fontSize: 12, color: P.mute, width: 60 }}>#{r.rifle_no ?? '—'}</div>
            <input
              defaultValue={r.school_email || ''}
              onBlur={(e) => updateEmail(r, e.target.value)}
              placeholder="school email"
              style={{ width: 200, background: P.deep, border: `1px solid ${P.hair}`, color: r.school_email ? P.cream : P.faint, fontFamily: mono, fontSize: 11, padding: '6px 8px', outline: 'none' }}
            />
            <GhostBtn onClick={() => toggleActive(r)} style={{ color: r.active ? P.win : P.faint, borderColor: r.active ? `${P.win}66` : P.hairStrong }}>
              {r.active ? 'ACTIVE' : 'INACTIVE'}
            </GhostBtn>
            <DangerBtn onClick={() => removeShooter(r)} style={{ border: 'none' }}>REMOVE</DangerBtn>
          </div>
        ))
      )}
    </div>
  );
}
