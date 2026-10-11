import { PaperPlaneTiltIcon } from '@phosphor-icons/react';
import { useState, type FormEvent } from 'react';
import type { Point } from '../../../engine/src/core/types.ts';
import { api } from '../api.ts';
import { useText } from '../i18n.ts';
import { Mascot } from './Mascot.tsx';

/** Subscribes to alerts for the city, or for one street when `street` is given. */
export function AlertsForm({ street }: { street?: { point: Point; name: string } }) {
  const { t } = useText();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<{ ok: boolean; text: string }>();
  const [sending, setSending] = useState(false);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setSending(true);
    setMessage(undefined);
    api
      .subscribe(email, street)
      .then(
        (result) => {
          setMessage({ ok: true, text: result.message });
          setEmail('');
        },
        (reason: unknown) => {
          setMessage({ ok: false, text: reason instanceof Error ? reason.message : String(reason) });
        },
      )
      .finally(() => {
        setSending(false);
      });
  };

  return (
    <section className="alerts-card">
      <Mascot mood={message?.ok === true ? 'wink' : 'happy'} size={96} />
      <div>
        <h2>{t(street === undefined ? 'alertsTitle' : 'streetAlertTitle')}</h2>
        <p className="muted">{t(street === undefined ? 'alertsText' : 'streetAlertText')}</p>
        <form className="alerts-form" onSubmit={submit}>
          <input
            type="email"
            required
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
            }}
            placeholder={t('email')}
            aria-label={t('email')}
          />
          <button type="submit" className="button button-solid" disabled={sending}>
            <PaperPlaneTiltIcon weight="fill" aria-hidden="true" />
            {t('alertsButton')}
          </button>
        </form>
        {message !== undefined && <p className={message.ok ? 'notice' : 'notice notice-error'}>{message.text}</p>}
      </div>
    </section>
  );
}
