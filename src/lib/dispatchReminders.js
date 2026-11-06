import { supabase as SB } from './supabaseClient';
export { resolveReminderTime, REMINDER_TIMEZONE } from '../../supabase/functions/_shared/reminderTime.js';
function message(error) {
  if (/PGRST202|42P01|42883/.test(error.code || '')) return 'Reminders need setup: import DISPATCH_REMINDERS.sql to enable this panel.';
  return error.message || 'Could not load reminders. Try again.';
}
export async function reminderFeed() {
  const { data, error } = await SB.rpc('dispatch_reminder_feed');
  if (error) throw new Error(message(error));
  return data;
}
export async function reminderAction(action, values = {}) {
  const { data, error } = await SB.rpc('dispatch_reminder_action', { p_action: action, ...values });
  if (error) throw new Error(message(error));
  window.dispatchEvent(new Event('dispatch-reminders-changed'));
  return data;
}
