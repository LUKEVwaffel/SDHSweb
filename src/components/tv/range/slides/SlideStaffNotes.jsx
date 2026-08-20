import SlideNoticeList from './SlideNoticeList.jsx';

// Full-screen version of the Grid Layout's "staffnotes" tile — ported over
// to the slideshow-only rotation. Same tv_notices data (staff_note category,
// StepRangeNotices.jsx), full screen instead of one column.
export default function SlideStaffNotes({ staffNotes, style, onEmpty }) {
  return (
    <SlideNoticeList
      notices={staffNotes}
      heading="NOTES FROM STAFF"
      emptyLabel="No notes from staff."
      style={style}
      onEmpty={onEmpty}
    />
  );
}
