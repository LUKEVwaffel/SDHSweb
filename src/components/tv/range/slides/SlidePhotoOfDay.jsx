import { useTvCarouselPhotos } from '../../../../hooks/useTvCarouselPhotos.js';
import TvPhotoCarousel from '../../TvPhotoCarousel.jsx';

// Full-screen version of the Grid Layout's "photo" tile — same carousel
// component and photo-source resolution as the Photo Source tab controls.
// useTvCarouselPhotos always falls back to a hardcoded set when the real
// source has nothing, so this slide never has a genuine empty state to
// report back to the rotation.
export default function SlidePhotoOfDay({ settings }) {
  const { photos } = useTvCarouselPhotos(settings);
  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <TvPhotoCarousel photos={photos} />
    </div>
  );
}
