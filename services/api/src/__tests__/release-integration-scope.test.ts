import { describe, expect, it } from 'vitest';
import {
  integrationAllowedForRuntime,
  isV1IntegrationInScope,
  v1IntegrationScope,
} from '../lib/release-integration-scope';

describe('v1 integration release scope', () => {
  it('keeps only email OTP in the controlled production pilot', () => {
    expect(v1IntegrationScope).toEqual({
      patientEmailOtp: 'IN',
      patientSmsOtp: 'OUT',
      telehealth: 'OUT',
      stripePayments: 'OUT',
      enterpriseSso: 'OUT',
    });
  });

  it('fails closed for OUT integrations in production', () => {
    expect(integrationAllowedForRuntime('patientEmailOtp', true)).toBe(true);
    expect(integrationAllowedForRuntime('patientSmsOtp', true)).toBe(false);
    expect(integrationAllowedForRuntime('telehealth', true)).toBe(false);
    expect(integrationAllowedForRuntime('stripePayments', true)).toBe(false);
    expect(integrationAllowedForRuntime('enterpriseSso', true)).toBe(false);
  });

  it('does not confuse configured development adapters with v1 scope', () => {
    expect(integrationAllowedForRuntime('stripePayments', false)).toBe(true);
    expect(integrationAllowedForRuntime('enterpriseSso', false)).toBe(true);
    expect(isV1IntegrationInScope('stripePayments')).toBe(false);
    expect(isV1IntegrationInScope('enterpriseSso')).toBe(false);
  });
});
