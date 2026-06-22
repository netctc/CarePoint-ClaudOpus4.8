'use client';

import { useAdminLocale } from './admin-locale-provider';

export function AdminLanguageSwitcher() {
  const { locale, setLocale, t } = useAdminLocale();

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
