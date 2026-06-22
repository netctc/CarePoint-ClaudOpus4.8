import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const protectedPrefixes = ['/portal'];

export function middleware(request: NextRequest) {
  const token = request.cookies.get('cc_access_token')?.value;
  const pathname = request.nextUrl.pathname;

  const needsAuth = protectedPrefixes.some((prefix) => pathname.startsWith(prefix));
  if (needsAuth && !token) {
    const signInUrl = new URL('/auth/sign-in', request.url);
    signInUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/portal/:path*'],
};
