// ============================================================================
// LANGUAGE RUNTIME - stores the choice, applies RTL/LTR, exposes t()
// Default language: French. The choice is remembered in localStorage.
// ============================================================================

import { translations } from './translations.js';

const STORAGE_KEY = 'esst_lang';

// Locale tags used for date formatting. Arabic forces Latin digits
// (ar-u-nu-latn) so football scores stay readable.
const LOCALES = { fr: 'fr-FR', en: 'en-GB', ar: 'ar-u-nu-latn' };

let current = 'fr';

/** Available languages, used by the header selector. */
export const LANGUAGES = [
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'English' },
  { code: 'ar', label: 'العربية' },
];

/** Read the saved language (or default to French) and apply it to <html>. */
export function initLanguage() {
  let saved = null;
  try {
    saved = localStorage.getItem(STORAGE_KEY);
  } catch {
    /* private mode etc. */
  }
  current = saved && translations[saved] ? saved : 'fr';
  applyToDocument();
}

/** Change the language, remember it, and notify the whole app. */
export function setLanguage(code) {
  if (!translations[code]) return;
  current = code;
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {
    /* ignore */
  }
  applyToDocument();
  document.dispatchEvent(new CustomEvent('app:languagechange'));
}

export function getLanguage() {
  return current;
}

/** Locale tag for Intl date formatting of the current language. */
export function getLocale() {
  return LOCALES[current] ?? 'fr-FR';
}

/** True when the interface runs right-to-left. */
export function isRTL() {
  return current === 'ar';
}

/** Apply lang + dir attributes to the document (RTL for Arabic). */
function applyToDocument() {
  const html = document.documentElement;
  html.lang = current;
  html.dir = current === 'ar' ? 'rtl' : 'ltr';
}

/**
 * Translate a key in the current language.
 * Falls back to French, then to the key itself.
 * Params: t('home.stats.title') or t('any.key', { count: 4 })
 */
export function t(key, params) {
  let text = translations[current]?.[key] ?? translations.fr[key] ?? key;
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
  }
  return text;
}
