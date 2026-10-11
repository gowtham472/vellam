import { DropHalfBottomIcon } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { HEAVY_RELEASE_CUSECS, NEARLY_FULL_PERCENT, RESERVOIR_SOURCE, type ReservoirReport } from '../../../engine/src/core/reservoirs.ts';
import { api } from '../api.ts';
import { useText } from '../i18n.ts';

function titleCase(name: string): string {
  return name.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/**
 * How full each reservoir is and how much it is letting go. A reservoir past the same
 * thresholds the engine uses is marked, so the card and the assessment never disagree.
 */
export function ReservoirCard({ date }: { date?: string }) {
  const { t } = useText();
  const [report, setReport] = useState<ReservoirReport>();

  useEffect(() => {
    api.reservoirs(date).then(setReport, () => undefined);
  }, [date]);

  if (report === undefined) return null;
  return (
    <section className="card">
      <div className="card-head">
        <h2>
          <DropHalfBottomIcon weight="fill" aria-hidden="true" /> {t('reservoirsTitle')}
        </h2>
      </div>
      <p className="muted">
        {t('reservoirsIntro')} {report.asOn}. <a href={RESERVOIR_SOURCE}>cmwssb.tn.gov.in</a>
      </p>
      <ul className="reservoirs">
        {report.readings.map((reading) => {
          const high = reading.storagePercent >= NEARLY_FULL_PERCENT || (reading.outflowCusecs ?? 0) >= HEAVY_RELEASE_CUSECS;
          return (
            <li key={reading.name} className={high ? 'reservoir-high' : ''}>
              <strong>{titleCase(reading.name)}</strong>
              <span className="reservoir-bar" aria-hidden="true">
                <i style={{ width: `${String(Math.min(100, reading.storagePercent))}%` }} />
              </span>
              <span className="reservoir-figures">
                {reading.storagePercent.toFixed(0)}% {t('full')}
                {reading.outflowCusecs !== null && `, ${t('releasing')} ${Math.round(reading.outflowCusecs).toLocaleString('en-IN')} ${t('cusecs')}`}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
