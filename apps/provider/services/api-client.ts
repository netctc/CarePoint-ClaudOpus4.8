import { clearBrowserSession, getBrowserSession, readCookie, redirectToProviderSignIn } from '@/lib/auth/browser-session';

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000').replace(/\/$/, '');

type RequestOptions = RequestInit & {
  token?: string | null;
};

async function parseResponseBody(response: Response) {
  const contentType = response.headers.get('content-type') ?? '';

  if (response.status === 204) {
    return undefined;
  }

  if (contentType.includes('application/json')) {
    return response.json();
  }

  const text = await response.text();
  return text || undefined;
}

// Client-side fetch timeout (ms) applied only to safe (GET) reads so a slow
// or unreachable API surfaces an error quickly instead of hanging the UI.
// Mutations are intentionally left without an abort to avoid aborting a
// request that may already have been applied server-side.
const PROVIDER_API_TIMEOUT_MS = Number.parseInt(process.env.NEXT_PUBLIC_PROVIDER_API_TIMEOUT_MS ?? '10000', 10);

async function request<T>(path: string, init?: RequestOptions): Promise<T> {
  const token = init?.token ?? getBrowserSession().accessToken;
  const locale = readCookie('cc_locale') ?? 'en';
  const method = (init?.method ?? 'GET').toUpperCase();
  const isReadOnly = method === 'GET' || method === 'HEAD';
  const timeoutMs = Number.isFinite(PROVIDER_API_TIMEOUT_MS) && PROVIDER_API_TIMEOUT_MS > 0 ? PROVIDER_API_TIMEOUT_MS : 10000;
  const signal = init?.signal ?? (isReadOnly ? AbortSignal.timeout(timeoutMs) : undefined);
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    cache: 'no-store',
    ...(signal ? { signal } : {}),
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'x-locale': locale,
      ...(init?.headers ?? {}),
    },
  });

  const body = await parseResponseBody(response);

  if (!response.ok) {
    if (response.status === 401) {
      clearBrowserSession();
      redirectToProviderSignIn();
    }

    if (typeof body === 'string' && body.trim()) {
      throw new Error(body);
    }

    if (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string') {
      throw new Error(body.error);
    }

    throw new Error(`API request failed: ${response.status}`);
  }

  return body as T;
}

function withQuery(path: string, params: Record<string, string | undefined | null>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim()) {
      search.set(key, String(value));
    }
  });
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

export const providerApi = {
  login: (email: string, password: string) =>
    request<{ accessToken: string; user: { role: string } }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  startPrivilegedChallenge: (payload: { email: string; password: string; managedDevice: boolean; riskAcknowledged: boolean; channel?: 'email' | 'sms' | 'totp' }) =>
    request<{ challengeId: string; channel: string; expiresInSeconds: number; resendAfterSeconds: number; devCode?: string; challengeStoreMode?: string; risk?: { level: string; reasons: string[]; requiresAcknowledgement: boolean; ssoRecommended: boolean; allowedDomains: string[] }; sso?: { available: boolean; providerName: string; note: string; allowedDomains: string[] }; user: { role: string; email: string } }>('/api/auth/challenge/start', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  verifyPrivilegedChallenge: (payload: { challengeId: string; code: string }) =>
    request<{ accessToken: string; user: { role: string } }>('/api/auth/challenge/verify', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  resendPrivilegedChallenge: (challengeId: string) =>
    request<{ challengeId: string; channel: string; expiresInSeconds: number; resendAfterSeconds: number; devCode?: string }>('/api/auth/challenge/resend', {
      method: 'POST',
      body: JSON.stringify({ challengeId }),
    }),
  ssoConfig: (roleHint: 'admin' | 'provider') => request<{ available: boolean; providerName: string; note: string; allowedDomains: string[] }>(`/api/auth/sso/config?roleHint=${roleHint}`),
  startSso: (payload: { email?: string; roleHint: 'admin' | 'provider'; returnTo?: string }) =>
    request<{ authorizeUrl: string; providerName: string; callbackUrl?: string | null }>('/api/auth/sso/start', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  me: () => request('/api/auth/me'),
  logout: () => request('/api/auth/logout', { method: 'POST' }),
  dashboard: () => request('/api/dashboard/provider'),
  providers: (q?: string) => request(`/api/providers${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  appointments: () => request('/api/appointments'),
  appointment: (appointmentId: string) => request(`/api/appointments/${appointmentId}`),
  confirmAppointment: (appointmentId: string) => request(`/api/appointments/${appointmentId}/confirm`, { method: 'POST' }),
  cancelAppointment: (appointmentId: string) => request(`/api/appointments/${appointmentId}/cancel`, { method: 'POST' }),
  records: (patientId?: string, subjectProfileId?: string) =>
    request(withQuery('/api/records', { patientId, subjectProfileId })),
  chartAccessContext: (patientId: string, subjectProfileId?: string) => request(withQuery('/api/records/access-context', { patientId, subjectProfileId })),
  providerPatientReports: (patientId: string, subjectProfileId?: string) => request(withQuery('/api/records/provider/patient-reports', { patientId, subjectProfileId })),
  createRecord: (body: Record<string, unknown>) =>
    request('/api/records', { method: 'POST', body: JSON.stringify(body) }),
  validateEncounterNote: (body: Record<string, unknown>) =>
    request('/api/records/encounters/validate', { method: 'POST', body: JSON.stringify(body) }),
  signEncounterNote: (body: Record<string, unknown>) =>
    request('/api/records/encounters/sign', { method: 'POST', body: JSON.stringify(body) }),
  threads: () => request('/api/messaging/threads'),
  thread: (threadId: string) => request(`/api/messaging/threads/${threadId}`),
  sendMessage: (threadId: string, body: string) =>
    request('/api/messaging/messages', {
      method: 'POST',
      body: JSON.stringify({ threadId, body, attachments: [] }),
    }),
  acknowledgeUrgentThread: (threadId: string, note?: string) =>
    request(`/api/messaging/threads/${threadId}/urgent-acknowledge`, { method: 'POST', body: JSON.stringify({ note }) }),
  escalateUrgentThread: (threadId: string, payload?: { note?: string; queue?: string; severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'; ownerName?: string }) =>
    request(`/api/messaging/threads/${threadId}/urgent-escalate`, { method: 'POST', body: JSON.stringify(payload ?? {}) }),
  resolveUrgentThread: (threadId: string, note?: string) =>
    request(`/api/messaging/threads/${threadId}/urgent-resolve`, { method: 'POST', body: JSON.stringify({ note }) }),
  telehealthSessions: () => request('/api/telehealth/sessions'),
  prepareTelehealthSession: (appointmentId: string, scheduledAt?: string) =>
    request('/api/telehealth/sessions', {
      method: 'POST',
      body: JSON.stringify({ appointmentId, scheduledAt }),
    }),
  startTelehealthSession: (sessionId: string) => request(`/api/telehealth/sessions/${sessionId}/start`, { method: 'POST' }),
  endTelehealthSession: (sessionId: string) => request(`/api/telehealth/sessions/${sessionId}/end`, { method: 'POST' }),
  payments: () => request('/api/payments'),
  settlePayment: (paymentId: string) => request(`/api/payments/${paymentId}/settle`, { method: 'POST' }),

  providerOnboarding: () => request('/api/provider/onboarding/me'),
  saveProviderOnboarding: (body: Record<string, unknown>) => request('/api/provider/onboarding/me/save-draft', { method: 'POST', body: JSON.stringify(body) }),
  submitProviderOnboarding: (body: Record<string, unknown>) => request('/api/provider/onboarding/me/submit', { method: 'POST', body: JSON.stringify(body) }),

  providerCalendarOverview: () => request('/api/provider/calendar/overview'),
  bookingPolicyPreview: (params: { providerId: string; service: string; location: string; startsAt: string; endsAt: string }) => request(withQuery('/api/appointments/booking-policy-preview', params)),
  bookingControlHolds: (limit = 20) => request(`/api/bookings/control-tower/holds?limit=${limit}`),
  authorizationReview: (appointmentId: string) => request(`/api/bookings/control-tower/${appointmentId}/authorization-review`),
  providerPublishedSlots: (days = 14) => request(`/api/provider/calendar/published-slots?days=${days}`),
  createProviderPublishedSlot: (body: Record<string, unknown>) => request('/api/provider/calendar/published-slots', { method: 'POST', body: JSON.stringify(body) }),
  updateProviderPublishedSlot: (slotId: string, body: Record<string, unknown>) => request(`/api/provider/calendar/published-slots/${slotId}`, { method: 'PATCH', body: JSON.stringify(body) }),
  cancelProviderPublishedSlot: (slotId: string, note?: string) => request(`/api/provider/calendar/published-slots/${slotId}/cancel`, { method: 'POST', body: JSON.stringify({ note }) }),
  providerCalendarTemplates: (params?: { q?: string; status?: string }) => request(withQuery('/api/provider/calendar/templates', params ?? {})),
  providerCalendarTemplate: (templateId: string) => request(`/api/provider/calendar/templates/${templateId}`),
  createProviderCalendarTemplate: (body: Record<string, unknown>) => request('/api/provider/calendar/templates', { method: 'POST', body: JSON.stringify(body) }),
  updateProviderCalendarTemplate: (templateId: string, body: Record<string, unknown>) => request(`/api/provider/calendar/templates/${templateId}`, { method: 'PUT', body: JSON.stringify(body) }),
  publishProviderCalendarTemplate: (templateId: string, note?: string) => request(`/api/provider/calendar/templates/${templateId}/publish`, { method: 'POST', body: JSON.stringify({ note }) }),

  providerOrderSummary: (location?: string) => request(withQuery('/api/provider/orders/summary', { location })),
  providerOrderComposerContext: (params?: { patientId?: string | null; encounterId?: string | null; appointmentId?: string | null; subjectProfileId?: string | null }) => request(withQuery('/api/provider/orders/composer-context', params ?? {})),
  providerOrders: (patientId?: string, subjectProfileId?: string, status?: string, location?: string) => request(withQuery('/api/provider/orders/items', { patientId, subjectProfileId, status, location })),
  providerOrder: (orderId: string) => request(`/api/provider/orders/items/${orderId}`),
  createProviderOrder: (body: Record<string, unknown>) => request('/api/provider/orders/items', { method: 'POST', body: JSON.stringify(body) }),
  submitProviderOrder: (orderId: string, note?: string) => request(`/api/provider/orders/items/${orderId}/submit`, { method: 'POST', body: JSON.stringify({ note }) }),

  providerPrescriptionSummary: (location?: string) => request(withQuery('/api/provider/prescriptions/summary', { location })),
  providerPrescriptions: (patientId?: string, subjectProfileId?: string, location?: string) => request(withQuery('/api/provider/prescriptions/items', { patientId, subjectProfileId, location })),
  providerPrescription: (prescriptionId: string) => request(`/api/provider/prescriptions/items/${prescriptionId}`),
  providerPrescriptionCompliancePreview: (drug: string, pharmacyName?: string) => request(`/api/provider/prescriptions/compliance-preview?drug=${encodeURIComponent(drug)}${pharmacyName ? `&pharmacyName=${encodeURIComponent(pharmacyName)}` : ''}`),
  createProviderPrescription: (body: Record<string, unknown>) => request('/api/provider/prescriptions/items', { method: 'POST', body: JSON.stringify(body) }),
  providerPrescriptionRefillRequests: (patientId?: string, status?: string, assignedRole?: string, location?: string) => request(withQuery('/api/provider/prescriptions/refill-requests', { patientId, status, assignedRole, location })),
  providerPharmacyQueue: (params?: { assignedRole?: string; status?: string; queue?: string; agingBand?: string; controlledOnly?: boolean }) => request(withQuery('/api/provider/prescriptions/pharmacy-queue', params ? { ...params, controlledOnly: params.controlledOnly == null ? undefined : String(params.controlledOnly) } : {})),
  providerRefillQueueOptions: () => request('/api/provider/prescriptions/refill-queue-options'),
  providerAuditPacketSummary: (limit = 50, location?: string) => request(withQuery('/api/provider/prescriptions/audit-packet-summary', { limit: String(limit), location })),
  providerRefillRequestHistory: (requestId: string) => request(`/api/provider/prescriptions/refill-requests/${requestId}/history`),
  reviewProviderRefillRequest: (requestId: string, payload: { action: 'APPROVE' | 'REJECT' | 'ROUTE_TO_PHARMACY' | 'MARK_FULFILLED'; note?: string; queue?: string }) => request(`/api/provider/prescriptions/refill-requests/${requestId}/review`, { method: 'POST', body: JSON.stringify(payload) }),
  assignProviderRefillRequest: (requestId: string, payload: { assignedRole: 'PROVIDER' | 'PHARMACIST' | 'NURSE'; ownerName?: string; queue?: string; note?: string }) => request(`/api/provider/prescriptions/refill-requests/${requestId}/assign`, { method: 'POST', body: JSON.stringify(payload) }),
  escalateProviderRefillRequest: (requestId: string, payload: { severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'; reason: string; ownerRole?: 'PROVIDER' | 'PHARMACIST' | 'NURSE'; note?: string }) => request(`/api/provider/prescriptions/refill-requests/${requestId}/escalate`, { method: 'POST', body: JSON.stringify(payload) }),
  signProviderPrescription: (prescriptionId: string, note?: string) => request(`/api/provider/prescriptions/items/${prescriptionId}/sign`, { method: 'POST', body: JSON.stringify({ note }) }),

  providerLabsSummary: () => request('/api/provider/labs/summary'),
  providerLabsInbox: (patientId?: string, subjectProfileId?: string) => request(withQuery('/api/provider/labs/inbox', { patientId, subjectProfileId })),
  providerLabResult: (resultId: string) => request(`/api/provider/labs/results/${resultId}`),
  providerLabReleaseReadiness: (resultId: string) => request(`/api/provider/labs/results/${resultId}/release-readiness`),
  secondReviewProviderLabResult: (resultId: string, note?: string) => request(`/api/provider/labs/results/${resultId}/second-review`, { method: 'POST', body: JSON.stringify({ note }) }),
  createProviderLabOrder: (body: Record<string, unknown>) => request('/api/provider/labs/orders', { method: 'POST', body: JSON.stringify(body) }),
  releaseProviderLabResult: (resultId: string, note?: string) => request(`/api/provider/labs/results/${resultId}/release`, { method: 'POST', body: JSON.stringify({ note }) }),

  providerRpmSummary: (location?: string) => request(withQuery('/api/provider/rpm/summary', { location })),
  providerRpmPatients: (location?: string) => request(withQuery('/api/provider/rpm/patients', { location })),
  providerRpmPatient: (patientId: string) => request(`/api/provider/rpm/patients/${patientId}`),
  logProviderRpmOutreach: (patientId: string, note: string, by?: string) => request(`/api/provider/rpm/patients/${patientId}/outreach`, { method: 'POST', body: JSON.stringify({ note, by }) }),
  escalateProviderRpmPatient: (patientId: string, payload: { routeTo: 'PROVIDER_ALERT' | 'SAFETY_CASE'; note: string; severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' }) => request(`/api/provider/rpm/patients/${patientId}/escalate`, { method: 'POST', body: JSON.stringify(payload) }),

  providerAlerts: (status?: string) => request(withQuery('/api/provider/alerts', { status })),
  acknowledgeProviderAlert: (alertId: string, note?: string) => request(`/api/provider/alerts/${alertId}/acknowledge`, { method: 'POST', body: JSON.stringify({ note }) }),
  resolveProviderAlert: (alertId: string, note?: string) => request(`/api/provider/alerts/${alertId}/resolve`, { method: 'POST', body: JSON.stringify({ note }) }),

  providerAnalyticsOverview: (location?: string) => request(withQuery('/api/provider/analytics/overview', { location })),

  providerComplianceSummary: (subjectScope?: 'all' | 'self' | 'family', location?: string) => request(withQuery('/api/provider/analytics/compliance/summary', { subjectScope, location })),
  providerComplianceLogs: (limit = 50, subjectScope?: 'all' | 'self' | 'family', location?: string) => request(withQuery('/api/provider/analytics/compliance/logs', { limit, subjectScope, location })),
  acknowledgeProviderComplianceLog: (auditId: string, note?: string) => request(`/api/provider/analytics/compliance/logs/${auditId}/acknowledge`, { method: 'POST', body: JSON.stringify({ note }) }),
  exportProviderCompliance: async (format: 'csv' | 'json', purpose: string, subjectScope?: 'all' | 'self' | 'family', location?: string) => {
    const query = new URLSearchParams({ format, purpose, ...(subjectScope ? { subjectScope } : {}), ...(location ? { location } : {}) }).toString();
    const response = await fetch(`${API_BASE_URL}/api/provider/analytics/compliance/export?${query}`, {
      credentials: 'include',
      cache: 'no-store',
      headers: {
        ...(getBrowserSession().accessToken ? { Authorization: `Bearer ${getBrowserSession().accessToken}` } : {}),
      },
    });
    const content = await response.text();
    if (!response.ok) {
      if (response.status === 401) {
        clearBrowserSession();
        redirectToProviderSignIn();
      }
      throw new Error(content || `API request failed: ${response.status}`);
    }
    return {
      content,
      filename: `provider-compliance.${format}`,
      contentType: format === 'csv' ? 'text/csv;charset=utf-8' : 'application/json;charset=utf-8',
    };
  },
  providerTeamSummary: () => request('/api/provider/team/summary'),
  providerTeamMembers: () => request('/api/provider/team/members'),
  providerTeamChartAccessExceptions: (status = 'ACTIVE') => request(`/api/provider/team/chart-access-exceptions?status=${encodeURIComponent(status)}`),
  requestProviderTeamChartAccessException: (body: Record<string, unknown>) => request('/api/provider/team/chart-access-exceptions', { method: 'POST', body: JSON.stringify(body) }),
  revokeProviderTeamChartAccessException: (exceptionId: string, note?: string) => request(`/api/provider/team/chart-access-exceptions/${exceptionId}/revoke`, { method: 'POST', body: JSON.stringify({ note }) }),
  providerSettingsSummary: () => request('/api/provider/settings/summary'),
  providerSettingsFacilities: () => request('/api/provider/settings/facilities'),
  providerHspAccess: () => request('/api/access/hsp/me'),
  providerHspConsentGrants: (status: 'ALL' | 'ACTIVE' | 'REVOKED' = 'ALL') => request(`/api/access/hsp/consent-grants?status=${status}`),
  providerSettingsFacility: (facilityId: string) => request(`/api/provider/settings/facilities/${facilityId}`),
  updateProviderSettingsFacility: (facilityId: string, body: Record<string, unknown>) => request(`/api/provider/settings/facilities/${facilityId}`, { method: 'PUT', body: JSON.stringify(body) }),
};
