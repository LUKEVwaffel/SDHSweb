import TvCongratsScreen from '../../TvCongratsScreen.jsx';

// Rotation slide — the full Raider Team Congrats takeover, the exact board
// /tv renders (TvCongratsScreen: latest comp's podium list + live OPTIC photo
// carousel). Self-contained: it owns its own data hooks (comp poll winner +
// useOpticPhotos pinned to OPTIC_EVENT_ID), so it needs none of the
// rotation-level props the other slides take. TvCongratsScreen is already
// `position: fixed; inset: 0`, so it fills the slideshow's fixed-inset stage
// on its own.
export default function SlideRaiderCongrats() {
  return <TvCongratsScreen />;
}
