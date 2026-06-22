import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { SignInForm } from './sign-in-form';
import { getProviderDictionary, normalizeProviderLocale } from '@/lib/i18n/provider-dictionary';

export default async function SignInPage() {
  const cookieStore = await cookies();
  const locale = normalizeProviderLocale(cookieStore.get('cc_locale')?.value);
  const t = getProviderDictionary(locale);

  return (
    <Suspense fallback={<main className="provider-v13-login-shell"><section className="provider-v13-login-loading"><strong>{t.signIn.loading}</strong><p>{t.signIn.subtitle}</p></section></main>}>
      <SignInForm />
    </Suspense>
  );
}
