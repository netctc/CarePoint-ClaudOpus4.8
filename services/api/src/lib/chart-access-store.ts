import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';

export type ChartAccessException = {
  id: string;
  organizationId?: string | null;
  patientId: string;
  providerId: string;
  createdByUserId?: string | null;
  reasonCode: string;
  note?: string | null;
  status: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
  createdAt: string;
  updatedAt: string;
  expiresAt?: string | null;
  revokedAt?: string | null;
  revokedByUserId?: string | null;
};

type StoreShape = {
  exceptions?: ChartAccessException[];
};

const storeDir = path.join(process.cwd(), '.data');
const storePath = path.join(storeDir, 'chart-access-exceptions.json');

async function readStore(): Promise<StoreShape> {
  try {
    const raw = await readFile(storePath, 'utf8');
    const parsed = JSON.parse(raw || '{}') as StoreShape;
    return { exceptions: Array.isArray(parsed.exceptions) ? parsed.exceptions : [] };
  } catch {
    return { exceptions: [] };
  }
}

async function writeStore(store: StoreShape) {
  await mkdir(storeDir, { recursive: true });
  await writeFile(storePath, JSON.stringify(store, null, 2), 'utf8');
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeStatus(item: ChartAccessException): ChartAccessException {
  if (item.status === 'ACTIVE' && item.expiresAt) {
    const expiresAt = new Date(item.expiresAt);
    if (!Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() < Date.now()) {
      return { ...item, status: 'EXPIRED', updatedAt: nowIso() };
    }
  }
  return item;
}

export async function listChartAccessExceptions(filters?: {
  organizationId?: string | null;
  patientId?: string | null;
  providerId?: string | null;
  status?: ChartAccessException['status'] | 'ALL';
}) {
  const store = await readStore();
  const normalized = (store.exceptions ?? []).map(normalizeStatus);
  const filtered = normalized.filter((item) => {
    if (filters?.organizationId && item.organizationId && item.organizationId !== filters.organizationId) return false;
    if (filters?.patientId && item.patientId !== filters.patientId) return false;
    if (filters?.providerId && item.providerId !== filters.providerId) return false;
    if (filters?.status && filters.status !== 'ALL' && item.status !== filters.status) return false;
    return true;
  });

  if (JSON.stringify(normalized) !== JSON.stringify(store.exceptions ?? [])) {
    await writeStore({ exceptions: normalized });
  }

  return filtered.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export async function getActiveChartAccessException(providerId: string, patientId: string, organizationId?: string | null) {
  const items = await listChartAccessExceptions({ organizationId, providerId, patientId, status: 'ACTIVE' });
  return items[0] ?? null;
}

export async function grantChartAccessException(input: {
  organizationId?: string | null;
  patientId: string;
  providerId: string;
  createdByUserId?: string | null;
  reasonCode: string;
  note?: string | null;
  expiresAt?: string | null;
}) {
  const store = await readStore();
  const active = (store.exceptions ?? []).find((item) => normalizeStatus(item).status === 'ACTIVE' && item.patientId === input.patientId && item.providerId === input.providerId && (!input.organizationId || item.organizationId === input.organizationId));
  const timestamp = nowIso();
  const record: ChartAccessException = active
    ? {
        ...active,
        reasonCode: input.reasonCode,
        note: input.note ?? active.note ?? null,
        expiresAt: input.expiresAt ?? active.expiresAt ?? null,
        status: 'ACTIVE',
        updatedAt: timestamp,
        createdByUserId: input.createdByUserId ?? active.createdByUserId ?? null,
      }
    : {
        id: `chart-access-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        organizationId: input.organizationId ?? null,
        patientId: input.patientId,
        providerId: input.providerId,
        createdByUserId: input.createdByUserId ?? null,
        reasonCode: input.reasonCode,
        note: input.note ?? null,
        status: 'ACTIVE',
        createdAt: timestamp,
        updatedAt: timestamp,
        expiresAt: input.expiresAt ?? null,
      };

  const remaining = (store.exceptions ?? []).filter((item) => item.id !== record.id);
  remaining.push(record);
  await writeStore({ exceptions: remaining });
  return record;
}

export async function revokeChartAccessException(id: string, revokedByUserId?: string | null, note?: string | null) {
  const store = await readStore();
  const current = (store.exceptions ?? []).find((item) => item.id === id);
  if (!current) return null;
  const updated: ChartAccessException = {
    ...current,
    status: 'REVOKED',
    revokedAt: nowIso(),
    revokedByUserId: revokedByUserId ?? null,
    note: note ?? current.note ?? null,
    updatedAt: nowIso(),
  };
  const items = (store.exceptions ?? []).map((item) => (item.id === id ? updated : item));
  await writeStore({ exceptions: items });
  return updated;
}
