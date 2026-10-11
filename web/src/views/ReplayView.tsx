import { ArrowRightIcon, CloudLightningIcon, WarningDiamondIcon } from '@phosphor-icons/react';
import { useText } from '../i18n.ts';
import { STORMS } from '../storms.ts';

/** The storms that can be replayed, and a plain account of what the main replay shows. */
export function ReplayView() {
  const { t, language } = useText();
  return (
    <div className="stack">
      <header className="page-head page-head-art">
        <div>
          <h1>{t('replay')}</h1>
          <p className="lead">{t('replayIntro')}</p>
        </div>
        <img src="/illustrations/turn-back-time.svg" alt="" />
      </header>

      <ul className="storm-grid">
        {STORMS.map((storm) => (
          <li key={storm.date}>
            <a href={`#/replay/${storm.date}`}>
              <span className="storm-icon">
                <CloudLightningIcon weight="duotone" aria-hidden="true" />
              </span>
              <strong>{storm.name}</strong>
              <small>{storm.note}</small>
              <p>{storm.summary}</p>
              <span className="storm-open">
                {t('openReplay')} <ArrowRightIcon weight="bold" aria-hidden="true" />
              </span>
            </a>
          </li>
        ))}
      </ul>

      <section className="card">
        <div className="card-head">
          <h2>
            <WarningDiamondIcon weight="fill" aria-hidden="true" /> {t('replayResultTitle')}
          </h2>
        </div>
        {language === 'ta' && <p className="muted">{t('howNote')}</p>}
        <ul className="prose-list">
          <li>
            Given the rain on record for 4 December 2023, Vellam rated <strong>50</strong> of 65 localities severe,{' '}
            <strong>12</strong> high and <strong>3</strong> watch.
          </li>
          <li>
            Relief agencies and the press named 17 of those localities as flooded. Vellam rated <strong>16</strong> of them high
            or severe.
          </li>
          <li>
            <strong>It missed Perungudi</strong>, which was still under water five days later. No street near the locality's
            centre point was marked in 2015, and no water body is mapped beside it.
          </li>
          <li>
            <strong>On its own this is weak evidence.</strong> Vellam flagged 62 of 65 localities that day, so a rule that
            warned everyone would have caught the documented ones too. Michaung flooded most of the city, and a replay cannot
            show whether Vellam would stay quiet where it should.
          </li>
          <li>
            Under the ordinary heavy rain of 15 October 2024, the same localities spread out: 33 high, 27 watch, 5 low.
          </li>
        </ul>
        <a className="button button-outline" href="https://github.com/gowtham472/vellam/blob/main/docs/backtest-2023-12-04.md">
          Full table, locality by locality <ArrowRightIcon weight="bold" aria-hidden="true" />
        </a>
      </section>
    </div>
  );
}
