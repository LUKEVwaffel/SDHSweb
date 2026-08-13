// Canonical Cadet Creed text — verbatim from cadet-manual.pdf, page 6.
// Single source of truth for every /creed game. "mantel" spelling matches
// the published PDF exactly; do not "correct" it to "mantle" here.
export const CREED_LINES = [
  { id: 0, text: 'I am an Army Junior ROTC Cadet.' },
  { id: 1, text: 'I will always conduct myself to bring credit to my family, country, school and the Corps of Cadets.' },
  { id: 2, text: 'I am loyal and patriotic. I am the future of the United States of America.' },
  { id: 3, text: 'I do not lie, cheat or steal and will always be accountable for my actions and deeds.' },
  { id: 4, text: 'I will always practice good citizenship and patriotism.' },
  { id: 5, text: 'I will work hard to improve my mind and strengthen my body.' },
  { id: 6, text: 'I will seek the mantel of leadership and stand prepared to uphold the Constitution and the American way of life.' },
  { id: 7, text: 'May God grant me the strength to always live by this creed.' },
];

export const CREED_FULL_TEXT = CREED_LINES.map(l => l.text).join(' ');

// Word tokens per line, punctuation stripped from the comparison form but
// kept in `raw` for display. Used by fill-blank, scramble, and recall diffing.
export function tokenizeLine(text) {
  return text.split(/\s+/).map((raw, i) => ({
    idx: i,
    raw,
    clean: raw.replace(/[.,]/g, ''),
  }));
}

export const CREED_TOKENIZED = CREED_LINES.map(l => ({
  id: l.id,
  text: l.text,
  words: tokenizeLine(l.text),
}));

export const CREED_WORD_COUNT = CREED_TOKENIZED.reduce((sum, l) => sum + l.words.length, 0);

// Lines with each word carrying a running global index across the whole
// creed — lets a single continuous stream of typed words (recall/speed
// games) be matched back to its line + position without a render-time lookup.
let _globalIdx = 0;
export const CREED_LINES_WITH_GLOBAL = CREED_TOKENIZED.map(line => ({
  id: line.id,
  words: line.words.map(w => ({ ...w, globalIdx: _globalIdx++ })),
}));

export const CREED_FLAT_WORDS = CREED_LINES_WITH_GLOBAL.flatMap(l => l.words);
