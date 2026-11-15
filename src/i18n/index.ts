import { ar, type TranslationKeys } from './ar';
import { en } from './en';
import type { Language } from '../types/guest';

export const translations: Record<Language, TranslationKeys> = {
  ar,
  en,
};

export function getTranslations(lang: Language): TranslationKeys {
  return translations[lang] ?? ar;
}
