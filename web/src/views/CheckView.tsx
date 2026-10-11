import { ArrowLeftIcon, CaretRightIcon, HandTapIcon, PauseIcon, PlayIcon } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { formatHour } from '../../../engine/src/core/assess.ts';
import type { Level, Point, Snapshot } from '../../../engine/src/core/types.ts';
import { api } from '../api.ts';
import { placeLink } from '../App.tsx';
import { CityMap } from '../components/CityMap.tsx';
import { Finder } from '../components/Finder.tsx';
import { Mascot } from '../components/Mascot.tsx';
import { ReservoirCard } from '../components/ReservoirCard.tsx';
import { LEVEL_NAME, useText } from '../i18n.ts';
import { LEVEL, LEVELS } from '../level.ts';
import { stormName } from '../storms.ts';

const FRAME_MS = 900;

function formatTime(iso: string, language: string): string {
  return new Date(iso).toLocaleString(language === 'ta' ? 'ta-IN' : 'en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

/** The city map, live or for a replayed storm, with the ways to pick a street. */
export function CheckView({ date }: { date?: string }) {
  const { t, language } = useText();
  const [snapshot, setSnapshot] = useState<Snapshot>();
  const [error, setError] = useState<string>();
  /** The six hour window shown on the map. Undefined shows each locality's worst level. */
  const [frame, setFrame] = useState<number>();
  const [playing, setPlaying] = useState(false);

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
          {snapshot !== undefined && date === undefined && (
            <span className="muted">
              {t('updated')} {formatTime(snapshot.generatedAt, language)}
            </span>
          )}
        </div>
        <ul className="legend" aria-label="Localities by risk level">
          {LEVELS.map((level) => {
            const LevelIcon = LEVEL[level].icon;
            return (
              <li key={level}>
                <LevelIcon weight="fill" aria-hidden="true" style={{ color: LEVEL[level].colour }} />
                {LEVEL_NAME[level][language]}
                <strong>{snapshot?.places.filter((place) => levelOf(place) === level).length ?? 0}</strong>
              </li>
            );
          })}
        </ul>
        <CityMap {...(snapshot === undefined ? {} : { places: snapshot.places })} {...(frame === undefined ? {} : { frame })} onPick={open} />

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
        </p>
        {error !== undefined && <p className="notice notice-error">{error}</p>}
      </section>

      <ReservoirCard {...(date === undefined ? {} : { date })} />

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
                      <LevelIcon weight="fill" aria-hidden="true" /> {LEVEL_NAME[place.level][language]}
                    </span>
                    <strong>{language === 'ta' && place.ta !== '' ? place.ta : place.name}</strong>
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
