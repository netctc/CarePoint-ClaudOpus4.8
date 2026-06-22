import { forbidden } from './http';
import { prisma } from './prisma';
import { getActiveHspConsentGrants } from './hsp-consent-store';
export const hspAccountModels = ['INDIVIDUAL', 'INSTITUTIONAL', 'ORGANIZATION_BASED'] as const;
export type HspAccountModel = (typeof hspAccountModels)[number];

export const hspAccessScopes = ['OWN_PROFILE_ONLY', 'PRIMARY_FACILITY', 'CONSENTED_FACILITIES', 'ORGANIZATION_WIDE'] as const;
export type HspAccessScope = (typeof hspAccessScopes)[number];

export const hspConsentScopes = ['NONE', 'LIMITED', 'FULL'] as const;
export type HspConsentScope = (typeof hspConsentScopes)[number];

export type HspFacility = {
  id: string;
  name: string;
  city: string;
  kind: 'CLINIC' | 'HOSPITAL' | 'DIAGNOSTIC' | 'VIRTUAL';
};

export type HspAccessSummary = {
  organizationId: string | null;
  consentGrantsCount: number;
  grantedDomains: HspDataDomain[];
  enforcementStatusByDomain: Record<string, 'PRIMARY_ONLY' | 'CONSENT_REQUIRED' | 'GRANTED'>;
  accountModel: HspAccountModel;
  accountModelLabel: string;
  accessScope: HspAccessScope;
  accessScopeLabel: string;
  consentScope: HspConsentScope;
  consentScopeLabel: string;
  linkedOrganization: boolean;
  linkedOrganizationRequired: boolean;
  organizationName: string | null;
  primaryFacility: HspFacility | null;
  assignedFacilities: HspFacility[];
  consentedFacilities: HspFacility[];
  restrictions: string[];
  canAccessOrganizationData: boolean;
  canAccessExternalFacilityData: boolean;
  summaryText: string;
};

export type HspRequestedFields = {
  hspModel?: HspAccountModel | string | null;
  primaryFacility?: string | null;
  crossFacilityAccess?: HspConsentScope | string | null;
  facilityAccessNote?: string | null;
};

export function normalizeHspAccountModel(value: unknown, fallback: HspAccountModel = 'INDIVIDUAL'): HspAccountModel {
  const input = String(value ?? '').trim().toUpperCase();
  if (input === 'INDIVIDUAL' || input === 'INSTITUTIONAL' || input === 'ORGANIZATION_BASED') return input;
  return fallback;
}

export function normalizeHspConsentScope(value: unknown, fallback: HspConsentScope = 'NONE'): HspConsentScope {
  const input = String(value ?? '').trim().toUpperCase();
  if (input === 'NONE' || input === 'LIMITED' || input === 'FULL') return input;
  return fallback;
}

export function labelForAccountModel(model: HspAccountModel) {
  switch (model) {
    case 'INDIVIDUAL':
      return 'Individual HSP';
    case 'INSTITUTIONAL':
      return 'Institutional HSP';
    case 'ORGANIZATION_BASED':
      return 'Organization-based HSP';
  }
}

export function labelForAccessScope(scope: HspAccessScope) {
  switch (scope) {
    case 'OWN_PROFILE_ONLY':
      return 'Own profile only';
    case 'PRIMARY_FACILITY':
      return 'Primary facility only';
    case 'CONSENTED_FACILITIES':
      return 'Primary and consented facilities';
    case 'ORGANIZATION_WIDE':
      return 'Organization-wide';
  }
}

export function labelForConsentScope(scope: HspConsentScope) {
  switch (scope) {
    case 'NONE':
      return 'No external facility access';
    case 'LIMITED':
      return 'Limited external facility access';
    case 'FULL':
      return 'Full external facility access';
  }
}

export function deriveDefaultHspModel(organizationName?: string | null): HspAccountModel {
  const name = String(organizationName ?? '').trim().toLowerCase();
  if (!name) return 'INDIVIDUAL';
  if (/(group|network|organization|system|holding)/.test(name)) return 'ORGANIZATION_BASED';
  if (/(hospital|center|centre|clinic|medical|diagnostic|care)/.test(name)) return 'INSTITUTIONAL';
  return 'INDIVIDUAL';
}

function facilityKindForName(name: string): HspFacility['kind'] {
  const lower = name.toLowerCase();
  if (lower.includes('virtual')) return 'VIRTUAL';
  if (lower.includes('lab') || lower.includes('diagnostic')) return 'DIAGNOSTIC';
  if (lower.includes('hospital')) return 'HOSPITAL';
  return 'CLINIC';
}

export function deriveDefaultFacilities(organizationId?: string | null, organizationName?: string | null, requestedPrimaryFacility?: string | null): HspFacility[] {
  const safeOrg = String(organizationId ?? 'org').replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase() || 'org';
  const orgLabel = String(organizationName ?? 'CarePoint').trim() || 'CarePoint';
  const basePrefix = orgLabel.replace(/\s+/g, ' ').trim();
  const primaryName = String(requestedPrimaryFacility ?? '').trim() || `${basePrefix} Main Clinic`;
  const facilities: HspFacility[] = [
    { id: `${safeOrg}-main`, name: primaryName, city: 'Riyadh', kind: facilityKindForName(primaryName) },
    { id: `${safeOrg}-virtual`, name: `${basePrefix} Virtual Care`, city: 'Remote', kind: 'VIRTUAL' },
  ];

  if (deriveDefaultHspModel(organizationName) === 'ORGANIZATION_BASED') {
    facilities.splice(1, 0,
      { id: `${safeOrg}-north`, name: `${basePrefix} North Branch`, city: 'Riyadh', kind: 'CLINIC' },
      { id: `${safeOrg}-diagnostics`, name: `${basePrefix} Diagnostics Center`, city: 'Jeddah', kind: 'DIAGNOSTIC' },
    );
  }

  return facilities;
}


export const hspDataDomains = ['CALENDAR', 'LABS', 'PRESCRIPTIONS', 'RECORDS', 'ANALYTICS', 'RPM', 'ORDERS', 'ALL'] as const;
export type HspDataDomain = (typeof hspDataDomains)[number];

function normalizeDomain(value: unknown): HspDataDomain | null {
  const normalized = String(value ?? '').trim().toUpperCase().replace(/[^A-Z]/g, '_');
  if (!normalized) return null;
  if (normalized === 'ALL') return 'ALL';
  if (normalized.includes('CALENDAR') || normalized.includes('SCHEDULE')) return 'CALENDAR';
  if (normalized.includes('LAB')) return 'LABS';
  if (normalized.includes('PRESCRIPTION') || normalized.includes('PHARMACY') || normalized.includes('REFILL')) return 'PRESCRIPTIONS';
  if (normalized.includes('RECORD') || normalized.includes('CHART')) return 'RECORDS';
  if (normalized.includes('ANALYTIC') || normalized.includes('DASHBOARD') || normalized.includes('REPORT')) return 'ANALYTICS';
  if (normalized.includes('RPM') || normalized.includes('REMOTE')) return 'RPM';
  if (normalized.includes('ORDER')) return 'ORDERS';
  return null;
}

export function getAllowedHspFacilities(summary: HspAccessSummary) {
  const map = new Map<string, HspFacility>();
  for (const facility of [...summary.assignedFacilities, ...summary.consentedFacilities]) {
    map.set(facility.id, facility);
  }
  return Array.from(map.values());
}

function normalizeLocationText(value: unknown) {
  return String(value ?? '').trim().toLowerCase();
}

export function isLocationWithinHspAccess(summary: HspAccessSummary, location?: string | null) {
  const normalizedLocation = normalizeLocationText(location);
  if (!normalizedLocation) return true;
  if (summary.accessScope === 'ORGANIZATION_WIDE') return true;
  const facilities = getAllowedHspFacilities(summary);
  if (facilities.length === 0) return false;
  return facilities.some((facility) => {
    const facilityName = normalizeLocationText(facility.name);
    const facilityCity = normalizeLocationText(facility.city);
    return normalizedLocation === facilityName || normalizedLocation.includes(facilityName) || (!!facilityCity && normalizedLocation.includes(facilityCity)) || (facility.kind === 'VIRTUAL' && normalizedLocation.includes('virtual'));
  });
}

export function filterItemsByHspFacility<T>(summary: HspAccessSummary, items: T[], selector: (item: T) => string | null | undefined): T[] {
  return items.filter((item) => isLocationWithinHspAccess(summary, selector(item)));
}

export function requireLocationWithinHspAccess(summary: HspAccessSummary, location: string | null | undefined, label: string = 'Requested location') {
  if (!isLocationWithinHspAccess(summary, location)) {
    throw forbidden(`${label} is outside the active HSP facility access scope. Explicit inter-center consent is required before this facility can be accessed.`);
  }
}

export function getGrantedHspDomains(summary: HspAccessSummary): HspDataDomain[] {
  if (summary.accessScope === 'ORGANIZATION_WIDE') return ['ALL'];
  if (!summary.organizationId || !summary.primaryFacility) return [];
  const grants = getActiveHspConsentGrants(summary.organizationId, summary.primaryFacility.id);
  if (grants.some((grant) => String(grant.scope).toUpperCase() === 'FULL')) return ['ALL'];
  const domains = Array.from(new Set(grants.flatMap((grant) => Array.isArray(grant.domains) ? grant.domains : []).map((value) => normalizeDomain(value)).filter(Boolean) as HspDataDomain[]));
  return domains;
}

export function getMatchingHspFacility(summary: HspAccessSummary, location?: string | null) {
  const normalizedLocation = normalizeLocationText(location);
  if (!normalizedLocation) return null;
  const facilities = getAllowedHspFacilities(summary);
  return facilities.find((facility) => {
    const facilityName = normalizeLocationText(facility.name);
    const facilityCity = normalizeLocationText(facility.city);
    return normalizedLocation === facilityName || normalizedLocation.includes(facilityName) || (!!facilityCity && normalizedLocation.includes(facilityCity)) || (facility.kind === 'VIRTUAL' && normalizedLocation.includes('virtual'));
  }) ?? null;
}

export function isExternalHspLocation(summary: HspAccessSummary, location?: string | null) {
  const matched = getMatchingHspFacility(summary, location);
  if (!matched) return false;
  return summary.consentedFacilities.some((facility) => facility.id === matched.id) && !summary.assignedFacilities.some((facility) => facility.id === matched.id);
}

export function canAccessDomainForLocation(summary: HspAccessSummary, domain: HspDataDomain, location?: string | null) {
  if (!isLocationWithinHspAccess(summary, location)) return false;
  if (!isExternalHspLocation(summary, location)) return true;
  return hasExternalHspDomainAccess(summary, domain);
}

export function filterItemsByHspDomain<T>(summary: HspAccessSummary, domain: HspDataDomain, items: T[], selector: (item: T) => string | null | undefined): T[] {
  return items.filter((item) => canAccessDomainForLocation(summary, domain, selector(item)));
}

export function normalizeRequestedHspLocation(value: unknown) {
  const normalized = normalizeLocationText(value);
  return normalized || null;
}

export function matchesRequestedHspLocation(location: string | null | undefined, requestedLocation: string | null | undefined) {
  const normalizedLocation = normalizeLocationText(location);
  const normalizedRequested = normalizeLocationText(requestedLocation);
  if (!normalizedRequested) return true;
  if (!normalizedLocation) return false;
  return normalizedLocation === normalizedRequested || normalizedLocation.includes(normalizedRequested) || normalizedRequested.includes(normalizedLocation);
}

export function filterItemsByHspDomainAndLocation<T>(summary: HspAccessSummary, domain: HspDataDomain, items: T[], selector: (item: T) => string | null | undefined, requestedLocation?: string | null) {
  if (!requestedLocation) return filterItemsByHspDomain(summary, domain, items, selector);
  requireDomainScopedHspLocationAccess(summary, domain, requestedLocation, 'Requested facility filter');
  return filterItemsByHspDomain(summary, domain, items, selector).filter((item) => matchesRequestedHspLocation(selector(item), requestedLocation));
}

export function summarizeHspItemsByFacility<T>(summary: HspAccessSummary, domain: HspDataDomain, items: T[], selector: (item: T) => string | null | undefined) {
  const scopedItems = filterItemsByHspDomain(summary, domain, items, selector);
  const counts = new Map<string, { location: string; count: number; facilityId: string | null; external: boolean }>();
  for (const item of scopedItems) {
    const location = selector(item);
    const facility = getMatchingHspFacility(summary, location);
    const key = facility?.id ?? normalizeLocationText(location) ?? 'unassigned';
    const current = counts.get(key) ?? { location: facility?.name ?? String(location ?? 'Unassigned'), count: 0, facilityId: facility?.id ?? null, external: facility ? isExternalHspLocation(summary, facility.name) : false };
    current.count += 1;
    counts.set(key, current);
  }
  return Array.from(counts.values()).sort((left, right) => right.count - left.count || left.location.localeCompare(right.location));
}

export function requireDomainScopedHspLocationAccess(summary: HspAccessSummary, domain: HspDataDomain, location: string | null | undefined, label: string = 'Requested location') {
  requireLocationWithinHspAccess(summary, location, label);
  if (isExternalHspLocation(summary, location)) {
    requireExternalHspDomainAccess(summary, domain, `${label} is within a consented facility, but ${domain.toLowerCase()} access is not granted for that external location.`);
  }
}

export function hasExternalHspDomainAccess(summary: HspAccessSummary, domain: HspDataDomain) {
  if (summary.accessScope === 'ORGANIZATION_WIDE') return true;
  if (!summary.linkedOrganization || summary.accountModel !== 'ORGANIZATION_BASED') return false;
  const domains = getGrantedHspDomains(summary);
  return domains.includes('ALL') || domains.includes(domain);
}

export function requireExternalHspDomainAccess(summary: HspAccessSummary, domain: HspDataDomain, message?: string) {
  if (!hasExternalHspDomainAccess(summary, domain)) {
    throw forbidden(message ?? `Cross-facility ${domain.toLowerCase()} access is blocked until an active HSP consent grant authorizes this data domain.`);
  }
}

export async function getProviderRequestedHspFields(providerProfileId?: string | null, organizationId?: string | null): Promise<HspRequestedFields | null> {
  const providerId = String(providerProfileId ?? '').trim();
  if (!providerId) return null;
  const item = await prisma.providerOnboardingState.findUnique({
    where: { providerId },
    select: { organizationId: true, requestedFields: true },
  }).catch(() => null);
  if (!item) return null;
  if (organizationId && item.organizationId && item.organizationId !== organizationId) return null;
  if (item.requestedFields && typeof item.requestedFields === 'object') {
    return item.requestedFields as HspRequestedFields;
  }
  return null;
}

export async function resolveHspAccessForProvider(input: {
  providerProfileId?: string | null;
  organizationId?: string | null;
  organizationName?: string | null;
  role?: string | null;
}) {
  const requestedFields = await getProviderRequestedHspFields(input.providerProfileId, input.organizationId);
  return buildHspAccessSummary({
    organizationId: input.organizationId,
    organizationName: input.organizationName,
    role: input.role,
    requestedFields,
  });
}

export function buildHspAccessSummary(input: {
  organizationId?: string | null;
  organizationName?: string | null;
  role?: string | null;
  requestedFields?: HspRequestedFields | null;
}): HspAccessSummary {
  const linkedOrganization = Boolean(String(input.organizationId ?? '').trim());
  const requested = input.requestedFields ?? {};
  const accountModel = normalizeHspAccountModel(requested.hspModel, deriveDefaultHspModel(input.organizationName));
  const consentScope = normalizeHspConsentScope(requested.crossFacilityAccess, accountModel === 'ORGANIZATION_BASED' ? 'LIMITED' : 'NONE');
  const facilities = deriveDefaultFacilities(input.organizationId, input.organizationName, requested.primaryFacility ?? null);
  const primaryFacility = facilities[0] ?? null;
  const storedConsentGrants = linkedOrganization && primaryFacility
    ? getActiveHspConsentGrants(String(input.organizationId), primaryFacility.id)
    : [];

  let assignedFacilities = primaryFacility ? [primaryFacility] : [];
  let consentedFacilities: HspFacility[] = [];
  let accessScope: HspAccessScope = linkedOrganization ? 'PRIMARY_FACILITY' : 'OWN_PROFILE_ONLY';

  const upperRole = String(input.role ?? '').trim().toUpperCase();
  const isPrivilegedOrgRole = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'COMPANY_SUPPORT'].includes(upperRole);

  if (linkedOrganization && isPrivilegedOrgRole) {
    assignedFacilities = facilities;
    accessScope = 'ORGANIZATION_WIDE';
  } else if (linkedOrganization && accountModel === 'ORGANIZATION_BASED') {
    if (storedConsentGrants.length > 0) {
      consentedFacilities = storedConsentGrants
        .map((grant) => facilities.find((facility) => facility.id === grant.targetFacilityId))
        .filter(Boolean) as HspFacility[];
    } else {
      consentedFacilities = [];
    }
    accessScope = consentedFacilities.length ? 'CONSENTED_FACILITIES' : 'PRIMARY_FACILITY';
  }

  const restrictions: string[] = [];
  if (!linkedOrganization) {
    restrictions.push('This account is not linked to an organization, so organization data must remain blocked until the linkage is approved.');
  }
  if (linkedOrganization && consentScope === 'NONE' && accountModel === 'ORGANIZATION_BASED') {
    restrictions.push('Cross-center access is blocked until explicit consent is recorded between facilities.');
  }
  if (linkedOrganization && consentScope === 'LIMITED') {
    restrictions.push('External facility access is limited to the explicitly consented data domains configured by the organization.');
  }
  if (linkedOrganization && storedConsentGrants.length === 0 && accountModel === 'ORGANIZATION_BASED' && consentScope !== 'NONE') {
    restrictions.push('No active cross-facility consent grants are recorded yet, so fallback facility access should be treated as provisional until governance approval is captured.');
  }
  if (linkedOrganization && accountModel === 'INDIVIDUAL') {
    restrictions.push('This account should operate through a single personal account and only the assigned facility data should be available.');
  }

  const grantedDomains: HspDataDomain[] = accessScope === 'ORGANIZATION_WIDE'
    ? ['ALL']
    : storedConsentGrants.some((grant) => String(grant.scope).toUpperCase() === 'FULL')
      ? ['ALL']
      : Array.from(new Set(storedConsentGrants.flatMap((grant) => Array.isArray(grant.domains) ? grant.domains : []).map((value) => normalizeDomain(value)).filter(Boolean) as HspDataDomain[]));

  const enforcementStatusByDomain = Object.fromEntries(
    hspDataDomains
      .filter((domain) => domain !== 'ALL')
      .map((domain) => {
        if (accessScope === 'ORGANIZATION_WIDE') return [domain, 'GRANTED'];
        if (!linkedOrganization || accountModel !== 'ORGANIZATION_BASED') return [domain, 'PRIMARY_ONLY'];
        if (grantedDomains.includes('ALL') || grantedDomains.includes(domain)) return [domain, consentedFacilities.length ? 'GRANTED' : 'PRIMARY_ONLY'];
        return [domain, consentScope === 'NONE' ? 'PRIMARY_ONLY' : 'CONSENT_REQUIRED'];
      }),
  ) as Record<string, 'PRIMARY_ONLY' | 'CONSENT_REQUIRED' | 'GRANTED'>;

  const summaryText = !linkedOrganization
    ? 'Independent account with no organization linkage. Organization data access must remain disabled.'
    : accountModel === 'INDIVIDUAL'
      ? `Individual HSP linked to ${primaryFacility?.name ?? 'the primary facility'} with single-account access.`
      : accountModel === 'INSTITUTIONAL'
        ? `Institutional HSP account with multiple role-based users operating under ${input.organizationName ?? 'the institution'}.`
        : `Organization-based HSP with ${consentedFacilities.length ? `${consentedFacilities.length} consented cross-facility access path(s)` : 'facility-specific access only'} under ${input.organizationName ?? 'the organization'}.`;

  return {
    organizationId: linkedOrganization ? String(input.organizationId ?? '').trim() || null : null,
    accountModel,
    accountModelLabel: labelForAccountModel(accountModel),
    accessScope,
    accessScopeLabel: labelForAccessScope(accessScope),
    consentScope,
    consentScopeLabel: labelForConsentScope(consentScope),
    linkedOrganization,
    linkedOrganizationRequired: true,
    organizationName: linkedOrganization ? String(input.organizationName ?? '').trim() || null : null,
    primaryFacility,
    assignedFacilities,
    consentedFacilities,
    consentGrantsCount: storedConsentGrants.length,
    grantedDomains,
    enforcementStatusByDomain,
    restrictions,
    canAccessOrganizationData: linkedOrganization,
    canAccessExternalFacilityData: linkedOrganization && consentScope !== 'NONE',
    summaryText,
  };
}
