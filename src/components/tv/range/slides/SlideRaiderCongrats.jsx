import TvCongratsScreen from '../../TvCongratsScreen.jsx';

// Rotation slide — the full Raider Team Congrats takeover, the exact board
// /tv renders (TvCongratsScreen: Rhea County podium list + live OPTIC photo
// carousel). Self-contained: it owns its own data hooks (comp poll winner +
// useRheaPhotos), so it needs none of the rotation-level props the other
// slides take. TvCongratsScreen is already `position: fixed; inset: 0`, so it
// fills the slideshow's fixed-inset stage on its own.
export default function SlideRaiderCongrats() {
  return <TvCongratsScreen />;
}
