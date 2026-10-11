import { ArrowLeftIcon, CheckCircleIcon, PhoneIcon, WhatsappLogoIcon } from '@phosphor-icons/react';
import { useEffect, useMemo, useState } from 'react';
import type { PlaceView as PlaceData, TrackRecordResult } from '../../../engine/src/api/service.ts';
import { formatHour } from '../../../engine/src/core/assess.ts';
import { distanceMetres } from '../../../engine/src/core/geo.ts';
import type { EvidenceSource, Point, RainWindow, WaterDepth, WaterReport } from '../../../engine/src/core/types.ts';
import { api, type Place } from '../api.ts';
import { placeLink } from '../App.tsx';
import { CityMap, LEVEL_COLOUR } from '../components/CityMap.tsx';
import { DEPTH_NAME, LEVEL_NAME, useText } from '../i18n.ts';
import { stormName } from '../storms.ts';

const SOURCE_LABEL: Record<EvidenceSource, string> = {
  FORECAST: 'Forecast',
  OBSERVED: 'Measured',
  TERRAIN: 'Terrain',
  MAP: 'Map',
  HISTORY: '2015 record',
  JUDGEMENT: 'Judgement',
};

const DEPTHS: readonly WaterDepth[] = ['NONE', 'ANKLE', 'KNEE', 'WAIST'];
const NEARBY_METRES = 2500;

function Timeline({ windows }: { windows: readonly RainWindow[] }) {
  const tallest = Math.max(10, ...windows.map((window) => window.rainMm));
  return (
    <ol className="timeline">
      {windows.map((window) => (
        <li key={window.start}>
          <span className="rain">{window.rainMm > 0 ? `${String(window.rainMm)}` : ''}</span>
          <span className="bar-track">
            <span
              className="bar"
              style={{ height: `${String(Math.max(4, (window.rainMm / tallest) * 100))}%`, background: LEVEL_COLOUR[window.level] }}
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
    api.places().then(setPlaces, () => undefined);
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

  if (error !== undefined) {
    return (
      <div className="place">
        <a className="back" href={date === undefined ? '#/' : `#/replay/${date}`}>
          <ArrowLeftIcon weight="bold" aria-hidden="true" /> {t('back')}
        </a>
        <p className="error">{error}</p>
      </div>
    );
  }
  if (data === undefined) {
    return (
      <div className="place">
        <p className="loading">{t('loading')}…</p>
      </div>
    );
  }

  const { assessment, guidance, helplines } = data;
  const advice = guidance[language];
  const colour = LEVEL_COLOUR[assessment.level];
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
    <div className="place">
      <a className="back" href={date === undefined ? '#/' : `#/replay/${date}`}>
        <ArrowLeftIcon weight="bold" aria-hidden="true" /> {date === undefined ? t('back') : stormName(date)}
      </a>

      <section className="banner" style={{ background: colour }}>
        <span className="badge">{date === undefined ? t('live') : `${t('replayBadge')}: ${stormName(date)}`}</span>
        <p className="where">{title}</p>
        <h1>
          {LEVEL_NAME[assessment.level][language]}
          <small>{advice.headline}</small>
        </h1>
        {assessment.peak !== undefined && <p className="peak">Worst around {formatHour(assessment.peak.start)}</p>}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>{date === undefined ? t('next48') : `48 h from ${formatHour(assessment.from)}`}</h2>
          <span className="muted">mm / 6 h</span>
        </div>
        <Timeline windows={assessment.windows} />
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>{t('whatToDo')}</h2>
        </div>
        <ul className="actions">
          {advice.actions.map((action) => (
            <li key={action}>
              <CheckCircleIcon weight="fill" aria-hidden="true" style={{ color: colour }} />
              {action}
            </li>
          ))}
        </ul>
        <div className="row">
          <a className="button button-whatsapp" href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noreferrer">
            <WhatsappLogoIcon weight="fill" aria-hidden="true" /> {t('share')}
          </a>
          {helplines.map((line) => (
            <a key={line.number} className="button" href={`tel:${line.number}`}>
              <PhoneIcon weight="bold" aria-hidden="true" /> {line.number}
              <small>{line[language]}</small>
            </a>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
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
        <dl className="facts">
          <div>
            <dt>{t('groundHeight')}</dt>
            <dd>{assessment.terrain.elevation} m</dd>
          </div>
          <div>
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
        <CityMap focus={{ point, level: assessment.level }} reports={reports} onPick={(picked) => (location.hash = placeLink(picked.lat, picked.lon, date))} />
      </section>

      {date === undefined && (
        <section className="panel">
          <div className="panel-head">
            <h2>{t('reportTitle')}</h2>
          </div>
          {reported ? (
            <p className="notice">{t('reportThanks')}</p>
          ) : (
            <div className="row depths">
              {DEPTHS.map((depth) => (
                <button key={depth} type="button" className="button" onClick={() => sendReport(depth)}>
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

      {record !== undefined && (
        <section className="panel">
          <div className="panel-head">
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
          <table className="checks">
            <thead>
              <tr>
                <th>Date</th>
                <th>{t('forecastCol')}</th>
                <th>{t('fellCol')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {[...record.checks]
                .reverse()
                .slice(0, 10)
                .map((check) => (
                  <tr key={check.date}>
                    <td>{check.date}</td>
                    <td>{check.forecastMm} mm</td>
                    <td>{check.observedMm} mm</td>
                    <td className={`verdict verdict-${check.verdict.toLowerCase()}`}>
                      {check.verdict === 'MATCHED' ? t('matched') : check.verdict === 'UNDER_FORECAST' ? t('under') : t('over')}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
