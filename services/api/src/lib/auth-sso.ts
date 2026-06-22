import { randomUUID } from 'crypto';
import { badRequest } from './http';
import { env } from './env';
import { getPrivilegedAllowedDomains } from './auth-risk';

export type SsoRoleHint = 'admin' | 'provider';

export function getSsoConfiguration(roleHint?: string | null) {
  const available = Boolean(env.ssoEnabled && env.ssoAuthorizeUrl && env.ssoClientId && env.ssoCallbackUrl);
  return {
    available,
    providerName: env.ssoProviderName,
    authorizeUrl: env.ssoAuthorizeUrl || null,
    callbackUrl: env.ssoCallbackUrl || null,
    scopes: env.ssoScope.split(/\s+/).filter(Boolean),
    roleHint: roleHint ?? null,
    allowedDomains: getPrivilegedAllowedDomains(),
    note: available
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
    throw badRequest('Enterprise SSO is not configured for this environment.');
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
