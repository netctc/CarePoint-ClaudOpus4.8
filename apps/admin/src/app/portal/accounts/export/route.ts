import { cookies } from 'next/headers';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

export async function GET(request: Request) {
  const store = await cookies();
  const token = store.get('cc_admin_access_token')?.value ?? store.get('cc_access_token')?.value;
  if (!token) return new Response('Missing admin access token', { status: 401 });

  const url = new URL(request.url);
  const upstream = await fetch(`${API_BASE_URL}/api/admin/users/export?${url.searchParams.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  const body = await upstream.text();
  return new Response(body, {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('Content-Type') ?? 'text/csv; charset=utf-8',
      'Content-Disposition': upstream.headers.get('Content-Disposition') ?? 'attachment; filename="carepoint-accounts.csv"',
    },
  });
}
