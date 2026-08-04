# PostHog Data Warehouse Setup Report

## Summary

The wizard detected **Supabase** (via `@supabase/supabase-js` in `package.json`) as a data source to connect to the PostHog data warehouse.

Credential collection was cancelled, so the source was not created automatically. Use the browser link below to complete setup manually.

---

## Sources

### Supabase (Postgres) — needs browser setup

PostHog connects to Supabase as a **Postgres** source using the Session pooler.

**Complete setup here:**
[https://us.posthog.com/project/470111/data-warehouse/new-source?kind=Postgres&utm_source=wizard&utm_campaign=warehouse-source](https://us.posthog.com/project/470111/data-warehouse/new-source?kind=Postgres&utm_source=wizard&utm_campaign=warehouse-source)

---

## Manual Steps

When you open the link above, enter the following connection details:

| Field | Value |
|-------|-------|
| **Host** | `aws-0-<region>.pooler.supabase.com` (Session pooler — **not** the direct `db.<ref>.supabase.co` host, which is IPv6-only) |
| **Port** | `6543` (Session pooler port — not 5432) |
| **Database** | `postgres` (or whatever your Supabase DB name is) |
| **User** | `postgres.<project-ref>` (e.g. `postgres.abcdefghijklmnop`) |
| **Password** | Your **database** password from Supabase → Settings → Database (not the anon/service_role JWT key) |
| **Schema** | `public` (or leave blank to browse all schemas) |

**Where to find these in Supabase:**
- Go to **Supabase → Settings → Database → Connection pooling**
- Switch to **Session mode** (not Transaction mode)
- Copy the host, port, and user from there

**PostHog egress IPs to allowlist** (add these in Supabase → Settings → Database → Network restrictions if needed):
- `44.205.89.55`
- `52.4.194.122`
- `44.208.188.173`

---

## Files Modified

No project source files were modified. This skill only configures the PostHog data warehouse connection.

---

## Files Created

- `posthog-warehouse-report.md` (this file)
