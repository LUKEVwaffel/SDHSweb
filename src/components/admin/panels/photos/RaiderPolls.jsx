import { useState, useEffect, useCallback } from 'react';
import { supabase as SB } from '../../../../lib/supabaseClient';
import { P, mono, oswald } from '../../theme';
import { Btn, Card, Label, PanelHeader } from '../../shared/ui';
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
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 12 }}>
      {/* event list */}
      <div>
        <PanelHeader title="EVENTS" action={<Btn onClick={load} variant="ghost" style={{ fontSize: 9 }}>↺</Btn>} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {events.map((ev) => {
            const p = polls[ev.id];
            const tag = p?.status === 'open' ? '● OPEN' : p?.status === 'closed' ? '✓ CLOSED' : '';
            return (
              <Card key={ev.id} style={{ cursor: 'pointer', padding: '8px 10px', border: `1px solid ${selEvt?.id === ev.id ? P.gold : P.hair}` }}
                onClick={() => loadPhotos(ev)}>
                <div style={{ fontFamily: oswald, fontSize: 12, color: P.cream }}>{ev.title}</div>
                <div style={{ fontFamily: mono, fontSize: 9, color: P.mute }}>
                  {ev.date} {tag && <span style={{ color: p.status === 'open' ? P.green : P.gold, marginLeft: 6 }}>{tag}</span>}
                </div>
              </Card>
            );
          })}
          {!events.length && <div style={{ fontFamily: mono, fontSize: 10, color: P.mute }}>No events. Add one in EVENTS.</div>}
        </div>
      </div>

      {/* poll control */}
      <div>
        {!selEvt ? (
          <div style={{ fontFamily: mono, fontSize: 10, color: P.mute, textAlign: 'center', marginTop: 40 }}>← SELECT AN EVENT</div>
        ) : (
          <>
            <PanelHeader title={`POLL · ${evTitle}`} />
            <Card style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <Label>STATUS</Label>
                  <div style={{ fontFamily: oswald, fontSize: 16, color: poll?.status === 'open' ? P.green : poll?.status === 'closed' ? P.bright : P.mute }}>
                    {poll?.status?.toUpperCase() || 'NO POLL'}
                  </div>
                </div>
                {poll?.closes_at && (
                  <div>
                    <Label>CLOSES</Label>
                    <div style={{ fontFamily: mono, fontSize: 11, color: P.cream }}>{new Date(poll.closes_at).toLocaleString()}</div>
                  </div>
                )}
              </div>
              <div style={{ marginTop: 12 }}>
                <Label>CLOSE TIME (auto-close fires within ~10 min after)</Label>
                <input type="datetime-local" value={closesInput} onChange={(e) => setClosesInput(e.target.value)}
                  style={{ background: P.deep, border: `1px solid ${P.hair}`, color: P.cream, fontFamily: mono, fontSize: 11, padding: '6px 8px', outline: 'none' }} />
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
                <Btn onClick={openPoll} variant="gold" disabled={busy} style={{ fontSize: 9 }}>
                  {poll?.status === 'open' ? 'UPDATE / REOPEN' : 'OPEN POLL'}
                </Btn>
                {poll?.status === 'open' && <Btn onClick={closePoll} variant="danger" disabled={busy} style={{ fontSize: 9 }}>CLOSE NOW + FREEZE WINNERS</Btn>}
              </div>
            </Card>

            {/* winners export (closed) */}
            {poll?.status === 'closed' && (
              <Card style={{ marginBottom: 12 }}>
                <Label>WINNERS · DOWNLOAD SHARE CARD FOR SOCIAL</Label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginTop: 6 }}>
                  {RCATS.map((c) => {
                    const win = photos.find((p) => p.id === poll[`winner_${c.key}`]);
                    return (
                      <div key={c.key} style={{ textAlign: 'center' }}>
                        <div style={{ fontFamily: mono, fontSize: 9, color: P.gold, marginBottom: 4 }}>{c.label}</div>
                        {win ? (
                          <>
                            <img src={win.thumb_url || win.photo_url} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover' }} />
                            <Btn onClick={() => downloadWinnerCard(win.photo_url, c.label, evTitle, win.uploader_name)} variant="ghost" style={{ fontSize: 8, marginTop: 4, width: '100%' }}>↓ CARD</Btn>
                          </>
                        ) : <div style={{ fontFamily: mono, fontSize: 8, color: P.mute }}>no votes</div>}
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}

            {/* photo tallies */}
            <PanelHeader title={`PHOTOS · ${photos.length}`} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
              {photos.map((p) => (
                <div key={p.id} style={{ position: 'relative' }}>
                  <img src={p.thumb_url || p.photo_url} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }} />
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(6,16,31,0.85)', padding: '3px 5px' }}>
                    <div style={{ fontFamily: mono, fontSize: 8, color: P.gold }}>F{p.votes_funny} · A{p.votes_aura} · T{p.votes_team}</div>
                    <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
                      <button onClick={() => resetVotes(p)} style={{ background: 'none', border: 'none', color: P.mute, cursor: 'pointer', fontSize: 9 }}>reset</button>
                      <button onClick={() => deletePhoto(p)} style={{ background: 'none', border: 'none', color: P.red, cursor: 'pointer', fontSize: 11 }}>×</button>
                    </div>
                  </div>
                </div>
              ))}
              {!photos.length && <div style={{ gridColumn: '1/-1', fontFamily: mono, fontSize: 10, color: P.mute, textAlign: 'center', padding: 20 }}>NO PHOTOS UPLOADED YET</div>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
