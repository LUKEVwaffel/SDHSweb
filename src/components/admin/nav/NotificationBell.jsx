import { memo, useEffect, useRef, useState } from 'react';
import useDispatchReminders from '../../../hooks/useDispatchReminders';
import { reminderAction, resolveReminderTime, REMINDER_TIMEZONE } from '../../../lib/dispatchReminders';
import './notificationBell.css';
const dateLabel = reminder => new Intl.DateTimeFormat('en-US', { timeZone: reminder.timezone, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(new Date(reminder.due_at));
function NotificationBell({ accountKey }) {
  const [open, setOpen] = useState(false), [tab, setTab] = useState('due'), [adding, setAdding] = useState(false);
  const [title, setTitle] = useState(''), [notes, setNotes] = useState(''), [kind, setKind] = useState('note'), [recurrence, setRecurrence] = useState('once'), [repeatUntil, setRepeatUntil] = useState('');
  const [busy, setBusy] = useState(''), [actionError, setActionError] = useState('');
  const { feed, loading, error, refresh, alert, dismissAlert, serverNow } = useDispatchReminders(accountKey);
  const wrapper = useRef(null), button = useRef(null), panel = useRef(null);
  useEffect(() => {
    if (!open) return;
    panel.current?.focus();
    const outside = event => { if (!wrapper.current?.contains(event.target)) setOpen(false); };
    const escape = event => { if (event.key === 'Escape') { setOpen(false); button.current?.focus(); } };
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);
  async function act(action, id, extra = {}) {
    if (busy) return;
    setBusy(id || action); setActionError('');
    try { await reminderAction(action, { ...(id ? { p_id: id } : {}), ...extra }); await refresh(); }
    catch (err) { setActionError(err.message); }
    finally { setBusy(''); }
  }
  async function create(event) {
    event.preventDefault(); if (busy) return;
    setBusy('create'); setActionError('');
    try {
      const resolved = resolveReminderTime(event.currentTarget.elements.namedItem('reminder_time').value, REMINDER_TIMEZONE);
      const values = { p_title: title, p_notes: notes, p_due_at: resolved.due_at, p_timezone: resolved.timezone, p_kind: kind, p_recurrence: recurrence };
      if (recurrence === 'daily') values.p_repeat_until = repeatUntil;
      await reminderAction('create', values);
      setTitle(''); setNotes(''); setKind('note'); setRecurrence('once'); setRepeatUntil(''); setAdding(false); setTab('upcoming'); await refresh();
    } catch (err) { setActionError(err.message); }
    finally { setBusy(''); }
  }
  const rows = feed[tab], total = tab === 'due' ? feed.due_count : feed.upcoming_count;
  return <div className="dispatch-notifications" ref={wrapper}>
    <button ref={button} type="button" className="dispatch-notification-bell" aria-label={`Notifications${feed.unread_count ? `, ${feed.unread_count} unread` : ''}`} aria-expanded={open} aria-controls="dispatch-notification-panel" onClick={() => { setOpen(v => !v); if (!open) refresh(); }}>
      <svg width="17" height="17" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 1.5c-2.5 0-4.2 1.9-4.2 4.3v2.6L2.5 11h11l-1.3-2.6V5.8C12.2 3.4 10.5 1.5 8 1.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/><path d="M6.3 13a1.8 1.8 0 003.4 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
      {feed.unread_count > 0 && <span className="dispatch-notification-badge">{feed.unread_count > 99 ? '99+' : feed.unread_count}</span>}
    </button>
    {!open && alert && <div className="dispatch-reminder-toast" role="alert"><span className="dispatch-reminder-eyebrow">REMINDER DUE</span><strong>{alert.title}</strong><span>{dateLabel(alert)}{alert.additional ? ` · ${alert.additional} more due` : ''}</span>{alert.reminder_kind === 'ball_attendee_count' && <span className="dispatch-reminder-live-count">Live Ball attendance: <b>{alert.live_attendee_count ?? 'Unavailable'}</b>{alert.live_attendee_count != null && ` · ${alert.live_cadet_reservations} reservations, ${alert.live_guests} guests, ${alert.live_vip_attendees} VIPs`}</span>}<div><button onClick={() => { setOpen(true); setTab('due'); dismissAlert(); }}>View reminders</button><button onClick={dismissAlert} aria-label="Dismiss reminder alert">Dismiss</button></div></div>}
    {open && <section id="dispatch-notification-panel" className="dispatch-notification-panel" ref={panel} tabIndex={-1} role="dialog" aria-label="Notifications and reminders">
      <header><div><span className="dispatch-reminder-eyebrow">YOUR DISPATCH</span><h2>Notifications</h2></div><button className="dispatch-notification-close" onClick={() => { setOpen(false); button.current?.focus(); }} aria-label="Close notifications">×</button></header>
      <div className="dispatch-notification-tabs"><button aria-pressed={tab === 'due'} onClick={() => setTab('due')}>Due <span>{feed.due_count}</span></button><button aria-pressed={tab === 'upcoming'} onClick={() => setTab('upcoming')}>Upcoming <span>{feed.upcoming_count}</span></button><button className="dispatch-reminder-add" aria-expanded={adding} onClick={() => setAdding(v => !v)}>{adding ? 'Close form' : '+ Reminder'}</button></div>
      {(error || actionError) && <p className="dispatch-reminder-error" role="alert">{actionError || error}</p>}
      {adding && <form className="dispatch-reminder-form" onSubmit={create}><label>Remind me about<input autoFocus required maxLength={160} value={title} onChange={e => setTitle(e.target.value)} placeholder="What do you need to remember?" /></label><label>When · Eastern time<input type="datetime-local" name="reminder_time" required /></label><label>Repeat<select value={recurrence} onChange={e => setRecurrence(e.target.value)}><option value="once">Once</option><option value="daily">Daily</option></select></label>{recurrence === 'daily' && <label>Last day<input type="date" required value={repeatUntil} onChange={e => setRepeatUntil(e.target.value)} /></label>}<label>Include live data<select value={kind} onChange={e => setKind(e.target.value)}><option value="note">No live data</option><option value="ball_attendee_count">Current Ball attendee count</option></select></label><label>Details <span>(optional)</span><textarea maxLength={3000} rows={2} value={notes} onChange={e => setNotes(e.target.value)} /></label><button type="submit" disabled={!!busy}>{busy === 'create' ? 'Saving…' : 'Set reminder'}</button></form>}
      {tab === 'due' && feed.unread_count > 0 && <button className="dispatch-reminder-read-all" disabled={!!busy} onClick={() => act('read_all')}>Mark all due reminders read</button>}
      <div className="dispatch-reminder-list">
        {loading ? <p className="dispatch-reminder-empty">Loading reminders…</p> : rows.length === 0 && <div className="dispatch-reminder-empty"><strong>{tab === 'due' ? 'You’re all caught up.' : 'No upcoming reminders.'}</strong><p>Ask Dispatch: “Remind me tomorrow at 10:05 AM to check Ball forms.”</p></div>}
        {rows.map(reminder => <article className="dispatch-reminder-item" key={reminder.id} data-unread={tab === 'due' && !reminder.read_at}><div className="dispatch-reminder-item-title"><strong>{reminder.title}</strong>{tab === 'due' && !reminder.read_at && <span aria-label="Unread" className="dispatch-reminder-unread" />}</div><time dateTime={reminder.due_at}>{dateLabel(reminder)}{reminder.recurrence === 'daily' ? ` · Daily through ${new Intl.DateTimeFormat('en-US', { timeZone: reminder.timezone, month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${reminder.repeat_until}T12:00:00Z`))}` : ''}</time>{reminder.notes && <p>{reminder.notes}</p>}{reminder.reminder_kind === 'ball_attendee_count' && <p className="dispatch-reminder-live-count">{reminder.live_attendee_count == null ? 'Attendee count will be calculated when this reminder is due.' : <>Live Ball attendance: <b>{reminder.live_attendee_count}</b> · {reminder.live_cadet_reservations} reservations, {reminder.live_guests} guests, {reminder.live_vip_attendees} VIPs</>}</p>}<div className="dispatch-reminder-actions">
          {tab === 'due' && !reminder.read_at && <button disabled={!!busy} onClick={() => act('read', reminder.id)}>Mark read</button>}
          {tab === 'due' && reminder.recurrence !== 'daily' && <button disabled={!!busy} onClick={() => act('snooze', reminder.id, { p_due_at: new Date(serverNow() + 10 * 60000).toISOString() })}>Snooze 10m</button>}
          <button disabled={!!busy} onClick={() => act('complete', reminder.id)}>Done</button><button disabled={!!busy} onClick={() => act('cancel', reminder.id)}>Cancel</button>
        </div></article>)}
        {total > rows.length && <p className="dispatch-reminder-empty">Showing {rows.length} of {total}. Complete or cancel reminders to clear the list.</p>}
      </div>
      <footer>Private to your account · In-app alerts. Overdue reminders wait here when you return.</footer>
    </section>}
  </div>;
}

export default memo(NotificationBell);
