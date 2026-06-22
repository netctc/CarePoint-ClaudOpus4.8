import { prisma } from './prisma';
import { withAuditSubjectContext } from './audit-subject-context';
import { withAuditFacilityContext, extractAuditFacilityContext } from './audit-facility-context';

type AuditInput = {
  actorId?: string;
  organizationId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: unknown;
};

async function resolveFacilityDetails(input: AuditInput) {
  const subjectScoped = withAuditSubjectContext(input.details);
  let enriched = withAuditFacilityContext(subjectScoped, input.action, input.resource) as Record<string, unknown> | null;
  if (extractAuditFacilityContext(enriched, input.action, input.resource)?.location) return enriched;

  const detailsRecord = input.details && typeof input.details === 'object' && !Array.isArray(input.details) ? input.details as Record<string, unknown> : null;
  const appointmentId = String(detailsRecord?.appointmentId ?? '').trim() || null;
  const resourceId = String(input.resourceId ?? '').trim() || null;
  let location: string | null = null;

  if (appointmentId) {
    const appointment = await prisma.appointment.findUnique({ where: { id: appointmentId }, select: { location: true } }).catch(() => null);
    location = appointment?.location ?? null;
  }

  if (!location && resourceId && input.resource === 'appointment') {
    const appointment = await prisma.appointment.findUnique({ where: { id: resourceId }, select: { location: true } }).catch(() => null);
    location = appointment?.location ?? null;
  }
  if (!location && resourceId && input.resource === 'medical_record') {
    const record = await prisma.medicalRecord.findUnique({ where: { id: resourceId }, include: { appointment: { select: { location: true } } } }).catch(() => null);
    location = record?.appointment?.location ?? null;
  }
  if (!location && resourceId && ['telehealth_session', 'telehealth_ops', 'telehealth_session_policy', 'telehealth_patient_readiness'].includes(input.resource)) {
    const session = await prisma.telehealthSession.findUnique({ where: { id: resourceId }, include: { appointment: { select: { location: true } } } }).catch(() => null);
    location = session?.appointment?.location ?? null;
  }
  if (!location && resourceId && input.resource === 'payment') {
    const payment = await prisma.payment.findUnique({ where: { id: resourceId }, include: { appointment: { select: { location: true } } } }).catch(() => null);
    location = payment?.appointment?.location ?? null;
  }

  if (!location) return enriched;
  const next = { ...(enriched ?? {}) };
  const currentFacility = next.facilityContext && typeof next.facilityContext === 'object' && !Array.isArray(next.facilityContext) ? next.facilityContext as Record<string, unknown> : {};
  next.location = typeof next.location === 'string' && next.location.trim() ? next.location : location;
  next.facilityContext = { ...currentFacility, location: typeof currentFacility.location === 'string' && currentFacility.location ? currentFacility.location : location };
  return next;
}

export async function writeAuditLog(input: AuditInput) {
  return prisma.auditLog.create({
    data: {
      actorId: input.actorId,
      organizationId: input.organizationId,
      action: input.action,
      resource: input.resource,
      resourceId: input.resourceId,
      details: (await resolveFacilityDetails(input) as object | null) ?? undefined,
    },
  });
}
