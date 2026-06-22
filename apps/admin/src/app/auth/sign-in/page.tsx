import { Suspense } from 'react';
import { cookies } from 'next/headers';
import SignInClient from './sign-in-client';
import { getAdminDictionary, normalizeAdminLocale } from '@/lib/i18n/admin-dictionary';

export default async function AdminSignInPage() {
  const cookieStore = await cookies();
  const locale = normalizeAdminLocale(cookieStore.get('cc_locale')?.value);
  const t = getAdminDictionary(locale);

  const fallback = (
    <div className="auth-shell">
      <div className="auth-card">
        <section className="auth-hero">
          <div>
            <div className="chip" style={{ display: 'inline-flex', background: 'rgba(255,255,255,0.14)', color: 'white' }}>
              {t.signIn.fallbackChip}
            </div>
          </div>
          <h1 style={{ fontSize: 40, margin: 0 }}>{t.signIn.fallbackTitle}</h1>
          <p style={{ color: 'rgba(255,255,255,0.84)', fontSize: 18, lineHeight: 1.6 }}>
            {t.signIn.fallbackBody}
          </p>
        </section>

        <section className="auth-panel">
          <div className="banner">{t.signIn.fallbackLoading}</div>
        </section>
      </div>
    </div>
  );

  return (
    <Suspense fallback={fallback}>
      <SignInClient />
    </Suspense>
  );
}
