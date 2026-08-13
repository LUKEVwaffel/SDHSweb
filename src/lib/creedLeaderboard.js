import { supabase } from './supabaseClient';
import { getDeviceId } from './fingerprint';

// LET-1-only by design — see supabase/creed_leaderboard.sql for why this is
// a fixed constant instead of a picker.
const LET_LEVEL = '1';

export const COMPANIES = ['ALPHA', 'BRAVO', 'CHARLIE', 'DELTA'];

/**
 * @param {{ cadetName: string, company: string, gameKey: string, gameLabel: string, metricLabel: string, metricValue: string }} entry
 */
export async function submitLeaderboardEntry({ cadetName, company, gameKey, gameLabel, metricLabel, metricValue }) {
  const submitterFp = await getDeviceId().catch(() => null);
  const { error } = await supabase.from('creed_leaderboard').insert({
    cadet_name: cadetName.trim().slice(0, 60),
    company,
    let_level: LET_LEVEL,
    game_key: gameKey,
    game_label: gameLabel,
    metric_label: metricLabel,
    metric_value: metricValue,
    submitter_fp: submitterFp,
  });
  if (error) throw error;
}

/** Most recent perfect-score entries, newest first. */
export async function fetchLeaderboard(limit = 50) {
  const { data, error } = await supabase
    .from('creed_leaderboard')
    .select('id, cadet_name, company, game_key, game_label, metric_label, metric_value, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}
