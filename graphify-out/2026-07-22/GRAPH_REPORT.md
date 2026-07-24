# Graph Report - Trojan Battalion Folder  (2026-07-21)

## Corpus Check
- 105 files · ~212,222 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 504 nodes · 1073 edges · 48 communities (32 shown, 16 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 3 edges (avg confidence: 0.7)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `9bd758b2`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- react
- PhotoUploader.jsx
- devDependencies
- Dashboard.jsx
- EventsPanel.jsx
- BattalionCommand.jsx
- Raiders.jsx
- photo_hub_v2.sql
- raider_photo_hub.sql
- App.jsx
- emailRender.js
- Staff.jsx
- blocks.js
- About.jsx
- PeoplePanel.jsx
- .oxlintrc.json
- TopNav.jsx
- admin_roles.sql
- CadetManual.jsx
- Footer.jsx
- Companies.jsx
- index.ts
- emailPrint.js
- CommandProfile.jsx
- TabGrid.jsx
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

## God Nodes (most connected - your core abstractions)
1. `react` - 53 edges
2. `supabase` - 36 edges
3. `P` - 33 edges
4. `sp` - 24 edges
5. `fs` - 22 edges
6. `Btn()` - 21 edges
7. `PanelHeader()` - 18 edges
8. `Card()` - 16 edges
9. `Label()` - 15 edges
10. `serviceClient()` - 13 edges

## Surprising Connections (you probably didn't know these)
- `Bulletin()` --indirect_call--> `toCalendarItem()`  [INFERRED]
  src/components/Bulletin.jsx → src/lib/calendar.js
- `PhotoUploader()` --calls--> `getDeviceId()`  [EXTRACTED]
  src/components/PhotoUploader.jsx → src/lib/fingerprint.js
- `EventsPanel()` --indirect_call--> `toCalendarItem()`  [INFERRED]
  src/components/admin/panels/EventsPanel.jsx → src/lib/calendar.js
- `RaiderVoting()` --calls--> `getDeviceId()`  [EXTRACTED]
  src/components/RaiderVoting.jsx → src/lib/fingerprint.js
- `SubmitHub()` --calls--> `getTeam()`  [EXTRACTED]
  src/components/SubmitHub.jsx → src/lib/teams.js

## Import Cycles
- None detected.

## Communities (48 total, 16 thin omitted)

### Community 0 - "react"
Cohesion: 0.08
Nodes (54): react, downloadWinnerCard(), AccountAuth(), AccountGrid(), PasswordForm(), AccountsPanel(), AdvancedPanel(), SUBTABS (+46 more)

### Community 1 - "PhotoUploader.jsx"
Cohesion: 0.23
Nodes (11): backBtn, P, SubmitHub(), ghostBtn, loadingStyle, P, TeamGallery(), getTeam() (+3 more)

### Community 2 - "devDependencies"
Cohesion: 0.04
Nodes (45): autoprefixer, @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities, @fingerprintjs/fingerprintjs, oxlint, dependencies, @dnd-kit/core (+37 more)

### Community 3 - "Dashboard.jsx"
Cohesion: 0.08
Nodes (27): Dashboard(), ROLE_SECTIONS, SECTION_LABEL, Admin(), LoginScreen(), NAV_GROUPS, Sidebar(), StatusBar() (+19 more)

### Community 4 - "EventsPanel.jsx"
Cohesion: 0.14
Nodes (20): CATEGORY_OPTIONS, emptyForm(), EventsPanel(), missingCore(), selectStyle, Bulletin(), CAT, groupByMonth() (+12 more)

### Community 5 - "BattalionCommand.jsx"
Cohesion: 0.11
Nodes (8): activate(), BattalionCommand(), BOARD_MATH, boardColor(), CommandCard(), MathScatter(), P, TacticalMap()

### Community 6 - "Raiders.jsx"
Cohesion: 0.14
Nodes (8): CAT_LABEL, CommanderCard(), EventCalendar(), fmtDate(), initials(), navBtn, P, Raiders()

### Community 7 - "photo_hub_v2.sql"
Cohesion: 0.28
Nodes (10): photos_rate_limit_trg, public.cast_vote(), public.close_due_polls(), public.finalize_poll(), public.gallery, public.photo_bulletin, public.photos, public.photos_rate_limit() (+2 more)

### Community 8 - "raider_photo_hub.sql"
Cohesion: 0.27
Nodes (10): public.cast_raider_vote(), public.close_due_raider_polls(), public.finalize_raider_poll(), public.raider_bulletin, public.raider_gallery, public.raider_photos, public.raider_photos_rate_limit(), public.raider_polls (+2 more)

### Community 9 - "App.jsx"
Cohesion: 0.26
Nodes (8): App(), hashToState(), stateToHash(), TABS, Hero(), P, HomeNewsletterBand(), P

### Community 10 - "emailRender.js"
Cohesion: 0.31
Nodes (10): BlockFields(), EmailBuilder(), blockHtml(), blocksToHtml(), blocksToText(), C, collectAttachments(), escapeHtml() (+2 more)

### Community 11 - "Staff.jsx"
Cohesion: 0.20
Nodes (5): activate(), P, S_SECTIONS, Staff(), StaffCard()

### Community 12 - "blocks.js"
Cohesion: 0.24
Nodes (9): BLOCK_TYPES, blockLabel(), BY_TYPE, makeBlock(), newId(), starterBlocks(), arrowStyle(), SortableBlock() (+1 more)

### Community 13 - "About.jsx"
Cohesion: 0.25
Nodes (6): About(), CORE_VALUES, P, TEAMS, P, VerifiedTooltip()

### Community 14 - "PeoplePanel.jsx"
Cohesion: 0.19
Nodes (19): cors, json(), preflight(), b64(), derive(), hashPin(), timingSafeEqual(), unb64() (+11 more)

### Community 15 - ".oxlintrc.json"
Cohesion: 0.25
Nodes (7): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema, oxc, warn

### Community 16 - "TopNav.jsx"
Cohesion: 0.29
Nodes (3): NAV_ITEMS, P, TopNav()

### Community 17 - "admin_roles.sql"
Cohesion: 0.33
Nodes (3): public.admin_role(), public.admin_roles, public.events

### Community 18 - "CadetManual.jsx"
Cohesion: 0.40
Nodes (4): ALL_CHAPTERS, CadetManual(), P, UNITS

### Community 19 - "Footer.jsx"
Cohesion: 0.33
Nodes (4): COLS, Footer(), NAV_MAP, P

### Community 20 - "Companies.jsx"
Cohesion: 0.50
Nodes (3): Companies, P, ROLE_ORDER

### Community 22 - "emailPrint.js"
Cohesion: 0.83
Nodes (3): escapeHtml(), officialLetter(), printEmailMessage()

### Community 23 - "CommandProfile.jsx"
Cohesion: 0.50
Nodes (3): CommandProfile(), P, ROLE_LABELS

### Community 24 - "TabGrid.jsx"
Cohesion: 0.50
Nodes (3): ITEMS, P, TabGrid()

### Community 41 - "PhotoUploader.jsx"
Cohesion: 0.18
Nodes (11): BATTALION_OPT, btnGhost, btnGold, getOption(), inputStyle, label, P, panel (+3 more)

### Community 42 - "RaiderVoting.jsx"
Cohesion: 0.24
Nodes (10): CATS, centered, fmtCountdown(), ghostBtn, loadingStyle, P, RaiderVoting(), statLabel (+2 more)

### Community 43 - "Rifle.jsx"
Cohesion: 0.17
Nodes (3): P, Rifle(), SEASON

### Community 44 - "imageResize.js"
Cohesion: 0.70
Nodes (4): drawScaled(), loadImage(), resizeForUpload(), toBlob()

### Community 45 - "React + Vite"
Cohesion: 0.50
Nodes (3): Expanding the Oxlint configuration, React Compiler, React + Vite

## Knowledge Gaps
- **131 isolated node(s):** `$schema`, `oxc`, `react/rules-of-hooks`, `warn`, `name` (+126 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **16 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `react` to `PhotoUploader.jsx`, `Dashboard.jsx`, `EventsPanel.jsx`, `BattalionCommand.jsx`, `Raiders.jsx`, `App.jsx`, `Staff.jsx`, `About.jsx`, `.oxlintrc.json`, `TopNav.jsx`, `CadetManual.jsx`, `Footer.jsx`, `Companies.jsx`, `CommandProfile.jsx`, `TabGrid.jsx`, `Pictures.jsx`, `PhotoUploader.jsx`, `RaiderVoting.jsx`, `Rifle.jsx`?**
  _High betweenness centrality (0.206) - this node is a cross-community bridge._
- **Why does `supabase` connect `react` to `PhotoUploader.jsx`, `Dashboard.jsx`, `EventsPanel.jsx`, `BattalionCommand.jsx`, `Raiders.jsx`, `App.jsx`, `PhotoUploader.jsx`, `RaiderVoting.jsx`, `Staff.jsx`, `About.jsx`, `Companies.jsx`, `CommandProfile.jsx`, `Pictures.jsx`?**
  _High betweenness centrality (0.056) - this node is a cross-community bridge._
- **Why does `plugins` connect `.oxlintrc.json` to `react`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **What connects `$schema`, `oxc`, `react/rules-of-hooks` to the rest of the system?**
  _131 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `react` be split into smaller, more focused modules?**
  _Cohesion score 0.0826427771556551 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.043478260869565216 - nodes in this community are weakly interconnected._
- **Should `Dashboard.jsx` be split into smaller, more focused modules?**
  _Cohesion score 0.0761904761904762 - nodes in this community are weakly interconnected._