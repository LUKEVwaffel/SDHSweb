// Shared source of truth for the OPTIC parent survey. The route component
// (src/components/OpticSurvey.jsx) and any future admin review view import
// from here so prompt text and option slugs never drift. The slugs in
// QUESTIONS must match the CHECK constraints in supabase/optic_survey.sql
// exactly. Keep both in sync if a question changes.
//
// Every real question is multiple choice. TEXT_QUESTIONS are optional
// "add detail if you want" boxes at the end, none required. CAMPAIGN_ID tags
// every row and drives the once-per-device "already sent" screen. Bump it to
// run a fresh round, same idea as bumping a cache key.
//
// 2026-09 Spring Hill round: this round exists to chase two known problems
// (push notifications did not reliably fire; the iOS save-to-photos fix did
// not actually fix it) plus whatever else broke, not to re-litigate "should
// OPTIC exist" (the prior round already answered that at 100%). Kept
// deliberately shorter than the 2026-09-08 round: 5 questions + 1 optional
// text box instead of 11 + 4.

export const CAMPAIGN_ID = 'optic-springhill-2026-09';

export const INTRO = {
  kicker: 'OPTIC · SPRING HILL FEEDBACK',
  title: 'Quick one. Tell us what broke.',
  paragraphs: [
    'Thanks for using OPTIC at Spring Hill. This is a short one, not the big survey from last time.',
    'We already know two things did not work right: notifications did not reliably go out, and the fix we thought would make saving photos work on iPhone did not actually fix it. We want to know exactly what you saw so the next fix actually holds.',
    'About a minute. Only the first question and your phone type are required.',
  ],
  meta: 'About one minute. Every question is multiple choice. Only the first question and your phone type are required, everything else is optional.',
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

// Every question is multiple choice, one tap each. `required: true` blocks
// submit until answered (only `overall` uses it; phone type is the other gate
// and lives in the identity block). Slugs must match optic_survey.sql.
export const QUESTIONS = [
  {
    id: 'overall',
    prompt: 'Overall, how did OPTIC work for you at Spring Hill?',
    required: true,
    options: [
      { value: 'rough', label: 'Rough' },
      { value: 'meh', label: 'Meh' },
      { value: 'decent', label: 'Decent' },
      { value: 'worked_well', label: 'Worked well' },
      { value: 'loved_it', label: 'Loved it' },
      { value: 'did_not_use', label: 'I did not use it' },
    ],
  },
  {
    id: 'notif_experience',
    prompt: 'Did OPTIC notifications work for you?',
    options: [
      { value: 'got_alerts', label: 'Turned them on, got alerts' },
      { value: 'turned_on_no_alerts', label: 'Turned them on, never got one' },
      { value: 'tried_couldnt', label: 'Tried to turn them on, could not' },
      { value: 'never_saw_option', label: "Never saw a way to turn them on" },
      { value: 'didnt_try', label: 'Did not try' },
    ],
  },
  {
    id: 'save_photo',
    prompt: 'Did you try to save a photo from the feed to your phone?',
    options: [
      { value: 'yes_worked', label: 'Yes, it worked' },
      { value: 'yes_failed', label: 'Yes, it did not work' },
      { value: 'didnt_try', label: 'Did not try' },
    ],
  },
  {
    id: 'team_filter_useful',
    prompt: 'The feed had a filter for Male / Coed team. Was that useful?',
    options: [
      { value: 'very', label: 'Very' },
      { value: 'somewhat', label: 'Somewhat' },
      { value: 'not_really', label: 'Not really' },
      { value: 'didnt_notice', label: 'Did not notice it' },
    ],
  },
  {
    id: 'biggest_problem',
    prompt: 'What gave you the most trouble?',
    options: [
      { value: 'notifications', label: 'Notifications' },
      { value: 'saving_photos', label: 'Saving photos to my phone' },
      { value: 'uploading', label: 'Uploading photos' },
      { value: 'feed_empty_or_slow', label: 'Feed empty or slow to update' },
      { value: 'install', label: 'Adding it to my home screen' },
      { value: 'none', label: 'Nothing, it was smooth' },
      { value: 'other', label: 'Something else' },
    ],
  },
];

// Optional written box at the end. NOT required. One box, not four, on
// purpose, this round is meant to be fast.
export const TEXT_QUESTIONS = [
  {
    id: 'anything_else',
    label: 'Anything else? Bugs, exact steps that broke, ideas, all of it.',
    example:
      'Turned on notifications on my iPhone but never got one, even after new photos posted. Tried to save a photo and it just opened a new tab instead of going to my camera roll.',
  },
];

// Read-only archive of past rounds' own question sets, keyed by campaign_id.
// Each round can change QUESTIONS/TEXT_QUESTIONS freely (as this file's own
// history shows), so the live form above only ever needs the current round.
// The DISPATCH panel's campaign switcher needs the OLD shape too, to render
// a correct breakdown against old rows instead of matching them against
// whatever QUESTIONS looks like today. Never used by OpticSurvey.jsx itself.
export const PAST_ROUNDS = {
  'optic-return-2026-09': {
    label: 'Rhea County · pre-2.0 "bring it back?" round',
    questions: [
      {
        id: 'overall',
        prompt: 'Overall, how well did OPTIC work for you at the Rhea County competition?',
        options: [
          { value: 'rough', label: 'Rough' },
          { value: 'meh', label: 'Meh' },
          { value: 'decent', label: 'Decent' },
          { value: 'worked_well', label: 'Worked well' },
          { value: 'loved_it', label: 'Loved it' },
          { value: 'did_not_use', label: 'I did not use it' },
        ],
      },
      {
        id: 'used_it',
        prompt: 'How much did you end up using OPTIC?',
        options: [
          { value: 'a_lot', label: 'A lot' },
          { value: 'a_little', label: 'A little' },
          { value: 'saw_it_only', label: 'Saw it, did not use it' },
          { value: 'didnt_know', label: 'Did not know about it' },
        ],
      },
      {
        id: 'install',
        prompt: 'Did you add OPTIC to your phone home screen?',
        options: [
          { value: 'yes_easy', label: 'Yes, easily' },
          { value: 'yes_confusing', label: 'Yes, but it was confusing' },
          { value: 'tried_failed', label: 'Tried, could not' },
          { value: 'didnt_try', label: 'Did not try' },
          { value: 'didnt_know', label: 'Did not know I could' },
        ],
      },
      {
        id: 'upload',
        prompt: 'Did you upload photos?',
        options: [
          { value: 'yes_fine', label: 'Yes, no problem' },
          { value: 'yes_problems', label: 'Yes, but hit problems' },
          { value: 'tried_failed', label: 'Tried, could not' },
          { value: 'didnt_try', label: 'Did not try' },
        ],
      },
      {
        id: 'save_photo',
        prompt: 'Did you try to save a photo from the feed to your phone?',
        options: [
          { value: 'yes_worked', label: 'Yes, it worked' },
          { value: 'yes_failed', label: 'Yes, it did not work' },
          { value: 'didnt_try', label: 'Did not try' },
        ],
      },
      {
        id: 'feed_value',
        prompt: 'One shared feed with every team photos in it. How valuable is that to you?',
        options: [
          { value: 'very', label: 'Very' },
          { value: 'somewhat', label: 'Somewhat' },
          { value: 'not_really', label: 'Not really' },
        ],
      },
      {
        id: 'trouble_area',
        prompt: 'Where did OPTIC give you the most trouble?',
        options: [
          { value: 'home_screen', label: 'Adding it to the home screen' },
          { value: 'uploading', label: 'Uploading photos' },
          { value: 'saving_photos', label: 'Saving photos to my phone' },
          { value: 'finding_cadet', label: 'Finding my cadet in the feed' },
          { value: 'none', label: 'Nothing, it was smooth' },
          { value: 'other', label: 'Something else' },
        ],
      },
      {
        id: 'best_part',
        prompt: 'What was the most useful part of OPTIC?',
        options: [
          { value: 'shared_feed', label: 'The shared live feed' },
          { value: 'events_i_missed', label: 'Photos from events I missed' },
          { value: 'easy_upload', label: 'Easy uploading' },
          { value: 'one_place', label: 'Everything in one place' },
          { value: 'none', label: 'Nothing stood out' },
          { value: 'other', label: 'Something else' },
        ],
      },
      {
        id: 'top_change',
        prompt: 'What would make OPTIC better for next time?',
        options: [
          { value: 'filter_by_team', label: 'Filter the feed by team' },
          { value: 'faster_posting', label: 'Photos posted faster' },
          { value: 'easier_install', label: 'Easier home screen install' },
          { value: 'notifications', label: 'A buzz when new photos post' },
          { value: 'downloads', label: 'Download a batch of photos at once' },
          { value: 'nothing_major', label: 'Nothing major' },
          { value: 'other', label: 'Something else' },
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
        prompt: 'Would you want us to bring OPTIC back for the Raider competitions coming up?',
        options: [
          { value: 'definitely', label: 'Definitely' },
          { value: 'probably', label: 'Probably' },
          { value: 'not_sure', label: 'Not sure' },
          { value: 'no', label: 'No' },
        ],
      },
    ],
    textQuestions: [
      { id: 'confusing', label: 'Anything that was confusing or broke? Walk me through it.' },
      { id: 'best_part_text', label: 'In your own words, what was the best part?' },
      { id: 'one_change', label: 'One thing you would change or add before the next comp?' },
      { id: 'anything_else', label: 'Anything else. Bugs, ideas, complaints, all of it.' },
    ],
  },
};
