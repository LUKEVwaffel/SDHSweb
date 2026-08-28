// ============================================================================
// Shared copy for every TV Remote explainer surface:
//   TAB_INTRO       the banner at the top of each tab's pane
//   WALKTHROUGH     the first-run guided slide tour
//   GUIDE_SECTIONS  the full reference behind the "? Guide" button
//
// One source so the three never drift apart. Plain language only. The reader
// is the Battalion Commander, not an engineer. No em dashes anywhere.
// ============================================================================

// ── Per-tab banner. Keyed by the tab id used in TvRemotePanel's tabs array. ──
// what  : one line, what this tab controls
// where : where it shows up on the Range TV
// when  : when the change actually takes effect
export const TAB_INTRO = {
  emergency: {
    icon: '🚨',
    title: 'Emergency Push',
    what: 'Put a full-screen message (and an optional photo) on top of everything the Range TV is showing.',
    where: 'Covers the entire Range TV until you turn it off.',
    when: 'Goes live the instant you press the push button on this tab. It does NOT wait for the main Save button.',
    tone: 'danger',
  },
  schedule: {
    icon: '🔔',
    title: 'Bell Schedule',
    what: 'Tells the Range TV which bell schedule the school is on today, so every period countdown lines up.',
    where: 'Drives the period names, countdowns, and welcome timing on the Range TV.',
    when: 'After you press Save. Leave it on AUTO. Only set MANUAL for an odd day (assembly, snow day), then switch it back.',
  },
  teams: {
    icon: '⭐',
    title: 'Featured Team',
    what: 'Picks which program the TV highlights right now.',
    where: 'The featured-team area of the rotation screen.',
    when: 'After you press Save.',
  },
  photos: {
    icon: '🖼️',
    title: 'Photo Source',
    what: 'Chooses which set of photos rotates through the screen: a team, a specific event, or ones you upload here.',
    where: 'The photo slideshow on the rotation screen.',
    when: 'After you press Save.',
  },
  widget: {
    icon: '💬',
    title: 'Bottom Widget',
    what: 'Sets what fills the small box at the bottom of the rotation screen: a historical fact, a quote, a Bible verse, or your own message.',
    where: 'The bottom strip of the rotation screen.',
    when: 'After you press Save.',
  },
  shoutout: {
    icon: '📣',
    title: 'Shoutout',
    what: 'Types a recognition (name plus a note) for the TV to display. Leave the fields blank for no manual shoutout.',
    where: 'The shoutout card on the rotation screen.',
    when: 'After you press Save.',
  },
  rangeSchedule: {
    icon: '🗓️',
    title: 'Schedule Editor',
    what: 'Sets which company owns each period and the wording shown during planning, T2, lunch, the period-ending warning, and each company welcome.',
    where: 'Everything the Range TV shows during class time. See "How the Range TV runs itself" in the ? Guide for the full timeline.',
    when: 'After you press Save. Use "Test a date/time" up top to jump to any period and check it before you save.',
  },
  rangeLayout: {
    icon: '🧩',
    title: 'Rotation Screen',
    what: 'Controls the between-events rotation: the classic Grid layout, or a full-screen Slideshow of single-purpose slides.',
    where: 'The Range TV whenever no welcome, planning, lunch, or period-ending screen is active.',
    when: 'This tab has its OWN Save button. Use that one, not the main button at the bottom.',
  },
  announcements: {
    icon: '📌',
    title: 'Announcements',
    what: 'Add, edit, and delete the announcement cards on the Range rotation screen.',
    where: 'The Announcements panel of the rotation screen (and the Announcements slide, if the Slideshow uses one).',
    when: 'Every add, edit, and delete on this tab saves BY ITSELF the moment you press the button on it. There is no separate push step, and pressing the main Save button does nothing to this list. Items stay up until you delete them, and you can edit any of them at any time.',
  },
  staffNotes: {
    icon: '🗒️',
    title: 'Notes from Staff',
    what: 'Same as Announcements, but for the "Notes from Staff" panel.',
    where: 'The "Notes from Staff" panel of the rotation screen.',
    when: 'Every add, edit, and delete saves by itself right here. Items stay up until you delete them, and stay editable.',
  },
};

// ── First-run guided tour. Kept to 9 short slides. ─────────────────────────
export const WALKTHROUGH = [
  {
    icon: '📺',
    title: 'This is your Range TV remote',
    body: [
      'Welcome. This one screen controls the TV at the range.',
      'The tour is quick, about nine screens. You can skip it and re-open it anytime from the "? Guide" button at the top.',
    ],
  },
  {
    icon: '🛰️',
    title: 'How it reaches the TV',
    body: [
      'The TV itself has no buttons or menus. It shows whatever this panel tells it to.',
      'When you press Save, the change travels over the internet and the TV updates on its own within a few seconds. You never walk over and touch the screen.',
    ],
  },
  {
    icon: '🗂️',
    title: 'The tabs on the left',
    body: [
      'Each tab is one thing you can control: the bell schedule, the featured team, the photos, the announcements, and so on.',
      'They are grouped: EVERYDAY settings, the RANGE screen program, and the URGENT one (Emergency Push).',
    ],
  },
  {
    icon: '⏱️',
    title: 'The Range TV runs on the school clock',
    body: [
      'During the school day the Range TV changes itself period by period. It knows the bell schedule and the time, and it switches between a planning-period screen, a T2 screen, first-lunch screens, a per-company welcome, and a "period ending" warning.',
      'You do not switch these by hand. You set the wording and the period-to-company assignments once on the Schedule Editor tab, and the TV does the rest.',
    ],
  },
  {
    icon: '👋',
    title: 'Why it shows a welcome screen for ~20 minutes',
    body: [
      'For roughly the first 20 minutes of a period, the company assigned to that period is still arriving and getting settled. The TV shows that company a welcome plus a "1SGT, take attendance now" reminder.',
      'After that window it switches to the normal rotation. You can change the length and the wording on the Schedule Editor tab.',
    ],
  },
  {
    icon: '💾',
    title: 'Nothing goes live until you Save',
    body: [
      'Make all the changes you want across the tabs. They are held as a draft. The TV does not see them yet.',
      'A small "Unsaved changes" dot appears while you have edits pending. The big gold SAVE button at the bottom pushes everything at once.',
      'Two tabs are different: Announcements and Notes from Staff save each item the moment you add or edit it, and the Rotation Screen tab has its own Save button.',
    ],
  },
  {
    icon: '📌',
    title: 'Announcements stay put',
    body: [
      'On the Announcements tab, press "+ ADD" to post one. It saves right then and shows in the list below.',
      'Every announcement stays up until you delete it, and every one has an EDIT button. The main gold Save button does not touch this list, so pressing it will never wipe your announcements.',
    ],
  },
  {
    icon: '🟢',
    title: 'Checking what is on the TV',
    body: [
      'The green "LIVE NOW" card near the top always shows what the real TV is displaying this second, not your draft.',
      '"Show Live View" embeds the actual screen so you can watch it. "Test a date/time" opens the screen as it would look at any moment you pick, without touching the real TV.',
    ],
  },
  {
    icon: '✅',
    title: 'You are set',
    body: [
      'That is the whole panel. Edit a tab, press Save, confirm it on the Live view.',
      'The "? Guide" button re-opens a full written reference, including the complete Range TV timeline. When new features are added here you will get a short "What\'s new" popup the next time you log in.',
    ],
  },
];

// ── Full reference behind "? Guide". Each section: heading + array of blocks. ─
// A block is a string (paragraph) or { list: [...] } (bulleted list).
export const GUIDE_SECTIONS = [
  {
    heading: 'The basic idea',
    blocks: [
      'The TV at the range is a plain display. It has no menu and nobody needs to physically touch it. This panel is the only way its content changes.',
      'When you press Save, your changes are sent out over the internet and the TV refreshes itself within a few seconds. If the TV is off at the time, it picks up the latest settings as soon as it powers back on.',
    ],
  },
  {
    heading: 'Making and saving a change',
    blocks: [
      'Open a tab on the left. Make your edits. They are a draft until you Save, and a small "Unsaved changes" marker appears next to the Save button.',
      'The gold "SAVE, PUSH TO RANGE" button at the bottom sends the whole draft to the TV at once. You will see a green "Pushed" confirmation.',
      'Three tabs do not use that button. The Rotation Screen tab has its own Save button. The Announcements and Notes from Staff tabs save each item as you add, edit, or delete it.',
    ],
  },
  {
    heading: 'Announcements and Notes from Staff',
    blocks: [
      'These two tabs are lists, not settings. Press "+ ADD", type a title and a message, and it posts immediately.',
      'Everything you post stays up until you delete it. Nothing here expires on its own.',
      'Every item has an EDIT button. You can change the wording of any announcement at any time and it updates on the TV within seconds.',
      'The main gold Save button has no effect on these lists. Pressing it will not clear, reset, or hide anything you posted here.',
    ],
  },
  {
    heading: 'How the Range TV runs itself',
    blocks: [
      'During the school day the Range TV does not sit on one screen. It reads the bell schedule and the current time and shows the right screen for the moment. You never switch these by hand.',
      'Outside school hours it shows a before-school or after-school screen. Between classes, during a passing period, it shows the normal rotation.',
      'While a class period is running, it shows one of these:',
      { list: [
        'Planning period (1st period): a planning screen with a countdown.',
        'T2 Block: the T2 screen.',
        '3rd period: the Staff Schedule screen.',
        '4th period: the First Lunch screen while first lunch is running, then Bravo\'s welcome for about 20 minutes after lunch ends.',
        '2nd, 5th, 6th period: that period\'s company welcome for about the first 20 minutes, then the normal rotation.',
        'Last 5 minutes of 2nd, 4th, 5th, 6th, and T2 Block: a "period ending" warning. 1st and 3rd keep their own screens through the bell instead.',
      ] },
      'The company shown for each period comes from the period-to-company list on the Schedule Editor tab (by default 2nd is Alpha, 3rd is Staff and Command, 4th is Bravo, 5th is Charlie, 6th is Delta).',
    ],
  },
  {
    heading: 'Why the welcome screen runs for about 20 minutes',
    blocks: [
      'For roughly the first 20 minutes of a period the company assigned to it is still walking in and getting settled. During that window the TV shows that company a welcome message and a "1SGT, take attendance now" reminder.',
      'Once that window is over, everyone is in and the TV drops back to the normal rotation (announcements, notes, photos, the bottom widget, and the slideshow if you use one).',
      'You control this on the Schedule Editor tab: the length of the window, the welcome wording, and the attendance reminder text. Use "Test a date/time" at the top of the panel to jump into any period and see exactly what will be on the screen.',
    ],
  },
  {
    heading: 'The rotation screen',
    blocks: [
      'The rotation is what the TV shows between all those timed screens. It has two modes, set on the Rotation Screen tab.',
      'Grid shows several panels at once (announcements, notes, photos, and so on). Slideshow cycles full-screen single-purpose slides one at a time, which reads better from across the room.',
      'If you choose Slideshow, add an "Announcements" slide to it so the announcements you post still appear.',
    ],
  },
  {
    heading: 'Seeing what is live',
    blocks: [
      'The green "LIVE NOW" card near the top reads the real screen, never your draft, so it is always trustworthy even mid-edit.',
      '"Show Live View" embeds the actual TV page, rendering for real at one-third size.',
      '"Test a date/time" opens the screen in a new tab as it would appear at a moment you choose, then ticks forward from there. It is view-only and never affects the real TV.',
    ],
  },
  {
    heading: 'Emergency Push',
    blocks: [
      'The red tab. It is for information people must see immediately: a same-day cancellation, a room move, a drill note.',
      'It puts a full-screen message, optionally with a photo, over whatever the screen is showing. It goes live the moment you push it. It does not wait for the main Save button.',
      'It stays up until you turn it off from that same tab. Clear it once the message no longer applies.',
    ],
  },
  {
    heading: 'When things change here',
    blocks: [
      'New controls get added to this panel over time. Each time that happens you get a short "What\'s new" popup the next time you open DISPATCH, listing exactly what changed.',
      'You can always re-open this guide, or replay the tour, from the "? Guide" button at the top of the panel.',
    ],
  },
];
