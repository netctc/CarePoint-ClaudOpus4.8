export const v1IntegrationScope = {
  patientEmailOtp: 'IN',
  patientSmsOtp: 'OUT',
  telehealth: 'OUT',
  stripePayments: 'OUT',
  enterpriseSso: 'OUT',
} as const;

export type V1IntegrationKey = keyof typeof v1IntegrationScope;
export type V1IntegrationDecision = (typeof v1IntegrationScope)[V1IntegrationKey];

export function isV1IntegrationInScope(key: V1IntegrationKey) {
  return v1IntegrationScope[key] === 'IN';
}

/**
 * Release integrations are fail-closed in production. Development/test may
 * exercise adapters without changing the approved v1 pilot scope.
 */
export function integrationAllowedForRuntime(key: V1IntegrationKey, isProduction: boolean) {
  return !isProduction || isV1IntegrationInScope(key);
}
