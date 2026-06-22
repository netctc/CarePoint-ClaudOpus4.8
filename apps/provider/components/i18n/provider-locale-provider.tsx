'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getProviderDictionary, normalizeProviderLocale, type LocaleCode } from '@/lib/i18n/provider-dictionary';
import { readCookie } from '@/lib/auth/browser-session';

type ProviderLocaleContextValue = {
  locale: LocaleCode;
  dir: 'ltr' | 'rtl';
  t: ReturnType<typeof getProviderDictionary>;
  setLocale: (locale: LocaleCode) => void;
  toggleLocale: () => void;
};

const ProviderLocaleContext = createContext<ProviderLocaleContextValue | null>(null);

function persistLocale(locale: LocaleCode) {
  if (typeof document === 'undefined') return;
  document.cookie = `cc_locale=${encodeURIComponent(locale)}; path=/; SameSite=Lax; max-age=31536000`;
  window.localStorage.setItem('cc_locale', locale);
}

export function ProviderLocaleProvider({ initialLocale, children }: { initialLocale: LocaleCode; children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<LocaleCode>(initialLocale);

  useEffect(() => {
    const cookieValue = readCookie('cc_locale');
    const storageValue = window.localStorage.getItem('cc_locale');
    const cookieLocale = cookieValue ? normalizeProviderLocale(cookieValue) : null;
    const storageLocale = storageValue ? normalizeProviderLocale(storageValue) : null;
    const preferred = cookieLocale ?? storageLocale ?? initialLocale;
    if (preferred !== locale) {
      setLocaleState(preferred);
    }
  }, [initialLocale]);

  useEffect(() => {
    const dir = locale === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
    persistLocale(locale);
  }, [locale]);

  const value = useMemo<ProviderLocaleContextValue>(() => ({
    locale,
    dir: locale === 'ar' ? 'rtl' : 'ltr',
    t: getProviderDictionary(locale),
    setLocale: (nextLocale) => setLocaleState(nextLocale),
    toggleLocale: () => setLocaleState((current) => current === 'en' ? 'ar' : 'en'),
  }), [locale]);

  return <ProviderLocaleContext.Provider value={value}>{children}</ProviderLocaleContext.Provider>;
}

export function useProviderLocale() {
  const context = useContext(ProviderLocaleContext);
  if (!context) {
    throw new Error('useProviderLocale must be used within ProviderLocaleProvider');
  }
  return context;
}
