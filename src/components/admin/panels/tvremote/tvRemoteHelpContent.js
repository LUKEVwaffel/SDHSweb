// ============================================================================
// Shared copy for every TV Remote explainer surface:
//   • TAB_INTRO      — the banner at the top of each tab's pane
//   • WALKTHROUGH     — the first-run guided slide tour
//   • GUIDE_SECTIONS  — the full reference behind the "? Guide" button
//
// One source so the three never drift apart. Plain language only — the reader
// is the Battalion Commander, not an engineer.
// ============================================================================

// ── Per-tab banner. Keyed by the tab id used in TvRemotePanel's tabs array. ──
// what  = one line: what this tab controls
// where = where it shows up on the physical TV
// when  = when the change actually takes effect
export const TAB_INTRO = {
  emergency: {
    icon: '🚨',
    title: 'Emergency Push',
    what: 'Put a full-screen message (and optional photo) on top of everything the screen is showing.',
    where: 'Covers the entire selected screen until you turn it off.',
    when: 'Goes live the instant you press the push button on this tab — it does NOT wait for the main Save button.',
    tone: 'danger',
  },
  schedule: {
    icon: '🔔',
    title: 'Bell Schedule',
    what: 'Tells the screens which bell schedule the school is on today, so period timing lines up.',
    where: 'Drives the countdowns and period names on both the Outside and Range screens.',
    when: 'After you press Save. Leave it on AUTO unless it is an odd day (assembly, snow day) — then set MANUAL and switch it back after.',
  },
  teams: {
    icon: '⭐',
    title: 'Featured Team',
    what: 'Picks which program (Raiders, Rifle, etc.) the screen highlights right now.',
    where: 'The featured-team banner and stats block on the Outside screen.',
    when: 'After you press Save.',
  },
  photos: {
    icon: '🖼️',
    title: 'Photo Source',
    what: 'Chooses which set of photos rotates through the screen — a team, a specific event, or ones you upload here.',
    where: 'The big photo slideshow on the Outside screen.',
    when: 'After you press Save.',
  },
  widget: {
    icon: '💬',
    title: 'Bottom Widget',
    what: 'Sets what fills the small box at the bottom of the Outside screen — a historical fact, quote, Bible verse, or your own message.',
    where: 'The bottom strip of the Outside screen.',
    when: 'After you press Save.',
  },
  shoutout: {
    icon: '📣',
    title: 'Shoutout',
    what: 'Types a recognition (name + note) that the screen displays. Leave the fields blank for no manual shoutout.',
    where: 'The shoutout card on the Outside screen.',
    when: 'After you press Save.',
  },
  rangeSchedule: {
    icon: '🗓️',
    title: 'Schedule Editor — Range only',
    what: 'Sets which company each period belongs to and the messages shown during planning, T2, lunch, and company welcomes.',
    where: 'Everything the Range screen shows during the school day between rotations.',
    when: 'After you press Save. Use "Test a date/time" up top to preview a specific period before you save.',
  },
  rangeLayout: {
    icon: '🧩',
    title: 'Rotation Screen — Range only',
    what: 'Controls the between-periods rotation on Range: classic Grid layout, or a full-screen Slideshow of single-purpose slides.',
    where: 'The Range screen whenever no period welcome or lunch screen is active.',
    when: 'This tab has its own Save button — use it, not the main one at the bottom.',
  },
  announcements: {
    icon: '📌',
    title: 'Announcements — Range only',
    what: 'Add, edit, and delete the announcement cards on the Range rotation screen.',
    where: 'The Announcements panel of the Range rotation screen.',
    when: 'Each add / edit / delete saves on its own, right here — there is no separate Save step for this tab. Items stay up until you delete them.',
  },
  staffNotes: {
    icon: '🗒️',
    title: 'Notes from Staff — Range only',
    what: 'Same as Announcements, but for the staff-notes panel.',
    where: 'The "Notes from Staff" panel of the Range rotation screen.',
    when: 'Each add / edit / delete saves on its own, right here. Items stay up until you delete them.',
  },
};

// ── First-run guided tour. Kept to 8 short slides. ──────────────────────────
export const WALKTHROUGH = [
  {
    icon: '📺',
    title: 'This is your TV Remote',
    body: [
      'Welcome. This one screen controls the TVs in the JROTC area — the ones outside and the ones in the Range room.',
      'The tour is quick: about eight screens. You can skip it and re-open it anytime from the "? Guide" button at the top.',
    ],
  },
  {
    icon: '🛰️',
    title: 'How it reaches the TVs',
    body: [
      'The TVs themselves have no buttons or menus. They just show whatever this panel tells them to.',
      'When you press Save, the change travels over the internet and the TVs update on their own within a few seconds. You never have to walk over and touch a screen.',
    ],
  },
  {
    icon: '🔀',
    title: 'Two screens, two sets of settings',
    body: [
      'The pills near the top — OUTSIDE and RANGE — pick which screen you are editing.',
      'Each one keeps its own settings. Changing the Outside screen never touches the Range screen. Switching screens with unsaved edits will warn you first.',
    ],
  },
  {
    icon: '🗂️',
    title: 'The tabs on the left',
    body: [
      'Each tab is one thing you can control: the bell schedule, the featured team, the photos, and so on.',
      'RANGE picks up four extra tabs — the Schedule Editor, the Rotation Screen, and the two note lists — because the Range screen has a full period-by-period program, not just an all-day loop.',
    ],
  },
  {
    icon: '💾',
    title: 'Nothing goes live until you Save',
    body: [
      'Make all the changes you want across the tabs. They are held as a draft — the TVs do not see them yet.',
      'A small "Unsaved changes" dot appears while you have edits pending. The big gold SAVE button at the bottom pushes everything to the selected screen at once.',
    ],
  },
  {
    icon: '🟢',
    title: 'Checking what is actually on the TV',
    body: [
      'The green "LIVE NOW" card near the top always shows what the real TV is displaying this second — not your draft.',
      '"Show Live View" embeds the actual screen so you can watch it. "Test a date/time" opens the screen as it would look at any moment you pick, without touching the real TV.',
    ],
  },
  {
    icon: '🚨',
    title: 'Emergency Push',
    body: [
      'The red tab at the top. Use it for same-day changes people need to see right now — a cancelled practice, a room change.',
      'It puts a full-screen message over everything and goes live immediately when you push it — it does not wait for the Save button. Turn it off from the same tab when the message is no longer needed.',
    ],
  },
  {
    icon: '✅',
    title: 'You are set',
    body: [
      'That is the whole panel. Edit a tab, press Save, confirm it on the Live view.',
      'The "? Guide" button re-opens a full written reference. When new features are added here, you will get a short "What\'s new" popup the next time you log in.',
    ],
  },
];

// ── Full reference behind "? Guide". Each section: heading + array of blocks. ─
// A block is a string (paragraph) or { list: [...] } (bulleted list).
export const GUIDE_SECTIONS = [
  {
    heading: 'The basic idea',
    blocks: [
      'The televisions in the JROTC area are plain displays. They have no menu and nobody needs to physically touch them. This panel is the only way their content changes.',
      'When you press Save, your changes are sent out over the internet and every matching TV refreshes itself within a few seconds. If a TV is turned off at the time, it picks up the latest settings as soon as it powers back on.',
      { list: [
        'OUTSIDE — the screen(s) by the main JROTC entrance.',
        'RANGE — the screen(s) in the Range room, which runs a full period-by-period program during the school day.',
      ] },
    ],
  },
  {
    heading: 'Making and saving a change',
    blocks: [
      'Pick the screen you want with the OUTSIDE / RANGE pills. Open a tab on the left. Make your edits.',
      'Your edits are a draft until you Save — the TVs do not show them yet, and a small "Unsaved changes" marker appears next to the Save button.',
      'The gold "SAVE — PUSH TO ..." button at the bottom sends the whole draft to the selected screen at once. You will see a green "Pushed ✓" confirmation.',
      'Two tabs are exceptions and save on their own: the Rotation Screen tab has its own Save button, and the Announcements / Notes from Staff tabs save each item as you add, edit, or delete it.',
    ],
  },
  {
    heading: 'Seeing what is live',
    blocks: [
      'The green "LIVE NOW" card near the top reads the real screen, never your draft — so it is always trustworthy, even mid-edit.',
      '"Show Live View" embeds the actual kiosk page, rendering for real at one-third size.',
      '"Test a date/time" opens the screen in a new tab as it would appear at a moment you choose, then ticks forward from there. It is view-only and never affects the real TV — useful for checking a Range period or a bell-schedule change before you save it.',
    ],
  },
  {
    heading: 'Tab by tab',
    blocks: [
      { list: Object.values(TAB_INTRO).map((t) => `${t.title} — ${t.what}`) },
      'Every tab shows this same summary in a banner at the top of its pane, along with where it appears on the TV and when the change takes effect.',
    ],
  },
  {
    heading: 'Emergency Push',
    blocks: [
      'The red tab. It is for information people must see immediately — a same-day cancellation, a room move, a lockdown-drill note.',
      'It puts a full-screen message, optionally with a photo, over whatever the screen is showing. It goes live the moment you push it; it does not wait for the main Save button.',
      'It stays up until you turn it off from that same tab. Make a habit of clearing it once the message no longer applies.',
    ],
  },
  {
    heading: 'The Range screen in more detail',
    blocks: [
      'Unlike the Outside screen, Range follows the school clock. Through the day it moves between a planning-period screen, a T2 screen, first-lunch screens, per-company welcome screens, and a "period ending" warning.',
      'The Schedule Editor tab sets which company owns each period and the wording on each of those screens.',
      'Between those moments, Range shows its rotation — either the Grid layout or a full-screen Slideshow — which you control on the Rotation Screen tab. The Announcements and Notes from Staff tabs fill the two lists that rotation shows.',
    ],
  },
  {
    heading: 'When things change here',
    blocks: [
      'New controls and features get added to this panel over time. Each time that happens you will get a short "What\'s new" popup the next time you open DISPATCH, listing exactly what changed.',
      'You can always re-open this guide from the "? Guide" button at the top of the panel.',
    ],
  },
];
