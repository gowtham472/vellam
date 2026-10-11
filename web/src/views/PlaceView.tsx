import { ArrowLeftIcon, ArrowsOutIcon, CheckCircleIcon, ClockIcon, CubeIcon, MapTrifoldIcon, UsersThreeIcon, DropIcon, MapPinIcon, MountainsIcon, PhoneIcon, RoadHorizonIcon, WavesIcon, WhatsappLogoIcon } from '@phosphor-icons/react';
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import type { PlaceView as PlaceData, TrackRecordResult } from '../../../engine/src/api/service.ts';
import { formatHour } from '../../../engine/src/core/assess.ts';
import { distanceMetres } from '../../../engine/src/core/geo.ts';
import type { Point, RainWindow, WaterDepth, WaterReport } from '../../../engine/src/core/types.ts';
import { api, type Place } from '../api.ts';
import { placeLink } from '../App.tsx';
import { CityMap } from '../components/CityMap.tsx';
import { loadPlaces } from '../components/Finder.tsx';
import { Mascot } from '../components/Mascot.tsx';
import { DEPTH_NAME, LEVEL_NAME, useText } from '../i18n.ts';
import { AlertsForm } from '../components/AlertsForm.tsx';
import { LEVEL, SOURCE_LABEL } from '../level.ts';
import { stormName } from '../storms.ts';

// The 3D map brings a large library with it, so it is fetched after the answer is on screen.
const TerrainScene = lazy(() => import('./TerrainView.tsx').then((module) => ({ default: module.TerrainScene })));

const DEPTHS: readonly WaterDepth[] = ['NONE', 'ANKLE', 'KNEE', 'WAIST'];
const NEARBY_METRES = 2500;

function Timeline({ windows }: { windows: readonly RainWindow[] }) {
  const tallest = Math.max(10, ...windows.map((window) => window.rainMm));
  return (
    <ol className="timeline">
      {windows.map((window) => (
        <li key={window.start}>
          <span className="rain-mm">{window.rainMm > 0 ? String(window.rainMm) : ''}</span>
          <span className="bar-track">
            <span
              className="bar"
              style={{ height: `${String(Math.max(4, (window.rainMm / tallest) * 100))}%`, background: LEVEL[window.level].colour }}
            />
          </span>
          <span className="when">{formatHour(window.start).replace(/^(\w+) \d+ \w+, /, '$1 ')}</span>
        </li>
      ))}
    </ol>
  );
}

function ago(iso: string): string {
  const minutes = Math.max(1, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  return minutes < 60 ? `${String(minutes)} min ago` : `${String(Math.round(minutes / 60))} h ago`;
}

export function PlaceView({ point, date }: { point: Point; date?: string }) {
  const { t, language } = useText();
  const [data, setData] = useState<PlaceData>();
  const [error, setError] = useState<string>();
  const [record, setRecord] = useState<TrackRecordResult>();
  const [places, setPlaces] = useState<Place[]>([]);
  const [reports, setReports] = useState<WaterReport[]>([]);
  const [reported, setReported] = useState(false);
  const [flat, setFlat] = useState(false);

  useEffect(() => {
    api.assess(point, date).then(
      (result) => {
        setData(result);
        setReports([...result.reports]);
      },
      (reason: unknown) => {
        setError(reason instanceof Error ? reason.message : String(reason));
      },
    );
    loadPlaces().then(setPlaces, () => undefined);
    if (date === undefined) api.trackRecord(point).then(setRecord, () => undefined);
    // The view is keyed by place and date, so this runs once per place.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const near = useMemo(() => {
    let best: { place: Place; metres: number } | undefined;
    for (const place of places) {
      const metres = distanceMetres(point, place);
      if (metres <= NEARBY_METRES && (best === undefined || metres < best.metres)) best = { place, metres };
    }
    return best;
  }, [places, point]);

  const title =
    near === undefined
      ? `${point.lat.toFixed(4)}, ${point.lon.toFixed(4)}`
      : language === 'ta' && near.place.ta !== ''
        ? near.place.ta
        : near.place.name;
  const backHref = date === undefined ? '#/check' : `#/replay/${date}`;

  if (error !== undefined) {
    return (
      <div className="stack">
        <a className="back" href={backHref}>
          <ArrowLeftIcon weight="bold" aria-hidden="true" /> {t('back')}
        </a>
        <div className="empty">
          <Mascot mood="dizzy" size={140} />
          <p className="notice notice-error">{error}</p>
        </div>
      </div>
    );
  }
  if (data === undefined) {
    return (
      <div className="empty">
        <Mascot mood="watch" size={160} interactive />
        <p className="loading">{t('loading')}…</p>
      </div>
    );
  }

  const { assessment, guidance, helplines } = data;
  const advice = guidance[language];
  const look = LEVEL[assessment.level];
  const LevelIcon = look.icon;
  const shareText = [
    `Vellam flood check${near === undefined ? '' : `, ${near.place.name}`}: ${assessment.level}.`,
    guidance.en.headline + '.',
    assessment.peak === undefined ? '' : `Worst around ${formatHour(assessment.peak.start)}.`,
    `${location.origin}/${placeLink(point.lat, point.lon)}`,
  ]
    .filter(Boolean)
    .join(' ');

  const sendReport = (depth: WaterDepth) => {
    api.report(point, depth).then(
      (report) => {
        setReports([report, ...reports]);
        setReported(true);
      },
      (reason: unknown) => {
        setError(reason instanceof Error ? reason.message : String(reason));
      },
    );
  };

  return (
    <div className="stack">
      <a className="back" href={backHref}>
        <ArrowLeftIcon weight="bold" aria-hidden="true" /> {date === undefined ? t('back') : stormName(date)}
      </a>

      <section className="verdict" style={{ background: look.colour }}>
        <div className="verdict-copy">
          <span className="verdict-badge">{date === undefined ? t('live') : `${t('replayBadge')}: ${stormName(date)}`}</span>
          <p className="verdict-where">
            <MapPinIcon weight="fill" aria-hidden="true" /> {title}
          </p>
          <h1>
            <LevelIcon weight="fill" aria-hidden="true" /> {LEVEL_NAME[assessment.level][language]}
          </h1>
          <p className="verdict-headline">{advice.headline}</p>
          {assessment.raisedByReports === true && (
            <p className="verdict-peak">
              <UsersThreeIcon weight="fill" aria-hidden="true" /> {t('raisedByReports')}
            </p>
          )}
          {assessment.peak !== undefined && (
            <p className="verdict-peak">
              <ClockIcon weight="bold" aria-hidden="true" /> {t('worstAround')} {formatHour(assessment.peak.start)}
            </p>
          )}
        </div>
        <div className="verdict-mascot">
          <Mascot mood={look.mood} size={170} interactive />
        </div>
      </section>

      <div className="place-grid">
        <div className="place-now">
        <section className="card">
          <div className="card-head">
            <h2>{t('whatToDo')}</h2>
          </div>
          <ul className="actions">
            {advice.actions.map((action) => (
              <li key={action}>
                <CheckCircleIcon weight="fill" aria-hidden="true" style={{ color: look.colour }} />
                {action}
              </li>
            ))}
          </ul>
          <a className="button button-whatsapp" href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noreferrer">
            <WhatsappLogoIcon weight="fill" aria-hidden="true" /> {t('share')}
          </a>
          <div className="helplines helplines-compact">
            {helplines.map((line) => (
              <a key={line.number} className="helpline" href={`tel:${line.number}`}>
                <PhoneIcon weight="fill" aria-hidden="true" />
                <strong>{line.number}</strong>
                <span>{line[language]}</span>
              </a>
            ))}
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h2>{date === undefined ? t('next48') : `${t('hoursFrom')} ${formatHour(assessment.from)}`}</h2>
            <span className="muted">mm / 6 h</span>
          </div>
          <Timeline windows={assessment.windows} />
        </section>

        </div>

        <div className="place-main">
        <section className="card">
          <div className="card-head">
            <h2>{t('thisSpot')}</h2>
            <div className="switch" role="group" aria-label={t('thisSpot')}>
              <button type="button" aria-pressed={!flat} onClick={() => setFlat(false)}>
                <CubeIcon weight="fill" aria-hidden="true" /> 3D
              </button>
              <button type="button" aria-pressed={flat} onClick={() => setFlat(true)}>
                <MapTrifoldIcon weight="fill" aria-hidden="true" /> 2D
              </button>
            </div>
          </div>
          <dl className="facts facts-strip">
            <div>
              <MountainsIcon weight="duotone" aria-hidden="true" />
              <dt>{t('groundHeight')}</dt>
              <dd>{assessment.terrain.elevation} m</dd>
            </div>
            <div>
              <WavesIcon weight="duotone" aria-hidden="true" />
              <dt>{t('nearestWater')}</dt>
              <dd>
                {!assessment.mapped
                  ? t('notMapped')
                  : assessment.nearestWater === undefined
                    ? t('noneWithinKm')
                    : `${assessment.nearestWater.name || assessment.nearestWater.kind}, ${String(assessment.nearestWater.distanceMetres)} m`}
              </dd>
            </div>
            <div>
              <RoadHorizonIcon weight="duotone" aria-hidden="true" />
              <dt>{t('flooded2015')}</dt>
              <dd>
                {!assessment.mapped
                  ? t('notMapped')
                  : assessment.floodedStreetMetres === undefined
                    ? t('noneWithinKm')
                    : `${String(assessment.floodedStreetMetres)} m`}
              </dd>
            </div>
          </dl>
          {flat ? (
            <CityMap focus={{ point, level: assessment.level }} reports={reports} onPick={(picked) => (location.hash = placeLink(picked.lat, picked.lon, date))} />
          ) : (
            <Suspense fallback={<p className="scene-loading">{t('loading')}…</p>}>
              <TerrainScene point={point} reports={reports} />
            </Suspense>
          )}
          <a className="button button-outline" href={`#/3d/${point.lat.toFixed(5)},${point.lon.toFixed(5)}${date === undefined ? '' : `/${date}`}`}>
            <ArrowsOutIcon weight="bold" aria-hidden="true" /> {t('see3d')}
          </a>
        </section>
        <section className="card">
          <div className="card-head">
            <h2>{t('why')}</h2>
          </div>
          {language === 'ta' && <p className="muted">{t('whyNote')}</p>}
          <ul className="evidence">
            {assessment.evidence.map((item) => (
              <li key={item.statement}>
                <span className={`source source-${item.source.toLowerCase()}`}>{SOURCE_LABEL[item.source]}</span>
                <span>
                  {item.statement}.{' '}
                  {item.link !== undefined && (
                    <a href={item.link} target="_blank" rel="noreferrer">
                      Source
                    </a>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {record !== undefined && (
          <section className="card">
            <div className="card-head">
              <h2>{t('trackTitle')}</h2>
            </div>
            <p className="muted">{t('trackIntro')}</p>
            <ul className="scores">
              <li>
                <strong>
                  {record.record.matched}/{record.record.days}
                </strong>
                {t('days')} {t('matched')}
              </li>
              <li>
                <strong>{record.record.underForecast}</strong>
                {t('under')}
              </li>
              <li>
                <strong>{record.record.overForecast}</strong>
                {t('over')}
              </li>
            </ul>
            <p className="muted">
              {record.record.heavyDays === 0
                ? t('heavyNone')
                : `${t('heavyDays')}: ${String(record.record.heavyDays)}, forecast as heavy: ${String(record.record.heavyDaysForecast)}.`}
            </p>
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('dateCol')}</th>
                    <th>{t('forecastCol')}</th>
                    <th>{t('fellCol')}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {[...record.checks]
                    .reverse()
                    .slice(0, 8)
                    .map((check) => (
                      <tr key={check.date}>
                        <td>{check.date}</td>
                        <td>{check.forecastMm} mm</td>
                        <td>{check.observedMm} mm</td>
                        <td className={`verdict-${check.verdict.toLowerCase()}`}>
                          {check.verdict === 'MATCHED' ? t('matched') : check.verdict === 'UNDER_FORECAST' ? t('under') : t('over')}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
        </div>

        <div className="place-more">
        {date === undefined && (
          <section className="card">
            <div className="card-head">
              <h2>
                <DropIcon weight="fill" aria-hidden="true" /> {t('reportTitle')}
              </h2>
            </div>
            {reported ? (
              <div className="thanks">
                <Mascot mood="wink" size={72} />
                <p className="notice">{t('reportThanks')}</p>
              </div>
            ) : (
              <div className="depths">
                {DEPTHS.map((depth) => (
                  <button key={depth} type="button" className="button button-outline" onClick={() => sendReport(depth)}>
                    {DEPTH_NAME[depth][language]}
                  </button>
                ))}
              </div>
            )}
            <p className="muted">{t('reportNote')}</p>
            <h3>{t('reportsNearby')}</h3>
            {reports.length === 0 ? (
              <p className="muted">{t('noReports')}</p>
            ) : (
              <ul className="reports">
                {reports.slice(0, 8).map((report) => (
                  <li key={report.id}>
                    <strong>{DEPTH_NAME[report.depth][language]}</strong>
                    <span className="muted">
                      {Math.round(distanceMetres(point, report.point))} m away, {ago(report.at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {date === undefined && <AlertsForm street={{ point, name: near?.place.name ?? 'your street' }} />}

        </div>
      </div>
    </div>
  );
}
