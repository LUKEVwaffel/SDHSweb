// Shared source of truth for the OPTIC post-comp parent survey. The route
// component (src/components/OpticSurvey.jsx) and any future admin review view
// import from here so prompt text and option slugs never drift. The slugs in
// PILL_QUESTIONS must match the CHECK constraints in supabase/optic_survey.sql
// exactly — keep both in sync if a question changes.
//
// CAMPAIGN_ID tags every row and drives the once-per-device "already sent"
// screen. Bump it to run a fresh round after another competition — every
// device becomes eligible again, same idea as bumping a cache key.

export const CAMPAIGN_ID = 'optic-rhea-2026-08';

// The thank-you screen shown before the questions. Kept here (not buried in
// JSX) so the copy is easy to find and edit between events.
export const INTRO = {
  kicker: 'OPTIC · RHEA COUNTY RAIDER COMP',
  title: 'Before you start — thank you.',
  paragraphs: [
    'Today the battalion brought home five trophies. That does not happen without the people in the stands. The early mornings, the drives, the gear, the fundraisers, the years of showing up — everything this program is able to do traces back to Raider families. Thank you.',
    'And thank you to every parent who pulled out a phone and uploaded to OPTIC today. The volume is honestly staggering, and we are still working through all of it.',
    'By the middle of next week every photo will be posted on the Raider page, sorted cleanly by event, so you can find your cadet without scrolling past everything else.',
    'OPTIC ran as a beta today. This survey is how it becomes the real thing — something we run at every Raider competition this season. Be blunt and be specific. If something confused you or broke, that is exactly what needs to end up in here.',
  ],
  meta: 'About two minutes. Most of it is tapping. Only the first question and your phone type are required — everything else helps but is optional.',
};

// Identity block at the top of the form. All optional except phone type,
// which is the single most useful field for triaging a bug report.
export const RAIDER_TEAMS = [
  { value: 'male', label: 'Male team' },
  { value: 'coed', label: 'Coed team' },
  { value: 'both', label: 'Both' },
  { value: 'unsure', label: 'Not sure' },
];

export const PHONE_TYPES = [
  { value: 'iphone', label: 'iPhone' },
  { value: 'android', label: 'Android' },
  { value: 'other', label: 'Other' },
];

// Quick multiple-choice questions — pills, one tap each. `required: true`
// blocks submit until answered (only `overall` uses it; phone type is the
// other gate and lives in the identity block).
export const PILL_QUESTIONS = [
  {
    id: 'overall',
    prompt: 'Overall, how well did OPTIC work for you today?',
    required: true,
    options: [
      { value: 'rough', label: 'Rough' },
      { value: 'meh', label: 'Meh' },
      { value: 'decent', label: 'Decent' },
      { value: 'worked_well', label: 'Worked well' },
      { value: 'loved_it', label: 'Loved it' },
    ],
  },
  {
    id: 'install',
    prompt: 'Did you add OPTIC to your phone’s home screen?',
    options: [
      { value: 'yes_easy', label: 'Yes, easily' },
      { value: 'yes_confusing', label: 'Yes, but it was confusing' },
      { value: 'tried_failed', label: 'Tried, couldn’t' },
      { value: 'didnt_try', label: 'Didn’t try' },
      { value: 'didnt_know', label: 'Didn’t know I could' },
    ],
  },
  {
    id: 'upload',
    prompt: 'Did you upload photos?',
    options: [
      { value: 'yes_fine', label: 'Yes, no problem' },
      { value: 'yes_problems', label: 'Yes, but hit problems' },
      { value: 'tried_failed', label: 'Tried, couldn’t' },
      { value: 'didnt_try', label: 'Didn’t try' },
    ],
  },
  {
    id: 'save_photo',
    prompt: 'Did you try to save a photo from the feed to your phone?',
    options: [
      { value: 'yes_worked', label: 'Yes, it worked' },
      { value: 'yes_failed', label: 'Yes, it didn’t work' },
      { value: 'didnt_try', label: 'Didn’t try' },
    ],
  },
  {
    id: 'feed_value',
    prompt: 'Seeing every team’s photos in one shared feed — how valuable is that to you?',
    options: [
      { value: 'very', label: 'Very' },
      { value: 'somewhat', label: 'Somewhat' },
      { value: 'not_really', label: 'Not really' },
    ],
  },
  {
    id: 'notify',
    prompt: 'If your phone buzzed when new photos were posted after an event, would you want that?',
    options: [
      { value: 'yes', label: 'Yes' },
      { value: 'maybe', label: 'Maybe' },
      { value: 'no', label: 'No' },
    ],
  },
  {
    id: 'will_return',
    prompt: 'Would you use OPTIC at every Raider comp this season?',
    options: [
      { value: 'definitely', label: 'Definitely' },
      { value: 'probably', label: 'Probably' },
      { value: 'not_sure', label: 'Not sure' },
      { value: 'probably_not', label: 'Probably not' },
    ],
  },
];

// Free-text questions. Every one ships with a concrete "good answer" example
// so parents write a sentence instead of one word — same approach as the
// cadet event-feedback form.
export const TEXT_QUESTIONS = [
  {
    id: 'confusing',
    label: 'Walk me through anything that was confusing or didn’t work. The more detail the better.',
    example:
      '"Adding it to my home screen on my iPhone — I tapped the share button but didn’t see ‘Add to Home Screen’ until I scrolled down. Later, saving a photo just opened it in a new tab instead of going to my camera roll."',
  },
  {
    id: 'best_part',
    label: 'What was the best part of using OPTIC today?',
    example:
      '"Sitting with the male team but still seeing the coed team’s runs come in live. I got photos of events I wasn’t even standing at."',
  },
  {
    id: 'one_change',
    label: 'If you could change or add ONE thing before the next comp, what would it be?',
    example: '"A way to filter the feed down to just my cadet’s team."',
  },
  {
    id: 'install_help',
    label: 'The home-screen install steps — what would have made them clearer?',
    example:
      '"A short screen recording for iPhone. The written steps were fine, but I wasn’t sure I did it right until the icon showed up."',
  },
  {
    id: 'anything_else',
    label: 'Anything else — bugs, ideas, complaints, all of it.',
    example: '',
  },
];
