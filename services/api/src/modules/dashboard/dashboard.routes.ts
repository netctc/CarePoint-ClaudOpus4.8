import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { prisma } from '../../lib/prisma';
import { getPatientWorkspaceItem, listPatientWorkspaceItems } from '../../lib/patient-workspace-store';
import { enrichPatientNotificationItems } from '../../lib/refill-notification-enrichment';
import { buildRefillAuditPacket } from '../../lib/refill-audit-packet';
import { listFailedReportDeliveryExecutions } from '../../lib/report-delivery-store';
import { listRefillAuditScopes } from '../../lib/refill-audit-scope-store';
import { listReportDeliveryExecutions } from '../../lib/report-delivery-store';
import { getRefillAgingBand, getRefillOwnershipHistory, listRefillRequests } from '../../lib/refill-request-store';
import { getAppointmentSubjectMeta, listAppointmentSubjectMeta } from '../../lib/appointment-subject-store';
import { formatSubjectSummary, mergeSubjectSummaries, summarizeAppointmentSubjectMeta, summarizeAuditSubjectContexts } from '../../lib/subject-reporting';
import { getPatientContext, getRequestedSubjectProfileId } from '../../lib/patient-context';
import { decryptMedicalJson } from '../../lib/secure-medical-data';
import { ensureAppointmentAccessRecord } from '../../lib/appointment-access-store';

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);

async function getPatientProfileId(userId: string) {
  const profile = await prisma.patientProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  return profile?.id;
}

async function getProviderProfileId(userId: string) {
  const profile = await prisma.providerProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  return profile?.id;
}

async function runSequential<T>(tasks: Array<() => Promise<T>>) {
  const results: T[] = [];
  for (const task of tasks) {
    results.push(await task());
  }
  return results;
}


type MedicalProfilePayload = {
  questionnaire: Record<string, unknown>;
  reports: Array<Record<string, unknown>>;
  shareMedicalDataWithAssignedDoctors: boolean;
  updatedAt?: string | null;
};

function toLocalIso(value: Date | string | null | undefined) {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function compareIsoDesc(left: any, right: any, leftField: string, rightField?: string) {
  const leftValue = toLocalIso(left?.[leftField] ?? left?.updatedAt ?? left?.createdAt) ?? '';
  const rightValue = toLocalIso(right?.[rightField ?? leftField] ?? right?.updatedAt ?? right?.createdAt) ?? '';
  return rightValue.localeCompare(leftValue);
}

function buildQuestionnaireCompletion(questionnaire: Record<string, unknown>) {
  const keys = [
    'bloodType',
    'allergies',
    'chronicConditions',
    'currentMedications',
    'pastSurgeries',
    'smokingStatus',
    'pregnancyStatus',
    'heightCm',
    'weightKg',
    'emergencyNotes',
  ];
  const completed = keys.filter((key) => String(questionnaire[key] ?? '').trim().length > 0).length;
  return {
    completedCount: completed,
    totalCount: keys.length,
    completionRatio: keys.length === 0 ? 0 : completed / keys.length,
  };
}

function buildQuestionnaireSummary(questionnaire: Record<string, unknown>) {
  return [
    questionnaire['bloodType'] ? `Blood type: ${questionnaire['bloodType']}` : null,
    questionnaire['allergies'] ? `Allergies: ${questionnaire['allergies']}` : null,
    questionnaire['currentMedications'] ? `Medications: ${questionnaire['currentMedications']}` : null,
    questionnaire['chronicConditions'] ? `Conditions: ${questionnaire['chronicConditions']}` : null,
  ].filter(Boolean).slice(0, 3).join(' • ');
}

function normalizeQuestionnaireVersion(item: Record<string, any>) {
  const questionnaire = item.questionnaire && typeof item.questionnaire === 'object' ? item.questionnaire as Record<string, unknown> : {};
  return {
    ...item,
    questionnaire,
    submittedAt: item.submittedAt ?? item.updatedAt ?? item.createdAt ?? null,
    summary: item.summary ?? buildQuestionnaireSummary(questionnaire),
    completion: item.completion ?? buildQuestionnaireCompletion(questionnaire),
  };
}

async function buildLegacyQuestionnaireVersion(context: Awaited<ReturnType<typeof getPatientContext>>) {
  if (!context.organizationId) return null;
  let questionnaire: Record<string, unknown> = {};
  let updatedAt: string | null = null;

  if (context.isFamilySubject) {
    const item = await getPatientWorkspaceItem('family_profile', context.subjectProfileId, context.organizationId, context.patientProfileId);
    const fallback = item.medicalProfile && typeof item.medicalProfile === 'object'
      ? item.medicalProfile as MedicalProfilePayload
      : { questionnaire: {}, reports: [], shareMedicalDataWithAssignedDoctors: false };
    const decrypted = decryptMedicalJson<MedicalProfilePayload>(item.medicalDataCipher, fallback);
    questionnaire = decrypted.questionnaire && typeof decrypted.questionnaire === 'object' ? decrypted.questionnaire : {};
    updatedAt = typeof decrypted.updatedAt === 'string' ? decrypted.updatedAt : null;
  } else {
    const profile = await prisma.patientProfile.findUnique({ where: { id: context.patientProfileId } });
    const preferences = profile?.preferences && typeof profile.preferences === 'object' ? profile.preferences as Record<string, any> : {};
    const fallback = preferences.medicalProfile && typeof preferences.medicalProfile === 'object'
      ? preferences.medicalProfile as MedicalProfilePayload
      : { questionnaire: {}, reports: [], shareMedicalDataWithAssignedDoctors: true };
    const decrypted = decryptMedicalJson<MedicalProfilePayload>(preferences.medicalDataCipher, fallback);
    questionnaire = decrypted.questionnaire && typeof decrypted.questionnaire === 'object' ? decrypted.questionnaire : {};
    updatedAt = typeof decrypted.updatedAt === 'string' ? decrypted.updatedAt : null;
  }

  const completion = buildQuestionnaireCompletion(questionnaire);
  if (completion.completedCount === 0) return null;
  return normalizeQuestionnaireVersion({
    id: 'legacy-current',
    versionNumber: 1,
    title: 'Questionnaire v1',
    submittedAt: updatedAt ?? new Date(0).toISOString(),
    updatedAt: updatedAt ?? new Date(0).toISOString(),
    status: 'ACTIVE',
    subjectProfileId: context.subjectProfileId,
    subjectLabel: context.subjectName,
    subjectRelationship: context.subjectRelationship,
    questionnaire,
    source: 'legacy_medical_profile',
  });
}

async function buildPatientHomeSummary(context: Awaited<ReturnType<typeof getPatientContext>>) {
  if (!context.organizationId) {
    return {
      reminders: { items: [], summary: { enabledCount: 0, totalCount: 0 } },
      vitals: { latestReadings: [], latestReading: null, summary: { activeProgramCount: 0, recentReadingCount: 0, alertingCount: 0 } },
      questionnaire: { latest: null, count: 0 },
    };
  }

  const [reminders, rpmPrograms, questionnaireVersions] = await Promise.all([
    listPatientWorkspaceItems('patient_reminder', context.organizationId, context.subjectProfileId),
    listPatientWorkspaceItems('patient_rpm_program', context.organizationId, context.subjectProfileId),
    listPatientWorkspaceItems('patient_questionnaire_version', context.organizationId, context.subjectProfileId),
  ]);

  const sortedReminders = [...reminders].sort((left, right) => compareIsoDesc(left, right, 'updatedAt')).slice(0, 3);
  const rpmReadings = rpmPrograms
    .flatMap((item: any) => Array.isArray(item.readings) ? item.readings : [])
    .sort((left: any, right: any) => compareIsoDesc(left, right, 'time'));
  const normalizedVersions = questionnaireVersions
    .map((item: any) => normalizeQuestionnaireVersion(item))
    .sort((left: any, right: any) => {
      const versionDelta = Number(right.versionNumber ?? 0) - Number(left.versionNumber ?? 0);
      return versionDelta !== 0 ? versionDelta : compareIsoDesc(left, right, 'submittedAt');
    });
  const latestQuestionnaire = normalizedVersions[0] ?? await buildLegacyQuestionnaireVersion(context);

  return {
    reminders: {
      items: sortedReminders,
      summary: {
        enabledCount: reminders.filter((item: any) => item.enabled === true).length,
        totalCount: reminders.length,
      },
    },
    vitals: {
      latestReadings: rpmReadings.slice(0, 8),
      latestReading: rpmReadings[0] ?? null,
      summary: {
        activeProgramCount: rpmPrograms.filter((item: any) => item.programStatus === 'ACTIVE' || item.status === 'ACTIVE').length,
        recentReadingCount: rpmReadings.length,
        alertingCount: rpmReadings.filter((reading: any) => ['warning', 'danger'].includes(String(reading.variant ?? '').toLowerCase())).length,
      },
    },
    questionnaire: {
      latest: latestQuestionnaire,
      count: normalizedVersions.length + (latestQuestionnaire && normalizedVersions.length === 0 ? 1 : 0),
    },
  };
}

function serializeDashboardNextAppointment(item: Record<string, any> | null) {
  if (!item) return null;
  return {
    id: item.id,
    providerName: item.providerName ?? null,
    startsAt: item.startsAt ?? null,
    service: item.service ?? null,
    location: item.location ?? null,
    status: item.status ?? null,
    joinUrl: item.joinUrl ?? null,
    appointmentType: item.appointmentType ?? null,
    subjectProfileId: item.subjectProfileId ?? null,
    subjectLabel: item.subjectLabel ?? null,
    subjectRelationship: item.subjectRelationship ?? null,
  };
}

async function serializeDashboardAppointment(item: any) {
  const subject = await getAppointmentSubjectMeta({
    appointmentId: item.id,
    organizationId: item.organizationId,
    patientId: item.patientId,
  });
  const access = await ensureAppointmentAccessRecord({
    organizationId: item.organizationId,
    appointmentId: item.id,
    patientId: item.patientId,
    providerId: item.providerId,
    subjectProfileId: subject?.subjectProfileId ?? null,
    location: item.location,
  });
  return {
    id: item.id,
    providerName: item.provider ? `${item.provider.user.firstName} ${item.provider.user.lastName}`.trim() : null,
    startsAt: item.startsAt,
    service: item.service,
    location: item.location,
    status: item.status,
    joinUrl: item.telehealthSession?.joinUrl ?? null,
    appointmentType: access.appointmentType,
    subjectProfileId: subject?.subjectProfileId ?? null,
    subjectLabel: subject?.subjectLabel ?? null,
    subjectRelationship: subject?.subjectRelationship ?? null,
  };
}

dashboardRouter.get('/patient', async (req, res) => {
  const userId = req.user!.userId;
  const organizationId = req.user?.organizationId ?? '';
  const requestedSubjectProfileId = getRequestedSubjectProfileId(req);
  const patientContext = await getPatientContext(userId, req.user?.organizationId, requestedSubjectProfileId);
  const patientProfileId = patientContext.patientProfileId;

  const [appointments, records, threads, payments] = await runSequential([
    () => prisma.appointment.count({ where: patientProfileId ? { patientId: patientProfileId } : { id: '__none__' } }),
    () => prisma.medicalRecord.count({ where: patientProfileId ? { patientId: patientProfileId } : { id: '__none__' } }),
    () => prisma.messageThread.count({ where: patientProfileId ? { patientId: patientProfileId } : { id: '__none__' } }),
    () => prisma.payment.count({ where: patientProfileId ? { patientId: patientProfileId } : { id: '__none__' } }),
  ]);

  const [notificationItems, refillItems, appointmentItems, homeSummary] = patientProfileId && organizationId
    ? await Promise.all([
        listPatientWorkspaceItems('patient_notification', organizationId, patientProfileId),
        listRefillRequests({ organizationId, patientId: patientProfileId, status: 'ALL' }),
        prisma.appointment.findMany({
          where: {
            patientId: patientProfileId,
            startsAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
          },
          select: {
            id: true,
            organizationId: true,
            patientId: true,
            providerId: true,
            startsAt: true,
            service: true,
            location: true,
            status: true,
            telehealthSession: { select: { joinUrl: true } },
            provider: { select: { user: { select: { firstName: true, lastName: true } } } },
          },
          orderBy: { startsAt: 'asc' },
          take: 24,
        }),
        buildPatientHomeSummary(patientContext),
      ])
    : [[], [], [], await buildPatientHomeSummary(patientContext)];

  const serializedAppointments = await Promise.all((appointmentItems as any[]).map((item) => serializeDashboardAppointment(item)));
  const filteredAppointments = serializedAppointments.filter((item: any) => requestedSubjectProfileId ? item.subjectProfileId === requestedSubjectProfileId : !item.subjectProfileId);
  const nextAppointment = filteredAppointments
    .filter((item: any) => ['REQUESTED', 'CONFIRMED'].includes(String(item.status ?? '').toUpperCase()))
    .sort((left: any, right: any) => String(left.startsAt ?? '').localeCompare(String(right.startsAt ?? '')))[0] ?? null;

  const enrichedNotificationItems = patientProfileId
    ? await enrichPatientNotificationItems(notificationItems as Record<string, any>[], { organizationId, patientId: patientProfileId })
    : notificationItems;
  const unreadNotifications = enrichedNotificationItems.filter((item: any) => item.read !== true);
  const refillSnapshot = refillItems.slice(0, 3).map((item: any) => ({
    id: item.id,
    prescriptionId: item.prescriptionId,
    status: item.status,
    fulfillmentStatus: item.fulfillmentStatus ?? null,
    queue: item.queue ?? null,
    agingBand: getRefillAgingBand(item),
    controlledMedication: Boolean(item.controlledMedication),
    updatedAt: item.updatedAt ?? item.createdAt,
    timelineCount: Array.isArray(item.timeline) ? item.timeline.length : 0,
    escalated: Boolean(item.escalated),
  }));
  const refillTimelineEvents = refillItems
    .flatMap((item: any) => (item.timeline ?? []).slice(-3).map((event: any) => ({
      id: event.id,
      requestId: item.id,
      prescriptionId: item.prescriptionId,
      label: event.label,
      status: event.status,
      queue: event.queue ?? item.queue ?? null,
      actorRole: event.actorRole ?? null,
      note: event.note ?? null,
      at: event.at,
      controlledMedication: Boolean(item.controlledMedication),
      escalated: Boolean(item.escalated),
    })))
    .sort((a: any, b: any) => (a.at < b.at ? 1 : -1))
    .slice(0, 6);
  const ownershipSummary = refillItems.reduce((acc: { reassignmentCount: number; escalationCount: number; fulfillmentCount: number }, item: any) => {
    const history = getRefillOwnershipHistory(item);
    acc.reassignmentCount += history.filter((entry) => entry.type === 'ASSIGNMENT').length;
    acc.escalationCount += history.filter((entry) => entry.type === 'ESCALATION').length;
    acc.fulfillmentCount += history.filter((entry) => entry.type === 'FULFILLMENT').length;
    return acc;
  }, { reassignmentCount: 0, escalationCount: 0, fulfillmentCount: 0 });
  const governanceSummary = {
    governedCount: refillItems.filter((item: any) => Boolean(item.controlledMedication) || Boolean(item.escalated)).length,
    exportReadyCount: refillItems.filter((item: any) => Boolean(item.controlledMedication) || Boolean(item.escalated) || getRefillOwnershipHistory(item).length > 0).length,
    escalatedControlledCount: refillItems.filter((item: any) => Boolean(item.controlledMedication) && Boolean(item.escalated)).length,
    notes: [
      refillItems.some((item: any) => Boolean(item.controlledMedication)) ? 'Controlled-medication refill activity remains under governed review until provider workflow completes.' : null,
      refillItems.some((item: any) => Boolean(item.escalated)) ? 'Escalated refill requests may appear in governed audit packet exports and require follow-up.' : null,
      ownershipSummary.reassignmentCount > 0 ? `${ownershipSummary.reassignmentCount} ownership change(s) were recorded in your recent refill workflow.` : null,
    ].filter(Boolean),
  };
  const governanceReminders = refillItems
    .filter((item: any) => Boolean(item.controlledMedication) || Boolean(item.escalated) || getRefillOwnershipHistory(item).length > 0)
    .slice(0, 4)
    .map((item: any) => ({
      id: item.id,
      prescriptionId: item.prescriptionId,
      title: item.controlledMedication ? 'Governed refill review' : item.escalated ? 'Escalated refill follow-up' : 'Refill workflow update',
      detail: item.escalated ? 'Your refill is in an escalated review path.' : item.controlledMedication ? 'This prescription requires governed review before fulfillment.' : 'Ownership or review updates were recorded for this refill.',
      queue: item.queue ?? item.assignedRole ?? null,
      status: item.status,
      agingBand: getRefillAgingBand(item),
    }));

  res.json({
    activeSubject: {
      id: patientContext.subjectProfileId,
      label: patientContext.subjectName,
      relationship: patientContext.subjectRelationship,
      kind: patientContext.subjectKind,
      isFamilySubject: patientContext.isFamilySubject,
    },
    kpis: {
      appointments,
      records,
      threads,
      payments,
    },
    nextAppointment: serializeDashboardNextAppointment(nextAppointment),
    notifications: {
      unreadCount: unreadNotifications.length,
      highPriorityCount: enrichedNotificationItems.filter((item: any) => String(item.priority ?? '').toLowerCase() === 'high').length,
      latest: unreadNotifications.slice(0, 3).map((item: any) => ({
        id: item.id,
        title: item.title ?? 'Notification',
        message: item.message ?? item.detail ?? '',
        actionTarget: item.actionTarget ?? null,
        prescriptionId: item.prescriptionId ?? null,
        refillAgingBand: item.refillAgingBand ?? null,
        ownershipHistoryCount: item.ownershipHistoryCount ?? 0,
        ownershipEscalationCount: item.ownershipEscalationCount ?? 0,
        latestOwnershipLabel: item.latestOwnershipLabel ?? null,
      })),
    },
    refillSnapshot: {
      total: refillItems.length,
      activeCount: refillItems.filter((item: any) => !['FULFILLED', 'REJECTED'].includes(String(item.status).toUpperCase())).length,
      escalatedCount: refillItems.filter((item: any) => Boolean(item.escalated)).length,
      latest: refillSnapshot,
    },
    refillHistory: {
      latestEvents: refillTimelineEvents,
      reassignmentCount: ownershipSummary.reassignmentCount,
      escalationCount: ownershipSummary.escalationCount,
      fulfillmentCount: ownershipSummary.fulfillmentCount,
    },
    governanceSummary,
    governanceReminders,
    home: {
      upcomingAppointments: filteredAppointments.slice(0, 3).map((item: any) => serializeDashboardNextAppointment(item)),
      reminders: homeSummary.reminders,
      vitals: homeSummary.vitals,
      questionnaire: homeSummary.questionnaire,
    },
  });
});

dashboardRouter.get('/provider', async (req, res) => {
  const providerProfileId = await getProviderProfileId(req.user!.userId);
  const providerWhere = providerProfileId ? { providerId: providerProfileId } : { id: '__none__' };

  const [appointments, waiting, threads, liveSessions] = await runSequential([
    () => prisma.appointment.count({ where: providerWhere }),
    () => prisma.appointment.count({ where: { ...providerWhere, status: 'REQUESTED' } }),
    () => prisma.messageThread.count({ where: providerProfileId ? { providerId: providerProfileId } : { id: '__none__' } }),
    () => prisma.telehealthSession.count({ where: { appointment: providerWhere, status: 'LIVE' } }),
  ]);

  const queue = providerProfileId
    ? await prisma.appointment.findMany({
        where: providerWhere,
        include: { patient: { include: { user: true } }, payments: true },
        orderBy: { startsAt: 'asc' },
        take: 5,
      })
    : [];
  const [providerAuditPacket, providerFailedDeliveries, recentProviderAudits] = req.user?.organizationId
    ? await Promise.all([
        buildRefillAuditPacket({ organizationId: req.user.organizationId, limit: 30 }),
        listFailedReportDeliveryExecutions(req.user.organizationId, { limit: 4 }),
        prisma.auditLog.findMany({
          where: {
            organizationId: req.user.organizationId,
            OR: providerProfileId ? [{ actorId: req.user!.userId }, { resourceId: providerProfileId }] : [{ actorId: req.user!.userId }],
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        }),
      ])
    : [null, [], []];

  const queueWithSubjects = await Promise.all(queue.map(async (item: any) => {
    const subjectMeta = await getAppointmentSubjectMeta({
      appointmentId: item.id,
      organizationId: item.organizationId ?? req.user?.organizationId,
      patientId: item.patientId,
    });
    return { item, subjectMeta };
  }));

  const subjectSummary = formatSubjectSummary(mergeSubjectSummaries(
    summarizeAppointmentSubjectMeta(queueWithSubjects.map((entry) => entry.subjectMeta).filter(Boolean) as any),
    summarizeAuditSubjectContexts(recentProviderAudits),
  ));

  res.json({
    kpis: {
      todaysAppointments: appointments,
      waitingPatients: waiting,
      unreadMessages: threads,
      openAlerts: liveSessions,
    },
    subjectSummary,
    queue: queueWithSubjects.map(({ item, subjectMeta }: any) => ({
      id: item.id,
      patientName: `${item.patient.user.firstName} ${item.patient.user.lastName}`,
      time: item.startsAt,
      reason: item.service,
      status: item.status,
      paymentState: item.payments[0]?.status ?? 'UNPAID',
      subjectLabel: subjectMeta?.subjectLabel ?? null,
      subjectRelationship: subjectMeta?.subjectRelationship ?? null,
      isFamilySubject: Boolean(subjectMeta?.isFamilySubject),
    })),
    governedRefillSummary: providerAuditPacket
      ? {
          summary: providerAuditPacket.summary,
          governanceNotes: providerAuditPacket.governanceNotes,
          latestFailedDeliveries: providerFailedDeliveries.map((item: any) => ({
            id: item.id,
            title: item.title,
            destination: item.destination ?? null,
            summary: item.summary,
            executedAt: item.executedAt,
          })),
        }
      : null,
  });
});

dashboardRouter.get('/admin', async (req, res) => {
  const organizationId = req.user?.organizationId;
  const orgWhere = organizationId ? { organizationId } : undefined;

  const [users, providers, appointments, payments, liveSessions, audits] = await runSequential([
    () => prisma.user.count({ where: orgWhere }),
    () => prisma.providerProfile.count({ where: orgWhere }),
    () => prisma.appointment.count({ where: orgWhere }),
    () => prisma.payment.aggregate({ where: {}, _sum: { amountMinor: true } }),
    () => prisma.telehealthSession.count({ where: organizationId ? { appointment: { organizationId } } : undefined }),
    () =>
      prisma.auditLog.findMany({
        where: organizationId ? { organizationId } : undefined,
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
  ]);
  const [governedPacket, savedScopes, deliveryExecutions, failedDeliveries, appointmentSubjectMeta] = organizationId
    ? await Promise.all([
        buildRefillAuditPacket({ organizationId, limit: 50 }),
        listRefillAuditScopes(organizationId),
        listReportDeliveryExecutions(organizationId, { limit: 12 }),
        listFailedReportDeliveryExecutions(organizationId, { limit: 5 }),
        listAppointmentSubjectMeta({ organizationId }).then((items) => items.slice(0, 200)),
      ])
    : [null, [], [], [], []];

  const subjectSummary = formatSubjectSummary(mergeSubjectSummaries(
    summarizeAppointmentSubjectMeta(appointmentSubjectMeta as any),
    summarizeAuditSubjectContexts(audits as unknown[]),
  ));

  res.json({
    kpis: {
      users,
      providers,
      appointments,
      revenueMinor: (payments as any)._sum?.amountMinor ?? 0,
      liveSessions,
    },
    audits,
    subjectSummary,
    governedRefillSummary: governedPacket
      ? {
          savedScopeCount: savedScopes.length,
          latestScopeTitle: savedScopes[0]?.title ?? null,
          summary: governedPacket.summary,
          failedDeliveries: deliveryExecutions.filter((item: any) => String(item.status).toUpperCase() === 'FAILED').length,
          governanceNotes: governedPacket.governanceNotes,
          latestFailedDeliveries: failedDeliveries.map((item: any) => ({
            id: item.id,
            title: item.title,
            destination: item.destination ?? null,
            summary: item.summary,
            executedAt: item.executedAt,
          })),
        }
      : null,
  });
});
