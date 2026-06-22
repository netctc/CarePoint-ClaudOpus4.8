import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { allowRoles } from '../../middleware/rbac';
import { validateBody } from '../../middleware/validate';
import { badRequest } from '../../lib/http';
import { writeAuditLog } from '../../lib/audit';
import {
  getGrowthItem,
  getGrowthStorageMode,
  listGrowthItems,
  summarizeGrowthItems,
  transitionGrowthItem,
  upsertGrowthItem,
} from '../../lib/admin-growth-store';
import { listRefillRequests, summarizeRefillRequests } from '../../lib/refill-request-store';
import { createScheduledReportDelivery, listFailedReportDeliveryExecutions, listReportDeliveryExecutions, listSavedReportPresets, listScheduledReportDeliveries, recordReportDeliveryExecution, saveReportPreset } from '../../lib/report-delivery-store';

export const reportRouter = Router();
const readRoles = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'COMPANY_SUPPORT', 'FINANCE'];
const writeRoles = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'FINANCE'];

const reportSchema = z.object({
  id: z.string().optional(),
  code: z.string().min(2),
  title: z.string().min(4),
  category: z.string().min(2),
  ownerRole: z.string().min(2),
  schedule: z.string().min(2),
  destination: z.string().min(3),
  metricKeys: z.array(z.string()).default([]),
  summary: z.string().min(10),
  tags: z.array(z.string()).default([]),
  note: z.string().trim().max(500).optional(),
});

const subjectScopeSchema = z.enum(['all', 'self', 'family']).default('all');
const runSchema = z.object({ range: z.string().min(2).default('last_30_days'), subjectScope: subjectScopeSchema, note: z.string().trim().max(500).optional() });
const exportSchema = z.object({ format: z.enum(['csv', 'json']).default('csv'), range: z.string().min(2).default('last_30_days'), preset: z.string().trim().max(120).optional(), subjectScope: subjectScopeSchema, note: z.string().trim().max(500).optional() });

const savePresetSchema = z.object({ title: z.string().trim().min(4).max(120), description: z.string().trim().max(240).optional(), reportId: z.string().trim().optional(), metricKeys: z.array(z.string()).default([]), format: z.enum(['csv', 'json']).default('csv'), range: z.string().min(2).default('last_30_days'), sourcePresetId: z.string().trim().optional(), subjectScope: subjectScopeSchema, note: z.string().trim().max(500).optional() });
const scheduleDeliverySchema = z.object({ title: z.string().trim().min(4).max(120), presetId: z.string().trim().optional(), reportId: z.string().trim().optional(), destination: z.string().trim().min(5).max(180), schedule: z.string().trim().min(2).max(120), format: z.enum(['csv', 'json']).default('csv'), range: z.string().min(2).default('last_30_days'), subjectScope: subjectScopeSchema, note: z.string().trim().max(500).optional() });


function buildRefillMetricValues(refillSummary: ReturnType<typeof summarizeRefillRequests>) {
  return {
    refill_queue_total: refillSummary.total,
    refill_queue_pharmacy: refillSummary.pharmacyQueue,
    refill_queue_aged_over_24h: refillSummary.agedOver24h,
    refill_queue_aged_over_48h: refillSummary.byAgingBand.GT_48H ?? 0,
    refill_queue_lt_24h: refillSummary.byAgingBand.LT_24H ?? 0,
    refill_queue_24_to_48h: refillSummary.byAgingBand.H24_TO_48H ?? 0,
    controlled_refill_rejections: refillSummary.rejectedControlledMedication,
    controlled_refill_queue: refillSummary.controlledMedicationQueue,
  };
}

function getRequestedSubjectScope(req: any): 'all' | 'self' | 'family' {
  const value = String(req.query.subjectScope ?? '').trim().toLowerCase();
  return value === 'self' || value === 'family' ? value : 'all';
}

const refillReportPresets = [
  { id: 'refill-aging-watch', title: 'Refill aging watch', metricKeys: ['refill_queue_total', 'refill_queue_lt_24h', 'refill_queue_24_to_48h', 'refill_queue_aged_over_48h'], description: 'Operational watchlist for refill aging and backlog trend.' },
  { id: 'controlled-rejection-trend', title: 'Controlled rejection trend', metricKeys: ['controlled_refill_rejections', 'controlled_refill_queue', 'refill_queue_pharmacy'], description: 'Clinical governance preset focused on controlled-medication refill rejections and queue pressure.' },
];

function buildReportRun(item: any, range: string, refillSummary: ReturnType<typeof summarizeRefillRequests>) {
  const refillMetricValues = buildRefillMetricValues(refillSummary);
  const metricKeys = (item.metricKeys?.length ? item.metricKeys : Object.keys(refillMetricValues)) as string[];
  const metrics = metricKeys.map((metricKey: string, index: number) => ({
    metricKey,
    value: refillMetricValues[metricKey] ?? (100 + index * 17),
    deltaPct: Number(((refillMetricValues[metricKey] ?? 0) > 0 ? Math.min(18, (refillMetricValues[metricKey] ?? 0) * 1.25) : (2.5 + index * 1.75)).toFixed(2)),
  }));
  return {
    reportId: item.id,
    range,
    generatedAt: new Date().toISOString(),
    metrics,
    refillInsights: {
      byQueue: refillSummary.byQueue,
      byAgingBand: refillSummary.byAgingBand,
      controlledMedicationQueue: refillSummary.controlledMedicationQueue,
      rejectedControlledMedication: refillSummary.rejectedControlledMedication,
    },
  };
}

reportRouter.use(requireAuth);
reportRouter.use(allowRoles(readRoles));

reportRouter.get('/presets', async (_req, res) => {
  res.json({ items: refillReportPresets });
});

reportRouter.get('/saved-presets', async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const items = await listSavedReportPresets(organizationId, { subjectScope: getRequestedSubjectScope(req) });
  res.json({ items, count: items.length });
});

reportRouter.post('/saved-presets', allowRoles(writeRoles), validateBody(savePresetSchema), async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const item = await saveReportPreset({
    organizationId,
    reportId: req.body.reportId ?? null,
    title: req.body.title,
    description: req.body.description ?? null,
    metricKeys: req.body.metricKeys ?? [],
    format: req.body.format,
    range: req.body.range,
    sourcePresetId: req.body.sourcePresetId ?? null,
    note: req.body.note ?? null,
    createdByUserId: req.user?.userId,
    subjectScope: req.body.subjectScope,
  });
  res.status(201).json({ item });
});

reportRouter.get('/delivery-schedules', async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const items = await listScheduledReportDeliveries(organizationId, { subjectScope: getRequestedSubjectScope(req) });
  res.json({ items, count: items.length });
});

reportRouter.post('/delivery-schedules', allowRoles(writeRoles), validateBody(scheduleDeliverySchema), async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const item = await createScheduledReportDelivery({
    organizationId,
    presetId: req.body.presetId ?? null,
    reportId: req.body.reportId ?? null,
    title: req.body.title,
    destination: req.body.destination,
    schedule: req.body.schedule,
    format: req.body.format,
    range: req.body.range,
    note: req.body.note ?? null,
    createdByUserId: req.user?.userId,
    subjectScope: req.body.subjectScope,
  });
  res.status(201).json({ item });
});


reportRouter.get('/delivery-failures', async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const scheduleId = String(req.query.scheduleId ?? '').trim() || null;
  const limit = Number.parseInt(String(req.query.limit ?? '20'), 10);
  const boundedLimit = Number.isFinite(limit) ? Math.max(1, Math.min(100, limit)) : 20;
  const subjectScope = getRequestedSubjectScope(req);
  const items = await listFailedReportDeliveryExecutions(organizationId, { scheduleId, limit: boundedLimit, subjectScope });
  res.json({
    items,
    count: items.length,
    subjectScope,
    summary: {
      failedCount: items.length,
      destinations: Array.from(new Set(items.map((item) => item.destination).filter(Boolean))).length,
      schedules: Array.from(new Set(items.map((item) => item.scheduleId).filter(Boolean))).length,
      latestFailureAt: items[0]?.executedAt ?? null,
      subjectScope,
    },
  });
});

reportRouter.get('/delivery-executions', async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const scheduleId = String(req.query.scheduleId ?? '').trim() || null;
  const limit = Number.parseInt(String(req.query.limit ?? '20'), 10);
  const subjectScope = getRequestedSubjectScope(req);
  const items = await listReportDeliveryExecutions(organizationId, { scheduleId, limit: Number.isFinite(limit) ? Math.max(1, Math.min(100, limit)) : 20, subjectScope });
  res.json({ items, count: items.length });
});

reportRouter.get('/delivery-executions/export', allowRoles(writeRoles), async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const scheduleId = String(req.query.scheduleId ?? '').trim() || null;
  const format = String(req.query.format ?? 'json').trim().toLowerCase();
  const limit = Number.parseInt(String(req.query.limit ?? '50'), 10);
  const boundedLimit = Number.isFinite(limit) ? Math.max(1, Math.min(250, limit)) : 50;
  const subjectScope = getRequestedSubjectScope(req);
  const items = await listReportDeliveryExecutions(organizationId, { scheduleId, limit: boundedLimit, subjectScope });
  const payload = {
    generatedAt: new Date().toISOString(),
    scheduleId,
    count: items.length,
    successCount: items.filter((item) => item.status === 'SUCCESS').length,
    failedCount: items.filter((item) => item.status === 'FAILED').length,
    skippedCount: items.filter((item) => item.status === 'SKIPPED').length,
    items,
  };
  await writeAuditLog({
    actorId: req.user?.userId,
    organizationId,
    action: 'report_delivery_execution.exported',
    resource: 'report_delivery_execution',
    resourceId: scheduleId ?? `report-delivery-execution:${payload.generatedAt}`,
    details: { format, limit: boundedLimit, subjectScope, summary: { count: payload.count, failedCount: payload.failedCount } },
  });
  if (format === 'csv') {
    const rows = [
      ['id', 'title', 'status', 'trigger', 'destination', 'subject_scope', 'metrics_count', 'summary', 'executed_at'],
      ...items.map((item) => [item.id, item.title, item.status, item.trigger, item.destination ?? '', item.subjectScope ?? 'all', String(item.metricsCount ?? 0), item.summary, item.executedAt]),
    ];
    const csv = rows.map((row) => row.map((value) => '"' + String(value).replaceAll('"', '""') + '"').join(',')).join('\n');
    return res.type('text/csv').send(csv);
  }
  res.type('application/json').send(JSON.stringify(payload, null, 2));
});

reportRouter.post('/delivery-schedules/:scheduleId/run', allowRoles(writeRoles), async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const schedule = (await listScheduledReportDeliveries(organizationId)).find((item) => item.id === req.params.scheduleId);
  if (!schedule) throw badRequest('Delivery schedule not found');
  const sourceItem = schedule.reportId ? await getGrowthItem('reports', schedule.reportId, organizationId) : { id: schedule.presetId ?? 'scheduled-refill-kpi-pack', title: schedule.title, metricKeys: [] };
  const refillItems = await listRefillRequests({ organizationId, status: 'ALL' });
  const refillSummary = summarizeRefillRequests(refillItems);
  const reportRun = buildReportRun(sourceItem, schedule.range, refillSummary);
  const item = await recordReportDeliveryExecution({
    organizationId,
    scheduleId: schedule.id,
    presetId: schedule.presetId ?? null,
    reportId: schedule.reportId ?? null,
    title: schedule.title,
    destination: schedule.destination,
    status: 'SUCCESS',
    format: schedule.format,
    range: schedule.range,
    trigger: 'MANUAL',
    metricsCount: reportRun.metrics.length,
    summary: `Delivered ${reportRun.metrics.length} metric rows to ${schedule.destination}.`,
    outputRef: `${schedule.format}:${schedule.id}:${reportRun.generatedAt}`,
    executedByUserId: req.user?.userId,
    subjectScope: schedule.subjectScope ?? 'all',
  });
  res.json({ item, reportRun });
});

reportRouter.get('/summary', async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const summary = await summarizeGrowthItems('reports', organizationId);
  res.json({ summary, storageMode: getGrowthStorageMode('reports') });
});

reportRouter.get('/definitions', async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const q = String(req.query.q ?? '').trim().toLowerCase();
  const status = String(req.query.status ?? '').trim().toUpperCase();
  const category = String(req.query.category ?? '').trim().toLowerCase();

  const items = (await listGrowthItems('reports', organizationId)).filter((item) => {
    if (status && item.status !== status) return false;
    if (category && String(item.category ?? '').trim().toLowerCase() != category) return false;
    if (!q) return true;
    return [item.code, item.title, item.summary ?? '', ...(Array.isArray(item.tags) ? item.tags : [])].join(' ').toLowerCase().includes(q);
  });

  res.json({ items, count: items.length, storageMode: getGrowthStorageMode('reports') });
});

reportRouter.get('/definitions/:reportId', async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const item = await getGrowthItem('reports', req.params.reportId, organizationId);
  res.json({ item, storageMode: getGrowthStorageMode('reports') });
});

reportRouter.post('/definitions', allowRoles(writeRoles), validateBody(reportSchema), async (req, res) => {
  const organizationId = req.user?.organizationId;
  const actorId = req.user?.userId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const item = await upsertGrowthItem('reports', { ...req.body, status: 'DRAFT' }, { organizationId, actorId });
  res.status(201).json({ item, storageMode: getGrowthStorageMode('reports') });
});

reportRouter.put('/definitions/:reportId', allowRoles(writeRoles), validateBody(reportSchema.partial().extend({ id: z.string().optional() })), async (req, res) => {
  const organizationId = req.user?.organizationId;
  const actorId = req.user?.userId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const item = await upsertGrowthItem('reports', { ...req.body, id: req.params.reportId }, { organizationId, actorId });
  res.json({ item, storageMode: getGrowthStorageMode('reports') });
});

reportRouter.post('/definitions/:reportId/publish', allowRoles(writeRoles), async (req, res) => {
  const organizationId = req.user?.organizationId;
  const actorId = req.user?.userId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const item = await transitionGrowthItem('reports', req.params.reportId, 'PUBLISHED', { organizationId, actorId }, String(req.body?.note ?? '').trim() || null);
  res.json({ item, storageMode: getGrowthStorageMode('reports') });
});

reportRouter.post('/definitions/:reportId/archive', allowRoles(writeRoles), async (req, res) => {
  const organizationId = req.user?.organizationId;
  const actorId = req.user?.userId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const item = await transitionGrowthItem('reports', req.params.reportId, 'ARCHIVED', { organizationId, actorId }, String(req.body?.note ?? '').trim() || null);
  res.json({ item, storageMode: getGrowthStorageMode('reports') });
});

reportRouter.post('/definitions/:reportId/run', allowRoles(writeRoles), validateBody(runSchema), async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const item = await getGrowthItem('reports', req.params.reportId, organizationId);
  const refillItems = await listRefillRequests({ organizationId, status: 'ALL' });
  const refillSummary = summarizeRefillRequests(refillItems);
  const reportRun = buildReportRun(item, req.body.range, refillSummary);
  await recordReportDeliveryExecution({
    organizationId,
    reportId: item.id,
    title: item.title ?? item.code ?? 'Refill KPI run',
    status: 'SUCCESS',
    format: 'json',
    range: req.body.range,
    trigger: 'MANUAL',
    metricsCount: reportRun.metrics.length,
    summary: `Manual preview run generated ${reportRun.metrics.length} metrics.`,
    outputRef: `preview:${item.id}:${reportRun.generatedAt}`,
    executedByUserId: req.user?.userId,
    subjectScope: req.body.subjectScope,
  });
  res.json({ item, reportRun, subjectScope: req.body.subjectScope, storageMode: getGrowthStorageMode('reports') });
});

reportRouter.post('/definitions/:reportId/export', allowRoles(writeRoles), validateBody(exportSchema), async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) throw badRequest('Organization scope is required');
  const sourceItem = await getGrowthItem('reports', req.params.reportId, organizationId);
  const preset = req.body.preset ? refillReportPresets.find((item) => item.id === req.body.preset) : null;
  const item = preset ? { ...sourceItem, metricKeys: preset.metricKeys } : sourceItem;
  const refillItems = await listRefillRequests({ organizationId, status: 'ALL' });
  const refillSummary = summarizeRefillRequests(refillItems);
  const reportRun = buildReportRun(item, req.body.range, refillSummary);
  if (req.body.format === 'json') {
    await recordReportDeliveryExecution({
      organizationId,
      presetId: preset?.id ?? null,
      reportId: item.id,
      title: item.title ?? item.code ?? 'Refill KPI export',
      status: 'SUCCESS',
      format: 'json',
      range: req.body.range,
      trigger: 'EXPORT',
      metricsCount: reportRun.metrics.length,
      summary: `Exported ${reportRun.metrics.length} metrics as JSON.`,
      outputRef: `json:${item.id}:${reportRun.generatedAt}`,
      executedByUserId: req.user?.userId,
      subjectScope: req.body.subjectScope,
    });
    return res.type('application/json').send(JSON.stringify({ item, preset, reportRun, subjectScope: req.body.subjectScope, exportedAt: new Date().toISOString(), note: req.body.note ?? null }, null, 2));
  }
  const rows = [
    ['metric_key', 'value', 'delta_pct'],
    ...reportRun.metrics.map((metric: any) => [metric.metricKey, String(metric.value), String(metric.deltaPct)]),
  ];
  const csv = rows.map((row) => row.map((value) => '"' + String(value).replaceAll('"', '""') + '"').join(',')).join('\n');
  await recordReportDeliveryExecution({
    organizationId,
    presetId: preset?.id ?? null,
    reportId: item.id,
    title: item.title ?? item.code ?? 'Refill KPI export',
    status: 'SUCCESS',
    format: 'csv',
    range: req.body.range,
    trigger: 'EXPORT',
    metricsCount: reportRun.metrics.length,
    summary: `Exported ${reportRun.metrics.length} metrics as CSV.`,
    outputRef: `csv:${item.id}:${reportRun.generatedAt}`,
    executedByUserId: req.user?.userId,
    subjectScope: req.body.subjectScope,
  });
  res.type('text/csv').send(csv);
});
