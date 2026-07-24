// Block registry for the email builder. Each type knows how to make a fresh
// instance; IDs are assigned on insert so @dnd-kit has stable sortable keys.

let counter = 0;
export function newId() {
  counter += 1;
  const rand = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
  return `blk_${Date.now().toString(36)}_${counter}_${rand}`;
}

export const BLOCK_TYPES = [
  { type: 'heading',    label: 'Heading',    icon: 'H',  make: () => ({ text: 'Section heading', level: 1 }) },
  { type: 'text',       label: 'Text',       icon: '¶',  make: () => ({ text: 'Write your message here…' }) },
  { type: 'image',      label: 'Image',      icon: '▣',  make: () => ({ url: '', alt: '', href: '' }) },
  { type: 'button',     label: 'Button',     icon: '⬒',  make: () => ({ label: 'Learn more', href: '' }) },
  { type: 'divider',    label: 'Divider',    icon: '—',  make: () => ({}) },
  { type: 'spacer',     label: 'Spacer',     icon: '↕',  make: () => ({ size: 'md' }) },
  { type: 'attachment', label: 'Attachment', icon: '📎', make: () => ({ url: '', filename: '', size: null }) },
];

const BY_TYPE = Object.fromEntries(BLOCK_TYPES.map((b) => [b.type, b]));

export function makeBlock(type) {
  const def = BY_TYPE[type];
  if (!def) return null;
  return { id: newId(), type, ...def.make() };
}

export function blockLabel(type) {
  return BY_TYPE[type]?.label || type;
}

// A sensible starter document for a brand-new message.
export function starterBlocks() {
  return [
    { id: newId(), type: 'heading', text: 'Battalion update', level: 1 },
    { id: newId(), type: 'text', text: 'Parents and cadets,\n\nWrite your announcement here.' },
  ];
}
