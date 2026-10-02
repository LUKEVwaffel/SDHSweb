import { useEffect } from 'react';
import { HeroLeaf, OrbitFigure, TempFigure, DaylightFigure, LagFigure, LeafFigure } from './figures';
import './lukescience.css';

// /lukescience: Luke's case that fall starts October 1, not on the equinox.
// Static, self-contained anon route (App.jsx bypass), no data fetches.

const EVIDENCE = [
  {
    n: '01',
    title: 'September 22 is not even a fixed date',
    figure: <OrbitFigure />,
    caption: 'Fig. 1. The September equinox is the moment the sun crosses the celestial equator. In 2026 that happened at 8:05 PM Eastern on September 22, which was already September 23 in London.',
    body: [
      'The "fall starts September 22" crowd is leaning on the autumnal equinox. Here is the problem: the equinox is not a day. It is a single instant, the moment the sun sits directly over the equator. Depending on the year and where you live, that instant lands on September 21, 22, 23, or even 24.',
      'This year it hit at 8:05 PM our time. So by their own rule, fall in Soddy-Daisy started after dinner on the 22nd, while everyone in Europe got it on the 23rd. A season that shows up at different times depending on your time zone is not a season. It is a timestamp.',
    ],
  },
  {
    n: '02',
    title: 'It is still summer outside',
    figure: <TempFigure />,
    caption: 'Fig. 2. Average daily high in Chattanooga, June through November, from NOAA 1991 to 2020 climate normals (rounded, interpolated by day). The shaded band is 80°F and up.',
    body: [
      'Go look at the actual weather. On September 22 the normal high around here is about 82°F. That is the same as the end of May, and nobody has ever walked out on Memorial Day weekend and said "ah, fall."',
      'The average high does not drop under 80 until the very end of September. October 1 is the first day of the year where the normal high is solidly in the 70s and keeps falling. That is the line where it stops being summer in a hoodie and starts being actual fall.',
    ],
  },
  {
    n: '03',
    title: 'Equal day and night does not happen on the equinox',
    figure: <DaylightFigure />,
    caption: 'Fig. 3. Sunrise to sunset at about 35°N. On the equinox Soddy-Daisy still gets roughly 12 hours 8 minutes of sun. The 12/12 split (the "equilux") shows up around September 26.',
    body: [
      '"Equinox" literally means equal night. Except it is not. Our atmosphere bends sunlight over the horizon, and sunrise is counted when the top edge of the sun appears, not the center. So on September 22 we still had about 8 more minutes of day than night.',
      'Days and nights do not actually even out here until around September 26. October is the first full month where every single day has more darkness than light. September cannot say that. Most of September is still a long-day month.',
    ],
  },
  {
    n: '04',
    title: 'Seasonal lag: the planet runs about a month behind the sun',
    figure: <LagFigure />,
    caption: 'Fig. 4. Sunlight peaks at the June solstice. Temperature peaks weeks later because land and especially oceans keep soaking up and holding heat.',
    body: [
      'This is the big one. The longest day of the year is June 21, but the hottest stretch in Tennessee is late July. That gap is called seasonal lag. Water and ground store heat, so the air keeps warming for weeks after the sun starts backing off.',
      'Nobody argues that the hottest part of summer is June 21. So why would the start of fall land exactly on the astronomical marker? If you slide the equinox by the same lag that summer gets, fall would start in late October. October 1 is me being generous.',
    ],
  },
  {
    n: '05',
    title: 'The trees agree with me',
    figure: <LeafFigure />,
    caption: 'Fig. 5. In East Tennessee, leaves start turning in early October and usually peak from late October into early November.',
    body: [
      'Leaves change when shorter days and cooler nights shut down chlorophyll production. On September 22 the trees in Soddy-Daisy are green. Fully green. They start turning in October, and the peak color around here is late October to early November.',
      'If the trees have not gotten the memo that it is fall, I do not think the calendar gets to overrule them.',
    ],
  },
  {
    n: '06',
    title: 'The U.S. government starts its year on October 1',
    figure: null,
    caption: null,
    body: [
      'The federal fiscal year starts on October 1. It is written into law (31 U.S.C. 1102). The government looked at the whole calendar and decided the real turning point of the year is October 1.',
      'September is the end of the old year. October is a fresh start. Same thing with the seasons.',
    ],
  },
];

const REBUTTALS = [
  {
    claim: '"But the equinox is the official start of fall."',
    answer: 'Official to who? The equinox is the astronomical marker, and astronomers will tell you it is a moment in an orbit, not a weather event. It does not even give equal day and night (see Evidence 03). Using it as the first day of fall is a tradition, not a measurement.',
  },
  {
    claim: '"Meteorologists say fall starts September 1."',
    answer: 'Meteorological seasons just chop the year into whole months so record keeping is easy. That is bookkeeping. The normal high in Chattanooga on September 1 is about 87°F, which is hotter than the first week of June. If anything, that proves both September dates are made up and the weather should decide.',
  },
  {
    claim: '"Almanac.com says September 22."',
    answer: 'The Almanac goes by the equinox, which is the astronomy definition, which I already took apart in Evidence 01 and 03. A source that just repeats the thing I disproved is not a new source. Look harder.',
  },
  {
    claim: '"It felt cool last week."',
    answer: 'One cold front is weather. Seasons are climate. Thirty years of averages say late September is summer temperatures.',
  },
];

export default function LukeScience() {
  useEffect(() => {
    const prev = document.title;
    document.title = 'Luke Science: Fall Starts October 1';
    return () => { document.title = prev; };
  }, []);

  return (
    <main className="ls-page">
      <div className="ls-grain" aria-hidden="true" />

      <header className="ls-masthead">
        <span>Journal of Luke Science</span>
        <span>Vol. 1 · Issue 1</span>
        <span>Peer Reviewed (by Luke)</span>
      </header>

      <section className="ls-hero" aria-labelledby="ls-title">
        <div className="ls-hero-text">
          <p className="ls-kicker">Research Paper · Climatology</p>
          <h1 id="ls-title">
            Fall starts on <em>October 1st.</em>
          </h1>
          <p className="ls-dek">
            Not September 22. Not September 1. October 1. I have the science, the data, and the trees. U just wait.
          </p>
          <p className="ls-byline">By Luke Vetsch · Soddy-Daisy, Tennessee · 35.2°N</p>
        </div>
        <div className="ls-hero-art">
          <HeroLeaf />
          <div className="ls-date-stamp">
            <span>10</span>
            <span>01</span>
          </div>
        </div>
      </section>

      <section className="ls-abstract" aria-labelledby="ls-abstract-h">
        <h2 id="ls-abstract-h">Abstract</h2>
        <p>
          Most calendars mark the first day of fall on the September equinox, usually September 22. I looked at
          temperature records, daylight, the physics of seasonal lag, and what the trees are actually doing here in
          East Tennessee. Every one of them points past the equinox. The cleanest, most defensible start date is
          <strong> October 1</strong>: the first full month with more night than day, the point where normal highs
          leave summer territory, and the start of the federal year. September 22 is summer with a nice name.
        </p>
      </section>

      <div className="ls-evidence-list">
        {EVIDENCE.map(e => (
          <article key={e.n} className={`ls-evidence ${e.figure ? '' : 'ls-evidence-plain'}`}>
            <div className="ls-evidence-head">
              <span className="ls-num">{e.n}</span>
              <h2>{e.title}</h2>
            </div>
            <div className="ls-evidence-body">
              {e.body.map((p, i) => <p key={i}>{p}</p>)}
            </div>
            {e.figure && (
              <figure className="ls-figure">
                {e.figure}
                <figcaption>{e.caption}</figcaption>
              </figure>
            )}
          </article>
        ))}
      </div>

      <section className="ls-rebuttals" aria-labelledby="ls-reb-h">
        <h2 id="ls-reb-h">Common objections, answered</h2>
        {REBUTTALS.map(r => (
          <div key={r.claim} className="ls-rebuttal">
            <p className="ls-claim">{r.claim}</p>
            <p>{r.answer}</p>
          </div>
        ))}
      </section>

      <section className="ls-cora" aria-labelledby="ls-cora-h">
        <div className="ls-cora-stamp" aria-hidden="true">PROVEN</div>
        <h2 id="ls-cora-h">Ok Cora. Listen up.</h2>
        <p className="ls-counter">Websites made for Cora count: 3</p>
        <p>
          Yesh. Another website. This time with real stuff from my 2 week endeavor to prove me right and 22 wrong.
          Mwahahaha (evil laugh, so fun to type).
        </p>
        <p>
          First of all. AI analysis. Not Cora brain. Nobody's brain. This is one milly me brain. Hand
          crafted. Organic, and free range (like chickys).
        </p>
        <p>
          Then when your helpless screenshotted plea didn't work, u bring up Almanac. Dats a farming calendar. Not
          real calendar and temperature and thingys. I brought NOAA. The actual weather people. The government ones.
        </p>
        <p>
          On September 22 it was 82 degrees outside. The trees were green. The sun was up for more than 12 hours. And
          u were out here calling that fall?? Oh my goodness. That is not fall. That is summer wearing a fake mustache.
        </p>
        <div className="ls-scorecard">
          <div>
            <p className="ls-score-head">Luke brought</p>
            <ul>
              <li>30 years of NOAA temperature data</li>
              <li>Orbital mechanics</li>
              <li>Atmospheric refraction (look it up)</li>
              <li>Every tree in Tennessee</li>
              <li>The literal federal government</li>
            </ul>
          </div>
          <div>
            <p className="ls-score-head">Cora brought</p>
            <ul>
              <li>An AI analysis</li>
              <li>A farming calendar</li>
            </ul>
          </div>
        </div>
        <p>
          U are welcome to submit a rebuttal to the Journal of Luke Science. It will be reviewed by our board of
          experts (me) and rejected in 3 to 5 business days.
        </p>
        <p className="ls-cora-verdict">
          Verdict: Cora is WRONG. Luke Science is proven. Me is right. Boom.
        </p>
        <p className="ls-sign">Luke</p>
        <p className="ls-ps">P.S. It is now officially PUNKIN season. U are allowed to have pumpkin now. Not before. Today.</p>
      </section>

      <footer className="ls-sources">
        <h2>Sources</h2>
        <ol>
          <li>NOAA NCEI, U.S. Climate Normals 1991 to 2020, Chattanooga Lovell Field, TN (monthly mean max temperature).</li>
          <li>U.S. Naval Observatory and timeanddate.com, 2026 September equinox time and Soddy-Daisy sunrise and sunset tables.</li>
          <li>NOAA NCEI, "Meteorological Versus Astronomical Seasons."</li>
          <li>National Weather Service, explainers on seasonal lag and the equilux.</li>
          <li>U.S. Forest Service and Tennessee State Parks, fall foliage timing for East Tennessee.</li>
          <li>31 U.S.C. § 1102, fiscal year of the federal government begins October 1.</li>
        </ol>
        <p className="ls-fine">Temperatures are rounded normals. Daylight times are rounded to the minute for 35°N.</p>
      </footer>
    </main>
  );
}
