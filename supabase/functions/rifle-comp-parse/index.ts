// Edge function: rifle-comp-parse
// Rifle Portal "Comp Upload" — Makaio pastes the raw score sheet for a match
// (copy-pasted from whatever format the meet software/officials hand out;
// never consistent row-by-row) and this sends it to Claude to extract
// structured per-shooter scores, matched against the existing roster where
// possible. Writes the raw text + AI draft into rifle_comp_uploads as
// status='pending_review' — nothing touches rifle_scores/rifle_shooters yet,
// Makaio reviews/edits the draft client-side before publishing (that publish
// step is a plain client-side write, same as RosterTab.jsx — rifle_scores'
// own RLS is_rifle_admin()-or-is_s6() is the whole gate there, no edge
// function needed for it).
//
// Secrets (set with `supabase secrets set`, NEVER in .env / client bundle):
//   ANTHROPIC_API_KEY   required (shared with analyze-event-feedback)
// Deploy WITH jwt verification (default).
import { json, preflight } from "../_shared/http.ts";
import { serviceClient, getRifleAdmin } from "../_shared/supabase.ts";

const CLAUDE_MODEL = "claude-sonnet-4-5-20250929";
const MAX_CSV_CHARS = 20000;

const SYSTEM_PROMPT = `You extract rifle-team match scores from a raw, inconsistently-formatted score sheet (it may be a real CSV, or text copy-pasted from a PDF/spreadsheet with ragged columns). For each shooter, extract: their name as written, and any of these that are present — prone, standing, kneeling, total, bulls (X-count). Positions are numeric scores out of a possible max (do not guess a max, just extract the number as given). If a value is missing for a shooter, omit that key rather than inventing 0.

You will also be given the team's current roster of shooter names. For each extracted row, set matched_shooter_name to the roster name it most likely refers to (nicknames, misspellings, reversed first/last — use judgment) if you're reasonably confident, otherwise null. Never invent a roster name that wasn't given to you.

Respond with ONLY valid JSON, no markdown fences, no commentary, matching exactly this shape:
{
  "rows": [
    { "raw_name": "string as it appeared", "matched_shooter_name": "string or null", "prone": number or null, "standing": number or null, "kneeling": number or null, "total": number or null, "bulls": number or null }
  ],
  "notes": "1-2 sentences on anything ambiguous or skipped, or empty string if none"
}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const caller = await getRifleAdmin(req);
    if (!caller) return json({ error: "not authorized" }, 403);
    if (caller.mustChangePassword) return json({ error: "password_change_required" }, 403);

    const { raw_csv } = await req.json().catch(() => ({}));
    const csv = String(raw_csv || "").trim();
    if (!csv) return json({ error: "raw_csv required" }, 400);
    if (csv.length > MAX_CSV_CHARS) return json({ error: `paste is too long (max ${MAX_CSV_CHARS} characters)` }, 400);

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) return json({ error: "ANTHROPIC_API_KEY not configured" }, 500);

    const svc = serviceClient();
    const { data: shooters } = await svc.from("rifle_shooters").select("name").eq("active", true).order("name");
    const roster = (shooters || []).map((s) => s.name);

    const userPrompt = `Current roster:\n${roster.length ? roster.join("\n") : "(no shooters on file yet)"}\n\nRaw score sheet:\n${csv}`;

    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!claudeRes.ok) {
      const errText = await claudeRes.text().catch(() => "");
      console.error("rifle-comp-parse claude error", claudeRes.status, errText);
      return json({ error: "parsing request failed" }, 502);
    }

    const claudeBody = await claudeRes.json();
    const text = claudeBody?.content?.[0]?.text ?? "";
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      console.error("rifle-comp-parse: non-JSON response", text.slice(0, 500));
      return json({ error: "parsing returned an unexpected format" }, 502);
    }

    const { data: upload, error: insErr } = await svc
      .from("rifle_comp_uploads")
      .insert({ uploaded_by: caller.email, raw_csv: csv, draft: parsed, status: "pending_review" })
      .select("*")
      .single();
    if (insErr) { console.error("rifle-comp-parse insert", insErr); return json({ error: "internal error" }, 500); }

    return json({ ok: true, upload });
  } catch (e) {
    console.error("rifle-comp-parse", e);
    return json({ error: "internal error" }, 500);
  }
});
