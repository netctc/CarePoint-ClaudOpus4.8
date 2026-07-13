import { clearBrowserSession, readCookie, redirectToAdminSignIn } from '@/lib/auth/browser-session';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

type ResponseType = 'json' | 'text';

async function request<T>(path: string, init?: RequestInit, responseType: ResponseType = 'json'): Promise<T> {
  const token = readCookie('cc_admin_access_token') ?? readCookie('cc_access_token');
  const locale = readCookie('cc_locale') ?? 'en';
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'x-locale': locale,
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    if (response.status === 401) {
      clearBrowserSession();
      redirectToAdminSignIn();
    }
    throw new Error(text || `API request failed: ${response.status}`);
  }

  if (response.status === 204) return undefined as T;
  if (responseType === 'text') return (await response.text()) as T;
  return response.json() as Promise<T>;
}

export const adminApi = {
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
  dashboard: () => request('/api/dashboard/admin'),
  appointments: () => request('/api/appointments'),
  payments: () => request('/api/payments'),
  paymentSummary: () => request('/api/payments/admin/summary'),
  reconciliation: () => request('/api/payments/reconciliation'),
  refunds: () => request('/api/payments/refunds'),
  holdPayment: (paymentId: string, payload: { reasonCode?: string; note?: string }) =>
    request(`/api/payments/${paymentId}/hold`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  releasePaymentHold: (paymentId: string, payload: { note?: string }) =>
    request(`/api/payments/${paymentId}/release-hold`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  settlePayment: (paymentId: string, payload: { note?: string }) =>
    request(`/api/payments/${paymentId}/settle`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  refundPayment: (paymentId: string, payload: { reasonCode?: string; note?: string; amountMinor?: number }) =>
    request(`/api/payments/${paymentId}/refund`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  threads: () => request('/api/messaging/threads'),
  telehealth: () => request('/api/telehealth/sessions'),
  providers: () => request('/api/providers'),
  provider: (providerId: string) => request(`/api/providers/${providerId}`),
  providerDetail: (providerId: string) => request(`/api/admin/providers/${providerId}`),
  providerQueue: () => request('/api/providers/queue'),
  providerQueueDetail: (providerId: string) => request(`/api/providers/queue/${providerId}`),
  claimQueueItems: (itemIds: string[]) =>
    request<{ success: boolean; data: { items: any[]; claimedCount: number } }>('/api/admin/providers/queue/claim', {
      method: 'POST',
      body: JSON.stringify({ itemIds }),
    }),
  reassignQueueItems: (itemIds: string[], targetUserId: string) =>
    request<{ success: boolean; data: { items: any[]; reassignedCount: number; assignedTo: { id: string; name: string; email: string } } }>('/api/admin/providers/queue/reassign', {
      method: 'POST',
      body: JSON.stringify({ itemIds, targetUserId }),
    }),
  submitProviderReview: (providerId: string, payload: { note?: string }) =>
    request(`/api/providers/queue/${providerId}/submit`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  approveProviderReview: (providerId: string, payload: { note?: string }) =>
    request(`/api/providers/queue/${providerId}/approve`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  requestProviderReviewChanges: (providerId: string, payload: { note?: string; requestedFields?: string[] }) =>
    request(`/api/providers/queue/${providerId}/request-changes`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  rejectProviderReview: (providerId: string, payload: { note?: string; reasonCode?: string }) =>
    request(`/api/providers/queue/${providerId}/reject`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  auditLogs: (limit = 50, subjectScope?: 'all' | 'self' | 'family', location?: string) => request(`/api/audit/logs?${new URLSearchParams({ limit: String(limit), ...(subjectScope ? { subjectScope } : {}), ...(location ? { location } : {}) }).toString()}`),
  auditByResource: (resource: string, resourceId: string) => request(`/api/audit/resources/${resource}/${resourceId}`),
  exportAudit: async (format: 'csv' | 'json', purpose: string, subjectScope?: 'all' | 'self' | 'family', location?: string) => {
    const query = new URLSearchParams({ format, purpose, ...(subjectScope ? { subjectScope } : {}), ...(location ? { location } : {}) }).toString();
    const content = await request<string>(`/api/audit/export?${query}`, undefined, 'text');
    return {
      content,
      filename: `audit-export.${format}`,
      contentType: format === 'csv' ? 'text/csv;charset=utf-8' : 'application/json;charset=utf-8',
    };
  },
  rbacSummary: () => request('/api/access/rbac/summary'),
  rbacRoles: () => request('/api/access/rbac/roles'),
  rbacMatrix: () => request('/api/access/rbac/matrix'),
  rbacAssignments: () => request('/api/access/rbac/assignments'),
  assignRole: (userId: string, payload: { role: string; reason?: string }) =>
    request(`/api/access/rbac/assignments/${userId}/role`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  runAccessReview: (payload: { note?: string }) =>
    request('/api/access/rbac/access-review/run', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  hspOrganizationSummary: () => request('/api/access/hsp/organization-summary'),
  hspConsentGrants: (status: 'ALL' | 'ACTIVE' | 'REVOKED' = 'ALL') => request(`/api/access/hsp/consent-grants?status=${status}`),
  createHspConsentGrant: (payload: { sourceFacilityId: string; targetFacilityId: string; scope: 'LIMITED' | 'FULL'; domains: string[]; note?: string }) =>
    request('/api/access/hsp/consent-grants', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  revokeHspConsentGrant: (grantId: string, payload?: { note?: string }) =>
    request(`/api/access/hsp/consent-grants/${grantId}/revoke`, {
      method: 'POST',
      body: JSON.stringify(payload ?? {}),
    }),

  catalogSummary: () => request('/api/catalog/summary'),
  catalogServices: () => request('/api/catalog/services'),
  publishCatalogService: (serviceId: string, payload: { note?: string }) =>
    request(`/api/catalog/services/${serviceId}/publish`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  archiveCatalogService: (serviceId: string, payload: { note?: string }) =>
    request(`/api/catalog/services/${serviceId}/archive`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  coverageSummary: () => request('/api/coverage/summary'),
  coverageRules: () => request('/api/coverage/rules'),
  updateCoverageRule: (ruleId: string, payload: Record<string, unknown>) =>
    request(`/api/coverage/rules/${ruleId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  activateCoverageRule: (ruleId: string, payload: { note?: string }) =>
    request(`/api/coverage/rules/${ruleId}/activate`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  deactivateCoverageRule: (ruleId: string, payload: { note?: string }) =>
    request(`/api/coverage/rules/${ruleId}/deactivate`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  pricingSummary: () => request('/api/pricing/summary'),
  pricingRules: () => request('/api/pricing/rules'),
  publishPricingRule: (ruleId: string, payload: { note?: string }) =>
    request(`/api/pricing/rules/${ruleId}/publish`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  simulatePricingRule: (payload: { serviceCode: string; amountMinor: number }) =>
    request('/api/pricing/simulations', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  policiesSummary: () => request('/api/policies/summary'),
  policyTemplates: () => request('/api/policies/templates'),
  publishPolicyTemplate: (templateId: string, payload: { note?: string }) =>
    request(`/api/policies/templates/${templateId}/publish`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  archivePolicyTemplate: (templateId: string, payload: { note?: string }) =>
    request(`/api/policies/templates/${templateId}/archive`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  bookingSummary: () => request('/api/bookings/summary'),
  bookingControlTower: () => request('/api/bookings/control-tower'),
  bookingControlDetail: (appointmentId: string) => request(`/api/bookings/control-tower/${appointmentId}`),
  bookingControlOptions: () => request('/api/bookings/control-tower/options'),
  bookingAuthorizationReview: (appointmentId: string) => request(`/api/bookings/control-tower/${appointmentId}/authorization-review`),
  reviewBookingAuthorization: (appointmentId: string, payload: { decision: 'APPROVED' | 'REJECTED'; note: string }) =>
    request(`/api/bookings/control-tower/${appointmentId}/authorization-review`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  bookingControlHolds: (limit = 25) => request(`/api/bookings/control-tower/holds?limit=${limit}`),
  bookingOverridePreview: (appointmentId: string, params: { providerId?: string; startsAt?: string; endsAt?: string }) => {
    const query = new URLSearchParams();
    if (params.providerId) query.set('providerId', params.providerId);
    if (params.startsAt) query.set('startsAt', params.startsAt);
    if (params.endsAt) query.set('endsAt', params.endsAt);
    const suffix = query.toString();
    return request(`/api/bookings/control-tower/${appointmentId}/override-preview${suffix ? `?${suffix}` : ''}`);
  },
  reassignBookingProvider: (appointmentId: string, payload: { providerId: string; note?: string; reasonCode?: string }) =>
    request(`/api/bookings/control-tower/${appointmentId}/reassign-provider`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  rescheduleBooking: (appointmentId: string, payload: { startsAt: string; endsAt: string; note?: string; reasonCode?: string }) =>
    request(`/api/bookings/control-tower/${appointmentId}/reschedule`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  markBookingNoShow: (appointmentId: string, payload: { note?: string }) =>
    request(`/api/bookings/control-tower/${appointmentId}/mark-no-show`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  escalateBooking: (appointmentId: string, payload: { reasonCode: string; ownerRole?: string; note?: string }) =>
    request(`/api/bookings/control-tower/${appointmentId}/escalate`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  extendBookingHold: (holdId: string, payload: { extendMinutes?: number; note?: string }) =>
    request(`/api/bookings/control-tower/holds/${holdId}/extend`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  releaseBookingHold: (holdId: string, payload: { note?: string }) =>
    request(`/api/bookings/control-tower/holds/${holdId}/release`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  telehealthOpsSummary: () => request('/api/telehealth/operations/summary'),
  telehealthOpsSessions: () => request('/api/telehealth/operations/sessions'),
  telehealthOpsSessionDetail: (sessionId: string) => request(`/api/telehealth/operations/sessions/${sessionId}`),
  markTelehealthSessionLive: (sessionId: string) =>
    request(`/api/telehealth/operations/sessions/${sessionId}/mark-live`, {
      method: 'POST',
    }),
  endTelehealthOpsSession: (sessionId: string) =>
    request(`/api/telehealth/operations/sessions/${sessionId}/end`, {
      method: 'POST',
    }),
  restartTelehealthRoom: (sessionId: string) =>
    request(`/api/telehealth/operations/sessions/${sessionId}/restart-room`, {
      method: 'POST',
    }),
  escalateTelehealthSession: (sessionId: string, payload: { severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'; reasonCode: string; note?: string }) =>
    request(`/api/telehealth/operations/sessions/${sessionId}/escalate`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  supportSummary: () => request('/api/support/summary'),
  supportWorkItems: () => request('/api/support/work-items'),
  supportWorkItemDetail: (itemId: string) => request(`/api/support/work-items/${itemId}`),
  assignSupportWorkItem: (itemId: string, payload: { assigneeUserId?: string; assigneeName: string; note?: string }) =>
    request(`/api/support/work-items/${itemId}/assign`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  escalateSupportWorkItem: (itemId: string, payload: { queue: string; note?: string }) =>
    request(`/api/support/work-items/${itemId}/escalate`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  resolveSupportWorkItem: (itemId: string, payload: { resolutionCode: string; note?: string }) =>
    request(`/api/support/work-items/${itemId}/resolve`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  safetySummary: () => request('/api/safety/summary'),
  safetyCases: () => request('/api/safety/cases'),
  safetyCaseDetail: (caseId: string) => request(`/api/safety/cases/${caseId}`),
  triageSafetyCase: (caseId: string, payload: { severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'; ownerName?: string; note?: string }) =>
    request(`/api/safety/cases/${caseId}/triage`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  requireSafetyAction: (caseId: string, payload: { actionPlan: string; note?: string }) =>
    request(`/api/safety/cases/${caseId}/action-required`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  closeSafetyCase: (caseId: string, payload: { closureCode: string; note?: string }) =>
    request(`/api/safety/cases/${caseId}/close`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  reportsSummary: () => request('/api/reports/summary'),
  reportDefinitions: () => request('/api/reports/definitions'),
  reportDefinitionDetail: (reportId: string) => request(`/api/reports/definitions/${reportId}`),
  publishReportDefinition: (reportId: string, payload: { note?: string }) =>
    request(`/api/reports/definitions/${reportId}/publish`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  archiveReportDefinition: (reportId: string, payload: { note?: string }) =>
    request(`/api/reports/definitions/${reportId}/archive`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  runReportDefinition: (reportId: string, payload: { range?: string; subjectScope?: 'all' | 'self' | 'family'; note?: string }) =>
    request(`/api/reports/definitions/${reportId}/run`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  reportPresets: () => request('/api/reports/presets'),
  savedReportPresets: () => request('/api/reports/saved-presets'),
  saveReportPreset: (payload: { title: string; description?: string; reportId?: string; metricKeys?: string[]; format?: 'csv' | 'json'; range?: string; sourcePresetId?: string; subjectScope?: 'all' | 'self' | 'family'; note?: string }) =>
    request('/api/reports/saved-presets', { method: 'POST', body: JSON.stringify(payload) }),
  reportDeliverySchedules: () => request('/api/reports/delivery-schedules'),
  createReportDeliverySchedule: (payload: { title: string; presetId?: string; reportId?: string; destination: string; schedule: string; format?: 'csv' | 'json'; range?: string; subjectScope?: 'all' | 'self' | 'family'; note?: string }) =>
    request('/api/reports/delivery-schedules', { method: 'POST', body: JSON.stringify(payload) }),
  exportReportDeliveryExecutions: async (payload: { format: 'csv' | 'json'; limit?: number; scheduleId?: string }) => {
    const query = new URLSearchParams();
    query.set('format', payload.format);
    if (payload.limit != null) query.set('limit', String(payload.limit));
    if (payload.scheduleId) query.set('scheduleId', payload.scheduleId);
    const content = await request<string>(`/api/reports/delivery-executions/export?${query.toString()}`, {}, 'text');
    return {
      content,
      filename: `report-delivery-executions.${payload.format}`,
      contentType: payload.format === 'csv' ? 'text/csv;charset=utf-8' : 'application/json;charset=utf-8',
    };
  },
  refillOperationalEvents: (limit = 20) => request(`/api/records/refill-operational-events?limit=${limit}`),
  refillAuditScopes: () => request('/api/records/refill-audit-scopes'),
  createRefillAuditScope: (payload: { title: string; note?: string; limit?: number; queue?: string; assignedRole?: 'PROVIDER' | 'PHARMACIST' | 'NURSE'; controlledOnly?: boolean; escalatedOnly?: boolean; includeExecutions?: boolean; includeOperationalEvents?: boolean }) =>
    request('/api/records/refill-audit-scopes', { method: 'POST', body: JSON.stringify(payload) }),
  refillAuditPacketSummary: (scopeId?: string) => request(`/api/records/refill-audit-packet/summary${scopeId ? `?scopeId=${encodeURIComponent(scopeId)}` : ''}`),
  exportRefillAuditPacket: async (payload: { format: 'csv' | 'json'; limit?: number; scopeId?: string }) => {
    const query = new URLSearchParams();
    query.set('format', payload.format);
    if (payload.limit != null) query.set('limit', String(payload.limit));
    if (payload.scopeId) query.set('scopeId', payload.scopeId);
    const content = await request<string>(`/api/records/refill-audit-packet?${query.toString()}`, {}, 'text');
    return {
      content,
      filename: `refill-audit-packet.${payload.format}`,
      contentType: payload.format === 'csv' ? 'text/csv;charset=utf-8' : 'application/json;charset=utf-8',
    };
  },
  exportReportDefinition: async (reportId: string, payload: { format: 'csv' | 'json'; range?: string; preset?: string; subjectScope?: 'all' | 'self' | 'family'; note?: string }) => {
    const content = await request<string>(`/api/reports/definitions/${reportId}/export`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }, 'text');
    return {
      content,
      filename: `report-${reportId}.${payload.format}`,
      contentType: payload.format === 'csv' ? 'text/csv;charset=utf-8' : 'application/json;charset=utf-8',
    };
  },

  campaignsSummary: () => request('/api/campaigns/summary'),
  campaigns: () => request('/api/campaigns'),
  campaignDetail: (campaignId: string) => request(`/api/campaigns/${campaignId}`),
  approveCampaign: (campaignId: string, payload: { note?: string }) =>
    request(`/api/campaigns/${campaignId}/approve`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  scheduleCampaign: (campaignId: string, payload: { scheduledFor: string; note?: string }) =>
    request(`/api/campaigns/${campaignId}/schedule`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  pauseCampaign: (campaignId: string, payload: { note?: string }) =>
    request(`/api/campaigns/${campaignId}/pause`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  integrationsSummary: () => request('/api/integrations/summary'),
  integrations: () => request('/api/integrations'),
  integrationDetail: (integrationId: string) => request(`/api/integrations/${integrationId}`),
  rotateIntegrationSecret: (integrationId: string, payload: { note?: string }) =>
    request(`/api/integrations/${integrationId}/rotate-secret`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  disableIntegration: (integrationId: string, payload: { note?: string }) =>
    request(`/api/integrations/${integrationId}/disable`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  moderationSummary: () => request('/api/moderation/summary'),
  iamUsers: (query: string) => request(`/api/admin/users/iam-users?${query}`),
  iamCreateUser: (payload: Record<string, string>) =>
    request('/api/admin/users/iam-users', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  iamUpdateUserStatus: (userId: string, payload: Record<string, string>) =>
    request(`/api/admin/users/iam-users/${userId}/status`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  iamInvitations: (query: string) => request(`/api/iam/invitations?${query}`),
  iamCreateInvitation: (payload: { email: string; role: string; expiresInHours: number }) =>
    request('/api/iam/invitations', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  iamRevokeInvitation: (id: string) =>
    request(`/api/iam/invitations/${id}/revoke`, {
      method: 'PATCH',
    }),
  iamAccessReview: () => request('/api/iam/access-review'),
  iamCreateAppointment: (providerId: string, payload: { patientId: string; service: string; location: string; startsAt: string; endsAt: string }) =>
    request(`/api/iam/schedules/${providerId}/appointments`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  iamRescheduleAppointment: (appointmentId: string, payload: { startsAt: string; endsAt: string }) =>
    request(`/api/iam/schedules/appointments/${appointmentId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  iamCancelAppointment: (appointmentId: string, payload: { reason: string }) =>
    request(`/api/iam/schedules/appointments/${appointmentId}/cancel`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  iamAuditLogs: (query: string) => request(`/api/admin/audit?${query}`),
  iamAuditDetail: (id: string) => request(`/api/admin/audit/${id}`),
  iamAuditExport: (query: string) =>
    request<string>(`/api/admin/audit/export?${query}`, { method: 'POST' }, 'text').then((content) => ({
      content,
      filename: `audit-export.${new URLSearchParams(query).get('format') || 'json'}`,
    })),
  // Admin Booking Control
  adminBookings: (params?: Record<string, string>) => {
    const query = params ? `?${new URLSearchParams(params).toString()}` : '';
    return request(`/api/admin/bookings${query}`);
  },
  adminBookingBulkNotify: (bookingIds: string[], message?: string) =>
    request('/api/admin/bookings/bulk-notify', {
      method: 'POST',
      body: JSON.stringify({ bookingIds, message }),
    }),
  adminBookingReassign: (id: string, payload: { providerId: string; reason?: string }) =>
    request(`/api/admin/bookings/${id}/reassign`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  adminBookingCancel: (id: string, payload: { reason: string }) =>
    request(`/api/admin/bookings/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  adminBookingRefundReview: (id: string) =>
    request(`/api/admin/bookings/${id}/refund-review`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),

  // Admin Telehealth Operations
  adminTelehealthMetrics: () => request('/api/admin/telehealth/metrics'),
  adminTelehealthSessions: (params?: Record<string, string>) => {
    const query = params ? `?${new URLSearchParams(params).toString()}` : '';
    return request(`/api/admin/telehealth/sessions${query}`);
  },
  adminTelehealthEscalate: (id: string, payload: { severity?: string; reason?: string }) =>
    request(`/api/admin/telehealth/incidents/${id}/escalate`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  moderationReviews: () => request('/api/moderation/reviews'),
  moderationReviewDetail: (reviewId: string) => request(`/api/moderation/reviews/${reviewId}`),
  assignModerationReview: (reviewId: string, payload: { reviewerUserId: string; ownerName: string; note?: string }) =>
    request(`/api/moderation/reviews/${reviewId}/assign`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  escalateModerationReview: (reviewId: string, payload: { queue: string; note?: string }) =>
    request(`/api/moderation/reviews/${reviewId}/escalate`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  resolveModerationReview: (reviewId: string, payload: { disposition: string; note?: string }) =>
    request(`/api/moderation/reviews/${reviewId}/resolve`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

};
