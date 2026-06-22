'use client';

import { useEffect, useState } from 'react';

type AccountRow = {
  id: string;
  email?: string | null;
  displayName?: string | null;
  role?: string | null;
  status?: string | null;
};

type AccountResponse = {
  items?: AccountRow[];
  data?: AccountRow[];
  accounts?: AccountRow[];
  degraded?: boolean;
  error?: string;
};

function pickRows(payload: AccountResponse | null): AccountRow[] {
  return payload?.items ?? payload?.data ?? payload?.accounts ?? [];
}

export function AccountsDeferredLoader() {
  const [rows, setRows] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 9000);

    async function load() {
      try {
        const response = await fetch('/api/admin/users/providers?limit=25', {
          signal: controller.signal,
          cache: 'no-store',
        });

        if (!response.ok) {
          setError(`The account directory returned ${response.status}. Showing empty state.`);
          setRows([]);
          return;
        }

        const payload = (await response.json()) as AccountResponse;
        setRows(pickRows(payload));
        if (payload.degraded) setError('Account directory is running in degraded mode.');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load accounts.');
        setRows([]);
      } finally {
        window.clearTimeout(timer);
        setLoading(false);
      }
    }

    load();

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-slate-700">Loading account directory…</p>
        <p className="mt-2 text-sm text-slate-500">The page shell is ready while account data loads in the browser.</p>
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 p-4">
        <h2 className="text-base font-semibold text-slate-950">Accounts</h2>
        {error ? <p className="mt-1 text-sm text-amber-700">{error}</p> : null}
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-slate-500" colSpan={4}>No account rows available.</td>
              </tr>
            ) : rows.map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-3 text-slate-900">{row.displayName ?? '—'}</td>
                <td className="px-4 py-3 text-slate-600">{row.email ?? '—'}</td>
                <td className="px-4 py-3 text-slate-600">{row.role ?? '—'}</td>
                <td className="px-4 py-3 text-slate-600">{row.status ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
