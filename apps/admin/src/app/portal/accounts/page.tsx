import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { PortalShell } from '@/components/layout/portal-shell';
import { DataSourceBanner } from '@/components/admin/data-source-banner';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

type DependencySummary = Record<string, number>;
type AccountStatus = 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';
type AccountType = 'PATIENT' | 'PROVIDER';
type ProviderOnboardingStatus = 'DRAFT' | 'READY_FOR_REVIEW' | 'REQUEST_CHANGES' | 'APPROVED' | 'REJECTED';
type CredentialDocumentType = 'LICENSE' | 'ID_DOCUMENT' | 'INSURANCE' | 'CERTIFICATION' | 'DEGREE' | 'OTHER';
type CredentialDocumentStatus = 'MISSING' | 'UPLOADED' | 'VERIFIED' | 'REJECTED' | 'EXPIRED';
type CredentialReviewTaskStatus = 'OPEN' | 'IN_REVIEW' | 'BLOCKED' | 'COMPLETED' | 'CANCELLED';
type CredentialReviewPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
type CredentialNotificationChannel = 'EMAIL' | 'IN_APP' | 'MANUAL';
type CredentialNotificationStatus = 'QUEUED' | 'SENT' | 'FAILED' | 'CANCELLED';

type OrganizationItem = {
  id: string;
  name: string;
};

type ProviderRoleItem = {
  id: string;
  code: string;
  label: string;
  description?: string | null;
  systemRole: 'PROVIDER' | 'NURSE' | 'PHARMACIST' | 'LAB_TECH' | string;
  isActive: boolean;
  isSystem: boolean;
  sortOrder?: number;
  providerCount?: number;
  createdAt?: string;
  updatedAt?: string;
};

type ProviderCredentialDocument = {
  id: string;
  providerId: string;
  type: CredentialDocumentType;
  title: string;
  status: CredentialDocumentStatus;
  storedStatus?: CredentialDocumentStatus;
  documentUrl?: string | null;
  fileName?: string | null;
  referenceNumber?: string | null;
  issuedAt?: string | null;
  expiresAt?: string | null;
  expiryState?: 'NO_EXPIRY' | 'VALID' | 'EXPIRING_SOON' | 'EXPIRED';
  rejectionReason?: string | null;
  verifiedAt?: string | null;
  verifiedByName?: string | null;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type CredentialSummary = {
  total: number;
  verified: number;
  uploaded: number;
  rejected: number;
  expired: number;
  expiringSoon: number;
  missingRequiredTypes: CredentialDocumentType[];
};

type CredentialReviewTask = {
  id: string;
  organizationId?: string;
  providerId: string;
  providerName?: string | null;
  providerEmail?: string | null;
  documentId?: string | null;
  documentType?: string | null;
  documentTitle?: string | null;
  title: string;
  status: CredentialReviewTaskStatus;
  priority: CredentialReviewPriority;
  dueAt?: string | null;
  assignedToId?: string | null;
  assignedToName?: string | null;
  assignedToEmail?: string | null;
  createdByName?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
  blockReason?: string | null;
  decisionNote?: string | null;
  organizationName?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type CredentialNotification = {
  id: string;
  organizationId?: string;
  providerId: string;
  providerName?: string | null;
  providerEmail?: string | null;
  documentId?: string | null;
  documentType?: string | null;
  documentTitle?: string | null;
  taskId?: string | null;
  taskTitle?: string | null;
  channel: CredentialNotificationChannel;
  status: CredentialNotificationStatus;
  subject: string;
  message: string;
  recipientEmail?: string | null;
  scheduledFor?: string | null;
  sentAt?: string | null;
  failureReason?: string | null;
  deliveryProvider?: string | null;
  deliveryProviderMessageId?: string | null;
  dispatchAttemptCount?: number;
  lastDispatchAt?: string | null;
  createdByName?: string | null;
  organizationName?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type GovernanceCounts = Record<string, number>;

type GovernanceRiskCredential = {
  id: string;
  providerId: string;
  providerName?: string | null;
  providerEmail?: string | null;
  organizationName?: string | null;
  type?: string;
  title?: string;
  expiresAt?: string | null;
  status?: string;
};

type GovernanceRiskTask = {
  id: string;
  providerId: string;
  providerName?: string | null;
  providerEmail?: string | null;
  organizationName?: string | null;
  title?: string;
  status?: string;
  priority?: string;
  dueAt?: string | null;
  assignedTo?: string | null;
};

type GovernanceRiskNotification = {
  id: string;
  providerId: string;
  providerName?: string | null;
  providerEmail?: string | null;
  organizationName?: string | null;
  channel?: string;
  subject?: string;
  failureReason?: string | null;
  updatedAt?: string | null;
};

type GovernanceSummaryResponse = {
  generatedAt: string;
  scope: 'GLOBAL' | 'ORGANIZATION' | string;
  organizationId?: string | null;
  accounts: {
    patients: { total: number; statusCounts: GovernanceCounts };
    providers: { total: number; statusCounts: GovernanceCounts };
    combinedTotal: number;
  };
  providerOnboarding: { total: number; statusCounts: GovernanceCounts; readyForReview: number; approved: number; rejected: number };
  credentials: { total: number; statusCounts: GovernanceCounts; typeCounts: GovernanceCounts; expiryCounts: GovernanceCounts; expiringSoon: number; expired: number; verified: number; rejected: number };
  reviewTasks: { total: number; active: number; overdue: number; statusCounts: GovernanceCounts; priorityCounts: GovernanceCounts };
  notifications: { total: number; queued: number; failed: number; statusCounts: GovernanceCounts; channelCounts: GovernanceCounts };
  riskItems: {
    expiredCredentials: GovernanceRiskCredential[];
    expiringCredentials: GovernanceRiskCredential[];
    overdueReviewTasks: GovernanceRiskTask[];
    failedNotifications: GovernanceRiskNotification[];
  };
  recentActivity?: Array<{ id: string; action: string; resource: string; resourceId?: string | null; createdAt: string }>;
};

type DataQualitySeverity = 'BLOCKER' | 'WARNING' | 'INFO';

type DataQualityIssue = {
  id: string;
  severity: DataQualitySeverity;
  category: string;
  entityType: 'PATIENT' | 'PROVIDER' | 'CREDENTIAL_DOCUMENT' | 'REVIEW_TASK' | 'NOTIFICATION';
  entityId: string;
  organizationName?: string | null;
  accountName?: string | null;
  accountEmail?: string | null;
  title: string;
  detail: string;
  recommendation: string;
};

type DataQualityReportResponse = {
  generatedAt: string;
  scope: 'GLOBAL' | 'ORGANIZATION' | string;
  organizationId?: string | null;
  summary: {
    totalIssues: number;
    blockers: number;
    warnings: number;
    info: number;
    recordsScanned: Record<string, number>;
  };
  issues: DataQualityIssue[];
};


type AccountItem = {
  id: string;
  userId: string;
  type: AccountType;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  roleLabel?: string | null;
  roleCatalogId?: string | null;
  systemRole?: string | null;
  status: AccountStatus;
  deactivatedAt?: string | null;
  deactivationReason?: string | null;
  organizationId: string;
  organizationName?: string | null;
  dateOfBirth?: string | null;
  insuranceNumber?: string | null;
  specialty?: string | null;
  licenseNumber?: string | null;
  services?: string[];
  onboardingStatus?: ProviderOnboardingStatus;
  onboarding?: {
    status: ProviderOnboardingStatus;
    decisionNote?: string | null;
    submittedAt?: string | null;
    reviewedAt?: string | null;
    checklist?: Array<{ label?: string; detail?: string; status?: string; variant?: string }>;
  };
  credentialDocuments?: ProviderCredentialDocument[];
  credentialSummary?: CredentialSummary;
  credentialReviewTasks?: CredentialReviewTask[];
  canDelete?: boolean;
  dependencySummary?: DependencySummary;
  dependencyCheckDeferred?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

type AccountAuditEvent = {
  id: string;
  action: string;
  resource: string;
  resourceId?: string | null;
  organizationName?: string | null;
  actorName?: string | null;
  actorEmail?: string | null;
  actorRole?: string | null;
  details?: Record<string, unknown> | null;
  createdAt: string;
};

type AccountListResponse = { items: AccountItem[]; count: number };
type OrganizationListResponse = { items: OrganizationItem[]; count: number; scoped?: boolean };
type ProviderRoleListResponse = { items: ProviderRoleItem[]; count: number };
type AccountAuditResponse = { items: AccountAuditEvent[]; count: number };
type CredentialReviewTaskResponse = { items: CredentialReviewTask[]; count: number };
type CredentialNotificationResponse = { items: CredentialNotification[]; count: number };
type GovernanceSummaryApiResponse = GovernanceSummaryResponse;
type DataQualityApiResponse = DataQualityReportResponse;

type AccountFilters = {
  q?: string | string[];
  status?: string | string[];
  error?: string | string[];
  success?: string | string[];
  section?: string | string[];
};

type LoadResult = {
  patients: AccountItem[];
  providers: AccountItem[];
  organizations: OrganizationItem[];
  providerRoles: ProviderRoleItem[];
  auditEvents: AccountAuditEvent[];
  credentialReviewTasks: CredentialReviewTask[];
  credentialNotifications: CredentialNotification[];
  governanceSummary?: GovernanceSummaryResponse;
  dataQuality?: DataQualityReportResponse;
  source: 'api' | 'mock';
  error?: string;
  governanceLoaded?: boolean;
};

type AccountsPageProps = {
  searchParams?: AccountFilters | Promise<AccountFilters>;
};

function isAuthSessionError(message: string) {
  const normalized = message.toLowerCase();
  return normalized.includes('invalid access token')
    || normalized.includes('missing admin access token')
    || normalized.includes('missing access token')
    || normalized.includes('jwt expired')
    || normalized.includes('unauthorized')
    || normalized.includes('authentication required');
}

function cookieHeaderValue(name: string, value: string) {
  return `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;
}

async function refreshAdminAccessToken(store: Awaited<ReturnType<typeof cookies>>): Promise<string | null> {
  const refreshToken = store.get('refreshToken_admin')?.value ?? store.get('refreshToken')?.value;
  if (!refreshToken) return null;

  try {
    const cookieHeader = [
      store.get('refreshToken_admin')?.value ? cookieHeaderValue('refreshToken_admin', store.get('refreshToken_admin')!.value) : null,
      store.get('refreshToken')?.value ? cookieHeaderValue('refreshToken', store.get('refreshToken')!.value) : null,
    ].filter(Boolean).join('; ');

    const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
      cache: 'no-store',
    });

    if (!response.ok) return null;
    const payload = await response.json() as { accessToken?: string; user?: { role?: string } };
    const accessToken = payload.accessToken;
    if (!accessToken) return null;

    try {
      const mutableStore = store as unknown as { set: (name: string, value: string, options?: Record<string, unknown>) => void };
      mutableStore.set('cc_admin_access_token', accessToken, { path: '/', sameSite: 'lax' });
      mutableStore.set('cc_access_token', accessToken, { path: '/', sameSite: 'lax' });
      if (payload.user?.role) {
        mutableStore.set('cc_admin_role', payload.user.role, { path: '/', sameSite: 'lax' });
        mutableStore.set('cc_role', payload.user.role, { path: '/', sameSite: 'lax' });
      }
    } catch {
      // Server components cannot mutate cookies; the refreshed token still works for this request.
    }

    return accessToken;
  } catch {
    return null;
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const store = await cookies();
  const candidateTokens = [
    store.get('cc_admin_access_token')?.value,
    store.get('cc_access_token')?.value,
  ].filter((token, index, tokens): token is string => Boolean(token) && tokens.indexOf(token) === index);

  if (candidateTokens.length === 0) throw new Error('Missing admin access token. Please sign in again.');

  async function sendWithToken(token: string) {
    return fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
      cache: 'no-store',
    });
  }

  let lastMessage = 'The API rejected the request.';
  let sawAuthFailure = false;

  for (const token of candidateTokens) {
    const response = await sendWithToken(token);

    if (response.ok) {
      if (response.status === 204) return undefined as T;
      return response.json() as Promise<T>;
    }

    lastMessage = parseApiErrorText(await response.text());
    if (response.status === 401) {
      sawAuthFailure = true;
      continue;
    }
    if (response.status === 403) break;
    break;
  }

  if (sawAuthFailure) {
    const refreshedToken = await refreshAdminAccessToken(store);
    if (refreshedToken && !candidateTokens.includes(refreshedToken)) {
      const response = await sendWithToken(refreshedToken);
      if (response.ok) {
        if (response.status === 204) return undefined as T;
        return response.json() as Promise<T>;
      }
      lastMessage = parseApiErrorText(await response.text());
    }
  }

  if (isAuthSessionError(lastMessage)) {
    throw new Error('Your admin session expired or became invalid. Please sign in again.');
  }

  throw new Error(lastMessage);
}

async function optionalApiFetch<T>(path: string, fallback: T, errors: string[], label: string, init?: RequestInit): Promise<T> {
  try {
    return await apiFetch<T>(path, init);
  } catch (error) {
    errors.push(`${label}: ${errorMessage(error)}`);
    return fallback;
  }
}


function paramValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}


function defaultProviderRoles(): ProviderRoleItem[] {
  return [
    { id: 'provider-role-provider', code: 'PROVIDER', label: 'Provider', systemRole: 'PROVIDER', isActive: true, isSystem: true, sortOrder: 10 },
    { id: 'provider-role-nurse', code: 'NURSE', label: 'Nurse', systemRole: 'NURSE', isActive: true, isSystem: true, sortOrder: 20 },
    { id: 'provider-role-pharmacist', code: 'PHARMACIST', label: 'Pharmacist', systemRole: 'PHARMACIST', isActive: true, isSystem: true, sortOrder: 30 },
    { id: 'provider-role-lab-tech', code: 'LAB_TECH', label: 'Lab technician', systemRole: 'LAB_TECH', isActive: true, isSystem: true, sortOrder: 40 },
  ];
}

function parseApiErrorText(text: string) {
  if (!text) return 'The API rejected the request.';
  try {
    const parsed = JSON.parse(text) as { error?: string; message?: string; details?: unknown; supportReferenceId?: string };
    const main = parsed.error || parsed.message || 'The API rejected the request';
    const details = typeof parsed.details === 'string' ? ` ${parsed.details}` : '';
    const support = parsed.supportReferenceId ? ` Support reference: ${parsed.supportReferenceId}.` : '';
    return `${main}.${details}${support}`.replace(/\.\./g, '.').trim();
  } catch {
    return text;
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unable to complete the account operation.';
}

function accountNoticePath(kind: 'error' | 'success', message: string) {
  if (kind === 'error' && isAuthSessionError(message)) {
    return `/auth/sign-in?next=${encodeURIComponent('/portal/accounts')}&reason=session-expired`;
  }
  return `/portal/accounts?${kind}=${encodeURIComponent(message)}`;
}

function accountQuery(filters: AccountFilters, options: { includeSection?: boolean } = {}) {
  const params = new URLSearchParams();
  const q = paramValue(filters.q).trim();
  const status = paramValue(filters.status).trim();
  const section = paramValue(filters.section).trim();
  if (q) params.set('q', q);
  if (status) params.set('status', status);
  if (options.includeSection && section) params.set('section', section);
  const query = params.toString();
  return query ? `?${query}` : '';
}

async function loadAccounts(filters: AccountFilters = {}): Promise<LoadResult> {
  const query = accountQuery(filters);
  const errors: string[] = [];
  const section = paramValue(filters.section).trim();
  const includeGovernance = section === 'governance' || section === 'all';

  const [patients, providers, organizations, providerRoles] = await Promise.all([
    optionalApiFetch<AccountListResponse>(`/api/admin/users/patients${query}`, { items: [], count: 0 }, errors, 'Patients'),
    optionalApiFetch<AccountListResponse>(`/api/admin/users/providers${query}`, { items: [], count: 0 }, errors, 'Providers'),
    optionalApiFetch<OrganizationListResponse>('/api/admin/users/organizations?limit=100', { items: [], count: 0 }, errors, 'Organizations'),
    optionalApiFetch<ProviderRoleListResponse>('/api/admin/users/provider-roles', { items: defaultProviderRoles(), count: defaultProviderRoles().length }, errors, 'Provider roles'),
  ]);

  let audit: AccountAuditResponse = { items: [], count: 0 };
  let reviewTasks: CredentialReviewTaskResponse = { items: [], count: 0 };
  let notifications: CredentialNotificationResponse = { items: [], count: 0 };
  let governanceSummary: GovernanceSummaryResponse | undefined;
  let dataQuality: DataQualityReportResponse | undefined;

  if (includeGovernance) {
    [audit, reviewTasks, notifications, governanceSummary, dataQuality] = await Promise.all([
      optionalApiFetch<AccountAuditResponse>('/api/admin/users/audit?limit=10', { items: [], count: 0 }, errors, 'Audit'),
      optionalApiFetch<CredentialReviewTaskResponse>('/api/admin/users/credential-review-tasks?limit=10', { items: [], count: 0 }, errors, 'Review tasks'),
      optionalApiFetch<CredentialNotificationResponse>('/api/admin/users/credential-notifications?limit=10', { items: [], count: 0 }, errors, 'Notifications'),
      optionalApiFetch<GovernanceSummaryApiResponse | undefined>('/api/admin/users/governance-summary', undefined, errors, 'Governance summary'),
      optionalApiFetch<DataQualityApiResponse | undefined>('/api/admin/users/data-quality', undefined, errors, 'Data quality'),
    ]);
  }

  return {
    patients: patients.items,
    providers: providers.items,
    organizations: organizations.items,
    providerRoles: providerRoles.items.length ? providerRoles.items : defaultProviderRoles(),
    auditEvents: audit.items,
    credentialReviewTasks: reviewTasks.items,
    credentialNotifications: notifications.items,
    governanceSummary,
    dataQuality,
    source: errors.length ? 'mock' : 'api',
    error: errors.length ? errors.join(' | ') : undefined,
    governanceLoaded: includeGovernance,
  };
}

function formString(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

function organizationFromForm(formData: FormData) {
  return formString(formData, 'organizationId') || undefined;
}

function idsFromForm(formData: FormData) {
  return formData.getAll('ids').map((value) => String(value).trim()).filter(Boolean);
}


async function saveProviderRole(formData: FormData) {
  'use server';
  const id = formString(formData, 'id');
  const payload = {
    code: formString(formData, 'code') || undefined,
    label: formString(formData, 'label'),
    description: formString(formData, 'description') || undefined,
    systemRole: formString(formData, 'systemRole') || 'PROVIDER',
    isActive: formString(formData, 'isActive') !== 'false',
    sortOrder: Number(formString(formData, 'sortOrder') || '100'),
  };

  try {
    await apiFetch(id ? `/api/admin/users/provider-roles/${id}` : '/api/admin/users/provider-roles', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(payload),
    });
  } catch (error) {
    redirect(accountNoticePath('error', errorMessage(error)));
  }

  revalidatePath('/portal/accounts');
  redirect(accountNoticePath('success', id ? 'Provider role updated successfully.' : 'Provider role created successfully.'));
}

async function deleteProviderRole(formData: FormData) {
  'use server';
  try {
    await apiFetch(`/api/admin/users/provider-roles/${formString(formData, 'id')}`, { method: 'DELETE' });
  } catch (error) {
    redirect(accountNoticePath('error', errorMessage(error)));
  }

  revalidatePath('/portal/accounts');
  redirect(accountNoticePath('success', 'Provider role deleted successfully.'));
}

async function savePatient(formData: FormData) {
  'use server';
  const id = formString(formData, 'id');
  const payload = {
    organizationId: organizationFromForm(formData),
    firstName: formString(formData, 'firstName'),
    lastName: formString(formData, 'lastName'),
    email: formString(formData, 'email'),
    password: formString(formData, 'password') || undefined,
    status: formString(formData, 'status') || 'ACTIVE',
    deactivationReason: formString(formData, 'deactivationReason') || undefined,
    dateOfBirth: formString(formData, 'dateOfBirth') || undefined,
    insuranceNumber: formString(formData, 'insuranceNumber') || undefined,
  };

  try {
    await apiFetch(id ? `/api/admin/users/patients/${id}` : '/api/admin/users/patients', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(payload),
    });
  } catch (error) {
    redirect(accountNoticePath('error', errorMessage(error)));
  }

  revalidatePath('/portal/accounts');
  redirect(accountNoticePath('success', id ? 'Patient account updated successfully.' : 'Patient account created successfully.'));
}

async function deletePatient(formData: FormData) {
  'use server';
  try {
    await apiFetch(`/api/admin/users/patients/${formString(formData, 'id')}`, { method: 'DELETE' });
  } catch (error) {
    redirect(accountNoticePath('error', errorMessage(error)));
  }
  revalidatePath('/portal/accounts');
  redirect(accountNoticePath('success', 'Patient account deleted successfully.'));
}

async function changePatientStatus(formData: FormData) {
  'use server';
  try {
    await apiFetch(`/api/admin/users/patients/${formString(formData, 'id')}/status`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: formString(formData, 'status'),
        deactivationReason: formString(formData, 'deactivationReason') || undefined,
      }),
    });
  } catch (error) {
    redirect(accountNoticePath('error', errorMessage(error)));
  }
  revalidatePath('/portal/accounts');
  redirect(accountNoticePath('success', 'Patient account status updated successfully.'));
}

async function saveProvider(formData: FormData) {
  'use server';
  const id = formString(formData, 'id');
  const payload = {
    organizationId: organizationFromForm(formData),
    firstName: formString(formData, 'firstName'),
    lastName: formString(formData, 'lastName'),
    email: formString(formData, 'email'),
    password: formString(formData, 'password') || undefined,
    status: formString(formData, 'status') || 'ACTIVE',
    deactivationReason: formString(formData, 'deactivationReason') || undefined,
    role: formString(formData, 'role') || 'PROVIDER',
    specialty: formString(formData, 'specialty') || undefined,
    licenseNumber: formString(formData, 'licenseNumber') || undefined,
    services: formString(formData, 'services') || undefined,
    onboardingStatus: formString(formData, 'onboardingStatus') || undefined,
    onboardingDecisionNote: formString(formData, 'onboardingDecisionNote') || undefined,
  };

  try {
    await apiFetch(id ? `/api/admin/users/providers/${id}` : '/api/admin/users/providers', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(payload),
    });
  } catch (error) {
    redirect(accountNoticePath('error', errorMessage(error)));
  }

  revalidatePath('/portal/accounts');
  redirect(accountNoticePath('success', id ? 'Provider account updated successfully.' : 'Provider account created successfully.'));
}

async function deleteProvider(formData: FormData) {
  'use server';
  try {
    await apiFetch(`/api/admin/users/providers/${formString(formData, 'id')}`, { method: 'DELETE' });
  } catch (error) {
    redirect(accountNoticePath('error', errorMessage(error)));
  }
  revalidatePath('/portal/accounts');
  redirect(accountNoticePath('success', 'Provider account deleted successfully.'));
}

async function changeProviderStatus(formData: FormData) {
  'use server';
  try {
    await apiFetch(`/api/admin/users/providers/${formString(formData, 'id')}/status`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: formString(formData, 'status'),
        deactivationReason: formString(formData, 'deactivationReason') || undefined,
      }),
    });
  } catch (error) {
    redirect(accountNoticePath('error', errorMessage(error)));
  }
  revalidatePath('/portal/accounts');
  redirect(accountNoticePath('success', 'Provider account status updated successfully.'));
}


async function changeProviderOnboarding(formData: FormData) {
  'use server';
  await apiFetch(`/api/admin/users/providers/${formString(formData, 'id')}/onboarding`, {
    method: 'PATCH',
    body: JSON.stringify({
      status: formString(formData, 'onboardingStatus'),
      decisionNote: formString(formData, 'onboardingDecisionNote') || undefined,
    }),
  });
  revalidatePath('/portal/accounts');
}


async function saveProviderCredentialDocument(formData: FormData) {
  'use server';
  const providerId = formString(formData, 'providerId');
  const documentId = formString(formData, 'documentId');
  const payload = {
    type: formString(formData, 'credentialType') || 'OTHER',
    title: formString(formData, 'title') || undefined,
    status: formString(formData, 'credentialStatus') || 'UPLOADED',
    documentUrl: formString(formData, 'documentUrl') || undefined,
    fileName: formString(formData, 'fileName') || undefined,
    referenceNumber: formString(formData, 'referenceNumber') || undefined,
    issuedAt: formString(formData, 'issuedAt') || undefined,
    expiresAt: formString(formData, 'expiresAt') || undefined,
    rejectionReason: formString(formData, 'rejectionReason') || undefined,
    notes: formString(formData, 'notes') || undefined,
  };

  await apiFetch(documentId ? `/api/admin/users/providers/${providerId}/credentials/${documentId}` : `/api/admin/users/providers/${providerId}/credentials`, {
    method: documentId ? 'PUT' : 'POST',
    body: JSON.stringify(payload),
  });
  revalidatePath('/portal/accounts');
}

async function changeProviderCredentialDocumentStatus(formData: FormData) {
  'use server';
  await apiFetch(`/api/admin/users/providers/${formString(formData, 'providerId')}/credentials/${formString(formData, 'documentId')}/status`, {
    method: 'PATCH',
    body: JSON.stringify({
      status: formString(formData, 'credentialStatus'),
      rejectionReason: formString(formData, 'rejectionReason') || undefined,
      notes: formString(formData, 'notes') || undefined,
    }),
  });
  revalidatePath('/portal/accounts');
}

async function deleteProviderCredentialDocument(formData: FormData) {
  'use server';
  await apiFetch(`/api/admin/users/providers/${formString(formData, 'providerId')}/credentials/${formString(formData, 'documentId')}`, { method: 'DELETE' });
  revalidatePath('/portal/accounts');
}

async function saveProviderCredentialReviewTask(formData: FormData) {
  'use server';
  const providerId = formString(formData, 'providerId');
  await apiFetch(`/api/admin/users/providers/${providerId}/credential-review-tasks`, {
    method: 'POST',
    body: JSON.stringify({
      title: formString(formData, 'reviewTaskTitle') || undefined,
      documentId: formString(formData, 'documentId') || undefined,
      priority: formString(formData, 'reviewTaskPriority') || 'NORMAL',
      status: formString(formData, 'reviewTaskStatus') || 'OPEN',
      dueAt: formString(formData, 'reviewTaskDueAt') || undefined,
      assignedToEmail: formString(formData, 'assignedToEmail') || undefined,
      assignedToId: formString(formData, 'assignedToId') || undefined,
      decisionNote: formString(formData, 'reviewTaskDecisionNote') || undefined,
    }),
  });
  revalidatePath('/portal/accounts');
}

async function changeProviderCredentialReviewTask(formData: FormData) {
  'use server';
  await apiFetch(`/api/admin/users/credential-review-tasks/${formString(formData, 'taskId')}`, {
    method: 'PATCH',
    body: JSON.stringify({
      title: formString(formData, 'reviewTaskTitle') || undefined,
      status: formString(formData, 'reviewTaskStatus') || undefined,
      priority: formString(formData, 'reviewTaskPriority') || undefined,
      dueAt: formString(formData, 'reviewTaskDueAt') || undefined,
      assignedToEmail: formString(formData, 'assignedToEmail') || undefined,
      assignedToId: formString(formData, 'assignedToId') || undefined,
      blockReason: formString(formData, 'blockReason') || undefined,
      decisionNote: formString(formData, 'reviewTaskDecisionNote') || undefined,
    }),
  });
  revalidatePath('/portal/accounts');
}

async function queueCredentialTaskReminder(formData: FormData) {
  'use server';
  await apiFetch(`/api/admin/users/credential-review-tasks/${formString(formData, 'taskId')}/reminders`, {
    method: 'POST',
    body: JSON.stringify({
      channel: formString(formData, 'notificationChannel') || 'EMAIL',
      status: formString(formData, 'notificationStatus') || 'QUEUED',
      recipientEmail: formString(formData, 'recipientEmail') || undefined,
      scheduledFor: formString(formData, 'scheduledFor') || undefined,
      subject: formString(formData, 'subject') || undefined,
      message: formString(formData, 'message') || undefined,
    }),
  });
  revalidatePath('/portal/accounts');
}

async function queueProviderCredentialReminder(formData: FormData) {
  'use server';
  await apiFetch(`/api/admin/users/providers/${formString(formData, 'providerId')}/credential-reminders`, {
    method: 'POST',
    body: JSON.stringify({
      documentId: formString(formData, 'documentId') || undefined,
      channel: formString(formData, 'notificationChannel') || 'EMAIL',
      status: formString(formData, 'notificationStatus') || 'QUEUED',
      recipientEmail: formString(formData, 'recipientEmail') || undefined,
      scheduledFor: formString(formData, 'scheduledFor') || undefined,
      subject: formString(formData, 'subject') || undefined,
      message: formString(formData, 'message') || undefined,
    }),
  });
  revalidatePath('/portal/accounts');
}

async function changeCredentialNotificationStatus(formData: FormData) {
  'use server';
  await apiFetch(`/api/admin/users/credential-notifications/${formString(formData, 'notificationId')}/status`, {
    method: 'PATCH',
    body: JSON.stringify({
      status: formString(formData, 'notificationStatus'),
      scheduledFor: formString(formData, 'scheduledFor') || undefined,
      failureReason: formString(formData, 'failureReason') || undefined,
    }),
  });
  revalidatePath('/portal/accounts');
}

async function dispatchCredentialNotifications(formData: FormData) {
  'use server';
  await apiFetch('/api/admin/users/credential-notifications/dispatch', {
    method: 'POST',
    body: JSON.stringify({
      limit: Number(formString(formData, 'limit') || '25'),
      force: formString(formData, 'force') === 'true',
      includeManual: formString(formData, 'includeManual') === 'true',
    }),
  });
  revalidatePath('/portal/accounts');
}

async function dispatchSingleCredentialNotification(formData: FormData) {
  'use server';
  await apiFetch(`/api/admin/users/credential-notifications/${formString(formData, 'notificationId')}/dispatch`, {
    method: 'POST',
    body: JSON.stringify({ force: formString(formData, 'force') === 'true' }),
  });
  revalidatePath('/portal/accounts');
}

async function runCredentialGovernanceSweep(formData: FormData) {
  'use server';
  await apiFetch('/api/admin/users/credential-governance/sweep', {
    method: 'POST',
    body: JSON.stringify({
      dryRun: formString(formData, 'dryRun') === 'true',
      markExpired: formString(formData, 'markExpired') !== 'false',
      createReviewTasks: formString(formData, 'createReviewTasks') !== 'false',
      queueReminders: formString(formData, 'queueReminders') !== 'false',
      expiringSoonDays: Number(formString(formData, 'expiringSoonDays') || '30'),
      dueInDays: Number(formString(formData, 'dueInDays') || '7'),
      limit: Number(formString(formData, 'limit') || '250'),
    }),
  });
  revalidatePath('/portal/accounts');
}

async function bulkChangeStatus(formData: FormData) {
  'use server';
  const ids = idsFromForm(formData);
  if (ids.length === 0) return;

  await apiFetch('/api/admin/users/bulk-status', {
    method: 'POST',
    body: JSON.stringify({
      type: formString(formData, 'type'),
      ids,
      status: formString(formData, 'status'),
      deactivationReason: formString(formData, 'deactivationReason') || undefined,
    }),
  });
  revalidatePath('/portal/accounts');
}

async function importAccounts(formData: FormData) {
  'use server';
  await apiFetch('/api/admin/users/import', {
    method: 'POST',
    body: JSON.stringify({
      type: formString(formData, 'type'),
      csv: formString(formData, 'csv'),
    }),
  });
  revalidatePath('/portal/accounts');
}

function dateValue(value?: string | null) {
  if (!value) return '';
  return new Date(value).toISOString().slice(0, 10);
}

function dependencyText(summary?: DependencySummary, deferred = false) {
  if (deferred) return 'Delete check runs when submitted';
  const entries = Object.entries(summary ?? {}).filter(([, value]) => value > 0);
  if (entries.length === 0) return 'No protected dependencies';
  return entries.map(([key, value]) => `${key}: ${value}`).join(' · ');
}

function statusBadgeClass(status: AccountStatus) {
  if (status === 'ACTIVE') return 'status-badge success';
  if (status === 'SUSPENDED') return 'status-badge warning';
  return 'status-badge neutral';
}

function exportHref(type: AccountType, filters: AccountFilters) {
  const params = new URLSearchParams({ type });
  if (filters.q?.trim()) params.set('q', filters.q.trim());
  if (filters.status?.trim()) params.set('status', filters.status.trim());
  return '/portal/accounts/export?' + params.toString();
}

function accountAuditHref(type: AccountType, account: Pick<AccountItem, 'id'>, includeRelated = true) {
  const params = new URLSearchParams({ accountType: type, accountId: account.id, includeRelated: includeRelated ? 'true' : 'false', limit: '100' });
  return '/portal/audit/logs?' + params.toString();
}

function resourceAuditHref(resource: string, resourceId: string, accountType?: AccountType, accountId?: string) {
  const params = new URLSearchParams({ resource, resourceId, limit: '100' });
  if (accountType) params.set('accountType', accountType);
  if (accountId) params.set('accountId', accountId);
  return '/portal/audit/logs?' + params.toString();
}

function governanceExportHref(type: 'SUMMARY' | 'CREDENTIALS' | 'TASKS' | 'NOTIFICATIONS') {
  return '/portal/accounts/governance-export?type=' + encodeURIComponent(type);
}

function metricValue(value?: number) {
  return Number(value ?? 0).toLocaleString('en');
}

function summarizeCounts(counts?: GovernanceCounts) {
  const entries = Object.entries(counts ?? {}).filter(([, value]) => Number(value) > 0);
  if (entries.length === 0) return 'No records';
  return entries.map(([key, value]) => `${key.replaceAll('_', ' ')}: ${value}`).join(' · ');
}

function GovernanceSummaryPanel({ summary }: { summary?: GovernanceSummaryResponse }) {
  if (!summary) return null;
  const riskCount = (summary.riskItems?.expiredCredentials?.length ?? 0)
    + (summary.riskItems?.expiringCredentials?.length ?? 0)
    + (summary.riskItems?.overdueReviewTasks?.length ?? 0)
    + (summary.riskItems?.failedNotifications?.length ?? 0);

  return (
    <section className="card governance-summary-panel">
      <div className="panel-header">
        <div>
          <h3 className="section-title">Account governance reporting</h3>
          <p className="muted compact-text">Scope: {summary.scope} · Generated: {formatDateTime(summary.generatedAt)}</p>
        </div>
        <span className="tag">{riskCount} visible risk items</span>
      </div>
      <div className="governance-metric-grid">
        <div className="governance-metric-card">
          <span className="metric-label">Managed accounts</span>
          <strong>{metricValue(summary.accounts.combinedTotal)}</strong>
          <p className="muted compact-text">Patients: {metricValue(summary.accounts.patients.total)} · Providers: {metricValue(summary.accounts.providers.total)}</p>
          <p className="muted compact-text">Patient lifecycle: {summarizeCounts(summary.accounts.patients.statusCounts)}</p>
          <p className="muted compact-text">Provider lifecycle: {summarizeCounts(summary.accounts.providers.statusCounts)}</p>
        </div>
        <div className="governance-metric-card">
          <span className="metric-label">Provider onboarding</span>
          <strong>{metricValue(summary.providerOnboarding.readyForReview)} ready</strong>
          <p className="muted compact-text">Approved: {metricValue(summary.providerOnboarding.approved)} · Rejected: {metricValue(summary.providerOnboarding.rejected)}</p>
          <p className="muted compact-text">Status mix: {summarizeCounts(summary.providerOnboarding.statusCounts)}</p>
        </div>
        <div className="governance-metric-card warning-card">
          <span className="metric-label">Credential expiry risk</span>
          <strong>{metricValue(summary.credentials.expired)} expired</strong>
          <p className="muted compact-text">Expiring soon: {metricValue(summary.credentials.expiringSoon)} · Verified: {metricValue(summary.credentials.verified)}</p>
          <p className="muted compact-text">Expiry mix: {summarizeCounts(summary.credentials.expiryCounts)}</p>
        </div>
        <div className="governance-metric-card">
          <span className="metric-label">Review workflow</span>
          <strong>{metricValue(summary.reviewTasks.active)} active</strong>
          <p className="muted compact-text">Overdue: {metricValue(summary.reviewTasks.overdue)} · Total tasks: {metricValue(summary.reviewTasks.total)}</p>
          <p className="muted compact-text">Priority mix: {summarizeCounts(summary.reviewTasks.priorityCounts)}</p>
        </div>
        <div className="governance-metric-card">
          <span className="metric-label">Notification operations</span>
          <strong>{metricValue(summary.notifications.queued)} queued</strong>
          <p className="muted compact-text">Failed: {metricValue(summary.notifications.failed)} · Total reminders: {metricValue(summary.notifications.total)}</p>
          <p className="muted compact-text">Channel mix: {summarizeCounts(summary.notifications.channelCounts)}</p>
        </div>
      </div>
      <div className="inline-actions governance-export-actions">
        <a className="button secondary" href={governanceExportHref('SUMMARY')}>Export summary CSV</a>
        <a className="button secondary" href={governanceExportHref('CREDENTIALS')}>Export credential CSV</a>
        <a className="button secondary" href={governanceExportHref('TASKS')}>Export review task CSV</a>
        <a className="button secondary" href={governanceExportHref('NOTIFICATIONS')}>Export notification CSV</a>
      </div>
      <div className="governance-risk-grid">
        <div>
          <h4 className="label-title">Expired credentials</h4>
          {(summary.riskItems?.expiredCredentials ?? []).slice(0, 5).map((item) => (
            <p className="muted compact-text" key={item.id}>{item.providerName ?? item.providerEmail ?? item.providerId} · {item.type} · {dateValue(item.expiresAt) || 'no date'}</p>
          ))}
          {(summary.riskItems?.expiredCredentials?.length ?? 0) === 0 ? <p className="muted compact-text">No expired credential records in the current scope.</p> : null}
        </div>
        <div>
          <h4 className="label-title">Expiring soon</h4>
          {(summary.riskItems?.expiringCredentials ?? []).slice(0, 5).map((item) => (
            <p className="muted compact-text" key={item.id}>{item.providerName ?? item.providerEmail ?? item.providerId} · {item.type} · {dateValue(item.expiresAt) || 'no date'}</p>
          ))}
          {(summary.riskItems?.expiringCredentials?.length ?? 0) === 0 ? <p className="muted compact-text">No credentials expiring in the next 30 days.</p> : null}
        </div>
        <div>
          <h4 className="label-title">Overdue review tasks</h4>
          {(summary.riskItems?.overdueReviewTasks ?? []).slice(0, 5).map((item) => (
            <p className="muted compact-text" key={item.id}>{item.providerName ?? item.providerEmail ?? item.providerId} · {item.priority} · due {dateValue(item.dueAt) || 'not set'}</p>
          ))}
          {(summary.riskItems?.overdueReviewTasks?.length ?? 0) === 0 ? <p className="muted compact-text">No overdue credential review tasks.</p> : null}
        </div>
        <div>
          <h4 className="label-title">Failed reminders</h4>
          {(summary.riskItems?.failedNotifications ?? []).slice(0, 5).map((item) => (
            <p className="muted compact-text" key={item.id}>{item.providerName ?? item.providerEmail ?? item.providerId} · {item.channel} · {item.failureReason ?? item.subject}</p>
          ))}
          {(summary.riskItems?.failedNotifications?.length ?? 0) === 0 ? <p className="muted compact-text">No failed credential reminders.</p> : null}
        </div>
      </div>
    </section>
  );
}

function dataQualityExportHref() {
  return '/portal/accounts/data-quality-export';
}

function severityLabel(severity: DataQualitySeverity) {
  if (severity === 'BLOCKER') return 'Blocker';
  if (severity === 'WARNING') return 'Warning';
  return 'Info';
}

function CredentialGovernanceAutomationPanel() {
  return (
    <section className="card credential-governance-automation-panel">
      <div className="panel-header">
        <div>
          <h3 className="section-title">Credential governance automation</h3>
          <p className="muted compact-text">Run a controlled sweep to expire outdated credentials, create review tasks, and queue provider reminders.</p>
        </div>
        <span className="tag">Phase 13 automation</span>
      </div>
      <form action={runCredentialGovernanceSweep} className="form-grid">
        <AccountInput name="expiringSoonDays" defaultValue="30" placeholder="Expiring-soon window in days" type="number" />
        <AccountInput name="dueInDays" defaultValue="7" placeholder="Review task due in days" type="number" />
        <AccountInput name="limit" defaultValue="250" placeholder="Provider scan limit" type="number" />
        <select name="dryRun" className="input" defaultValue="false">
          <option value="false">Execute changes</option>
          <option value="true">Preview only</option>
        </select>
        <select name="markExpired" className="input" defaultValue="true">
          <option value="true">Mark expired credentials</option>
          <option value="false">Do not mark expired</option>
        </select>
        <select name="createReviewTasks" className="input" defaultValue="true">
          <option value="true">Create missing review tasks</option>
          <option value="false">Do not create tasks</option>
        </select>
        <select name="queueReminders" className="input" defaultValue="true">
          <option value="true">Queue provider reminders</option>
          <option value="false">Do not queue reminders</option>
        </select>
        <button className="button secondary" type="submit">Run credential sweep</button>
      </form>
      <p className="muted compact-text">The sweep is idempotent: it skips active duplicate review tasks and queued duplicate reminders for the same provider/document.</p>
    </section>
  );
}

function DataQualityPanel({ report }: { report?: DataQualityReportResponse }) {
  if (!report) return null;
  const topIssues = report.issues.slice(0, 12);

  return (
    <section className="card data-quality-panel">
      <div className="panel-header">
        <div>
          <h3 className="section-title">Operational data quality</h3>
          <p className="muted compact-text">Scope: {report.scope} · Generated: {formatDateTime(report.generatedAt)}</p>
        </div>
        <span className="tag">{metricValue(report.summary.totalIssues)} issues</span>
      </div>
      <div className="governance-metric-grid">
        <div className="governance-metric-card warning-card">
          <span className="metric-label">Blockers</span>
          <strong>{metricValue(report.summary.blockers)}</strong>
          <p className="muted compact-text">Items that can affect provider approval, clinical access, or compliance readiness.</p>
        </div>
        <div className="governance-metric-card">
          <span className="metric-label">Warnings</span>
          <strong>{metricValue(report.summary.warnings)}</strong>
          <p className="muted compact-text">Records needing operational follow-up or audit metadata correction.</p>
        </div>
        <div className="governance-metric-card">
          <span className="metric-label">Info</span>
          <strong>{metricValue(report.summary.info)}</strong>
          <p className="muted compact-text">Completeness improvements that help booking, billing, and routing quality.</p>
        </div>
      </div>
      <div className="inline-actions governance-export-actions">
        <a className="button secondary" href={dataQualityExportHref()}>Export data-quality CSV</a>
      </div>
      <div className="data-quality-list">
        {topIssues.map((issue) => (
          <article className={`quality-issue-card severity-${issue.severity.toLowerCase()}`} key={issue.id}>
            <div className="panel-header compact-panel-header">
              <div>
                <span className="tag">{severityLabel(issue.severity)} · {issue.category}</span>
                <h4 className="label-title">{issue.title}</h4>
              </div>
              <span className="muted compact-text">{issue.entityType}</span>
            </div>
            <p className="muted compact-text">{issue.accountName || issue.accountEmail || issue.entityId}{issue.organizationName ? ` · ${issue.organizationName}` : ''}</p>
            <p className="compact-text">{issue.detail}</p>
            <p className="muted compact-text"><strong>Recommended action:</strong> {issue.recommendation}</p>
          </article>
        ))}
        {topIssues.length === 0 ? <p className="muted">No operational data-quality issues were detected in the current scope.</p> : null}
        {report.issues.length > topIssues.length ? <p className="muted compact-text">Showing the first {topIssues.length} issues. Export the CSV for the complete list.</p> : null}
      </div>
    </section>
  );
}


function ImportAccountsPanel() {
  const patientTemplate = 'organizationId,firstName,lastName,email,dateOfBirth,insuranceNumber,status,password\n,Amina,Haddad,amina.patient@example.com,1990-05-12,INS-1001,ACTIVE,ChangeMe123!';
  const providerTemplate = 'organizationId,firstName,lastName,email,role,specialty,licenseNumber,services,status,password\n,Karim,Nasser,karim.provider@example.com,PROVIDER,Cardiology,LIC-1001,"Consultation|Telehealth",ACTIVE,ChangeMe123!';

  return (
    <section className="card">
      <div className="panel-header">
        <h3 className="section-title">Bulk CSV import</h3>
        <span className="tag">Create-only · validates duplicates</span>
      </div>
      <p className="muted">Paste CSV rows to create patient or provider accounts in batches. Imports are all-or-nothing: if any row is invalid or duplicates an existing email, no accounts are created.</p>
      <div className="split-shell account-import-grid">
        <form action={importAccounts} className="form-grid">
          <input type="hidden" name="type" value="PATIENT" />
          <label className="label-title" htmlFor="patient-import-csv">Patient CSV</label>
          <textarea id="patient-import-csv" name="csv" className="input textarea" rows={7} defaultValue={patientTemplate} />
          <button className="button primary" type="submit">Import patients</button>
        </form>
        <form action={importAccounts} className="form-grid">
          <input type="hidden" name="type" value="PROVIDER" />
          <label className="label-title" htmlFor="provider-import-csv">Provider CSV</label>
          <textarea id="provider-import-csv" name="csv" className="input textarea" rows={7} defaultValue={providerTemplate} />
          <button className="button primary" type="submit">Import providers</button>
        </form>
      </div>
      <ul className="data-points muted compact-text">
        <li>For organization-scoped admins, the organization column is ignored and the current organization is used.</li>
        <li>Organization is optional. If organizationId/organizationName is empty, the API assigns the default unassigned organization.</li>
        <li>Provider roles accepted: PROVIDER, NURSE, PHARMACIST, LAB_TECH.</li>
      </ul>
    </section>
  );
}

function accountStatusCounts(items: AccountItem[]) {
  return items.reduce(
    (acc, item) => {
      acc[item.status] += 1;
      return acc;
    },
    { ACTIVE: 0, SUSPENDED: 0, ARCHIVED: 0 } as Record<AccountStatus, number>,
  );
}

function formatDateTime(value?: string | null) {
  if (!value) return 'Not recorded';
  try {
    return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatAuditAction(action: string) {
  return action
    .replace(/^admin\./, '')
    .replaceAll('.', ' / ')
    .replaceAll('_', ' ');
}

function StatusSelect({ name = 'status', defaultValue = 'ACTIVE' }: { name?: string; defaultValue?: AccountStatus | string }) {
  return (
    <select name={name} className="input" defaultValue={defaultValue}>
      <option value="ACTIVE">ACTIVE</option>
      <option value="SUSPENDED">SUSPENDED</option>
      <option value="ARCHIVED">ARCHIVED</option>
    </select>
  );
}

function StatusBadge({ status }: { status: AccountStatus }) {
  return <span className={statusBadgeClass(status)}>{status}</span>;
}


function OnboardingStatusSelect({ defaultValue = 'DRAFT' }: { defaultValue?: ProviderOnboardingStatus | string }) {
  return (
    <select name="onboardingStatus" className="input" defaultValue={defaultValue}>
      <option value="DRAFT">DRAFT</option>
      <option value="READY_FOR_REVIEW">READY_FOR_REVIEW</option>
      <option value="REQUEST_CHANGES">REQUEST_CHANGES</option>
      <option value="APPROVED">APPROVED</option>
      <option value="REJECTED">REJECTED</option>
    </select>
  );
}

function OnboardingBadge({ status }: { status?: ProviderOnboardingStatus }) {
  const value = status ?? 'DRAFT';
  return <span className={`status-badge onboarding-${value.toLowerCase().replaceAll('_', '-')}`}>{value.replaceAll('_', ' ')}</span>;
}


function CredentialTypeSelect({ defaultValue = 'LICENSE' }: { defaultValue?: CredentialDocumentType | string }) {
  return (
    <select name="credentialType" className="input" defaultValue={defaultValue}>
      <option value="LICENSE">LICENSE</option>
      <option value="ID_DOCUMENT">ID DOCUMENT</option>
      <option value="INSURANCE">INSURANCE</option>
      <option value="CERTIFICATION">CERTIFICATION</option>
      <option value="DEGREE">DEGREE</option>
      <option value="OTHER">OTHER</option>
    </select>
  );
}

function CredentialStatusSelect({ defaultValue = 'UPLOADED' }: { defaultValue?: CredentialDocumentStatus | string }) {
  return (
    <select name="credentialStatus" className="input" defaultValue={defaultValue}>
      <option value="MISSING">MISSING</option>
      <option value="UPLOADED">UPLOADED</option>
      <option value="VERIFIED">VERIFIED</option>
      <option value="REJECTED">REJECTED</option>
      <option value="EXPIRED">EXPIRED</option>
    </select>
  );
}

function CredentialBadge({ document }: { document: ProviderCredentialDocument }) {
  const status = document.expiryState === 'EXPIRED' && document.status === 'VERIFIED' ? 'EXPIRED' : document.status;
  const extra = document.expiryState === 'EXPIRING_SOON' ? ' · expires soon' : '';
  return <span className={`status-badge credential-${status.toLowerCase()}`}>{status.replaceAll('_', ' ')}{extra}</span>;
}

function ReviewTaskStatusSelect({ defaultValue = 'OPEN' }: { defaultValue?: CredentialReviewTaskStatus | string }) {
  return (
    <select name="reviewTaskStatus" className="input" defaultValue={defaultValue}>
      <option value="OPEN">OPEN</option>
      <option value="IN_REVIEW">IN REVIEW</option>
      <option value="BLOCKED">BLOCKED</option>
      <option value="COMPLETED">COMPLETED</option>
      <option value="CANCELLED">CANCELLED</option>
    </select>
  );
}

function ReviewTaskPrioritySelect({ defaultValue = 'NORMAL' }: { defaultValue?: CredentialReviewPriority | string }) {
  return (
    <select name="reviewTaskPriority" className="input" defaultValue={defaultValue}>
      <option value="LOW">LOW</option>
      <option value="NORMAL">NORMAL</option>
      <option value="HIGH">HIGH</option>
      <option value="URGENT">URGENT</option>
    </select>
  );
}

function ReviewTaskBadge({ task }: { task: CredentialReviewTask }) {
  return <span className={`status-badge review-task-${task.status.toLowerCase().replaceAll('_', '-')}`}>{task.priority} · {task.status.replaceAll('_', ' ')}</span>;
}

function NotificationChannelSelect({ defaultValue = 'EMAIL' }: { defaultValue?: CredentialNotificationChannel | string }) {
  return (
    <select name="notificationChannel" className="input" defaultValue={defaultValue}>
      <option value="EMAIL">EMAIL</option>
      <option value="IN_APP">IN APP</option>
      <option value="MANUAL">MANUAL</option>
    </select>
  );
}

function NotificationStatusSelect({ defaultValue = 'QUEUED' }: { defaultValue?: CredentialNotificationStatus | string }) {
  return (
    <select name="notificationStatus" className="input" defaultValue={defaultValue}>
      <option value="QUEUED">QUEUED</option>
      <option value="SENT">SENT</option>
      <option value="FAILED">FAILED</option>
      <option value="CANCELLED">CANCELLED</option>
    </select>
  );
}

function CredentialNotificationBadge({ notification }: { notification: CredentialNotification }) {
  return <span className={`status-badge notification-${notification.status.toLowerCase()}`}>{notification.channel.replaceAll('_', ' ')} · {notification.status}</span>;
}

function CredentialNotificationCenter({ notifications }: { notifications: CredentialNotification[] }) {
  const queued = notifications.filter((notification) => notification.status === 'QUEUED');
  return (
    <section className="card credential-notification-center">
      <div className="panel-header">
        <h3 className="section-title">Credential notification center</h3>
        <span className="tag">{queued.length} queued reminders</span>
      </div>
      <p className="muted compact-text">Queued notifications can now be dispatched through the backend delivery adapter. By default, dispatch runs in dry-run mode until the webhook provider variables are configured manually.</p>
      <form action={dispatchCredentialNotifications} className="form-grid notification-dispatch-form">
        <AccountInput name="limit" type="number" defaultValue="25" placeholder="Batch limit" />
        <select name="force" className="input" defaultValue="false">
          <option value="false">Due queued only</option>
          <option value="true">Force queued batch</option>
        </select>
        <select name="includeManual" className="input" defaultValue="false">
          <option value="false">Skip manual channel</option>
          <option value="true">Include manual channel</option>
        </select>
        <button className="button" type="submit">Dispatch due reminders</button>
      </form>
      <div className="timeline-list notification-list">
        {notifications.map((notification) => (
          <div className="timeline-item notification-item" key={notification.id}>
            <div className="audit-line">
              <strong>{notification.subject}</strong>
              <CredentialNotificationBadge notification={notification} />
            </div>
            <p className="muted compact-text">Provider: {notification.providerName ?? notification.providerEmail ?? notification.providerId} · Recipient: {notification.recipientEmail ?? 'not set'} · Scheduled: {dateValue(notification.scheduledFor) || 'now/manual'}</p>
            <p className="muted compact-text">Document: {notification.documentTitle ?? notification.documentType ?? 'general credentialing'} · Task: {notification.taskTitle ?? 'not linked'} · Sent: {dateValue(notification.sentAt) || 'not sent'}</p>
            <p className="muted compact-text">Provider adapter: {notification.deliveryProvider ?? 'not dispatched'} · Message ref: {notification.deliveryProviderMessageId ?? 'none'} · Attempts: {notification.dispatchAttemptCount ?? 0} · Last attempt: {dateValue(notification.lastDispatchAt) || 'none'}</p>
            <p className="muted compact-text">{notification.message}</p>
            {notification.failureReason ? <p className="muted compact-text">Failure: {notification.failureReason}</p> : null}
            <form action={dispatchSingleCredentialNotification} className="form-grid notification-status-form">
              <input type="hidden" name="notificationId" value={notification.id} />
              <input type="hidden" name="force" value="true" />
              <button className="button" type="submit" disabled={notification.channel === 'MANUAL'}>{notification.status === 'FAILED' ? 'Retry dispatch' : 'Dispatch now'}</button>
            </form>
            <form action={changeCredentialNotificationStatus} className="form-grid notification-status-form">
              <input type="hidden" name="notificationId" value={notification.id} />
              <NotificationStatusSelect defaultValue={notification.status} />
              <AccountInput name="scheduledFor" type="date" defaultValue={dateValue(notification.scheduledFor)} placeholder="Scheduled date" />
              <AccountInput name="failureReason" defaultValue={notification.failureReason ?? ''} placeholder="Failure reason if failed" />
              <button className="button secondary" type="submit">Update reminder</button>
            </form>
          </div>
        ))}
        {notifications.length === 0 ? <p className="muted compact-text">No credential reminders have been queued yet.</p> : null}
      </div>
    </section>
  );
}

function CredentialReviewTaskBoard({ tasks }: { tasks: CredentialReviewTask[] }) {
  const activeTasks = tasks.filter((task) => ['OPEN', 'IN_REVIEW', 'BLOCKED'].includes(task.status));
  return (
    <section className="card credential-review-board">
      <div className="panel-header">
        <h3 className="section-title">Credential review queue</h3>
        <span className="tag">{activeTasks.length} active tasks</span>
      </div>
      <div className="timeline-list review-task-list">
        {tasks.map((task) => (
          <div className="timeline-item review-task-item" key={task.id}>
            <div className="audit-line">
              <strong>{task.title}</strong>
              <ReviewTaskBadge task={task} />
            </div>
            <p className="muted compact-text">Provider: {task.providerName ?? task.providerEmail ?? task.providerId} · Document: {task.documentTitle ?? task.documentType ?? 'general onboarding'} · Due: {dateValue(task.dueAt) || 'not set'}</p>
            <p className="muted compact-text">Assigned to: {task.assignedToName ?? task.assignedToEmail ?? 'unassigned'} · Organization: {task.organizationName ?? 'Organization'}</p>
            {task.blockReason ? <p className="muted compact-text">Blocked: {task.blockReason}</p> : null}
            {task.decisionNote ? <p className="muted compact-text">Decision note: {task.decisionNote}</p> : null}
            <form action={queueCredentialTaskReminder} className="form-grid notification-reminder-form">
              <input type="hidden" name="taskId" value={task.id} />
              <NotificationChannelSelect />
              <NotificationStatusSelect />
              <AccountInput name="recipientEmail" defaultValue={task.assignedToEmail ?? task.providerEmail ?? ''} placeholder="Recipient email" />
              <AccountInput name="scheduledFor" type="date" placeholder="Schedule date optional" />
              <AccountInput name="subject" defaultValue={`Credential review reminder: ${task.title}`} placeholder="Subject" />
              <AccountInput name="message" defaultValue={`Please review credential task "${task.title}" for ${task.providerName ?? task.providerEmail ?? 'provider'}.`} placeholder="Message" />
              <button className="button secondary" type="submit">Queue task reminder</button>
            </form>
            <form action={changeProviderCredentialReviewTask} className="form-grid review-task-form">
              <input type="hidden" name="taskId" value={task.id} />
              <AccountInput name="reviewTaskTitle" defaultValue={task.title} placeholder="Task title" />
              <ReviewTaskStatusSelect defaultValue={task.status} />
              <ReviewTaskPrioritySelect defaultValue={task.priority} />
              <AccountInput name="reviewTaskDueAt" type="date" defaultValue={dateValue(task.dueAt)} placeholder="Due date" />
              <AccountInput name="assignedToEmail" defaultValue={task.assignedToEmail ?? ''} placeholder="Reviewer email optional" />
              <AccountInput name="blockReason" defaultValue={task.blockReason ?? ''} placeholder="Block reason" />
              <AccountInput name="reviewTaskDecisionNote" defaultValue={task.decisionNote ?? ''} placeholder="Decision note" />
              <button className="button secondary" type="submit">Update task</button>
            </form>
          </div>
        ))}
        {tasks.length === 0 ? <p className="muted">No credential review tasks returned by the API.</p> : null}
      </div>
    </section>
  );
}

function ProviderCredentialReviewTasksPanel({ provider }: { provider: AccountItem }) {
  const tasks = provider.credentialReviewTasks ?? [];
  const documents = provider.credentialDocuments ?? [];
  return (
    <div className="provider-review-tasks-panel">
      <div className="audit-line"><strong>Review tasks</strong><span className="tag">{tasks.length} active</span></div>
      <form action={saveProviderCredentialReviewTask} className="form-grid review-task-form">
        <input type="hidden" name="providerId" value={provider.id} />
        <AccountInput name="reviewTaskTitle" placeholder="Task title" />
        <select name="documentId" className="input" defaultValue="">
          <option value="">General provider review</option>
          {documents.map((document) => <option key={document.id} value={document.id}>{document.type.replaceAll('_', ' ')} · {document.title}</option>)}
        </select>
        <ReviewTaskStatusSelect />
        <ReviewTaskPrioritySelect />
        <AccountInput name="reviewTaskDueAt" type="date" placeholder="Due date" />
        <AccountInput name="assignedToEmail" placeholder="Reviewer email optional" />
        <AccountInput name="reviewTaskDecisionNote" placeholder="Task note" />
        <button className="button secondary" type="submit">Create review task</button>
      </form>
      <div className="credential-document-list">
        {tasks.map((task) => (
          <div className="credential-document-item review-task-mini" key={task.id}>
            <div className="audit-line"><strong>{task.title}</strong><ReviewTaskBadge task={task} /></div>
            <p className="muted compact-text">Due: {dateValue(task.dueAt) || 'not set'} · Assigned: {task.assignedToName ?? task.assignedToEmail ?? 'unassigned'} · Document: {task.documentTitle ?? task.documentType ?? 'general'}</p>
            <form action={changeProviderCredentialReviewTask} className="quick-status-actions">
              <input type="hidden" name="taskId" value={task.id} />
              <input type="hidden" name="reviewTaskStatus" value={task.status === 'COMPLETED' ? 'OPEN' : 'COMPLETED'} />
              <input type="hidden" name="reviewTaskPriority" value={task.priority} />
              <input type="hidden" name="reviewTaskDecisionNote" value={task.status === 'COMPLETED' ? 'Reopened from provider panel' : 'Completed from provider panel'} />
              <button className="button ghost" type="submit">{task.status === 'COMPLETED' ? 'Reopen' : 'Complete'}</button>
            </form>
          </div>
        ))}
        {tasks.length === 0 ? <p className="muted compact-text">No active credential review tasks for this provider.</p> : null}
      </div>
    </div>
  );
}

function ProviderCredentialDocumentsPanel({ provider }: { provider: AccountItem }) {
  const documents = provider.credentialDocuments ?? [];
  const summary = provider.credentialSummary;
  return (
    <div className="provider-credentials-panel">
      <div className="audit-line">
        <strong>Credential documents</strong>
        <span className="tag">{summary?.verified ?? 0}/{summary?.total ?? 0} verified</span>
      </div>
      <p className="muted compact-text">
        Required missing: {summary?.missingRequiredTypes?.length ? summary.missingRequiredTypes.join(', ') : 'none'} · Expiring soon: {summary?.expiringSoon ?? 0} · Expired: {summary?.expired ?? 0}
      </p>
      <form action={queueProviderCredentialReminder} className="form-grid notification-reminder-form">
        <input type="hidden" name="providerId" value={provider.id} />
        <NotificationChannelSelect />
        <NotificationStatusSelect />
        <AccountInput name="recipientEmail" defaultValue={provider.email} placeholder="Recipient email" />
        <AccountInput name="scheduledFor" type="date" placeholder="Schedule date optional" />
        <AccountInput name="subject" defaultValue="Provider credentialing follow-up" placeholder="Subject" />
        <AccountInput name="message" defaultValue="Please complete or update your provider credentialing requirements." placeholder="Message" />
        <button className="button secondary" type="submit">Queue provider credential reminder</button>
      </form>
      <form action={saveProviderCredentialDocument} className="form-grid credential-document-form">
        <input type="hidden" name="providerId" value={provider.id} />
        <CredentialTypeSelect />
        <AccountInput name="title" placeholder="Document title" />
        <CredentialStatusSelect />
        <AccountInput name="referenceNumber" placeholder="Reference / policy / ID number" />
        <AccountInput name="issuedAt" type="date" placeholder="Issued at" />
        <AccountInput name="expiresAt" type="date" placeholder="Expires at" />
        <AccountInput name="documentUrl" placeholder="Secure document URL or object key" />
        <AccountInput name="fileName" placeholder="File name" />
        <AccountInput name="notes" placeholder="Notes" />
        <button className="button secondary" type="submit">Add credential document</button>
      </form>
      <div className="credential-document-list">
        {documents.map((document) => (
          <div className="credential-document-item" key={document.id}>
            <div className="audit-line">
              <strong>{document.title || document.type}</strong>
              <CredentialBadge document={document} />
            </div>
            <p className="muted compact-text">
              {document.type.replaceAll('_', ' ')} · Ref: {document.referenceNumber || 'not recorded'} · Expires: {dateValue(document.expiresAt) || 'No expiry'} · Verified by: {document.verifiedByName || 'not verified'}
            </p>
            {document.documentUrl ? <p className="muted compact-text">Stored file: {document.fileName || document.documentUrl}</p> : null}
            {document.rejectionReason ? <p className="muted compact-text">Rejection reason: {document.rejectionReason}</p> : null}
            <div className="inline-actions account-audit-actions">
              <a className="button ghost" href={resourceAuditHref('provider_credential_document', document.id, 'PROVIDER', provider.id)}>Document audit trail</a>
            </div>
            <form action={queueProviderCredentialReminder} className="form-grid notification-reminder-form compact-credential-form">
              <input type="hidden" name="providerId" value={provider.id} />
              <input type="hidden" name="documentId" value={document.id} />
              <NotificationChannelSelect />
              <NotificationStatusSelect />
              <AccountInput name="recipientEmail" defaultValue={provider.email} placeholder="Recipient email" />
              <AccountInput name="scheduledFor" type="date" placeholder="Schedule date optional" />
              <AccountInput name="subject" defaultValue={`Credential renewal reminder: ${document.title || document.type}`} placeholder="Subject" />
              <AccountInput name="message" defaultValue={`Please update credential document "${document.title || document.type}".`} placeholder="Message" />
              <button className="button ghost" type="submit">Queue document reminder</button>
            </form>
            <form action={saveProviderCredentialDocument} className="form-grid credential-document-form compact-credential-form">
              <input type="hidden" name="providerId" value={provider.id} />
              <input type="hidden" name="documentId" value={document.id} />
              <CredentialTypeSelect defaultValue={document.type} />
              <AccountInput name="title" defaultValue={document.title} placeholder="Document title" />
              <CredentialStatusSelect defaultValue={document.status} />
              <AccountInput name="referenceNumber" defaultValue={document.referenceNumber} placeholder="Reference" />
              <AccountInput name="issuedAt" type="date" defaultValue={dateValue(document.issuedAt)} placeholder="Issued" />
              <AccountInput name="expiresAt" type="date" defaultValue={dateValue(document.expiresAt)} placeholder="Expires" />
              <AccountInput name="documentUrl" defaultValue={document.documentUrl} placeholder="Secure URL / object key" />
              <AccountInput name="fileName" defaultValue={document.fileName} placeholder="File name" />
              <AccountInput name="rejectionReason" defaultValue={document.rejectionReason} placeholder="Rejection reason" />
              <AccountInput name="notes" defaultValue={document.notes} placeholder="Notes" />
              <button className="button secondary" type="submit">Save document</button>
            </form>
            <div className="quick-status-actions">
              {(['VERIFIED', 'REJECTED', 'EXPIRED'] as CredentialDocumentStatus[]).filter((status) => status !== document.status).map((status) => (
                <form key={status} action={changeProviderCredentialDocumentStatus}>
                  <input type="hidden" name="providerId" value={provider.id} />
                  <input type="hidden" name="documentId" value={document.id} />
                  <input type="hidden" name="credentialStatus" value={status} />
                  <input type="hidden" name="rejectionReason" value={status === 'REJECTED' ? 'Rejected during admin credential review' : ''} />
                  <button className="button ghost" type="submit">Mark {status.replaceAll('_', ' ')}</button>
                </form>
              ))}
              <form action={deleteProviderCredentialDocument}>
                <input type="hidden" name="providerId" value={provider.id} />
                <input type="hidden" name="documentId" value={document.id} />
                <button className="button danger" type="submit">Delete document</button>
              </form>
            </div>
          </div>
        ))}
        {documents.length === 0 ? <p className="muted compact-text">No credential documents have been registered for this provider.</p> : null}
      </div>
    </div>
  );
}

function providerReadiness(provider: AccountItem) {
  const credentialSummary = provider.credentialSummary;
  const credentialsReady = Boolean(credentialSummary && credentialSummary.missingRequiredTypes.length === 0 && credentialSummary.expired === 0);
  const checks = [Boolean(provider.licenseNumber), credentialsReady, Boolean(provider.specialty), Boolean(provider.services?.length), provider.onboardingStatus === 'APPROVED'];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function ProviderOnboardingPanel({ provider }: { provider: AccountItem }) {
  const readiness = providerReadiness(provider);
  const checklist = provider.onboarding?.checklist ?? [];
  return (
    <div className="provider-onboarding-panel">
      <div className="audit-line">
        <strong>Credentialing</strong>
        <OnboardingBadge status={provider.onboardingStatus ?? provider.onboarding?.status} />
      </div>
      <div className="readiness-meter" aria-label={`Provider readiness ${readiness}%`}><span style={{ width: `${readiness}%` }} /></div>
      <p className="muted compact-text">Readiness: {readiness}% · Submitted: {formatDateTime(provider.onboarding?.submittedAt)} · Reviewed: {formatDateTime(provider.onboarding?.reviewedAt)}</p>
      {provider.onboarding?.decisionNote ? <p className="muted compact-text">Decision note: {provider.onboarding.decisionNote}</p> : null}
      {checklist.length > 0 ? (
        <ul className="data-points muted compact-text provider-checklist">
          {checklist.slice(0, 3).map((item, index) => <li key={`${provider.id}-check-${index}`}>{item.label ?? 'Check'}: {item.status ?? 'Pending'}</li>)}
        </ul>
      ) : null}
      <form action={changeProviderOnboarding} className="form-grid provider-onboarding-form">
        <input type="hidden" name="id" value={provider.id} />
        <OnboardingStatusSelect defaultValue={provider.onboardingStatus ?? provider.onboarding?.status ?? 'DRAFT'} />
        <AccountInput name="onboardingDecisionNote" defaultValue={provider.onboarding?.decisionNote ?? ''} placeholder="Credentialing decision note" />
        <button className="button secondary" type="submit">Update credentialing</button>
      </form>
    </div>
  );
}

function AccountInput({ name, defaultValue, placeholder, type = 'text', required = false, form }: { name: string; defaultValue?: string | null; placeholder: string; type?: string; required?: boolean; form?: string }) {
  const visiblePlaceholder = required && !placeholder.includes('*') ? `${placeholder} *` : placeholder;
  return <input name={name} form={form} type={type} defaultValue={defaultValue ?? ''} placeholder={visiblePlaceholder} className="input" required={required} aria-required={required || undefined} />;
}


function ProviderRoleSelect({ roles, defaultValue = 'PROVIDER' }: { roles: ProviderRoleItem[]; defaultValue?: string | null }) {
  const activeRoles = roles.filter((role) => role.isActive || role.code === defaultValue || role.id === defaultValue);
  return (
    <label className="field-label required-field">
      <span>Provider role *</span>
      <select name="role" className="input" defaultValue={defaultValue ?? 'PROVIDER'} required aria-label="Provider role required" aria-required="true">
        {activeRoles.map((role) => (
          <option key={role.id} value={role.code}>{role.label} ({role.code})</option>
        ))}
      </select>
    </label>
  );
}

function ProviderRoleMaintenancePanel({ roles }: { roles: ProviderRoleItem[] }) {
  return (
    <section className="card">
      <div className="panel-header">
        <div>
          <h3 className="section-title">Provider role catalog</h3>
          <p className="muted compact-text">Maintain the Provider form role list. Custom roles map to a secure system role used by RBAC.</p>
        </div>
        <span className="tag">{roles.length} roles</span>
      </div>

      <form action={saveProviderRole} className="form-grid">
        <AccountInput name="label" placeholder="Role label" required />
        <AccountInput name="code" placeholder="Role code optional; generated from label" />
        <select name="systemRole" className="input" defaultValue="PROVIDER" required aria-label="System role required">
          <option value="PROVIDER">System role *: PROVIDER</option>
          <option value="NURSE">System role *: NURSE</option>
          <option value="PHARMACIST">System role *: PHARMACIST</option>
          <option value="LAB_TECH">System role *: LAB_TECH</option>
        </select>
        <select name="isActive" className="input" defaultValue="true" aria-label="Role active status">
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
        <AccountInput name="sortOrder" type="number" placeholder="Sort order" defaultValue="100" />
        <AccountInput name="description" placeholder="Description optional" />
        <button className="button primary" type="submit">Add provider role</button>
      </form>

      <div className="list-stack" style={{ marginTop: 16 }}>
        {roles.map((role) => (
          <div className="list-row account-list-row" key={role.id}>
            <form action={saveProviderRole} className="form-grid account-edit-grid">
              <input type="hidden" name="id" value={role.id} />
              <AccountInput name="label" defaultValue={role.label} placeholder="Role label" required />
              <AccountInput name="code" defaultValue={role.code} placeholder="Role code" required />
              <select name="systemRole" className="input" defaultValue={role.systemRole} disabled={role.isSystem} aria-label="System role required">
                <option value="PROVIDER">PROVIDER</option>
                <option value="NURSE">NURSE</option>
                <option value="PHARMACIST">PHARMACIST</option>
                <option value="LAB_TECH">LAB_TECH</option>
              </select>
              {role.isSystem ? <input type="hidden" name="systemRole" value={role.systemRole} /> : null}
              <select name="isActive" className="input" defaultValue={role.isActive ? 'true' : 'false'} aria-label="Role active status">
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
              <AccountInput name="sortOrder" type="number" defaultValue={String(role.sortOrder ?? 100)} placeholder="Sort order" />
              <AccountInput name="description" defaultValue={role.description ?? ''} placeholder="Description" />
              <button className="button secondary" type="submit">Update role</button>
            </form>
            <div className="account-side-panel">
              <p className="muted compact-text">{role.isSystem ? 'Default system role' : 'Custom role'} · {role.providerCount ?? 0} provider(s) using it</p>
              <p className="muted compact-text">RBAC system role: {role.systemRole}</p>
              <form action={deleteProviderRole} className="delete-form">
                <input type="hidden" name="id" value={role.id} />
                <button className="button danger" type="submit" disabled={role.isSystem || Boolean(role.providerCount)} title={role.isSystem ? 'Default roles cannot be deleted' : role.providerCount ? 'Reassign providers before deleting this role' : 'Delete role'}>Delete role</button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function OrganizationSelect({ organizations, defaultValue, locked = false }: { organizations: OrganizationItem[]; defaultValue?: string; locked?: boolean }) {
  if (locked && defaultValue) return <input type="hidden" name="organizationId" value={defaultValue} />;

  return (
    <select name="organizationId" className="input" defaultValue={defaultValue ?? ''} aria-label="Organization optional">
      <option value="">Organization optional — use default/unassigned</option>
      {organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}
    </select>
  );
}

function DeleteButton({ canDelete, label }: { canDelete?: boolean; label: string }) {
  const blocked = canDelete === false;
  return <button className="button danger" type="submit" disabled={blocked} title={blocked ? 'Delete is blocked because the account has protected dependencies' : 'Delete is checked safely by the API before removal'}>{label}</button>;
}

function BulkLifecycleForm({ type, label }: { type: AccountType; label: string }) {
  const formId = type === 'PATIENT' ? 'bulk-patient-status-form' : 'bulk-provider-status-form';

  return (
    <form id={formId} action={bulkChangeStatus} className="bulk-toolbar">
      <input type="hidden" name="type" value={type} />
      <div>
        <div className="label-title">{label}</div>
        <p className="muted compact-text">Select rows below, then apply a lifecycle action.</p>
      </div>
      <StatusSelect />
      <AccountInput name="deactivationReason" placeholder="Bulk reason for suspended/archived accounts" />
      <button className="button secondary" type="submit">Apply to selected</button>
    </form>
  );
}

function QuickStatusActions({ type, account }: { type: AccountType; account: AccountItem }) {
  const action = type === 'PATIENT' ? changePatientStatus : changeProviderStatus;
  const options: AccountStatus[] = ['ACTIVE', 'SUSPENDED', 'ARCHIVED'];

  return (
    <div className="quick-status-actions">
      {options.filter((status) => status !== account.status).map((status) => (
        <form key={status} action={action}>
          <input type="hidden" name="id" value={account.id} />
          <input type="hidden" name="status" value={status} />
          <input type="hidden" name="deactivationReason" value={status === 'ACTIVE' ? '' : `Admin lifecycle action: ${status}`} />
          <button className={status === 'ARCHIVED' ? 'button ghost' : 'button secondary'} type="submit">
            {status === 'ACTIVE' ? 'Reactivate' : status === 'SUSPENDED' ? 'Suspend' : 'Archive'}
          </button>
        </form>
      ))}
    </div>
  );
}

function AccountAuditTimeline({ events }: { events: AccountAuditEvent[] }) {
  return (
    <section className="card">
      <div className="panel-header">
        <h3 className="section-title">Account audit history</h3>
        <span className="tag">{events.length} recent events</span>
      </div>
      <div className="timeline-list">
        {events.map((event) => (
          <div className="timeline-item account-audit-item" key={event.id}>
            <div className="audit-line">
              <strong>{formatAuditAction(event.action)}</strong>
              <span className="muted">{formatDateTime(event.createdAt)}</span>
            </div>
            <p className="muted compact-text">
              {event.resource} {event.resourceId ? `· ${event.resourceId}` : ''} · {event.organizationName ?? 'Organization'} · {event.actorName ?? event.actorEmail ?? 'System'}
            </p>
            {event.details ? <p className="muted compact-text">{Object.entries(event.details).map(([key, value]) => `${key}: ${String(value)}`).join(' · ')}</p> : null}
          </div>
        ))}
        {events.length === 0 ? <p className="muted">No account audit events returned by the API.</p> : null}
      </div>
    </section>
  );
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

export default async function AccountsPage({ searchParams }: AccountsPageProps) {
  const filters = await Promise.resolve(searchParams ?? {});
  const staleError = paramValue(filters.error);
  if (staleError && isAuthSessionError(staleError)) {
    redirect(`/auth/sign-in?next=${encodeURIComponent('/portal/accounts')}&reason=session-expired`);
  }
  const result = await loadAccounts(filters);
  const lockedOrganizationId = result.organizations.length === 1 ? result.organizations[0].id : undefined;
  const allAccounts = [...result.patients, ...result.providers];
  const statusCounts = accountStatusCounts(allAccounts);
  const error = paramValue(filters.error);
  const success = paramValue(filters.success);

  return (
    <PortalShell currentPath="/portal/accounts">
      <DataSourceBanner source={result.source} error={result.error} />
      <StatusNotice type="error" message={error} />
      <StatusNotice type="success" message={success} />

      <div className="hero-panel">
        <div className="hero-panel-grid">
          <div className="hero-copy">
            <div className="page-eyebrow">Identity administration</div>
            <h2 className="hero-title">Patient & Provider Accounts</h2>
            <p className="hero-subtitle">Create, modify, import, export, reset temporary passwords, suspend/archive, reactivate, credential, assign review tasks, verify provider documents, queue reminders, run data-quality checks, bulk-update, and delete patient or provider accounts from one governed admin workspace.</p>
            <div className="hero-metrics">
              <div className="hero-metric"><div className="hero-metric-label">Patients</div><div className="hero-metric-value">{result.patients.length}</div><div className="hero-metric-detail">Managed patient profiles</div></div>
              <div className="hero-metric"><div className="hero-metric-label">Providers</div><div className="hero-metric-value">{result.providers.length}</div><div className="hero-metric-detail">Provider profiles and clinical roles</div></div>
              <div className="hero-metric"><div className="hero-metric-label">Active</div><div className="hero-metric-value">{statusCounts.ACTIVE}</div><div className="hero-metric-detail">Can authenticate</div></div>
              <div className="hero-metric"><div className="hero-metric-label">Queued reminders</div><div className="hero-metric-value">{result.credentialNotifications.filter((item) => item.status === 'QUEUED').length}</div><div className="hero-metric-detail">Credential follow-ups</div></div>
            </div>
          </div>
          <div className="soft-card">
            <h3 className="section-title">Governed account policy</h3>
            <ul className="data-points muted">
              <li>New accounts use temporary password <strong>ChangeMe123!</strong> unless another value is entered.</li>
              <li>Entering a password while modifying an account resets that account password.</li>
              <li>Status controls support ACTIVE, SUSPENDED, and ARCHIVED lifecycle states.</li>
              <li>Reactivating an account clears deactivation metadata; suspended or archived accounts have active sessions revoked.</li>
              <li>Bulk lifecycle actions are capped at 100 selected accounts and are audit-logged per account.</li>
              <li>CSV imports are create-only, all-or-nothing, and capped at 200 rows per request.</li>
              <li>CSV exports preserve the active filters applied on this page.</li>
              <li>Provider credentialing is tracked through onboarding state, required credential documents, verification status, expiry metadata, queued reminders, and audit trail.</li>
              <li>Operational data-quality checks highlight credential blockers, overdue review tasks, failed reminders, and incomplete patient/provider metadata.</li>
              <li>Admins can run credential-governance automation sweeps to mark expired documents, create review tasks, and queue reminders.</li>
              <li>Delete remains blocked when protected clinical, booking, messaging, audit, or payment records exist.</li>
            </ul>
          </div>
        </div>
      </div>

      <section className="card">
        <div className="panel-header">
          <h3 className="section-title">Account search and lifecycle filters</h3>
          <span className="tag">API-backed filters</span>
        </div>
        <form className="form-grid" method="get">
          <AccountInput name="q" defaultValue={filters.q ?? ''} placeholder="Search name, email, license, insurance, organization" />
          <select name="status" className="input" defaultValue={filters.status ?? ''}>
            <option value="">All statuses</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="SUSPENDED">SUSPENDED</option>
            <option value="ARCHIVED">ARCHIVED</option>
          </select>
          <button className="button secondary" type="submit">Apply filters</button>
          <a className="button ghost" href="/portal/accounts">Clear</a>
        </form>
        <div className="inline-actions account-export-actions">
          <a className="button secondary" href="/portal/organizations">Manage organizations</a>
          <a className="button secondary" href={exportHref('PATIENT', filters)}>Export patients CSV</a>
          <a className="button secondary" href={exportHref('PROVIDER', filters)}>Export providers CSV</a>
        </div>
      </section>

      <section className="card">
        <div className="panel-header">
          <h3 className="section-title">Governance panels</h3>
          <span className="tag">Load on demand</span>
        </div>
        {result.governanceLoaded ? (
          <p className="muted">Governance, data-quality, review task, notification, and audit panels are loaded for this view.</p>
        ) : (
          <p className="muted">Heavy governance panels are not loaded by default to prevent slow database bursts and token expiry during account administration.</p>
        )}
        <div className="inline-actions">
          {result.governanceLoaded ? (
            <a className="button ghost" href={`/portal/accounts${accountQuery(filters)}`}>Hide governance panels</a>
          ) : (
            <a className="button secondary" href={`/portal/accounts${accountQuery({ ...filters, section: 'governance' }, { includeSection: true })}`}>Load governance panels</a>
          )}
        </div>
      </section>

      {result.governanceLoaded ? (
        <>
          <CredentialGovernanceAutomationPanel />
          <GovernanceSummaryPanel summary={result.governanceSummary} />
          <DataQualityPanel report={result.dataQuality} />
          <CredentialReviewTaskBoard tasks={result.credentialReviewTasks} />
          <CredentialNotificationCenter notifications={result.credentialNotifications} />
        </>
      ) : null}

      <ImportAccountsPanel />
      <ProviderRoleMaintenancePanel roles={result.providerRoles} />

      <div className="split-shell">
        <section className="card">
          <h3 className="section-title">Create patient</h3>
          <p className="muted compact-text">Organization is optional. Fields marked with * are required. If organization is left empty, the account is assigned to the default unassigned organization.</p>
          <form action={savePatient} className="form-grid">
            <OrganizationSelect organizations={result.organizations} defaultValue={lockedOrganizationId} locked={Boolean(lockedOrganizationId)} />
            <AccountInput name="firstName" placeholder="First name" required />
            <AccountInput name="lastName" placeholder="Last name" required />
            <AccountInput name="email" type="email" placeholder="Email" required />
            <AccountInput name="dateOfBirth" type="date" placeholder="Date of birth" />
            <AccountInput name="insuranceNumber" placeholder="Insurance number" />
            <AccountInput name="password" type="password" placeholder="Temporary password optional" />
            <StatusSelect />
            <AccountInput name="deactivationReason" placeholder="Reason if suspended/archived" />
            <button className="button primary" type="submit">Create patient</button>
          </form>
        </section>

        <section className="card">
          <h3 className="section-title">Create provider</h3>
          <p className="muted compact-text">Organization is optional. Fields marked with * are required. If organization is left empty, the account is assigned to the default unassigned organization.</p>
          <form action={saveProvider} className="form-grid">
            <OrganizationSelect organizations={result.organizations} defaultValue={lockedOrganizationId} locked={Boolean(lockedOrganizationId)} />
            <AccountInput name="firstName" placeholder="First name" required />
            <AccountInput name="lastName" placeholder="Last name" required />
            <AccountInput name="email" type="email" placeholder="Email" required />
            <ProviderRoleSelect roles={result.providerRoles} defaultValue="PROVIDER" />
            <AccountInput name="specialty" placeholder="Specialty" />
            <AccountInput name="licenseNumber" placeholder="License number" />
            <AccountInput name="services" placeholder="Services comma-separated" />
            <AccountInput name="password" type="password" placeholder="Temporary password optional" />
            <StatusSelect />
            <AccountInput name="deactivationReason" placeholder="Reason if suspended/archived" />
            <OnboardingStatusSelect />
            <AccountInput name="onboardingDecisionNote" placeholder="Credentialing note optional" />
            <button className="button primary" type="submit">Create provider</button>
          </form>
        </section>
      </div>

      <section className="card">
        <div className="panel-header"><h3 className="section-title">Patient list</h3><span className="tag">Modify / reset / lifecycle / delete</span></div>
        <BulkLifecycleForm type="PATIENT" label="Bulk patient lifecycle" />
        <div className="list-stack">
          {result.patients.map((patient) => (
            <div className="list-row account-list-row" key={patient.id}>
              <label className="row-selector" title="Select for bulk lifecycle action">
                <input type="checkbox" name="ids" value={patient.id} form="bulk-patient-status-form" />
                <span>Select</span>
              </label>
              <form action={savePatient} className="form-grid account-edit-grid">
                <input type="hidden" name="id" value={patient.id} />
                <input type="hidden" name="organizationId" value={patient.organizationId} />
                <AccountInput name="firstName" defaultValue={patient.firstName} placeholder="First name" required />
                <AccountInput name="lastName" defaultValue={patient.lastName} placeholder="Last name" required />
                <AccountInput name="email" defaultValue={patient.email} placeholder="Email" type="email" required />
                <AccountInput name="dateOfBirth" type="date" defaultValue={dateValue(patient.dateOfBirth)} placeholder="DOB" />
                <AccountInput name="insuranceNumber" defaultValue={patient.insuranceNumber} placeholder="Insurance" />
                <AccountInput name="password" type="password" placeholder="New temporary password optional" />
                <StatusSelect defaultValue={patient.status} />
                <AccountInput name="deactivationReason" defaultValue={patient.deactivationReason} placeholder="Reason if inactive" />
                <button className="button secondary" type="submit">Save</button>
              </form>
              <div className="account-side-panel">
                <p className="muted" style={{ marginBottom: 8 }}>{patient.organizationName ?? 'Organization'} · <StatusBadge status={patient.status} /></p>
                <p className="muted" style={{ marginBottom: 8 }}>{dependencyText(patient.dependencySummary, patient.dependencyCheckDeferred)}</p>
                <QuickStatusActions type="PATIENT" account={patient} />
                <div className="inline-actions account-audit-actions"><a className="button secondary" href={accountAuditHref('PATIENT', patient, false)}>Audit trail</a></div>
                <form action={deletePatient} className="delete-form"><input type="hidden" name="id" value={patient.id} /><DeleteButton canDelete={patient.canDelete} label="Delete" /></form>
              </div>
            </div>
          ))}
          {result.patients.length === 0 ? <p className="muted">No patient accounts returned by the API.</p> : null}
        </div>
      </section>

      <section className="card">
        <div className="panel-header"><h3 className="section-title">Provider list</h3><span className="tag">Modify / reset / lifecycle / delete</span></div>
        <BulkLifecycleForm type="PROVIDER" label="Bulk provider lifecycle" />
        <div className="list-stack">
          {result.providers.map((provider) => (
            <div className="list-row account-list-row" key={provider.id}>
              <label className="row-selector" title="Select for bulk lifecycle action">
                <input type="checkbox" name="ids" value={provider.id} form="bulk-provider-status-form" />
                <span>Select</span>
              </label>
              <form action={saveProvider} className="form-grid account-edit-grid">
                <input type="hidden" name="id" value={provider.id} />
                <input type="hidden" name="organizationId" value={provider.organizationId} />
                <AccountInput name="firstName" defaultValue={provider.firstName} placeholder="First name" required />
                <AccountInput name="lastName" defaultValue={provider.lastName} placeholder="Last name" required />
                <AccountInput name="email" defaultValue={provider.email} placeholder="Email" type="email" required />
                <ProviderRoleSelect roles={result.providerRoles} defaultValue={provider.role} />
                <AccountInput name="specialty" defaultValue={provider.specialty} placeholder="Specialty" />
                <AccountInput name="licenseNumber" defaultValue={provider.licenseNumber} placeholder="License" />
                <AccountInput name="services" defaultValue={(provider.services ?? []).join(', ')} placeholder="Services" />
                <AccountInput name="password" type="password" placeholder="New temporary password optional" />
                <StatusSelect defaultValue={provider.status} />
                <AccountInput name="deactivationReason" defaultValue={provider.deactivationReason} placeholder="Reason if inactive" />
                <OnboardingStatusSelect defaultValue={provider.onboardingStatus ?? provider.onboarding?.status ?? 'DRAFT'} />
                <AccountInput name="onboardingDecisionNote" defaultValue={provider.onboarding?.decisionNote ?? ''} placeholder="Credentialing note" />
                <button className="button secondary" type="submit">Save</button>
              </form>
              <div className="account-side-panel">
                <p className="muted" style={{ marginBottom: 8 }}>{provider.organizationName ?? 'Organization'} · <StatusBadge status={provider.status} /></p>
                <p className="muted" style={{ marginBottom: 8 }}>{dependencyText(provider.dependencySummary, provider.dependencyCheckDeferred)}</p>
                <QuickStatusActions type="PROVIDER" account={provider} />
                <div className="inline-actions account-audit-actions">
                  <a className="button secondary" href={accountAuditHref('PROVIDER', provider, false)}>Account audit</a>
                  <a className="button secondary" href={accountAuditHref('PROVIDER', provider, true)}>Full credential audit</a>
                </div>
                <ProviderOnboardingPanel provider={provider} />
                <ProviderCredentialReviewTasksPanel provider={provider} />
                <ProviderCredentialDocumentsPanel provider={provider} />
                <form action={deleteProvider} className="delete-form"><input type="hidden" name="id" value={provider.id} /><DeleteButton canDelete={provider.canDelete} label="Delete" /></form>
              </div>
            </div>
          ))}
          {result.providers.length === 0 ? <p className="muted">No provider accounts returned by the API.</p> : null}
        </div>
      </section>

      <AccountAuditTimeline events={result.auditEvents} />
    </PortalShell>
  );
}
