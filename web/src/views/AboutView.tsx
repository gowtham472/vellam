import { ArrowLeftIcon } from '@phosphor-icons/react';
import { useText } from '../i18n.ts';

/** How Vellam reaches an answer, and where that answer should not be trusted. */
export function AboutView() {
  const { t } = useText();
  return (
    <div className="place about">
      <a className="back" href="#/">
        <ArrowLeftIcon weight="bold" aria-hidden="true" /> {t('back')}
      </a>
      <section className="panel">
        <h1>{t('about')}</h1>
        <p>
          Official warnings cover a whole district. Floods happen street by street. Vellam takes the rain forecast for
          one spot and asks what that much rain does to that particular piece of ground.
        </p>

        <h2>1. How much rain</h2>
        <p>
          The hourly forecast for the spot, summed over every 24 hour stretch of the next two days and named with the
          India Meteorological Department's classes: moderate from 15.6 mm, heavy from 64.5 mm, very heavy from 115.6
          mm, extremely heavy from 204.5 mm.
        </p>

        <h2>2. What kind of place</h2>
        <ul>
          <li>
            <strong>Did this street flood in 2015?</strong> During the December 2015 floods, residents marked 7,851
            flooded streets on an open map. A street within 60 m counts strongly, one within 200 m counts once.
          </li>
          <li>
            <strong>Is water close by?</strong> Lakes, marshes, rivers and canals from OpenStreetMap, within 300 m.
          </li>
          <li>
            <strong>Is the ground low?</strong> Five metres above sea level or less, or at least five metres below the
            ground around it.
          </li>
          <li>
            <strong>Is the ground already soaked?</strong> More than 115.6 mm in the previous three days.
          </li>
          <li>
            <strong>Is it a hill?</strong> Ground ten metres or more above its surroundings takes one factor away.
          </li>
        </ul>

        <h2>3. The level</h2>
        <p>
          Rain and place meet in one table. Rain alone can raise the level; the place alone cannot, because a low street
          under a dry sky is not at risk today. Every answer lists the facts it used and marks each one as a forecast, a
          measurement, a map, the 2015 record, or Vellam's own judgement.
        </p>

        <h2>4. It checks itself</h2>
        <p>
          For any spot, Vellam shows the last 30 days of day-ahead rain forecasts beside the rain that fell, and says
          plainly how many matched. The replay runs past storms through the same rules. Neighbours' reports of water in
          the street stay on the map for 48 hours.
        </p>

        <h2>Where not to trust it</h2>
        <ul>
          <li>The level is a rule of thumb. Vellam does not model how water flows through drains and streets.</li>
          <li>
            The 2015 map was drawn by volunteers. A street missing from it may still have flooded, and nothing since
            2015, including new drains, is reflected in it.
          </li>
          <li>The elevation data is a 90 m grid that includes rooftops, so only large height differences are used.</li>
          <li>A forecast can be wrong. Sudden cloudbursts and reservoir releases are not predicted here.</li>
          <li>Vellam is not an official warning. Follow IMD and Greater Chennai Corporation advisories.</li>
        </ul>

        <h2>Data</h2>
        <ul>
          <li>
            Rain forecast, past forecasts, rain record and elevation: <a href="https://open-meteo.com">Open-Meteo</a>.
          </li>
          <li>
            Flooded streets, December 2015: <a href="https://github.com/osm-in/flood-map">osm-in/flood-map</a>, MIT
            licence.
          </li>
          <li>
            Water bodies and locality names: <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>{' '}
            contributors, ODbL.
          </li>
          <li>
            What to do: based on the{' '}
            <a href="https://ndma.gov.in/Natural-Hazards/Floods/Dos-Donts">National Disaster Management Authority</a>'s
            flood guidance.
          </li>
        </ul>
      </section>
    </div>
  );
}
