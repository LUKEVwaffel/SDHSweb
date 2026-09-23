// Edge function: rifle-scores-ai
// Rifle Portal "Ask AI" tab — Makaio asks a plain-English question about the
// team's scores ("what's Jordan's average total this season", "compare fall
// vs spring standing scores") and this hands Claude the full shooters/
// matches/scores table plus the question, and returns its answer as text.
// Read-only: never writes to rifle_scores/matches/shooters. Same secret and
// caller pattern as rifle-comp-parse (getRifleAdmin + ANTHROPIC_API_KEY).
//
// Secrets (set with `supabase secrets set`, NEVER in .env / client bundle):
//   ANTHROPIC_API_KEY   required (shared with rifle-comp-parse)
// Deploy WITH jwt verification (default).
import { json, preflight } from "../_shared/http.ts";
import { serviceClient, getRifleAdmin } from "../_shared/supabase.ts";

const CLAUDE_MODEL = "claude-sonnet-4-5-20250929";
const MAX_QUESTION_CHARS = 500;
const MAX_ROWS = 4000; // generous headroom for a school rifle team's full history

const SYSTEM_PROMPT = `You answer questions about a high school rifle team's match scores, using ONLY the data table given to you below the question. The table is CSV: shooter,season,week,opponent,date,prone,standing,kneeling,total,bulls — any stat may be blank if it wasn't recorded.

Rules:
- Compute averages, totals, comparisons, trends, and rankings yourself from the rows given — show your arithmetic isn't needed, just the result, but make sure it's correct.
- When comparing seasons or matches, name them explicitly (e.g. "Fall 2025 average total was 268.4 vs Spring 2026's 271.1").
- If the data doesn't cover what's asked (e.g. a shooter or season not present), say so plainly instead of guessing or inventing numbers.
- Keep answers short and concrete: lead with the number/answer, then at most 1-2 sentences of context.
- Never fabricate a score that isn't in the table.`;

function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function seasonOf(dates: string | null): string {
  const m = (dates || "").match(/\b(20\d{2})\b/);
  return m ? m[1] : "Undated";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const caller = await getRifleAdmin(req);
    if (!caller) return json({ error: "not authorized" }, 403);
    if (caller.mustChangePassword) return json({ error: "password_change_required" }, 403);

    const { question } = await req.json().catch(() => ({}));
    const q = String(question || "").trim();
    if (!q) return json({ error: "question required" }, 400);
    if (q.length > MAX_QUESTION_CHARS) return json({ error: `question is too long (max ${MAX_QUESTION_CHARS} characters)` }, 400);

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) return json({ error: "ANTHROPIC_API_KEY not configured" }, 500);

    const svc = serviceClient();
    const [{ data: shooters, error: sErr }, { data: matches, error: mErr }, { data: scores, error: scErr }] = await Promise.all([
      svc.from("rifle_shooters").select("id, name"),
      svc.from("rifle_matches").select("id, week, dates, opponent"),
      svc.from("rifle_scores").select("shooter_id, match_id, prone, standing, kneeling, total, bulls").limit(MAX_ROWS),
    ]);
    if (sErr || mErr || scErr) {
      console.error("rifle-scores-ai load", sErr || mErr || scErr);
      return json({ error: "internal error" }, 500);
    }

    const shooterById = new Map((shooters || []).map((s) => [s.id, s.name]));
    const matchById = new Map((matches || []).map((m) => [m.id, m]));

    const header = "shooter,season,week,opponent,date,prone,standing,kneeling,total,bulls";
    const rows = (scores || []).map((r) => {
      const m = matchById.get(r.match_id);
      return [
        csvEscape(shooterById.get(r.shooter_id) || "Unknown"),
        csvEscape(seasonOf(m?.dates ?? null)),
        csvEscape(m?.week ?? ""),
        csvEscape(m?.opponent ?? ""),
        csvEscape(m?.dates ?? ""),
        csvEscape(r.prone ?? ""),
        csvEscape(r.standing ?? ""),
        csvEscape(r.kneeling ?? ""),
        csvEscape(r.total ?? ""),
        csvEscape(r.bulls ?? ""),
      ].join(",");
    });

    if (rows.length === 0) {
      return json({ ok: true, answer: "There's no score data recorded yet, so I can't answer that." });
    }

    const userPrompt = `Question: ${q}\n\nData (${rows.length} rows):\n${header}\n${rows.join("\n")}`;

    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!claudeRes.ok) {
      const errText = await claudeRes.text().catch(() => "");
      console.error("rifle-scores-ai claude error", claudeRes.status, errText);
      return json({ error: "AI request failed" }, 502);
    }

    const claudeBody = await claudeRes.json();
    const answer = claudeBody?.content?.[0]?.text?.trim() ?? "";
    if (!answer) return json({ error: "AI returned an empty answer" }, 502);

    return json({ ok: true, answer });
  } catch (e) {
    console.error("rifle-scores-ai", e);
    return json({ error: "internal error" }, 500);
  }
});
