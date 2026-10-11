import {
  BookOpenTextIcon,
  ClockCounterClockwiseIcon,
  FirstAidKitIcon,
  HouseIcon,
  MapPinAreaIcon,
  MoonIcon,
  SunIcon,
  TranslateIcon,
  type Icon,
} from '@phosphor-icons/react';
import { lazy, Suspense, useEffect, useState } from 'react';
import { Mascot } from './components/Mascot.tsx';
import { LanguageContext, useText, type Language, type TextKey } from './i18n.ts';
import { CheckView } from './views/CheckView.tsx';
import { HomeView } from './views/HomeView.tsx';
import { HowView } from './views/HowView.tsx';
import { PlaceView } from './views/PlaceView.tsx';
import { PrepareView } from './views/PrepareView.tsx';
import { ReplayView } from './views/ReplayView.tsx';

// The 3D view brings a map engine and the 2015 record with it, so it loads only when opened.
const TerrainView = lazy(() => import('./views/TerrainView.tsx').then((module) => ({ default: module.TerrainView })));

/**
 * Routes live in the URL hash so a place can be shared as a link and the site needs no
 * server-side routing: `#/`, `#/check`, `#/replay`, `#/replay/2023-12-04`,
 * `#/place/12.97560,80.22070`, `#/place/12.97560,80.22070/2023-12-04`, `#/3d/12.97560,80.22070`,
 * `#/prepare`, `#/how`.
 */
type Route =
  | { view: 'home' }
  | { view: 'check'; date?: string }
  | { view: 'replay' }
  | { view: 'place' | 'terrain'; lat: number; lon: number; date?: string }
  | { view: 'prepare' }
  | { view: 'how' };

type Section = 'home' | 'check' | 'replay' | 'prepare' | 'how';

function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  switch (parts[0]) {
    case 'check':
      return { view: 'check' };
    case 'replay':
      return parts[1] === undefined ? { view: 'replay' } : { view: 'check', date: parts[1] };
    case 'prepare':
      return { view: 'prepare' };
    case 'how':
    case 'about':
      return { view: 'how' };
    case 'place':
    case '3d': {
      const [lat, lon] = (parts[1] ?? '').split(',').map(Number);
      if (lat !== undefined && lon !== undefined && Number.isFinite(lat) && Number.isFinite(lon)) {
        return { view: parts[0] === '3d' ? 'terrain' : 'place', lat, lon, ...(parts[2] === undefined ? {} : { date: parts[2] }) };
      }
      return { view: 'check' };
    }
    default:
      return { view: 'home' };
  }
}

function sectionOf(route: Route): Section {
  if (route.view === 'place' || route.view === 'terrain') return route.date === undefined ? 'check' : 'replay';
  if (route.view === 'check') return route.date === undefined ? 'check' : 'replay';
  return route.view;
}

export function placeLink(lat: number, lon: number, date?: string): string {
  return `#/place/${lat.toFixed(5)},${lon.toFixed(5)}${date === undefined ? '' : `/${date}`}`;
}

const NAV: readonly { section: Section; href: string; label: TextKey; icon: Icon }[] = [
  { section: 'home', href: '#/', label: 'navHome', icon: HouseIcon },
  { section: 'check', href: '#/check', label: 'navCheck', icon: MapPinAreaIcon },
  { section: 'replay', href: '#/replay', label: 'navReplay', icon: ClockCounterClockwiseIcon },
  { section: 'prepare', href: '#/prepare', label: 'navPrepare', icon: FirstAidKitIcon },
  { section: 'how', href: '#/how', label: 'navHow', icon: BookOpenTextIcon },
];

type Theme = 'light' | 'dark';

function stored<T extends string>(key: string, allowed: readonly T[]): T | undefined {
  try {
    const value = localStorage.getItem(key);
    return allowed.includes(value as T) ? (value as T) : undefined;
  } catch {
    return undefined;
  }
}

function remember(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // The choice simply does not persist where storage is unavailable.
  }
}

function initialTheme(): Theme {
  return stored('vellam-theme', ['light', 'dark']) ?? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}

interface ChromeProps {
  readonly section: Section;
  readonly theme: Theme;
  readonly onTheme: () => void;
  readonly onLanguage: () => void;
}

function TopBar({ section, theme, onTheme, onLanguage }: ChromeProps) {
  const { t } = useText();
  const ThemeIcon = theme === 'dark' ? SunIcon : MoonIcon;
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <a className="brand" href="#/" aria-label="Vellam, home">
          <Mascot mood="happy" size={40} />
          <span>
            <strong>Vellam</strong>
            {section !== 'home' && <small lang="ta">வெள்ளம்</small>}
          </span>
        </a>
        <nav className="topnav" aria-label="Main">
          {NAV.filter((item) => item.section !== 'home').map(({ section: target, href, label, icon: NavIcon }) => (
            <a key={target} href={href} className={section === target ? 'active' : ''} aria-current={section === target ? 'page' : undefined}>
              <NavIcon weight={section === target ? 'fill' : 'regular'} aria-hidden="true" />
              {t(label)}
            </a>
          ))}
        </nav>
        <div className="topbar-actions">
          <button type="button" className="icon-button" onClick={onTheme} aria-label={t(theme === 'dark' ? 'themeLight' : 'themeDark')}>
            <ThemeIcon weight="bold" aria-hidden="true" />
          </button>
          {section !== 'home' && (
            <button type="button" className="chip-button" onClick={onLanguage}>
              <TranslateIcon weight="bold" aria-hidden="true" />
              {t('language')}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

/** On a phone the sections sit under the thumb, where a flood app's buttons should be. */
function TabBar({ section }: { section: Section }) {
  const { t } = useText();
  return (
    <nav className="tabbar" aria-label="Sections">
      {NAV.map(({ section: target, href, label, icon: NavIcon }) => (
        <a key={target} href={href} className={section === target ? 'active' : ''} aria-current={section === target ? 'page' : undefined}>
          <NavIcon weight={section === target ? 'fill' : 'regular'} aria-hidden="true" />
          <span>{t(label)}</span>
        </a>
      ))}
    </nav>
  );
}

export function App() {
  const [route, setRoute] = useState<Route>(() => parseRoute(location.hash));
  const [language, setLanguage] = useState<Language>(() => stored('vellam-language', ['en', 'ta']) ?? 'en');
  const [theme, setTheme] = useState<Theme>(initialTheme);

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
    remember('vellam-language', language);
  }, [language]);

  useEffect(() => {
    document.documentElement.dataset['theme'] = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#1c232b' : '#ffffff');
    remember('vellam-theme', theme);
  }, [theme]);

  const section = sectionOf(route);
  const chrome: ChromeProps = {
    section,
    theme,
    onTheme: () => {
      setTheme(theme === 'dark' ? 'light' : 'dark');
    },
    onLanguage: () => {
      setLanguage(language === 'en' ? 'ta' : 'en');
    },
  };

  return (
    // The landing page is written in English only, so its navigation and footer are too.
    // Tamil applies from the first page a resident actually uses.
    <LanguageContext.Provider value={route.view === 'home' ? 'en' : language}>
      <TopBar {...chrome} />
      <main className={route.view === 'home' ? 'page page-wide' : 'page'}>
        {route.view === 'home' && <HomeView />}
        {route.view === 'check' && <CheckView key={route.date ?? 'live'} {...(route.date === undefined ? {} : { date: route.date })} />}
        {route.view === 'replay' && <ReplayView />}
        {route.view === 'prepare' && <PrepareView />}
        {route.view === 'how' && <HowView />}
        {route.view === 'terrain' && (
          <Suspense fallback={<p className="loading">…</p>}>
            <TerrainView
              key={`3d,${String(route.lat)},${String(route.lon)},${route.date ?? ''}`}
              point={{ lat: route.lat, lon: route.lon }}
              {...(route.date === undefined ? {} : { date: route.date })}
            />
          </Suspense>
        )}
        {route.view === 'place' && (
          <PlaceView
            key={`${String(route.lat)},${String(route.lon)},${route.date ?? ''}`}
            point={{ lat: route.lat, lon: route.lon }}
            {...(route.date === undefined ? {} : { date: route.date })}
          />
        )}
      </main>
      <Footer />
      <TabBar section={section} />
    </LanguageContext.Provider>
  );
}

function Footer() {
  const { t } = useText();
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <Mascot mood="calm" size={44} />
          <p>{t('footer')}</p>
        </div>
        <p className="footer-credits">
          Rain and terrain: <a href="https://open-meteo.com">Open-Meteo</a>. Water bodies:{' '}
          <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors. 2015 flooded streets:{' '}
          <a href="https://github.com/osm-in/flood-map">osm-in/flood-map</a>. Illustrations:{' '}
          <a href="https://undraw.co">unDraw</a>.
        </p>
        <p className="footer-credits">
          Built by team DoodleByte: Gowtham K, Jaya Suriya T R, Pranav A S and Kannan K. Code on{' '}
          <a href="https://github.com/gowtham472/vellam">GitHub</a>.
        </p>
      </div>
    </footer>
  );
}
