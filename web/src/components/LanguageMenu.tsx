import { CaretDownIcon, CheckIcon, TranslateIcon } from '@phosphor-icons/react';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { LANGUAGES, useText, type Language } from '../i18n.ts';

/**
 * The language picker: a button and a list drawn by the page, so each language is shown in
 * its own script at a readable size, which a browser's own list does not allow.
 */
export function LanguageMenu({ language, onLanguage }: { language: Language; onLanguage: (language: Language) => void }) {
  const { t } = useText();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const listId = useId();
  const current = LANGUAGES.find((item) => item.code === language) ?? LANGUAGES[0];

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (root.current !== null && !root.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => {
      document.removeEventListener('pointerdown', close);
    };
  }, [open]);

  // The list takes focus when it opens, so the arrow keys work at once.
  useEffect(() => {
    if (open) list.current?.focus();
  }, [open]);

  const show = () => {
    setActive(Math.max(0, LANGUAGES.findIndex((item) => item.code === language)));
    setOpen(true);
  };

  const choose = (index: number) => {
    const picked = LANGUAGES[index];
    if (picked !== undefined) onLanguage(picked.code);
    setOpen(false);
  };

  const onKey = (event: KeyboardEvent) => {
    const last = LANGUAGES.length - 1;
    const moves: Record<string, number> = { ArrowDown: Math.min(last, active + 1), ArrowUp: Math.max(0, active - 1), Home: 0, End: last };
    const next = moves[event.key];
    if (next !== undefined) {
      event.preventDefault();
      setActive(next);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      choose(active);
    } else if (event.key === 'Escape' || event.key === 'Tab') {
      setOpen(false);
    }
  };

  return (
    <div className="language" ref={root}>
      <button
        type="button"
        className="chip-button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`${t('language')}: ${current.name}`}
        onClick={() => {
          if (open) setOpen(false);
          else show();
        }}
      >
        <TranslateIcon weight="bold" aria-hidden="true" />
        <span lang={current.code}>{current.name}</span>
        <CaretDownIcon className="language-caret" weight="bold" aria-hidden="true" />
      </button>
      {open && (
        <ul
          className="language-list"
          id={listId}
          ref={list}
          role="listbox"
          tabIndex={-1}
          aria-label={t('language')}
          aria-activedescendant={`${listId}-${String(active)}`}
          onKeyDown={onKey}
        >
          {LANGUAGES.map((item, index) => (
            <li
              key={item.code}
              id={`${listId}-${String(index)}`}
              role="option"
              lang={item.code}
              aria-selected={item.code === language}
              className={index === active ? 'active' : ''}
              onPointerEnter={() => {
                setActive(index);
              }}
              onClick={() => {
                choose(index);
              }}
            >
              <span>{item.name}</span>
              {item.code === language && <CheckIcon weight="bold" aria-hidden="true" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
