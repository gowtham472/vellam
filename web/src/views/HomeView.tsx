import {
  ArrowRightIcon,
  ChatsCircleIcon,
  ClockCounterClockwiseIcon,
  CloudRainIcon,
  ListChecksIcon,
  MapPinAreaIcon,
  MapTrifoldIcon,
  ScalesIcon,
  SealCheckIcon,
  TranslateIcon,
  UsersThreeIcon,
  WhatsappLogoIcon,
  type Icon,
} from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import type { Level, Snapshot } from '../../../engine/src/core/types.ts';
import { api } from '../api.ts';
import { Finder } from '../components/Finder.tsx';
import { Mascot } from '../components/Mascot.tsx';
import { useText, type TextKey } from '../i18n.ts';
import { LEVEL } from '../level.ts';

const STEPS: readonly { icon: Icon; title: TextKey; text: TextKey; art: string }[] = [
  { icon: CloudRainIcon, title: 'step1Title', text: 'step1Text', art: 'weather-forecast' },
  { icon: MapTrifoldIcon, title: 'step2Title', text: 'step2Text', art: 'location-search' },
  { icon: ListChecksIcon, title: 'step3Title', text: 'step3Text', art: 'checklist' },
];

const FEATURES: readonly { icon: Icon; title: TextKey; text: TextKey }[] = [
  { icon: ScalesIcon, title: 'featWhyTitle', text: 'featWhyText' },
  { icon: ClockCounterClockwiseIcon, title: 'featMemoryTitle', text: 'featMemoryText' },
  { icon: UsersThreeIcon, title: 'featNeighbourTitle', text: 'featNeighbourText' },
  { icon: SealCheckIcon, title: 'featCheckTitle', text: 'featCheckText' },
  { icon: WhatsappLogoIcon, title: 'featShareTitle', text: 'featShareText' },
  { icon: TranslateIcon, title: 'featTamilTitle', text: 'featTamilText' },
];

const STATS: readonly { value: string; label: TextKey }[] = [
  { value: '7,851', label: 'statStreets' },
  { value: '65', label: 'statLocalities' },
  { value: '48', label: 'statHours' },
  { value: '30', label: 'statDays' },
];

/** What the mascot says: the state of the city right now, read from the live snapshot. */
function useCityMood(): { level: Level; line: string } | undefined {
  const { t } = useText();
  const [snapshot, setSnapshot] = useState<Snapshot>();
  useEffect(() => {
    api.city().then(setSnapshot, () => undefined);
  }, []);
  if (snapshot === undefined) return undefined;
  const count = (levels: readonly Level[]) => snapshot.places.filter((place) => levels.includes(place.level)).length;
  const atRisk = count(['HIGH', 'SEVERE']);
  if (atRisk > 0) {
    return { level: snapshot.places.some((place) => place.level === 'SEVERE') ? 'SEVERE' : 'HIGH', line: t('mascotRisk', { n: atRisk }) };
  }
  const watching = count(['WATCH']);
  if (watching > 0) return { level: 'WATCH', line: t('mascotWatch', { n: watching }) };
  return { level: 'LOW', line: t('mascotCalm', { n: snapshot.places.length }) };
}

export function HomeView() {
  const { t } = useText();
  const mood = useCityMood();

  return (
    <div className="home">
      <section className="hero">
        <div className="hero-copy">
          <span className="kicker">
            <MapPinAreaIcon weight="fill" aria-hidden="true" /> {t('heroKicker')}
          </span>
          <h1>{t('tagline')}</h1>
          <p className="lead">{t('intro')}</p>
          <Finder />
          <div className="cta-row">
            <a className="button button-solid button-large" href="#/check">
              {t('ctaCheck')} <ArrowRightIcon weight="bold" aria-hidden="true" />
            </a>
            <a className="button button-ghost button-large" href="#/replay/2023-12-04">
              <ClockCounterClockwiseIcon weight="bold" aria-hidden="true" /> {t('ctaReplay')}
            </a>
          </div>
        </div>

        <div className="hero-stage">
          <div className="rain" aria-hidden="true">
            {Array.from({ length: 14 }, (_, i) => (
              <span key={i} style={{ left: `${String(6 + i * 6.6)}%`, animationDelay: `${String((i * 0.37) % 2.2)}s` }} />
            ))}
          </div>
          <Mascot pose={mood === undefined ? 'sleepy' : LEVEL[mood.level].pose} size={300} float className="hero-mascot" />
          <div className="speech" style={mood === undefined ? undefined : { borderColor: LEVEL[mood.level].colour }} role="status">
            <ChatsCircleIcon weight="fill" aria-hidden="true" style={mood === undefined ? undefined : { color: LEVEL[mood.level].colour }} />
            <p>{mood?.line ?? `${t('mascotLoading')}…`}</p>
          </div>
        </div>
      </section>

      <section className="stats" aria-label="Vellam in numbers">
        {STATS.map((stat) => (
          <div key={stat.label}>
            <strong>{stat.value}</strong>
            <span>{t(stat.label)}</span>
          </div>
        ))}
      </section>

      <section className="block">
        <h2 className="block-title">{t('howTitle')}</h2>
        <ol className="steps">
          {STEPS.map(({ icon: StepIcon, title, text, art }, index) => (
            <li key={title}>
              <img src={`/illustrations/${art}.svg`} alt="" loading="lazy" />
              <span className="step-number">
                <StepIcon weight="fill" aria-hidden="true" /> {index + 1}
              </span>
              <h3>{t(title)}</h3>
              <p>{t(text)}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="block block-tint">
        <h2 className="block-title">{t('featuresTitle')}</h2>
        <ul className="features">
          {FEATURES.map(({ icon: FeatureIcon, title, text }) => (
            <li key={title}>
              <span className="feature-icon">
                <FeatureIcon weight="duotone" aria-hidden="true" />
              </span>
              <h3>{t(title)}</h3>
              <p>{t(text)}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="block split">
        <img src="/illustrations/turn-back-time.svg" alt="" loading="lazy" />
        <div>
          <h2 className="block-title">{t('replayTeaserTitle')}</h2>
          <p className="lead">{t('replayTeaserText')}</p>
          <a className="button button-solid" href="#/replay">
            <ClockCounterClockwiseIcon weight="bold" aria-hidden="true" /> {t('replay')}
          </a>
        </div>
      </section>

      <section className="block split split-reverse honest">
        <Mascot pose="look_left" size={200} />
        <div>
          <h2 className="block-title">{t('honestTitle')}</h2>
          <p className="lead">{t('honestText')}</p>
          <a className="button button-outline" href="#/how">
            {t('readMethod')} <ArrowRightIcon weight="bold" aria-hidden="true" />
          </a>
        </div>
      </section>

      <section className="final">
        <img src="/illustrations/walking-in-rain.svg" alt="" loading="lazy" />
        <div>
          <h2>{t('finalTitle')}</h2>
          <p>{t('finalText')}</p>
          <a className="button button-invert button-large" href="#/check">
            {t('ctaCheck')} <ArrowRightIcon weight="bold" aria-hidden="true" />
          </a>
        </div>
      </section>
    </div>
  );
}
