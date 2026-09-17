import { useState, useEffect, useCallback } from 'react';
import { supabase as SB } from '../../../lib/supabaseClient';
import { P, mono } from '../theme';

// Roster CRUD — direct table reads/writes through Supabase-js. No edge
// function needed: rifle_shooters' RLS (is_rifle_admin() or is_s6()) is
// itself the whole access control, same pattern the DISPATCH Accounts panel
// uses for personnel edits.
export default function RosterTab() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [name, setName] = useState('');
  const [rifleNo, setRifleNo] = useState('');

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
    });
    if (error) { setErr(error.message); return; }
    setName(''); setRifleNo('');
    load();
  }

  async function toggleActive(row) {
    setErr('');
    const { error } = await SB.from('rifle_shooters').update({ active: !row.active }).eq('id', row.id);
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

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: 22, flexWrap: 'wrap' }}>
        <div>
          <div style={{ ...label, marginBottom: 6 }}>NAME</div>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Shooter name"
            style={{ background: P.deep, border: `1px solid ${P.hair}`, color: P.cream, fontFamily: mono, fontSize: 13, padding: '10px 12px', outline: 'none' }} />
        </div>
        <div>
          <div style={{ ...label, marginBottom: 6 }}>RIFLE #</div>
          <input value={rifleNo} onChange={(e) => setRifleNo(e.target.value.replace(/\D/g, ''))} placeholder="#" style={{ width: 70, background: P.deep, border: `1px solid ${P.hair}`, color: P.cream, fontFamily: mono, fontSize: 13, padding: '10px 12px', outline: 'none' }} />
        </div>
        <button onClick={addShooter} style={{ background: P.gold, color: P.ink, border: 'none', fontFamily: mono, fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', padding: '11px 18px', cursor: 'pointer' }}>
          ADD SHOOTER
        </button>
      </div>

      {err && <div style={{ fontFamily: mono, fontSize: 12, color: P.red, marginBottom: 14 }}>{err}</div>}
      {loading ? (
        <div style={{ fontFamily: mono, fontSize: 12, color: P.mute }}>Loading roster…</div>
      ) : rows.length === 0 ? (
        <div style={{ fontFamily: mono, fontSize: 12, color: P.mute }}>No shooters yet — add one above.</div>
      ) : (
        rows.map((r) => (
          <div key={r.id} style={rowStyle}>
            <div style={{ flex: 1, fontFamily: 'Inter, sans-serif', fontSize: 14, color: r.active ? P.cream : P.faint }}>{r.name}</div>
            <div style={{ fontFamily: mono, fontSize: 12, color: P.mute, width: 60 }}>#{r.rifle_no ?? '—'}</div>
            <button onClick={() => toggleActive(r)} style={{ background: 'transparent', border: `1px solid ${P.hairStrong}`, color: r.active ? P.win : P.faint, fontFamily: mono, fontSize: 11, letterSpacing: '0.08em', padding: '6px 12px', cursor: 'pointer' }}>
              {r.active ? 'ACTIVE' : 'INACTIVE'}
            </button>
            <button onClick={() => removeShooter(r)} style={{ background: 'transparent', border: 'none', color: P.red, fontFamily: mono, fontSize: 11, cursor: 'pointer', padding: '6px 8px' }}>
              REMOVE
            </button>
          </div>
        ))
      )}
    </div>
  );
}
