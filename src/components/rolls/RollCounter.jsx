import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';
import './rolls.css';

// /rolls — Texas Roadhouse roll counter. Sign up with a name once (kept in
// localStorage so a reload/reopen picks the same person back up), tap to
// count your own rolls, watch the whole table's live count. Self-contained
// anon route (App.jsx bypass), no auth — same pattern as /raidertv.

const EVENT_KEY = 'texas-roadhouse-2026-09-19';
const LS_KEY = 'rollCounterEntry';

function loadSaved() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveEntry(id, name) {
  try { localStorage.setItem(LS_KEY, JSON.stringify({ id, name })); } catch {}
}

function clearSaved() {
  try { localStorage.removeItem(LS_KEY); } catch {}
}

const ROLL_EMOJI = ['🥖', '🍞', '🥐'];

export default function RollCounter() {
  const [saved, setSaved] = useState(loadSaved);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nameInput, setNameInput] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState('');
  const bumpTimer = useRef(null);

  const fetchEntries = useCallback(async () => {
    const { data } = await supabase
      .from('roll_counter_entries')
      .select('id, name, count')
      .eq('event', EVENT_KEY)
      .order('count', { ascending: false })
      .order('created_at', { ascending: true });
    setEntries(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchEntries();

    const channel = supabase
      .channel('roll-counter-' + EVENT_KEY)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'roll_counter_entries', filter: `event=eq.${EVENT_KEY}`,
      }, (payload) => {
        setEntries((prev) => {
          if (payload.eventType === 'DELETE') {
            return prev.filter((e) => e.id !== payload.old.id);
          }
          const row = payload.new;
          const next = prev.filter((e) => e.id !== row.id);
          next.push({ id: row.id, name: row.name, count: row.count });
          next.sort((a, b) => b.count - a.count);
          return next;
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchEntries]);

  // If the saved id got wiped server-side (table reset), fall back to signup
  // — give the initial fetch a beat before declaring it gone.
  useEffect(() => {
    if (!saved || loading || entries.some((e) => e.id === saved.id)) return;
    const t = setTimeout(() => { clearSaved(); setSaved(null); }, 1500);
    return () => clearTimeout(t);
  }, [saved, entries, loading]);

  async function handleJoin(e) {
    e.preventDefault();
    const name = nameInput.trim();
    if (!name) return;
    setJoining(true);
    setJoinError('');
    const { data, error } = await supabase
      .from('roll_counter_entries')
      .insert({ event: EVENT_KEY, name, count: 0 })
      .select('id, name, count')
      .single();
    setJoining(false);
    if (error || !data) {
      setJoinError("Couldn't sign up — try again.");
      return;
    }
    saveEntry(data.id, data.name);
    setSaved({ id: data.id, name: data.name });
    setEntries((prev) => [...prev, data].sort((a, b) => b.count - a.count));
  }

  const mine = saved ? entries.find((e) => e.id === saved.id) : null;

  // Computes the next count from whatever state is *currently queued*, not
  // from `mine` (a render-scope closure) — a fast double-tap fires bump()
  // twice before React re-renders, so reading mine.count each time silently
  // dropped every click but the last. pendingWriteRef mirrors the value the
  // functional updater just computed so the debounced write stays in sync.
  const pendingWriteRef = useRef(null);

  function flushPendingWrite() {
    const pending = pendingWriteRef.current;
    if (!pending) return;
    pendingWriteRef.current = null;
    supabase.from('roll_counter_entries').update({ count: pending.count }).eq('id', pending.id).then(() => {});
  }

  function bump(delta) {
    if (!saved) return;
    setEntries((prev) => {
      const idx = prev.findIndex((e) => e.id === saved.id);
      if (idx === -1) return prev;
      const nextCount = Math.max(0, Math.min(999, prev[idx].count + delta));
      pendingWriteRef.current = { id: saved.id, count: nextCount };
      const next = prev.slice();
      next[idx] = { ...prev[idx], count: nextCount };
      next.sort((a, b) => b.count - a.count);
      return next;
    });
    clearTimeout(bumpTimer.current);
    bumpTimer.current = setTimeout(flushPendingWrite, 250);
  }

  // Don't lose a tap that's still debounced if the tab is backgrounded
  // (phone locks, they swipe to another app) or the component unmounts.
  useEffect(() => {
    document.addEventListener('visibilitychange', flushPendingWrite);
    window.addEventListener('pagehide', flushPendingWrite);
    return () => {
      document.removeEventListener('visibilitychange', flushPendingWrite);
      window.removeEventListener('pagehide', flushPendingWrite);
      flushPendingWrite();
    };
  }, []);

  function switchName() {
    clearSaved();
    setSaved(null);
    setNameInput('');
  }

  const totalRolls = entries.reduce((sum, e) => sum + e.count, 0);
  const rankOf = mine ? entries.findIndex((e) => e.id === mine.id) + 1 : null;

  return (
    <div className="rolls-page">
      <div className="rolls-bg" aria-hidden="true">
        {ROLL_EMOJI.map((emoji, i) => (
          <span key={i} className={`rolls-bg-item rolls-bg-item-${i}`}>{emoji}</span>
        ))}
      </div>

      <header className="rolls-header">
        <p className="rolls-eyebrow">Texas Roadhouse · Tonight</p>
        <h1 className="rolls-title">Roll Counter</h1>
        <p className="rolls-sub">{totalRolls} roll{totalRolls === 1 ? '' : 's'} down as a group</p>
        <p className="rolls-honor">Honor system: only tap <strong>after</strong> you've actually eaten the roll — no pre-counting.</p>
      </header>

      {!saved || !mine ? (
        <section className="rolls-join" aria-labelledby="rolls-join-heading">
          <h2 id="rolls-join-heading">What's your name?</h2>
          <form onSubmit={handleJoin} className="rolls-join-form">
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="e.g. Luke"
              maxLength={30}
              autoFocus
              className="rolls-name-input"
            />
            <button type="submit" disabled={joining || !nameInput.trim()} className="rolls-join-btn">
              {joining ? 'Joining…' : "I'm in"}
            </button>
          </form>
          {joinError && <p className="rolls-error">{joinError}</p>}
        </section>
      ) : (
        <section className="rolls-me" aria-label="Your roll count">
          <p className="rolls-me-name">{mine.name}{rankOf ? <span className="rolls-me-rank">#{rankOf}</span> : null}</p>
          <div className="rolls-count-display">{mine.count}</div>
          <div className="rolls-controls">
            <button
              type="button"
              className="rolls-minus"
              onClick={() => bump(-1)}
              disabled={mine.count === 0}
              aria-label="Remove a roll"
            >−</button>
            <button
              type="button"
              className="rolls-plus"
              onClick={() => bump(1)}
              aria-label="Add a roll"
            >
              <span className="rolls-plus-emoji">🥖</span>
              <span>Roll +1</span>
            </button>
          </div>
          <button type="button" className="rolls-switch" onClick={switchName}>Not you? Switch name</button>
        </section>
      )}

      <section className="rolls-board" aria-labelledby="rolls-board-heading">
        <h2 id="rolls-board-heading">SDHS Raiders leaderboard</h2>
        {loading ? (
          <p className="rolls-empty">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="rolls-empty">Nobody's signed up yet — be the first.</p>
        ) : (
          <ol className="rolls-list">
            {entries.map((e, i) => (
              <li key={e.id} className={`rolls-list-item${mine && e.id === mine.id ? ' rolls-list-item-me' : ''}`}>
                <span className="rolls-list-rank">{i + 1}</span>
                <span className="rolls-list-name">{e.name}</span>
                <span className="rolls-list-count">{e.count}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
