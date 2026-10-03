import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { getDeviceId } from '../../lib/fingerprint';
import './rolls.css';

// /breadsticks (alias /rolls) — Olive Garden breadstick counter. Sign up with
// a name once (kept in localStorage so a reload/reopen picks the same person
// back up), tap to count your own breadsticks, watch the whole table's live
// count. Self-contained
// anon route (App.jsx bypass), no auth — same pattern as /raidertv.

// Reuses the roll_counter_entries table; a new event key gives this outing
// its own fresh leaderboard. LS key changed too so an old Roadhouse signup
// doesn't linger.
const EVENT_KEY = 'olive-garden-breadsticks';
const LS_KEY = 'breadstickCounterEntry';
const BANNED_LS_KEY = 'breadstickCounterBanned';

// Perma-banned names. The real enforcement is the DB trigger in
// supabase/roll_counter_ban.sql; this mirror hides them from the board and
// locks the device out without a round trip. Keep the two lists in sync.
const BANNED_TERMS = ['cockmaster'];

function normalizeName(name) {
  const swaps = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', '@': 'a', $: 's', '!': 'i', '|': 'i' };
  return String(name || '')
    .toLowerCase()
    .replace(/[013457@$!|]/g, (c) => swaps[c])
    .replace(/[^a-z]/g, '');
}

function isBannedName(name) {
  const n = normalizeName(name);
  return BANNED_TERMS.some((t) => n.includes(t));
}

function loadBanned() {
  try { return localStorage.getItem(BANNED_LS_KEY) === '1'; } catch { return false; }
}

function markBanned() {
  try { localStorage.setItem(BANNED_LS_KEY, '1'); } catch {}
  // Same cookie middleware.js checks, so the next full load is a 403 at the
  // edge and never reaches the app.
  try { document.cookie = `bs_ban=1; path=/; max-age=${60 * 60 * 24 * 365 * 10}; secure; samesite=lax`; } catch {}
}

// Server-side check-in: logs the view and answers whether this IP or device
// fingerprint is banned. A flagged device also gets its current IP and
// fingerprint banned server-side. Fails open after a short wait.
async function checkIn(flagged) {
  try {
    const device = await Promise.race([
      getDeviceId(),
      new Promise((resolve) => setTimeout(() => resolve(null), 2000)),
    ]);
    const { data, error } = await supabase.rpc('roll_counter_check_in', {
      p_device: device,
      p_flagged: flagged,
    });
    return !error && data === true;
  } catch { return flagged; }
}

function BannedScreen() {
  return (
    <div className="rolls-page">
      <section className="rolls-join" aria-labelledby="rolls-banned-heading">
        <h2 id="rolls-banned-heading">You're banned</h2>
        <p className="rolls-error">You are permanently banned from the breadstick counter.</p>
      </section>
    </div>
  );
}

// Gate: nothing of the counter (leaderboard included) renders until the
// check-in clears this visitor.
export default function RollCounter() {
  const [status, setStatus] = useState(() => {
    loadSaved(); // flags the device if its saved signup is a banned name
    return loadBanned() ? 'banned' : 'checking';
  });

  const ban = useCallback(() => {
    markBanned();
    setStatus('banned');
    checkIn(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const flagged = loadBanned();
    checkIn(flagged).then((isBanned) => {
      if (cancelled) return;
      if (isBanned || flagged) ban();
      else setStatus('ok');
    });
    return () => { cancelled = true; };
  }, [ban]);

  if (status === 'banned') return <BannedScreen />;
  if (status === 'checking') return <div className="rolls-page" aria-busy="true" />;
  return <RollCounterPage onBanned={ban} />;
}

function loadSaved() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && isBannedName(parsed.name)) {
      markBanned();
      localStorage.removeItem(LS_KEY);
      return null;
    }
    return parsed;
  } catch { return null; }
}

function saveEntry(id, name) {
  try { localStorage.setItem(LS_KEY, JSON.stringify({ id, name })); } catch {}
}

function clearSaved() {
  try { localStorage.removeItem(LS_KEY); } catch {}
}

const ROLL_EMOJI = ['🥖', '🫒', '🍝'];

function RollCounterPage({ onBanned }) {
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
    setEntries((data || []).filter((e) => !isBannedName(e.name)));
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
          if (isBannedName(row.name)) return prev.filter((e) => e.id !== row.id);
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
    if (isBannedName(name)) {
      onBanned();
      return;
    }
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
        <p className="rolls-eyebrow">Olive Garden · Tonight</p>
        <h1 className="rolls-title">Breadstick Counter</h1>
        <p className="rolls-sub">{totalRolls} breadstick{totalRolls === 1 ? '' : 's'} down as a group</p>
        <p className="rolls-honor">Honor system: only tap <strong>after</strong> you've actually eaten the breadstick — no pre-counting.</p>
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
        <section className="rolls-me" aria-label="Your breadstick count">
          <p className="rolls-me-name">{mine.name}{rankOf ? <span className="rolls-me-rank">#{rankOf}</span> : null}</p>
          <div className="rolls-count-display">{mine.count}</div>
          <div className="rolls-controls">
            <button
              type="button"
              className="rolls-minus"
              onClick={() => bump(-1)}
              disabled={mine.count === 0}
              aria-label="Remove a breadstick"
            >−</button>
            <button
              type="button"
              className="rolls-plus"
              onClick={() => bump(1)}
              aria-label="Add a breadstick"
            >
              <span className="rolls-plus-emoji">🥖</span>
              <span>Breadstick +1</span>
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
