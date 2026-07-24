# Graph Report - /Users/lukevetsch/Desktop/Trojan Battalion Folder  (2026-07-20)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 450 nodes · 937 edges · 41 communities (27 shown, 14 thin omitted)
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

## God Nodes (most connected - your core abstractions)
1. `react` - 50 edges
2. `supabase` - 33 edges
3. `P` - 30 edges
4. `Btn()` - 22 edges
5. `sp` - 21 edges
6. `fs` - 19 edges
7. `PanelHeader()` - 18 edges
8. `Card()` - 16 edges
9. `Label()` - 16 edges
10. `Input()` - 12 edges

## Surprising Connections (you probably didn't know these)
- `Bulletin()` --indirect_call--> `toCalendarItem()`  [INFERRED]
  src/components/Bulletin.jsx → src/lib/calendar.js
- `EventsPanel()` --indirect_call--> `toCalendarItem()`  [INFERRED]
  src/components/admin/panels/EventsPanel.jsx → src/lib/calendar.js
- `PhotoUploader()` --calls--> `getDeviceId()`  [EXTRACTED]
  src/components/PhotoUploader.jsx → src/lib/fingerprint.js
- `RaiderVoting()` --calls--> `getDeviceId()`  [EXTRACTED]
  src/components/RaiderVoting.jsx → src/lib/fingerprint.js
- `SubmitHub()` --calls--> `getTeam()`  [EXTRACTED]
  src/components/SubmitHub.jsx → src/lib/teams.js

## Import Cycles
- None detected.

## Communities (41 total, 14 thin omitted)

### Community 0 - "react"
Cohesion: 0.11
Nodes (45): react, downloadWinnerCard(), AccountsPanel(), AdvancedPanel(), SUBTABS, DesignTokensPanel(), EmailHistoryPanel(), fmtDate() (+37 more)

### Community 1 - "PhotoUploader.jsx"
Cohesion: 0.05
Nodes (39): BATTALION_OPT, btnGhost, btnGold, getOption(), inputStyle, label, P, panel (+31 more)

### Community 2 - "devDependencies"
Cohesion: 0.05
Nodes (43): autoprefixer, @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities, @fingerprintjs/fingerprintjs, oxlint, dependencies, @dnd-kit/core (+35 more)

### Community 3 - "Dashboard.jsx"
Cohesion: 0.09
Nodes (23): Dashboard(), ROLE_SECTIONS, SECTION_LABEL, Admin(), LoginScreen(), NAV_GROUPS, Sidebar(), StatusBar() (+15 more)

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
Cohesion: 0.31
Nodes (8): ConsentSection(), CONSENT_META, groupBySection(), normName(), PeoplePanel(), SECTION_LABEL, SECTION_ORDER, selectStyle

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
Nodes (3): COMPANIES, P, ROLE_ORDER

### Community 22 - "emailPrint.js"
Cohesion: 0.83
Nodes (3): escapeHtml(), officialLetter(), printEmailMessage()

### Community 23 - "CommandProfile.jsx"
Cohesion: 0.50
Nodes (3): CommandProfile(), P, ROLE_LABELS

### Community 24 - "TabGrid.jsx"
Cohesion: 0.50
Nodes (3): ITEMS, P, TabGrid()

## Knowledge Gaps
- **125 isolated node(s):** `$schema`, `oxc`, `react/rules-of-hooks`, `warn`, `name` (+120 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **14 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `react` to `PhotoUploader.jsx`, `Dashboard.jsx`, `EventsPanel.jsx`, `BattalionCommand.jsx`, `Raiders.jsx`, `App.jsx`, `Staff.jsx`, `About.jsx`, `PeoplePanel.jsx`, `.oxlintrc.json`, `TopNav.jsx`, `CadetManual.jsx`, `Footer.jsx`, `Companies.jsx`, `CommandProfile.jsx`, `TabGrid.jsx`, `Pictures.jsx`?**
  _High betweenness centrality (0.240) - this node is a cross-community bridge._
- **Why does `supabase` connect `react` to `PhotoUploader.jsx`, `Dashboard.jsx`, `EventsPanel.jsx`, `BattalionCommand.jsx`, `Raiders.jsx`, `App.jsx`, `Staff.jsx`, `About.jsx`, `PeoplePanel.jsx`, `Companies.jsx`, `CommandProfile.jsx`, `Pictures.jsx`?**
  _High betweenness centrality (0.064) - this node is a cross-community bridge._
- **Why does `plugins` connect `.oxlintrc.json` to `react`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **What connects `$schema`, `oxc`, `react/rules-of-hooks` to the rest of the system?**
  _125 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `react` be split into smaller, more focused modules?**
  _Cohesion score 0.10560492139439508 - nodes in this community are weakly interconnected._
- **Should `PhotoUploader.jsx` be split into smaller, more focused modules?**
  _Cohesion score 0.053246753246753244 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.045454545454545456 - nodes in this community are weakly interconnected._