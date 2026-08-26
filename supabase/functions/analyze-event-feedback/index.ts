// Edge function: analyze-event-feedback
// DISPATCH AI (Beta). S-6-only for now — see supabase/event_feedback.sql for
// why (Luke verifies end-to-end before S-5 gets access; caller.role check
// below is the enforcement point once that's flipped to allow s5 too, just
// widen the check here AND uncomment the matching RLS policy).
//
// Pulls every event_feedback row for one event, sends the whole batch to
// Claude in a single call, and asks for a deep, structured analysis — not a
// rewritten AAR. Result is stored as a new row in event_feedback_analysis
// (append-only: every run is kept, never overwritten, so the prompt can be
// tuned during the beta without losing prior runs to compare against).
//
// Secrets (set with `supabase secrets set`, NEVER in .env / client bundle):
//   ANTHROPIC_API_KEY   required
// Deploy: supabase functions deploy analyze-event-feedback

import { json, preflight } from "../_shared/http.ts";
import { serviceClient, getCaller } from "../_shared/supabase.ts";

const CLAUDE_MODEL = "claude-sonnet-4-5-20250929";
const MAX_SUBMISSIONS = 300; // guards prompt size against a very large event

const SYSTEM_PROMPT = `You are DISPATCH AI, a beta analysis tool for a JROTC battalion's admin system. You are given every cadet/staff feedback submission for one event. Your job is to compile and deeply analyze them — NOT to write an AAR, NOT to speak as if you attended the event, and NOT to invent details not present in the submissions.

Read every submission carefully. Look for:
- Recurring themes (positive and negative) — group similar comments together and note how many cadets raised each one
- Overall sentiment, and where sentiment splits by company or LET level if the data shows a pattern
- Anything flagged as unsafe, disorganized, or confusing — treat these as high priority even if only one cadet mentioned it
- What cadets consistently want more of at future events
- Standout praise worth highlighting to command
- Concrete, specific recommendations for next time — tied to what was actually said, not generic advice

Respond with ONLY valid JSON, no markdown fences, no commentary outside the JSON, matching exactly this shape:
{
  "summary": "2-3 sentence overview of how the event landed with cadets",
  "sentiment": { "overall": "positive|mixed|negative", "notes": "1-2 sentences on why" },
  "themes": [ { "title": "short theme name", "mention_count": 0, "detail": "what cadets said, compiled" } ],
  "safety_flags": [ "specific safety/organization/confusion concern, or omit array entries if none" ],
  "standout_praise": [ "specific praise worth surfacing to command" ],
  "recommendations": [ "concrete, specific action for next time" ]
}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const caller = await getCaller(req);
    if (!caller) return json({ error: "unauthorized" }, 401);
    // S-6 only during the beta — widen to include "s5" here once Luke has
    // verified the flow and the matching RLS policies are uncommented.
    if (caller.role !== "s6") return json({ error: "forbidden" }, 403);
    if (caller.mustChangePassword) return json({ error: "password_change_required" }, 403);

    const { event_id } = await req.json().catch(() => ({}));
    if (!event_id || typeof event_id !== "string") return json({ error: "event_id required" }, 400);

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) return json({ error: "ANTHROPIC_API_KEY not configured" }, 500);

    const svc = serviceClient();

    const { data: event, error: eventErr } = await svc
      .from("events").select("id, title, date").eq("id", event_id).maybeSingle();
    if (eventErr) { console.error("analyze-event-feedback event lookup", eventErr); return json({ error: "internal error" }, 500); }
    if (!event) return json({ error: "event not found" }, 404);

    const { data: rows, error: rowsErr } = await svc
      .from("event_feedback")
      .select("submitter_name, submitter_type, let_level, company, went_well, needs_improvement, safety_concerns, want_more_of, fun_rating, additional_notes")
      .eq("event_id", event_id)
      .order("created_at", { ascending: true })
      .limit(MAX_SUBMISSIONS);
    if (rowsErr) { console.error("analyze-event-feedback rows lookup", rowsErr); return json({ error: "internal error" }, 500); }
    if (!rows || rows.length === 0) return json({ error: "no feedback submitted for this event yet" }, 400);

    const compiled = rows.map((r, i) => {
      const lines = [
        `#${i + 1} — ${r.submitter_type} · ${r.let_level || "LET level not given"} · ${r.company || "company not given"} · fun rating ${r.fun_rating ?? "n/a"}/5`,
        r.went_well ? `Went well: ${r.went_well}` : null,
        r.needs_improvement ? `Needs improvement: ${r.needs_improvement}` : null,
        r.safety_concerns ? `Safety/organization concern: ${r.safety_concerns}` : null,
        r.want_more_of ? `Wants more of: ${r.want_more_of}` : null,
        r.additional_notes ? `Additional notes: ${r.additional_notes}` : null,
      ].filter(Boolean);
      return lines.join("\n");
    }).join("\n\n");

    const userPrompt = `Event: ${event.title} (${event.date})\nTotal submissions: ${rows.length}\n\n${compiled}`;

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
      console.error("analyze-event-feedback claude error", claudeRes.status, errText);
      return json({ error: "analysis request failed" }, 502);
    }

    const claudeBody = await claudeRes.json();
    const text = claudeBody?.content?.[0]?.text ?? "";
    let result: unknown;
    try {
      result = JSON.parse(text);
    } catch {
      console.error("analyze-event-feedback: non-JSON response", text.slice(0, 500));
      return json({ error: "analysis returned an unexpected format" }, 502);
    }

    const { data: saved, error: saveErr } = await svc
      .from("event_feedback_analysis")
      .insert({
        event_id,
        generated_by: caller.email,
        submission_count_analyzed: rows.length,
        result,
      })
      .select()
      .single();
    if (saveErr) { console.error("analyze-event-feedback save", saveErr); return json({ error: "internal error" }, 500); }

    return json({ ok: true, analysis: saved });
  } catch (e) {
    console.error("analyze-event-feedback", e);
    return json({ error: "internal error" }, 500);
  }
});
