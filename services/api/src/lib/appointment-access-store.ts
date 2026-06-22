import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';

export type AppointmentType = 'ONLINE_MEETING' | 'IN_PERSON_VISIT';
export type AppointmentConsentStatus = 'PENDING' | 'GRANTED' | 'REVOKED';

export type AppointmentAccessRecord = {
  id: string;
  organizationId?: string | null;
  appointmentId: string;
  patientId: string;
  providerId: string;
  subjectProfileId?: string | null;
  appointmentType: AppointmentType;
  consentStatus: AppointmentConsentStatus;
  createdAt: string;
  updatedAt: string;
  grantedAt?: string | null;
  revokedAt?: string | null;
  grantedByUserId?: string | null;
  revokedByUserId?: string | null;
  note?: string | null;
};

type StoreShape = { records?: AppointmentAccessRecord[] };

const storeDir = path.join(process.cwd(), '.data');
const storePath = path.join(storeDir, 'appointment-access-records.json');

async function readStore(): Promise<StoreShape> {
  try {
    const raw = await readFile(storePath, 'utf8');
    const parsed = JSON.parse(raw || '{}') as StoreShape;
    return { records: Array.isArray(parsed.records) ? parsed.records : [] };
  } catch {
    return { records: [] };
  }
}

async function writeStore(store: StoreShape) {
  await mkdir(storeDir, { recursive: true });
  await writeFile(storePath, JSON.stringify(store, null, 2), 'utf8');
}

function nowIso() {
  return new Date().toISOString();
}

function inferAppointmentType(location?: string | null): AppointmentType {
  const value = String(location ?? '').toLowerCase();
  if (value.includes('virtual') || value.includes('online') || value.includes('tele')) {
    return 'ONLINE_MEETING';
  }
  return 'IN_PERSON_VISIT';
}

export async function getAppointmentAccessRecord(appointmentId: string, organizationId?: string | null) {
  const store = await readStore();
  return (store.records ?? []).find((item) => item.appointmentId === appointmentId && (!organizationId || item.organizationId === organizationId)) ?? null;
}

export async function ensureAppointmentAccessRecord(input: {
  organizationId?: string | null;
  appointmentId: string;
  patientId: string;
  providerId: string;
  subjectProfileId?: string | null;
  appointmentType?: AppointmentType | null;
  location?: string | null;
}) {
  const store = await readStore();
  const current = (store.records ?? []).find((item) => item.appointmentId === input.appointmentId && (!input.organizationId || item.organizationId === input.organizationId));
  const timestamp = nowIso();
  const record: AppointmentAccessRecord = current
    ? {
        ...current,
        patientId: input.patientId,
        providerId: input.providerId,
        subjectProfileId: input.subjectProfileId ?? current.subjectProfileId ?? null,
        appointmentType: input.appointmentType ?? current.appointmentType ?? inferAppointmentType(input.location),
        updatedAt: timestamp,
      }
    : {
        id: `appt-access-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        organizationId: input.organizationId ?? null,
        appointmentId: input.appointmentId,
        patientId: input.patientId,
        providerId: input.providerId,
        subjectProfileId: input.subjectProfileId ?? null,
        appointmentType: input.appointmentType ?? inferAppointmentType(input.location),
        consentStatus: 'PENDING',
        createdAt: timestamp,
        updatedAt: timestamp,
      };
  const remaining = (store.records ?? []).filter((item) => item.id !== record.id && item.appointmentId !== input.appointmentId);
  remaining.push(record);
  await writeStore({ records: remaining });
  return record;
}

export async function grantAppointmentAccess(input: {
  organizationId?: string | null;
  appointmentId: string;
  patientId: string;
  providerId: string;
  subjectProfileId?: string | null;
  grantedByUserId?: string | null;
  appointmentType?: AppointmentType | null;
  location?: string | null;
  note?: string | null;
}) {
  const current = await ensureAppointmentAccessRecord(input);
  const store = await readStore();
  const updated: AppointmentAccessRecord = {
    ...current,
    appointmentType: input.appointmentType ?? current.appointmentType,
    consentStatus: 'GRANTED',
    grantedAt: nowIso(),
    grantedByUserId: input.grantedByUserId ?? null,
    revokedAt: null,
    revokedByUserId: null,
    note: input.note ?? current.note ?? null,
    updatedAt: nowIso(),
  };
  const records = (store.records ?? []).map((item) => item.id === updated.id ? updated : item);
  await writeStore({ records });
  return updated;
}

export async function revokeAppointmentAccess(input: {
  organizationId?: string | null;
  appointmentId: string;
  patientId: string;
  providerId: string;
  subjectProfileId?: string | null;
  revokedByUserId?: string | null;
  appointmentType?: AppointmentType | null;
  location?: string | null;
  note?: string | null;
}) {
  const current = await ensureAppointmentAccessRecord(input);
  const store = await readStore();
  const updated: AppointmentAccessRecord = {
    ...current,
    appointmentType: input.appointmentType ?? current.appointmentType,
    consentStatus: 'REVOKED',
    revokedAt: nowIso(),
    revokedByUserId: input.revokedByUserId ?? null,
    note: input.note ?? current.note ?? null,
    updatedAt: nowIso(),
  };
  const records = (store.records ?? []).map((item) => item.id === updated.id ? updated : item);
  await writeStore({ records });
  return updated;
}
