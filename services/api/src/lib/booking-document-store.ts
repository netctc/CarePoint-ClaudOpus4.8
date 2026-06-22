import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export type BookingDocumentKind = 'INSURANCE' | 'IDENTITY' | 'AUTHORIZATION';

export type BookingDocument = {
  id: string;
  organizationId: string;
  patientId: string;
  appointmentId?: string | null;
  holdId?: string | null;
  kind: BookingDocumentKind;
  fileName: string;
  status: 'UPLOADED' | 'VERIFIED';
  ocrPreview: string;
  redactedFields: string[];
  redactionStatus: 'PENDING' | 'REDACTED';
  uploadedAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
};

type BookingDocumentState = {
  items: BookingDocument[];
};

const storagePath = path.resolve(__dirname, '../../data/booking-document-store.json');

async function ensureStorageFile() {
  await fs.mkdir(path.dirname(storagePath), { recursive: true });
  try {
    await fs.access(storagePath);
  } catch {
    await fs.writeFile(storagePath, JSON.stringify({ items: [] }, null, 2), 'utf8');
  }
}

async function loadState(): Promise<BookingDocumentState> {
  await ensureStorageFile();
  try {
    const raw = await fs.readFile(storagePath, 'utf8');
    const parsed = JSON.parse(raw || '{}');
    return { items: Array.isArray(parsed.items) ? parsed.items : [] };
  } catch {
    return { items: [] };
  }
}

async function saveState(state: BookingDocumentState) {
  await ensureStorageFile();
  await fs.writeFile(storagePath, JSON.stringify(state, null, 2), 'utf8');
}

export async function listBookingDocuments(params: { organizationId: string; patientId: string; holdId?: string | null; appointmentId?: string | null; kind?: BookingDocumentKind | null; subjectProfileId?: string | null; }) {
  const state = await loadState();
  return state.items
    .filter((item) => item.organizationId === params.organizationId && item.patientId === params.patientId)
    .filter((item) => {
      const metadataSubjectId = typeof item.metadata?.subjectProfileId === 'string' ? item.metadata.subjectProfileId : null;
      if (params.subjectProfileId) return metadataSubjectId === params.subjectProfileId;
      return metadataSubjectId == null || metadataSubjectId === '';
    })
    .filter((item) => !params.kind || item.kind === params.kind)
    .filter((item) => !params.holdId || item.holdId === params.holdId)
    .filter((item) => !params.appointmentId || item.appointmentId === params.appointmentId)
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
}

export async function getBookingDocument(params: { organizationId: string; patientId: string; documentId: string; }) {
  const items = await listBookingDocuments({ organizationId: params.organizationId, patientId: params.patientId });
  return items.find((item) => item.id === params.documentId) ?? null;
}

export async function createBookingDocument(params: {
  organizationId: string;
  patientId: string;
  holdId?: string | null;
  appointmentId?: string | null;
  kind: BookingDocumentKind;
  fileName: string;
  ocrPreview?: string | null;
  redactedFields?: string[];
  metadata?: Record<string, unknown>;
}) {
  const state = await loadState();
  const now = new Date().toISOString();
  const item: BookingDocument = {
    id: randomUUID(),
    organizationId: params.organizationId,
    patientId: params.patientId,
    holdId: params.holdId ?? null,
    appointmentId: params.appointmentId ?? null,
    kind: params.kind,
    fileName: params.fileName,
    status: 'UPLOADED',
    ocrPreview: String(params.ocrPreview ?? '').trim() || `${params.kind} document captured for review.`,
    redactedFields: Array.isArray(params.redactedFields) ? params.redactedFields : [],
    redactionStatus: Array.isArray(params.redactedFields) && params.redactedFields.length ? 'REDACTED' : 'PENDING',
    uploadedAt: now,
    updatedAt: now,
    metadata: params.metadata,
  };
  state.items.push(item);
  await saveState(state);
  return item;
}

export async function updateBookingDocumentRedaction(params: { organizationId: string; patientId: string; documentId: string; redactedFields: string[]; ocrPreview?: string | null; }) {
  const state = await loadState();
  const now = new Date().toISOString();
  let updated: BookingDocument | null = null;
  state.items = state.items.map((item) => {
    if (item.organizationId !== params.organizationId || item.patientId !== params.patientId || item.id !== params.documentId) return item;
    updated = {
      ...item,
      redactedFields: params.redactedFields,
      redactionStatus: params.redactedFields.length ? 'REDACTED' : 'PENDING',
      ocrPreview: params.ocrPreview != null ? String(params.ocrPreview) : item.ocrPreview,
      updatedAt: now,
    };
    return updated;
  });
  if (!updated) return null;
  await saveState(state);
  return updated;
}

export async function attachBookingDocumentsToAppointment(params: { organizationId: string; patientId: string; appointmentId: string; documentIds: string[]; }) {
  const ids = new Set(params.documentIds);
  const state = await loadState();
  const now = new Date().toISOString();
  const linked: BookingDocument[] = [];
  state.items = state.items.map((item) => {
    if (item.organizationId !== params.organizationId || item.patientId !== params.patientId || !ids.has(item.id)) return item;
    const next = { ...item, appointmentId: params.appointmentId, updatedAt: now };
    linked.push(next);
    return next;
  });
  await saveState(state);
  return linked;
}
