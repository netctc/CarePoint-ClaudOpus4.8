import * as legacy from './admin-server-legacy';

export * from './admin-server-legacy';

/**
 * Release boundary for Admin data loaders.
 *
 * The legacy implementation intentionally supports mock fallbacks for local
 * development and design review. Production must not silently replace failed
 * API calls with synthetic operational/clinical/financial data. Every exported
 * loader is therefore checked at this boundary and fails closed when it returns
 * `source: "mock"`, unless an operator explicitly opts into mock data outside
 * the controlled go-live configuration.
 */
const allowMockData = process.env.NODE_ENV !== 'production' || process.env.ADMIN_ALLOW_MOCK_DATA === 'true';

async function requireLiveResult<T>(operation: string, promise: Promise<T>): Promise<T> {
  const result = await promise;

  if (!allowMockData && result && typeof result === 'object' && 'source' in result) {
    const tagged = result as { source?: unknown; error?: unknown };
    if (tagged.source === 'mock') {
      const detail = typeof tagged.error === 'string' && tagged.error.trim() ? `: ${tagged.error}` : '';
      throw new Error(`Admin live API data is required in production (${operation})${detail}`);
    }
  }

  return result;
}

type Legacy = typeof legacy;
type Args<K extends keyof Legacy> = Legacy[K] extends (...args: infer A) => unknown ? A : never;
type Result<K extends keyof Legacy> = Legacy[K] extends (...args: never[]) => infer R ? Awaited<R> : never;

export async function loadIntegratedDashboard(...args: Args<'loadIntegratedDashboard'>): Promise<Result<'loadIntegratedDashboard'>> {
  return requireLiveResult('loadIntegratedDashboard', legacy.loadIntegratedDashboard(...args));
}

export async function loadIntegratedProviderDirectory(...args: Args<'loadIntegratedProviderDirectory'>): Promise<Result<'loadIntegratedProviderDirectory'>> {
  return requireLiveResult('loadIntegratedProviderDirectory', legacy.loadIntegratedProviderDirectory(...args));
}

export async function loadIntegratedProviderProfile(...args: Args<'loadIntegratedProviderProfile'>): Promise<Result<'loadIntegratedProviderProfile'>> {
  return requireLiveResult('loadIntegratedProviderProfile', legacy.loadIntegratedProviderProfile(...args));
}

export async function loadIntegratedProviderQueue(...args: Args<'loadIntegratedProviderQueue'>): Promise<Result<'loadIntegratedProviderQueue'>> {
  return requireLiveResult('loadIntegratedProviderQueue', legacy.loadIntegratedProviderQueue(...args));
}

export async function loadIntegratedProviderReview(...args: Args<'loadIntegratedProviderReview'>): Promise<Result<'loadIntegratedProviderReview'>> {
  return requireLiveResult('loadIntegratedProviderReview', legacy.loadIntegratedProviderReview(...args));
}

export async function loadIntegratedAuditLogs(...args: Args<'loadIntegratedAuditLogs'>): Promise<Result<'loadIntegratedAuditLogs'>> {
  return requireLiveResult('loadIntegratedAuditLogs', legacy.loadIntegratedAuditLogs(...args));
}

export async function loadIntegratedPaymentsWorkspace(...args: Args<'loadIntegratedPaymentsWorkspace'>): Promise<Result<'loadIntegratedPaymentsWorkspace'>> {
  return requireLiveResult('loadIntegratedPaymentsWorkspace', legacy.loadIntegratedPaymentsWorkspace(...args));
}

export async function loadIntegratedRefundWorkspace(...args: Args<'loadIntegratedRefundWorkspace'>): Promise<Result<'loadIntegratedRefundWorkspace'>> {
  return requireLiveResult('loadIntegratedRefundWorkspace', legacy.loadIntegratedRefundWorkspace(...args));
}

export async function loadIntegratedRbacWorkspace(...args: Args<'loadIntegratedRbacWorkspace'>): Promise<Result<'loadIntegratedRbacWorkspace'>> {
  return requireLiveResult('loadIntegratedRbacWorkspace', legacy.loadIntegratedRbacWorkspace(...args));
}

export async function loadIntegratedCatalogWorkspace(...args: Args<'loadIntegratedCatalogWorkspace'>): Promise<Result<'loadIntegratedCatalogWorkspace'>> {
  return requireLiveResult('loadIntegratedCatalogWorkspace', legacy.loadIntegratedCatalogWorkspace(...args));
}

export async function loadIntegratedCoverageWorkspace(...args: Args<'loadIntegratedCoverageWorkspace'>): Promise<Result<'loadIntegratedCoverageWorkspace'>> {
  return requireLiveResult('loadIntegratedCoverageWorkspace', legacy.loadIntegratedCoverageWorkspace(...args));
}

export async function loadIntegratedPricingWorkspace(...args: Args<'loadIntegratedPricingWorkspace'>): Promise<Result<'loadIntegratedPricingWorkspace'>> {
  return requireLiveResult('loadIntegratedPricingWorkspace', legacy.loadIntegratedPricingWorkspace(...args));
}

export async function loadIntegratedPolicyWorkspace(...args: Args<'loadIntegratedPolicyWorkspace'>): Promise<Result<'loadIntegratedPolicyWorkspace'>> {
  return requireLiveResult('loadIntegratedPolicyWorkspace', legacy.loadIntegratedPolicyWorkspace(...args));
}

export async function loadIntegratedBookingWorkspace(...args: Args<'loadIntegratedBookingWorkspace'>): Promise<Result<'loadIntegratedBookingWorkspace'>> {
  return requireLiveResult('loadIntegratedBookingWorkspace', legacy.loadIntegratedBookingWorkspace(...args));
}

export async function loadIntegratedTelehealthWorkspace(...args: Args<'loadIntegratedTelehealthWorkspace'>): Promise<Result<'loadIntegratedTelehealthWorkspace'>> {
  return requireLiveResult('loadIntegratedTelehealthWorkspace', legacy.loadIntegratedTelehealthWorkspace(...args));
}

export async function loadIntegratedSupportWorkspace(...args: Args<'loadIntegratedSupportWorkspace'>): Promise<Result<'loadIntegratedSupportWorkspace'>> {
  return requireLiveResult('loadIntegratedSupportWorkspace', legacy.loadIntegratedSupportWorkspace(...args));
}

export async function loadIntegratedSafetyWorkspace(...args: Args<'loadIntegratedSafetyWorkspace'>): Promise<Result<'loadIntegratedSafetyWorkspace'>> {
  return requireLiveResult('loadIntegratedSafetyWorkspace', legacy.loadIntegratedSafetyWorkspace(...args));
}

export async function loadIntegratedReportsWorkspace(...args: Args<'loadIntegratedReportsWorkspace'>): Promise<Result<'loadIntegratedReportsWorkspace'>> {
  return requireLiveResult('loadIntegratedReportsWorkspace', legacy.loadIntegratedReportsWorkspace(...args));
}

export async function loadIntegratedCampaignWorkspace(...args: Args<'loadIntegratedCampaignWorkspace'>): Promise<Result<'loadIntegratedCampaignWorkspace'>> {
  return requireLiveResult('loadIntegratedCampaignWorkspace', legacy.loadIntegratedCampaignWorkspace(...args));
}

export async function loadIntegratedIntegrationsWorkspace(...args: Args<'loadIntegratedIntegrationsWorkspace'>): Promise<Result<'loadIntegratedIntegrationsWorkspace'>> {
  return requireLiveResult('loadIntegratedIntegrationsWorkspace', legacy.loadIntegratedIntegrationsWorkspace(...args));
}

export async function loadIntegratedModerationWorkspace(...args: Args<'loadIntegratedModerationWorkspace'>): Promise<Result<'loadIntegratedModerationWorkspace'>> {
  return requireLiveResult('loadIntegratedModerationWorkspace', legacy.loadIntegratedModerationWorkspace(...args));
}

export async function loadClinicalAccessExceptions(...args: Args<'loadClinicalAccessExceptions'>): Promise<Result<'loadClinicalAccessExceptions'>> {
  return requireLiveResult('loadClinicalAccessExceptions', legacy.loadClinicalAccessExceptions(...args));
}

export async function loadRefillRequests(...args: Args<'loadRefillRequests'>): Promise<Result<'loadRefillRequests'>> {
  return requireLiveResult('loadRefillRequests', legacy.loadRefillRequests(...args));
}

export async function loadRefillOperationalEvents(...args: Args<'loadRefillOperationalEvents'>): Promise<Result<'loadRefillOperationalEvents'>> {
  return requireLiveResult('loadRefillOperationalEvents', legacy.loadRefillOperationalEvents(...args));
}

export async function loadReportDeliveryExecutions(...args: Args<'loadReportDeliveryExecutions'>): Promise<Result<'loadReportDeliveryExecutions'>> {
  return requireLiveResult('loadReportDeliveryExecutions', legacy.loadReportDeliveryExecutions(...args));
}

export async function loadRefillAuditScopeUsage(...args: Args<'loadRefillAuditScopeUsage'>): Promise<Result<'loadRefillAuditScopeUsage'>> {
  return requireLiveResult('loadRefillAuditScopeUsage', legacy.loadRefillAuditScopeUsage(...args));
}

export async function loadReportDeliveryFailures(...args: Args<'loadReportDeliveryFailures'>): Promise<Result<'loadReportDeliveryFailures'>> {
  return requireLiveResult('loadReportDeliveryFailures', legacy.loadReportDeliveryFailures(...args));
}

export async function loadRefillGovernanceWorkspace(...args: Args<'loadRefillGovernanceWorkspace'>): Promise<Result<'loadRefillGovernanceWorkspace'>> {
  return requireLiveResult('loadRefillGovernanceWorkspace', legacy.loadRefillGovernanceWorkspace(...args));
}
