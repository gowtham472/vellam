import { CrosshairSimpleIcon, MagnifyingGlassIcon, MapPinIcon } from '@phosphor-icons/react';
import { useEffect, useMemo, useState } from 'react';
import { api, type Place } from '../api.ts';
import { placeLink } from '../App.tsx';
import { useText } from '../i18n.ts';

let placesOnce: Promise<Place[]> | undefined;

/** The locality list never changes while the page is open, so it is fetched once and shared. */
export function loadPlaces(): Promise<Place[]> {
  placesOnce ??= api.places().catch((error: unknown) => {
    placesOnce = undefined;
    throw error;
  });
  return placesOnce;
}

/** Search for a locality by its English or Tamil name, or jump to where the phone is. */
export function Finder({ date, autoFocus = false }: { date?: string; autoFocus?: boolean }) {
  const { t, language } = useText();
  const [places, setPlaces] = useState<Place[]>([]);
  const [query, setQuery] = useState('');
  const [locating, setLocating] = useState(false);
  const [notice, setNotice] = useState<string>();

  useEffect(() => {
    loadPlaces().then(setPlaces, () => undefined);
  }, []);

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
          {matches.map((place) => (
            <li key={place.name}>
              <a href={placeLink(place.lat, place.lon, date)}>
                <MapPinIcon weight="fill" aria-hidden="true" />
                <strong>{language === 'ta' && place.ta !== '' ? place.ta : place.name}</strong>
                <small>{language === 'ta' ? place.name : place.ta}</small>
              </a>
            </li>
          ))}
        </ul>
      )}
      {notice !== undefined && <p className="notice notice-warn">{notice}</p>}
    </div>
  );
}
