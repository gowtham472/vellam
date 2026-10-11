import { ClockCounterClockwiseIcon, CrosshairIcon, MagnifyingGlassIcon } from '@phosphor-icons/react';
import { useEffect, useMemo, useState } from 'react';
import type { Level, Point, Snapshot } from '../../../engine/src/core/types.ts';
import { api, type Place } from '../api.ts';
import { placeLink } from '../App.tsx';
import { AlertsForm } from '../components/AlertsForm.tsx';
import { CityMap, LEVEL_COLOUR } from '../components/CityMap.tsx';
import { LEVEL_NAME, useText } from '../i18n.ts';
import { stormName, STORMS } from '../storms.ts';

const LEVELS: readonly Level[] = ['SEVERE', 'HIGH', 'WATCH', 'LOW'];

function formatTime(iso: string, language: string): string {
  return new Date(iso).toLocaleString(language === 'ta' ? 'ta-IN' : 'en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function CityView({ date }: { date?: string }) {
  const { t, language } = useText();
  const [places, setPlaces] = useState<Place[]>([]);
  const [snapshot, setSnapshot] = useState<Snapshot>();
  const [error, setError] = useState<string>();
  const [query, setQuery] = useState('');
  const [locating, setLocating] = useState(false);
  const [notice, setNotice] = useState<string>();

  useEffect(() => {
    api.places().then(setPlaces, () => undefined);
    api.city(date).then(setSnapshot, (reason: unknown) => {
      setError(reason instanceof Error ? reason.message : String(reason));
    });
  }, [date]);

  const open = (point: Point) => {
    location.hash = placeLink(point.lat, point.lon, date);
  };

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle === '') return [];
    return places.filter((place) => place.name.toLowerCase().includes(needle) || place.ta.includes(query.trim())).slice(0, 6);
  }, [places, query]);

  const locate = () => {
    setLocating(true);
    setNotice(undefined);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        open({ lat: position.coords.latitude, lon: position.coords.longitude });
      },
      () => {
        setLocating(false);
        setNotice(t('locationDenied'));
      },
      { timeout: 10_000 },
    );
  };

  const counts = LEVELS.map((level) => ({ level, count: snapshot?.places.filter((place) => place.level === level).length ?? 0 }));
  const atRisk = snapshot?.places.filter((place) => place.level === 'SEVERE' || place.level === 'HIGH') ?? [];

  return (
    <div className="city">
      <section className="hero">
        <h1>{date === undefined ? t('tagline') : `${t('replayBadge')}: ${stormName(date)}`}</h1>
        <p>{date === undefined ? t('intro') : t('replayIntro')}</p>

        <div className="finder">
          <label className="search">
            <MagnifyingGlassIcon weight="bold" aria-hidden="true" />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
              }}
              placeholder={t('searchArea')}
              aria-label={t('chooseArea')}
            />
          </label>
          {date === undefined && (
            <button type="button" className="button" onClick={locate} disabled={locating}>
              <CrosshairIcon weight="bold" aria-hidden="true" />
              {locating ? t('locating') : t('useLocation')}
            </button>
          )}
        </div>
        {matches.length > 0 && (
          <ul className="matches">
            {matches.map((place) => (
              <li key={place.name}>
                <a href={placeLink(place.lat, place.lon, date)}>
                  {language === 'ta' && place.ta !== '' ? place.ta : place.name}
                  <small>{language === 'ta' ? place.name : place.ta}</small>
                </a>
              </li>
            ))}
          </ul>
        )}
        {notice !== undefined && <p className="notice">{notice}</p>}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>{date === undefined ? t('cityNow') : stormName(date)}</h2>
          {snapshot !== undefined && date === undefined && (
            <span className="muted">
              {t('updated')} {formatTime(snapshot.generatedAt, language)}
            </span>
          )}
        </div>
        <ul className="legend" aria-label="Localities by risk level">
          {counts.map(({ level, count }) => (
            <li key={level}>
              <span className="dot" style={{ background: LEVEL_COLOUR[level] }} />
              {LEVEL_NAME[level][language]} <strong>{count}</strong>
            </li>
          ))}
        </ul>
        <CityMap {...(snapshot === undefined ? {} : { places: snapshot.places })} onPick={open} />
        <p className="muted hint">{t('tapMap')}</p>
        {error !== undefined && <p className="error">{error}</p>}

        {atRisk.length > 0 && (
          <ul className="risk-list">
            {atRisk.map((place) => (
              <li key={place.name}>
                <a href={placeLink(place.point.lat, place.point.lon, date)}>
                  <span className="pill" style={{ background: LEVEL_COLOUR[place.level] }}>
                    {LEVEL_NAME[place.level][language]}
                  </span>
                  <strong>{language === 'ta' && place.ta !== '' ? place.ta : place.name}</strong>
                  <span className="muted">
                    {place.worst24hMm} {t('rain24')}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>
            <ClockCounterClockwiseIcon weight="bold" aria-hidden="true" /> {t('replay')}
          </h2>
        </div>
        <div className="storms">
          <a className={date === undefined ? 'storm active' : 'storm'} href="#/">
            <strong>{t('live')}</strong>
            <small>{t('next48')}</small>
          </a>
          {STORMS.map((storm) => (
            <a key={storm.date} className={date === storm.date ? 'storm active' : 'storm'} href={`#/replay/${storm.date}`}>
              <strong>{storm.name}</strong>
              <small>{storm.note}</small>
            </a>
          ))}
        </div>
      </section>

      {date === undefined && <AlertsForm />}
    </div>
  );
}
