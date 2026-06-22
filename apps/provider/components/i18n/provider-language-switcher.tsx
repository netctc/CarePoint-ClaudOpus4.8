'use client';

import { useProviderLocale } from './provider-locale-provider';

export function ProviderLanguageSwitcher() {
  const { locale, setLocale, t } = useProviderLocale();

  return (
    <div className="locale-switcher" role="group" aria-label={t.common.language}>
      <button type="button" className={`locale-button ${locale === 'en' ? 'active' : ''}`} onClick={() => setLocale('en')}>
        {t.common.english}
      </button>
      <button type="button" className={`locale-button ${locale === 'ar' ? 'active' : ''}`} onClick={() => setLocale('ar')}>
        {t.common.arabic}
      </button>
    </div>
  );
}
