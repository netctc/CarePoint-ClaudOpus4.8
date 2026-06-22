import { Router } from 'express';
import { z } from 'zod';
import { localeCodeSchema, telehealthSessionCreateSchema } from '@care-center/contracts';
import { requireAuth } from '../../middleware/auth';
import { allowRoles } from '../../middleware/rbac';
import { validateBody } from '../../middleware/validate';
import { badRequest, forbidden, notFound } from '../../lib/http';
import { prisma } from '../../lib/prisma';
import { env } from '../../lib/env';
import { writeAuditLog } from '../../lib/audit';
import { getPatientContext } from '../../lib/patient-context';
import { getProviderContext } from '../../lib/provider-context';
import { filterItemsByHspFacility, requireLocationWithinHspAccess } from '../../lib/hsp-access';
import { getTelehealthPatientReadiness, getTelehealthPolicySnapshot, hasAcceptedTelehealthConsent } from '../../lib/ksa-compliance';

function buildJoinUrl(meetingId: string) {
  if (env.telehealthVendor === 'daily') return `https://your-daily-domain.daily.co/${meetingId}`;
  return `https://telehealth.local/session/${meetingId}`;
}

export const telehealthRouter = Router();
telehealthRouter.use(requireAuth);
const adminReadRoles = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'COMPANY_SUPPORT', 'PROVIDER', 'NURSE'];
const adminWriteRoles = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'COMPANY_SUPPORT'];

const escalationSchema = z.object({ severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'), reasonCode: z.string().trim().min(2).max(100), note: z.string().trim().max(500).optional() });
const readinessSchema = z.object({ disclaimerAccepted: z.boolean(), recordingConsentAccepted: z.boolean().optional(), deviceCheckCompleted: z.boolean().default(false), locale: localeCodeSchema.default('en') });
const sessionPolicySchema = z.object({ disclaimerVersion: z.string().trim().min(2).max(40).default('v1.0'), recordingEnabled: z.boolean().default(false), recordingRequiresConsent: z.boolean().default(true), locale: localeCodeSchema.default('en') });

async function getPatientProfileId(userId: string) {
  const profile = await prisma.patientProfile.findUnique({ where: { userId }, select: { id: true } });
  return profile?.id;
}
async function getProviderProfileId(userId: string) {
  const profile = await prisma.providerProfile.findUnique({ where: { userId }, select: { id: true } });
  return profile?.id;
}

function mapSession(item: any) {
  return {
    id: item.id,
    appointmentId: item.appointmentId,
    vendor: item.vendor,
    meetingId: item.meetingId,
    joinUrl: item.joinUrl,
    status: item.status,
    scheduledAt: item.scheduledAt,
    startedAt: item.startedAt,
    endedAt: item.endedAt,
    patientName: item.appointment?.patient ? `${item.appointment.patient.user.firstName} ${item.appointment.patient.user.lastName}`.trim() : null,
    providerName: item.appointment?.provider ? `${item.appointment.provider.user.firstName} ${item.appointment.provider.user.lastName}`.trim() : null,
    service: item.appointment?.service ?? null,
    location: item.appointment?.location ?? null,
    organizationId: item.appointment?.organizationId ?? null,
  };
}

async function getScopedSession(sessionId: string, organizationId?: string) {
  const item = await prisma.telehealthSession.findUnique({ where: { id: sessionId }, include: { appointment: { include: { patient: { include: { user: true } }, provider: { include: { user: true } } } } } });
  if (!item || (organizationId && item.appointment.organizationId !== organizationId)) throw notFound('Telehealth session not found');
  return item;
}

async function getSessionAuditTrail(sessionId: string, organizationId?: string) {
  return prisma.auditLog.findMany({ where: { organizationId, OR: [{ resource: 'telehealth_session', resourceId: sessionId }, { resource: 'telehealth_ops', resourceId: sessionId }, { resource: 'telehealth_session_policy', resourceId: sessionId }, { resource: 'telehealth_patient_readiness', resourceId: sessionId }] }, orderBy: { createdAt: 'desc' }, take: 25 });
}

telehealthRouter.get('/sessions', async (req, res) => {
  const role = req.user!.role;
  const patientProfileId = role === 'PATIENT' ? await getPatientProfileId(req.user!.userId) : undefined;
  const providerProfileId = ['PROVIDER', 'NURSE'].includes(role) ? await getProviderProfileId(req.user!.userId) : undefined;
  const location = String(req.query.location ?? '').trim() || null;
  const providerContext = ['PROVIDER', 'NURSE'].includes(role) ? await getProviderContext(req.user?.userId, req.user?.organizationId) : null;
  if (providerContext && location) requireLocationWithinHspAccess(providerContext.hspAccess, location, 'Requested telehealth facility');
  const items = await prisma.telehealthSession.findMany({ where: role === 'PATIENT' ? { appointment: { patientId: patientProfileId ?? '__none__' } } : providerProfileId ? { appointment: { providerId: providerProfileId } } : req.user?.organizationId ? { appointment: { organizationId: req.user.organizationId } } : undefined, include: { appointment: { include: { patient: { include: { user: true } }, provider: { include: { user: true } } } } }, orderBy: { createdAt: 'desc' } });
  const mapped = items.map(mapSession);
  const scoped = providerContext ? filterItemsByHspFacility(providerContext.hspAccess, mapped, (item: any) => item.location).filter((item: any) => !location || String(item.location ?? '').toLowerCase().includes(location.toLowerCase())) : mapped;
  const withPolicy = await Promise.all(scoped.map(async (item) => ({ ...item, policy: await getTelehealthPolicySnapshot(item.id, item.organizationId ?? req.user?.organizationId) })));
  res.json({ items: withPolicy, locationFilter: location, hspAccess: providerContext?.hspAccess ?? null });
});

telehealthRouter.get('/sessions/:sessionId/patient-readiness', allowRoles(['PATIENT', 'PROVIDER', 'NURSE', 'COMPANY_ADMIN', 'COMPANY_SUPPORT']), async (req, res) => {
  const item = await getScopedSession(req.params.sessionId, req.user?.organizationId);
  const patientContext = req.user?.role === 'PATIENT' ? await getPatientContext(req.user?.userId, req.user?.organizationId) : null;
  if (req.user?.role === 'PATIENT' && patientContext?.patientProfileId !== item.appointment.patientId) throw forbidden('Patient session scope mismatch');
  const readiness = await getTelehealthPatientReadiness(item.id, item.appointment.organizationId, item.appointment.patientId);
  const policy = await getTelehealthPolicySnapshot(item.id, item.appointment.organizationId);
  res.json({ readiness, policy });
});

telehealthRouter.put('/sessions/:sessionId/patient-readiness', allowRoles(['PATIENT']), validateBody(readinessSchema), async (req, res) => {
  const item = await getScopedSession(req.params.sessionId, req.user?.organizationId);
  const patientContext = await getPatientContext(req.user?.userId, req.user?.organizationId);
  if (patientContext.patientProfileId !== item.appointment.patientId) throw forbidden('Patient session scope mismatch');
  const policy = await getTelehealthPolicySnapshot(item.id, item.appointment.organizationId);
  const telehealthConsentAccepted = await hasAcceptedTelehealthConsent(item.appointment.organizationId, item.appointment.patientId);
  if (!telehealthConsentAccepted) throw badRequest('Telehealth consent must be accepted before waiting-room readiness can be saved.');
  if (!req.body.disclaimerAccepted) throw badRequest('Telehealth disclaimer must be accepted before joining the session.');
  if (policy.recordingEnabled && policy.recordingRequiresConsent && !req.body.recordingConsentAccepted) throw badRequest('Recording consent must be accepted before joining a recorded session.');
  const snapshot = { sessionId: item.id, patientId: patientContext.patientProfileId, disclaimerAccepted: req.body.disclaimerAccepted, disclaimerAcceptedAt: req.body.disclaimerAccepted ? new Date().toISOString() : null, recordingConsentAccepted: req.body.recordingConsentAccepted ?? false, recordingConsentAcceptedAt: req.body.recordingConsentAccepted ? new Date().toISOString() : null, deviceCheckCompleted: req.body.deviceCheckCompleted, locale: req.body.locale };
  await writeAuditLog({ actorId: req.user?.userId, organizationId: item.appointment.organizationId, action: 'telehealth.patient_readiness_updated', resource: 'telehealth_patient_readiness', resourceId: item.id, details: { snapshot } });
  res.json({ readiness: snapshot, policy });
});

telehealthRouter.post('/sessions/:sessionId/join', allowRoles(['PATIENT', 'PROVIDER', 'NURSE']), async (req, res) => {
  const item = await getScopedSession(req.params.sessionId, req.user?.organizationId);
  const policy = await getTelehealthPolicySnapshot(item.id, item.appointment.organizationId);
  if (req.user?.role === 'PATIENT') {
    const patientContext = await getPatientContext(req.user?.userId, req.user?.organizationId);
    if (patientContext.patientProfileId !== item.appointment.patientId) throw forbidden('Patient session scope mismatch');
    const readiness = await getTelehealthPatientReadiness(item.id, item.appointment.organizationId, patientContext.patientProfileId);
    const telehealthConsentAccepted = await hasAcceptedTelehealthConsent(item.appointment.organizationId, patientContext.patientProfileId);
    if (!telehealthConsentAccepted) throw badRequest('Telehealth consent must be accepted before joining.');
    if (!readiness.disclaimerAccepted) throw badRequest('Telehealth disclaimer must be accepted before joining.');
    if (policy.recordingEnabled && policy.recordingRequiresConsent && !readiness.recordingConsentAccepted) throw badRequest('Recording consent must be accepted before joining a recorded session.');
  }
  await writeAuditLog({ actorId: req.user?.userId, organizationId: item.appointment.organizationId, action: 'telehealth.join_authorized', resource: 'telehealth_session', resourceId: item.id, details: { role: req.user?.role, policy } });
  res.json({ ok: true, joinUrl: item.joinUrl, policy });
});

telehealthRouter.get('/operations/summary', allowRoles(adminReadRoles), async (req, res) => {
  const organizationId = req.user?.organizationId;
  const items = await prisma.telehealthSession.findMany({ where: organizationId ? { appointment: { organizationId } } : undefined, include: { appointment: true } });
  const escalations = await prisma.auditLog.count({ where: { organizationId, action: 'telehealth.escalated', createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } });
  const summary = items.reduce((acc, item) => { acc.total += 1; acc.byStatus[item.status] = (acc.byStatus[item.status] ?? 0) + 1; acc.byVendor[item.vendor] = (acc.byVendor[item.vendor] ?? 0) + 1; if (item.status === 'LIVE') acc.live += 1; return acc; }, { total: 0, live: 0, escalationsLast7d: escalations, byStatus: {} as Record<string, number>, byVendor: {} as Record<string, number> });
  res.json({ summary });
});

telehealthRouter.get('/operations/sessions', allowRoles(adminReadRoles), async (req, res) => {
  const organizationId = req.user?.organizationId;
  const q = String(req.query.q ?? '').trim().toLowerCase();
  const status = String(req.query.status ?? '').trim().toUpperCase();
  const vendor = String(req.query.vendor ?? '').trim().toLowerCase();
  const items = (await prisma.telehealthSession.findMany({ where: organizationId ? { appointment: { organizationId } } : undefined, include: { appointment: { include: { patient: { include: { user: true } }, provider: { include: { user: true } } } } }, orderBy: { createdAt: 'desc' } })).map(mapSession).filter((item) => { if (status && item.status !== status) return false; if (vendor && String(item.vendor).toLowerCase() !== vendor) return false; if (!q) return true; return [item.id, item.patientName ?? '', item.providerName ?? '', item.service ?? '', item.vendor ?? ''].join(' ').toLowerCase().includes(q); });
  res.json({ items, count: items.length });
});

telehealthRouter.get('/operations/sessions/:sessionId', allowRoles(adminReadRoles), async (req, res) => {
  const item = await getScopedSession(req.params.sessionId, req.user?.organizationId);
  const auditTrail = await getSessionAuditTrail(item.id, req.user?.organizationId);
  const policy = await getTelehealthPolicySnapshot(item.id, item.appointment.organizationId);
  const readiness = await getTelehealthPatientReadiness(item.id, item.appointment.organizationId, item.appointment.patientId);
  res.json({ item: mapSession(item), policy, readiness, auditTrail });
});

telehealthRouter.put('/operations/sessions/:sessionId/compliance-policy', allowRoles(adminWriteRoles), validateBody(sessionPolicySchema), async (req, res) => {
  const item = await getScopedSession(req.params.sessionId, req.user?.organizationId);
  const snapshot = { sessionId: item.id, disclaimerVersion: req.body.disclaimerVersion, recordingEnabled: req.body.recordingEnabled, recordingRequiresConsent: req.body.recordingRequiresConsent, locale: req.body.locale };
  await writeAuditLog({ actorId: req.user?.userId, organizationId: item.appointment.organizationId, action: 'telehealth.policy_updated', resource: 'telehealth_session_policy', resourceId: item.id, details: { snapshot } });
  res.json({ policy: snapshot });
});

telehealthRouter.post('/sessions', allowRoles(['PROVIDER', 'NURSE', 'COMPANY_ADMIN', 'COMPANY_SUPPORT']), validateBody(telehealthSessionCreateSchema), async (req, res) => {
  const meetingId = `appt-${req.body.appointmentId}`;
  const created = await prisma.telehealthSession.upsert({ where: { appointmentId: req.body.appointmentId }, update: { status: 'READY', joinUrl: buildJoinUrl(meetingId), scheduledAt: req.body.scheduledAt ? new Date(req.body.scheduledAt) : undefined }, create: { appointmentId: req.body.appointmentId, vendor: env.telehealthVendor, meetingId, joinUrl: buildJoinUrl(meetingId), status: 'READY', scheduledAt: req.body.scheduledAt ? new Date(req.body.scheduledAt) : undefined } });
  await writeAuditLog({ actorId: req.user?.userId, organizationId: req.user?.organizationId, action: 'telehealth.session_prepared', resource: 'telehealth_session', resourceId: created.id, details: { appointmentId: req.body.appointmentId } });
  await writeAuditLog({ actorId: req.user?.userId, organizationId: req.user?.organizationId, action: 'telehealth.policy_updated', resource: 'telehealth_session_policy', resourceId: created.id, details: { snapshot: { sessionId: created.id, disclaimerVersion: 'v1.0', recordingEnabled: false, recordingRequiresConsent: true, locale: 'en' } } });
  res.status(201).json(created);
});

telehealthRouter.post('/sessions/:sessionId/start', allowRoles(['PROVIDER', 'NURSE']), async (req, res) => { const updated = await prisma.telehealthSession.update({ where: { id: req.params.sessionId }, data: { status: 'LIVE', startedAt: new Date() } }); res.json(updated); });
telehealthRouter.post('/sessions/:sessionId/end', allowRoles(['PROVIDER', 'NURSE']), async (req, res) => { const updated = await prisma.telehealthSession.update({ where: { id: req.params.sessionId }, data: { status: 'ENDED', endedAt: new Date() } }); res.json(updated); });

telehealthRouter.post('/operations/sessions/:sessionId/mark-live', allowRoles(adminWriteRoles), async (req, res) => {
  const existing = await getScopedSession(req.params.sessionId, req.user?.organizationId);
  const updated = await prisma.telehealthSession.update({ where: { id: existing.id }, data: { status: 'LIVE', startedAt: existing.startedAt ?? new Date() }, include: { appointment: { include: { patient: { include: { user: true } }, provider: { include: { user: true } } } } } });
  await writeAuditLog({ actorId: req.user?.userId, organizationId: req.user?.organizationId, action: 'telehealth.marked_live', resource: 'telehealth_ops', resourceId: updated.id, details: { previousStatus: existing.status } });
  res.json({ item: mapSession(updated) });
});

telehealthRouter.post('/operations/sessions/:sessionId/end', allowRoles(adminWriteRoles), async (req, res) => {
  const existing = await getScopedSession(req.params.sessionId, req.user?.organizationId);
  const updated = await prisma.telehealthSession.update({ where: { id: existing.id }, data: { status: 'ENDED', endedAt: new Date() }, include: { appointment: { include: { patient: { include: { user: true } }, provider: { include: { user: true } } } } } });
  await writeAuditLog({ actorId: req.user?.userId, organizationId: req.user?.organizationId, action: 'telehealth.ended_by_ops', resource: 'telehealth_ops', resourceId: updated.id, details: { previousStatus: existing.status, note: String(req.body?.note ?? '').trim() || null } });
  res.json({ item: mapSession(updated) });
});

telehealthRouter.post('/operations/sessions/:sessionId/restart-room', allowRoles(adminWriteRoles), async (req, res) => {
  const existing = await getScopedSession(req.params.sessionId, req.user?.organizationId);
  const meetingId = `${existing.meetingId}-r${Date.now()}`;
  const updated = await prisma.telehealthSession.update({ where: { id: existing.id }, data: { meetingId, joinUrl: buildJoinUrl(meetingId), status: 'READY', startedAt: null, endedAt: null }, include: { appointment: { include: { patient: { include: { user: true } }, provider: { include: { user: true } } } } } });
  await writeAuditLog({ actorId: req.user?.userId, organizationId: req.user?.organizationId, action: 'telehealth.room_restarted', resource: 'telehealth_ops', resourceId: updated.id, details: { previousMeetingId: existing.meetingId, nextMeetingId: meetingId } });
  res.json({ item: mapSession(updated) });
});

telehealthRouter.post('/operations/sessions/:sessionId/escalate', allowRoles(adminWriteRoles), validateBody(escalationSchema), async (req, res) => {
  const existing = await getScopedSession(req.params.sessionId, req.user?.organizationId);
  await writeAuditLog({ actorId: req.user?.userId, organizationId: req.user?.organizationId, action: 'telehealth.escalated', resource: 'telehealth_ops', resourceId: existing.id, details: { severity: req.body.severity, reasonCode: req.body.reasonCode, note: req.body.note ?? null, appointmentId: existing.appointmentId } });
  res.status(202).json({ ok: true, sessionId: existing.id });
});
