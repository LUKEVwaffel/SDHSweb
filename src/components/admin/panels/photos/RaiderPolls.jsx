import { useState, useEffect, useCallback } from 'react';
import { supabase as SB } from '../../../../lib/supabaseClient';
import { P, mono, oswald, fs, sp } from '../../theme';
import { Btn, Card, Label, PanelHeader, EmptyState } from '../../shared/ui';
import { downloadWinnerCard } from '../../lib/winnerCard';
import { RAIDER_BUCKET, RCATS, defaultCloses } from './pollHelpers';

export default function RaiderPolls({ adminId }) {
  const [events, setEvents] = useState([]);
  const [polls, setPolls] = useState({});
  const [selEvt, setSelEvt] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [closesInput, setClosesInput] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [{ data: evs }, { data: pl }] = await Promise.all([
      SB.from('events').select('*').order('date', { ascending: false }),
      SB.from('polls').select('*').eq('team', 'raiders'),
    ]);
    setEvents(evs || []);
    setPolls(Object.fromEntries((pl || []).map((p) => [p.event_id, p])));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function loadPhotos(evt) {
    setSelEvt(evt);
    setClosesInput(defaultCloses(evt.date));
    const { data } = await SB.from('photos').select('*').eq('team', 'raiders').eq('event_id', evt.id).order('created_at', { ascending: false });
    setPhotos(data || []);
  }

  async function openPoll() {
    if (!selEvt) return;
    setBusy(true);
    const iso = closesInput ? new Date(closesInput).toISOString() : null;
    await SB.rpc('open_poll', { p_event: selEvt.id, p_team: 'raiders', p_closes: iso });
    await load();
    setBusy(false);
  }

  async function closePoll() {
    const poll = polls[selEvt?.id];
    if (!poll || !confirm('Close poll now and freeze winners? This publishes to the Raiders page.')) return;
    setBusy(true);
    await SB.rpc('finalize_poll', { p_poll: poll.id });
    await load();
    setBusy(false);
  }

  async function resetVotes(photo) {
    if (!confirm('Reset this photo’s votes?')) return;
    await SB.rpc('reset_photo_votes', { p_photo: photo.id });
    loadPhotos(selEvt);
  }

  async function deletePhoto(photo) {
    if (!confirm('Delete this photo?')) return;
    if (photo.storage_path) {
      await SB.storage.from(RAIDER_BUCKET).remove([photo.storage_path, photo.storage_path.replace('.jpg', '_t.jpg')]);
    }
    await SB.from('photos').delete().eq('id', photo.id);
    loadPhotos(selEvt);
  }

  const poll = selEvt ? polls[selEvt.id] : null;
  const evTitle = selEvt?.title;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: sp[4] }}>
      {/* event list */}
      <div>
        <PanelHeader title="EVENTS" action={<Btn onClick={load} variant="ghost" size="sm">↺</Btn>} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: sp[2] }}>
          {events.map((ev) => {
            const p = polls[ev.id];
            const tag = p?.status === 'open' ? '● OPEN' : p?.status === 'closed' ? '✓ CLOSED' : '';
            return (
              <Card key={ev.id} style={{ cursor: 'pointer', padding: `${sp[3]}px ${sp[4]}px`, border: `1px solid ${selEvt?.id === ev.id ? P.gold : P.hair}` }}
                onClick={() => loadPhotos(ev)}>
                <div style={{ fontFamily: oswald, fontSize: fs.base, color: P.cream }}>{ev.title}</div>
                <div style={{ fontFamily: mono, fontSize: fs.tiny, color: P.mute, marginTop: 3 }}>
                  {ev.date} {tag && <span style={{ color: p.status === 'open' ? P.green : P.gold, marginLeft: 6 }}>{tag}</span>}
                </div>
              </Card>
            );
          })}
          {!events.length && <EmptyState icon="◷" title="NO EVENTS" hint="Add an event in the Events section first, then open a poll for it here." />}
        </div>
      </div>

      {/* poll control */}
      <div>
        {!selEvt ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 240, gap: sp[3], color: P.faint }}>
            <div style={{ fontFamily: oswald, fontSize: fs.xxl, color: P.hairStrong }}>⊞</div>
            <div style={{ fontFamily: mono, fontSize: fs.xs, color: P.mute, letterSpacing: '0.14em' }}>SELECT AN EVENT</div>
            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: fs.sm, color: P.faint }}>to open, manage, or freeze its photo poll</div>
          </div>
        ) : (
          <>
            <PanelHeader title={`POLL · ${evTitle}`} />
            <Card style={{ marginBottom: sp[4] }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: sp[6], flexWrap: 'wrap' }}>
                <div>
                  <Label>Status</Label>
                  <div style={{ fontFamily: oswald, fontSize: fs.lg, color: poll?.status === 'open' ? P.green : poll?.status === 'closed' ? P.bright : P.mute }}>
                    {poll?.status?.toUpperCase() || 'NO POLL'}
                  </div>
                </div>
                {poll?.closes_at && (
                  <div>
                    <Label>Closes</Label>
                    <div style={{ fontFamily: mono, fontSize: fs.sm, color: P.cream }}>{new Date(poll.closes_at).toLocaleString()}</div>
                  </div>
                )}
              </div>
              <div style={{ marginTop: sp[4] }}>
                <Label>Close time (auto-close fires within ~10 min after)</Label>
                <input type="datetime-local" value={closesInput} onChange={(e) => setClosesInput(e.target.value)}
                  style={{ background: P.deep, border: `1px solid ${P.hair}`, color: P.cream, fontFamily: mono, fontSize: fs.sm, padding: '11px 13px', outline: 'none', borderRadius: 5 }} />
              </div>
              <div style={{ display: 'flex', gap: sp[2], marginTop: sp[4] }}>
                <Btn onClick={openPoll} variant="gold" size="sm" disabled={busy}>
                  {poll?.status === 'open' ? 'UPDATE / REOPEN' : 'OPEN POLL'}
                </Btn>
                {poll?.status === 'open' && <Btn onClick={closePoll} variant="danger" size="sm" disabled={busy}>CLOSE NOW + FREEZE WINNERS</Btn>}
              </div>
            </Card>

            {/* winners export (closed) */}
            {poll?.status === 'closed' && (
              <Card style={{ marginBottom: sp[4] }}>
                <Label>Winners · download share card for social</Label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: sp[3], marginTop: sp[2] }}>
                  {RCATS.map((c) => {
                    const win = photos.find((p) => p.id === poll[`winner_${c.key}`]);
                    return (
                      <div key={c.key} style={{ textAlign: 'center' }}>
                        <div style={{ fontFamily: mono, fontSize: fs.tiny, color: P.gold, marginBottom: sp[1] }}>{c.label}</div>
                        {win ? (
                          <>
                            <img src={win.thumb_url || win.photo_url} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 5 }} />
                            <Btn onClick={() => downloadWinnerCard(win.photo_url, c.label, evTitle, win.uploader_name)} variant="ghost" size="sm" style={{ marginTop: sp[1], width: '100%' }}>↓ CARD</Btn>
                          </>
                        ) : <div style={{ fontFamily: mono, fontSize: fs.tiny, color: P.mute }}>no votes</div>}
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}

            {/* photo tallies */}
            <PanelHeader title={`PHOTOS · ${photos.length}`} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: sp[2] }}>
              {photos.map((p) => (
                <div key={p.id} style={{ position: 'relative', borderRadius: 6, overflow: 'hidden' }}>
                  <img src={p.thumb_url || p.photo_url} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }} />
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(6,16,31,0.88)', padding: '5px 7px' }}>
                    <div style={{ fontFamily: mono, fontSize: fs.tiny, color: P.gold }}>F{p.votes_funny} · A{p.votes_aura} · T{p.votes_team}</div>
                    <div style={{ display: 'flex', gap: sp[2], marginTop: 3 }}>
                      <button onClick={() => resetVotes(p)} style={{ background: 'none', border: 'none', color: P.mute, cursor: 'pointer', fontSize: fs.tiny }}>reset</button>
                      <button onClick={() => deletePhoto(p)} style={{ background: 'none', border: 'none', color: P.red, cursor: 'pointer', fontSize: fs.sm }}>×</button>
                    </div>
                  </div>
                </div>
              ))}
              {!photos.length && <div style={{ gridColumn: '1/-1' }}><EmptyState icon="⊞" title="NO PHOTOS UPLOADED YET" hint="Cadets upload from the public Submit Photos page; they'll appear here to tally and moderate." /></div>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
