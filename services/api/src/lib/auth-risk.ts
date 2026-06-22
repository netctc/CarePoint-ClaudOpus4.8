import { env } from './env';

export type PrivilegedRiskLevel = 'LOW' | 'MODERATE' | 'HIGH';

export type PrivilegedRiskAssessment = {
  level: PrivilegedRiskLevel;
  reasons: string[];
  requiresAcknowledgement: boolean;
  ssoRecommended: boolean;
  allowedDomains: string[];
};

const ADMIN_ROLES = new Set(['SUPER_ADMIN', 'COMPANY_ADMIN', 'COMPANY_SUPPORT', 'FINANCE']);
const PRIVILEGED_ROLES = new Set(['SUPER_ADMIN', 'COMPANY_ADMIN', 'COMPANY_SUPPORT', 'FINANCE', 'PROVIDER', 'NURSE', 'PHARMACIST', 'LAB_TECH']);

export function getPrivilegedAllowedDomains() {
  return env.privilegedAllowedEmailDomains
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

export function getEmailDomain(email: string) {
  return email.trim().toLowerCase().split('@')[1] ?? '';
}

export function isApprovedPrivilegedDomain(email: string) {
  const allowed = getPrivilegedAllowedDomains();
  if (!allowed.length) return true;
  return allowed.includes(getEmailDomain(email));
}

export function enforceApprovedPrivilegedDomain(email: string) {
  const allowed = getPrivilegedAllowedDomains();
  if (!allowed.length) return;
  if (!isApprovedPrivilegedDomain(email)) {
    throw new Error(`Privileged sign-in is restricted to approved email domains: ${allowed.join(', ')}`);
  }
}

export function buildPrivilegedRiskAssessment(input: {
  email: string;
  role: string;
  managedDevice?: boolean;
  channel?: string;
}) : PrivilegedRiskAssessment {
  const reasons: string[] = [];
  let level: PrivilegedRiskLevel = 'LOW';

  if (!PRIVILEGED_ROLES.has(input.role)) {
    return {
      level,
      reasons,
      requiresAcknowledgement: false,
      ssoRecommended: false,
      allowedDomains: getPrivilegedAllowedDomains(),
    };
  }

  if (ADMIN_ROLES.has(input.role)) {
    level = 'HIGH';
    reasons.push('Administrative and finance roles require heightened verification controls.');
  } else {
    level = 'MODERATE';
    reasons.push('Clinical workforce access should be limited to approved workstations and monitored sessions.');
  }

  if (!input.managedDevice) {
    level = 'HIGH';
    reasons.push('Managed-device confirmation was not supplied.');
  }

  const allowedDomains = getPrivilegedAllowedDomains();
  if (allowedDomains.length && !isApprovedPrivilegedDomain(input.email)) {
    level = 'HIGH';
    reasons.push('The email domain is outside the approved privileged-access list.');
  }

  if ((input.channel ?? '').toLowerCase() !== 'totp') {
    if (level !== 'HIGH') level = 'MODERATE';
    reasons.push('A non-TOTP delivery channel was selected for privileged verification.');
  }

  if (env.ssoEnabled) {
    reasons.push('Enterprise SSO is available and should be preferred for production identity assurance.');
  }

  return {
    level,
    reasons,
    requiresAcknowledgement: true,
    ssoRecommended: env.ssoEnabled,
    allowedDomains,
  };
}
