import { cookies } from 'next/headers';
import { formatUtcDateTime } from '@/lib/formatters';
import { mockAccessGrants, mockAccessWorkspace, mockAuditLogs, mockBookingControl, mockBookingControlWorkspace, mockCampaignWorkspace, mockCampaigns, mockCoverage, mockCoverageWorkspace, mockDashboard, mockIntegrationWorkspace, mockIntegrations, mockPolicyGovernance, mockPolicyTemplates, mockPricingRules, mockPricingWorkspace, mockProviderDirectory, mockProviderDetails, mockProviderProfiles, mockProviderQueue, mockRefundWorkspace, mockRefunds, mockReports, mockReportsWorkspace, mockReviewModeration, mockReviewModerationWorkspace, mockSafetyCases, mockSafetyWorkspace, mockServiceCatalog, mockServiceCatalogWorkspace, mockSettlementWorkspace, mockSettlements, mockSupportTickets, mockSupportWorkspace, mockTelehealthOps, mockTelehealthWorkspace } from '@/lib/api/mock/admin-data';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

type LoadResult<T> = {
  data: T;
  source: 'api' | 'mock';
  error?: string;
};

type ApiDashboardResponse = {
  kpis: {
    users: number;
    providers: number;
    appointments: number;
    revenueMinor: number;
    liveSessions: number;
  };
  audits: Array<{
    id: string;
    action: string;
    resource: string;
    resourceId?: string | null;
    details?: Record<string, unknown> | null;
    createdAt: string;
    actor?: { email?: string | null; name?: string | null; role?: string | null } | null;
  }>;
  subjectSummary?: {
    total?: number;
    selfCount?: number;
    familyCount?: number;
    topRelationship?: string | null;
    topLabel?: string | null;
    byRelationship?: Record<string, number>;
    byLabel?: Record<string, number>;
  } | null;
  governedRefillSummary?: {
    savedScopeCount?: number;
    latestScopeTitle?: string | null;
    failedDeliveries?: number;
    governanceNotes?: string[];
    summary?: {
      exportReadyCount?: number;
      escalationCount?: number;
      failedDeliveryCount?: number;
      operationalEventCount?: number;
      deliveryExecutionCount?: number;
      controlledMedicationEvents?: number;
    };
  } | null;
};

type ApiRefillAuditScopeUsageResponse = {
  items: Array<{
    id: string;
    title: string;
    note?: string | null;
    updatedAt: string;
    filters?: {
      queue?: string | null;
      assignedRole?: string | null;
      controlledOnly?: boolean;
      escalatedOnly?: boolean;
    };
    summary?: {
      exportReadyCount?: number;
      escalationCount?: number;
      failedDeliveryCount?: number;
      operationalEventCount?: number;
      deliveryExecutionCount?: number;
      controlledMedicationEvents?: number;
    };
    governanceNotes?: string[];
    latestExecution?: {
      id: string;
      title: string;
      status: string;
      executedAt: string;
      summary: string;
    } | null;
  }>;
  count: number;
};


type ApiRefillAuditScopeDetailResponse = {
  item: {
    id: string;
    title: string;
    note?: string | null;
    updatedAt: string;
    queue?: string | null;
    assignedRole?: string | null;
    controlledOnly?: boolean;
    escalatedOnly?: boolean;
    includeExecutions?: boolean;
    includeOperationalEvents?: boolean;
    limit?: number;
  };
  summary?: {
    exportReadyCount?: number;
    escalationCount?: number;
    failedDeliveryCount?: number;
    operationalEventCount?: number;
    deliveryExecutionCount?: number;
    controlledMedicationEvents?: number;
  };
  governanceNotes?: string[];
  latestFailures?: Array<{
    id: string;
    title: string;
    destination?: string | null;
    summary?: string;
    executedAt: string;
  }>;
};

type ApiReportDeliveryFailureResponse = {
  items: Array<{ id: string; title: string; destination?: string | null; summary?: string; executedAt: string; errorMessage?: string | null }>;
  count: number;
  summary?: {
    failedCount?: number;
    destinations?: number;
    schedules?: number;
    latestFailureAt?: string | null;
  };
};

type ApiProviderListItem = {
  id: string;
  userId: string;
  name: string;
  email: string;
  organizationName?: string | null;
  role: string;
  specialty: string;
  licenseNumber?: string | null;
  hspModel?: 'INDIVIDUAL' | 'INSTITUTIONAL' | 'ORGANIZATION_BASED' | string | null;
  hspModelLabel?: string | null;
  hspAccessScope?: string | null;
  hspAccessScopeLabel?: string | null;
  primaryFacility?: string | null;
  consentScope?: string | null;
  services: string[];
  serviceMode: string;
  locations: string[];
  nextAvailableLabel: string;
  onboardingStatus: string;
  lastReviewAction?: string | null;
  lastReviewedAt?: string | null;
  storageMode?: string;
};

type ApiProviderListResponse = {
  items: ApiProviderListItem[];
  count: number;
};

type ApiProviderQueueItem = ApiProviderListItem & {
  checklist: Record<string, boolean>;
  submittedAt?: string | null;
  needsReview: boolean;
};

type ApiProviderQueueResponse = {
  items: ApiProviderQueueItem[];
  summary: Record<string, number>;
  count: number;
  storageMode?: string;
};

type ApiProviderDetailResponse = {
  id: string;
  userId: string;
  profile: {
    name: string;
    email: string;
    organizationName?: string | null;
    role: string;
    specialty?: string | null;
    licenseNumber?: string | null;
    services: string[];
    joinedAt: string;
    hspModel?: string | null;
    hspModelLabel?: string | null;
    hspAccessScope?: string | null;
    primaryFacility?: string | null;
    consentScope?: string | null;
  };
  onboarding: {
    status: string;
    checklist: Record<string, boolean>;
    hspAccess?: Record<string, unknown> | null;
    storageMode: string;
    persistedState?: {
      status: string;
      submittedAt?: string | null;
      reviewedAt?: string | null;
      decisionNote?: string | null;
      requestedFields?: Record<string, unknown> | null;
      lastAction?: string | null;
    } | null;
    latestReview?: {
      action: string;
      createdAt: string;
      details?: Record<string, unknown> | null;
      actor?: { id: string; name: string; email: string; role: string } | null;
    } | null;
    history: Array<{
      id: string;
      action: string;
      createdAt: string;
      details?: Record<string, unknown> | null;
      actor?: { id: string; name: string; email: string; role: string } | null;
    }>;
  };
  metrics: {
    recentAppointments: number;
    recentPayments: number;
    completedAppointments: number;
  };
};

type ApiAuditLogItem = {
  id: string;
  action: string;
  resource: string;
  resourceId?: string | null;
  details?: Record<string, unknown> | null;
  facilityContext?: {
    location?: string | null;
    facilityId?: string | null;
    domain?: string | null;
    external?: boolean | null;
  } | null;
  subjectContext?: {
    subjectProfileId?: string | null;
    subjectLabel?: string | null;
    subjectRelationship?: string | null;
    isFamilySubject?: boolean;
  } | null;
  createdAt: string;
  actor?: { email?: string | null; name?: string | null; role?: string | null } | null;
};

type ApiAuditLogsResponse = {
  items: ApiAuditLogItem[];
  count: number;
};


type ApiGrowthSummaryResponse = {
  summary: {
    total: number;
    ready: number;
    attentionRequired: number;
    byStatus: Record<string, number>;
  };
  storageMode?: string;
};

type ApiGrowthItem = {
  id: string;
  code: string;
  title: string;
  status: string;
  summary?: string;
  category?: string;
  ownerRole?: string;
  schedule?: string;
  destination?: string;
  metricKeys?: string[];
  tags?: string[];
  lastRunAt?: string | null;
  updatedAt: string;
  createdAt: string;
  audience?: string;
  channel?: string;
  scheduledFor?: string | null;
  suppressionCount?: number;
  provider?: string;
  environment?: string;
  lastHealthStatus?: string;
  lastCheckedAt?: string | null;
  lastRotatedAt?: string | null;
  priority?: string;
  source?: string;
  queue?: string;
  disputedEntity?: string;
  riskSignals?: string[];
  ownerName?: string | null;
  reviewerUserId?: string | null;
  disposition?: string | null;
};

type ApiGrowthListResponse = {
  items: ApiGrowthItem[];
  count: number;
  storageMode?: string;
};

type ApiGrowthDetailResponse = {
  item: ApiGrowthItem;
  storageMode?: string;
};

type ApiModerationDetailResponse = ApiGrowthDetailResponse & {
  auditTrail?: ApiAuditLogItem[];
};

type ApiReportPresetResponse = {
  items: Array<{ id: string; title: string; metricKeys?: string[]; description?: string }>;
};

type ApiSavedReportPresetResponse = {
  items: Array<{ id: string; title: string; description?: string | null; metricKeys?: string[]; format?: 'csv' | 'json'; range?: string; subjectScope?: 'all' | 'self' | 'family'; createdAt?: string; updatedAt?: string }>;
  count: number;
};

type ApiReportDeliveryScheduleResponse = {
  items: Array<{ id: string; title: string; destination: string; schedule: string; format?: 'csv' | 'json'; range?: string; subjectScope?: 'all' | 'self' | 'family'; active?: boolean; presetId?: string | null; reportId?: string | null; updatedAt?: string; note?: string | null; lastRunAt?: string | null; lastRunStatus?: string | null; lastRunSummary?: string | null }>;
  count: number;
};

type ApiReportDeliveryExecutionResponse = {
  items: Array<{ id: string; scheduleId?: string | null; title: string; destination?: string | null; status: string; format?: 'csv' | 'json'; range?: string; subjectScope?: 'all' | 'self' | 'family'; trigger?: string; metricsCount?: number; summary?: string; executedAt: string; errorMessage?: string | null }>;
  count: number;
};

type ApiReportRunResponse = {
  item: ApiGrowthItem;
  reportRun: {
    reportId: string;
    range: string;
    generatedAt: string;
    metrics: Array<{ metricKey: string; value: number; deltaPct: number }>;
    refillInsights?: {
      byQueue?: Record<string, number>;
      byAgingBand?: Record<string, number>;
      controlledMedicationQueue?: number;
      rejectedControlledMedication?: number;
    };
  };
  storageMode?: string;
};

// Server-side fetch timeout (ms). Without this, a slow or unreachable API
// makes server components hang for the platform default before the loader
// can fall back to mock data, producing the documented ~20s page loads.
// A short timeout lets the existing per-loader try/catch fall back fast.
const API_TIMEOUT_MS = Number.parseInt(process.env.ADMIN_API_TIMEOUT_MS ?? '6000', 10);

async function apiRequest<T>(path: string): Promise<T> {
  return apiRequestWithInit<T>(path);
}

async function apiRequestWithInit<T>(path: string, init?: RequestInit): Promise<T> {
  const store = await cookies();
  const token = store.get('cc_admin_access_token')?.value ?? store.get('cc_access_token')?.value;
  if (!token) {
    throw new Error('Missing admin access token');
  }

  const timeoutMs = Number.isFinite(API_TIMEOUT_MS) && API_TIMEOUT_MS > 0 ? API_TIMEOUT_MS : 6000;
  // Combine an explicit timeout signal with any caller-provided signal.
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const signal = init?.signal
    ? (AbortSignal as unknown as { any?: (signals: AbortSignal[]) => AbortSignal }).any?.([init.signal, timeoutSignal]) ?? timeoutSignal
    : timeoutSignal;

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
      cache: 'no-store',
      signal,
    });
  } catch (error) {
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      throw new Error(`API request timed out after ${timeoutMs}ms: ${path}`);
    }
    throw error;
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `API request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

function formatCurrencyMinor(amountMinor: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format((amountMinor ?? 0) / 100);
}

function humanizeAction(action: string) {
  return action.replace(/[_\.]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function summarizeDetails(details?: Record<string, unknown> | null, subjectContext?: ApiAuditLogItem['subjectContext']) {
  if (!details) return 'Captured via API workflow';
  const note = typeof details.note === 'string' && details.note.trim() ? details.note.trim() : null;
  const source = typeof details.source === 'string' && details.source.trim() ? details.source.trim() : null;
  const reasonCode = typeof details.reasonCode === 'string' && details.reasonCode.trim() ? details.reasonCode.trim() : null;
  const subject = subjectContext?.isFamilySubject ? [subjectContext?.subjectLabel ?? 'Family subject', subjectContext?.subjectRelationship].filter(Boolean).join(' • ') : null;
  return note ?? source ?? reasonCode ?? (subject ? `Subject scope: ${subject}` : 'Captured via API workflow');
}

function inferOutcome(action: string) {
  if (/reject|denied|fail/i.test(action)) return 'Denied' as const;
  if (/request_changes|escalat/i.test(action)) return 'Escalated' as const;
  return 'Success' as const;
}


function summarizeRecordSummary(summary: unknown) {
  if (typeof summary === 'string') return summary;
  if (summary == null) return null;
  if (Array.isArray(summary)) {
    const parts = summary
      .map((item) => summarizeRecordSummary(item))
      .filter((item): item is string => Boolean(item && String(item).trim()));
    return parts.length ? parts.join(' · ') : null;
  }
  if (typeof summary === 'object') {
    const value = summary as Record<string, unknown>;
    const preferred = [value.title, value.diagnosis, value.recordType, value.type, value.note, value.testName, value.drug]
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
    if (preferred.length) return preferred.join(' · ');
    try {
      return JSON.stringify(summary);
    } catch {
      return 'Clinical record returned by API';
    }
  }
  return String(summary);
}

function fallbackErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Live API data is unavailable.';
}

function mapDashboard(data: ApiDashboardResponse) {
  return {
    kpis: [
      { id: 'providers', label: 'Providers', value: String(data.kpis.providers), trend: `${data.kpis.users} users in org scope` },
      { id: 'appointments', label: 'Appointments', value: String(data.kpis.appointments), trend: 'Organization-wide volume' },
      { id: 'revenue', label: 'Revenue', value: formatCurrencyMinor(data.kpis.revenueMinor), trend: 'Captured payment total' },
    ],
    supportBacklog: 0,
    safetyIncidentsOpen: 0,
    uptime: `${data.kpis.liveSessions} live sessions`,
  };
}

function mapAuditLogs(data: ApiAuditLogsResponse | ApiDashboardResponse) {
  const items = 'items' in data ? data.items : data.audits;
  return items.map((log) => {
    const subject = log.subjectContext?.isFamilySubject
      ? [log.subjectContext?.subjectLabel ?? 'Family subject', log.subjectContext?.subjectRelationship].filter(Boolean).join(' • ')
      : null;
    return {
      id: log.id,
      timestamp: log.createdAt,
      actor: log.actor?.name || log.actor?.email || 'System',
      action: humanizeAction(log.action),
      target: [log.resource, log.resourceId, subject ? `subject:${subject}` : null].filter(Boolean).join(' / '),
      purpose: summarizeDetails(log.details, log.subjectContext),
      outcome: inferOutcome(log.action),
      subject,
      location: log.facilityContext?.location ?? null,
    };
  });
}

function mapProviderDirectoryItem(item: ApiProviderListItem) {
  const lastAction = (item.lastReviewAction || '').toLowerCase();
  const status = item.onboardingStatus;
  const isApproved = status === 'APPROVED';
  const needsChanges = status === 'REQUEST_CHANGES';
  const rejected = status === 'REJECTED';

  return {
    id: item.id,
    providerName: item.name,
    organizationName: item.organizationName || item.email,
    providerType: item.hspModel === 'ORGANIZATION_BASED' ? 'Organization-based' : item.hspModel === 'INSTITUTIONAL' ? 'Institutional' : 'Individual',
    specialty: item.specialty || 'Unassigned',
    primaryMarket: item.primaryFacility || item.locations[0] || 'Not set',
    operatingStatus: isApproved ? 'Active' : rejected ? 'Suspended' : needsChanges ? 'Restricted' : 'Pending re-verification',
    credentialHealth: lastAction.includes('rejected') ? 'Action required' : lastAction.includes('changes') ? 'Expiring soon' : 'Healthy',
    bookingEligibility: isApproved ? 'Eligible' : needsChanges ? 'Limited' : 'Blocked',
    payoutReadiness: isApproved ? 'Ready' : needsChanges ? 'Pending' : 'On hold',
    linkedOpenItems: isApproved ? 0 : 1,
    accessScopeLabel: item.hspAccessScopeLabel || undefined,
    primaryFacility: item.primaryFacility || undefined,
    lastReviewedAt: item.lastReviewedAt || new Date().toISOString(),
  } as const;
}

function mapQueueItem(item: ApiProviderQueueItem) {
  const checklistValues = Object.values(item.checklist);
  const completeCount = checklistValues.filter(Boolean).length;
  const docStatus = completeCount === checklistValues.length ? 'Complete' : completeCount >= Math.max(checklistValues.length - 1, 1) ? 'Missing items' : 'Needs recheck';
  const riskFlag = item.onboardingStatus === 'REJECTED' ? 'High' : item.onboardingStatus === 'REQUEST_CHANGES' ? 'Medium' : 'Low';
  return {
    id: item.id,
    providerName: item.name,
    organizationName: item.email,
    city: item.locations[0] || 'Not set',
    specialty: item.specialty || 'Unassigned',
    submittedAt: item.submittedAt || new Date().toISOString(),
    slaHoursRemaining: item.needsReview ? 6 : 24,
    docStatus,
    riskFlag,
  } as const;
}

function mapProviderVerificationDetail(detail: ApiProviderDetailResponse) {
  const checklistEntries = Object.entries(detail.onboarding.checklist);
  return {
    id: detail.id,
    providerName: detail.profile.name,
    organizationName: detail.profile.organizationName || detail.profile.email,
    licenseNumber: detail.profile.licenseNumber || 'Pending',
    cityCoverage: detail.profile.services.length ? detail.profile.services : ['General coverage'],
    mandatoryDocs: checklistEntries.map(([key, value]) => ({
      name: key.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase()),
      status: value ? 'Received' : 'Missing',
    })),
    checks: [
      { label: 'Onboarding status', result: detail.onboarding.status === 'APPROVED' ? 'Pass' : detail.onboarding.status === 'REQUEST_CHANGES' ? 'Review' : detail.onboarding.status === 'REJECTED' ? 'Fail' : 'Review' },
      { label: 'Profile completeness', result: checklistEntries.every(([, value]) => value) ? 'Pass' : 'Review' },
      { label: 'Latest review recorded', result: detail.onboarding.latestReview ? 'Pass' : 'Review' },
    ],
    riskNotes: [
      `HSP model: ${detail.profile.hspModelLabel || detail.profile.hspModel || 'Unspecified'}.`,
      `Access scope: ${detail.profile.hspAccessScope || 'Not captured'}. Primary facility: ${detail.profile.primaryFacility || 'Not captured'}.`,
      `Storage mode: ${detail.onboarding.storageMode}`,
      detail.onboarding.persistedState?.decisionNote || 'No reviewer note captured yet.',
      `Recent appointments: ${detail.metrics.recentAppointments}; completed: ${detail.metrics.completedAppointments}; recent payments: ${detail.metrics.recentPayments}.`,
    ],
  } as const;
}

export async function loadIntegratedDashboard(): Promise<LoadResult<{ dashboard: typeof mockDashboard; providerDirectory: typeof mockProviderDirectory; providerQueue: typeof mockProviderQueue; auditLogs: typeof mockAuditLogs; governedRefillSummary?: ApiDashboardResponse['governedRefillSummary']; subjectSummary?: ApiDashboardResponse['subjectSummary'] }>> {
  try {
    const [dashboard, providers, queue, audits] = await Promise.all([
      apiRequest<ApiDashboardResponse>('/api/dashboard/admin'),
      apiRequest<ApiProviderListResponse>('/api/providers'),
      apiRequest<ApiProviderQueueResponse>('/api/providers/queue'),
      apiRequest<ApiAuditLogsResponse>('/api/audit/logs?limit=6'),
    ]);

    return {
      source: 'api',
      data: {
        dashboard: mapDashboard(dashboard),
        providerDirectory: providers.items.map(mapProviderDirectoryItem),
        providerQueue: queue.items.map(mapQueueItem),
        auditLogs: mapAuditLogs(audits),
        governedRefillSummary: dashboard.governedRefillSummary ?? null,
        subjectSummary: dashboard.subjectSummary ?? null,
      },
    };
  } catch (error) {
    return {
      source: 'mock',
      error: fallbackErrorMessage(error),
      data: {
        dashboard: mockDashboard,
        providerDirectory: mockProviderDirectory,
        providerQueue: mockProviderQueue,
        auditLogs: mockAuditLogs,
        governedRefillSummary: null,
        subjectSummary: null,
      },
    };
  }
}

export async function loadIntegratedProviderDirectory(): Promise<LoadResult<typeof mockProviderDirectory>> {
  try {
    const response = await apiRequest<ApiProviderListResponse>('/api/providers');
    return { source: 'api', data: response.items.map(mapProviderDirectoryItem) };
  } catch (error) {
    return { source: 'mock', error: fallbackErrorMessage(error), data: mockProviderDirectory };
  }
}

export async function loadIntegratedProviderProfile(providerId: string): Promise<LoadResult<ApiProviderDetailResponse>> {
  try {
    const response = await apiRequest<ApiProviderDetailResponse>(`/api/providers/${providerId}`);
    return { source: 'api', data: response };
  } catch (error) {
    const fallback = mockProviderProfiles[providerId]
      ? ({
          id: providerId,
          userId: providerId,
          profile: {
            name: mockProviderProfiles[providerId].providerName,
            email: mockProviderProfiles[providerId].organizationName,
            role: 'PROVIDER',
            specialty: mockProviderProfiles[providerId].specialty,
            licenseNumber: mockProviderProfiles[providerId].licenseNumber,
            services: [mockProviderProfiles[providerId].specialty],
            joinedAt: mockProviderProfiles[providerId].lastReviewedAt,
          },
          onboarding: {
            status: mockProviderProfiles[providerId].linkedQueues.onboardingStatus.toUpperCase().replace(/\s+/g, '_'),
            checklist: {
              identityComplete: true,
              specialtyComplete: true,
              licenseComplete: true,
              servicesComplete: true,
            },
            storageMode: 'mock',
            latestReview: null,
            history: mockProviderProfiles[providerId].timeline.map((entry, index) => ({
              id: `${providerId}-${index}`,
              action: 'provider.profile.timeline',
              createdAt: entry.at,
              details: { note: entry.event },
              actor: null,
            })),
          },
          metrics: {
            recentAppointments: mockProviderProfiles[providerId].rosterSummary.activeBookings7d,
            recentPayments: mockProviderProfiles[providerId].linkedQueues.payoutExceptionsOpen,
            completedAppointments: mockProviderProfiles[providerId].rosterSummary.activeBookings7d,
          },
        } satisfies ApiProviderDetailResponse)
      : null;

    if (fallback) {
      return { source: 'mock', error: fallbackErrorMessage(error), data: fallback };
    }

    throw error;
  }
}

export async function loadIntegratedProviderQueue(): Promise<LoadResult<{ items: typeof mockProviderQueue; summary: Record<string, number> }>> {
  try {
    const response = await apiRequest<ApiProviderQueueResponse>('/api/providers/queue');
    return {
      source: 'api',
      data: {
        items: response.items.map(mapQueueItem),
        summary: response.summary,
      },
    };
  } catch (error) {
    return {
      source: 'mock',
      error: fallbackErrorMessage(error),
      data: {
        items: mockProviderQueue,
        summary: {
          READY_FOR_REVIEW: mockProviderQueue.length,
        },
      },
    };
  }
}

export async function loadIntegratedProviderReview(providerId: string): Promise<LoadResult<{ detail: typeof mockProviderDetails[string]; apiDetail?: ApiProviderDetailResponse }>> {
  try {
    const response = await apiRequest<ApiProviderDetailResponse>(`/api/providers/queue/${providerId}`);
    return {
      source: 'api',
      data: {
        detail: mapProviderVerificationDetail(response),
        apiDetail: response,
      },
    };
  } catch (error) {
    const fallback = mockProviderDetails[providerId];
    if (fallback) {
      return { source: 'mock', error: fallbackErrorMessage(error), data: { detail: fallback } };
    }
    throw error;
  }
}

export async function loadIntegratedAuditLogs(limit = 6, subjectScope: 'all' | 'self' | 'family' = 'all', location?: string): Promise<LoadResult<typeof mockAuditLogs>> {
  try {
    const query = new URLSearchParams({ limit: String(limit), subjectScope, ...(location ? { location } : {}) }).toString();
    const response = await apiRequest<ApiAuditLogsResponse>(`/api/audit/logs?${query}`);
    const mapped = mapAuditLogs(response);
    const scoped = subjectScope === 'all'
      ? mapped
      : mapped.filter((item) => subjectScope === 'family' ? item.subject !== 'Self profile' : item.subject === 'Self profile');
    const filtered = location ? scoped.filter((item: any) => String((item as any).location ?? '').toLowerCase().includes(location.toLowerCase())) : scoped;
    return { source: 'api', data: filtered };
  } catch (error) {
    const scopedFallback = subjectScope === 'all'
      ? mockAuditLogs.slice(0, limit)
      : mockAuditLogs.filter((item) => subjectScope === 'family' ? item.subject !== 'Self profile' : item.subject === 'Self profile').slice(0, limit);
    const fallback = location ? scopedFallback.filter((item: any) => String((item as any).location ?? '').toLowerCase().includes(location.toLowerCase())) : scopedFallback;
    return { source: 'mock', error: fallbackErrorMessage(error), data: fallback };
  }
}



type ApiPaymentItem = {
  id: string;
  appointmentId?: string | null;
  amountMinor: number;
  currency: string;
  status: string;
  gateway: string;
  commissionMinor?: number | null;
  createdAt: string;
  updatedAt: string;
  patientName?: string | null;
  providerName?: string | null;
  service?: string | null;
  hold: {
    active: boolean;
    heldAt?: string | null;
    heldBy?: string | null;
    reasonCode?: string | null;
    note?: string | null;
    releasedAt?: string | null;
    releasedBy?: string | null;
  };
  metadata?: Record<string, unknown> | null;
  refund?: Record<string, unknown> | null;
};

type ApiPaymentListResponse = {
  items: ApiPaymentItem[];
  count?: number;
};

type ApiPaymentSummaryResponse = {
  summary: {
    totalPayments: number;
    totalAmountMinor: number;
    capturedAmountMinor: number;
    refundedAmountMinor: number;
    heldPayments: number;
    byStatus: Record<string, number>;
  };
};

type ApiRbacSummaryResponse = {
  summary: {
    totalUsers: number;
    privilegedUsers: number;
    rolesDefined: number;
    byRole: Record<string, number>;
  };
};

type ApiRbacRoleCatalogResponse = {
  items: Array<{
    role: string;
    category: string;
    description: string;
  }>;
};

type ApiRbacMatrixResponse = {
  items: Record<string, string[]>;
};

type ApiRbacAssignmentResponse = {
  items: Array<{
    id: string;
    email: string;
    name: string;
    role: string;
    organizationId?: string | null;
    accessScope: string;
    requiresMfaEnrollment: boolean;
    status: string;
  }>;
  count: number;
};

function formatMoney(amountMinor: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: (currency || 'USD').toUpperCase(),
    maximumFractionDigits: 2,
  }).format((amountMinor ?? 0) / 100);
}

function formatCompactMoney(amountMinor: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: (currency || 'USD').toUpperCase(),
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format((amountMinor ?? 0) / 100);
}

function formatBatchRef(paymentId: string) {
  return `PAY-${paymentId.slice(0, 8).toUpperCase()}`;
}

function formatAging(createdAt: string) {
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return 'Unknown';
  const deltaDays = Math.max(0, Math.round((Date.now() - created) / (1000 * 60 * 60 * 24)));
  if (deltaDays <= 1) return '0-1 days';
  if (deltaDays <= 3) return `${deltaDays} days`;
  return `${deltaDays}+ days`;
}

function paymentStatusToSettlementStatus(item: ApiPaymentItem): 'Cleared' | 'Pending' | 'Mismatch' {
  if (item.hold.active) return 'Mismatch';
  if (item.status === 'CAPTURED' || item.status === 'REFUNDED') return 'Cleared';
  return 'Pending';
}

function mapSettlementItem(item: ApiPaymentItem) {
  return {
    id: item.id,
    batchRef: formatBatchRef(item.id),
    gateway: item.gateway || 'manual',
    status: paymentStatusToSettlementStatus(item),
    amount: formatMoney(item.amountMinor, item.currency),
    aging: formatAging(item.createdAt),
  } as const;
}

function mapRefundItem(item: ApiPaymentItem) {
  const refund = (item.refund || {}) as Record<string, unknown>;
  const reasonCode = typeof refund.reasonCode === 'string' && refund.reasonCode ? refund.reasonCode : 'ADMIN_REVIEW';
  const evidenceStatus = item.status === 'REFUNDED' ? 'Complete' : item.hold.active ? 'Needs review' : 'Missing';
  return {
    id: item.id,
    caseRef: `RF-${item.id.slice(0, 6).toUpperCase()}`,
    bookingRef: item.appointmentId ? `BK-${item.appointmentId.slice(0, 6).toUpperCase()}` : 'Not linked',
    party: item.providerName ? 'Provider' : 'Patient',
    reasonCode,
    evidenceStatus,
    policy: item.status === 'REFUNDED' ? 'Refund completed' : item.hold.active ? 'Finance review required' : 'Manual review',
    amount: formatMoney(typeof refund.amountMinor === 'number' ? refund.amountMinor : item.amountMinor, item.currency),
  } as const;
}

function normalizeRole(role: string) {
  return role.replace(/_/g, ' ');
}

function mapAccessGrant(item: ApiRbacAssignmentResponse['items'][number], counts: Record<string, number>) {
  const privileged = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'COMPANY_SUPPORT', 'FINANCE'].includes(item.role);
  return {
    id: item.id,
    userName: item.name || item.email,
    role: normalizeRole(item.role),
    grantScope: item.accessScope === 'platform' ? 'Platform-wide' : 'Organization scoped',
    mfaStatus: privileged ? (item.requiresMfaEnrollment ? 'Pending' : 'Enabled') : 'Enabled',
    accessReview: privileged ? (counts[item.role] > 1 ? 'Due' : 'Certified') : 'Certified',
  } as const;
}

export async function loadIntegratedPaymentsWorkspace(): Promise<LoadResult<{ items: typeof mockSettlements; workspace: typeof mockSettlementWorkspace; apiItems?: ApiPaymentItem[] }>> {
  try {
    const [summaryResponse, reconciliationResponse] = await Promise.all([
      apiRequest<ApiPaymentSummaryResponse>('/api/payments/admin/summary'),
      apiRequest<ApiPaymentListResponse>('/api/payments/reconciliation'),
    ]);

    const items = reconciliationResponse.items.map(mapSettlementItem);
    const selectedApiItem = reconciliationResponse.items[0];
    const selectedFallback = mockSettlementWorkspace.selectedBatch;

    return {
      source: 'api',
      data: {
        items,
        apiItems: reconciliationResponse.items,
        workspace: {
          summary: [
            { label: 'Total payments', value: String(summaryResponse.summary.totalPayments), detail: 'Organization-scoped payments visible to the current admin session' },
            { label: 'Held payments', value: String(summaryResponse.summary.heldPayments), detail: 'Payments with an active admin hold requiring finance attention' },
            { label: 'Captured amount', value: formatCompactMoney(summaryResponse.summary.capturedAmountMinor), detail: 'Captured volume currently recorded by the finance API' },
          ],
          mismatchWatch: [
            { label: 'Captured', value: String(summaryResponse.summary.byStatus.CAPTURED ?? 0), detail: 'Payments currently marked as CAPTURED' },
            { label: 'Refunded', value: String(summaryResponse.summary.byStatus.REFUNDED ?? 0), detail: 'Payments already refunded through the payment workflow' },
            { label: 'Pending or authorized', value: String((summaryResponse.summary.byStatus.AUTHORIZED ?? 0) + (summaryResponse.summary.byStatus.PENDING ?? 0)), detail: 'Payments still waiting for final settlement action' },
          ],
          selectedBatch: selectedApiItem
            ? {
                batchRef: formatBatchRef(selectedApiItem.id),
                gateway: selectedApiItem.gateway || 'manual',
                status: paymentStatusToSettlementStatus(selectedApiItem),
                amount: formatMoney(selectedApiItem.amountMinor, selectedApiItem.currency),
                aging: formatAging(selectedApiItem.createdAt),
                owner: selectedApiItem.providerName || selectedApiItem.patientName || 'Finance queue',
                postingWindow: formatUtcDateTime(selectedApiItem.createdAt),
                variance: selectedApiItem.hold.active ? `Active hold reason: ${selectedApiItem.hold.reasonCode || 'FINANCE_REVIEW'}` : 'No active variance or admin hold is currently recorded.',
                affectedDomains: [
                  `Provider: ${selectedApiItem.providerName || 'Not linked'}`,
                  `Patient: ${selectedApiItem.patientName || 'Not linked'}`,
                  `Service: ${selectedApiItem.service || 'Not linked'}`,
                  typeof (selectedApiItem.metadata as Record<string, unknown> | null | undefined)?.subjectLabel === 'string'
                    ? `Subject: ${String((selectedApiItem.metadata as Record<string, unknown>).subjectLabel)}${typeof (selectedApiItem.metadata as Record<string, unknown>).subjectRelationship === 'string' ? ` • ${String((selectedApiItem.metadata as Record<string, unknown>).subjectRelationship)}` : ''}`
                    : 'Subject: Self profile',
                ],
                exceptions: [
                  selectedApiItem.hold.note || 'No finance note has been captured for this payment yet.',
                  `Payment status: ${selectedApiItem.status}`,
                  `Updated at ${formatUtcDateTime(selectedApiItem.updatedAt)}`,
                ],
                actions: selectedApiItem.hold.active ? ['Release hold', 'Export payment context', 'Wait for finance review'] : ['Apply hold', 'Mark as settled', 'Export payment context'],
                guardrails: selectedFallback.guardrails,
              }
            : selectedFallback,
          exportQueue: [
            'Use the selected payment controls below to apply or release holds and to mark a payment as settled.',
            'Audit export is available from the Audit Logs page and will include finance mutations recorded here.',
            `Current reconciliation slice returned ${reconciliationResponse.count ?? reconciliationResponse.items.length} items from the live API.`,
          ],
        },
      },
    };
  } catch (error) {
    return {
      source: 'mock',
      error: fallbackErrorMessage(error),
      data: {
        items: mockSettlements,
        workspace: mockSettlementWorkspace,
      },
    };
  }
}

export async function loadIntegratedRefundWorkspace(): Promise<LoadResult<{ items: typeof mockRefunds; workspace: typeof mockRefundWorkspace; apiItems?: ApiPaymentItem[] }>> {
  try {
    const response = await apiRequest<ApiPaymentListResponse>('/api/payments/refunds');
    const items = response.items.map(mapRefundItem);
    const selectedApiItem = response.items[0];
    const refundMeta = selectedApiItem?.refund as Record<string, unknown> | undefined;

    return {
      source: 'api',
      data: {
        items,
        apiItems: response.items,
        workspace: {
          summary: [
            { label: 'Open refund cases', value: String(response.items.length), detail: 'Refund-related records returned by the live payments API' },
            { label: 'Refunded', value: String(response.items.filter((item) => item.status === 'REFUNDED').length), detail: 'Payments already moved into REFUNDED status' },
            { label: 'Needs review', value: String(response.items.filter((item) => item.hold.active).length), detail: 'Items still carrying an admin hold or manual review signal' },
          ],
          reasonBreakdown: [
            { label: 'Admin review', value: String(response.items.filter((item) => ((item.refund as Record<string, unknown> | undefined)?.reasonCode ?? 'ADMIN_REVIEW') === 'ADMIN_REVIEW').length), detail: 'Default reason code for manual finance review' },
            { label: 'Fraud', value: String(response.items.filter((item) => ((item.refund as Record<string, unknown> | undefined)?.reasonCode ?? '') === 'FRAUD').length), detail: 'Refund records tagged as fraudulent or high-risk' },
            { label: 'Other reasons', value: String(response.items.filter((item) => !['ADMIN_REVIEW', 'FRAUD'].includes(String((item.refund as Record<string, unknown> | undefined)?.reasonCode ?? 'ADMIN_REVIEW'))).length), detail: 'All other reason-code groupings in the current API slice' },
          ],
          selectedCase: selectedApiItem
            ? {
                caseRef: `RF-${selectedApiItem.id.slice(0, 6).toUpperCase()}`,
                bookingRef: selectedApiItem.appointmentId ? `BK-${selectedApiItem.appointmentId.slice(0, 6).toUpperCase()}` : 'Not linked',
                counterparty: selectedApiItem.providerName || selectedApiItem.patientName || 'Finance queue',
                owner: 'Finance queue',
                amount: formatMoney(typeof refundMeta?.amountMinor === 'number' ? Number(refundMeta.amountMinor) : selectedApiItem.amountMinor, selectedApiItem.currency),
                reasonCode: typeof refundMeta?.reasonCode === 'string' ? refundMeta.reasonCode : 'ADMIN_REVIEW',
                evidenceStatus: selectedApiItem.status === 'REFUNDED' ? 'Complete' : selectedApiItem.hold.active ? 'Needs review' : 'Missing',
                policy: selectedApiItem.status === 'REFUNDED' ? 'Refund completed' : 'Manual review',
                queueState: selectedApiItem.status === 'REFUNDED' ? 'Refund complete' : selectedApiItem.hold.active ? 'Pending evidence decision' : 'Awaiting finance action',
                evidence: [
                  selectedApiItem.hold.note || 'No audit note has been captured for this refund item yet.',
                  `Payment status: ${selectedApiItem.status}`,
                  `Gateway: ${selectedApiItem.gateway || 'manual'}`,
                ],
                timeline: [
                  `Created ${formatUtcDateTime(selectedApiItem.createdAt)}`,
                  `Updated ${formatUtcDateTime(selectedApiItem.updatedAt)}`,
                  typeof refundMeta?.requestedAt === 'string' ? `Refund requested ${formatUtcDateTime(refundMeta.requestedAt)}` : 'Refund request timestamp not supplied by the API',
                ],
                recommendedActions: ['Record refund', 'Open payment detail', 'Review audit trail'],
                policyChecks: mockRefundWorkspace.selectedCase.policyChecks,
              }
            : mockRefundWorkspace.selectedCase,
        },
      },
    };
  } catch (error) {
    return {
      source: 'mock',
      error: fallbackErrorMessage(error),
      data: {
        items: mockRefunds,
        workspace: mockRefundWorkspace,
      },
    };
  }
}

export async function loadIntegratedRbacWorkspace(): Promise<LoadResult<{ items: typeof mockAccessGrants; workspace: typeof mockAccessWorkspace; availableRoles: string[]; selectedUserId?: string }>> {
  try {
    const [summaryResponse, rolesResponse, matrixResponse, assignmentsResponse] = await Promise.all([
      apiRequest<ApiRbacSummaryResponse>('/api/access/rbac/summary'),
      apiRequest<ApiRbacRoleCatalogResponse>('/api/access/rbac/roles'),
      apiRequest<ApiRbacMatrixResponse>('/api/access/rbac/matrix'),
      apiRequest<ApiRbacAssignmentResponse>('/api/access/rbac/assignments'),
    ]);

    const items = assignmentsResponse.items.map((item) => mapAccessGrant(item, summaryResponse.summary.byRole));
    const selectedApiItem = assignmentsResponse.items[0];
    return {
      source: 'api',
      data: {
        items,
        selectedUserId: selectedApiItem?.id,
        availableRoles: rolesResponse.items.map((item) => item.role),
        workspace: {
          summary: [
            { label: 'Privileged users', value: String(summaryResponse.summary.privilegedUsers), detail: 'Users with privileged admin or finance roles in the current scope' },
            { label: 'Roles defined', value: String(summaryResponse.summary.rolesDefined), detail: 'Role catalog returned by the RBAC API' },
            { label: 'Total users', value: String(summaryResponse.summary.totalUsers), detail: 'Users visible to the current admin session for access review' },
          ],
          reviewQueue: [
            `Assignments returned: ${assignmentsResponse.count}`,
            `Roles available for reassignment: ${rolesResponse.items.length}`,
            'Use the API RBAC controls below to update the selected user role or to trigger an access review run.',
          ],
          selectedGrant: selectedApiItem
            ? {
                userName: selectedApiItem.name || selectedApiItem.email,
                role: normalizeRole(selectedApiItem.role),
                grantScope: selectedApiItem.accessScope === 'platform' ? 'Platform-wide' : 'Organization scoped',
                mfaStatus: selectedApiItem.requiresMfaEnrollment ? 'Pending' : 'Enabled',
                accessReview: ['SUPER_ADMIN', 'COMPANY_ADMIN', 'COMPANY_SUPPORT', 'FINANCE'].includes(selectedApiItem.role) ? 'Due' : 'Certified',
                owner: selectedApiItem.organizationId || 'Platform governance',
                requestedBy: selectedApiItem.email,
                lastCertifiedAt: 'Live RBAC summary does not expose certification timestamps yet',
                linkedRisks: [
                  `Organization: ${selectedApiItem.organizationId || 'platform'}`,
                  `Assignment status: ${selectedApiItem.status}`,
                  `Permission surfaces: ${Object.entries(matrixResponse.items).filter(([, roles]) => roles.includes(selectedApiItem.role)).map(([permission]) => permission).join(', ') || 'No permission surfaces returned'}`
                ],
                actions: ['Update role', 'Run access review', 'Review audit trail'],
                guardrails: mockAccessWorkspace.selectedGrant.guardrails,
              }
            : mockAccessWorkspace.selectedGrant,
          privilegedControls: [
            { label: 'Role editors', value: rolesResponse.items.filter((item) => ['SUPER_ADMIN', 'COMPANY_ADMIN'].includes(item.role)).length.toString(), detail: 'Roles able to modify role assignments in the current API slot' },
            { label: 'Permission domains', value: Object.keys(matrixResponse.items).length.toString(), detail: 'Permission areas returned by the RBAC matrix endpoint' },
            { label: 'Access review', value: 'API-backed', detail: 'Quarterly or ad-hoc review runs can now be triggered directly from Admin' },
          ],
          roleMatrix: Object.entries(matrixResponse.items).map(([permission, roles]) => `${permission}: ${roles.join(', ')}`),
        },
      },
    };
  } catch (error) {
    return {
      source: 'mock',
      error: fallbackErrorMessage(error),
      data: {
        items: mockAccessGrants,
        workspace: mockAccessWorkspace,
        availableRoles: ['COMPANY_SUPPORT', 'FINANCE', 'COMPANY_ADMIN', 'SUPER_ADMIN'],
      },
    };
  }
}



type ApiConfigSummaryResponse = {
  summary: {
    count: number;
    byStatus: Record<string, number>;
    storageMode: string;
    lastUpdatedAt?: string | null;
  };
};

type ApiCatalogItem = {
  id: string;
  code: string;
  name: string;
  category: string;
  description: string;
  serviceModes?: string[];
  durationMinutes?: number;
  tags?: string[];
  status: string;
  version: number;
  updatedAt: string;
};

type ApiCoverageItem = {
  id: string;
  code: string;
  name: string;
  payer: string;
  planType: string;
  serviceCodes?: string[];
  regions?: string[];
  authorizationRequired?: boolean;
  bookingLeadHours?: number;
  telehealthAllowed?: boolean;
  weekendSlotsAllowed?: boolean;
  weekendCalendar?: string;
  blockedFacilities?: string[];
  blockedChannels?: string[];
  cityExceptions?: string[];
  status: string;
  version: number;
  updatedAt: string;
};

type ApiPricingItem = {
  id: string;
  code: string;
  name: string;
  serviceCode: string;
  visitType: string;
  currency: string;
  baseAmountMinor: number;
  providerCommissionBps: number;
  organizationCommissionBps: number;
  refundWindowHours: number;
  status: string;
  version: number;
  updatedAt: string;
};

type ApiPolicyItem = {
  id: string;
  code: string;
  name?: string;
  title?: string;
  category: string;
  description: string;
  appliesTo?: string[];
  approvalRoles?: string[];
  status: string;
  version: number;
  updatedAt: string;
};

type ApiConfigListResponse<T> = {
  items: T[];
  count: number;
  storageMode?: string;
};

function mapLifecycleStatus(status: string): 'Active' | 'Draft' | 'Archived' {
  const normalized = String(status || '').toUpperCase();
  if (['PUBLISHED', 'ACTIVE'].includes(normalized)) return 'Active';
  if (['ARCHIVED', 'INACTIVE'].includes(normalized)) return 'Archived';
  return 'Draft';
}

function mapCatalogContract(item: ApiCatalogItem) {
  return {
    id: item.id,
    category: item.category || 'Uncategorized',
    serviceName: item.name || item.code,
    template: `v${item.version} · ${item.code}`,
    status: mapLifecycleStatus(item.status),
    downstreamImpact: `${(item.serviceModes || []).join(' + ') || 'No modes'} · ${item.durationMinutes || 0} min`,
  } as const;
}

function mapCoverageContract(item: ApiCoverageItem) {
  const status = String(item.status || '').toUpperCase();
  return {
    id: item.id,
    region: item.name || item.code,
    cities: item.regions && item.regions.length ? item.regions : ['Scope pending'],
    weekendCalendar: item.weekendCalendar || (item.authorizationRequired ? `Prior auth · ${item.bookingLeadHours || 0}h lead` : `Standard · ${item.bookingLeadHours || 0}h lead`),
    telehealthEnabled: Boolean(item.telehealthAllowed),
    inPersonEnabled: !(item.blockedChannels || []).includes('IN_PERSON'),
    status: status === 'ACTIVE' ? 'Enabled' : status === 'INACTIVE' ? 'Disabled' : 'Limited',
    blockedFacilities: item.blockedFacilities || [],
    blockedChannels: item.blockedChannels || [],
    cityExceptions: item.cityExceptions || [],
  } as const;
}

function mapPricingContract(item: ApiPricingItem) {
  const status = String(item.status || '').toUpperCase();
  return {
    id: item.id,
    ruleName: item.name || item.code,
    market: item.serviceCode || 'Global',
    commissionModel: `${(item.providerCommissionBps / 100).toFixed(0)}% provider / ${(item.organizationCommissionBps / 100).toFixed(0)}% platform`,
    effectiveFrom: formatUtcDateTime(item.updatedAt),
    status: status === 'PUBLISHED' ? 'Published' : status === 'SCHEDULED' ? 'Scheduled' : 'Draft',
  } as const;
}

function mapPolicyContract(item: ApiPolicyItem) {
  return {
    id: item.id,
    templateName: item.title || item.name || item.code,
    policyArea: item.category || 'General',
    country: item.appliesTo?.[0] || 'Global',
    version: `v${item.version}`,
    status: mapLifecycleStatus(item.status) === 'Active' ? 'Published' : mapLifecycleStatus(item.status),
  } as const;
}

function statusCount(byStatus: Record<string, number>, ...keys: string[]) {
  return keys.reduce((total, key) => total + Number(byStatus[key] ?? 0), 0);
}

function makeSummaryCards(summary: ApiConfigSummaryResponse['summary'], labels: [string, string, string]) {
  return [
    { label: labels[0], value: String(statusCount(summary.byStatus, 'PUBLISHED', 'ACTIVE')), detail: `Storage: ${summary.storageMode}` },
    { label: labels[1], value: String(statusCount(summary.byStatus, 'DRAFT')), detail: 'Draft items returned by the live config API' },
    { label: labels[2], value: String(statusCount(summary.byStatus, 'ARCHIVED', 'INACTIVE')), detail: summary.lastUpdatedAt ? `Last updated ${formatUtcDateTime(summary.lastUpdatedAt)}` : 'No update timestamp supplied by the API' },
  ];
}

export async function loadIntegratedCatalogWorkspace(): Promise<LoadResult<{ items: typeof mockServiceCatalog; workspace: typeof mockServiceCatalogWorkspace; apiItems?: ApiCatalogItem[] }>> {
  try {
    const [summaryResponse, servicesResponse] = await Promise.all([
      apiRequest<ApiConfigSummaryResponse>('/api/catalog/summary'),
      apiRequest<ApiConfigListResponse<ApiCatalogItem>>('/api/catalog/services'),
    ]);
    const items = servicesResponse.items.map(mapCatalogContract);
    const selectedApiItem = servicesResponse.items[0];
    const categories = new Map<string, number>();
    for (const item of servicesResponse.items) categories.set(item.category || 'Uncategorized', (categories.get(item.category || 'Uncategorized') ?? 0) + 1);
    return {
      source: 'api',
      data: {
        items,
        apiItems: servicesResponse.items,
        workspace: {
          summary: makeSummaryCards(summaryResponse.summary, ['Published services', 'Draft changes', 'Archived or inactive']),
          categoryTree: Array.from(categories.entries()).map(([name, count]) => ({ name, count })),
          selectedTemplate: selectedApiItem ? {
            name: selectedApiItem.name,
            version: `v${selectedApiItem.version}`,
            owner: `Config store (${servicesResponse.storageMode || summaryResponse.summary.storageMode})`,
            rolloutState: selectedApiItem.status === 'PUBLISHED' ? 'Published into the live admin config surface' : 'Draft state returned by the live config API',
            dependencies: [
              `Modes: ${(selectedApiItem.serviceModes || []).join(', ') || 'none declared'}`,
              `Duration: ${selectedApiItem.durationMinutes || 0} minutes`,
              `Tags: ${(selectedApiItem.tags || []).join(', ') || 'none declared'}`,
            ],
          } : mockServiceCatalogWorkspace.selectedTemplate,
          guardrails: mockServiceCatalogWorkspace.guardrails,
        },
      },
    };
  } catch (error) {
    return { source: 'mock', error: fallbackErrorMessage(error), data: { items: mockServiceCatalog, workspace: mockServiceCatalogWorkspace } };
  }
}

export async function loadIntegratedCoverageWorkspace(): Promise<LoadResult<{ items: typeof mockCoverage; workspace: typeof mockCoverageWorkspace; apiItems?: ApiCoverageItem[] }>> {
  try {
    const [summaryResponse, rulesResponse] = await Promise.all([
      apiRequest<ApiConfigSummaryResponse>('/api/coverage/summary'),
      apiRequest<ApiConfigListResponse<ApiCoverageItem>>('/api/coverage/rules'),
    ]);
    const items = rulesResponse.items.map(mapCoverageContract);
    return {
      source: 'api',
      data: {
        items,
        apiItems: rulesResponse.items,
        workspace: {
          summary: makeSummaryCards(summaryResponse.summary, ['Regions enabled', 'Draft or limited changes', 'Disabled or archived']),
          constrainedMarkets: rulesResponse.items.slice(0, 3).map((item) => ({
            region: item.name || item.code,
            issue: item.authorizationRequired ? 'Prior authorization or constrained booking flow' : (item.blockedFacilities?.length ? 'Facility restriction active' : 'Coverage window requires operational review'),
            impact: `${(item.regions || []).length || 0} scoped regions · ${item.bookingLeadHours || 0}h lead time${item.blockedChannels?.length ? ` · blocked ${item.blockedChannels.join(', ')}` : ''}`,
          })),
          weekendRules: [
            'Coverage changes should be reviewed against booking lead-time and active payer scope before activation.',
            'Telehealth eligibility should only be enabled where provider capacity and policy allow the service.',
            'Facility and weekend restrictions should be published before provider slot inventory is opened to patients.',
            `Live storage mode: ${rulesResponse.storageMode || summaryResponse.summary.storageMode}.`,
          ],
        },
      },
    };
  } catch (error) {
    return { source: 'mock', error: fallbackErrorMessage(error), data: { items: mockCoverage, workspace: mockCoverageWorkspace } };
  }
}

export async function loadIntegratedPricingWorkspace(): Promise<LoadResult<{ items: typeof mockPricingRules; workspace: typeof mockPricingWorkspace; apiItems?: ApiPricingItem[] }>> {
  try {
    const [summaryResponse, rulesResponse] = await Promise.all([
      apiRequest<ApiConfigSummaryResponse>('/api/pricing/summary'),
      apiRequest<ApiConfigListResponse<ApiPricingItem>>('/api/pricing/rules'),
    ]);
    const items = rulesResponse.items.map(mapPricingContract);
    return {
      source: 'api',
      data: {
        items,
        apiItems: rulesResponse.items,
        workspace: {
          summary: makeSummaryCards(summaryResponse.summary, ['Published rules', 'Draft changes', 'Archived or inactive']),
          simulations: rulesResponse.items.slice(0, 3).map((item) => ({
            scenario: `${item.serviceCode} / ${item.visitType}`,
            gross: formatMoney(item.baseAmountMinor, item.currency),
            provider: formatMoney(Math.round(item.baseAmountMinor * item.providerCommissionBps / 10000), item.currency),
            platform: formatMoney(item.baseAmountMinor - Math.round(item.baseAmountMinor * item.providerCommissionBps / 10000), item.currency),
          })),
          guardrails: [
            'Live pricing updates should preserve the 10000 bps commission total guardrail enforced by the API.',
            'Simulation output should be checked before publishing major pricing changes.',
            `Live storage mode: ${rulesResponse.storageMode || summaryResponse.summary.storageMode}.`,
          ],
        },
      },
    };
  } catch (error) {
    return { source: 'mock', error: fallbackErrorMessage(error), data: { items: mockPricingRules, workspace: mockPricingWorkspace } };
  }
}

export async function loadIntegratedPolicyWorkspace(): Promise<LoadResult<{ items: typeof mockPolicyTemplates; workspace: typeof mockPolicyGovernance; apiItems?: ApiPolicyItem[] }>> {
  try {
    const [summaryResponse, templatesResponse] = await Promise.all([
      apiRequest<ApiConfigSummaryResponse>('/api/policies/summary'),
      apiRequest<ApiConfigListResponse<ApiPolicyItem>>('/api/policies/templates'),
    ]);
    const items = templatesResponse.items.map(mapPolicyContract);
    return {
      source: 'api',
      data: {
        items,
        apiItems: templatesResponse.items,
        workspace: {
          summary: makeSummaryCards(summaryResponse.summary, ['Published templates', 'Drafts awaiting approval', 'Archived or inactive']),
          approvalChecklist: [
            'Published policy versions should remain immutable and require a new version for any change.',
            'Approval roles and jurisdiction scope should be recorded before publish.',
            `Live storage mode: ${templatesResponse.storageMode || summaryResponse.summary.storageMode}.`,
          ],
          versionHistory: templatesResponse.items.slice(0, 3).map((item) => ({
            template: item.title || item.name || item.code,
            version: `v${item.version}`,
            note: item.description,
          })),
          usageMap: templatesResponse.items.slice(0, 3).map((item) => ({
            template: item.title || item.name || item.code,
            usedBy: (item.appliesTo || []).join(', ') || 'General policy surface',
          })),
        },
      },
    };
  } catch (error) {
    return { source: 'mock', error: fallbackErrorMessage(error), data: { items: mockPolicyTemplates, workspace: mockPolicyGovernance } };
  }
}

export type { ApiProviderDetailResponse };



type ApiBookingSummaryResponse = {
  summary: {
    total: number;
    telehealth: number;
    upcoming24h: number;
    escalationsLast7d: number;
    activeSlotHolds?: number;
    publishedSlots?: number;
    byStatus: Record<string, number>;
  };
};

type ApiBookingAuthorizationReview = {
  required: boolean;
  status: string;
  reasonCodes?: string[];
  reviewedAt?: string | null;
  reviewedBy?: string | null;
  note?: string | null;
};

type ApiBookingItem = {
  id: string;
  organizationId?: string | null;
  patientId?: string | null;
  providerId?: string | null;
  patientName?: string | null;
  providerName?: string | null;
  providerSpecialty?: string | null;
  service?: string | null;
  location?: string | null;
  startsAt: string;
  endsAt: string;
  status: string;
  notes?: string | null;
  modality: 'TELEHEALTH' | 'IN_PERSON';
  telehealthSessionId?: string | null;
  telehealthStatus?: string | null;
  latestPaymentStatus?: string | null;
  authorizationReview?: ApiBookingAuthorizationReview;
  createdAt: string;
  updatedAt: string;
};

type ApiBookingListResponse = {
  items: ApiBookingItem[];
  count: number;
};

type ApiBookingDetailResponse = {
  item: ApiBookingItem;
  records?: Array<{ id: string; summary?: unknown; type?: string | null; createdAt?: string }>;
  documents?: Array<{ id: string; kind: string; fileName: string; redactionStatus?: string | null; redactedFields?: string[]; uploadedAt?: string }>;
  auditTrail?: ApiAuditLogItem[];
  policy?: {
    bookingLeadHours?: number;
    telehealthAllowed?: boolean;
    authorizationRequired?: boolean;
    allowedPaymentMethods?: string[];
    reasons?: string[];
    guidance?: string[];
    blockedFacilities?: string[];
    blockedChannels?: string[];
    cityExceptions?: string[];
    weekendCalendar?: string;
  };
  authorizationReview?: ApiBookingAuthorizationReview;
  overrideContext?: {
    overrideRequired?: boolean;
    reasons?: string[];
    blockedFacilities?: string[];
    blockedChannels?: string[];
    cityExceptions?: string[];
    weekendSlotsAllowed?: boolean;
    weekendCalendar?: string;
    allowedPaymentMethods?: string[];
    authorizationRequired?: boolean;
  };
};

type ApiBookingOptionsResponse = {
  overrideReasonCatalog: string[];
  escalationReasonCatalog: string[];
  ownerRoleCatalog: string[];
};

type ApiTelehealthSummaryResponse = {
  summary: {
    total: number;
    live: number;
    escalationsLast7d: number;
    byStatus: Record<string, number>;
    byVendor: Record<string, number>;
  };
};

type ApiTelehealthItem = {
  id: string;
  appointmentId?: string | null;
  vendor: string;
  meetingId: string;
  joinUrl?: string | null;
  status: string;
  scheduledAt?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  patientName?: string | null;
  providerName?: string | null;
  service?: string | null;
  organizationId?: string | null;
};

type ApiTelehealthListResponse = {
  items: ApiTelehealthItem[];
  count?: number;
};

type ApiTelehealthDetailResponse = {
  item: ApiTelehealthItem;
  auditTrail?: ApiAuditLogItem[];
};

type ApiWorkflowSummaryResponse = {
  summary: {
    total: number;
    assigned: number;
    byStatus: Record<string, number>;
    byRisk: Record<string, number>;
  };
  storageMode?: string;
};

type ApiSupportItem = {
  id: string;
  code: string;
  title: string;
  status: string;
  priority?: string | null;
  category?: string | null;
  channel?: string | null;
  queue?: string | null;
  requesterName?: string | null;
  assigneeUserId?: string | null;
  assigneeName?: string | null;
  summary?: string | null;
  tags?: string[] | null;
  createdAt: string;
  updatedAt: string;
  lastNote?: string | null;
};

type ApiSupportListResponse = {
  items: ApiSupportItem[];
  count: number;
  storageMode?: string;
};

type ApiSupportDetailResponse = {
  item: ApiSupportItem;
  auditTrail?: ApiAuditLogItem[];
  storageMode?: string;
};

type ApiSafetyItem = {
  id: string;
  code: string;
  title: string;
  status: string;
  severity?: string | null;
  category?: string | null;
  queue?: string | null;
  patientImpact?: string | null;
  ownerName?: string | null;
  summary?: string | null;
  tags?: string[] | null;
  createdAt: string;
  updatedAt: string;
  actionPlan?: string | null;
  closureCode?: string | null;
  sourceType?: string | null;
  sourceThreadId?: string | null;
  sourcePatientId?: string | null;
  sourcePatientName?: string | null;
};

type ApiSafetyListResponse = {
  items: ApiSafetyItem[];
  count: number;
  storageMode?: string;
};

type ApiSafetyDetailResponse = {
  item: ApiSafetyItem;
  auditTrail?: ApiAuditLogItem[];
  storageMode?: string;
};

function bookingStatus(status: string, auditTrail?: ApiAuditLogItem[]) {
  const normalized = String(status || '').toUpperCase();
  if (normalized.includes('CANCEL') || normalized === 'NO_SHOW') return 'Cancelled' as const;
  if ((auditTrail || []).some((entry) => /booking\.escalated/i.test(entry.action))) return 'Escalated' as const;
  if (normalized.includes('DELAY')) return 'Delayed' as const;
  return 'Scheduled' as const;
}

function bookingSla(status: ReturnType<typeof bookingStatus>) {
  if (status === 'Scheduled') return 'On track' as const;
  if (status === 'Delayed') return 'At risk' as const;
  return 'Breached' as const;
}

function formatBookingRef(id: string) {
  return `BK-${id.slice(0, 6).toUpperCase()}`;
}

function mapBookingItem(item: ApiBookingItem, auditTrail?: ApiAuditLogItem[]) {
  const status = bookingStatus(item.status, auditTrail);
  const incidentTag = (auditTrail || []).find((entry) => /booking\.escalated/i.test(entry.action))
    ? 'Operational escalation'
    : item.latestPaymentStatus === 'REFUNDED'
      ? 'Refund impact'
      : undefined;
  return {
    id: item.id,
    bookingRef: formatBookingRef(item.id),
    patientName: item.patientName || 'Unknown patient',
    providerName: item.providerName || 'Unassigned provider',
    channel: item.modality === 'TELEHEALTH' ? 'Telehealth' : 'In-Person',
    status,
    incidentTag,
    city: item.location || 'Not set',
    scheduledAt: item.startsAt,
    slaState: bookingSla(status),
    adminOwner: item.providerName || 'Ops queue',
    downstreamImpact: item.latestPaymentStatus ? `Latest payment status: ${item.latestPaymentStatus}` : 'No linked payment exception returned by API',
    nextAction: status === 'Escalated' ? 'Review escalation and reassign if needed' : status === 'Cancelled' ? 'Confirm outcome and notify customer' : 'Monitor schedule health',
  } as const;
}

function telehealthState(status: string) {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'LIVE' || normalized === 'READY') return 'Healthy' as const;
  if (normalized === 'ENDED') return 'Degraded' as const;
  return 'Failed' as const;
}

function telehealthRoomState(status: string) {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'LIVE') return 'Live' as const;
  if (normalized === 'READY') return 'Waiting room' as const;
  if (normalized === 'ENDED') return 'Closed' as const;
  return 'Reconnect loop' as const;
}

function mapTelehealthItem(item: ApiTelehealthItem) {
  return {
    id: item.id,
    sessionRef: `TH-${item.id.slice(0, 6).toUpperCase()}`,
    providerName: item.providerName || 'Unassigned provider',
    patientInitials: (item.patientName || 'Unknown Patient').split(/\s+/).filter(Boolean).map((part) => part[0]?.toUpperCase()).slice(0,2).join('.') || 'U.P.',
    region: item.organizationId || 'Organization scope',
    state: telehealthState(item.status),
    failureRate: item.status === 'ENDED' ? '1 ended session' : item.status === 'LIVE' ? 'Stable live' : 'Watch queue',
    supportHook: item.joinUrl ? 'Join URL provisioned and visible to operations.' : 'No join URL returned by API.',
    roomState: telehealthRoomState(item.status),
    roomType: 'Scheduled consult' as const,
    issueOwner: item.providerName || 'Telehealth ops',
    lastHeartbeatAt: item.startedAt || item.scheduledAt || item.createdAt || new Date().toISOString(),
    metadataAccess: 'Metadata only' as const,
  } as const;
}

function supportStatus(status: string) {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'RESOLVED') return 'Resolved' as const;
  if (normalized === 'ESCALATED') return 'Escalated' as const;
  if (normalized === 'WAITING_ON_REPLY') return 'Waiting on reply' as const;
  return 'Open' as const;
}

function supportPriority(priority?: string | null) {
  const normalized = String(priority || '').toUpperCase();
  if (normalized === 'CRITICAL' || normalized === 'HIGH') return 'P1' as const;
  if (normalized === 'MEDIUM') return 'P2' as const;
  return 'P3' as const;
}

function supportLinkedDomain(category?: string | null) {
  const normalized = String(category || '').toUpperCase();
  if (normalized.includes('BILL')) return 'Refunds' as const;
  if (normalized.includes('PORTAL') || normalized.includes('PROVIDER')) return 'Provider Ops' as const;
  if (normalized.includes('TELE')) return 'Telehealth' as const;
  return 'Bookings' as const;
}

function mapSupportItem(item: ApiSupportItem) {
  return {
    id: item.id,
    ticketRef: item.code,
    channel: String(item.channel || '').toUpperCase() === 'PROVIDER' ? 'Provider' : 'Patient',
    subject: item.title,
    piiMasking: 'Masked' as const,
    status: supportStatus(item.status),
    sla: item.status === 'ESCALATED' ? 'At risk' : 'On track',
    owner: item.assigneeName || item.queue || 'Support queue',
    priority: supportPriority(item.priority),
    linkedDomain: supportLinkedDomain(item.category),
    nextMilestone: item.summary || 'Review timeline and determine next action',
  } as const;
}

function safetySeverity(severity?: string | null) {
  const normalized = String(severity || '').toUpperCase();
  if (normalized === 'CRITICAL') return 'Critical' as const;
  if (normalized === 'HIGH' || normalized === 'MEDIUM') return 'Major' as const;
  return 'Minor' as const;
}

function safetyStatus(status: string) {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'CLOSED') return 'Closed' as const;
  if (normalized === 'ACTION_REQUIRED' || normalized === 'TRIAGED' || normalized === 'UNDER_REVIEW') return 'Pending approval' as const;
  if (normalized === 'ESCALATED') return 'Escalated' as const;
  return 'Open' as const;
}

function safetyCategory(category?: string | null) {
  const normalized = String(category || '').toUpperCase();
  if (normalized.includes('CLIN')) return 'Clinical' as const;
  if (normalized.includes('MED')) return 'Medication' as const;
  return 'Operational' as const;
}

function mapSafetyItem(item: ApiSafetyItem, auditTrail?: ApiAuditLogItem[]) {
  return {
    id: item.id,
    caseRef: item.code,
    severity: safetySeverity(item.severity),
    summary: item.title,
    status: safetyStatus(item.status),
    timeline: (auditTrail || []).slice(0, 4).map((entry) => ({ at: entry.createdAt, event: humanizeAction(entry.action) })) || [],
    actions: ['Triage case', 'Record action', 'Close case'],
    dualApprovalRequired: String(item.severity || '').toUpperCase() === 'CRITICAL',
    category: safetyCategory(item.category),
    investigator: item.ownerName || item.queue || 'Safety queue',
    linkedSource: [item.sourceType === 'MESSAGE_THREAD' ? 'Secure message escalation' : item.sourceType === 'RPM_ENROLLMENT' ? 'RPM threshold escalation' : null, item.sourcePatientName || null, item.sourceThreadId || item.sourcePatientId || null].filter(Boolean).join(' · ') || item.patientImpact || item.queue || 'Operations signal',
    nextReviewAt: item.updatedAt,
    approvals: [
      { reviewer: item.ownerName || 'Safety lead', decision: item.status === 'CLOSED' ? 'Approved' as const : 'Pending' as const },
      { reviewer: 'Quality review', decision: item.status === 'ACTION_REQUIRED' ? 'Changes requested' as const : 'Pending' as const },
    ],
    closureGuardrails: mockSafetyCases[0].closureGuardrails,
  } as const;
}

export async function loadIntegratedBookingWorkspace(): Promise<LoadResult<{ items: typeof mockBookingControl; workspace: typeof mockBookingControlWorkspace; selectedAppointmentId?: string; providerOptions?: Array<{ id: string; label: string }>; selectedDocuments?: Array<{ id: string; label: string; status: string; detail: string }>; activeHolds?: Array<{ id: string; label: string; detail: string; expiresAt: string; status: string }>; bookingOptions?: ApiBookingOptionsResponse }>> {
  try {
    const [summaryResponse, listResponse, providersResponse, optionsResponse, holdResponse] = await Promise.all([
      apiRequest<ApiBookingSummaryResponse>('/api/bookings/summary'),
      apiRequest<ApiBookingListResponse>('/api/bookings/control-tower'),
      apiRequest<ApiProviderListResponse>('/api/providers'),
      apiRequest<ApiBookingOptionsResponse>('/api/bookings/control-tower/options'),
      apiRequest<{ items: Array<{ id: string; service?: string; location?: string; patientName?: string | null; providerName?: string | null; expiresAt: string }> }>('/api/bookings/control-tower/holds?limit=10'),
    ]);
    const selectedApi = listResponse.items[0];
    const detailResponse = selectedApi ? await apiRequest<ApiBookingDetailResponse>(`/api/bookings/control-tower/${selectedApi.id}`) : null;
    const auditTrail = detailResponse?.auditTrail;
    const selected = selectedApi ? mapBookingItem(selectedApi, auditTrail) : mockBookingControlWorkspace.selectedBooking;
    return {
      source: 'api',
      data: {
        items: listResponse.items.map((item) => mapBookingItem(item)),
        selectedAppointmentId: selectedApi?.id,
        providerOptions: providersResponse.items.map((item) => ({ id: item.id, label: item.name })),
        bookingOptions: optionsResponse,
        activeHolds: (holdResponse.items ?? []).map((item) => ({
          id: item.id,
          label: `${item.patientName || 'Masked patient'} · ${item.service || 'Booking hold'}`,
          detail: `${item.location || 'Location not set'} · ${item.providerName || 'Unassigned provider'}`,
          expiresAt: item.expiresAt,
          status: 'HELD',
        })),
        selectedDocuments: (detailResponse?.documents ?? []).map((item) => ({
          id: item.id,
          label: `${item.kind}: ${item.fileName}`,
          status: item.redactionStatus || 'PENDING',
          detail: item.redactedFields?.length ? `Redacted fields: ${item.redactedFields.join(', ')}` : 'No redactions applied yet.',
        })),
        workspace: {
          summary: [
            { label: 'Bookings monitored', value: String(summaryResponse.summary.total), detail: 'Live organization booking volume returned by the API' },
            { label: 'Published slots', value: String(summaryResponse.summary.publishedSlots ?? 0), detail: 'Future booking inventory currently published into the scheduling engine' },
            { label: 'Active slot holds', value: String(summaryResponse.summary.activeSlotHolds ?? 0), detail: 'Slots temporarily held by patients before payment and final confirmation' },
            { label: 'Escalations last 7d', value: String(summaryResponse.summary.escalationsLast7d), detail: 'Booking escalations recorded into the audit trail this week' },
          ],
          incidentQueue: [
            { label: 'Scheduled', count: Number(summaryResponse.summary.byStatus.SCHEDULED ?? 0), note: 'Bookings still in the scheduled state' },
            { label: 'Cancelled', count: Number(summaryResponse.summary.byStatus.CANCELED ?? 0), note: 'Requires cancellation follow-up or refund review' },
            { label: 'Completed', count: Number(summaryResponse.summary.byStatus.COMPLETED ?? 0), note: 'Completed appointments included in the control slice' },
            { label: 'Upcoming 24h', count: summaryResponse.summary.upcoming24h, note: 'Appointments starting within the next 24 hours' },
          ],
          selectedBooking: selectedApi
            ? {
                bookingRef: selected.bookingRef,
                patientMasked: selectedApi.patientName || 'Unknown patient',
                providerName: selectedApi.providerName || 'Unassigned provider',
                service: selectedApi.service || 'Unknown service',
                market: selectedApi.location || 'Not set',
                status: selected.status,
                channel: selected.channel,
                scheduledAt: selectedApi.startsAt,
                incidentTag: selected.incidentTag || 'No active escalation tag returned',
                adminOwner: selectedApi.providerName || 'Ops queue',
                impactSummary: [
                  selected.downstreamImpact,
                  summarizeRecordSummary(detailResponse?.records?.[0]?.summary) || 'No related clinical record summary returned in the live detail response.',
                  detailResponse?.documents?.length ? `Booking documents: ${detailResponse.documents.map((item) => `${item.kind.toLowerCase()} · ${item.redactionStatus || 'PENDING'}`).join(' | ')}` : 'No booking documents linked to the selected appointment yet.',
                  detailResponse?.authorizationReview?.required ? `Authorization review: ${detailResponse.authorizationReview.status}${detailResponse.authorizationReview.note ? ` · ${detailResponse.authorizationReview.note}` : ''}` : 'No prior-authorization review is currently required for this booking.',
                  detailResponse?.overrideContext?.blockedFacilities?.length ? `Blocked facilities in policy context: ${detailResponse.overrideContext.blockedFacilities.join(', ')}` : 'No facility-level exception is attached to the selected booking policy.',
                  detailResponse?.overrideContext?.blockedChannels?.length ? `Blocked channels in policy context: ${detailResponse.overrideContext.blockedChannels.join(', ')}` : 'No channel-level exception is attached to the selected booking policy.',
                  auditTrail?.[0] ? `${humanizeAction(auditTrail[0].action)} at ${formatUtcDateTime(auditTrail[0].createdAt)}` : 'No recent booking control audit entry returned.',
                ],
                actions: ['Reassign provider', 'Reschedule booking', 'Mark no-show', 'Escalate booking'],
                guardrails: [
                  ...(detailResponse?.policy?.guidance ?? []),
                  ...mockBookingControlWorkspace.selectedBooking.guardrails,
                ],
              }
            : mockBookingControlWorkspace.selectedBooking,
          bulkExceptionMonitor: [
            `Control tower returned ${listResponse.count} appointments from the API.`,
            detailResponse?.policy?.reasons?.length ? `Policy exceptions for the selected booking: ${detailResponse.policy.reasons.join(' | ')}` : 'Selected booking currently complies with lead-time and channel rules.',
            detailResponse?.policy?.allowedPaymentMethods?.length ? `Allowed payment methods: ${detailResponse.policy.allowedPaymentMethods.join(', ')}` : 'Payment method rules were not returned for the selected booking.',
            detailResponse?.authorizationReview?.required ? `Authorization state: ${detailResponse.authorizationReview.status}` : 'Authorization review is not required for the selected booking.',
            'Any mutation is recorded into the audit log and will be visible on the Audit Logs page.',
          ],
        },
      },
    };
  } catch (error) {
    return { source: 'mock', error: fallbackErrorMessage(error), data: { items: mockBookingControl, workspace: mockBookingControlWorkspace } };
  }
}

export async function loadIntegratedTelehealthWorkspace(): Promise<LoadResult<{ items: typeof mockTelehealthOps; workspace: typeof mockTelehealthWorkspace; selectedSessionId?: string }>> {
  try {
    const [summaryResponse, listResponse] = await Promise.all([
      apiRequest<ApiTelehealthSummaryResponse>('/api/telehealth/operations/summary'),
      apiRequest<ApiTelehealthListResponse>('/api/telehealth/operations/sessions'),
    ]);
    const selectedApi = listResponse.items[0];
    const detailResponse = selectedApi ? await apiRequest<ApiTelehealthDetailResponse>(`/api/telehealth/operations/sessions/${selectedApi.id}`) : null;
    return {
      source: 'api',
      data: {
        items: listResponse.items.map(mapTelehealthItem),
        selectedSessionId: selectedApi?.id,
        workspace: {
          summary: [
            { label: 'Sessions monitored', value: String(summaryResponse.summary.total), detail: 'Telehealth sessions available to the current admin scope' },
            { label: 'Live now', value: String(summaryResponse.summary.live), detail: 'Sessions currently marked LIVE in the telehealth API' },
            { label: 'Escalations last 7d', value: String(summaryResponse.summary.escalationsLast7d), detail: 'Technical escalations recorded this week' },
          ],
          failureTrends: Object.entries(summaryResponse.summary.byStatus).slice(0,3).map(([label, value]) => ({ label, value: String(value), detail: 'Live status count returned by operations summary' })),
          selectedSession: selectedApi
            ? {
                sessionRef: `TH-${selectedApi.id.slice(0, 6).toUpperCase()}`,
                providerName: selectedApi.providerName || 'Unassigned provider',
                patientMasked: selectedApi.patientName || 'Unknown patient',
                state: telehealthState(selectedApi.status),
                roomState: telehealthRoomState(selectedApi.status),
                roomType: 'Scheduled consult',
                region: selectedApi.organizationId || 'Organization scope',
                issueOwner: selectedApi.providerName || 'Telehealth ops',
                supportHook: selectedApi.joinUrl ? 'Join URL is present in the session payload.' : 'Join URL is missing from the session payload.',
                metadata: [
                  `Vendor: ${selectedApi.vendor}`,
                  `Meeting ID: ${selectedApi.meetingId}`,
                  `Scheduled: ${selectedApi.scheduledAt ? formatUtcDateTime(selectedApi.scheduledAt) : 'Not returned'}`,
                ],
                guardrails: mockTelehealthWorkspace.selectedSession.guardrails,
              }
            : mockTelehealthWorkspace.selectedSession,
          exceptionQueue: [
            `The API returned ${listResponse.count ?? listResponse.items.length} telehealth sessions in the current operations slice.`,
            detailResponse?.auditTrail?.[0] ? `Latest audit event: ${humanizeAction(detailResponse.auditTrail[0].action)}` : 'No recent telehealth audit entry returned for the selected session.',
            'Use the live controls below to mark a session live, end it, restart the room, or escalate the issue.',
          ],
        },
      },
    };
  } catch (error) {
    return { source: 'mock', error: fallbackErrorMessage(error), data: { items: mockTelehealthOps, workspace: mockTelehealthWorkspace } };
  }
}

export async function loadIntegratedSupportWorkspace(): Promise<LoadResult<{ items: typeof mockSupportTickets; workspace: typeof mockSupportWorkspace; selectedItemId?: string }>> {
  try {
    const [summaryResponse, listResponse] = await Promise.all([
      apiRequest<ApiWorkflowSummaryResponse>('/api/support/summary'),
      apiRequest<ApiSupportListResponse>('/api/support/work-items'),
    ]);
    const selectedApi = listResponse.items[0];
    const detailResponse = selectedApi ? await apiRequest<ApiSupportDetailResponse>(`/api/support/work-items/${selectedApi.id}`) : null;
    return {
      source: 'api',
      data: {
        items: listResponse.items.map(mapSupportItem),
        selectedItemId: selectedApi?.id,
        workspace: {
          summary: [
            { label: 'Open work items', value: String(summaryResponse.summary.total), detail: 'Support work items returned by the API' },
            { label: 'Assigned', value: String(summaryResponse.summary.assigned), detail: 'Items with an assignee or owner captured' },
            { label: 'High risk', value: String((summaryResponse.summary.byRisk.HIGH ?? 0) + (summaryResponse.summary.byRisk.CRITICAL ?? 0)), detail: 'Work items carrying elevated risk or priority' },
          ],
          macros: mockSupportWorkspace.macros,
          selectedTicket: selectedApi
            ? {
                ticketRef: selectedApi.code,
                owner: selectedApi.assigneeName || selectedApi.queue || 'Support queue',
                priority: supportPriority(selectedApi.priority),
                linkedDomain: supportLinkedDomain(selectedApi.category),
                maskedCounterparty: selectedApi.requesterName || 'Masked requester',
                timeline: [
                  `Created ${formatUtcDateTime(selectedApi.createdAt)}`,
                  `Updated ${formatUtcDateTime(selectedApi.updatedAt)}`,
                  detailResponse?.auditTrail?.[0] ? humanizeAction(detailResponse.auditTrail[0].action) : 'No recent audit transition returned',
                ],
                escalationOptions: ['Finance Support', 'Provider Operations', 'Telehealth operations'],
                guardrails: mockSupportWorkspace.selectedTicket.guardrails,
              }
            : mockSupportWorkspace.selectedTicket,
        },
      },
    };
  } catch (error) {
    return { source: 'mock', error: fallbackErrorMessage(error), data: { items: mockSupportTickets, workspace: mockSupportWorkspace } };
  }
}

export async function loadIntegratedSafetyWorkspace(): Promise<LoadResult<{ items: typeof mockSafetyCases; workspace: typeof mockSafetyWorkspace; selectedCaseId?: string }>> {
  try {
    const [summaryResponse, listResponse] = await Promise.all([
      apiRequest<ApiWorkflowSummaryResponse>('/api/safety/summary'),
      apiRequest<ApiSafetyListResponse>('/api/safety/cases'),
    ]);
    const selectedApi = listResponse.items[0];
    const detailResponse = selectedApi ? await apiRequest<ApiSafetyDetailResponse>(`/api/safety/cases/${selectedApi.id}`) : null;
    const selectedCase = selectedApi ? mapSafetyItem(selectedApi, detailResponse?.auditTrail) : mockSafetyCases[0];
    return {
      source: 'api',
      data: {
        items: listResponse.items.map((item) => mapSafetyItem(item)),
        selectedCaseId: selectedApi?.id,
        workspace: {
          summary: [
            { label: 'Cases in queue', value: String(summaryResponse.summary.total), detail: 'Safety cases returned by the live API' },
            { label: 'Assigned', value: String(summaryResponse.summary.assigned), detail: 'Cases with an owner currently assigned' },
            { label: 'Major or critical', value: String((summaryResponse.summary.byRisk.HIGH ?? 0) + (summaryResponse.summary.byRisk.CRITICAL ?? 0)), detail: 'Cases with elevated severity' },
          ],
          workQueues: [
            `Statuses: ${Object.entries(summaryResponse.summary.byStatus).map(([label, value]) => `${label} (${value})`).join(', ') || 'No status buckets returned'}`,
            `Storage mode: ${listResponse.storageMode || detailResponse?.storageMode || 'unknown'}`,
            'Use the live controls below to triage, record action plans, and close the selected case.',
          ],
          selectedCase,
        },
      },
    };
  } catch (error) {
    return { source: 'mock', error: fallbackErrorMessage(error), data: { items: mockSafetyCases, workspace: mockSafetyWorkspace } };
  }
}


function titleize(value?: string | null) {
  return String(value ?? '')
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\w/g, (char) => char.toUpperCase())
    .trim();
}

function mapReportStatus(status?: string | null, lastRunAt?: string | null) {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'DRAFT') return 'Draft' as const;
  if (normalized === 'SCHEDULED') return 'Scheduled' as const;
  if (lastRunAt || normalized === 'PUBLISHED') return 'Last run complete' as const;
  return 'Draft' as const;
}

function mapCampaignApprovalState(status?: string | null) {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'DRAFT') return 'Draft' as const;
  if (['APPROVED', 'SCHEDULED', 'PAUSED'].includes(normalized)) return normalized === 'PAUSED' ? 'Needs legal review' as const : 'Approved' as const;
  if (normalized === 'SENT') return 'Approved' as const;
  return 'Needs legal review' as const;
}

function mapCampaignRunState(status?: string | null) {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'PAUSED') return 'Paused' as const;
  if (normalized === 'SENT') return 'Sent' as const;
  return 'Scheduled' as const;
}

function mapIntegrationStatus(status?: string | null) {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'DISABLED') return 'Disabled' as const;
  if (normalized === 'ACTIVE') return 'Enabled' as const;
  return 'Pending rotation' as const;
}

function mapIntegrationSecretState(item: ApiGrowthItem) {
  const normalized = String(item.status || '').toUpperCase();
  if (item.lastRotatedAt && normalized === 'ACTIVE') return 'Rotated recently' as const;
  if (normalized === 'DISABLED' || normalized === 'DEGRADED') return 'Review required' as const;
  return 'Masked' as const;
}

function mapFraudScore(priority?: string | null) {
  const normalized = String(priority || '').toUpperCase();
  if (normalized === 'LOW') return 'Low' as const;
  if (normalized === 'MEDIUM') return 'Medium' as const;
  return 'High' as const;
}

function mapModerationState(status?: string | null) {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'RESOLVED') return 'Approved' as const;
  if (normalized === 'ESCALATED') return 'Removed' as const;
  if (normalized === 'IN_REVIEW') return 'Redacted' as const;
  return 'Queued' as const;
}

function mapReportItem(item: ApiGrowthItem) {
  return {
    id: item.id,
    reportName: item.title,
    domain: titleize(item.category) || 'Operations',
    dataScope: item.summary || 'Governed aggregate metrics',
    schedule: titleize(item.schedule) || 'On demand',
    status: mapReportStatus(item.status, item.lastRunAt),
  } as const;
}

function mapCampaignItem(item: ApiGrowthItem) {
  const channel = titleize(item.channel).replace('In App', 'In-App') as 'Push' | 'SMS' | 'Email' | 'In-App';
  return {
    id: item.id,
    campaignName: item.title,
    segment: titleize(item.audience) || 'General audience',
    channel: (['Push', 'SMS', 'Email', 'In-App'].includes(channel) ? channel : 'In-App') as 'Push' | 'SMS' | 'Email' | 'In-App',
    approvalState: mapCampaignApprovalState(item.status),
    runState: mapCampaignRunState(item.status),
  } as const;
}

function mapIntegrationItem(item: ApiGrowthItem) {
  return {
    id: item.id,
    integrationName: item.title,
    category: titleize(item.category) || 'Platform',
    status: mapIntegrationStatus(item.status),
    secretState: mapIntegrationSecretState(item),
    lastChangedAt: item.updatedAt ? formatUtcDateTime(item.updatedAt) : 'Not available',
  } as const;
}

function mapModerationItem(item: ApiGrowthItem) {
  return {
    id: item.id,
    reviewRef: item.code,
    providerName: titleize(item.disputedEntity) || titleize(item.queue) || 'Unknown provider',
    fraudScore: mapFraudScore(item.priority),
    disputeOpen: ['OPEN', 'ESCALATED', 'IN_REVIEW'].includes(String(item.status || '').toUpperCase()),
    moderationState: mapModerationState(item.status),
  } as const;
}

export async function loadIntegratedReportsWorkspace(): Promise<LoadResult<{ items: typeof mockReports; workspace: typeof mockReportsWorkspace & { refillMetrics?: Array<{ label: string; value: string; detail: string }>; refillInsights?: string[]; refillPresets?: Array<{ id: string; title: string; description: string; metricCount: string }>; savedRefillPresets?: Array<{ id: string; title: string; description: string; metricCount: string; format: string; subjectScope?: string; updatedAt: string }>; deliverySchedules?: Array<{ id: string; title: string; destination: string; schedule: string; format: string; subjectScope?: string; updatedAt: string; lastRunAt?: string; lastRunStatus?: string; lastRunSummary?: string }>; deliveryExecutions?: Array<{ id: string; title: string; status: string; executedAt: string; destination: string; summary: string; trigger: string; subjectScope?: string }>; exportRecommendations?: string[] }; selectedReportId?: string }>> {
  try {
    const [summaryResponse, listResponse, presetsResponse, savedPresetsResponse, deliverySchedulesResponse, deliveryExecutionsResponse] = await Promise.all([
      apiRequest<ApiGrowthSummaryResponse>('/api/reports/summary'),
      apiRequest<ApiGrowthListResponse>('/api/reports/definitions'),
      apiRequest<ApiReportPresetResponse>('/api/reports/presets').catch(() => ({ items: [] } as ApiReportPresetResponse)),
      apiRequest<ApiSavedReportPresetResponse>('/api/reports/saved-presets').catch(() => ({ items: [], count: 0 } as ApiSavedReportPresetResponse)),
      apiRequest<ApiReportDeliveryScheduleResponse>('/api/reports/delivery-schedules').catch(() => ({ items: [], count: 0 } as ApiReportDeliveryScheduleResponse)),
      apiRequest<ApiReportDeliveryExecutionResponse>('/api/reports/delivery-executions?limit=8').catch(() => ({ items: [], count: 0 } as ApiReportDeliveryExecutionResponse)),
    ]);
    const selectedApi = listResponse.items[0];
    const detailResponse = selectedApi ? await apiRequest<ApiGrowthDetailResponse>(`/api/reports/definitions/${selectedApi.id}`) : null;
    const runPreview = selectedApi ? await apiRequestWithInit<ApiReportRunResponse>(`/api/reports/definitions/${selectedApi.id}/run`, { method: 'POST', body: JSON.stringify({ range: 'last_30_days' }) }).catch(() => null) : null;
    const selectedItem = detailResponse?.item ?? selectedApi;
    return {
      source: 'api',
      data: {
        items: listResponse.items.map(mapReportItem),
        selectedReportId: selectedApi?.id,
        workspace: {
          summary: [
            { label: 'Saved reports', value: String(summaryResponse.summary.total), detail: 'Live report definitions available to the current admin scope' },
            { label: 'Ready for delivery', value: String(summaryResponse.summary.ready), detail: 'Published or recently run definitions available for governed delivery' },
            { label: 'Needs attention', value: String(summaryResponse.summary.attentionRequired), detail: 'Definitions needing review, ownership updates, or archive decisions' },
          ],
          selectedReport: selectedItem
            ? {
                reportName: selectedItem.title,
                status: mapReportStatus(selectedItem.status, selectedItem.lastRunAt),
                domain: titleize(selectedItem.category) || 'Operations',
                owner: titleize(selectedItem.ownerRole) || 'Operations analytics',
                schedule: titleize(selectedItem.schedule) || 'On demand',
                audience: selectedItem.destination || 'Governed recipients',
                scopeNote: selectedItem.summary || 'Report definition returned without an explicit scope summary.',
                metrics: (selectedItem.metricKeys || []).map((metric) => titleize(metric)) || mockReportsWorkspace.selectedReport.metrics,
                actions: ['Preview columns', 'Publish definition', 'Run report now'],
                guardrails: mockReportsWorkspace.selectedReport.guardrails,
              }
            : mockReportsWorkspace.selectedReport,
          deliveryPacks: [
            { label: 'Published definitions', value: String(summaryResponse.summary.byStatus.PUBLISHED ?? 0), detail: 'Definitions currently available for governed distribution' },
            { label: 'Scheduled definitions', value: String(summaryResponse.summary.byStatus.SCHEDULED ?? 0), detail: 'Definitions with a delivery schedule still active' },
            { label: 'Draft definitions', value: String(summaryResponse.summary.byStatus.DRAFT ?? 0), detail: 'Definitions waiting on publish or archive action' },
          ],
          exportQueue: runPreview?.reportRun?.metrics?.length
            ? runPreview.reportRun.metrics.map((metric) => `${titleize(metric.metricKey)} returned ${metric.value} with ${metric.deltaPct}% delta in the preview run.`)
            : mockReportsWorkspace.exportQueue,
          refillMetrics: runPreview?.reportRun?.metrics?.length
            ? runPreview.reportRun.metrics.slice(0, 4).map((metric) => ({
                label: titleize(metric.metricKey),
                value: String(metric.value),
                detail: `${metric.deltaPct}% delta in the current preview window`,
              }))
            : [],
          refillInsights: runPreview?.reportRun?.refillInsights
            ? [
                `Under 24h: ${runPreview.reportRun.refillInsights.byAgingBand?.LT_24H ?? 0}` ,
                `24–48h: ${runPreview.reportRun.refillInsights.byAgingBand?.H24_TO_48H ?? 0}` ,
                `Over 48h: ${runPreview.reportRun.refillInsights.byAgingBand?.GT_48H ?? 0}` ,
                `Controlled queue: ${runPreview.reportRun.refillInsights.controlledMedicationQueue ?? 0}` ,
                `Rejected controlled refills: ${runPreview.reportRun.refillInsights.rejectedControlledMedication ?? 0}` ,
              ]
            : [],
          refillPresets: (presetsResponse.items ?? []).map((item) => ({
            id: item.id,
            title: item.title,
            description: item.description || 'Reusable refill KPI preset from the live API.',
            metricCount: `${Array.isArray(item.metricKeys) ? item.metricKeys.length : 0} metrics`,
          })),
          savedRefillPresets: (savedPresetsResponse.items ?? []).map((item) => ({
            id: item.id,
            title: item.title,
            description: item.description || 'Saved refill export preset created from governed report controls.',
            metricCount: `${Array.isArray(item.metricKeys) ? item.metricKeys.length : 0} metrics`,
            format: String(item.format ?? 'csv').toUpperCase(),
            subjectScope: titleize(String(item.subjectScope ?? 'all')),
            updatedAt: item.updatedAt ? formatUtcDateTime(item.updatedAt) : 'Just now',
          })),
          deliverySchedules: (deliverySchedulesResponse.items ?? []).map((item) => ({
            id: item.id,
            title: item.title,
            destination: item.destination,
            schedule: item.schedule,
            format: String(item.format ?? 'csv').toUpperCase(),
            subjectScope: titleize(String(item.subjectScope ?? 'all')),
            updatedAt: item.updatedAt ? formatUtcDateTime(item.updatedAt) : 'Just now',
            lastRunAt: item.lastRunAt ? formatUtcDateTime(item.lastRunAt) : 'Not run yet',
            lastRunStatus: titleize(item.lastRunStatus) || 'Pending',
            lastRunSummary: item.lastRunSummary || 'No delivery execution has been recorded yet.',
          })),
          deliveryExecutions: (deliveryExecutionsResponse.items ?? []).map((item) => ({
            id: item.id,
            title: item.title,
            status: titleize(item.status) || 'Success',
            executedAt: item.executedAt ? formatUtcDateTime(item.executedAt) : 'Just now',
            destination: item.destination || 'Governed destination',
            summary: item.summary || 'Execution completed.',
            trigger: titleize(item.trigger) || 'Manual',
            subjectScope: titleize(String(item.subjectScope ?? 'all')),
          })),
          exportRecommendations: runPreview?.reportRun?.metrics?.length
            ? [
                'Export CSV for operations huddles and queue handoff packs.',
                'Export JSON when refill KPI payloads need to feed governed reporting workflows.',
              ]
            : ['Run a live report preview to generate export-ready refill KPI payloads.'],
        },
      },
    };
  } catch (error) {
    return { source: 'mock', error: fallbackErrorMessage(error), data: { items: mockReports, workspace: mockReportsWorkspace } };
  }
}

export async function loadIntegratedCampaignWorkspace(): Promise<LoadResult<{ items: typeof mockCampaigns; workspace: typeof mockCampaignWorkspace; selectedCampaignId?: string }>> {
  try {
    const [summaryResponse, listResponse] = await Promise.all([
      apiRequest<ApiGrowthSummaryResponse>('/api/campaigns/summary'),
      apiRequest<ApiGrowthListResponse>('/api/campaigns'),
    ]);
    const selectedApi = listResponse.items[0];
    const detailResponse = selectedApi ? await apiRequest<ApiGrowthDetailResponse>(`/api/campaigns/${selectedApi.id}`) : null;
    const selectedItem = detailResponse?.item ?? selectedApi;
    return {
      source: 'api',
      data: {
        items: listResponse.items.map(mapCampaignItem),
        selectedCampaignId: selectedApi?.id,
        workspace: {
          summary: [
            { label: 'Active campaigns', value: String(summaryResponse.summary.total), detail: 'Campaigns currently available in the live API scope' },
            { label: 'Approval-ready', value: String(summaryResponse.summary.ready), detail: 'Campaigns already approved, scheduled, or sent' },
            { label: 'Approval holds', value: String(summaryResponse.summary.attentionRequired), detail: 'Campaigns requiring legal, compliance, or operational review' },
          ],
          selectedCampaign: selectedItem
            ? {
                campaignName: selectedItem.title,
                approvalState: mapCampaignApprovalState(selectedItem.status),
                segment: titleize(selectedItem.audience) || 'General audience',
                channel: titleize(selectedItem.channel).replace('In App', 'In-App') || 'In-App',
                owner: titleize(selectedItem.ownerRole) || 'Engagement operations',
                sendWindow: selectedItem.scheduledFor ? formatUtcDateTime(selectedItem.scheduledFor) : 'Schedule not set',
                blocker: selectedItem.summary || 'Campaign returned without an explicit blocker note.',
                checks: [
                  `Suppression count: ${selectedItem.suppressionCount ?? 0}`,
                  `Current status: ${titleize(selectedItem.status)}`,
                  `Storage mode: ${listResponse.storageMode || detailResponse?.storageMode || 'unknown'}`,
                ],
                actions: ['Preview copy', 'Approve campaign', 'Schedule campaign'],
                guardrails: mockCampaignWorkspace.selectedCampaign.guardrails,
              }
            : mockCampaignWorkspace.selectedCampaign,
          deliveryWatch: [
            { label: 'Approved', count: String(summaryResponse.summary.byStatus.APPROVED ?? 0), note: 'Approved campaigns ready for schedule or send orchestration' },
            { label: 'Scheduled', count: String(summaryResponse.summary.byStatus.SCHEDULED ?? 0), note: 'Campaigns with an upcoming send time already configured' },
            { label: 'Paused', count: String(summaryResponse.summary.byStatus.PAUSED ?? 0), note: 'Campaigns held due to copy, suppression, or operations review' },
          ],
          recentOutcomes: listResponse.items.slice(0, 3).map((item) => `${item.title} is currently ${titleize(item.status)} on ${titleize(item.channel)} for ${titleize(item.audience)}.`),
        },
      },
    };
  } catch (error) {
    return { source: 'mock', error: fallbackErrorMessage(error), data: { items: mockCampaigns, workspace: mockCampaignWorkspace } };
  }
}

export async function loadIntegratedIntegrationsWorkspace(): Promise<LoadResult<{ items: typeof mockIntegrations; workspace: typeof mockIntegrationWorkspace; selectedIntegrationId?: string }>> {
  try {
    const [summaryResponse, listResponse] = await Promise.all([
      apiRequest<ApiGrowthSummaryResponse>('/api/integrations/summary'),
      apiRequest<ApiGrowthListResponse>('/api/integrations'),
    ]);
    const selectedApi = listResponse.items[0];
    const detailResponse = selectedApi ? await apiRequest<ApiGrowthDetailResponse>(`/api/integrations/${selectedApi.id}`) : null;
    const selectedItem = detailResponse?.item ?? selectedApi;
    return {
      source: 'api',
      data: {
        items: listResponse.items.map(mapIntegrationItem),
        selectedIntegrationId: selectedApi?.id,
        workspace: {
          summary: [
            { label: 'Enabled integrations', value: String(summaryResponse.summary.ready), detail: 'Connectors currently active or healthy in the live API scope' },
            { label: 'Pending rotations', value: String(summaryResponse.summary.attentionRequired), detail: 'Integrations needing rotation, disablement, or health review' },
            { label: 'Recent config changes', value: String(summaryResponse.summary.total), detail: 'Tracked integration records available for controlled change management' },
          ],
          selectedIntegration: selectedItem
            ? {
                integrationName: selectedItem.title,
                status: mapIntegrationStatus(selectedItem.status),
                category: titleize(selectedItem.category) || 'Platform',
                owner: titleize(selectedItem.ownerRole) || 'Platform reliability',
                environment: titleize(selectedItem.environment) || 'Production',
                lastRotatedAt: selectedItem.lastRotatedAt ? formatUtcDateTime(selectedItem.lastRotatedAt) : 'Not recorded',
                riskNote: selectedItem.summary || 'Integration returned without an explicit risk note.',
                checks: [
                  `Provider: ${selectedItem.provider || 'Unknown provider'}`,
                  `Health: ${titleize(selectedItem.lastHealthStatus) || 'Unknown'}`,
                  `Last checked: ${selectedItem.lastCheckedAt ? formatUtcDateTime(selectedItem.lastCheckedAt) : 'Not recorded'}`,
                ],
                actions: ['Inspect webhook', 'Disable integration', 'Rotate secret now'],
                guardrails: mockIntegrationWorkspace.selectedIntegration.guardrails,
              }
            : mockIntegrationWorkspace.selectedIntegration,
          changeQueue: [
            { label: 'Active', count: String(summaryResponse.summary.byStatus.ACTIVE ?? 0), note: 'Integrations currently marked active' },
            { label: 'Disabled', count: String(summaryResponse.summary.byStatus.DISABLED ?? 0), note: 'Connectors intentionally disabled and awaiting review' },
            { label: 'Degraded', count: String(summaryResponse.summary.byStatus.DEGRADED ?? 0), note: 'Integrations showing elevated risk or pending remediation' },
          ],
          platformDependencies: listResponse.items.slice(0, 3).map((item) => `${item.title} supports ${String(item.category || 'platform').toLowerCase()} workflows and is owned by ${titleize(item.ownerRole) || 'operations'}.`),
        },
      },
    };
  } catch (error) {
    return { source: 'mock', error: fallbackErrorMessage(error), data: { items: mockIntegrations, workspace: mockIntegrationWorkspace } };
  }
}

export async function loadIntegratedModerationWorkspace(): Promise<LoadResult<{ items: typeof mockReviewModeration; workspace: typeof mockReviewModerationWorkspace; selectedReviewId?: string }>> {
  try {
    const [summaryResponse, listResponse] = await Promise.all([
      apiRequest<ApiGrowthSummaryResponse>('/api/moderation/summary'),
      apiRequest<ApiGrowthListResponse>('/api/moderation/reviews'),
    ]);
    const selectedApi = listResponse.items[0];
    const detailResponse = selectedApi ? await apiRequest<ApiModerationDetailResponse>(`/api/moderation/reviews/${selectedApi.id}`) : null;
    const selectedItem = detailResponse?.item ?? selectedApi;
    const auditTrail = detailResponse?.auditTrail || [];
    const highRiskCount = listResponse.items.filter((item) => ['HIGH', 'CRITICAL'].includes(String(item.priority || '').toUpperCase())).length;
    const openDisputesCount = listResponse.items.filter((item) => ['OPEN', 'ESCALATED', 'IN_REVIEW'].includes(String(item.status || '').toUpperCase())).length;
    return {
      source: 'api',
      data: {
        items: listResponse.items.map(mapModerationItem),
        selectedReviewId: selectedApi?.id,
        workspace: {
          summary: [
            { label: 'Queued reviews', value: String(summaryResponse.summary.total), detail: 'Moderation items available in the live review queue' },
            { label: 'High-risk signals', value: String(highRiskCount), detail: 'Items currently carrying high or critical fraud priority' },
            { label: 'Open disputes', value: String(openDisputesCount), detail: 'Reviews still waiting on moderation action or dispute closure' },
          ],
          selectedReview: selectedItem
            ? {
                reviewRef: selectedItem.code,
                providerName: titleize(selectedItem.disputedEntity) || titleize(selectedItem.queue) || 'Unknown provider',
                fraudScore: mapFraudScore(selectedItem.priority),
                moderationState: mapModerationState(selectedItem.status),
                disputeOwner: selectedItem.ownerName || titleize(selectedItem.queue) || 'Trust and safety',
                evidenceWindow: selectedItem.createdAt ? `Opened ${formatUtcDateTime(selectedItem.createdAt)}` : 'Evidence window not returned',
                riskNote: selectedItem.summary || 'Moderation item returned without an explicit risk note.',
                evidence: [
                  ...(selectedItem.riskSignals || []).map((signal) => `Risk signal: ${titleize(signal)}`),
                  ...auditTrail.slice(0, 2).map((entry) => `${humanizeAction(entry.action)} at ${formatUtcDateTime(entry.createdAt)}`),
                ].slice(0, 4),
                actions: ['View source evidence', 'Assign reviewer', 'Escalate fraud review'],
                guardrails: mockReviewModerationWorkspace.selectedReview.guardrails,
              }
            : mockReviewModerationWorkspace.selectedReview,
          queueSignals: [
            { label: 'High fraud score', count: String(highRiskCount), note: 'Requires same-day trust and safety review' },
            { label: 'Open disputes', count: String(openDisputesCount), note: 'Items still in open, escalated, or in-review states' },
            { label: 'Resolved', count: String(summaryResponse.summary.byStatus.RESOLVED ?? 0), note: 'Cases recently closed with an approved or resolved outcome' },
          ],
          recentOutcomes: auditTrail.length
            ? auditTrail.slice(0, 3).map((entry) => `${humanizeAction(entry.action)} by ${entry.actor?.name || entry.actor?.email || 'System'} at ${formatUtcDateTime(entry.createdAt)}.`)
            : mockReviewModerationWorkspace.recentOutcomes,
        },
      },
    };
  } catch (error) {
    return { source: 'mock', error: fallbackErrorMessage(error), data: { items: mockReviewModeration, workspace: mockReviewModerationWorkspace } };
  }
}


type ApiChartAccessException = {
  id: string;
  patientId: string;
  providerId: string;
  reasonCode: string;
  note?: string | null;
  expiresAt?: string | null;
  updatedAt: string;
};

type ApiChartAccessExceptionResponse = {
  items: ApiChartAccessException[];
  count: number;
};

export async function loadClinicalAccessExceptions() {
  try {
    const response = await apiRequest<ApiChartAccessExceptionResponse>('/api/records/access-exceptions?status=ACTIVE');
    return {
      source: 'api' as const,
      error: undefined,
      data: response.items.map((item) => ({
        id: item.id,
        title: `${item.reasonCode.replaceAll('_', ' ')} access`,
        detail: `Patient ${item.patientId} • Provider ${item.providerId}`,
        note: item.note ?? 'No note captured.',
        expiresAt: item.expiresAt ? formatUtcDateTime(item.expiresAt) : 'No expiry',
        updatedAt: formatUtcDateTime(item.updatedAt),
      })),
    };
  } catch (error) {
    return {
      source: 'mock' as const,
      error: error instanceof Error ? error.message : 'Unable to load chart access exceptions.',
      data: [],
    };
  }
}


type ApiRefillRequestItem = {
  id: string;
  prescriptionId: string;
  patientId: string;
  status: string;
  pharmacyRoutingState: string;
  assignedRole?: string | null;
  assignedOwnerName?: string | null;
  queue?: string | null;
  fulfillmentStatus?: string | null;
  controlledMedication?: boolean;
  note?: string | null;
  decisionNote?: string | null;
  updatedAt: string;
};

type ApiRefillRequestResponse = {
  items: ApiRefillRequestItem[];
  count: number;
  summary?: {
    total?: number;
    pharmacyQueue?: number;
    agedOver24h?: number;
    rejectedControlledMedication?: number;
  };
};

type ApiRefillOperationalEventResponse = {
  items: Array<{ id: string; at: string; type: string; label: string; note?: string | null; queue?: string | null; actorRole?: string | null; requestId: string; prescriptionId: string; patientId: string; status: string; assignedRole?: string | null; assignedOwnerName?: string | null; escalated?: boolean; controlledMedication?: boolean }>;
  count: number;
};

export async function loadRefillRequests() {
  try {
    const response = await apiRequest<ApiRefillRequestResponse>('/api/records/refill-requests?status=ALL');
    return {
      source: 'api' as const,
      error: undefined,
      summary: response.summary ?? undefined,
      data: response.items.map((item) => ({
        id: item.id,
        title: `${item.status.replaceAll('_', ' ')} refill`,
        detail: `Patient ${item.patientId} • Prescription ${item.prescriptionId} • ${item.fulfillmentStatus?.replaceAll('_', ' ') ?? 'Awaiting review'}`,
        routing: `${item.pharmacyRoutingState.replaceAll('_', ' ')}${item.queue ? ` / ${item.queue.replaceAll('_', ' ')}` : ''}`,
        note: item.decisionNote ?? item.note ?? 'No note captured.',
        assignedRole: item.assignedRole ?? 'QUEUE',
        status: item.status,
        controlledMedication: Boolean(item.controlledMedication),
        updatedAtIso: item.updatedAt,
        updatedAt: formatUtcDateTime(item.updatedAt),
      })),
    };
  } catch (error) {
    return {
      source: 'mock' as const,
      error: error instanceof Error ? error.message : 'Unable to load refill requests.',
      summary: undefined,
      data: [],
    };
  }
}

export async function loadRefillOperationalEvents(limit = 12) {
  try {
    const response = await apiRequest<ApiRefillOperationalEventResponse>(`/api/records/refill-operational-events?limit=${limit}`);
    return {
      source: 'api' as const,
      error: undefined,
      data: response.items.map((item) => ({
        id: item.id,
        title: item.label,
        detail: `Patient ${item.patientId} • Prescription ${item.prescriptionId} • ${item.status.replaceAll('_', ' ')}`,
        note: item.note ?? (item.assignedOwnerName ? `Owner: ${item.assignedOwnerName}` : 'Operational refill event captured in the live audit trail.'),
        queue: item.queue ? item.queue.replaceAll('_', ' ') : 'Queue not specified',
        actorRole: item.actorRole ?? 'SYSTEM',
        updatedAt: formatUtcDateTime(item.at),
        controlledMedication: Boolean(item.controlledMedication),
      })),
    };
  } catch (error) {
    return {
      source: 'mock' as const,
      error: error instanceof Error ? error.message : 'Unable to load refill operational events.',
      data: [],
    };
  }
}


export async function loadReportDeliveryExecutions(limit = 12) {
  try {
    const response = await apiRequest<ApiReportDeliveryExecutionResponse>(`/api/reports/delivery-executions?limit=${limit}`);
    return {
      source: 'api' as const,
      data: response.items.map((item) => ({
        id: item.id,
        title: item.title,
        detail: `${titleize(item.status)} • ${titleize(item.trigger)} • ${item.destination || 'Governed destination'}`,
        note: item.summary || 'Execution completed.',
        executedAt: item.executedAt ? formatUtcDateTime(item.executedAt) : 'Just now',
      })),
    };
  } catch (error) {
    return { source: 'mock' as const, error: fallbackErrorMessage(error), data: [] as Array<{ id: string; title: string; detail: string; note: string; executedAt: string }> };
  }
}

export async function loadRefillAuditScopeUsage() {
  try {
    const response = await apiRequest<ApiRefillAuditScopeUsageResponse>('/api/records/refill-audit-scope-usage');
    return {
      source: 'api' as const,
      error: undefined,
      data: response.items.map((item) => ({
        id: item.id,
        title: item.title,
        note: item.note ?? 'Governed refill scope saved from the audit export workflow.',
        updatedAt: formatUtcDateTime(item.updatedAt),
        filters: [
          item.filters?.queue ? `Queue: ${titleize(item.filters.queue)}` : null,
          item.filters?.assignedRole ? `Owner: ${titleize(item.filters.assignedRole)}` : null,
          item.filters?.controlledOnly ? 'Controlled only' : null,
          item.filters?.escalatedOnly ? 'Escalated only' : null,
        ].filter(Boolean) as string[],
        summary: {
          exportReadyCount: item.summary?.exportReadyCount ?? 0,
          escalationCount: item.summary?.escalationCount ?? 0,
          failedDeliveryCount: item.summary?.failedDeliveryCount ?? 0,
          operationalEventCount: item.summary?.operationalEventCount ?? 0,
          deliveryExecutionCount: item.summary?.deliveryExecutionCount ?? 0,
          controlledMedicationEvents: item.summary?.controlledMedicationEvents ?? 0,
        },
        governanceNotes: item.governanceNotes ?? [],
        latestExecution: item.latestExecution
          ? {
              title: item.latestExecution.title,
              status: titleize(item.latestExecution.status),
              executedAt: formatUtcDateTime(item.latestExecution.executedAt),
              summary: item.latestExecution.summary,
            }
          : null,
      })),
    };
  } catch (error) {
    return {
      source: 'mock' as const,
      error: fallbackErrorMessage(error),
      data: [] as Array<{
        id: string;
        title: string;
        note: string;
        updatedAt: string;
        filters: string[];
        summary: {
          exportReadyCount: number;
          escalationCount: number;
          failedDeliveryCount: number;
          operationalEventCount: number;
          deliveryExecutionCount: number;
          controlledMedicationEvents: number;
        };
        governanceNotes: string[];
        latestExecution: { title: string; status: string; executedAt: string; summary: string } | null;
      }>,
    };
  }
}



export async function loadReportDeliveryFailures(limit = 12) {
  try {
    const response = await apiRequest<ApiReportDeliveryFailureResponse>(`/api/reports/delivery-failures?limit=${limit}`);
    return {
      source: 'api' as const,
      error: undefined,
      data: response.items.map((item) => ({
        id: item.id,
        title: item.title,
        destination: item.destination ?? 'Governed destination',
        summary: item.summary ?? 'Execution failed.',
        executedAt: formatUtcDateTime(item.executedAt),
      })),
      summary: {
        failedCount: response.summary?.failedCount ?? response.count,
        destinationCount: response.summary?.destinations ?? 0,
        scheduleCount: response.summary?.schedules ?? 0,
        latestFailureAt: response.summary?.latestFailureAt ? formatUtcDateTime(response.summary.latestFailureAt) : null,
      },
    };
  } catch (error) {
    return {
      source: 'mock' as const,
      error: fallbackErrorMessage(error),
      data: [] as Array<{ id: string; title: string; destination: string; summary: string; executedAt: string }>,
      summary: { failedCount: 0, destinationCount: 0, scheduleCount: 0, latestFailureAt: null },
    };
  }
}

export async function loadRefillGovernanceWorkspace() {
  const [scopeUsage, deliveryFailures] = await Promise.all([loadRefillAuditScopeUsage(), loadReportDeliveryFailures(10)]);
  let selectedScope: {
    id: string;
    title: string;
    note: string;
    filters: string[];
    summary: { exportReadyCount: number; escalationCount: number; failedDeliveryCount: number; operationalEventCount: number; deliveryExecutionCount: number; controlledMedicationEvents: number };
    governanceNotes: string[];
    latestExecution: { title: string; status: string; executedAt: string; summary: string } | null;
  } | null = scopeUsage.data[0] ?? null;
  let selectedScopeDetail: { governanceNotes: string[]; latestFailures: Array<{ id: string; title: string; destination: string; summary: string; executedAt: string }> } | null = null;
  if (selectedScope) {
    try {
      const response = await apiRequest<ApiRefillAuditScopeDetailResponse>(`/api/records/refill-audit-scopes/${selectedScope.id}`);
      selectedScopeDetail = {
        governanceNotes: response.governanceNotes ?? [],
        latestFailures: (response.latestFailures ?? []).map((item) => ({
          id: item.id,
          title: item.title,
          destination: item.destination ?? 'Governed destination',
          summary: item.summary ?? 'Execution failed.',
          executedAt: formatUtcDateTime(item.executedAt),
        })),
      };
    } catch {
      selectedScopeDetail = null;
    }
  }
  return {
    source: scopeUsage.source === 'api' || deliveryFailures.source === 'api' ? 'api' as const : 'mock' as const,
    error: scopeUsage.error ?? deliveryFailures.error,
    data: {
      scopes: scopeUsage.data,
      deliveryFailures: deliveryFailures.data,
      failureSummary: deliveryFailures.summary,
      selectedScope,
      selectedScopeDetail,
    },
  };
}

