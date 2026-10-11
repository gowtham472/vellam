import { useEffect, useState } from 'react';
import { AboutView } from './views/AboutView.tsx';
import { CityView } from './views/CityView.tsx';
import { PlaceView } from './views/PlaceView.tsx';
import { LanguageContext, useText, type Language } from './i18n.ts';

/**
 * Routes live in the URL hash so a place can be shared as a link and the site needs no
 * server-side routing: `#/`, `#/replay/2023-12-04`, `#/place/12.97560,80.22070`,
 * `#/place/12.97560,80.22070/2023-12-04`, `#/about`.
 */
type Route =
  | { view: 'city'; date?: string }
  | { view: 'place'; lat: number; lon: number; date?: string }
  | { view: 'about' };

function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (parts[0] === 'about') return { view: 'about' };
  if (parts[0] === 'replay' && parts[1] !== undefined) return { view: 'city', date: parts[1] };
  if (parts[0] === 'place' && parts[1] !== undefined) {
    const [lat, lon] = parts[1].split(',').map(Number);
    if (lat !== undefined && lon !== undefined && Number.isFinite(lat) && Number.isFinite(lon)) {
      return { view: 'place', lat, lon, ...(parts[2] === undefined ? {} : { date: parts[2] }) };
    }
  }
  return { view: 'city' };
}

export function placeLink(lat: number, lon: number, date?: string): string {
  return `#/place/${lat.toFixed(5)},${lon.toFixed(5)}${date === undefined ? '' : `/${date}`}`;
}

function storedLanguage(): Language {
  try {
    return localStorage.getItem('vellam-language') === 'ta' ? 'ta' : 'en';
  } catch {
    return 'en';
  }
}

function Header({ onToggle }: { onToggle: () => void }) {
  const { t } = useText();
  return (
    <header className="header">
      <a className="brand" href="#/">
        <img src="/favicon.svg" alt="" width="34" height="34" />
        <span>
          <strong>Vellam</strong>
          <small lang="ta">வெள்ளம்</small>
        </span>
      </a>
      <nav>
        <a href="#/about">{t('aboutShort')}</a>
        <button type="button" className="language" onClick={onToggle}>
          {t('language')}
        </button>
      </nav>
    </header>
  );
}

export function App() {
  const [route, setRoute] = useState<Route>(() => parseRoute(location.hash));
  const [language, setLanguage] = useState<Language>(storedLanguage);

  useEffect(() => {
    const onChange = () => {
      setRoute(parseRoute(location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => {
      window.removeEventListener('hashchange', onChange);
    };
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    try {
      localStorage.setItem('vellam-language', language);
    } catch {
      // The choice simply does not persist where storage is unavailable.
    }
  }, [language]);

  return (
    <LanguageContext.Provider value={language}>
      <Header
        onToggle={() => {
          setLanguage(language === 'en' ? 'ta' : 'en');
        }}
      />
      <main>
        {route.view === 'about' && <AboutView />}
        {route.view === 'city' && <CityView key={route.date ?? 'live'} {...(route.date === undefined ? {} : { date: route.date })} />}
        {route.view === 'place' && (
          <PlaceView
            key={`${String(route.lat)},${String(route.lon)},${route.date ?? ''}`}
            point={{ lat: route.lat, lon: route.lon }}
            {...(route.date === undefined ? {} : { date: route.date })}
          />
        )}
      </main>
      <footer className="footer">
        Rain forecast and terrain from Open-Meteo. Water bodies from OpenStreetMap contributors. 2015 flooded streets
        from the osm-in flood map. Vellam is a guide, not an official warning: follow IMD and Greater Chennai
        Corporation advisories.
      </footer>
    </LanguageContext.Provider>
  );
}
