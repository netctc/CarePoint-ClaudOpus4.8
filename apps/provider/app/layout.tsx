import './globals.css';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { ProviderLocaleProvider } from '@/components/i18n/provider-locale-provider';
import { normalizeProviderLocale } from '@/lib/i18n/provider-dictionary';

export const metadata: Metadata = {
  title: 'Provider Portal Starter',
  description: 'Starter pages for the provider web application',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const locale = normalizeProviderLocale(cookieStore.get('cc_locale')?.value);
  const dir = locale === 'ar' ? 'rtl' : 'ltr';

  return (
    <html lang={locale} dir={dir}>
      <body>
        <ProviderLocaleProvider initialLocale={locale}>{children}</ProviderLocaleProvider>
      </body>
    </html>
  );
}
