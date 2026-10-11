import { ArrowRightIcon, ClockCounterClockwiseIcon, DropHalfBottomIcon, MapPinIcon, SealCheckIcon, UsersThreeIcon } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import type { PlaceView as PlaceData } from '../../../engine/src/api/service.ts';
import { levelFor } from '../../../engine/src/core/assess.ts';
import { classifyDailyRain, describeRainClass } from '../../../engine/src/core/rain.ts';
import type { Level, Snapshot, Susceptibility } from '../../../engine/src/core/types.ts';
import { api } from '../api.ts';
import { Finder } from '../components/Finder.tsx';
import { Mascot } from '../components/Mascot.tsx';
import { LEVEL, SOURCE_LABEL } from '../level.ts';
import { STORMS } from '../storms.ts';

const LEVEL_WORD: Record<Level, string> = { LOW: 'Low', WATCH: 'Watch', HIGH: 'High', SEVERE: 'Severe' };

/** The three kinds of street the rain dial compares, in the words a resident would use. */
const STREETS: readonly { exposure: Susceptibility; label: string }[] = [
  { exposure: 'HIGH', label: 'A street that flooded in 2015' },
  { exposure: 'SOME', label: 'A street 200 m from a lake' },
  { exposure: 'NONE', label: 'A street with neither' },
];

/** The India Meteorological Department's class boundaries, which mark the dial. */
const TICKS = [15.6, 64.5, 115.6, 204.5] as const;
const DIAL_MAX = 260;

const VELACHERY = { lat: 12.9756, lon: 80.2207 };
const MICHAUNG = '2023-12-04';

/** What the cloud says before anyone touches the dial: the state of the city, read live. */
function cityLine(snapshot: Snapshot | undefined): { level: Level; line: string } | undefined {
  if (snapshot === undefined) return undefined;
  const count = (levels: readonly Level[]) => snapshot.places.filter((place) => levels.includes(place.level)).length;
  const atRisk = count(['HIGH', 'SEVERE']);
  if (atRisk > 0) {
    const level = snapshot.places.some((place) => place.level === 'SEVERE') ? 'SEVERE' : 'HIGH';
    return { level, line: `Flooding is likely in ${String(atRisk)} Chennai localities in the next 48 hours.` };
  }
  const watching = count(['WATCH']);
  if (watching > 0) return { level: 'WATCH', line: `Rain is on the way. ${String(watching)} Chennai localities are on watch.` };
  return { level: 'LOW', line: `Chennai looks dry for the next 48 hours. All ${String(snapshot.places.length)} localities are low.` };
}

/**
 * The hero. The dial runs the engine's own rain classes and level table, so dragging it
 * shows the real rule: the same rain means different things on different streets.
 */
function RainDial() {
  const [snapshot, setSnapshot] = useState<Snapshot>();
  const [mm, setMm] = useState<number>();

  useEffect(() => {
    api.city().then(setSnapshot, () => undefined);
  }, []);

  const live = cityLine(snapshot);
  const rainClass = mm === undefined ? undefined : classifyDailyRain(mm);
  const worst = rainClass === undefined ? live?.level : levelFor(rainClass, 'HIGH');
  const drops = mm === undefined ? 0 : Math.round((mm / DIAL_MAX) * 22);

  return (
    <div className="dial">
      <div className="dial-stage">
        <div className="dial-rain" aria-hidden="true">
          {Array.from({ length: drops }, (_, i) => (
            <span key={i} style={{ left: `${String((i * 37) % 100)}%`, animationDelay: `${String((i * 0.19) % 1.4)}s` }} />
          ))}
        </div>
        <Mascot mood={worst === undefined ? 'sleepy' : LEVEL[worst].mood} size={280} interactive className="dial-mascot" />
      </div>

      <p className="dial-says" role="status">
        {mm === undefined || rainClass === undefined
          ? (live?.line ?? 'Reading the sky over Chennai.')
          : `${String(mm)} mm in a day. The India Meteorological Department calls that ${describeRainClass(rainClass).split(' (')[0] ?? ''}.`}
      </p>

      <label className="dial-control">
        <span>Drag to change the rain in 24 hours</span>
        <input
          type="range"
          min={0}
          max={DIAL_MAX}
          step={1}
          value={mm ?? 0}
          onChange={(event) => {
            setMm(Number(event.target.value));
          }}
        />
        <span className="dial-ticks" aria-hidden="true">
          {TICKS.map((tick) => (
            <i key={tick} style={{ left: `${String((tick / DIAL_MAX) * 100)}%` }}>
              {tick}
            </i>
          ))}
        </span>
      </label>

      <ul className="dial-streets">
        {STREETS.map(({ exposure, label }) => {
          const level = levelFor(rainClass ?? 'LIGHT', exposure);
          const LevelIcon = LEVEL[level].icon;
          return (
            <li key={exposure}>
              <span>{label}</span>
              <strong style={{ color: LEVEL[level].colour }}>
                <LevelIcon weight="fill" aria-hidden="true" /> {LEVEL_WORD[level]}
              </strong>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** A real answer from the engine, fetched live: Velachery on the day Cyclone Michaung hit. */
function RealAnswer() {
  const [data, setData] = useState<PlaceData>();

  useEffect(() => {
    api.assess(VELACHERY, MICHAUNG).then(setData, () => undefined);
  }, []);

  if (data === undefined) return null;
  const { assessment } = data;
  const look = LEVEL[assessment.level];
  const LevelIcon = look.icon;
  const worst = Math.max(...assessment.windows.map((window) => window.trailing24hMm));

  return (
    <section className="answer">
      <div className="answer-intro">
        <h2>This is what it said about Velachery on the day Michaung hit</h2>
        <p>
          This answer is fetched live from the same engine, given the rain on record for 4 December 2023. Every line
          says where it came from, and the last one is marked as Vellam's own judgement.
        </p>
        <a className="text-link" href={`#/place/${String(VELACHERY.lat)},${String(VELACHERY.lon)}/${MICHAUNG}`}>
          Open the full answer <ArrowRightIcon weight="bold" aria-hidden="true" />
        </a>
      </div>

      <div className="answer-sheet">
        <header style={{ borderColor: look.colour }}>
          <span className="answer-where">
            <MapPinIcon weight="fill" aria-hidden="true" /> Velachery, 4 Dec 2023
          </span>
          <strong style={{ color: look.colour }}>
            <LevelIcon weight="fill" aria-hidden="true" /> {LEVEL_WORD[assessment.level]}
          </strong>
          <span className="answer-rain">{worst} mm in the worst 24 hours</span>
        </header>
        <ul>
          {assessment.evidence.map((item) => (
            <li key={item.statement}>
              <span className={`source source-${item.source.toLowerCase()}`}>{SOURCE_LABEL[item.source]}</span>
              <span>{item.statement}.</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function HomeView() {
  return (
    <div className="home">
      <section className="hero">
        <div className="hero-copy">
          <h1>Will my street flood?</h1>
          <p className="lead">
            Flood warnings in India cover a whole district. Vellam answers for one street in Chennai: what to expect in the
            next 48 hours, the reasons, and what to do about it.
          </p>
          <Finder />
          <a className="button button-solid button-large" href="#/check">
            Check my street <ArrowRightIcon weight="bold" aria-hidden="true" />
          </a>
        </div>
        <RainDial />
      </section>

      <RealAnswer />

      <section className="trio">
        <div className="trio-copy">
          <h2>Four things a forecast cannot tell you</h2>
          <dl>
            <div>
              <dt>
                <ClockCounterClockwiseIcon weight="bold" aria-hidden="true" /> Whether your street has flooded before
              </dt>
              <dd>
                In December 2015 residents mapped 7,851 flooded streets as the water rose. Vellam measures how far yours is
                from the nearest one.
              </dd>
            </div>
            <div>
              <dt>
                <DropHalfBottomIcon weight="bold" aria-hidden="true" /> What the reservoir upstream is doing
              </dt>
              <dd>
                On 2 December 2015 Chembarambakkam released 29,000 cusecs into the Adyar. Vellam reads Chennai Metro Water's
                daily bulletin and warns streets beside the river when a reservoir is nearly full or releasing heavily.
              </dd>
            </div>
            <div>
              <dt>
                <UsersThreeIcon weight="bold" aria-hidden="true" /> What your neighbours can see right now
              </dt>
              <dd>
                Anyone can report water as ankle, knee or waist deep. Two reports that agree raise the level whatever the
                forecast says, and a report stores nothing about the person.
              </dd>
            </div>
            <div>
              <dt>
                <SealCheckIcon weight="bold" aria-hidden="true" /> How often the forecast has been right here
              </dt>
              <dd>For any spot, the last 30 days of day-ahead rain forecasts beside the rain that fell.</dd>
            </div>
          </dl>
        </div>
        <img src="/illustrations/neighbourhood.svg" alt="" loading="lazy" />
      </section>

      <section className="storms">
        <h2>Replay a storm through the same rules</h2>
        <ul>
          {STORMS.map((storm) => (
            <li key={storm.date}>
              <a href={`#/replay/${storm.date}`}>
                <time dateTime={storm.date}>{storm.note}</time>
                <strong>{storm.name}</strong>
                <span>{storm.summary}</span>
                <ArrowRightIcon weight="bold" aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className="limits">
        <Mascot mood="watch" size={150} />
        <div>
          <h2>Where not to trust it</h2>
          <ul>
            <li>The level is a rule of thumb. Vellam does not model how water moves through drains.</li>
            <li>Its replay of Cyclone Michaung missed Perungudi, which was under water for days.</li>
            <li>Three of its thresholds were wrong on the first attempt. The method page records each one.</li>
          </ul>
          <a className="text-link" href="#/how">
            Read the method <ArrowRightIcon weight="bold" aria-hidden="true" />
          </a>
        </div>
      </section>

      <section className="final">
        <div>
          <h2>The northeast monsoon starts in October.</h2>
          <p>Know your street before the first heavy night.</p>
          <a className="button button-invert button-large" href="#/check">
            Check my street <ArrowRightIcon weight="bold" aria-hidden="true" />
          </a>
        </div>
        <img src="/illustrations/walking-in-rain.svg" alt="" loading="lazy" />
      </section>
    </div>
  );
}
