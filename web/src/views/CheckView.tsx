import { ArrowLeftIcon, CaretRightIcon, HandTapIcon, PauseIcon, PlayIcon } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { formatHour } from '../../../engine/src/core/assess.ts';
import type { Level, Point, Snapshot } from '../../../engine/src/core/types.ts';
import { api } from '../api.ts';
import { placeLink } from '../App.tsx';
import { CityMap, type Region } from '../components/CityMap.tsx';
import { Finder } from '../components/Finder.tsx';
import { Mascot } from '../components/Mascot.tsx';
import { ReservoirCard } from '../components/ReservoirCard.tsx';
import { useText } from '../i18n.ts';
import CountUp from '../vendor/react-bits/CountUp.tsx';
import { LEVEL, LEVELS } from '../level.ts';
import { stormName } from '../storms.ts';

const FRAME_MS = 900;

function formatTime(iso: string, language: string): string {
  return new Date(iso).toLocaleString(`${language}-IN`, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

/** The city map, live or for a replayed storm, with the ways to pick a street. */
export function CheckView({ date }: { date?: string }) {
  const { t, language, levelName } = useText();
  const [snapshot, setSnapshot] = useState<Snapshot>();
  const [error, setError] = useState<string>();
  /** The six hour window shown on the map. Undefined shows each locality's worst level. */
  const [frame, setFrame] = useState<number>();
  const [playing, setPlaying] = useState(false);
  const [region, setRegion] = useState<Region>(date === undefined ? 'INDIA' : 'CHENNAI');

  useEffect(() => {
    api.city(date).then(setSnapshot, (reason: unknown) => {
      setError(reason instanceof Error ? reason.message : String(reason));
    });
  }, [date]);

  const frames = snapshot?.windowStarts.length ?? 0;

  useEffect(() => {
    if (!playing || frames === 0) return;
    const timer = window.setInterval(() => {
      setFrame((current) => {
        const next = (current ?? -1) + 1;
        if (next >= frames) {
          setPlaying(false);
          return undefined;
        }
        return next;
      });
    }, FRAME_MS);
    return () => {
      window.clearInterval(timer);
    };
  }, [playing, frames]);

  const open = (point: Point) => {
    location.hash = placeLink(point.lat, point.lon, date);
  };

  const levelOf = (place: Snapshot['places'][number]): Level => (frame === undefined ? undefined : place.timeline[frame]) ?? place.level;
  const atRisk = snapshot?.places.filter((place) => place.level === 'SEVERE' || place.level === 'HIGH') ?? [];
  const worst = LEVELS.find((level) => snapshot?.places.some((place) => levelOf(place) === level));
  const frameStart = frame === undefined ? undefined : snapshot?.windowStarts[frame];

  return (
    <div className="stack">
      {date !== undefined && (
        <a className="back" href="#/replay">
          <ArrowLeftIcon weight="bold" aria-hidden="true" /> {t('replay')}
        </a>
      )}
      <header className="page-head">
        <Mascot mood={worst === undefined ? 'sleepy' : LEVEL[worst].mood} size={84} />
        <div>
          <h1>{date === undefined ? t('checkTitle') : `${t('replayBadge')}: ${stormName(date)}`}</h1>
          <p className="lead">{date === undefined ? t('checkIntro') : t('replayIntro')}</p>
        </div>
      </header>

      <Finder {...(date === undefined ? {} : { date })} />

      <section className="card">
        <div className="card-head">
          <h2>{date === undefined ? t('cityNow') : stormName(date)}</h2>
          {date === undefined && (
            <div className="switch" role="group" aria-label={t('cityNow')}>
              <button type="button" aria-pressed={region === 'INDIA'} onClick={() => setRegion('INDIA')}>
                India
              </button>
              <button type="button" aria-pressed={region === 'CHENNAI'} onClick={() => setRegion('CHENNAI')}>
                Chennai
              </button>
            </div>
          )}
        </div>
        <ul className="legend" aria-label="Localities by risk level">
          {LEVELS.map((level) => {
            const LevelIcon = LEVEL[level].icon;
            return (
              <li key={level}>
                <LevelIcon weight="fill" aria-hidden="true" style={{ color: LEVEL[level].colour }} />
                {levelName(level)}
                <strong>
                  <CountUp key={`${level}-${String(frame)}`} to={snapshot?.places.filter((place) => levelOf(place) === level).length ?? 0} duration={0.8} />
                </strong>
              </li>
            );
          })}
        </ul>
        <CityMap {...(snapshot === undefined ? {} : { places: snapshot.places })} {...(frame === undefined ? {} : { frame })} region={region} onPick={open} />

        {frames > 0 && (
          <div className="timelapse">
            <button
              type="button"
              className="button button-outline"
              onClick={() => {
                if (!playing && frame === undefined) setFrame(0);
                setPlaying(!playing);
              }}
            >
              {playing ? <PauseIcon weight="fill" aria-hidden="true" /> : <PlayIcon weight="fill" aria-hidden="true" />}
              {playing ? t('pause') : t('play')}
            </button>
            <input
              type="range"
              min={-1}
              max={frames - 1}
              step={1}
              value={frame ?? -1}
              aria-label={t('play')}
              onChange={(event) => {
                const value = Number(event.target.value);
                setPlaying(false);
                setFrame(value < 0 ? undefined : value);
              }}
            />
            <span className="timelapse-when">{frameStart === undefined ? t('worstOf48') : formatHour(frameStart)}</span>
          </div>
        )}

        <p className="muted hint">
          <HandTapIcon weight="bold" aria-hidden="true" /> {t('tapMap')}
          {snapshot !== undefined && date === undefined && ` · ${t('updated')} ${formatTime(snapshot.generatedAt, language)}`}
        </p>
        {date === undefined && <p className="muted">{t('coverage')}</p>}
        {error !== undefined && <p className="notice notice-error">{error}</p>}
      </section>

      {region === 'CHENNAI' && <ReservoirCard {...(date === undefined ? {} : { date })} />}

      <section className="card">
        <div className="card-head">
          <h2>{t('atRiskTitle')}</h2>
        </div>
        {atRisk.length === 0 ? (
          <p className="muted">{snapshot === undefined ? `${t('loading')}…` : t('allClear')}</p>
        ) : (
          <ul className="risk-list">
            {atRisk.map((place) => {
              const LevelIcon = LEVEL[place.level].icon;
              return (
                <li key={place.name}>
                  <a href={placeLink(place.point.lat, place.point.lon, date)}>
                    <span className="pill" style={{ background: LEVEL[place.level].colour }}>
                      <LevelIcon weight="fill" aria-hidden="true" /> {levelName(place.level)}
                    </span>
                    <strong>{place.name}</strong>
                    <span className="muted">
                      {place.worst24hMm} {t('rain24')}
                    </span>
                    <CaretRightIcon weight="bold" aria-hidden="true" />
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
