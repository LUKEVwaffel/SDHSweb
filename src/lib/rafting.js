// Shared constants + helpers for the rafting trip photo set.
// DISPATCH panel (RaftingPanel.jsx) writes; the /rafting gallery
// (RaftingGallery.jsx) and the homepage RaftingPhotoBand read.

export const RAFTING_BUCKET = 'rafting-photos';

// Headline + one-liner for the /rafting gallery and the homepage band.
// Kept here (not a DB row) so there's a single place to reword it.
export const RAFTING_TITLE = 'RAFTING TRIP';
export const RAFTING_BLURB =
  "Photos from the battalion rafting trip. Tap any shot to open it full-screen.";

// Upload cap — generous; a whole trip fits. Bump if a set ever runs longer.
export const RAFTING_MAX_PHOTOS = 300;
