// Single source of truth for the /tv carousel's on-screen aspect ratio.
// TvKiosk.jsx splits the screen into a 68%-width carousel column and a
// 32%-width widget column (gridTemplateColumns: '68% 32%'), with a top strip
// above both (TvTopStrip.jsx — 40px schedule row + an optional 30px
// "upcoming" row). That makes the carousel noticeably squarer than a raw
// 16:9 frame, which is the actual cause of bad crops on portrait/full-body
// photos: object-position: center in that ratio loses more top/bottom than
// people expect from a "TV carousel."
//
// Computed against a 1920x1080 reference TV with both top-strip rows visible
// (the common case — most school days have at least one upcoming event):
//   carousel width  = 0.68 * 1920 = 1305.6
//   carousel height = 1080 - 70   = 1010
// Any future layout change to the 68/32 split or the top strip height should
// update this constant so the carousel and the focal-point picker preview
// never drift apart.
export const TV_CAROUSEL_ASPECT_RATIO = 1305.6 / 1010; // ≈ 1.293 (width / height)
