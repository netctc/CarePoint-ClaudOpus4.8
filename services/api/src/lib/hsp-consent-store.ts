import fs from 'node:fs';
import path from 'node:path';

export const hspConsentGrantScopes = ['LIMITED', 'FULL'] as const;
export type HspConsentGrantScope = (typeof hspConsentGrantScopes)[number];
export const hspConsentGrantStatuses = ['ACTIVE', 'REVOKED'] as const;
export type HspConsentGrantStatus = (typeof hspConsentGrantStatuses)[number];

export type HspConsentGrant = {
  id: string;
  organizationId: string;
  sourceFacilityId: string;
  sourceFacilityName: string;
  targetFacilityId: string;
  targetFacilityName: string;
  scope: HspConsentGrantScope;
  domains: string[];
  status: HspConsentGrantStatus;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  updatedByRole: string | null;
};

type StoreShape = {
  grants: HspConsentGrant[];
};

const STORE_PATH = path.resolve(__dirname, '../../data/hsp-consents.json');

function ensureStoreDir() {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
}

function defaultStore(): StoreShape {
  return { grants: [] };
}

function nowIso() {
  return new Date().toISOString();
}

function readStore(): StoreShape {
  ensureStoreDir();
  if (!fs.existsSync(STORE_PATH)) {
    const initial = defaultStore();
    fs.writeFileSync(STORE_PATH, JSON.stringify(initial, null, 2));
    return initial;
  }

  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw || '{}') as Partial<StoreShape>;
    return { grants: Array.isArray(parsed.grants) ? parsed.grants : [] };
  } catch {
    return defaultStore();
  }
}

function writeStore(store: StoreShape) {
  ensureStoreDir();
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}

function normalizeDomains(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const domains = value.map((item) => String(item ?? '').trim()).filter(Boolean);
  return Array.from(new Set(domains));
}

export function listHspConsentGrants(organizationId: string, status?: HspConsentGrantStatus | 'ALL') {
  const store = readStore();
  return store.grants
    .filter((item) => item.organizationId === organizationId)
    .filter((item) => (status && status !== 'ALL' ? item.status === status : true))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function getActiveHspConsentGrants(organizationId: string, sourceFacilityId?: string | null) {
  return listHspConsentGrants(organizationId, 'ACTIVE').filter((item) => !sourceFacilityId || item.sourceFacilityId === sourceFacilityId);
}

export function upsertHspConsentGrant(input: {
  organizationId: string;
  sourceFacilityId: string;
  sourceFacilityName: string;
  targetFacilityId: string;
  targetFacilityName: string;
  scope?: HspConsentGrantScope | string | null;
  domains?: unknown;
  note?: string | null;
  updatedByRole?: string | null;
}) {
  const store = readStore();
  const timestamp = nowIso();
  const scope = String(input.scope ?? 'LIMITED').toUpperCase() === 'FULL' ? 'FULL' : 'LIMITED';
  const domains = normalizeDomains(input.domains);
  const existing = store.grants.find((item) => item.organizationId === input.organizationId && item.sourceFacilityId === input.sourceFacilityId && item.targetFacilityId === input.targetFacilityId);

  if (existing) {
    existing.sourceFacilityName = input.sourceFacilityName;
    existing.targetFacilityName = input.targetFacilityName;
    existing.scope = scope;
    existing.domains = domains;
    existing.note = input.note ?? existing.note ?? null;
    existing.status = 'ACTIVE';
    existing.updatedAt = timestamp;
    existing.updatedByRole = input.updatedByRole ?? existing.updatedByRole ?? null;
    writeStore(store);
    return existing;
  }

  const created: HspConsentGrant = {
    id: `hsp-consent-${Math.random().toString(36).slice(2, 10)}`,
    organizationId: input.organizationId,
    sourceFacilityId: input.sourceFacilityId,
    sourceFacilityName: input.sourceFacilityName,
    targetFacilityId: input.targetFacilityId,
    targetFacilityName: input.targetFacilityName,
    scope,
    domains,
    status: 'ACTIVE',
    note: input.note ?? null,
    createdAt: timestamp,
    updatedAt: timestamp,
    updatedByRole: input.updatedByRole ?? null,
  };
  store.grants.unshift(created);
  writeStore(store);
  return created;
}

export function revokeHspConsentGrant(organizationId: string, grantId: string, updatedByRole?: string | null, note?: string | null) {
  const store = readStore();
  const existing = store.grants.find((item) => item.organizationId === organizationId && item.id === grantId);
  if (!existing) return null;
  existing.status = 'REVOKED';
  existing.updatedAt = nowIso();
  existing.updatedByRole = updatedByRole ?? existing.updatedByRole ?? null;
  if (note) existing.note = note;
  writeStore(store);
  return existing;
}
