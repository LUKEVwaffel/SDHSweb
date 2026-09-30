import { useState, useEffect, useRef, useCallback } from 'react';
import { BELL_SCHEDULES, formatHHMM, toMinutes, nyMinutesOfDay } from '../../lib/bellSchedules.js';
import { loadSchedulePdf } from './parseSchedule.js';
import './blooddrive.css';

// /blooddrive — drop in the Docs-exported time-slot PDF, leave the page open on
// the laptop hooked to the printer. The moment each slot's time hits, it prints
// that slot's call slips (name + period pre-filled from the Normal/Wednesday
// bell schedule; teacher + room left blank to hand-write). Silent printing
// needs Chrome launched with --kiosk-printing — otherwise the print dialog
// pops each time. Self-contained anon route (App.jsx bypass), all state local.

const LS_KEY = 'bloodDriveState';
const TICK_MS = 10_000;
const SCHEDULE = BELL_SCHEDULES.normal;

function loadSaved() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function save(state) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch {}
}

/** Period the student is in at "HH:MM"; passing time rolls forward to the next period. */
function periodFor(hhmm) {
  const t = toMinutes(hhmm);
  const periods = SCHEDULE.periods;
  const hit = periods.find((p) => t >= toMinutes(p.start) && t < toMinutes(p.end))
    ?? periods.find((p) => toMinutes(p.start) > t)
    ?? periods[periods.length - 1];
  return `${hit.name} (${formatHHMM(hit.start)} – ${formatHHMM(hit.end)})`;
}

const todayLabel = () => new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

export default function BloodDrive() {
  const saved = useRef(loadSaved()).current;
  const [schedule, setSchedule] = useState(saved?.schedule ?? null);
  const [fileName, setFileName] = useState(saved?.fileName ?? '');
  const [status, setStatus] = useState(saved?.status ?? {}); // time -> 'printed' | 'skipped'
  const [armed, setArmed] = useState(saved?.armed ?? false);
  const [nowMin, setNowMin] = useState(() => nyMinutesOfDay(new Date()));
  const [job, setJob] = useState(null); // { time, label, names }
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { save({ schedule, fileName, status, armed }); }, [schedule, fileName, status, armed]);

  useEffect(() => {
    const id = setInterval(() => setNowMin(nyMinutesOfDay(new Date())), TICK_MS);
    return () => clearInterval(id);
  }, []);

  // Fire the print once the slip sheet for `job` is in the DOM. setTimeout, not
  // requestAnimationFrame — rAF never runs while the tab is hidden or the
  // window is covered, which silently stalled auto-print.
  useEffect(() => {
    if (!job) return;
    const id = setTimeout(() => {
      window.print();
      if (job.auto) setStatus((s) => ({ ...s, [job.time]: 'printed' }));
      setJob(null);
    }, 100);
    return () => clearTimeout(id);
  }, [job]);

  // Keep the laptop screen awake while armed so the tab keeps ticking.
  useEffect(() => {
    if (!armed || !('wakeLock' in navigator)) return;
    let lock = null;
    const grab = () => navigator.wakeLock.request('screen').then((l) => { lock = l; }).catch(() => {});
    const onVisible = () => { if (document.visibilityState === 'visible') grab(); };
    grab();
    document.addEventListener('visibilitychange', onVisible);
    return () => { document.removeEventListener('visibilitychange', onVisible); lock?.release().catch(() => {}); };
  }, [armed]);

  // Auto queue: first due, unprinted slot with names. One at a time.
  useEffect(() => {
    if (!armed || !schedule || job) return;
    const due = schedule.slots.find((s) => s.names.length && !status[s.time] && toMinutes(s.time) <= nowMin);
    if (due) setJob({ ...due, auto: true });
  }, [armed, schedule, status, nowMin, job]);

  const onFile = useCallback(async (file) => {
    if (!file) return;
    setError('');
    setLoading(true);
    try {
      const parsed = await loadSchedulePdf(await file.arrayBuffer());
      if (!parsed.slots.length) throw new Error('Found the table header but no time rows.');
      setSchedule(parsed);
      setFileName(file.name);
      setStatus({});
      setArmed(false);
    } catch (e) {
      setError(`Couldn't read that PDF: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const arm = () => {
    // Older slots get skipped, not batch-printed — but the slot currently in
    // progress (latest one whose time has passed) still prints right away.
    const now = nyMinutesOfDay(new Date());
    const current = [...schedule.slots].reverse().find((sl) => sl.names.length && toMinutes(sl.time) <= now);
    setStatus((s) => {
      const next = { ...s };
      for (const slot of schedule.slots) if (!next[slot.time] && slot !== current && toMinutes(slot.time) < now) next[slot.time] = 'skipped';
      return next;
    });
    setNowMin(now);
    setArmed(true);
  };

  const reset = () => {
    if (!window.confirm('Clear the loaded schedule and print history?')) return;
    setSchedule(null); setFileName(''); setStatus({}); setArmed(false);
  };

  const nextSlot = schedule?.slots.find((s) => s.names.length && !status[s.time] && toMinutes(s.time) > nowMin);

  return (
    <div className="bd-page">
      <main className="bd-screen">
        <header className="bd-header">
          <p className="bd-kicker">TROJAN BATTALION · {todayLabel().toUpperCase()}</p>
          <h1>Blood Drive <span>Auto-Print</span></h1>
          <p className="bd-sub">Slips print automatically when each slot's time hits. Periods use the Normal (Wednesday) bell schedule.</p>
        </header>

        {!schedule && (
          <label className={`bd-drop${loading ? ' is-loading' : ''}`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files[0]); }}>
            <input type="file" accept="application/pdf" onChange={(e) => onFile(e.target.files[0])} />
            <strong>{loading ? 'Reading PDF…' : 'Drop the time-slot PDF here'}</strong>
            <span>or click to choose · File → Download → PDF from Google Docs</span>
          </label>
        )}
        {error && <p className="bd-error" role="alert">{error}</p>}

        {schedule && (
          <>
            <section className={`bd-control${armed ? ' is-armed' : ''}`} aria-live="polite">
              <div>
                <p className="bd-control-state">{armed ? '● AUTO-PRINT ON' : '○ AUTO-PRINT OFF'}</p>
                <p className="bd-control-next">
                  {nextSlot ? <>Next: <b>{nextSlot.label}</b> · {nextSlot.names.length} slip{nextSlot.names.length === 1 ? '' : 's'} · in {toMinutes(nextSlot.time) - nowMin} min</> : 'No slots left today.'}
                </p>
                <p className="bd-file">{fileName}</p>
              </div>
              <div className="bd-control-actions">
                {armed
                  ? <button type="button" className="bd-btn" onClick={() => setArmed(false)}>Pause</button>
                  : <button type="button" className="bd-btn bd-btn-primary" onClick={arm}>Start auto-print</button>}
                <button type="button" className="bd-btn" onClick={() => setJob({ time: 'test', label: 'TEST', names: ['Test Cadet'] })}>Test print</button>
                <button type="button" className="bd-btn bd-btn-ghost" onClick={reset}>New PDF</button>
              </div>
            </section>

            <ol className="bd-slots">
              {schedule.slots.map((s) => {
                const st = status[s.time];
                const past = toMinutes(s.time) <= nowMin;
                return (
                  <li key={s.time} className={`bd-slot${st ? ` is-${st}` : ''}${past && !st ? ' is-due' : ''}`}>
                    <div className="bd-slot-time">
                      <b>{s.label}</b>
                      <span>{periodFor(s.time).split(' (')[0]}</span>
                    </div>
                    <p className="bd-slot-names">{s.names.length ? s.names.join(' · ') : <em>empty</em>}</p>
                    <span className="bd-slot-status">{st === 'printed' ? 'PRINTED' : st === 'skipped' ? 'SKIPPED' : past ? 'DUE' : ''}</span>
                    <button type="button" className="bd-btn bd-btn-small" disabled={!s.names.length}
                      onClick={() => { setJob(s); setStatus((x) => ({ ...x, [s.time]: 'printed' })); }}>
                      {st === 'printed' ? 'Reprint' : 'Print'}
                    </button>
                  </li>
                );
              })}
            </ol>

            {schedule.walkIns.length > 0 && (
              <section className="bd-extra">
                <h2>Walk-ins <small>manual print only</small></h2>
                {schedule.walkIns.map((w) => (
                  <div key={w.label} className="bd-extra-row">
                    <p><b>{w.label}</b> {w.names.join(' · ')}</p>
                    <button type="button" className="bd-btn bd-btn-small" onClick={() => setJob(w)}>Print</button>
                  </div>
                ))}
              </section>
            )}

            {schedule.unassigned.length > 0 && (
              <section className="bd-extra">
                <h2>No time given</h2>
                <p>{schedule.unassigned.join(' · ')}</p>
              </section>
            )}
          </>
        )}
      </main>

      {job && <SlipSheet job={job} />}
    </div>
  );
}

function SlipSheet({ job }) {
  const date = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const period = job.time === 'test' ? periodFor('09:00') : periodFor(job.time);
  const time = job.time === 'test' ? 'TEST' : formatHHMM(job.time);
  return (
    <section className="bd-print" aria-hidden="true">
      {job.names.map((name, i) => (
        <article key={`${name}-${i}`} className="bd-slip">
          <header>
            <p>TROJAN BATTALION JROTC</p>
            <h2>Blood Drive Pass</h2>
          </header>
          <dl>
            <div className="bd-slip-wide"><dt>Student</dt><dd className="bd-slip-name">{name}</dd></div>
            <div><dt>Donation time</dt><dd>{time}</dd></div>
            <div><dt>Period</dt><dd>{period}</dd></div>
            <div><dt>Date</dt><dd>{date}</dd></div>
            <div><dt>Teacher</dt><dd className="bd-slip-blank" /></div>
            <div><dt>Room #</dt><dd className="bd-slip-blank" /></div>
          </dl>
          <p className="bd-slip-note">Please release this student to report to the blood drive.</p>
        </article>
      ))}
    </section>
  );
}
