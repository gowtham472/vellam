import { PaperPlaneTiltIcon } from '@phosphor-icons/react';
import { useState, type FormEvent } from 'react';
import { api } from '../api.ts';
import { useText } from '../i18n.ts';
import { Mascot } from './Mascot.tsx';

export function AlertsForm() {
  const { t } = useText();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<{ ok: boolean; text: string }>();
  const [sending, setSending] = useState(false);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setSending(true);
    setMessage(undefined);
    api
      .subscribe(email)
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
      <Mascot pose={message?.ok === true ? 'wink' : 'mail'} size={96} />
      <div>
        <h2>{t('alertsTitle')}</h2>
        <p className="muted">{t('alertsText')}</p>
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
