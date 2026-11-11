export const NAV_GROUPS = [
  {
    heading: '',
    items: [
      { id: 'ai', icon: '◆', label: 'DISPATCH AI' },
      { id: 'ticketdelivery', icon: '◉', label: 'Ticket Delivery' },
    ],
  },
  {
    heading: 'CALENDAR',
    items: [
      { id: 'events',   icon: '◷', label: 'Events' },
      { id: 'aars',     icon: '▤', label: 'AAR Tracker' },
      { id: 'feedback', icon: '✎', label: 'Event Feedback' },
    ],
  },
  {
    heading: 'PEOPLE',
    items: [
      { id: 'people',       icon: '☰', label: 'People' },
      { id: 'boards',       icon: '★', label: 'Promotion Boards' },
      { id: 'portalaccess', icon: '⚷', label: 'Portal Access' },
    ],
  },
  {
    heading: 'COMMS',
    items: [
      { id: 'messages',  icon: '◈', label: 'Messages' },
      { id: 'poll',      icon: '◔', label: 'Poll Results' },
      { id: 'email',     icon: '✉', label: 'Email List' },
      { id: 'questions', icon: '?', label: 'FAQ Questions' },
    ],
  },
  {
    heading: 'SCREENS',
    items: [
      { id: 'presentations', icon: '▥', label: 'Presentations' },
      { id: 'tvremote',    icon: '▥', label: 'TV Remote' },
      { id: 'raidertv',    icon: '▶', label: 'Raider TV' },
      { id: 'photos',      icon: '⊞', label: 'Photos' },
      { id: 'media',       icon: '⊡', label: 'Media' },
      { id: 'checkin',     icon: '◔', label: 'Site Check-In' },
      { id: 'opticsurvey', icon: '◎', label: 'OPTIC Survey' },
    ],
  },
  {
    heading: 'MILITARY BALL',
    items: [
      { id: 'ball',        icon: '♛', label: 'Military Ball' },
      { id: 'ballallergy', icon: '⚕', label: 'Ball Allergies' },
    ],
  },
  {
    heading: 'PROGRAMS',
    items: [
      { id: 'riflesignups', icon: '⊙', label: 'Rifle Signups' },
      { id: 'halloween',    icon: '🎃', label: 'Halloween Movie Poll' },
    ],
  },
  {
    heading: 'SYSTEM',
    items: [
      { id: 'beta',     icon: '✦', label: 'Beta Features' },
      { id: 'advanced', icon: '⚙', label: 'Advanced', danger: true },
    ],
  },
  {
    heading: 'ACCOUNT',
    items: [
      { id: 'account', icon: '⚿', label: 'My Account' },
    ],
  },
];


export const SIDEBAR_RAIL_WIDTH=72;
export const SIDEBAR_EXPANDED_WIDTH=256;
export const SIDEBAR_CONTENT_OFFSET={expanded:280,rail:96,drawer:0};
export const groupIcon = heading => ({ CALENDAR:'calendar',PEOPLE:'people',COMMS:'comms',SCREENS:'screens','MILITARY BALL':'ball',PROGRAMS:'programs',SYSTEM:'system',ACCOUNT:'account' }[heading] || 'overview');
