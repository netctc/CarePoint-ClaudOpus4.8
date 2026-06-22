type AuditFacilityContext = {
  location: string | null;
  facilityId: string | null;
  domain: string | null;
  external: boolean | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function readString(value: unknown) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function readBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : null;
}

function inferAuditDomain(action?: string | null, resource?: string | null, record?: Record<string, unknown> | null) {
  const direct = readString(record?.domain) ?? readString(asRecord(record?.facilityContext)?.domain) ?? readString(asRecord(record?.auditContext)?.domain);
  if (direct) return direct.toUpperCase();
  const source = `${String(action ?? '')} ${String(resource ?? '')}`.toUpperCase();
  if (/(PRESCRIPTION|REFILL|PHARMACY)/.test(source)) return 'PRESCRIPTIONS';
  if (/(RPM|REMOTE)/.test(source)) return 'RPM';
  if (/(ORDER)/.test(source)) return 'ORDERS';
  if (/(LAB)/.test(source)) return 'LABS';
  if (/(CALENDAR|SCHEDULE|APPOINTMENT|TELEHEALTH)/.test(source)) return 'CALENDAR';
  if (/(REPORT|ANALYTIC|AUDIT|COMPLIANCE|DASHBOARD)/.test(source)) return 'ANALYTICS';
  if (/(RECORD|CHART)/.test(source)) return 'RECORDS';
  return null;
}

export function extractAuditFacilityContext(details: unknown, action?: string | null, resource?: string | null): AuditFacilityContext | null {
  const record = asRecord(details);
  if (!record) return null;
  const nested = asRecord(record.facilityContext) ?? asRecord(record.auditContext) ?? asRecord(record.snapshot) ?? null;
  const location =
    readString(record.location) ??
    readString(record.facility) ??
    readString(record.facilityName) ??
    readString(record.primaryFacility) ??
    readString(record.requestedLocation) ??
    readString(record.releaseLocation) ??
    readString(nested?.location) ??
    readString(nested?.facility) ??
    readString(nested?.facilityName) ??
    readString(nested?.primaryFacility);
  const facilityId =
    readString(record.facilityId) ??
    readString(record.primaryFacilityId) ??
    readString(nested?.facilityId) ??
    readString(nested?.primaryFacilityId);
  const external =
    readBoolean(record.externalFacilityAccess) ??
    readBoolean(record.external) ??
    readBoolean(nested?.externalFacilityAccess) ??
    readBoolean(nested?.external);
  const domain = inferAuditDomain(action, resource, record);
  if (!location && !facilityId && !domain && external == null) return null;
  return { location, facilityId, domain, external };
}

export function withAuditFacilityContext(details: unknown, action?: string | null, resource?: string | null) {
  const record = asRecord(details);
  const facilityContext = extractAuditFacilityContext(details, action, resource);
  if (!record) {
    return facilityContext ? { facilityContext } : details;
  }
  if (!facilityContext) return record;
  return {
    ...record,
    facilityContext: {
      ...asRecord(record.facilityContext),
      ...facilityContext,
    },
  };
}

export function matchesAuditFacilityLocation(details: unknown, location?: string | null) {
  const requested = String(location ?? '').trim().toLowerCase();
  if (!requested) return true;
  const facility = extractAuditFacilityContext(details);
  const actual = String(facility?.location ?? '').trim().toLowerCase();
  if (!actual) return false;
  return actual === requested || actual.includes(requested) || requested.includes(actual);
}

export function summarizeAuditItemsByFacility<T>(items: T[], selector: (item: T) => unknown) {
  const counts = new Map<string, { location: string; count: number }>();
  for (const item of items) {
    const context = extractAuditFacilityContext(selector(item));
    const key = String(context?.location ?? 'Unassigned').trim() || 'Unassigned';
    const current = counts.get(key) ?? { location: key, count: 0 };
    current.count += 1;
    counts.set(key, current);
  }
  return Array.from(counts.values()).sort((a, b) => b.count - a.count || a.location.localeCompare(b.location));
}
