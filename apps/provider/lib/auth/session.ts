import { cookies } from 'next/headers';

export type ProviderSession = {
  token: string | null;
  role: string | null;
};

export async function getProviderSession(): Promise<ProviderSession> {
  const store = await cookies();

  return {
    token: store.get('cc_provider_access_token')?.value ?? store.get('cc_access_token')?.value ?? null,
    role: store.get('cc_provider_role')?.value ?? store.get('cc_role')?.value ?? null,
  };
}


const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

export async function validateProviderSession(token: string | null): Promise<boolean> {
  if (!token) return false;

  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    });

    return response.ok;
  } catch {
    return false;
  }
}
