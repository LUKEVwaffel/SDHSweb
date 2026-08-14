import { supabase } from './supabaseClient';
import { getDeviceId } from './fingerprint';

// LET-1-only by design — see supabase/creed_leaderboard.sql for why this is
// a fixed constant instead of a picker.
const LET_LEVEL = '1';

export const COMPANIES = ['ALPHA', 'BRAVO', 'CHARLIE', 'DELTA'];

/**
 * Checks the submitter's name/company/birthdate against the dispatch roster
 * (public.cadet_consent, via the verify_creed_eligibility RPC — that table
 * is s6-locked, so this is the only way an anon client can check it). Returns
 * false only when dispatch data confirms the person is LET 2/3/4; true
 * otherwise (including "not found in dispatch yet").
 * @param {{ name: string, company: string, birthdate: string }} identity
 * @returns {Promise<boolean>}
 */
export async function verifyCreedEligibility({ name, company, birthdate }) {
  const fp = await getDeviceId().catch(() => null);
  const { data, error } = await supabase.rpc('verify_creed_eligibility', {
    p_name: name.trim(),
    p_company: company,
    p_birthdate: birthdate,
    p_fp: fp,
  });
  if (error) throw error;
  return data === true;
}

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
