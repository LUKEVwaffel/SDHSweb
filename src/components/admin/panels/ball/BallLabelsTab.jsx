import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {readBallLiveSnapshot} from '../../../../lib/ballLiveSnapshot';
import { supabase as SB } from '../../../../lib/supabaseClient';
import { P, mono, inter, sp, radius } from '../../theme';
import { Btn, Label } from '../../shared/ui';
import { printBallEnvelopeLabels, AVERY_5160 } from '../../../../lib/ballLabelPrint';

// Envelope sticker labels for the Military Ball. "Fully approved" mirrors the
// settled/green-dot condition on the Overview tab (verified + cash + field
// trip form) plus dress approval on top — this is the set of guests whose
// envelope is actually ready to seal and address. Label content is read
// straight off the picked signup/guest row — no freehand text field — so the
// sticker can never drift from what was actually verified.
import { isBallLabelEligible } from '../../../../lib/ballLabelEligibility';

const LAST_INDEX_KEY = 'ballLabelLastIndex';


function readLastIndex() {
  try {
    const v = Number(localStorage.getItem(LAST_INDEX_KEY));
    return Number.isInteger(v) && v >= 0 && v < AVERY_5160.count ? v : 0;
  } catch { return 0; }
}

function metaLine(letLevel, company) {
  return [letLevel ? `LET ${letLevel}` : null, company ? company.toUpperCase() : null].filter(Boolean).join(' · ');
}

export default function BallLabelsTab() {
  const generation=useRef(0);
  const [refreshing,setRefreshing]=useState(false);
  const [checkedAt,setCheckedAt]=useState('');
  const [signups, setSignups] = useState(null);
  const [guestBySignup, setGuestBySignup] = useState({});
  const [err, setErr] = useState('');
  const [printing, setPrinting] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [labelIndex, setLabelIndex] = useState(readLastIndex);

  const load = useCallback(async () => {
    const sequence=++generation.current;setRefreshing(true);
    try{
      const snapshot=await readBallLiveSnapshot();
      if(sequence!==generation.current)return;
      setGuestBySignup(Object.fromEntries(snapshot.guests.map(g=>[g.signup_id,g])));
      setSignups(snapshot.hosts);setCheckedAt(snapshot.checked_at);setErr('');
    }catch(error){if(sequence===generation.current){setErr(error.message||'Could not verify current records. Printing is paused.');setSignups(previous=>previous||[]);}}
    finally{if(sequence===generation.current)setRefreshing(false);}
  }, []);
  useEffect(()=>{
    load();const timer=setInterval(load,15000);
    const focus=()=>load();window.addEventListener('focus',focus);
    const visible=()=>{if(document.visibilityState==='visible')load();};document.addEventListener('visibilitychange',visible);
    const channel=SB.channel('ball-labels-tab').on('postgres_changes',{event:'*',schema:'public',table:'ball_signups'},load).on('postgres_changes',{event:'*',schema:'public',table:'ball_guests'},load).subscribe();
    const invalidatePending=()=>{generation.current++;};
    return()=>{invalidatePending();clearInterval(timer);window.removeEventListener('focus',focus);document.removeEventListener('visibilitychange',visible);SB.removeChannel(channel);};
  },[load]);

  const approved = useMemo(() => {
    const rows = signups || [];
    return rows
      .filter((r) => isBallLabelEligible(r, guestBySignup[r.id]))
      .map((r) => ({ r, guest: guestBySignup[r.id] }));
  }, [signups, guestBySignup]);

  // Re-derived from the live rows every render (not copied into local state)
  // so the selected label can never go stale or be hand-edited.
  const selected = useMemo(() => approved.find((a) => a.r.id === selectedId) || null, [approved, selectedId]);
  const fields = selected ? {
    cadetName: selected.r.cadet_name || '',
    letLevel: selected.r.cadet_let_level || '',
    company: selected.r.cadet_company || '',
    guestName: selected.guest?.name || '',
  } : null;

  function pickIndex(i) {
    setLabelIndex(i);
    try { localStorage.setItem(LAST_INDEX_KEY, String(i)); } catch { /* private browsing — non-fatal */ }
  }

  async function printLabels(all) {
    if (printing || refreshing || err) return;
    const ids = all ? approved.map(({r}) => r.id) : selected ? [selected.r.id] : [];
    if (!ids.length) return;
    // Reserve the popup during the click, before waiting for live approval checks.
    const win = window.open('', '_blank');
    if (!win) { setErr('Allow popups to open the label print window.'); return; }
    setPrinting(true);
    setErr('');
    const startIndex = labelIndex;
    try {
      const snapshot=await readBallLiveSnapshot();
      const bySignup=Object.fromEntries(snapshot.guests.map(g=>[g.signup_id,g]));
      const hosts=snapshot.hosts.filter(row=>ids.includes(row.id)).sort((a,b)=>a.cadet_name.localeCompare(b.cadet_name));
      if(hosts.length!==ids.length||hosts.some(row=>!isBallLabelEligible(row,bySignup[row.id])))throw new Error('A selected reservation changed. Review the refreshed list before printing.');
      const labels=hosts.map(r=>({cadetName:r.cadet_name||'',letLevel:r.cadet_let_level||'',company:r.cadet_company||'',guestName:bySignup[r.id]?.name||''}));
      if((await readBallLiveSnapshot()).version!==snapshot.version)throw new Error('Ball records changed while preparing these labels. Retry. Nothing was printed.');
      if (!printBallEnvelopeLabels(labels, startIndex, win)) { win.close(); return; }
      pickIndex((startIndex + labels.length) % AVERY_5160.count);
    } catch (error) {
      win.close();
      await load();
      setErr(error.message || 'Could not verify ticket approval. No labels were printed.');
    } finally { setPrinting(false); }
  }

  if (signups === null) {
    return <div style={{ fontFamily: mono, fontSize: 13, color: P.mute }}>LOADING…</div>;
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 340px) 1fr', gap: sp[6], alignItems: 'start' }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: sp[3] }}>
          <Label style={{ marginBottom: 0 }}>FULLY APPROVED ({approved.length})</Label>
          <Btn size="sm" variant="ghost" onClick={load} disabled={refreshing}>{refreshing?'CHECKING…':'RESCAN'}</Btn>
        </div>

        <p style={{fontSize:12,color:P.mute}}>Live check every 15 seconds · {checkedAt?new Date(checkedAt).toLocaleTimeString():'Checking…'}</p>
        {err && <div style={{ fontFamily: mono, fontSize: 12, color: P.red, marginBottom: sp[3] }}>{err}</div>}

        {approved.length === 0 ? (
          <div style={{ fontFamily: mono, fontSize: 12, color: P.faint, lineHeight: 1.6 }}>
            Nobody is fully approved yet — verified, cash settled, field trip form in, and dress approved.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: sp[2], maxHeight: 480, overflowY: 'auto' }}>
            {approved.map(({ r, guest }) => (
              <button
                key={r.id}
                onClick={() => setSelectedId(r.id)}
                style={{
                  textAlign: 'left', cursor: 'pointer', padding: '10px 12px', borderRadius: radius.sm,
                  background: selectedId === r.id ? P.goldWash : P.navy,
                  border: `1px solid ${selectedId === r.id ? P.gold : P.hair}`,
                  fontFamily: inter, color: P.cream, fontSize: 13,
                }}
              >
                <div style={{ fontWeight: 600 }}>{r.cadet_name}{guest && <span style={{ color: P.mute, fontWeight: 400 }}> + {guest.name}</span>}</div>
                <div style={{ fontFamily: mono, fontSize: 10, color: P.faint, marginTop: 3, letterSpacing: '0.06em' }}>
                  {metaLine(r.cadet_let_level, r.cadet_company) || 'READY TO PRINT'}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <Label>LABEL PREVIEW</Label>
        <LabelPreview fields={fields} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: `${sp[5]}px 0 ${sp[2]}px` }}>
          <Label style={{ marginBottom: 0 }}>AVERY 5160 SHEET — PICK THE OPEN LABEL</Label>
          <div style={{ fontFamily: mono, fontSize: 11, color: P.faint }}>Cell {labelIndex + 1} of {AVERY_5160.count}</div>
        </div>
        <AverySheetPicker index={labelIndex} onPick={pickIndex} fields={fields} />

        <div style={{ marginTop: sp[5], display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: sp[3] }}>
          <Btn variant="gold" onClick={() => printLabels(false)} disabled={!selected || printing || refreshing || !!err}>PRINT THIS LABEL</Btn>
          <Btn variant="ghost" onClick={() => printLabels(true)} disabled={!approved.length || printing || refreshing || !!err}>PRINT ALL AVAILABLE ({approved.length})</Btn>
          {!selected && <span style={{ fontFamily: mono, fontSize: 11, color: P.faint }}>Pick a signup from the approved list first.</span>}
        </div>
        <p style={{ fontFamily: mono, fontSize: 11, color: P.faint, lineHeight: 1.7, marginTop: sp[3] }}>
          Print one selected tag, or all {approved.length} available tags in a single print job.
          Required cadet and guest forms, full payment, verification and dress/attire approvals are rechecked before printing.
          Both start at cell {labelIndex + 1}; unused cells before it stay blank.
          {approved.length > 0 && ` Print all uses ${Math.ceil((labelIndex + approved.length) / AVERY_5160.count)} sheet(s).`}
          {' '}Use fresh sheets after the first partially-used sheet. Print at 100% / actual size, with browser headers and footers off.
          The next open cell is selected when the print window opens; reset it if you cancel printing.
        </p>
      </div>
    </div>
  );
}

// Same visual as the printed sticker (Georgia name, mono LET/company, italic
// guest) at roughly the real 2.625x1in proportions, so what staff see here is
// what comes out of the printer.
function LabelPreview({ fields }) {
  return (
    <div
      style={{
        width: '100%', maxWidth: 380, aspectRatio: '2.625 / 1', background: '#fdfcf8',
        border: `1px solid ${P.hair}`, borderRadius: radius.md, padding: '10px 16px 12px',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
      }}
    >
      <div style={{ width: '100%', textAlign: 'center', fontFamily: 'Arial, sans-serif', fontWeight: 700, fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#000', paddingBottom: 5, marginBottom: 5, borderBottom: '1px solid #000' }}>
        Trojan Battalion &middot; Military Ball
      </div>
      <div style={{ flex: 1, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', minHeight: 0 }}>
        {fields ? (
          <>
            <div style={{ fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: 22, color: '#000', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fields.cadetName}</div>
            {metaLine(fields.letLevel, fields.company) && (
              <div style={{ fontFamily: mono, fontWeight: 700, fontSize: 11, letterSpacing: '0.07em', color: '#000', marginTop: 4 }}>{metaLine(fields.letLevel, fields.company)}</div>
            )}
            {fields.guestName && (
              <div style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontWeight: 600, fontSize: 15, color: '#000', marginTop: 5 }}>+ {fields.guestName}</div>
            )}
          </>
        ) : (
          <div style={{ fontFamily: mono, fontSize: 11, color: '#b8b0a0' }}>Pick an approved signup to preview</div>
        )}
      </div>
    </div>
  );
}

function AverySheetPicker({ index, onPick, fields }) {
  const cells = Array.from({ length: AVERY_5160.count }, (_, i) => i);
  return (
    <div
      style={{
        display: 'grid', gridTemplateColumns: `repeat(${AVERY_5160.cols}, 1fr)`, gap: 4,
        background: '#fdfcf8', border: `1px solid ${P.hair}`, borderRadius: radius.md, padding: 10,
      }}
    >
      {cells.map((i) => {
        const active = i === index;
        return (
          <button
            key={i}
            onClick={() => onPick(i)}
            title={`Label ${i + 1}`}
            style={{
              cursor: 'pointer', aspectRatio: '2.625 / 1', borderRadius: 3, padding: '3px 5px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
              background: active ? '#FFF7E6' : '#ffffff',
              border: `1.5px solid ${active ? P.gold : '#d8d2c2'}`,
              boxShadow: active ? `0 0 0 2px ${P.goldWash}` : 'none',
            }}
          >
            {active && fields ? (
              <>
                <div style={{ fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: 8, color: '#000', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{fields.cadetName}</div>
                {fields.guestName && <div style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: 6.5, color: '#000', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>+ {fields.guestName}</div>}
              </>
            ) : (
              <div style={{ fontFamily: mono, fontSize: 9, color: '#b8b0a0' }}>{i + 1}</div>
            )}
          </button>
        );
      })}
    </div>
  );
}
