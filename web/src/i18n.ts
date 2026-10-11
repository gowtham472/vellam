import { createContext, useContext } from 'react';
import type { Guidance } from '../../engine/src/core/guidance.ts';
import type { Level, WaterDepth } from '../../engine/src/core/types.ts';
import ENGLISH from './locales/en.json';

/** The languages the interface is offered in, each under its own name. */
export const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'hi', name: 'हिन्दी' },
  { code: 'bn', name: 'বাংলা' },
  { code: 'te', name: 'తెలుగు' },
  { code: 'mr', name: 'मराठी' },
  { code: 'ta', name: 'தமிழ்' },
  { code: 'ur', name: 'اردو' },
  { code: 'gu', name: 'ગુજરાતી' },
  { code: 'kn', name: 'ಕನ್ನಡ' },
  { code: 'ml', name: 'മലയാളം' },
  { code: 'or', name: 'ଓଡ଼ିଆ' },
  { code: 'pa', name: 'ਪੰਜਾਬੀ' },
  { code: 'as', name: 'অসমীয়া' },
] as const;

export type Language = (typeof LANGUAGES)[number]['code'];
export type TextKey = keyof typeof ENGLISH;
export type TextTable = Partial<Record<TextKey, string>>;

const FILES = import.meta.glob<{ default: TextTable }>('./locales/*.json');

/**
 * Fetches one language's text. Only English ships with the page; the others are fetched
 * when chosen, so a visitor does not download twelve languages to read one.
 */
export async function loadLanguage(language: Language): Promise<TextTable> {
  const load = FILES[`./locales/${language}.json`];
  if (language === 'en' || load === undefined) return ENGLISH;
  return (await load()).default;
}

export interface Translation {
  readonly language: Language;
  readonly table: TextTable;
}

export const LanguageContext = createContext<Translation>({ language: 'en', table: ENGLISH });

/**
 * Interface text in the chosen language. A string missing from a translation falls back to
 * English. The reasons behind an assessment come from the engine in English only, and the
 * interface says so in the chosen language, so nobody takes untranslated text for a fault.
 */
export function useText(): {
  language: Language;
  t: (key: TextKey) => string;
  levelName: (level: Level) => string;
  depthName: (depth: WaterDepth) => string;
  helplineName: (line: { number: string; en: string }) => string;
  advice: (level: Level, english: Guidance) => Guidance;
} {
  const { language, table } = useContext(LanguageContext);
  const find = (key: string): string | undefined => {
    const text = table[key as TextKey] ?? (ENGLISH as Record<string, string>)[key];
    return text === '' ? undefined : text;
  };
  return {
    language,
    t: (key) => find(key) ?? '',
    levelName: (level) => find(`level${level}`) ?? level,
    depthName: (depth) => find(`depth${depth}`) ?? depth,
    helplineName: (line) => find(`helpline${line.number}`) ?? line.en,
    advice: (level, english) => ({
      headline: find(`guide${level}`) ?? english.headline,
      actions: english.actions.map((action, index) => find(`guide${level}${String(index + 1)}`) ?? action),
    }),
  };
}
