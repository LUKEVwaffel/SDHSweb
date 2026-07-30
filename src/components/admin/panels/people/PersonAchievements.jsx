import { useState, useEffect } from 'react';
import { supabase as SB } from '../../../../lib/supabaseClient';
import { P, mono, inter, fs, sp, radius } from '../../theme';
import { Btn, Label } from '../../shared/ui';

// Assign/remove achievement badges for one person — lives on the person's
// PeoplePanel detail view instead of a standalone Achievements tab. Catalog
// definition (name/icon) stays under Advanced → Achievements.
export default function PersonAchievements({ personnelId, achievements }) {
  const [links, setLinks] = useState([]);
  const [addId, setAddId] = useState('');

  useEffect(() => { load(); }, [personnelId]);

  async function load() {
    const { data } = await SB.from('cadet_achievements')
      .select('id, achievements(id, name, icon_url)')
      .eq('personnel_id', personnelId);
    setLinks(data || []);
  }

  const available = achievements.filter((a) => !links.some((l) => l.achievements?.id === a.id));

  async function add() {
    if (!addId) return;
    await SB.from('cadet_achievements').insert({ personnel_id: personnelId, achievement_id: addId });
    setAddId('');
    load();
  }

  async function remove(linkId) {
    await SB.from('cadet_achievements').delete().eq('id', linkId);
    load();
  }

  return (
    <div style={{ marginBottom: sp[3] }}>
      <Label>ACHIEVEMENTS</Label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '6px 0 10px' }}>
        {links.length === 0 && <div style={{ fontFamily: inter, fontSize: fs.xs, color: P.faint }}>No achievements assigned yet.</div>}
        {links.map((l) => (
          <span key={l.id} style={{
            fontFamily: mono, fontSize: fs.tiny, letterSpacing: '0.06em', padding: '5px 8px 5px 6px',
            borderRadius: 4, border: `1px solid ${P.hairStrong}`, color: P.gold, background: P.goldWash,
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
            <img src={l.achievements?.icon_url} alt="" style={{ width: 14, height: 14, objectFit: 'contain' }} />
            {l.achievements?.name?.toUpperCase()}
            <button onClick={() => remove(l.id)} aria-label="Remove" style={{
              all: 'unset', cursor: 'pointer', color: P.faint, fontSize: 11, lineHeight: 1,
            }}>×</button>
          </span>
        ))}
      </div>

      {available.length > 0 ? (
        <div style={{ display: 'flex', gap: sp[2], alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 160 }}>
            <select value={addId} onChange={(e) => setAddId(e.target.value)} style={selectStyle}>
              <option value="">Add achievement…</option>
              {available.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <Btn variant="gold" size="sm" onClick={add} disabled={!addId}>ADD</Btn>
        </div>
      ) : achievements.length > 0 ? (
        <div style={{ fontFamily: mono, fontSize: fs.tiny, color: P.faint, letterSpacing: '0.08em' }}>ALL DEFINED ACHIEVEMENTS ASSIGNED</div>
      ) : (
        <div style={{ fontFamily: mono, fontSize: fs.tiny, color: P.faint, letterSpacing: '0.08em' }}>NO ACHIEVEMENT TYPES DEFINED YET — add one under Advanced → Achievements</div>
      )}
    </div>
  );
}

const selectStyle = {
  background: P.deep, border: `1px solid ${P.hair}`, color: P.cream,
  fontFamily: mono, fontSize: 11, padding: '9px 10px', outline: 'none', cursor: 'pointer',
  borderRadius: radius.sm, boxSizing: 'border-box',
};
