import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export type WalletMethod = {
  id: string;
  organizationId: string;
  patientId: string;
  type: 'CARD' | 'APPLE_PAY' | 'MADA' | 'STC_PAY';
  brand: string;
  label: string;
  last4: string;
  gatewayToken: string;
  status: 'ACTIVE' | 'DELETED';
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
};

type WalletStoreState = {
  methods: WalletMethod[];
};

const storagePath = path.resolve(__dirname, '../../data/payment-wallet-store.json');

async function ensureStorageFile() {
  await fs.mkdir(path.dirname(storagePath), { recursive: true });
  try {
    await fs.access(storagePath);
  } catch {
    await fs.writeFile(storagePath, JSON.stringify({ methods: [] }, null, 2), 'utf8');
  }
}

async function loadState(): Promise<WalletStoreState> {
  await ensureStorageFile();
  try {
    const raw = await fs.readFile(storagePath, 'utf8');
    const parsed = JSON.parse(raw || '{}');
    return { methods: Array.isArray(parsed.methods) ? parsed.methods : [] };
  } catch {
    return { methods: [] };
  }
}

async function saveState(state: WalletStoreState) {
  await ensureStorageFile();
  await fs.writeFile(storagePath, JSON.stringify(state, null, 2), 'utf8');
}

function activeMethodsForScope(methods: WalletMethod[], organizationId: string, patientId: string) {
  return methods.filter((item) => item.organizationId === organizationId && item.patientId === patientId && item.status === 'ACTIVE');
}

export async function listWalletMethods(params: { organizationId: string; patientId: string }) {
  const state = await loadState();
  return activeMethodsForScope(state.methods, params.organizationId, params.patientId)
    .sort((left, right) => {
      if (left.isDefault !== right.isDefault) return left.isDefault ? -1 : 1;
      return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
    });
}

export async function createWalletMethod(params: {
  organizationId: string;
  patientId: string;
  actorId?: string;
  type: WalletMethod['type'];
  brand?: string | null;
  label?: string | null;
  last4: string;
  setDefault?: boolean;
  metadata?: Record<string, unknown>;
}) {
  const state = await loadState();
  const now = new Date().toISOString();
  const methods = activeMethodsForScope(state.methods, params.organizationId, params.patientId);
  const nextDefault = params.setDefault || methods.length === 0;
  if (nextDefault) {
    state.methods = state.methods.map((item) => item.organizationId === params.organizationId && item.patientId === params.patientId ? { ...item, isDefault: false, updatedAt: now } : item);
  }
  const typeLabel = String(params.type).replaceAll('_', ' ');
  const method: WalletMethod = {
    id: randomUUID(),
    organizationId: params.organizationId,
    patientId: params.patientId,
    type: params.type,
    brand: String(params.brand ?? params.type).trim() || params.type,
    label: String(params.label ?? `${typeLabel} ending in ${params.last4}`).trim(),
    last4: params.last4,
    gatewayToken: `tok_${randomUUID().replaceAll('-', '')}`,
    status: 'ACTIVE',
    isDefault: nextDefault,
    createdAt: now,
    updatedAt: now,
    metadata: params.metadata,
  };
  state.methods.push(method);
  await saveState(state);
  return method;
}

export async function setDefaultWalletMethod(params: { organizationId: string; patientId: string; methodId: string }) {
  const state = await loadState();
  const now = new Date().toISOString();
  let target: WalletMethod | null = null;
  state.methods = state.methods.map((item) => {
    if (item.organizationId !== params.organizationId || item.patientId !== params.patientId || item.status !== 'ACTIVE') return item;
    const isTarget = item.id === params.methodId;
    const next = { ...item, isDefault: isTarget, updatedAt: now };
    if (isTarget) target = next;
    return next;
  });
  if (!target) return null;
  await saveState(state);
  return target;
}

export async function deleteWalletMethod(params: { organizationId: string; patientId: string; methodId: string }) {
  const state = await loadState();
  const now = new Date().toISOString();
  let deleted: WalletMethod | null = null;
  state.methods = state.methods.map((item) => {
    if (item.organizationId !== params.organizationId || item.patientId !== params.patientId || item.id !== params.methodId || item.status !== 'ACTIVE') return item;
    deleted = { ...item, status: 'DELETED', isDefault: false, updatedAt: now };
    return deleted;
  });
  if (!deleted) return null;
  const remaining = activeMethodsForScope(state.methods, params.organizationId, params.patientId);
  if (!remaining.some((item) => item.isDefault) && remaining.length) {
    const newest = remaining.sort((l, r) => new Date(r.updatedAt).getTime() - new Date(l.updatedAt).getTime())[0];
    state.methods = state.methods.map((item) => item.id === newest.id ? { ...item, isDefault: true, updatedAt: now } : item);
  }
  await saveState(state);
  return deleted;
}

export async function getWalletMethod(params: { organizationId: string; patientId: string; methodId?: string | null }) {
  const methods = await listWalletMethods({ organizationId: params.organizationId, patientId: params.patientId });
  if (!methods.length) return null;
  if (params.methodId) {
    return methods.find((item) => item.id === params.methodId) ?? null;
  }
  return methods.find((item) => item.isDefault) ?? methods[0] ?? null;
}
