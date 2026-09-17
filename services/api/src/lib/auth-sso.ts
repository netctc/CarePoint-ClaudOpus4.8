import { randomUUID } from 'crypto';
import { badRequest } from './http';
import { env } from './env';
import { getPrivilegedAllowedDomains } from './auth-risk';
import { isV1IntegrationInScope } from './release-integration-scope';

export type SsoRoleHint = 'admin' | 'provider';

export function getSsoConfiguration(roleHint?: string | null) {
  const configured = Boolean(env.ssoConfigurationPresent);
  const available = Boolean(env.ssoEnabled && env.ssoAuthorizeUrl && env.ssoClientId && env.ssoCallbackUrl);
  const blockedByV1Scope = env.isProduction && !isV1IntegrationInScope('enterpriseSso');
  return {
    available,
    configured,
    inScope: isV1IntegrationInScope('enterpriseSso'),
    providerName: env.ssoProviderName,
    authorizeUrl: available ? env.ssoAuthorizeUrl || null : null,
    callbackUrl: available ? env.ssoCallbackUrl || null : null,
    scopes: env.ssoScope.split(/\s+/).filter(Boolean),
    roleHint: roleHint ?? null,
    allowedDomains: getPrivilegedAllowedDomains(),
    note: blockedByV1Scope
      ? configured
        ? 'Enterprise SSO configuration is present but SSO is OUT for the v1 production pilot.'
        : 'Enterprise SSO is OUT for the v1 production pilot.'
      : available
        ? 'Enterprise SSO redirect is configured for privileged sign-in handoff.'
        : 'Enterprise SSO is not configured in this environment.',
  };
}

export function buildSsoAuthorizeUrl(input: {
  email?: string | null;
  roleHint?: SsoRoleHint | null;
  returnTo?: string | null;
}) {
  const configuration = getSsoConfiguration(input.roleHint);
  if (!configuration.available || !configuration.authorizeUrl || !configuration.callbackUrl) {
    throw badRequest(env.isProduction && !configuration.inScope
      ? 'Enterprise SSO is not enabled for the v1 production pilot.'
      : 'Enterprise SSO is not configured for this environment.');
  }

  const state = Buffer.from(JSON.stringify({
    nonce: randomUUID(),
    roleHint: input.roleHint ?? null,
    returnTo: input.returnTo ?? null,
    issuedAt: new Date().toISOString(),
  })).toString('base64url');

  const params = new URLSearchParams({
    client_id: env.ssoClientId,
    redirect_uri: configuration.callbackUrl,
    response_type: 'code',
    scope: configuration.scopes.join(' '),
    state,
    prompt: 'login',
  });

  if (input.email?.trim()) {
    params.set('login_hint', input.email.trim().toLowerCase());
  }

  if (input.roleHint) {
    params.set('carepoint_role', input.roleHint);
  }

  return `${configuration.authorizeUrl}?${params.toString()}`;
}
