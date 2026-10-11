import { CheckCircleIcon, PhoneCallIcon } from '@phosphor-icons/react';
import { GUIDANCE_SOURCE, guidanceFor, HELPLINE_SOURCE, HELPLINES } from '../../../engine/src/core/guidance.ts';
import type { Level } from '../../../engine/src/core/types.ts';
import { AlertsForm } from '../components/AlertsForm.tsx';
import { Mascot } from '../components/Mascot.tsx';
import { LEVEL_NAME, useText } from '../i18n.ts';
import { LEVEL } from '../level.ts';

const ORDER: readonly Level[] = ['WATCH', 'HIGH', 'SEVERE'];

/** What each level asks of a household, the numbers to call, and a way to be told. */
export function PrepareView() {
  const { t, language } = useText();
  return (
    <div className="stack">
      <header className="page-head page-head-art">
        <div>
          <h1>{t('prepareTitle')}</h1>
          <p className="lead">{t('prepareIntro')}</p>
        </div>
        <img src="/illustrations/checklist.svg" alt="" />
      </header>

      <div className="level-grid">
        {ORDER.map((level) => {
          const advice = guidanceFor(level, language);
          const LevelIcon = LEVEL[level].icon;
          return (
            <section key={level} className="level-card" style={{ borderTopColor: LEVEL[level].colour }}>
              <div className="level-card-head">
                <Mascot mood={LEVEL[level].mood} size={72} />
                <div>
                  <span className="pill" style={{ background: LEVEL[level].colour }}>
                    <LevelIcon weight="fill" aria-hidden="true" /> {LEVEL_NAME[level][language]}
                  </span>
                  <h2>{advice.headline}</h2>
                </div>
              </div>
              <ul className="actions">
                {advice.actions.map((action) => (
                  <li key={action}>
                    <CheckCircleIcon weight="fill" aria-hidden="true" style={{ color: LEVEL[level].colour }} />
                    {action}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
      <p className="muted">
        Based on the <a href={GUIDANCE_SOURCE}>National Disaster Management Authority</a>'s flood guidance.
      </p>

      <section className="card">
        <div className="card-head">
          <h2>
            <PhoneCallIcon weight="fill" aria-hidden="true" /> {t('helplines')}
          </h2>
        </div>
        <p className="muted">{t('helplinesIntro')}</p>
        <div className="helplines">
          {HELPLINES.map((line) => (
            <a key={line.number} href={`tel:${line.number}`} className="helpline">
              <strong>{line.number}</strong>
              <span>{line[language]}</span>
            </a>
          ))}
        </div>
        <p className="muted">
          Numbers from the <a href={HELPLINE_SOURCE}>Tamil Nadu State Disaster Management Authority</a> directory.
        </p>
      </section>

      <AlertsForm />
    </div>
  );
}
