// Photo set for the /tv kiosk carousel. Reuses the same public-folder assets
// as RaiderCarousel. `title` is per-photo so a future non-Raiders photo set
// (DISPATCH-managed) can just vary this field instead of restructuring.
export const TV_PHOTOS = Array.from({ length: 9 }, (_, i) => ({
  src: `/images/raiders/raider-${i + 1}.jpg`,
  alt: `Raiders team photo ${i + 1}`,
  title: 'JROTC Raider Team',
}));
