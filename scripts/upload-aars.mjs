// One-off: bulk-insert the historical AARs from "Compilation of AARs
// 2025-2026.docx" into public.aars as drafted rows (source: 'drafted'),
// standalone (no event_id — link manually in DISPATCH's AAR Tracker if
// desired). Requires a service-role key since aars is is_s5()-only via RLS;
// run locally, never commit the key.
//
// Usage: node --env-file=.env --env-file=.env.local scripts/upload-aars.mjs [--dry-run]
// (put SUPABASE_SERVICE_ROLE_KEY in .env.local — never commit it)

import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dryRun = process.argv.includes('--dry-run');

if (!url || !serviceKey) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.');
  process.exit(1);
}

const sb = createClient(url, serviceKey, { auth: { persistSession: false } });

const bullets = (lines) => lines.map((l) => `- ${l}`).join('\n');

const AARS = [
  {
    title: 'Blood Drive AAR',
    summary: 'Compiled staff AAR feedback from the AAR Compilation 2025-2026 document.',
    wentWell: bullets([
      'Promoting the drive 2-3 weeks in advance (up to and including slides on the TVs, flyers, announcements a week before, etc…)',
      'Appealing to students by offering service hours for donating',
      'Letting attendance handle excused absences',
    ]),
    needsImprovement: bullets([
      'No time slots after 1:15 to allow time for clean up',
      'Clarify with admin that nothing will be scheduled over',
      "Don't schedule on a Monday",
    ]),
  },
  {
    title: 'Halloween Bash AAR',
    summary: 'Compiled staff AAR feedback from the AAR Compilation 2025-2026 document.',
    wentWell: bullets([
      'Potluck',
      'Movie while eating',
      'Candy tables',
      'Face paint table',
      'Reserved gym',
      'Drinks',
      'Food variety',
      'Costume Competition',
      'Games',
    ]),
    needsImprovement: bullets([
      'More activities',
      'Instructor costume judges',
      'Event communication',
      'More advance planning',
      'More help',
      'Music (cadet DJ)',
      'More movie',
      'Seating',
      'More time for setup',
      'Staff brief',
      'Written list of setup',
      'List of what is needed',
      'Confirm roles/event',
      'Theme',
    ]),
  },
  {
    title: 'Awards Night AAR',
    summary: 'Compiled staff AAR feedback from the AAR Compilation 2025-2026 document.',
    wentWell: bullets([
      'Escort detail',
      'Senior walk',
      'New staff cleans (old leaves)',
      'Honored guests communication',
      'Senior staff feedback',
      'Time efficient',
      'Presley singing national anthem',
    ]),
    needsImprovement: bullets([
      'Shadow box security',
      'Have "backups" ready to receive awards before the event',
      "Don't have too many people at the table giving awards",
      'Communication between staff',
      'Everything planned before the event',
      'Cadets seated upon arrival',
      'No cheering',
      'People do their job',
      'People working on script',
      'Professional environment',
      'Timing',
    ]),
  },
  {
    title: 'Service Learning AAR',
    summary: 'Compiled staff AAR feedback from the AAR Compilation 2025-2026 document.',
    wentWell: bullets([
      'Learning the history behind the project',
      'Having 2 service learning opportunities to go to',
      'Kids packing their own lunches',
      'Bring hot coco',
      'Participating in sections',
    ]),
    needsImprovement: bullets([
      'Communication between organization and program',
      'Ensuring companies understand the purpose of the assignment',
      'Better control over the event',
      'Better weather forecast',
      'Better planning',
      'Better head count',
      'Better timing',
    ]),
  },
  {
    title: 'Military Ball AAR',
    summary: 'Compiled staff AAR feedback from the AAR Compilation 2025-2026 document.',
    wentWell: bullets([
      'Food',
      'DJ/Music',
      'Drinks',
      'Souvenir',
      'Timing',
      'Photobooth',
      'Foodline',
      'No color restrictions',
      'Clean up',
    ]),
    needsImprovement: bullets([
      'CSM reading the script slower',
      'Color guard preparedness',
      'Better control over the event',
      'Better venue (bathrooms)',
      'Stay at venue',
      'Communication with company and staff',
      'More security',
      'Set up/organization',
      'Stricter deadlines',
      'Receiving line',
      'List of volunteers',
      'Staff tables',
      'Everyone stays to clean (unless told otherwise)',
      "Invite other school's BC",
    ]),
  },
  {
    title: 'Daisy Field Day AAR',
    summary: 'Compiled staff AAR feedback from the AAR Compilation 2025-2026 document.',
    wentWell: bullets([
      'Energy/enthusiasm',
      'Clean up',
      'Assignments',
      'Communication',
      'Set up',
      'Water distribution',
      'Big 3 helping where needed',
      'Company leadership helping',
      'Student lead stuff',
      'Laid back/trust',
      'PG Language/Self control',
      'S-6 pictures',
      'Backup games',
    ]),
    needsImprovement: bullets([
      "Don't leave station",
      'Deadline for permission slips',
      'More people/food distribution',
      'Communication',
      'Game separation',
      "Don't distract busy groups",
      'Poweraid/gatoraid/cold drinks',
      'Warn Parents',
      'Paper plates for pizza',
      'Backup personnel',
      'Aubrey X sponges (bad idea)',
      'Game rules',
    ]),
  },
];

console.log(`AARs to insert: ${AARS.length}`);
for (const a of AARS) console.log(`  - ${a.title}`);

if (dryRun) {
  console.log('--dry-run: no writes performed.');
  process.exit(0);
}

const rows = AARS.map((a) => ({
  source: 'drafted',
  event_id: null,
  title: a.title,
  aar_date: null,
  confidentiality: 'internal',
  content_went_well: a.wentWell,
  content_needs_improvement: a.needsImprovement,
  content_summary: a.summary,
  // created_by defaults to auth.jwt() ->> 'email', which is null under the
  // service-role key (no JWT), violating the NOT NULL constraint.
  created_by: 'bulk-import',
}));

const { error } = await sb.from('aars').insert(rows);
if (error) { console.error('Insert failed:', error.message); process.exit(1); }
console.log(`Inserted ${rows.length} aars rows.`);
