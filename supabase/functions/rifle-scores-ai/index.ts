// Edge function: rifle-scores-ai
// Rifle Portal "Ask AI" tab — Makaio asks a plain-English question about the
// team's scores ("what's Jordan's average total this season", "compare fall
// vs spring standing scores") and this hands Claude the shooters/matches/
// scores table plus the question. Claude answers via a forced tool call so
// the response comes back as structured stats (headline figure, a small stat
// grid, an optional comparison table, clickable follow-up questions,
// narrative) instead of a wall of prose — the frontend renders these as real
// stat tiles/tables and turns the follow-ups into one-click chips.
//
// The data table is sent index-encoded (shooters/matches listed once, score
// rows reference them by index) instead of one denormalized CSV row per
// score — cuts the repeated season/opponent/date strings that dominated the
// old flat-CSV payload, which is most of the round-trip latency since it's
// all prompt-processing time.
//
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

const SYSTEM_PROMPT = `You answer questions about a high school rifle team's match scores, using ONLY the data given to you below the question. It's index-encoded to stay compact:
SHOOTERS: "id:name" pairs, comma-separated.
MATCHES: "id:season:week:opponent:date" pairs, comma-separated.
SCORES: CSV rows "shooter_id,match_id,prone,standing,kneeling,total,bulls" — any stat may be blank if it wasn't recorded. Look up shooter_id/match_id against the SHOOTERS/MATCHES lists above to get names/seasons/etc.

Rules:
- Compute averages, totals, comparisons, trends, and rankings yourself from the rows given — make sure the arithmetic is correct.
- Always call the format_answer tool to respond — never respond in plain prose.
- Put the single most important number in "headline" (e.g. the average asked for, or the top answer to a "who/what" question). Omit it (null) only when there is no single number that answers the question.
- Use "stats" for a handful (2-6) of supporting figures — e.g. per-season averages, top-N rankings, per-position breakdowns. Leave it an empty array if nothing more than the headline is needed.
- Use "table" only for a genuine row/column comparison (e.g. multiple shooters x multiple seasons, or a match-by-match breakdown). Leave it null otherwise — do not restate the stats as a table too.
- Give "headline" or any "stats" entry an optional "followup" string when tapping that specific figure should pull up one obvious related comparison (e.g. a per-season average's followup might be "Break that down by shooter"). Leave it off when there's no clear drill-down for that figure.
- "followups": 2-4 short, specific questions the user could tap next to compare against what you just answered (e.g. if you answered Fall 2025's average, suggest comparing it to Spring 2025, or breaking it down by shooter). Phrase each exactly as the user would type it. Empty array if nothing obvious follows.
- "narrative" is always required: 1-2 short sentences of context or caveats. If the data doesn't cover what's asked (a shooter/season not present), say so plainly there instead of guessing, and leave headline/stats/table/followups empty.
- Never fabricate a score that isn't in the table. Round decimals to 1 place.`;

const FORMAT_ANSWER_TOOL = {
  name: "format_answer",
  description: "Return the answer to the user's question about rifle team scores as structured stats.",
  input_schema: {
    type: "object",
    properties: {
      headline: {
        type: ["object", "null"],
        description: "The single most important number, or null if none applies.",
        properties: {
          label: { type: "string", description: "Short caption, e.g. 'FALL 2025 AVG TOTAL'" },
          value: { type: "string", description: "The number/answer itself, e.g. '268.4' or 'Jordan Lee'" },
          sub: { type: "string", description: "Optional one-line qualifier, e.g. 'across 8 matches'" },
          followup: { type: "string", description: "Optional: a specific follow-up question tapping this figure should ask, if there's an obvious one." },
        },
        required: ["label", "value"],
      },
      stats: {
        type: "array",
        description: "0-6 supporting figures.",
        items: {
          type: "object",
          properties: {
            label: { type: "string" },
            value: { type: "string" },
            tone: { type: "string", enum: ["up", "down", "neutral"], description: "up=improvement/better, down=decline/worse, neutral=default" },
            followup: { type: "string", description: "Optional: a specific follow-up question tapping this figure should ask, if there's an obvious one." },
          },
          required: ["label", "value"],
        },
      },
      table: {
        type: ["object", "null"],
        description: "A genuine row/column comparison, or null.",
        properties: {
          headers: { type: "array", items: { type: "string" } },
          rows: { type: "array", items: { type: "array", items: { type: "string" } } },
        },
      },
      followups: {
        type: "array",
        description: "2-4 short follow-up questions the user can tap to pull up a comparable stat.",
        items: { type: "string" },
      },
      narrative: { type: "string", description: "1-2 short sentences of context, caveats, or the full answer when no number applies." },
    },
    required: ["headline", "stats", "table", "followups", "narrative"],
  },
};

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

    if (!scores || scores.length === 0) {
      return json({ ok: true, answer: { headline: null, stats: [], table: null, followups: [], narrative: "There's no score data recorded yet, so I can't answer that." } });
    }

    // Every shooter/match referenced by an actual score row — no point
    // sending roster entries with zero scores against the question.
    const usedShooterIds = new Set(scores.map((r) => r.shooter_id));
    const usedMatchIds = new Set(scores.map((r) => r.match_id));

    const shooterLines = (shooters || [])
      .filter((s) => usedShooterIds.has(s.id))
      .map((s) => `${s.id}:${csvEscape(s.name)}`);
    const matchLines = (matches || [])
      .filter((m) => usedMatchIds.has(m.id))
      .map((m) => `${m.id}:${seasonOf(m.dates)}:${csvEscape(m.week ?? "")}:${csvEscape(m.opponent ?? "")}:${csvEscape(m.dates ?? "")}`);

    const scoreRows = scores.map((r) => [
      r.shooter_id, r.match_id, r.prone ?? "", r.standing ?? "", r.kneeling ?? "", r.total ?? "", r.bulls ?? "",
    ].join(","));

    const dataBlock = `SHOOTERS:\n${shooterLines.join(",")}\n\nMATCHES:\n${matchLines.join(",")}\n\nSCORES (shooter_id,match_id,prone,standing,kneeling,total,bulls — ${scoreRows.length} rows):\n${scoreRows.join("\n")}`;
    const userPrompt = `Question: ${q}\n\nData:\n${dataBlock}`;

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
        tools: [FORMAT_ANSWER_TOOL],
        tool_choice: { type: "tool", name: "format_answer" },
      }),
    });

    if (!claudeRes.ok) {
      const errText = await claudeRes.text().catch(() => "");
      console.error("rifle-scores-ai claude error", claudeRes.status, errText);
      return json({ error: "AI request failed" }, 502);
    }

    const claudeBody = await claudeRes.json();
    const toolUse = (claudeBody?.content || []).find((b: { type?: string }) => b.type === "tool_use");
    const answer = toolUse?.input;
    if (!answer || typeof answer !== "object") return json({ error: "AI returned an empty answer" }, 502);

    return json({ ok: true, answer });
  } catch (e) {
    console.error("rifle-scores-ai", e);
    return json({ error: "internal error" }, 500);
  }
});
