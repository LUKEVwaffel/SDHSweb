# Graph Report - Trojan Battalion Folder  (2026-08-04)

## Corpus Check
- 190 files · ~508,902 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1338 nodes · 2250 edges · 197 communities (105 shown, 92 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.73)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b480b4dc`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- react
- PhotoUploader.jsx
- devDependencies
- PhotoUploader.jsx
- EventsPanel.jsx
- BattalionCommand.jsx
- Raiders.jsx
- photo_hub_v2.sql
- raider_photo_hub.sql
- App.jsx
- emailRender.js
- blocks.js
- blocks.js
- About.jsx
- PeoplePanel.jsx
- .oxlintrc.json
- PostHog
- admin_roles.sql
- CadetManual.jsx
- Footer.jsx
- Companies.jsx
- index.ts
- emailPrint.js
- CommandProfile.jsx
- FaqSection.jsx
- auth_rls.sql
- Pictures.jsx
- TabPlaceholder.jsx
- email_system.sql
- raiders_calendar_stats.sql
- account_picker.sql
- cadet_consent.sql
- cadet_consent_contact.sql
- email_builder.sql
- email_review.sql
- events_calendar.sql
- personnel_email.sql
- photos_battalion.sql
- PhotoUploader.jsx
- RaiderVoting.jsx
- Rifle.jsx
- imageResize.js
- React + Vite
- CLAUDE.md
- webauthn_challenges.sql
- achievements.sql
- email_reviewer_first_login.sql
- email_reviewer_password_gate_fix.sql
- email_review_assignment.sql
- email_review_decisions_add_delete.sql
- faq_questions.sql
- RaiderVoting.jsx
- FaqSection.jsx
- AarsPanel.jsx
- RaiderVoting.jsx
- admin_password_gate.sql
- ui.jsx
- imageResize.js
- Syncing
- Best practices when using `identify`
- Installation
- PeoplePanel.jsx
- Linking Stripe as a source - Docs
- Linking BigQuery as a source - Docs
- dependencies
- Direct Snowflake connections
- PostHog Self-driving Setup Report
- RaiderPolls.jsx
- Troubleshooting
- PostHog Data Warehouse — Source Setup
- EventsPage.jsx
- PhotoLightbox.jsx
- Linking Postgres as a source - Docs
- package.json
- MediaPanel.jsx
- OverviewPanel.jsx
- MonthGridCalendar.jsx
- eventsPdfPrint.js
- PostHog Data Warehouse Setup Report
- Selecting columns
- opticsend.sql
- CDC requirements
- Companies.jsx
- RaiderCarousel.jsx
- Managing CDC after source creation
- Live queries
- Examples
- Examples
- Examples
- Examples
- Examples
- events_multi_calendar.sql
- Filtering rows
- Output table modes
- Examples
- Examples
- Examples
- Examples
- Examples
- Examples
- Examples
- Examples
- Examples
- Examples
- Examples
- Examples
- Examples
- Examples
- Examples
- Examples
- PostHog JavaScript Web SDK
- Examples
- Examples
- Examples
- Examples
- email_review_revoke_override.sql
- COMMANDMENTS.md
- Error tracking methods
- Identification methods
- Surveys methods
- Examples
- Examples
- Capture methods
- Examples
- Logs methods
- LLM analytics methods
- Examples
- Privacy methods
- Examples
- Initialization methods
- Examples
- Examples
- Examples
- Examples
- Examples
- Examples
- Examples
- Examples
- Examples
- Examples
- Examples
- Examples
- Examples
- Examples
- Examples
- Examples
- Examples
- Examples
- Examples
- Examples
- Examples
- Examples
- Examples
- Examples
- Examples
- Examples
- Examples
- Examples
- Examples
- Examples
- Feature flags methods
- Session replay methods
- Lifecycle methods
- Toolbar methods
- Other methods
- expo-application
- expo-file-system
- expo-localization
- @fingerprintjs/fingerprintjs
- posthog-js
- qrcode
- react-native
- react-router-dom
- @simplewebauthn/browser
- cadet_consent_grade_let.sql
- events_end_time.sql
- events_recurrence.sql
- photos_uploaded_by.sql

## God Nodes (most connected - your core abstractions)
1. `PostHog` - 210 edges
2. `react` - 71 edges
3. `supabase` - 49 edges
4. `P` - 41 edges
5. `sp` - 34 edges
6. `fs` - 32 edges
7. `Btn()` - 27 edges
8. `serviceClient()` - 24 edges
9. `PanelHeader()` - 23 edges
10. `Label()` - 21 edges

## Surprising Connections (you probably didn't know these)
- `TeaserRow()` --calls--> `categoryColor()`  [EXTRACTED]
  src/components/Bulletin.jsx → src/lib/calendar.js
- `AdminBulkUpload()` --indirect_call--> `isRawFile()`  [INFERRED]
  src/components/admin/panels/photos/AdminBulkUpload.jsx → src/lib/imageResize.js
- `Bulletin()` --indirect_call--> `toCalendarItem()`  [INFERRED]
  src/components/Bulletin.jsx → src/lib/calendar.js
- `Companies` --calls--> `useIsMobile()`  [EXTRACTED]
  src/components/Companies.jsx → src/hooks/useIsMobile.js
- `PhotoGrid()` --calls--> `getTeam()`  [EXTRACTED]
  src/components/EventsPage.jsx → src/lib/teams.js

## Import Cycles
- None detected.

## Communities (197 total, 92 thin omitted)

### Community 0 - "react"
Cohesion: 0.12
Nodes (19): AchievementCatalog(), ICON_MIME, SUBTABS, DesignTokensPanel(), EmailHistoryPanel(), fmtDate(), STATUS_COLOR, Step() (+11 more)

### Community 1 - "PhotoUploader.jsx"
Cohesion: 0.15
Nodes (19): EventsPage(), PhotoGrid(), backBtn, P, SubmitHub(), P, TabPlaceholder(), P (+11 more)

### Community 2 - "devDependencies"
Cohesion: 0.10
Nodes (21): autoprefixer, @expo/cli, oxlint, devDependencies, autoprefixer, @expo/cli, oxlint, postcss (+13 more)

### Community 3 - "PhotoUploader.jsx"
Cohesion: 0.18
Nodes (10): BATTALION_OPT, btnGold, getOption(), inputStyle, label, P, panel, PhotoUploader() (+2 more)

### Community 4 - "EventsPanel.jsx"
Cohesion: 0.14
Nodes (16): emptyForm(), EventsPanel(), missingCore(), Bulletin(), emptyStyle, P, TeaserRow(), viewAllBtn (+8 more)

### Community 5 - "BattalionCommand.jsx"
Cohesion: 0.10
Nodes (8): activate(), BOARD_MATH, boardColor(), CommandCard(), MathScatter(), P, ROLE_INFO, TacticalMap()

### Community 6 - "Raiders.jsx"
Cohesion: 0.11
Nodes (14): FAQS, P, RaiderFAQ(), CAT_LABEL, CommanderCard(), DayEventDetail(), EventCalendar(), fmtDate() (+6 more)

### Community 7 - "photo_hub_v2.sql"
Cohesion: 0.28
Nodes (10): photos_rate_limit_trg, public.cast_vote(), public.close_due_polls(), public.finalize_poll(), public.gallery, public.photo_bulletin, public.photos, public.photos_rate_limit() (+2 more)

### Community 8 - "raider_photo_hub.sql"
Cohesion: 0.27
Nodes (10): public.cast_raider_vote(), public.close_due_raider_polls(), public.finalize_raider_poll(), public.raider_bulletin, public.raider_gallery, public.raider_photos, public.raider_photos_rate_limit(), public.raider_polls (+2 more)

### Community 9 - "App.jsx"
Cohesion: 0.22
Nodes (8): App(), TabRoute(), TABS, Admin(), HomeNewsletterBand(), P, OpticPromoBand(), P

### Community 10 - "emailRender.js"
Cohesion: 0.42
Nodes (8): blockHtml(), blocksToHtml(), blocksToText(), C, collectAttachments(), escapeHtml(), fmtBytes(), safeUrl()

### Community 11 - "blocks.js"
Cohesion: 0.24
Nodes (9): BLOCK_TYPES, blockLabel(), BY_TYPE, makeBlock(), newId(), starterBlocks(), arrowStyle(), SortableBlock() (+1 more)

### Community 12 - "blocks.js"
Cohesion: 0.39
Nodes (5): ForcePasswordChange(), ReviewerPinControl(), ReviewLogin(), fmtDate(), ReviewPortal()

### Community 13 - "About.jsx"
Cohesion: 0.10
Nodes (11): About(), CORE_VALUES, FAQ_CATEGORIES, P, Reveal(), teamAccent(), TeamCard(), TEAMS (+3 more)

### Community 14 - "PeoplePanel.jsx"
Cohesion: 0.15
Nodes (24): cors, escapeHtml(), json(), preflight(), siteOrigin(), b64(), derive(), hashPin() (+16 more)

### Community 15 - ".oxlintrc.json"
Cohesion: 0.25
Nodes (7): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema, oxc, warn

### Community 16 - "PostHog"
Cohesion: 0.01
Nodes (137): Examples, Examples, Examples, Examples, Examples, Examples, Examples, Examples (+129 more)

### Community 17 - "admin_roles.sql"
Cohesion: 0.33
Nodes (3): public.admin_role(), public.admin_roles, public.events

### Community 18 - "CadetManual.jsx"
Cohesion: 0.40
Nodes (4): ALL_CHAPTERS, CadetManual(), P, UNITS

### Community 19 - "Footer.jsx"
Cohesion: 0.12
Nodes (14): CommandProfile(), P, ROLE_LABELS, COLS, Footer(), FooterLink(), NAV_MAP, P (+6 more)

### Community 20 - "Companies.jsx"
Cohesion: 0.20
Nodes (10): BattalionCommand(), Hero(), HERO_STATS, P, Raiders(), Rifle(), ITEMS, P (+2 more)

### Community 24 - "FaqSection.jsx"
Cohesion: 0.27
Nodes (5): FaqSection(), P, SubmitQuestion(), getDeviceId(), localNonce()

### Community 41 - "PhotoUploader.jsx"
Cohesion: 0.13
Nodes (15): Dashboard(), ROLE_SECTIONS, S5_ALLOWED_TEAMS, SECTION_LABEL, NAV_GROUPS, Sidebar(), StatusBar(), TopBar() (+7 more)

### Community 42 - "RaiderVoting.jsx"
Cohesion: 0.60
Nodes (3): public.reviewer_credentials, public.reviewer_has_pin(), public.reviewer_reserve_pin_attempt()

### Community 43 - "Rifle.jsx"
Cohesion: 0.16
Nodes (13): react, AccountAuth(), AccountGrid(), EyeIcon(), ForcePasswordChange(), inputStyle(), PasswordForm(), LoginScreen() (+5 more)

### Community 44 - "imageResize.js"
Cohesion: 0.20
Nodes (5): activate(), P, S_SECTIONS, Staff(), StaffCard()

### Community 45 - "React + Vite"
Cohesion: 0.50
Nodes (3): Expanding the Oxlint configuration, React Compiler, React + Vite

### Community 53 - "faq_questions.sql"
Cohesion: 0.83
Nodes (3): faq_questions_rate_limit_trg, public.faq_questions, public.faq_questions_rate_limit()

### Community 69 - "AarsPanel.jsx"
Cohesion: 0.21
Nodes (13): AarsPanel(), choiceBtnStyle(), CONFIDENTIALITY_LEVELS, draftSectionHeadStyle, emptyDraft(), escapeHtml(), ext(), isPdf() (+5 more)

### Community 70 - "RaiderVoting.jsx"
Cohesion: 0.28
Nodes (8): CATS, centered, fmtCountdown(), ghostBtn, loadingStyle, P, RaiderVoting(), statLabel

### Community 71 - "admin_password_gate.sql"
Cohesion: 0.53
Nodes (5): on_admin_password_changed, public.admin_password_changed(), public.admin_role(), public.admin_roles, public.login_accounts

### Community 72 - "ui.jsx"
Cohesion: 0.19
Nodes (18): AccountsPanel(), BlockFields(), EmailBuilder(), Messages(), STATUS_META, Subscribers(), CATEGORY_OPTIONS, selectStyle (+10 more)

### Community 73 - "imageResize.js"
Cohesion: 0.52
Nodes (6): drawScaled(), isRawFile(), loadImage(), RAW_EXTENSIONS, resizeForUpload(), toBlob()

### Community 74 - "Syncing"
Cohesion: 0.07
Nodes (26): Anchor time, Append only, Community questions, Configuring row filters, Filtering and sorting schemas, Filtering rows, Full table, How row filters work (+18 more)

### Community 75 - "Best practices when using `identify`"
Cohesion: 0.08
Nodes (24): 1\. Call `identify` as soon as you're able to, 2\. Use unique strings for distinct IDs, 3\. Reset after logout, 4\. Person profiles and properties, 5\. Use deep links between platforms, Android, Android, Android (+16 more)

### Community 76 - "Installation"
Cohesion: 0.10
Nodes (20): Available extension bundles, Bun, Community questions, Development, Identifying users, Installation, JavaScript web - Docs, npm (+12 more)

### Community 77 - "PeoplePanel.jsx"
Cohesion: 0.13
Nodes (19): BLANK_ADD_FORM, COMPANIES, ConsentSection(), GRADE_OPTIONS, LET_OPTIONS, STATUSES, BANNER_STATUSES, companyForSection() (+11 more)

### Community 78 - "Linking Stripe as a source - Docs"
Cohesion: 0.10
Nodes (19): Adding a data source, Automatic webhook event synchronization, Choosing a sync mode, Community questions, Configuration, Creating a webhook, Creating the webhook manually in Stripe, Linking Stripe as a source - Docs (+11 more)

### Community 79 - "Linking BigQuery as a source - Docs"
Cohesion: 0.11
Nodes (18): Community questions, Configuration, Configuring BigQuery, Configuring PostHog, Corrupted or invalid private key, Costs, Dataset not found or wrong region, How it works (+10 more)

### Community 80 - "dependencies"
Cohesion: 0.11
Nodes (19): @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities, expo, expo-device, dependencies, @dnd-kit/core, @dnd-kit/sortable (+11 more)

### Community 81 - "Direct Snowflake connections"
Cohesion: 0.12
Nodes (15): Community questions, Configuration, Creating a direct-only connection, Direct Snowflake connections, Enabling live queries on a synced source, Inbound IP addresses, Invalid JWT token with key-pair authentication, Limitations (+7 more)

### Community 82 - "PostHog Self-driving Setup Report"
Cohesion: 0.12
Nodes (15): AI Data Processing, Connected Tools, Custom Scouts, Disabled scouts (22 total), Enabled scouts (7 total), Follow-ups, GitHub, PostHog Self-driving Setup Report (+7 more)

### Community 83 - "RaiderPolls.jsx"
Cohesion: 0.17
Nodes (10): downloadWinnerCard(), AdminBulkUpload(), PhotosPanel(), VOTING_TEAMS, FILTERS, PhotoSubmissions(), TEAM_COLOR, defaultCloses() (+2 more)

### Community 84 - "Troubleshooting"
Cohesion: 0.13
Nodes (15): `cannot call jsonb_each on a non-object`, CDC extraction schedule is paused, Community questions, `exceeded the compute time quota`, `Failed to create replication slot` or `permission denied`, `materialized view has not been populated`, `Network is unreachable` or `No route to host`, `No replication slot capacity available` (+7 more)

### Community 85 - "PostHog Data Warehouse — Source Setup"
Cohesion: 0.13
Nodes (14): Abort statuses, For a `deep-link` source, For an `in-cli` source, Framework guidelines, Guiding tenets, How to call PostHog MCP tools, Non-interactive / CI, PostHog Data Warehouse — Source Setup (+6 more)

### Community 86 - "EventsPage.jsx"
Cohesion: 0.19
Nodes (12): backBtn, EventDetailCard(), formatDateRange(), ghostBtn, loadingStyle, modeTab, modeTabActive, P (+4 more)

### Community 87 - "PhotoLightbox.jsx"
Cohesion: 0.23
Nodes (10): actionBtn, formatDate(), formatDateTime(), navBtn, P, PhotoLightbox(), ADMIN_NAMES, adminDisplayName() (+2 more)

### Community 88 - "Linking Postgres as a source - Docs"
Cohesion: 0.18
Nodes (10): Configuration, How PostHog CDC works, Linking Postgres as a source - Docs, Operational risks and limitations, PostHog-managed, Selecting columns, Self-managed, Slot and publication management (+2 more)

### Community 89 - "package.json"
Cohesion: 0.20
Nodes (9): name, private, scripts, build, dev, lint, preview, type (+1 more)

### Community 90 - "MediaPanel.jsx"
Cohesion: 0.31
Nodes (8): BUCKETS, CONFIDENTIALITY_LEVELS, ext(), isImage(), isPdf(), levelInfo(), MediaPanel(), miniBtn()

### Community 91 - "OverviewPanel.jsx"
Cohesion: 0.33
Nodes (6): ADMIN_NAMES, displayName(), OverviewPanel(), safeCount(), safeList(), useClock()

### Community 92 - "MonthGridCalendar.jsx"
Cohesion: 0.33
Nodes (8): daysInMonth(), eventsByDay(), firstWeekday(), MonthGridCalendar(), navBtn, P, pickInitialMonth(), WEEKDAYS

### Community 93 - "eventsPdfPrint.js"
Cohesion: 0.47
Nodes (8): formatEventTime(), teamLabel(), documentHtml(), escapeHtml(), eventCardHtml(), flagSvg(), openEventsCalendarPdf(), qrDataUrl()

### Community 94 - "PostHog Data Warehouse Setup Report"
Cohesion: 0.25
Nodes (7): Files Created, Files Modified, Manual Steps, PostHog Data Warehouse Setup Report, Sources, Summary, Supabase (Postgres) — needs browser setup

### Community 95 - "Selecting columns"
Cohesion: 0.29
Nodes (6): Community questions, Configuration, Inbound IP addresses, Linking MySQL as a source - Docs, Selecting columns, Was this page useful?

### Community 96 - "opticsend.sql"
Cohesion: 0.38
Nodes (6): public.cadet_teams, public.email_messages, public.event_voting_topics, public.opticsend_drafts, public.personnel_teams, public.voting_topics

### Community 97 - "CDC requirements"
Cohesion: 0.33
Nodes (6): CDC requirements, Database user permissions, Logical replication, PostgreSQL version, Replication slot capacity, Table primary keys

### Community 98 - "Companies.jsx"
Cohesion: 0.53
Nodes (5): activate(), CadetCard(), Companies, P, ROLE_ORDER

### Community 99 - "RaiderCarousel.jsx"
Cohesion: 0.33
Nodes (3): P, RaiderCarousel(), SLIDES

### Community 100 - "Managing CDC after source creation"
Cohesion: 0.40
Nodes (5): Disabling CDC, Enabling CDC on an existing source, Managing CDC after source creation, Repairing CDC, Resuming CDC

### Community 101 - "Live queries"
Cohesion: 0.40
Nodes (5): Enabling live queries on a new source, Enabling live queries on an existing source, Live queries, Querying a live source, When to use live queries vs scheduled syncs only

### Community 102 - "Examples"
Cohesion: 0.40
Nodes (4): basic identification, Examples, identify with set and set_once properties, identify with user properties

### Community 103 - "Examples"
Cohesion: 0.40
Nodes (4): basic usage, Examples, timestamp, timestamp and lookback

### Community 104 - "Examples"
Cohesion: 0.40
Nodes (4): Display as popover (respects all conditions defined in the dashboard), Display inline in a specific element, Examples, Force display ignoring conditions and delays

### Community 105 - "Examples"
Cohesion: 0.40
Nodes (4): Examples, register a single property, register multiple properties, register with custom expiration

### Community 106 - "Examples"
Cohesion: 0.40
Nodes (4): Examples, opt-in with custom event and properties, opt-in without capturing event, simple opt-in

### Community 107 - "events_multi_calendar.sql"
Cohesion: 0.60
Nodes (4): event_secondary_teams_not_owning_trg, public._event_secondary_team_not_owning(), public.event_secondary_teams, public.events_by_calendar

### Community 108 - "Filtering rows"
Cohesion: 0.50
Nodes (4): Adding row filters, Filtering rows, Inbound IP addresses, Supported column types

### Community 109 - "Output table modes"
Cohesion: 0.50
Nodes (4): Both, CDC history table only, Consolidated table only, Output table modes

### Community 110 - "Examples"
Cohesion: 0.50
Nodes (3): associate user with an organization, associate with multiple group types, Examples

### Community 111 - "Examples"
Cohesion: 0.50
Nodes (3): basic initialization, Examples, multiple instances

### Community 112 - "Examples"
Cohesion: 0.50
Nodes (3): Capture a caught exception, Examples, With additional properties

### Community 113 - "Examples"
Cohesion: 0.50
Nodes (3): check boolean flag, check multivariate flag, Examples

### Community 114 - "Examples"
Cohesion: 0.50
Nodes (3): Examples, explicit alias with original ID, link anonymous user to account on signup

### Community 115 - "Examples"
Cohesion: 0.50
Nodes (3): disable debug mode, enable debug mode, Examples

### Community 116 - "Examples"
Cohesion: 0.50
Nodes (3): disable event tracking, Examples, simple feature flag check

### Community 117 - "Examples"
Cohesion: 0.50
Nodes (3): Examples, register properties for user flow tracking, register session-specific properties

### Community 118 - "Examples"
Cohesion: 0.50
Nodes (3): Examples, override existing value if it matches default, register once-only properties

### Community 119 - "Examples"
Cohesion: 0.50
Nodes (3): Examples, Start and ignore controls, Start and override controls

### Community 120 - "Examples"
Cohesion: 0.50
Nodes (3): Examples, Set properties with reload, Set properties without reload

### Community 121 - "Examples"
Cohesion: 0.50
Nodes (3): Examples, Set properties, Set properties without reloading

### Community 122 - "Examples"
Cohesion: 0.50
Nodes (3): Examples, Start and override controls, Start with default exception autocapture rules. No-op if already enabled

### Community 123 - "Examples"
Cohesion: 0.50
Nodes (3): Examples, get the current user ID, use in loaded callback

### Community 124 - "Examples"
Cohesion: 0.50
Nodes (3): Examples, reset and generate new device ID, reset on user logout

### Community 125 - "Examples"
Cohesion: 0.50
Nodes (3): Examples, set properties, set user properties

### Community 130 - "Examples"
Cohesion: 0.67
Nodes (3): Examples, remove a single property, remove multiple properties

## Knowledge Gaps
- **548 isolated node(s):** `$schema`, `oxc`, `react/rules-of-hooks`, `warn`, `name` (+543 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **92 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `Rifle.jsx` to `react`, `PhotoUploader.jsx`, `PhotoUploader.jsx`, `EventsPanel.jsx`, `BattalionCommand.jsx`, `Raiders.jsx`, `App.jsx`, `blocks.js`, `About.jsx`, `.oxlintrc.json`, `CadetManual.jsx`, `Footer.jsx`, `Companies.jsx`, `FaqSection.jsx`, `TabPlaceholder.jsx`, `PhotoUploader.jsx`, `imageResize.js`, `AarsPanel.jsx`, `RaiderVoting.jsx`, `ui.jsx`, `PeoplePanel.jsx`, `RaiderPolls.jsx`, `EventsPage.jsx`, `PhotoLightbox.jsx`, `MediaPanel.jsx`, `OverviewPanel.jsx`, `MonthGridCalendar.jsx`, `Companies.jsx`, `RaiderCarousel.jsx`?**
  _High betweenness centrality (0.072) - this node is a cross-community bridge._
- **Why does `PostHog` connect `PostHog` to `Examples`, `Examples`, `Examples`, `Error tracking methods`, `Identification methods`, `Surveys methods`, `Examples`, `Examples`, `Capture methods`, `Examples`, `Logs methods`, `LLM analytics methods`, `Examples`, `Privacy methods`, `Examples`, `Initialization methods`, `Examples`, `Examples`, `Examples`, `Examples`, `Examples`, `Examples`, `Examples`, `Examples`, `Examples`, `Examples`, `Examples`, `Examples`, `Examples`, `Examples`, `Examples`, `Examples`, `Examples`, `Examples`, `Examples`, `Examples`, `Examples`, `Examples`, `Examples`, `Examples`, `Examples`, `Examples`, `Examples`, `Examples`, `Examples`, `Examples`, `Feature flags methods`, `Session replay methods`, `Lifecycle methods`, `Toolbar methods`, `Other methods`, `Examples`, `Examples`, `Examples`, `Examples`, `Examples`, `Examples`, `Examples`, `Examples`, `Examples`, `Examples`, `Examples`, `Examples`, `Examples`, `Examples`, `Examples`, `Examples`, `Examples`, `Examples`, `Examples`, `Examples`, `Examples`, `PostHog JavaScript Web SDK`, `Examples`?**
  _High betweenness centrality (0.047) - this node is a cross-community bridge._
- **Why does `supabase` connect `Rifle.jsx` to `react`, `PhotoUploader.jsx`, `EventsPanel.jsx`, `BattalionCommand.jsx`, `Raiders.jsx`, `App.jsx`, `blocks.js`, `About.jsx`, `Footer.jsx`, `FaqSection.jsx`, `PhotoUploader.jsx`, `imageResize.js`, `AarsPanel.jsx`, `RaiderVoting.jsx`, `ui.jsx`, `PeoplePanel.jsx`, `RaiderPolls.jsx`, `EventsPage.jsx`, `MediaPanel.jsx`, `OverviewPanel.jsx`, `Companies.jsx`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **What connects `$schema`, `oxc`, `react/rules-of-hooks` to the rest of the system?**
  _548 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `react` be split into smaller, more focused modules?**
  _Cohesion score 0.1226890756302521 - nodes in this community are weakly interconnected._
- **Should `PhotoUploader.jsx` be split into smaller, more focused modules?**
  _Cohesion score 0.14855072463768115 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._