import { CrosshairSimpleIcon, MagnifyingGlassIcon, MapPinIcon } from '@phosphor-icons/react';
import { useEffect, useMemo, useState } from 'react';
import type { Point } from '../../../engine/src/core/types.ts';
import { api, type Place } from '../api.ts';
import { placeLink } from '../App.tsx';
import { useText } from '../i18n.ts';

let placesOnce: Promise<Place[]> | undefined;

/** The list of watched places never changes while the page is open, so it is fetched once and shared. */
export function loadPlaces(): Promise<Place[]> {
  placesOnce ??= api.places().catch((error: unknown) => {
    placesOnce = undefined;
    throw error;
  });
  return placesOnce;
}

interface Match {
  readonly name: string;
  readonly region: string;
  readonly lat: number;
  readonly lon: number;
}

interface GeocodingResult {
  readonly name: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly admin1?: string;
  readonly admin2?: string;
}

const GEOCODER = 'https://geocoding-api.open-meteo.com/v1/search';
const MAX_MATCHES = 6;
const SEARCH_DELAY_MS = 300;

/**
 * Looks a name up among India's cities, towns and villages. The gazetteer behind it does
 * not hold street names, which is why the page also offers the map and the phone's location.
 */
async function searchIndia(name: string, signal: AbortSignal): Promise<Match[]> {
  const response = await fetch(`${GEOCODER}?name=${encodeURIComponent(name)}&count=${String(MAX_MATCHES)}&language=en&countryCode=IN&format=json`, { signal });
  if (!response.ok) throw new Error(`Place search failed (${String(response.status)})`);
  const body = (await response.json()) as { results?: GeocodingResult[] };
  return (body.results ?? []).map((result) => ({
    name: result.name,
    region: [result.admin2, result.admin1].filter((part) => part !== undefined && part !== result.name).join(', '),
    lat: result.latitude,
    lon: result.longitude,
  }));
}

function nameKey(point: Point): string {
  return `vellam-name:${point.lat.toFixed(3)},${point.lon.toFixed(3)}`;
}

/** The name a visitor picked for a spot, kept for this tab so the answer page can show it. */
export function pickedName(point: Point): string | undefined {
  try {
    return sessionStorage.getItem(nameKey(point)) ?? undefined;
  } catch {
    return undefined;
  }
}

function rememberName(match: Match): void {
  try {
    sessionStorage.setItem(nameKey(match), match.region === '' ? match.name : `${match.name}, ${match.region}`);
  } catch {
    // Without storage the answer page shows coordinates instead of the name.
  }
}

/** Search for a place anywhere in India, or jump to where the phone is. */
export function Finder({ date, autoFocus = false }: { date?: string; autoFocus?: boolean }) {
  const { t } = useText();
  const [places, setPlaces] = useState<Place[]>([]);
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<{ query: string; matches: Match[] }>();
  const [locating, setLocating] = useState(false);
  const [notice, setNotice] = useState<string>();

  useEffect(() => {
    loadPlaces().then(setPlaces, () => undefined);
  }, []);

  const needle = query.trim().toLowerCase();
  const watched = useMemo<Match[]>(() => {
    if (needle === '') return [];
    return places
      .filter((place) => place.name.toLowerCase().includes(needle) && (date === undefined || place.kind === 'LOCALITY'))
      .slice(0, MAX_MATCHES)
      .map((place) => ({ name: place.name, region: place.kind === 'LOCALITY' ? 'Chennai, Tamil Nadu' : '', lat: place.lat, lon: place.lon }));
  }, [places, needle, date]);

  // A replay covers Chennai only, so the national search is offered for the live forecast.
  useEffect(() => {
    if (needle.length < 3 || date !== undefined) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      searchIndia(needle, controller.signal).then(
        (matches) => {
          setFound({ query: needle, matches });
        },
        () => undefined,
      );
    }, SEARCH_DELAY_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [needle, date]);

  const searched = found?.query === needle ? found.matches : undefined;
  const matches = [...watched, ...(searched ?? []).filter((match) => watched.every((known) => known.name !== match.name))].slice(0, MAX_MATCHES);

  const locate = () => {
    setLocating(true);
    setNotice(undefined);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        location.hash = placeLink(position.coords.latitude, position.coords.longitude, date);
      },
      () => {
        setLocating(false);
        setNotice(t('locationDenied'));
      },
      { timeout: 10_000 },
    );
  };

  return (
    <div className="finder">
      <div className="finder-row">
        <label className="search">
          <MagnifyingGlassIcon weight="bold" aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
            placeholder={t('searchArea')}
            aria-label={t('chooseArea')}
            autoFocus={autoFocus}
            autoComplete="off"
          />
        </label>
        {date === undefined && (
          <button type="button" className="button button-outline" onClick={locate} disabled={locating}>
            <CrosshairSimpleIcon weight="bold" aria-hidden="true" />
            {locating ? t('locating') : t('useLocation')}
          </button>
        )}
      </div>
      {matches.length > 0 && (
        <ul className="matches">
          {matches.map((match) => (
            <li key={`${match.name},${String(match.lat)},${String(match.lon)}`}>
              <a
                href={placeLink(match.lat, match.lon, date)}
                onClick={() => {
                  rememberName(match);
                }}
              >
                <MapPinIcon weight="fill" aria-hidden="true" />
                <strong>{match.name}</strong>
                <small>{match.region}</small>
              </a>
            </li>
          ))}
        </ul>
      )}
      {matches.length === 0 && searched !== undefined && <p className="muted">{t('searchNone')}</p>}
      {notice !== undefined && <p className="notice notice-warn">{notice}</p>}
    </div>
  );
}
