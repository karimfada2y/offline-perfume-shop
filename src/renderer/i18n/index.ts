import ar from './ar';
import en from './en';

export type Language = 'ar' | 'en';

const translations: Record<Language, Record<string, string>> = { ar, en };

export function t(key: string, lang: Language = 'ar'): string {
  return translations[lang]?.[key] || translations.ar[key] || key;
}

export function getDir(lang: Language): 'rtl' | 'ltr' {
  return lang === 'ar' ? 'rtl' : 'ltr';
}

export { ar, en };
