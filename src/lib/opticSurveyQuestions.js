// Shared source of truth for the OPTIC parent survey. The route component
// (src/components/OpticSurvey.jsx) and any future admin review view import
// from here so prompt text and option slugs never drift. The slugs in
// QUESTIONS must match the CHECK constraints in supabase/optic_survey.sql
// exactly. Keep both in sync if a question changes.
//
// Every real question is multiple choice. TEXT_QUESTIONS are a few optional
// "add detail if you want" boxes at the end, none required. CAMPAIGN_ID tags
// every row and drives the once-per-device "already sent" screen. Bump it to
// run a fresh round, same idea as bumping a cache key.

export const CAMPAIGN_ID = 'optic-return-2026-09';

// The thank-you screen shown before the questions. Kept here (not buried in
// JSX) so the copy is easy to find and edit between rounds. OPTIC has not run
// in a while, so this round is a "should we bring it back" ask, not a
// day-after debrief.
export const INTRO = {
  kicker: 'OPTIC · RAIDER FAMILIES',
  title: 'Thank you, and a quick question.',
  paragraphs: [
    'Everything this program does traces back to Raider families. The early mornings, the drives, the gear, the fundraisers, the years of showing up. We brought home five trophies at the Rhea County competition, and that does not happen without your trucks hauling equipment, your cadets putting in the work, and the food you send to keep the team going. Thank you.',
    'We ran OPTIC as a beta at the Rhea County Raider Competition: one shared photo feed every parent could upload to and pull pictures from. That was the whole test. We will not run it again unless it is worth it, so we need to know whether we should.',
    'This is quick and every question is a tap. Tell us how it went for you, whether you would use it again, and what would make it better.',
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
    prompt: 'Overall, how well did OPTIC work for you at the Rhea County competition?',
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
];

// Optional written boxes at the end. NONE of these are required. They are for
// parents who want to add detail the multiple choice cannot capture. Each one
// ships with a concrete "good answer" example so a parent who does write puts
// down a sentence instead of one word.
export const TEXT_QUESTIONS = [
  {
    id: 'confusing',
    label: 'Anything that was confusing or broke? Walk me through it.',
    example:
      'Adding it to my home screen on iPhone. I tapped share but did not see "Add to Home Screen" until I scrolled. Saving a photo just opened a new tab instead of going to my camera roll.',
  },
  {
    id: 'best_part_text',
    label: 'In your own words, what was the best part?',
    example:
      'Sitting with the male team but still seeing the coed team runs come in live. I got photos of events I was not even standing at.',
  },
  {
    id: 'one_change',
    label: 'One thing you would change or add before the next comp?',
    example: 'A way to filter the feed down to just my cadet team.',
  },
  {
    id: 'anything_else',
    label: 'Anything else. Bugs, ideas, complaints, all of it.',
    example: '',
  },
];
