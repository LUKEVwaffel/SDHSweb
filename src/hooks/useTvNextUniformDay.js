import { useState, useEffect } from 'react';
import { supabase as SB } from '../lib/supabaseClient';

const NY_TZ = 'America/New_York';

function todayNy() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: NY_TZ }).format(new Date());
}

/**
 * Next posted UNIFORM_DAY event, or null if none is on the calendar — same
 * category the ironclad reminder cron (uniform_reminders.sql) already keys
 * off of, so this always agrees with what actually triggers the Mon/Wed
 * reminder emails.
 */
export function useTvNextUniformDay() {
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    SB.from('events').select('id,title,date,event_time')
      .eq('status', 'posted').eq('category', 'UNIFORM_DAY').gte('date', todayNy())
      .order('date', { ascending: true }).limit(1)
      .then(({ data }) => {
        if (alive) { setEvent(data?.[0] ?? null); setLoading(false); }
      });
    return () => { alive = false; };
  }, []);

  return { event, loading };
}
