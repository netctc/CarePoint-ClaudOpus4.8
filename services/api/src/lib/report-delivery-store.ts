import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';

export type SavedReportPreset = {
  id: string;
  organizationId: string;
  reportId?: string | null;
  title: string;
  description?: string | null;
  metricKeys: string[];
  format: 'csv' | 'json';
  range: string;
  sourcePresetId?: string | null;
  note?: string | null;
  createdByUserId?: string | null;
  subjectScope?: 'all' | 'self' | 'family';
  createdAt: string;
  updatedAt: string;
};

export type ReportDeliveryExecution = {
  id: string;
  organizationId: string;
  scheduleId?: string | null;
  presetId?: string | null;
  reportId?: string | null;
  title: string;
  destination?: string | null;
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  format: 'csv' | 'json';
  range: string;
  trigger: 'MANUAL' | 'SCHEDULED' | 'EXPORT';
  metricsCount: number;
  summary: string;
  outputRef?: string | null;
  errorMessage?: string | null;
  executedByUserId?: string | null;
  subjectScope?: 'all' | 'self' | 'family';
  executedAt: string;
};

export type ScheduledReportDelivery = {
  id: string;
  organizationId: string;
  presetId?: string | null;
  reportId?: string | null;
  title: string;
  destination: string;
  schedule: string;
  format: 'csv' | 'json';
  range: string;
  active: boolean;
  lastRunAt?: string | null;
  lastRunStatus?: 'SUCCESS' | 'FAILED' | 'SKIPPED' | null;
  lastRunSummary?: string | null;
  note?: string | null;
  createdByUserId?: string | null;
  subjectScope?: 'all' | 'self' | 'family';
  createdAt: string;
  updatedAt: string;
};

type StoreShape = {
  presets?: SavedReportPreset[];
  schedules?: ScheduledReportDelivery[];
  executions?: ReportDeliveryExecution[];
};

const storeDir = path.join(process.cwd(), '.data');
const storePath = path.join(storeDir, 'report-delivery.json');

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
    return {
      presets: Array.isArray(parsed.presets) ? parsed.presets : [],
      schedules: Array.isArray(parsed.schedules) ? parsed.schedules : [],
      executions: Array.isArray((parsed as any).executions) ? (parsed as any).executions : [],
    };
  } catch {
    return { presets: [], schedules: [], executions: [] };
  }
}

async function writeStore(store: StoreShape) {
  await mkdir(storeDir, { recursive: true });
  await writeFile(storePath, JSON.stringify(store, null, 2), 'utf8');
}

export async function listSavedReportPresets(organizationId: string, options?: { subjectScope?: 'all' | 'self' | 'family' | null }) {
  const store = await readStore();
  return (store.presets ?? [])
    .filter((item) => item.organizationId === organizationId)
    .filter((item) => !options?.subjectScope || options.subjectScope === 'all' ? true : (item.subjectScope ?? 'all') === options.subjectScope)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export async function saveReportPreset(input: {
  organizationId: string;
  reportId?: string | null;
  title: string;
  description?: string | null;
  metricKeys: string[];
  format: 'csv' | 'json';
  range: string;
  sourcePresetId?: string | null;
  note?: string | null;
  createdByUserId?: string | null;
  subjectScope?: 'all' | 'self' | 'family' | null;
}) {
  const store = await readStore();
  const timestamp = nowIso();
  const item: SavedReportPreset = {
    id: randomId('report-preset'),
    organizationId: input.organizationId,
    reportId: input.reportId ?? null,
    title: input.title,
    description: input.description ?? null,
    metricKeys: Array.from(new Set((input.metricKeys ?? []).filter(Boolean))),
    format: input.format,
    range: input.range,
    sourcePresetId: input.sourcePresetId ?? null,
    note: input.note ?? null,
    createdByUserId: input.createdByUserId ?? null,
    subjectScope: input.subjectScope ?? 'all',
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const presets = [...(store.presets ?? []), item];
  await writeStore({ ...store, presets });
  return item;
}

export async function listScheduledReportDeliveries(organizationId: string, options?: { subjectScope?: 'all' | 'self' | 'family' | null }) {
  const store = await readStore();
  return (store.schedules ?? [])
    .filter((item) => item.organizationId === organizationId)
    .filter((item) => !options?.subjectScope || options.subjectScope === 'all' ? true : (item.subjectScope ?? 'all') === options.subjectScope)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export async function createScheduledReportDelivery(input: {
  organizationId: string;
  presetId?: string | null;
  reportId?: string | null;
  title: string;
  destination: string;
  schedule: string;
  format: 'csv' | 'json';
  range: string;
  note?: string | null;
  createdByUserId?: string | null;
  subjectScope?: 'all' | 'self' | 'family' | null;
}) {
  const store = await readStore();
  const timestamp = nowIso();
  const item: ScheduledReportDelivery = {
    id: randomId('report-schedule'),
    organizationId: input.organizationId,
    presetId: input.presetId ?? null,
    reportId: input.reportId ?? null,
    title: input.title,
    destination: input.destination,
    schedule: input.schedule,
    format: input.format,
    range: input.range,
    active: true,
    lastRunAt: null,
    lastRunStatus: null,
    lastRunSummary: null,
    note: input.note ?? null,
    createdByUserId: input.createdByUserId ?? null,
    subjectScope: input.subjectScope ?? 'all',
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const schedules = [...(store.schedules ?? []), item];
  await writeStore({ ...store, schedules });
  return item;
}


export async function listReportDeliveryExecutions(organizationId: string, options?: { scheduleId?: string | null; limit?: number; subjectScope?: 'all' | 'self' | 'family' | null }) {
  const store = await readStore();
  let items = (store.executions ?? []).filter((item) => item.organizationId === organizationId);
  if (options?.scheduleId) items = items.filter((item) => item.scheduleId === options.scheduleId);
  if (options?.subjectScope && options.subjectScope !== 'all') items = items.filter((item) => (item.subjectScope ?? 'all') === options.subjectScope);
  items = items.sort((a, b) => (a.executedAt < b.executedAt ? 1 : -1));
  return items.slice(0, Math.max(1, options?.limit ?? 20));
}


export async function listFailedReportDeliveryExecutions(organizationId: string, options?: { scheduleId?: string | null; limit?: number; subjectScope?: 'all' | 'self' | 'family' | null }) {
  const items = await listReportDeliveryExecutions(organizationId, options);
  return items.filter((item) => item.status === 'FAILED').slice(0, Math.max(1, options?.limit ?? 20));
}

export async function recordReportDeliveryExecution(input: {
  organizationId: string;
  scheduleId?: string | null;
  presetId?: string | null;
  reportId?: string | null;
  title: string;
  destination?: string | null;
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  format: 'csv' | 'json';
  range: string;
  trigger: 'MANUAL' | 'SCHEDULED' | 'EXPORT';
  metricsCount: number;
  summary: string;
  outputRef?: string | null;
  errorMessage?: string | null;
  executedByUserId?: string | null;
  subjectScope?: 'all' | 'self' | 'family' | null;
}) {
  const store = await readStore();
  const executedAt = nowIso();
  const item: ReportDeliveryExecution = {
    id: randomId('report-execution'),
    organizationId: input.organizationId,
    scheduleId: input.scheduleId ?? null,
    presetId: input.presetId ?? null,
    reportId: input.reportId ?? null,
    title: input.title,
    destination: input.destination ?? null,
    status: input.status,
    format: input.format,
    range: input.range,
    trigger: input.trigger,
    metricsCount: input.metricsCount,
    summary: input.summary,
    outputRef: input.outputRef ?? null,
    errorMessage: input.errorMessage ?? null,
    executedByUserId: input.executedByUserId ?? null,
    subjectScope: input.subjectScope ?? 'all',
    executedAt,
  };
  const schedules = (store.schedules ?? []).map((schedule) => schedule.id === input.scheduleId ? {
    ...schedule,
    lastRunAt: executedAt,
    lastRunStatus: input.status,
    lastRunSummary: input.summary,
    updatedAt: executedAt,
  } : schedule);
  const executions = [item, ...(store.executions ?? [])];
  await writeStore({ ...store, schedules, executions });
  return item;
}
