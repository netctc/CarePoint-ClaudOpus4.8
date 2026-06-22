import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';

export type RefillAuditScope = {
  id: string;
  organizationId: string;
  title: string;
  note?: string | null;
  limit: number;
  queue?: string | null;
  assignedRole?: string | null;
  controlledOnly: boolean;
  escalatedOnly: boolean;
  includeExecutions: boolean;
  includeOperationalEvents: boolean;
  createdByUserId?: string | null;
  createdAt: string;
  updatedAt: string;
};

type StoreShape = { items?: RefillAuditScope[] };

const storeDir = path.join(process.cwd(), '.data');
const storePath = path.join(storeDir, 'refill-audit-scopes.json');

function nowIso() {
  return new Date().toISOString();
}

function randomId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function readStore(): Promise<StoreShape> {
  try {
    const raw = await readFile(storePath, 'utf8');
    const parsed = JSON.parse(raw || '{}') as StoreShape;
    return { items: Array.isArray(parsed.items) ? parsed.items : [] };
  } catch {
    return { items: [] };
  }
}

async function writeStore(store: StoreShape) {
  await mkdir(storeDir, { recursive: true });
  await writeFile(storePath, JSON.stringify(store, null, 2), 'utf8');
}

export async function listRefillAuditScopes(organizationId: string) {
  const store = await readStore();
  return (store.items ?? [])
    .filter((item) => item.organizationId === organizationId)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export async function getRefillAuditScope(organizationId: string, scopeId?: string | null) {
  if (!scopeId) return null;
  const items = await listRefillAuditScopes(organizationId);
  return items.find((item) => item.id === scopeId) ?? null;
}

export async function createRefillAuditScope(input: {
  organizationId: string;
  title: string;
  note?: string | null;
  limit?: number | null;
  queue?: string | null;
  assignedRole?: string | null;
  controlledOnly?: boolean | null;
  escalatedOnly?: boolean | null;
  includeExecutions?: boolean | null;
  includeOperationalEvents?: boolean | null;
  createdByUserId?: string | null;
}) {
  const store = await readStore();
  const timestamp = nowIso();
  const item: RefillAuditScope = {
    id: randomId('refill-audit-scope'),
    organizationId: input.organizationId,
    title: input.title,
    note: input.note ?? null,
    limit: Math.max(1, Math.min(250, Number(input.limit ?? 50))),
    queue: input.queue ? String(input.queue).trim().toUpperCase() : null,
    assignedRole: input.assignedRole ? String(input.assignedRole).trim().toUpperCase() : null,
    controlledOnly: Boolean(input.controlledOnly),
    escalatedOnly: Boolean(input.escalatedOnly),
    includeExecutions: input.includeExecutions !== false,
    includeOperationalEvents: input.includeOperationalEvents !== false,
    createdByUserId: input.createdByUserId ?? null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const items = [item, ...(store.items ?? [])];
  await writeStore({ items });
  return item;
}
