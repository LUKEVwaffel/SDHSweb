import SlideNoticeList from './SlideNoticeList.jsx';

// Full-bleed version of the grid board's "Announcements" tile — same
// tv_notices data (StepRangeNotices.jsx is still the only place titles/
// messages get typed), just given the whole screen instead of one column,
// since a slide's entire reason to exist is to not compete with anything
// else for room.
export default function SlideAnnouncements({ announcements, style, onEmpty }) {
  return (
    <SlideNoticeList
      notices={announcements}
      heading="ANNOUNCEMENTS"
      emptyLabel="No announcements posted."
      style={style}
      onEmpty={onEmpty}
    />
  );
}
