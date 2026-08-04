# Graph Report - Trojan Battalion Folder  (2026-07-30)

## Corpus Check
- 163 files · ~466,588 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 689 nodes · 1521 edges · 72 communities (48 shown, 24 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 3 edges (avg confidence: 0.7)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `bf8de896`
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
- imageResize.js

## God Nodes (most connected - your core abstractions)
1. `react` - 68 edges
2. `supabase` - 49 edges
3. `P` - 40 edges
4. `sp` - 31 edges
5. `fs` - 29 edges
6. `Btn()` - 26 edges
7. `serviceClient()` - 24 edges
8. `PanelHeader()` - 22 edges
9. `Label()` - 20 edges
10. `Card()` - 19 edges

## Surprising Connections (you probably didn't know these)
- `BattalionCommand()` --calls--> `useIsMobile()`  [EXTRACTED]
  src/components/BattalionCommand.jsx → src/hooks/useIsMobile.js
- `TeaserRow()` --calls--> `categoryColor()`  [EXTRACTED]
  src/components/Bulletin.jsx → src/lib/calendar.js
- `Bulletin()` --indirect_call--> `toCalendarItem()`  [INFERRED]
  src/components/Bulletin.jsx → src/lib/calendar.js
- `SubmitQuestion()` --calls--> `getDeviceId()`  [EXTRACTED]
  src/components/FaqSection.jsx → src/lib/fingerprint.js
- `FooterLink()` --calls--> `legacyIdToPath()`  [EXTRACTED]
  src/components/Footer.jsx → src/lib/routes.js

## Import Cycles
- None detected.

## Communities (72 total, 24 thin omitted)

### Community 0 - "react"
Cohesion: 0.08
Nodes (61): react, downloadWinnerCard(), AccountAuth(), AccountGrid(), EyeIcon(), PasswordForm(), AccountsPanel(), AchievementCatalog() (+53 more)

### Community 1 - "PhotoUploader.jsx"
Cohesion: 0.15
Nodes (17): P, PhotoLightbox(), backBtn, P, SubmitHub(), P, TabPlaceholder(), P (+9 more)

### Community 2 - "devDependencies"
Cohesion: 0.04
Nodes (47): autoprefixer, @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities, @fingerprintjs/fingerprintjs, oxlint, dependencies, @dnd-kit/core (+39 more)

### Community 3 - "PhotoUploader.jsx"
Cohesion: 0.18
Nodes (11): BATTALION_OPT, btnGhost, btnGold, getOption(), inputStyle, label, P, panel (+3 more)

### Community 4 - "EventsPanel.jsx"
Cohesion: 0.09
Nodes (38): CATEGORY_OPTIONS, emptyForm(), EventsPanel(), missingCore(), selectStyle, Bulletin(), emptyStyle, P (+30 more)

### Community 5 - "BattalionCommand.jsx"
Cohesion: 0.10
Nodes (8): activate(), BOARD_MATH, boardColor(), CommandCard(), MathScatter(), P, ROLE_INFO, TacticalMap()

### Community 6 - "Raiders.jsx"
Cohesion: 0.09
Nodes (14): P, RaiderCarousel(), SLIDES, FAQS, P, RaiderFAQ(), CAT_LABEL, CommanderCard() (+6 more)

### Community 7 - "photo_hub_v2.sql"
Cohesion: 0.28
Nodes (10): photos_rate_limit_trg, public.cast_vote(), public.close_due_polls(), public.finalize_poll(), public.gallery, public.photo_bulletin, public.photos, public.photos_rate_limit() (+2 more)

### Community 8 - "raider_photo_hub.sql"
Cohesion: 0.27
Nodes (10): public.cast_raider_vote(), public.close_due_raider_polls(), public.finalize_raider_poll(), public.raider_bulletin, public.raider_gallery, public.raider_photos, public.raider_photos_rate_limit(), public.raider_polls (+2 more)

### Community 9 - "App.jsx"
Cohesion: 0.14
Nodes (13): App(), TabRoute(), TABS, Dashboard(), Admin(), ForcePasswordChange(), inputStyle(), LoginScreen() (+5 more)

### Community 10 - "emailRender.js"
Cohesion: 0.31
Nodes (10): BlockFields(), EmailBuilder(), blockHtml(), blocksToHtml(), blocksToText(), C, collectAttachments(), escapeHtml() (+2 more)

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
Cohesion: 0.19
Nodes (10): Companies, P, ROLE_ORDER, Hero(), HERO_STATS, P, ITEMS, P (+2 more)

### Community 24 - "FaqSection.jsx"
Cohesion: 0.27
Nodes (5): FaqSection(), P, SubmitQuestion(), getDeviceId(), localNonce()

### Community 27 - "TabPlaceholder.jsx"
Cohesion: 0.17
Nodes (3): P, Rifle(), SEASON

### Community 41 - "PhotoUploader.jsx"
Cohesion: 0.07
Nodes (29): ROLE_SECTIONS, SECTION_LABEL, NAV_GROUPS, Sidebar(), StatusBar(), TopBar(), AdvancedPanel(), EmailPanel() (+21 more)

### Community 42 - "RaiderVoting.jsx"
Cohesion: 0.60
Nodes (3): public.reviewer_credentials, public.reviewer_has_pin(), public.reviewer_reserve_pin_attempt()

### Community 43 - "Rifle.jsx"
Cohesion: 0.83
Nodes (3): escapeHtml(), officialLetter(), printEmailMessage()

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

### Community 73 - "imageResize.js"
Cohesion: 0.70
Nodes (4): drawScaled(), loadImage(), resizeForUpload(), toBlob()

## Knowledge Gaps
- **165 isolated node(s):** `$schema`, `oxc`, `react/rules-of-hooks`, `warn`, `name` (+160 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **24 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `react` to `PhotoUploader.jsx`, `PhotoUploader.jsx`, `EventsPanel.jsx`, `AarsPanel.jsx`, `BattalionCommand.jsx`, `Raiders.jsx`, `RaiderVoting.jsx`, `App.jsx`, `PhotoUploader.jsx`, `blocks.js`, `About.jsx`, `imageResize.js`, `.oxlintrc.json`, `CadetManual.jsx`, `Footer.jsx`, `Companies.jsx`, `FaqSection.jsx`, `TabPlaceholder.jsx`?**
  _High betweenness centrality (0.194) - this node is a cross-community bridge._
- **Why does `supabase` connect `react` to `PhotoUploader.jsx`, `PhotoUploader.jsx`, `EventsPanel.jsx`, `AarsPanel.jsx`, `BattalionCommand.jsx`, `Raiders.jsx`, `RaiderVoting.jsx`, `App.jsx`, `PhotoUploader.jsx`, `blocks.js`, `About.jsx`, `imageResize.js`, `Footer.jsx`, `Companies.jsx`, `FaqSection.jsx`?**
  _High betweenness centrality (0.057) - this node is a cross-community bridge._
- **Why does `plugins` connect `.oxlintrc.json` to `react`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **What connects `$schema`, `oxc`, `react/rules-of-hooks` to the rest of the system?**
  _165 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `react` be split into smaller, more focused modules?**
  _Cohesion score 0.07534807534807535 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.041666666666666664 - nodes in this community are weakly interconnected._
- **Should `EventsPanel.jsx` be split into smaller, more focused modules?**
  _Cohesion score 0.08686868686868687 - nodes in this community are weakly interconnected._