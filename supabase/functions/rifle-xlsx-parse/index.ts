// Edge function: rifle-xlsx-parse
// Rifle Portal — "Scores Editor" import modal, spreadsheet mode. Kaz and
// Luke maintain ONE workbook all season (a "Scores" tab with a repeating
// 5-column group per week — Prone/Standing/Kneeling/Overall Score/Bull's-
// Eye — one row per shooter) and re-upload the same file each week with a
// new week's columns filled in. This deterministically extracts every
// week-group's values rather than guessing at free text — the sheet's own
// headers are the ground truth, unlike a raw pasted score sheet (that's
// what rifle-comp-parse + its Claude call is for). Only shooter-name
// matching against the roster needs fuzzy handling (typos, name variants),
// done here with plain edit-distance — no LLM call needed for a
// well-structured source, and it's faster/free/deterministic.
//
// Access is intentionally narrower than the rest of the rifle-admin
// surface: only the two people who actually touch this workbook (Kaz,
// Luke) may upload it, even though other rifle_admins could otherwise
// write to rifle_scores directly. UPLOAD_ALLOWLIST below is that gate —
// update it if that list of people changes.
//
// Deploy WITH jwt verification (default). No secrets beyond the standard
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY.
import * as XLSX from "npm:xlsx@0.18.5";
import { json, preflight } from "../_shared/http.ts";
import { serviceClient, getRifleAdmin } from "../_shared/supabase.ts";
import { RIFLE_UPLOAD_ALLOWLIST } from "../_shared/rifleUploaders.ts";

const MAX_BYTES = 5 * 1024 * 1024; // 5MB — this workbook is ~100KB in practice

const GROUP_FIELDS = ["prone", "standing", "kneeling", "total", "bulls"] as const;
type GroupField = typeof GROUP_FIELDS[number];

function normalizeHeader(s: unknown): string {
  return String(s ?? "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z]/g, "");
}

const HEADER_MAP: Record<string, GroupField> = {
  prone: "prone",
  standing: "standing",
  kneeling: "kneeling",
  overallscore: "total",
  total: "total",
  bullseye: "bulls",
  bullseyes: "bulls",
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function toNumber(v: unknown): number | null {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? round1(n) : null;
}

// Normalized-token edit distance — good enough for the typos this workbook
// actually has ("O'Brein" vs "O'Brien", stray middle names) without pulling
// in a real fuzzy-matching library for one function.
function levenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

function normalizeName(s: string): string {
  return s.toLowerCase().replace(/['’]/g, "").replace(/[^a-z ]/g, "").trim();
}

function matchRoster(rawName: string, roster: string[]): string | null {
  const target = normalizeName(rawName);
  if (!target) return null;
  const exact = roster.find((r) => normalizeName(r) === target);
  if (exact) return exact;
  let best: { name: string; dist: number } | null = null;
  for (const r of roster) {
    const dist = levenshtein(target, normalizeName(r));
    if (!best || dist < best.dist) best = { name: r, dist };
  }
  const threshold = target.length > 10 ? 3 : 2;
  return best && best.dist <= threshold ? best.name : null;
}

function findSheet(wb: XLSX.WorkBook): XLSX.WorkSheet {
  const byName = wb.SheetNames.find((n) => n.trim().toLowerCase() === "scores");
  return wb.Sheets[byName ?? wb.SheetNames[0]];
}

interface WeekGroup {
  groupIndex: number;
  rows: { raw_name: string; matched_shooter_name: string | null; prone: number | null; standing: number | null; kneeling: number | null; total: number | null; bulls: number | null }[];
}

function extractWeekGroups(sheet: XLSX.WorkSheet, roster: string[]): WeekGroup[] {
  const grid: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  if (!grid.length) return [];
  const header = grid[0];

  // Column 0 is the name column; every column after that belongs to a
  // 5-wide group. Map each column index -> field, grouped in order of
  // appearance (so a season with 6 weeks so far, or 12, both "just work").
  const groups: { field: GroupField; col: number }[][] = [];
  let current: { field: GroupField; col: number }[] = [];
  for (let col = 1; col < header.length; col++) {
    const field = HEADER_MAP[normalizeHeader(header[col])];
    if (!field) continue;
    current.push({ field, col });
    if (current.length === GROUP_FIELDS.length) {
      groups.push(current);
      current = [];
    }
  }

  const weekGroups: WeekGroup[] = groups.map((cols, i) => ({ groupIndex: i + 1, rows: [] }));

  for (let r = 1; r < grid.length; r++) {
    const row = grid[r];
    const rawName = String(row[0] ?? "").trim();
    if (!rawName || rawName.startsWith("#") || /^total$/i.test(rawName) || /^top four/i.test(rawName)) continue;

    groups.forEach((cols, gi) => {
      const values: Partial<Record<GroupField, number | null>> = {};
      let hasAny = false;
      for (const { field, col } of cols) {
        const n = toNumber(row[col]);
        values[field] = n;
        if (n != null) hasAny = true;
      }
      if (!hasAny) return;
      weekGroups[gi].rows.push({
        raw_name: rawName,
        matched_shooter_name: matchRoster(rawName, roster),
        prone: values.prone ?? null,
        standing: values.standing ?? null,
        kneeling: values.kneeling ?? null,
        total: values.total ?? null,
        bulls: values.bulls ?? null,
      });
    });
  }

  return weekGroups.filter((g) => g.rows.length > 0);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const caller = await getRifleAdmin(req);
    if (!caller) return json({ error: "not authorized" }, 403);
    if (caller.mustChangePassword) return json({ error: "password_change_required" }, 403);
    if (!RIFLE_UPLOAD_ALLOWLIST.includes(caller.email)) {
      return json({ error: "spreadsheet upload is restricted to Kaz and Luke" }, 403);
    }

    const { file_base64 } = await req.json().catch(() => ({}));
    const b64 = String(file_base64 || "");
    if (!b64) return json({ error: "file_base64 required" }, 400);
    if (b64.length * 0.75 > MAX_BYTES) return json({ error: "file too large (max 5MB)" }, 400);

    let bytes: Uint8Array;
    try {
      bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    } catch {
      return json({ error: "file_base64 is not valid base64" }, 400);
    }

    let wb: XLSX.WorkBook;
    try {
      wb = XLSX.read(bytes, { type: "array" });
    } catch (e) {
      console.error("rifle-xlsx-parse: XLSX.read failed", e);
      return json({ error: "couldn't read that as a spreadsheet" }, 400);
    }

    const sheet = findSheet(wb);
    if (!sheet) return json({ error: "no usable sheet found" }, 400);

    const svc = serviceClient();
    const { data: shooters } = await svc.from("rifle_shooters").select("name").order("name");
    const roster = (shooters || []).map((s: { name: string }) => s.name);

    const weeks = extractWeekGroups(sheet, roster);
    if (!weeks.length) return json({ error: "no week columns with data found — expected repeating Prone/Standing/Kneeling/Overall Score/Bull's-Eye headers" }, 400);

    return json({ ok: true, weeks, sheet_name: wb.SheetNames.find((n) => wb.Sheets[n] === sheet) });
  } catch (e) {
    console.error("rifle-xlsx-parse", e);
    return json({ error: "internal error" }, 500);
  }
});
