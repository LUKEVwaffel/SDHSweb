// Shared loader/renderer for the S-6-editable ball email prose layer
// (ball_email_templates). Every ball email sender calls loadBallTemplate() and
// then pick() for each field, passing its own built-in default as the fallback.
// A missing row, a disabled row, or a blank field all fall back to the default,
// so an edit here can never break a send.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface BallTemplate {
  key: string;
  enabled: boolean;
  subject: string | null;
  heading: string | null;
  intro_html: string | null;
  notice_html: string | null;
  closing_html: string | null;
}

export async function loadBallTemplate(
  svc: SupabaseClient,
  key: string,
): Promise<BallTemplate | null> {
  try {
    const { data } = await svc
      .from("ball_email_templates")
      .select("key, enabled, subject, heading, intro_html, notice_html, closing_html")
      .eq("key", key)
      .maybeSingle();
    return (data as BallTemplate) ?? null;
  } catch {
    return null; // table not migrated yet, network blip, etc. — use defaults
  }
}

// True only when a row exists AND is explicitly disabled.
export function isDisabled(t: BallTemplate | null): boolean {
  return !!t && t.enabled === false;
}

// Substitute {{token}} occurrences. Unknown tokens are left as-is so a typo in
// the panel is visible rather than silently dropping text.
export function applyVars(s: string, vars: Record<string, string>): string {
  return s.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (m, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? vars[name] : m,
  );
}

// Pick a template field (rendered) or fall back to the caller's default
// (also rendered, so defaults may use the same placeholders).
export function pick(
  t: BallTemplate | null,
  field: keyof Omit<BallTemplate, "key" | "enabled">,
  fallback: string,
  vars: Record<string, string> = {},
): string {
  const raw = t && typeof t[field] === "string" ? (t[field] as string).trim() : "";
  return applyVars(raw || fallback, vars);
}

// Turn a plain-text block (blank line = paragraph) into the <p>…</p> HTML the
// ballEmailShell intro/closing slots expect. Caller is responsible for having
// already escaped any interpolated user values in `vars`.
export function paras(text: string, opts: { firstMargin?: string; lastMargin?: string } = {}): string {
  const blocks = text.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  if (!blocks.length) return "";
  return blocks
    .map((b, i) => {
      const top = i === 0 ? "0" : "12px";
      const bottom = i === blocks.length - 1 ? (opts.lastMargin ?? "0") : "0";
      return `<p style="margin:${top} 0 ${bottom};">${b.replace(/\n/g, "<br />")}</p>`;
    })
    .join("\n");
}
