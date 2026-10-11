import { CloudRainIcon, DatabaseIcon, MapTrifoldIcon, ScalesIcon, SealCheckIcon, UsersThreeIcon, WarningDiamondIcon } from '@phosphor-icons/react';
import { Mascot } from '../components/Mascot.tsx';
import { useText } from '../i18n.ts';
import { LEVEL } from '../level.ts';
import type { Level } from '../../../engine/src/core/types.ts';

const FACTORS: readonly [string, string, string][] = [
  ['This street flooded in 2015', 'A street residents marked as flooded is within 60 m', '+2'],
  ['Streets nearby flooded in 2015', 'One is within 200 m', '+1'],
  ['Reservoir upstream is releasing heavily', 'Within 500 m of the Adyar or the Kosasthalaiyar, and the reservoir above it is releasing 3,000 cusecs or more', '+2'],
  ['Reservoir upstream is nearly full', 'Within 500 m of one of those rivers, and the reservoir is at least 80% full', '+1'],
  ['Close to a water body', 'A lake, marsh, river or canal within 300 m. Within 100 m counts double', '+1 or +2'],
  ['Low ground', 'Five metres above sea level or less', '+1'],
  ['Lower than its surroundings', 'At least five metres below the ground a kilometre around', '+1'],
  ['Ground already soaked', 'More than 115.6 mm of rain in the previous 72 hours', '+1'],
  ['On raised ground', 'At least ten metres above its surroundings', '-1'],
];

const TABLE: readonly [string, Level, Level, Level][] = [
  ['Light or none, under 15.6 mm', 'LOW', 'LOW', 'LOW'],
  ['Moderate, from 15.6 mm', 'LOW', 'LOW', 'WATCH'],
  ['Heavy, from 64.5 mm', 'WATCH', 'WATCH', 'HIGH'],
  ['Very heavy, from 115.6 mm', 'WATCH', 'HIGH', 'SEVERE'],
  ['Extremely heavy, from 204.5 mm', 'HIGH', 'SEVERE', 'SEVERE'],
];

const WRONG: readonly [string, string, string][] = [
  ['Flooded street within 150 m, nearby within 400 m', '150 m reached 52% of random points in the core city and 400 m reached 79%. The factor said yes to almost everyone.', '60 m and 200 m'],
  ['Height differences of 2 m and 3 m', 'The elevation model is a 90 m grid that includes rooftops. It described Velachery as raised ground.', '5 m and 10 m'],
  ['Ground soaked after 64.5 mm in 72 hours', 'Replaying 15 October 2024, every locality counted as soaked and 47 of 65 came out high.', '115.6 mm'],
  [
    'A reservoir release counted only as a property of the place',
    'Replaying December 2015, Saidapet beside the Adyar came out as watch on the day 29,000 cusecs were released, because the rain record for that day is far too low.',
    'A heavy release sets its own floor',
  ],
  [
    'Reports searched by stepping the coordinate',
    'On the live site one report was read back as two, which let a single report reach high. Neighbouring search cells had come out identical.',
    'Cells are stepped by whole numbers',
  ],
];

/** How Vellam reaches an answer, and where that answer should not be trusted. */
export function HowView() {
  const { t, language, levelName } = useText();
  const cell = (level: Level) => (
    <td>
      <span className="pill" style={{ background: LEVEL[level].colour }}>
        {levelName(level)}
      </span>
    </td>
  );
  return (
    <div className="stack prose">
      <header className="page-head">
        <Mascot mood="happy" size={96} />
        <div>
          <h1>{t('about')}</h1>
          <p className="lead">
            Official warnings cover a whole district. Floods happen street by street. Vellam takes the rain forecast for one
            spot and asks what that much rain does to that particular piece of ground.
          </p>
          {language !== 'en' && <p className="muted">{t('howNote')}</p>}
        </div>
      </header>

      <section className="card">
        <div className="card-head">
          <h2>
            <CloudRainIcon weight="fill" aria-hidden="true" /> 1. How much rain
          </h2>
        </div>
        <p>
          The hourly forecast for the spot, summed over every 24 hours of the next two days and named with the India
          Meteorological Department's classes.
        </p>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>
            <MapTrifoldIcon weight="fill" aria-hidden="true" /> 2. What kind of place
          </h2>
        </div>
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Factor</th>
                <th>Counts when</th>
                <th>Weight</th>
              </tr>
            </thead>
            <tbody>
              {FACTORS.map(([factor, when, weight]) => (
                <tr key={factor}>
                  <td>
                    <strong>{factor}</strong>
                  </td>
                  <td>{when}</td>
                  <td>{weight}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted">A total of 0 or less is no exposure, 1 is some, 2 or more is high.</p>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>
            <ScalesIcon weight="fill" aria-hidden="true" /> 3. The level
          </h2>
        </div>
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Rain in 24 hours</th>
                <th>No exposure</th>
                <th>Some</th>
                <th>High</th>
              </tr>
            </thead>
            <tbody>
              {TABLE.map(([rain, none, some, high]) => (
                <tr key={rain}>
                  <td>{rain}</td>
                  {cell(none)}
                  {cell(some)}
                  {cell(high)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          Rain alone can raise the level. The place alone cannot: a low street under a dry sky is not at risk today. There is
          no machine learning in this path. The same street and the same forecast always give the same answer.
        </p>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>
            <UsersThreeIcon weight="fill" aria-hidden="true" /> 4. Two things that overrule the table
          </h2>
        </div>
        <ul className="prose-list">
          <li>
            <strong>Water somebody is standing in.</strong> Reports within 300 m and six hours set a floor under the level
            whatever the forecast says. Reports are anonymous, so one alone raises the level to watch at most. Two that
            agree on knee deep or more make it high, and two of waist deep make it severe. A report of no water never
            lowers the level.
          </li>
          <li>
            <strong>A reservoir letting go.</strong> A street within 500 m of a river taking a release of 3,000 cusecs or
            more is at least high, and at least severe from 10,000, whatever the rain at that spot. The water arrives down
            the river from rain that fell somewhere else.
          </li>
        </ul>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>
            <SealCheckIcon weight="fill" aria-hidden="true" /> 5. It checks itself
          </h2>
        </div>
        <p>
          For any spot, Vellam shows the last 30 days of day-ahead rain forecasts beside the rain that fell, and says plainly
          how many matched. The replay runs past storms through the same rules. Neighbours' reports of water stay on the map
          for 48 hours.
        </p>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>
            <WarningDiamondIcon weight="fill" aria-hidden="true" /> What we got wrong first
          </h2>
        </div>
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>First value</th>
                <th>What the data showed</th>
                <th>Now</th>
              </tr>
            </thead>
            <tbody>
              {WRONG.map(([first, showed, now]) => (
                <tr key={first}>
                  <td>{first}</td>
                  <td>{showed}</td>
                  <td>
                    <strong>{now}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Where not to trust it</h2>
        </div>
        <ul className="prose-list">
          <li>The level is a rule of thumb. Vellam does not model how water moves through drains and streets.</li>
          <li>
            The 2015 map was drawn by volunteers during the flood. A street missing from it may still have flooded, and
            nothing since 2015, including new storm drains, is reflected in it.
          </li>
          <li>
            A forecast can be wrong, and cloudbursts are not predicted here. A reservoir release is read from yesterday's
            bulletin, so one that starts today is not seen until tomorrow's.
          </li>
          <li>
            The rain record used for replays is a weather model's reconstruction. For 1 December 2015 it shows 49 mm where
            the reservoir's own gauge measured 475 mm, so that replay is nearly dry.
          </li>
          <li>
            The 3D view floods everything below one height, like a bathtub. It shows the shape of the ground and makes no
            claim about how deep water will get.
          </li>
          <li>Vellam is not an official warning. Follow IMD and Greater Chennai Corporation advisories.</li>
        </ul>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>
            <DatabaseIcon weight="fill" aria-hidden="true" /> Data
          </h2>
        </div>
        <ul className="prose-list">
          <li>
            Rain forecast, earlier forecasts, rain record and elevation: <a href="https://open-meteo.com">Open-Meteo</a>.
          </li>
          <li>
            Streets flooded in December 2015: <a href="https://github.com/osm-in/flood-map">osm-in/flood-map</a>, MIT licence.
          </li>
          <li>
            Water bodies and locality names: <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors.
          </li>
          <li>
            Reservoir levels: <a href="https://cmwssb.tn.gov.in/lake-level">Chennai Metro Water</a>, daily bulletin.
          </li>
          <li>
            Ground heights in the 3D view: Terrain Tiles on the <a href="https://registry.opendata.aws/terrain-tiles/">Registry of Open Data on AWS</a>. Buildings:{' '}
            <a href="https://openfreemap.org">OpenFreeMap</a>.
          </li>
          <li>
            Rain classes:{' '}
            <a href="https://rsmcnewdelhi.imd.gov.in/uploads/archive/8/8_f9822f_heavy%20rainfall%201506.pdf">
              India Meteorological Department
            </a>
            .
          </li>
        </ul>
      </section>
    </div>
  );
}
