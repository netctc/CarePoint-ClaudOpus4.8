import fs from 'node:fs/promises';
import path from 'node:path';
import { prisma } from './prisma';

export type AppointmentSubjectMeta = {
  appointmentId: string;
  organizationId: string;
  patientId: string;
  subjectProfileId: string;
  subjectLabel?: string | null;
  subjectRelationship?: string | null;
  isFamilySubject: boolean;
  createdAt: string;
  updatedAt: string;
};

type AppointmentSubjectState = {
  items: AppointmentSubjectMeta[];
};

const storagePath = path.resolve(__dirname, '../../data/appointment-subject-store.json');
let prismaStoreAvailable: boolean | null = null;

async function ensureStorageFile() {
  await fs.mkdir(path.dirname(storagePath), { recursive: true });
  try {
    await fs.access(storagePath);
  } catch {
    await fs.writeFile(storagePath, JSON.stringify({ items: [] }, null, 2), 'utf8');
  }
}

async function loadState(): Promise<AppointmentSubjectState> {
  await ensureStorageFile();
  try {
    const raw = await fs.readFile(storagePath, 'utf8');
    const parsed = JSON.parse(raw || '{}');
    return { items: Array.isArray(parsed.items) ? parsed.items : [] };
  } catch {
    return { items: [] };
  }
}

async function saveState(state: AppointmentSubjectState) {
  await ensureStorageFile();
  await fs.writeFile(storagePath, JSON.stringify(state, null, 2), 'utf8');
}

function normalizeRow(row: Record<string, unknown>): AppointmentSubjectMeta {
  return {
    appointmentId: String(row.appointmentId ?? ''),
    organizationId: String(row.organizationId ?? ''),
    patientId: String(row.patientId ?? ''),
    subjectProfileId: String(row.subjectProfileId ?? ''),
    subjectLabel: row.subjectLabel == null ? null : String(row.subjectLabel),
    subjectRelationship: row.subjectRelationship == null ? null : String(row.subjectRelationship),
    isFamilySubject: Boolean(row.isFamilySubject),
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt ?? new Date().toISOString()),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt ?? new Date().toISOString()),
  };
}

function shouldFallbackToJson(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return message.includes('AppointmentSubjectContext') || message.includes('does not exist') || message.includes('relation') || message.includes('table');
}

async function canUsePrismaStore() {
  if (prismaStoreAvailable != null) return prismaStoreAvailable;
  try {
    const rows = await prisma.$queryRawUnsafe(`SELECT to_regclass('public."AppointmentSubjectContext"')::text AS regclass`) as Array<{ regclass: string | null }>;
    prismaStoreAvailable = Boolean(rows?.[0]?.regclass);
  } catch {
    prismaStoreAvailable = false;
  }
  return prismaStoreAvailable;
}

async function listFromPrisma(params: { organizationId?: string; patientId?: string; appointmentId?: string }) {
  const values: Array<string> = [];
  const clauses: string[] = [];
  if (params.organizationId) {
    values.push(params.organizationId);
    clauses.push(`"organizationId" = $${values.length}`);
  }
  if (params.patientId) {
    values.push(params.patientId);
    clauses.push(`"patientId" = $${values.length}`);
  }
  if (params.appointmentId) {
    values.push(params.appointmentId);
    clauses.push(`"appointmentId" = $${values.length}`);
  }
  const sql = `SELECT "appointmentId", "organizationId", "patientId", "subjectProfileId", "subjectLabel", "subjectRelationship", "isFamilySubject", "createdAt", "updatedAt" FROM "AppointmentSubjectContext"${clauses.length ? ` WHERE ${clauses.join(' AND ')}` : ''} ORDER BY "updatedAt" DESC`;
  const rows = await prisma.$queryRawUnsafe(sql, ...values) as Array<Record<string, unknown>>;
  return rows.map(normalizeRow);
}

async function upsertPrisma(input: {
  appointmentId: string;
  organizationId: string;
  patientId: string;
  subjectProfileId: string;
  subjectLabel?: string | null;
  subjectRelationship?: string | null;
  isFamilySubject?: boolean;
}) {
  const rows = await prisma.$queryRawUnsafe(`
    INSERT INTO "AppointmentSubjectContext" (
      "appointmentId",
      "organizationId",
      "patientId",
      "subjectProfileId",
      "subjectLabel",
      "subjectRelationship",
      "isFamilySubject",
      "createdAt",
      "updatedAt"
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
    ON CONFLICT ("appointmentId") DO UPDATE SET
      "organizationId" = EXCLUDED."organizationId",
      "patientId" = EXCLUDED."patientId",
      "subjectProfileId" = EXCLUDED."subjectProfileId",
      "subjectLabel" = EXCLUDED."subjectLabel",
      "subjectRelationship" = EXCLUDED."subjectRelationship",
      "isFamilySubject" = EXCLUDED."isFamilySubject",
      "updatedAt" = NOW()
    RETURNING "appointmentId", "organizationId", "patientId", "subjectProfileId", "subjectLabel", "subjectRelationship", "isFamilySubject", "createdAt", "updatedAt"
  `, input.appointmentId, input.organizationId, input.patientId, input.subjectProfileId, input.subjectLabel ?? null, input.subjectRelationship ?? null, input.isFamilySubject ?? true) as Array<Record<string, unknown>>;
  return rows[0] ? normalizeRow(rows[0]) : null;
}

async function clearPrisma(params: { appointmentId: string; organizationId?: string }) {
  const values: Array<string> = [params.appointmentId];
  const clauses = [`"appointmentId" = $1`];
  if (params.organizationId) {
    values.push(params.organizationId);
    clauses.push(`"organizationId" = $${values.length}`);
  }
  const rows = await prisma.$queryRawUnsafe(`DELETE FROM "AppointmentSubjectContext" WHERE ${clauses.join(' AND ')} RETURNING "appointmentId"`, ...values) as Array<{ appointmentId: string }>;
  return rows.length > 0;
}

export async function listAppointmentSubjectMeta(params: { organizationId?: string; patientId?: string; appointmentId?: string; }) {
  if (await canUsePrismaStore()) {
    try {
      return await listFromPrisma(params);
    } catch (error) {
      if (!shouldFallbackToJson(error)) throw error;
      prismaStoreAvailable = false;
    }
  }
  const state = await loadState();
  return state.items
    .filter((item) => !params.organizationId || item.organizationId === params.organizationId)
    .filter((item) => !params.patientId || item.patientId === params.patientId)
    .filter((item) => !params.appointmentId || item.appointmentId === params.appointmentId)
    .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)));
}

export async function getAppointmentSubjectMeta(params: { appointmentId: string; organizationId?: string; patientId?: string | null }) {
  const items = await listAppointmentSubjectMeta({ organizationId: params.organizationId, patientId: params.patientId ?? undefined, appointmentId: params.appointmentId });
  return items[0] ?? null;
}

export async function upsertAppointmentSubjectMeta(input: {
  appointmentId: string;
  organizationId: string;
  patientId: string;
  subjectProfileId: string;
  subjectLabel?: string | null;
  subjectRelationship?: string | null;
  isFamilySubject?: boolean;
}) {
  if (await canUsePrismaStore()) {
    try {
      const prismaItem = await upsertPrisma(input);
      if (prismaItem) return prismaItem;
    } catch (error) {
      if (!shouldFallbackToJson(error)) throw error;
      prismaStoreAvailable = false;
    }
  }
  const now = new Date().toISOString();
  const state = await loadState();
  const index = state.items.findIndex((item) => item.appointmentId === input.appointmentId && item.organizationId === input.organizationId);
  const next: AppointmentSubjectMeta = {
    appointmentId: input.appointmentId,
    organizationId: input.organizationId,
    patientId: input.patientId,
    subjectProfileId: input.subjectProfileId,
    subjectLabel: input.subjectLabel ?? null,
    subjectRelationship: input.subjectRelationship ?? null,
    isFamilySubject: input.isFamilySubject ?? true,
    createdAt: index >= 0 ? state.items[index].createdAt : now,
    updatedAt: now,
  };
  if (index >= 0) state.items[index] = next;
  else state.items.push(next);
  await saveState(state);
  return next;
}

export async function clearAppointmentSubjectMeta(params: { appointmentId: string; organizationId?: string }) {
  if (await canUsePrismaStore()) {
    try {
      return await clearPrisma(params);
    } catch (error) {
      if (!shouldFallbackToJson(error)) throw error;
      prismaStoreAvailable = false;
    }
  }
  const state = await loadState();
  const before = state.items.length;
  state.items = state.items.filter((item) => !(item.appointmentId === params.appointmentId && (!params.organizationId || item.organizationId === params.organizationId)));
  if (state.items.length !== before) await saveState(state);
  return before !== state.items.length;
}
