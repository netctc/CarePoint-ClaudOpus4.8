'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getAdminDictionary, normalizeAdminLocale, type LocaleCode } from '@/lib/i18n/admin-dictionary';
import { readCookie } from '@/lib/auth/browser-session';

type AdminLocaleContextValue = {
  locale: LocaleCode;
  dir: 'ltr' | 'rtl';
  t: ReturnType<typeof getAdminDictionary>;
  setLocale: (locale: LocaleCode) => void;
  toggleLocale: () => void;
};

const AdminLocaleContext = createContext<AdminLocaleContextValue | null>(null);

function persistLocale(locale: LocaleCode) {
  if (typeof document === 'undefined') return;
  document.cookie = `cc_locale=${encodeURIComponent(locale)}; path=/; SameSite=Lax; max-age=31536000`;
  window.localStorage.setItem('cc_locale', locale);
}

export function AdminLocaleProvider({ initialLocale, children }: { initialLocale: LocaleCode; children: ReactNode }) {
  const [locale, setLocaleState] = useState<LocaleCode>(initialLocale);

  useEffect(() => {
    const cookieValue = readCookie('cc_locale');
    const storageValue = window.localStorage.getItem('cc_locale');
    const cookieLocale = cookieValue ? normalizeAdminLocale(cookieValue) : null;
    const storageLocale = storageValue ? normalizeAdminLocale(storageValue) : null;
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

  const value = useMemo<AdminLocaleContextValue>(() => ({
    locale,
    dir: locale === 'ar' ? 'rtl' : 'ltr',
    t: getAdminDictionary(locale),
    setLocale: (nextLocale) => setLocaleState(nextLocale),
    toggleLocale: () => setLocaleState((current) => current === 'en' ? 'ar' : 'en'),
  }), [locale]);

  return <AdminLocaleContext.Provider value={value}>{children}</AdminLocaleContext.Provider>;
}

export function useAdminLocale() {
  const context = useContext(AdminLocaleContext);
  if (!context) {
    throw new Error('useAdminLocale must be used within AdminLocaleProvider');
  }
  return context;
}
