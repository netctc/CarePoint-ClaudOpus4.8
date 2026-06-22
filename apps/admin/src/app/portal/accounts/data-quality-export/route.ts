import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

export async function GET(_request: NextRequest) {
  const store = await cookies();
  const token = store.get('cc_admin_access_token')?.value ?? store.get('cc_access_token')?.value;

  if (!token) {
    return NextResponse.json({ error: 'Missing admin access token' }, { status: 401 });
  }

  const response = await fetch(`${API_BASE_URL}/api/admin/users/data-quality/export`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });

  if (!response.ok) {
    return NextResponse.json({ error: await response.text() }, { status: response.status });
  }

  const csv = await response.text();
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="carepoint-account-data-quality-issues.csv"',
    },
  });
}
