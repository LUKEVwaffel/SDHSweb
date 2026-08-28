// ============================================================================
// TV REMOTE CHANGELOG
//
// Every time you add or change something in the TV Remote that the Battalion
// Commander should know about, add ONE entry to the TOP of the array below.
//
//   1. Copy the newest entry as a template.
//   2. Bump `version` by 1 (must be the highest number in the file).
//   3. Set `date` to today (YYYY-MM-DD).
//   4. Write a short `title` and 2-5 plain-language `points`.
//   5. Commit it in the SAME commit as the feature.
//
// On his next login the BC sees a "What's new" popup listing every entry with a
// version higher than the one he last acknowledged, then his last-seen version
// is bumped to the latest automatically. No SQL, no dashboard step.
//
// Keep `points` non-technical - "You can now pick which photos show on the
// Range TV", not "Added photo_source_mode enum".
// ============================================================================

export const TV_REMOTE_CHANGELOG = [
  {
    version: 1,
    date: '2026-08-28',
    title: 'Your TV Remote portal is live',
    points: [
      'You now have your own DISPATCH login that controls the Range TVs.',
      'Everything you need is on one screen - pick a screen, make changes, press Save, and it hits the TV in a few seconds.',
      'Emergency Push lets you put a full-screen message on the TVs instantly for same-day changes.',
      'A guided tour runs the first time you open this. Re-open it anytime with the "? Guide" button up top.',
    ],
  },
];

// Highest version number in the changelog. Derived, so you never have to keep a
// second constant in sync - just add the entry above.
export const TV_REMOTE_LATEST_VERSION = TV_REMOTE_CHANGELOG.reduce(
  (max, e) => (e.version > max ? e.version : max),
  0,
);

// Entries newer than `sinceVersion`, newest first - what the "What's new" popup
// renders.
export function changelogSince(sinceVersion) {
  return TV_REMOTE_CHANGELOG
    .filter((e) => e.version > sinceVersion)
    .sort((a, b) => b.version - a.version);
}
