# PostHog Self-driving Setup Report

**Project:** Trojan Battalion (PostHog project 542711)
**Date:** 2026-08-04
**Inbox:** https://us.posthog.com/project/542711/inbox

## Summary

PostHog Self-driving has been configured for the Trojan Battalion web app. Session Replay, Error Tracking, and Support signal sources are now wired to the inbox, along with a 7-scout troop that includes two custom scouts tailored to this project's domain events. Findings will start appearing in the [Self-driving inbox](https://us.posthog.com/project/542711/inbox) within approximately 30 minutes.

---

## AI Data Processing

**Approved.** Organization-level AI data processing approval was granted before this run started.

---

## GitHub

**Already connected.** The GitHub App integration (account: LUKEVwaffel, integration id: 200986) was connected on 2026-08-04 prior to this run. Self-driving can research findings in code and open draft fixes.

---

## Products Enabled

The `products-enable` tool is not available in this MCP deployment. The server-side product toggles must be flipped manually.

| Product | Status | Notes |
|---|---|---|
| Session Replay | **Manual action required** | Enable in PostHog: Settings → Session replay → "Record user sessions" |
| Error Tracking | **Manual action required** | Enable in PostHog: Settings → Error tracking → "Enable exception autocapture" |
| Support (Conversations) | **Manual action required** | Enable in PostHog: Product sidebar → Support/Conversations |

**posthog.init check (web app):** `src/lib/posthog.js` is clean — no `disable_session_recording: true` or `capture_exceptions: false` overrides. Once the server toggles are flipped, the client will pick them up automatically with no code changes needed.

---

## Signal Sources

All sources were created fresh (no prior configs existed).

| source_product | source_type | Action | Config ID |
|---|---|---|---|
| `signals_scout` | `cross_source_issue` | **On by default** — scout gate requires no config row | — |
| `health_checks` | `health_issue` | **Enabled** | 019fcea2-cf71-7d40-bb6b-d0cd68d9e81e |
| `error_tracking` | `issue_created` | **Enabled** | 019fcea2-d19d-78fd-ab8f-e5e778e56291 |
| `error_tracking` | `issue_reopened` | **Enabled** | 019fcea2-d2a5-7265-a44e-1e48b7fa4d66 |
| `error_tracking` | `issue_spiking` | **Enabled** | 019fcea2-e5e2-7dab-9725-de8964625743 |
| `session_replay` | `session_analysis_cluster` | **Enabled** (server-injected sample_rate: 0.1) | 019fcea2-ec3f-756a-bf0a-e4e188633ae7 |
| `conversations` | `ticket` | **Enabled** (dormant until inbound channel connected) | 019fcea2-ee41-79eb-ac0c-7f808736c867 |
| `llm_analytics` | — | **Skipped** — no LLM usage in this project |
| `logs` | — | **Skipped** — not a v1 responder |

---

## Connected Tools

No connected tools were selected during setup.

| Tool | Status |
|---|---|
| GitHub Issues | Not used (skipped) |
| Linear | Not used (skipped) |
| Jira | Not used (skipped) |
| Sentry | Not used (skipped) |
| Zendesk | Not used (skipped) |

---

## Scout Troop

**Run budget:** 100 runs/day (early access default), 0 used today.
**Banner:** "Scouts are in early access. Each project gets up to 100 scout runs a day. Contact team-self-driving@posthog.com if you need more."
**Max runs per tick:** 3.

### Enabled scouts (7 total)

| Scout | Type | Reason enabled |
|---|---|---|
| `signals-scout-general` | Canonical | Always enabled — cross-product correlations and surfaces no specialist covers |
| `signals-scout-web-analytics` | Canonical | Confirmed web app with `capture_pageview: true` |
| `signals-scout-health-checks` | Canonical | First-run project; PostHog setup health monitoring is high-value at this stage |
| `signals-scout-product-analytics` | Canonical | Web app with event tracking; watches saved funnels/retention flows |
| `signals-scout-web-vitals` | Canonical | posthog-js auto-captures `$web_vitals`; web performance monitoring for the app |
| `signals-scout-raider-voting` | **Custom** | Watches `raider_vote_cast` for submission cliffs during voting campaigns |
| `signals-scout-photo-pipeline` | **Custom** | Watches `photo_submission_completed` for upload pipeline breakage |

### Disabled scouts (22 total)

| Scout | Reason |
|---|---|
| `signals-scout-error-tracking` | **Covered by native source** (error_tracking source enabled in step 4) |
| `signals-scout-session-replay` | **Covered by native source** (session_replay source enabled in step 4) |
| `signals-scout-feature-flags` | No feature flag usage confirmed in codebase or event data |
| `signals-scout-experiments` | No A/B experiments in use |
| `signals-scout-surveys` | No PostHog surveys created (count: 0) |
| `signals-scout-revenue-analytics` | No payment SDK detected |
| `signals-scout-ai-observability` | No LLM/AI observability events |
| `signals-scout-logs` | PostHog logs product not in use |
| `signals-scout-csp-violations` | No CSP reporting configured |
| `signals-scout-customer-analytics` | No group/account analytics evidence |
| `signals-scout-data-pipelines` | No CDP destinations or batch exports |
| `signals-scout-data-warehouse` | No warehouse sources connected |
| `signals-scout-apm` | No distributed tracing (OpenTelemetry) |
| `signals-scout-anomaly-detection` | Not needed with specialists covering the most-used surfaces |
| `signals-scout-observability-gaps` | Not selected; room reserved for custom scouts |
| `signals-scout-replay-vision` | No Replay Vision scanners configured |
| `signals-scout-conversations` | No conversation ticket-lifecycle events yet |
| `signals-scout-inbox-validation` | Fresh setup — no shipped fixes to validate |
| `signals-scout-insight-alerts` | No insight alerts configured |
| `signals-scout-mcp-tool-calls` | No MCP tool call telemetry |
| `signals-scout-tasks` | No PostHog Tasks in use yet |
| `signals-scout-skills-store` | Not relevant for this setup |

**Re-enable follow-ups** (when these surfaces are adopted):
- Enable `signals-scout-feature-flags` if you start using PostHog feature flags
- Enable `signals-scout-surveys` if you create PostHog surveys
- Enable `signals-scout-experiments` if you run A/B experiments
- Enable `signals-scout-logs` if you use the PostHog logs product

---

## Custom Scouts

### `signals-scout-raider-voting`

**What it watches:** `raider_vote_cast` events (captured in `src/components/RaiderVoting.jsx`), watching for submission volume cliffs during a voting campaign window.

**Discriminator:** A sustained > 60% drop in `raider_vote_cast` rate over 6+ consecutive hours while pageview traffic holds is the primary signal. Outside voting season the rate is near zero — near-zero with no established baseline is not a finding.

**Why no built-in covers it:** `signals-scout-product-analytics` watches saved funnel insights; the voting event stream is not modeled as a saved funnel. `signals-scout-web-analytics` watches traffic, not form completions. No other specialist covers this domain-specific, time-bounded event.

**Explore patterns:** (1) Hourly `raider_vote_cast` volume trend; (2) Per-`vote_category` distribution to catch isolated option breakage; (3) `$exception` co-occurrence within 2h of a cliff.

**Noise escape hatch:** Set `emit: false` on this scout's config in PostHog to switch it to dry-run mode if it becomes noisy.

---

### `signals-scout-photo-pipeline`

**What it watches:** `photo_submission_completed` events (captured in `src/components/PhotoUploader.jsx`), watching for drops against the 14-day rolling baseline.

**Discriminator:** The ratio of `photo_submission_completed` to overall pageview traffic is the key signal. A drop > 60% over 48h with stable pageviews indicates pipeline breakage; both metrics dropping together points to seasonal demand, not a bug.

**Why no built-in covers it:** No built-in scout watches domain-specific completion events for this upload pipeline. `signals-scout-web-analytics` and `signals-scout-product-analytics` do not watch raw event volume ratios for individual form completions.

**Explore patterns:** (1) Daily submission volume over 14 days; (2) Submission-to-pageview ratio cross-reference; (3) `$exception` spikes overlapping the drop window.

**Noise escape hatch:** Set `emit: false` on this scout's config in PostHog to switch it to dry-run mode if it becomes noisy.

---

**Surfaces considered and ruled out:**
- `faq_question_submitted` — low signal value; a drop is not actionable enough for a daily scheduled scout
- `newsletter_subscription_completed` — not a critical flow for a battalion management app
- `aar_created` — admin-facing, hard to baseline without frequency context
- `admin_bulk_photo_upload_completed` — admin-facing, low volume

---

## Follow-ups

- [ ] **Enable Session Replay product toggle:** PostHog → Settings → Session replay → "Record user sessions"
- [ ] **Enable Error Tracking product toggle:** PostHog → Settings → Error tracking → "Enable exception autocapture"
- [ ] **Enable Support (Conversations) product:** PostHog → Product sidebar → Support/Conversations
- [ ] **Connect a Conversations inbound channel:** Once the Support product is enabled, connect an email, inbox, or Slack channel so tickets reach the inbox. The `conversations/ticket` source row is already enabled and will start producing findings automatically once a channel exists.
- [ ] **Re-enable surface-specific scouts as needed:** `signals-scout-feature-flags`, `signals-scout-surveys`, `signals-scout-experiments`, `signals-scout-logs` — enable each in PostHog when the corresponding product surface is adopted.

---

## What Happens Next

The scout coordinator picks up the newly enabled scouts within ~30 minutes and fires the first runs. Each run draws from the project's daily budget (100 runs/day during early access; contact team-self-driving@posthog.com for more). Findings cluster into reports in the [Self-driving inbox](https://us.posthog.com/project/542711/inbox). Immediately-actionable reports can start coding tasks — Self-driving opens a draft PR for each fix it judges actionable, which goes through your normal review and CI before anything merges.
