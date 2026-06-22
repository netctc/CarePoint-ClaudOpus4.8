import './globals.css';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { AdminLocaleProvider } from '@/components/i18n/admin-locale-provider';
import { normalizeAdminLocale } from '@/lib/i18n/admin-dictionary';

export const metadata: Metadata = {
  title: 'Administrator Portal Foundation',
  description: 'Admin web foundation starter for platform operations.'
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const locale = normalizeAdminLocale(cookieStore.get('cc_locale')?.value);
  const dir = locale === 'ar' ? 'rtl' : 'ltr';

  return (
    <html lang={locale} dir={dir}>
      <body>
        <AdminLocaleProvider initialLocale={locale}>{children}</AdminLocaleProvider>
      </body>
    </html>
  );
}
