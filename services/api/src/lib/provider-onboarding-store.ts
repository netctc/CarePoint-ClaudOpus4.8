import { prisma } from './prisma';

type StoredStateInput = {
  providerId: string;
  organizationId: string;
  actorId?: string;
  status: string;
  note?: string | null;
  requestedFields?: string[];
  checklist?: Record<string, boolean>;
  action?: string;
};

function getOnboardingModel(): any | null {
  const candidate = (prisma as any).providerOnboardingState;
  if (candidate && typeof candidate.findUnique === 'function' && typeof candidate.upsert === 'function') {
    return candidate;
  }
  return null;
}

export function getOnboardingStorageMode() {
  return getOnboardingModel() ? 'provider_onboarding_state' : 'audit_fallback';
}

function sanitizeRequestedFields(requestedFields?: string[]) {
  return Array.isArray(requestedFields) ? requestedFields.map((value) => String(value)) : [];
}

export async function getStoredOnboardingState(providerId: string, organizationId?: string) {
  const model = getOnboardingModel();
  if (!model) {
    return null;
  }

  const item = await model.findUnique({
    where: { providerId },
  });

  if (!item) {
    return null;
  }

  if (organizationId && item.organizationId !== organizationId) {
    return null;
  }

  return item;
}

export async function listStoredOnboardingStates(providerIds: string[], organizationId?: string) {
  const model = getOnboardingModel();
  const map = new Map<string, any>();
  if (!model || providerIds.length === 0) {
    return map;
  }

  const items = await model.findMany({
    where: {
      providerId: { in: providerIds },
      ...(organizationId ? { organizationId } : {}),
    },
  });

  for (const item of items) {
    map.set(item.providerId, item);
  }
  return map;
}

export async function upsertStoredOnboardingState(input: StoredStateInput) {
  const model = getOnboardingModel();
  if (!model) {
    return null;
  }

  const requestedFields = sanitizeRequestedFields(input.requestedFields);
  return model.upsert({
    where: { providerId: input.providerId },
    create: {
      providerId: input.providerId,
      organizationId: input.organizationId,
      lastActorId: input.actorId,
      status: input.status,
      decisionNote: input.note ?? null,
      requestedFields,
      checklist: input.checklist ?? {},
      lastAction: input.action ?? null,
      submittedAt: input.status === 'READY_FOR_REVIEW' ? new Date() : null,
      reviewedAt: ['APPROVED', 'REJECTED', 'REQUEST_CHANGES'].includes(input.status) ? new Date() : null,
    },
    update: {
      organizationId: input.organizationId,
      lastActorId: input.actorId,
      status: input.status,
      decisionNote: input.note ?? null,
      requestedFields,
      checklist: input.checklist ?? {},
      lastAction: input.action ?? null,
      submittedAt: input.status === 'READY_FOR_REVIEW' ? new Date() : undefined,
      reviewedAt: ['APPROVED', 'REJECTED', 'REQUEST_CHANGES'].includes(input.status) ? new Date() : undefined,
    },
  });
}
