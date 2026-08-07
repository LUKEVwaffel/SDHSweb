#!/usr/bin/env node
// One-time (re-runnable) build script: pulls Wikipedia's "On This Day"
// REST API for all 366 calendar days and bundles the result as static JSON
// for the /tv kiosk's historical-facts panel. Not part of the app runtime —
// the kiosk reads only the generated src/data/onThisDay.json, so it can
// never break on a network hiccup or a Wikipedia outage.
//
// Usage: node scripts/generate-on-this-day.mjs

import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.join(__dirname, '..', 'src', 'data', 'onThisDay.json');

const MAX_FACTS_PER_DAY = 5;
const REQUEST_DELAY_MS = 400;
const MAX_TEXT_LEN = 160;

// Wikimedia requests a descriptive User-Agent identifying the app + contact.
const HEADERS = {
  'User-Agent': 'TrojanBattalionTvKiosk/1.0 (lobby display, on-this-day facts; contact: site admin)',
  Accept: 'application/json',
};

// Days-in-month for a leap year (2024) so Feb 29 is included — 366 total days.
const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

// Serious/heavy subject matter gets deprioritized (not removed) so the panel
// leans toward lighter, quirkier facts when a day has a choice — this is the
// "fun tone over dry textbook facts" pass called for in the plan. Genuine
// joke-writing per fact isn't something a keyword script can honestly do, so
// this stays limited to selection + trimming, not fabricated humor.
const HEAVY_WORDS = /\b(died|death|killed|assassinat|massacre|war\b|genocide|bombing|attack|earthquake|tsunami|execut)/i;
const LIGHT_WORDS = /\b(first|invented|opened|record|founded|debut|premiere|launch|born|patented|released)/i;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cleanText(raw) {
  let text = raw.replace(/\s+/g, ' ').trim();
  if (text.length > MAX_TEXT_LEN) {
    text = text.slice(0, MAX_TEXT_LEN).replace(/\s+\S*$/, '') + '…';
  }
  return text;
}

function lightnessScore(text) {
  let score = 0;
  if (LIGHT_WORDS.test(text)) score += 1;
  if (HEAVY_WORDS.test(text)) score -= 1;
  return score;
}

async function fetchWithRetry(url, maxAttempts = 6) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch(url, { headers: HEADERS });
    if (res.ok) return res;
    if (res.status === 429 && attempt < maxAttempts) {
      const retryAfter = Number(res.headers.get('retry-after'));
      const backoffMs = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : 1000 * 2 ** attempt;
      await sleep(backoffMs);
      continue;
    }
    throw new Error(`HTTP ${res.status}`);
  }
  throw new Error('unreachable');
}

async function fetchDay(month, day) {
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  const url = `https://en.wikipedia.org/api/rest_v1/feed/onthisday/selected/${mm}/${dd}`;

  let res;
  try {
    res = await fetchWithRetry(url);
  } catch (err) {
    throw new Error(`${mm}-${dd}: ${err.message}`);
  }
  const json = await res.json();

  const facts = (json.selected ?? [])
    .filter((e) => typeof e.year === 'number' && e.text)
    .map((e) => ({ year: e.year, text: cleanText(e.text) }))
    .sort((a, b) => lightnessScore(b.text) - lightnessScore(a.text))
    .slice(0, MAX_FACTS_PER_DAY);

  return { key: `${mm}-${dd}`, facts };
}

async function main() {
  const result = {};
  let month = 1;

  for (const daysInMonth of DAYS_IN_MONTH) {
    for (let day = 1; day <= daysInMonth; day++) {
      const { key, facts } = await fetchDay(month, day);
      result[key] = facts;
      process.stdout.write(`\r${key} (${facts.length} facts)          `);
      await sleep(REQUEST_DELAY_MS);
    }
    month++;
  }

  await mkdir(path.dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, JSON.stringify(result, null, 2));
  console.log(`\nWrote ${Object.keys(result).length} days to ${OUT_PATH}`);
}

main().catch((err) => {
  console.error('\nFailed:', err);
  process.exit(1);
});
