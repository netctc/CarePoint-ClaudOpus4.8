'use client';

import { useAdminLocale } from '@/components/i18n/admin-locale-provider';
import { getAdminPortalCopy } from '@/lib/i18n/admin-portal-copy';

export function DataSourceBanner({ source, error }: { source: 'api' | 'mock'; error?: string }) {
  const { locale } = useAdminLocale();
  const copy = getAdminPortalCopy(locale).dataSourceBanner;

  if (source === 'api') {
    return <div className="banner info">{copy.live}</div>;
  }

  return (
    <div className="banner warning">
      {copy.fallbackPrefix} {error ? `${copy.reason} ${error}` : ''}
    </div>
  );
}
