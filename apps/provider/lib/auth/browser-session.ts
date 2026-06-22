export type BrowserSession = {
  accessToken: string | null;
  role: string | null;
};

export function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split('=').slice(1).join('=')) : null;
}

export function getBrowserSession(): BrowserSession {
  return {
    accessToken: readCookie('cc_provider_access_token') ?? readCookie('cc_access_token'),
    role: readCookie('cc_provider_role') ?? readCookie('cc_role'),
  };
}

export function persistBrowserSession(accessToken: string, role: string) {
  if (typeof document === 'undefined') return;
  document.cookie = `cc_provider_access_token=${encodeURIComponent(accessToken)}; path=/; SameSite=Lax`;
  document.cookie = `cc_provider_role=${encodeURIComponent(role)}; path=/; SameSite=Lax`;
  document.cookie = `cc_access_token=${encodeURIComponent(accessToken)}; path=/; SameSite=Lax`;
  document.cookie = `cc_role=${encodeURIComponent(role)}; path=/; SameSite=Lax`;
}

export function clearBrowserSession() {
  if (typeof document === 'undefined') return;
  document.cookie = 'cc_provider_access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  document.cookie = 'cc_provider_role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  document.cookie = 'cc_access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  document.cookie = 'cc_role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
}


function isProviderSignInPath(value: string) {
  try {
    return new URL(value, window.location.origin).pathname === '/sign-in';
  } catch (_) {
    return value.split('?')[0] === '/sign-in';
  }
}

export function redirectToProviderSignIn(nextPath?: string | null) {
  if (typeof window === 'undefined') return;
  if (window.location.pathname === '/sign-in') return;
  const pathname = nextPath && nextPath.trim().length > 0
    ? nextPath.trim()
    : `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const signInUrl = new URL('/sign-in', window.location.origin);
  if (pathname && !isProviderSignInPath(pathname)) {
    signInUrl.searchParams.set('next', pathname);
  }
  window.location.replace(signInUrl.toString());
}
