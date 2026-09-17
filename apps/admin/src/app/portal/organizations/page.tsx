import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { DataSourceBanner } from '@/components/admin/data-source-banner';
import { PortalShell } from '@/components/layout/portal-shell';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

type OrganizationItem = {
  id: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
  dependencySummary?: Record<string, number>;
  canDelete?: boolean;
  accountCount?: number;
  isFallback?: boolean;
};

type OrganizationResponse = {
  items: OrganizationItem[];
  count: number;
  scoped?: boolean;
  fallbackOrganizationName?: string;
  canManage?: boolean;
};

type SearchParams = {
  q?: string | string[];
  error?: string | string[];
  success?: string | string[];
};

function paramValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

function parseApiErrorText(text: string) {
  if (!text) return 'The API rejected the request.';
  try {
    const parsed = JSON.parse(text) as { error?: string; message?: string; details?: unknown; supportReferenceId?: string };
    const main = parsed.error || parsed.message || text;
    const details = typeof parsed.details === 'string' ? ` ${parsed.details}` : '';
    const support = parsed.supportReferenceId ? ` Support reference: ${parsed.supportReferenceId}.` : '';
    return `${main}.${details}${support}`.replace(/\.\./g, '.').trim();
  } catch {
    return text;
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unable to complete the organization operation.';
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const store = await cookies();
  const token = store.get('cc_admin_access_token')?.value ?? store.get('cc_access_token')?.value;
  if (!token) throw new Error('Missing admin access token. Please sign in again.');

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  });

  if (!response.ok) throw new Error(parseApiErrorText(await response.text()));
  return response.status === 204 ? ({} as T) : response.json() as Promise<T>;
}

async function loadOrganizations(params: SearchParams): Promise<{ data: OrganizationResponse; source: 'api' | 'mock'; error?: string }> {
  try {
    const q = paramValue(params.q);
    const query = new URLSearchParams();
    if (q) query.set('q', q);
    const data = await apiFetch<OrganizationResponse>(`/api/admin/users/organizations${query.toString() ? `?${query.toString()}` : ''}`);
    return { source: 'api', data };
  } catch (error) {
    return {
      source: 'mock',
      error: errorMessage(error),
      data: { items: [], count: 0, scoped: false, fallbackOrganizationName: 'Unassigned CarePoint Organization', canManage: false },
    };
  }
}

function formString(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

async function saveOrganization(formData: FormData) {
  'use server';
  const id = formString(formData, 'id');
  const payload = { name: formString(formData, 'name') };

  try {
    await apiFetch(id ? `/api/admin/users/organizations/${id}` : '/api/admin/users/organizations', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(payload),
    });
  } catch (error) {
    redirect(`/portal/organizations?error=${encodeURIComponent(errorMessage(error))}`);
  }

  revalidatePath('/portal/organizations');
  revalidatePath('/portal/accounts');
  redirect(`/portal/organizations?success=${encodeURIComponent(id ? 'Organization updated successfully.' : 'Organization created successfully.')}`);
}

async function deleteOrganization(formData: FormData) {
  'use server';
  try {
    await apiFetch(`/api/admin/users/organizations/${formString(formData, 'id')}`, { method: 'DELETE' });
  } catch (error) {
    redirect(`/portal/organizations?error=${encodeURIComponent(errorMessage(error))}`);
  }

  revalidatePath('/portal/organizations');
  revalidatePath('/portal/accounts');
  redirect(`/portal/organizations?success=${encodeURIComponent('Organization deleted successfully.')}`);
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  try { return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); } catch { return value; }
}

function dependencyText(summary?: Record<string, number>) {
  const entries = Object.entries(summary ?? {}).filter(([, value]) => value > 0);
  if (entries.length === 0) return 'No protected dependencies';
  return entries.slice(0, 8).map(([key, value]) => `${key}: ${value}`).join(' · ') + (entries.length > 8 ? ` · +${entries.length - 8} more` : '');
}

function StatusNotice({ type, message }: { type: 'success' | 'error'; message: string }) {
  if (!message) return null;
  return (
    <section className="card" style={{ borderColor: type === 'success' ? '#16a34a' : '#dc2626' }}>
      <strong>{type === 'success' ? 'Success' : 'Action required'}</strong>
      <p className="muted" style={{ marginTop: 6 }}>{message}</p>
    </section>
  );
}

function DeleteOrganizationButton({ organization, canManage }: { organization: OrganizationItem; canManage: boolean }) {
  const disabled = !canManage || !organization.canDelete || organization.isFallback;
  const title = !canManage
    ? 'Your current admin role cannot delete organizations.'
    : organization.isFallback
      ? 'The fallback organization is protected because account creation can use it automatically.'
      : disabled
        ? 'Delete is blocked because protected dependencies exist.'
        : 'Delete organization';

  return (
    <form action={deleteOrganization}>
      <input type="hidden" name="id" value={organization.id} />
      <button className="button danger" type="submit" disabled={disabled} title={title}>Delete</button>
    </form>
  );
}

export default async function OrganizationsPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const params: SearchParams = searchParams ? await searchParams : {};
  const result = await loadOrganizations(params);
  const q = paramValue(params.q);
  const error = paramValue(params.error);
  const success = paramValue(params.success);
  const protectedCount = result.data.items.filter((organization) => !organization.canDelete).length;
  const canManage = result.data.canManage !== false;

  return (
    <PortalShell currentPath="/portal/organizations">
      <div className="page-header">
        <div>
          <span className="eyebrow">Admin governance</span>
          <h2>Organizations</h2>
          <p>Maintain HSP organizations used to scope patients, providers, credentials, bookings, payments, reports, and audit evidence.</p>
        </div>
        <div className="inline-actions">
          <a className="button secondary" href="/portal/accounts">Back to accounts</a>
          <a className="button secondary" href="/portal/audit/logs?resource=organization">Organization audit</a>
        </div>
      </div>

      <DataSourceBanner source={result.source} error={result.error} />
      <StatusNotice type="error" message={error} />
      <StatusNotice type="success" message={success} />

      <section className="stats-grid">
        <div className="stat-card"><span>Total organizations</span><strong>{result.data.count}</strong><small>{result.data.scoped ? 'Scoped admin view' : 'Global admin view'}</small></div>
        <div className="stat-card"><span>Protected organizations</span><strong>{protectedCount}</strong><small>Have accounts or downstream records</small></div>
        <div className="stat-card"><span>Fallback organization</span><strong>{result.data.fallbackOrganizationName ?? 'Unassigned CarePoint Organization'}</strong><small>Used when patient/provider creation leaves organization empty</small></div>
      </section>

      <section className="card">
        <div className="panel-header">
          <h3 className="section-title">Create organization</h3>
          <span className="tag">Add / modify / delete</span>
        </div>
        {canManage ? (
          <form action={saveOrganization} className="form-grid">
            <input name="name" className="input" placeholder="Organization name" required />
            <button className="button primary" type="submit">Create organization</button>
          </form>
        ) : (
          <p className="muted compact-text">Your current role can view organizations, but it cannot create, modify, or delete them.</p>
        )}
        <p className="muted compact-text">Organization names are validated case-insensitively by the API to prevent duplicates. Deletion is blocked if the organization has linked accounts or operational records.</p>
      </section>

      <section className="card">
        <div className="panel-header">
          <h3 className="section-title">Organization search</h3>
          <span className="tag">{result.data.count} records</span>
        </div>
        <form className="form-grid" method="get">
          <input name="q" defaultValue={q} className="input" placeholder="Search organization name or ID" />
          <button className="button secondary" type="submit">Apply search</button>
          <a className="button ghost" href="/portal/organizations">Clear</a>
        </form>
      </section>

      <section className="card">
        <div className="panel-header"><h3 className="section-title">Organization list</h3><span className="tag">CRUD governance</span></div>
        <div className="list-stack">
          {result.data.items.map((organization) => (
            <div className="list-row account-list-row" key={organization.id}>
              <form action={saveOrganization} className="form-grid account-edit-grid">
                <input type="hidden" name="id" value={organization.id} />
                <input name="name" className="input" defaultValue={organization.name} placeholder="Organization name" required disabled={!canManage} />
                <button className="button secondary" type="submit" disabled={!canManage}>Save</button>
              </form>
              <div className="account-side-panel">
                <p className="muted" style={{ marginBottom: 8 }}>{organization.id} {organization.isFallback ? '· fallback organization' : ''}</p>
                <p className="muted" style={{ marginBottom: 8 }}>Accounts: {organization.accountCount ?? 0} · Updated: {formatDate(organization.updatedAt)}</p>
                <p className="muted" style={{ marginBottom: 8 }}>{dependencyText(organization.dependencySummary)}</p>
                <div className="inline-actions">
                  <a className="button secondary" href={`/portal/accounts?q=${encodeURIComponent(organization.name)}`}>View accounts</a>
                  <a className="button secondary" href={`/portal/audit/logs?resource=organization&resourceId=${encodeURIComponent(organization.id)}`}>Audit trail</a>
                </div>
                <DeleteOrganizationButton organization={organization} canManage={canManage} />
              </div>
            </div>
          ))}
          {result.data.items.length === 0 ? <p className="muted">No organizations returned by the API.</p> : null}
        </div>
      </section>
    </PortalShell>
  );
}
