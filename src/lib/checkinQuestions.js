// Shared source of truth for the site check-in survey — both
// CheckinSurvey.jsx (public popup) and admin/panels/CheckinPanel.jsx (Luke's
// review view) import this so question text, option slugs, and labels never
// drift out of sync. The slugs here must match the CHECK constraints in
// supabase/site_checkin.sql exactly.
//
// CAMPAIGN_ID gates the once-per-device popup (see checkinSeen.js). Bump it
// to a new value to run a fresh round — every device becomes eligible again,
// same as bumping a cache key. That's the "twice a quarter" cadence in
// practice: a deliberate code change + deploy, not an on-page timer.
export const CAMPAIGN_ID = 'checkin-2026-08';

// describeOn on a question: { [optionValue]: { required, placeholder } } —
// selecting that option reveals an inline text box (see CheckinSurvey.jsx).
// 'other' entries are required (an unspecified "other" is useless data);
// the negative-tail entries on findability/design_rating are optional asks
// for more detail, per "want as much feedback as I can get".
export const QUESTIONS = [
  {
    id: 'discover',
    prompt: 'How did you first hear about this site?',
    options: [
      { value: 'word_of_mouth', label: 'A cadet or parent told me' },
      { value: 'event_qr', label: 'JROTC event / QR code' },
      { value: 'search', label: 'Search engine' },
      { value: 'other', label: 'Other' },
    ],
    describeOn: {
      other: { required: true, placeholder: 'How did you find us?' },
    },
  },
  {
    id: 'frequency',
    prompt: 'How often do you visit this site?',
    options: [
      { value: 'first_time', label: 'First time here' },
      { value: 'weekly', label: 'About weekly' },
      { value: 'monthly', label: 'About monthly' },
      { value: 'few_times_year', label: 'A few times a year' },
    ],
  },
  {
    id: 'purpose',
    prompt: 'What do you come here for most?',
    options: [
      { value: 'events_calendar', label: 'Event info / calendar' },
      { value: 'photos', label: 'Photos' },
      { value: 'cadet_manual', label: 'Cadet manual / resources' },
      { value: 'staff_contacts', label: 'Staff contacts' },
      { value: 'news_updates', label: 'News / updates' },
      { value: 'other', label: 'Other' },
    ],
    describeOn: {
      other: { required: true, placeholder: 'What are you looking for?' },
    },
  },
  {
    id: 'findability',
    prompt: 'How easy is it to find what you’re looking for?',
    options: [
      { value: 'very_easy', label: 'Very easy' },
      { value: 'easy', label: 'Easy' },
      { value: 'neutral', label: 'Neutral' },
      { value: 'hard', label: 'Hard' },
      { value: 'very_hard', label: 'Very hard' },
    ],
    describeOn: {
      hard: { required: false, placeholder: 'What were you trying to find?' },
      very_hard: { required: false, placeholder: 'What were you trying to find?' },
    },
  },
  {
    id: 'design_rating',
    prompt: 'How would you rate the overall look and feel?',
    options: [
      { value: 'excellent', label: 'Excellent' },
      { value: 'good', label: 'Good' },
      { value: 'average', label: 'Average' },
      { value: 'poor', label: 'Poor' },
      { value: 'very_poor', label: 'Very poor' },
    ],
    describeOn: {
      poor: { required: false, placeholder: 'What would you change?' },
      very_poor: { required: false, placeholder: 'What would you change?' },
    },
  },
  {
    id: 'mobile',
    prompt: 'How well does the site work on your phone?',
    options: [
      { value: 'great', label: 'Great' },
      { value: 'ok', label: 'OK' },
      { value: 'poor', label: 'Poor' },
      { value: 'havent_tried', label: "Haven't tried on mobile" },
    ],
  },
  {
    id: 'speed',
    prompt: 'How fast does the site feel?',
    options: [
      { value: 'fast', label: 'Fast' },
      { value: 'acceptable', label: 'Acceptable' },
      { value: 'slow', label: 'Slow' },
      { value: 'very_slow', label: 'Very slow' },
    ],
  },
  {
    id: 'useful_section',
    prompt: 'Which section is most useful to you?',
    options: [
      { value: 'events', label: 'Events' },
      { value: 'photos', label: 'Photos' },
      { value: 'cadet_manual', label: 'Cadet Manual' },
      { value: 'raiders_rifle', label: 'Raiders / Rifle team' },
      { value: 'staff_directory', label: 'Staff directory' },
      { value: 'none', label: 'None in particular' },
    ],
  },
  {
    id: 'recommend',
    prompt: 'Would you recommend this site to another JROTC family or cadet?',
    options: [
      { value: 'definitely', label: 'Definitely' },
      { value: 'probably', label: 'Probably' },
      { value: 'not_sure', label: 'Not sure' },
      { value: 'probably_not', label: 'Probably not' },
    ],
  },
  {
    id: 'improve',
    prompt: 'What would improve your experience the most?',
    options: [
      { value: 'more_photos', label: 'More photos / media' },
      { value: 'easier_navigation', label: 'Easier navigation' },
      { value: 'more_event_details', label: 'More event details' },
      { value: 'faster_loading', label: 'Faster loading' },
      { value: 'better_mobile', label: 'Better mobile experience' },
      { value: 'nothing_needed', label: 'Nothing — it’s good' },
    ],
  },
];

export function labelFor(questionId, value) {
  const q = QUESTIONS.find((q) => q.id === questionId);
  return q?.options.find((o) => o.value === value)?.label || value;
}
