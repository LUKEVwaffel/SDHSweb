import { useState, useEffect } from 'react';
import { supabase as SB } from '../../../../lib/supabaseClient';
import { P, mono, inter, fs, sp, radius } from '../../theme';
import { Btn, Card, Label, Input, PanelHeader, EmptyState } from '../../shared/ui';

function slugify(name) {
  return String(name || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// Define the reusable suggested-topics list (mirrors AchievementCatalog.jsx).
// S-5 picks from this per photo event in EventsPanel — nothing here is
// event-specific.
export default function VotingTopicsCatalog() {
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [label, setLabel] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await SB.from('voting_topics').select('*').order('sort_order').order('label');
    setTopics(data || []);
    setLoading(false);
  }

  async function create() {
    if (!label.trim()) return;
    setSaving(true);
    const maxOrder = Math.max(0, ...topics.map((t) => t.sort_order || 0));
    await SB.from('voting_topics').insert({ slug: slugify(label) || crypto.randomUUID(), label: label.trim(), sort_order: maxOrder + 1 });
    setLabel(''); setCreating(false); setSaving(false);
    load();
  }

  async function toggleActive(t) {
    await SB.from('voting_topics').update({ active: !t.active }).eq('id', t.id);
    load();
  }

  async function remove(t) {
    if (!confirm(`Delete "${t.label}"? Removes it from any events that already picked it.`)) return;
    await SB.from('voting_topics').delete().eq('id', t.id);
    load();
  }

  if (loading) {
    return <div style={{ fontFamily: mono, fontSize: fs.xs, color: P.mute, textAlign: 'center', padding: 24 }}>LOADING…</div>;
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <PanelHeader
        title="VOTING TOPICS"
        sub={`${topics.length} defined, picked per photo event in Events`}
        action={<Btn variant="gold" size="sm" onClick={() => setCreating((c) => !c)}>{creating ? 'CANCEL' : '+ ADD TOPIC'}</Btn>}
      />

      {creating && (
        <Card style={{ marginBottom: sp[4] }}>
          <Label>LABEL</Label>
          <div style={{ display: 'flex', gap: sp[2] }}>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Best Squad Energy" onKeyDown={(e) => e.key === 'Enter' && create()} />
            <Btn variant="gold" size="sm" onClick={create} disabled={saving || !label.trim()}>{saving ? 'SAVING…' : 'CREATE'}</Btn>
          </div>
        </Card>
      )}

      {topics.length === 0 ? (
        <EmptyState icon="◈" title="NO VOTING TOPICS DEFINED" hint="Add a suggested topic. S-5 picks from this list per photo event instead of typing custom text." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: sp[2] }}>
          {topics.map((t) => (
            <div key={t.id} style={{
              display: 'flex', alignItems: 'center', gap: sp[3],
              background: P.deep, border: `1px solid ${P.hair}`, borderRadius: radius.sm, padding: '9px 12px',
              opacity: t.active ? 1 : 0.5,
            }}>
              <div style={{ flex: 1, minWidth: 0, fontFamily: inter, fontSize: fs.sm, color: P.cream }}>{t.label}</div>
              {!t.active && <span style={{ fontFamily: mono, fontSize: fs.tiny, color: P.mute, letterSpacing: '0.08em' }}>INACTIVE</span>}
              <Btn variant="ghost" size="sm" onClick={() => toggleActive(t)}>{t.active ? 'DEACTIVATE' : 'ACTIVATE'}</Btn>
              <Btn variant="danger" size="sm" onClick={() => remove(t)}>DELETE</Btn>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
