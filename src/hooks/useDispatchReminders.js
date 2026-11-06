import { useCallback, useEffect, useRef, useState } from 'react';
import { reminderFeed } from '../lib/dispatchReminders';
const EMPTY = { due: [], upcoming: [], unread_count: 0, due_count: 0, upcoming_count: 0 };
export default function useDispatchReminders(accountKey) {
  const [feed, setFeed] = useState(EMPTY);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState(null);
  const mounted = useRef(false), pending = useRef(new Set()), queued = useRef(new Set()), activeAccount = useRef(null), seen = useRef(new Set()), clock = useRef({ server: Date.now(), client: Date.now() });
  const storageKey = `dispatch-reminders-seen:${accountKey}`;
  const refresh = useCallback(async () => {
    if (!mounted.current || activeAccount.current !== storageKey) return;
    if (pending.current.has(storageKey)) { queued.current.add(storageKey); return; }
    pending.current.add(storageKey);
    try {
      const data = await reminderFeed();
      if (!mounted.current || activeAccount.current !== storageKey) return;
      clock.current = { server: Date.parse(data.server_time), client: Date.now() };
      const fresh = data.due.filter(r => !r.read_at && !seen.current.has(`${r.id}:${r.due_at}`));
      data.due.forEach(r => seen.current.add(`${r.id}:${r.due_at}`));
      try { sessionStorage.setItem(storageKey, JSON.stringify([...seen.current].slice(-300))); } catch { /* private browsing */ }
      if (fresh.length) setAlert({ ...fresh[0], additional: fresh.length - 1 });
      setAlert(previous => {
        const current = previous && data.due.find(r => r.id === previous.id && r.due_at === previous.due_at && !r.read_at);
        return current ? { ...current, additional: Math.max(0, data.unread_count - 1) } : null;
      });
      setFeed(data); setError('');
    } catch (err) { if (mounted.current && activeAccount.current === storageKey) setError(err.message); }
    finally {
      pending.current.delete(storageKey);
      const again = queued.current.delete(storageKey);
      if (mounted.current && activeAccount.current === storageKey) { setLoading(false); if (again) queueMicrotask(refresh); }
    }
  }, [storageKey]);
  useEffect(() => {
    mounted.current = true; activeAccount.current = storageKey; setFeed(EMPTY); setAlert(null); setLoading(true); seen.current = new Set();
    try { seen.current = new Set(JSON.parse(sessionStorage.getItem(storageKey) || '[]')); } catch { /* empty cache */ }
    refresh();
    const poll = setInterval(() => { if (!document.hidden) refresh(); }, 15000);
    const visible = () => { if (!document.hidden) refresh(); };
    window.addEventListener('focus', refresh); document.addEventListener('visibilitychange', visible); window.addEventListener('dispatch-reminders-changed', refresh);
    return () => { mounted.current = false; clearInterval(poll); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', visible); window.removeEventListener('dispatch-reminders-changed', refresh); };
  }, [refresh, storageKey]);
  useEffect(() => {
    if (!feed.upcoming.length) return;
    const delay = Date.parse(feed.upcoming[0].due_at) - (clock.current.server + Date.now() - clock.current.client);
    const timer = setTimeout(refresh, Math.min(2147483000, Math.max(100, delay + 100)));
    return () => clearTimeout(timer);
  }, [feed, refresh]);
  const serverNow = () => clock.current.server + Date.now() - clock.current.client;
  return { feed, loading, error, refresh, alert, dismissAlert: () => setAlert(null), serverNow };
}
