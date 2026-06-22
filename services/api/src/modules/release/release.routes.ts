import { Router } from 'express';
import {
  releaseRequestApproveSchema,
  releaseRequestCreateSchema,
  releaseRequestRejectSchema,
} from '@care-center/contracts';
import { requireAuth } from '../../middleware/auth';
import { allowRoles } from '../../middleware/rbac';
import { validateBody } from '../../middleware/validate';
import { prisma } from '../../lib/prisma';
import { badRequest, notFound } from '../../lib/http';
import { writeAuditLog } from '../../lib/audit';

export const releaseRouter = Router();
releaseRouter.use(requireAuth);

function labelize(value: string) {
  return value.toLowerCase().split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function serializeRequest(item: any) {
  const patientName = item.patient?.user ? `${item.patient.user.firstName} ${item.patient.user.lastName}`.trim() : null;
  return {
    id: item.id,
    organizationId: item.organizationId,
    patientId: item.patientId,
    patientName,
    requestedByUserId: item.requestedByUserId,
    recipientName: item.recipientName,
    recipientType: labelize(item.recipientType),
    recipientTypeCode: item.recipientType,
    recipientContact: item.recipientContact,
    purpose: labelize(item.purpose),
    purposeCode: item.purpose,
    phiScope: labelize(item.phiScope),
    phiScopeCode: item.phiScope,
    templateId: item.templateId,
    templateName: item.template?.templateName ?? null,
    status: labelize(item.status),
    statusCode: item.status,
    notes: item.notes,
    approvedByUserId: item.approvedByUserId,
    approvedAt: item.approvedAt,
    rejectedByUserId: item.rejectedByUserId,
    rejectedAt: item.rejectedAt,
    rejectionReason: item.rejectionReason,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

releaseRouter.get('/release-requests', allowRoles(['PROVIDER', 'NURSE', 'COMPANY_ADMIN', 'SUPER_ADMIN', 'COMPANY_SUPPORT']), async (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status.toUpperCase() : undefined;
  const patientId = typeof req.query.patientId === 'string' ? req.query.patientId : undefined;
  const where: Record<string, any> = {};

  if (status) {
    where.status = status;
  }
  if (patientId) {
    where.patientId = patientId;
  }
  if (req.user!.organizationId) {
    where.organizationId = req.user!.organizationId;
  }

  const items = await prisma.releaseRequest.findMany({
    where,
    include: {
      patient: {
        include: { user: { select: { firstName: true, lastName: true } } },
      },
      template: { select: { id: true, templateName: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ items: items.map(serializeRequest) });
});

releaseRouter.get('/release-requests/:requestId', allowRoles(['PROVIDER', 'NURSE', 'COMPANY_ADMIN', 'SUPER_ADMIN', 'COMPANY_SUPPORT']), async (req, res) => {
  const item = await prisma.releaseRequest.findUnique({
    where: { id: req.params.requestId },
    include: {
      patient: { include: { user: { select: { firstName: true, lastName: true } } } },
      template: { select: { id: true, templateName: true } },
    },
  });

  if (!item) {
    throw notFound('Release request not found');
  }

  res.json(serializeRequest(item));
});

releaseRouter.post('/release-requests', allowRoles(['PROVIDER', 'NURSE', 'COMPANY_ADMIN', 'SUPER_ADMIN']), validateBody(releaseRequestCreateSchema), async (req, res) => {
  if (req.body.templateId) {
    const template = await prisma.policyTemplate.findUnique({ where: { id: req.body.templateId } });
    if (!template) {
      throw notFound('Policy template not found');
    }
    if (template.status === 'ARCHIVED') {
      throw badRequest('Archived policy templates cannot be used for new release requests');
    }
    if (template.phiScope !== req.body.phiScope) {
      throw badRequest('Release request phiScope must match the selected policy template');
    }
  }

  const patient = await prisma.patientProfile.findUnique({ where: { id: req.body.patientId }, select: { id: true, organizationId: true } });
  if (!patient) {
    throw notFound('Patient profile not found');
  }

  const created = await prisma.releaseRequest.create({
    data: {
      organizationId: patient.organizationId,
      patientId: req.body.patientId,
      requestedByUserId: req.user!.userId,
      recipientName: req.body.recipientName,
      recipientType: req.body.recipientType,
      recipientContact: req.body.recipientContact,
      purpose: req.body.purpose,
      phiScope: req.body.phiScope,
      templateId: req.body.templateId,
      notes: req.body.notes,
    },
    include: {
      patient: { include: { user: { select: { firstName: true, lastName: true } } } },
      template: { select: { id: true, templateName: true } },
    },
  });

  await writeAuditLog({
    actorId: req.user!.userId,
    organizationId: created.organizationId ?? req.user!.organizationId,
    action: 'release.request_created',
    resource: 'release_request',
    resourceId: created.id,
    details: {
      purpose: created.purpose,
      phiScope: created.phiScope,
      recipientType: created.recipientType,
    },
  });

  res.status(201).json(serializeRequest(created));
});

releaseRouter.post('/release-requests/:requestId/approve', allowRoles(['COMPANY_ADMIN', 'SUPER_ADMIN']), validateBody(releaseRequestApproveSchema), async (req, res) => {
  const existing = await prisma.releaseRequest.findUnique({
    where: { id: req.params.requestId },
    include: {
      patient: { include: { user: { select: { firstName: true, lastName: true } } } },
      template: { select: { id: true, templateName: true } },
    },
  });

  if (!existing) {
    throw notFound('Release request not found');
  }
  if (existing.status !== 'PENDING') {
    throw badRequest('Only pending release requests can be approved');
  }

  const updated = await prisma.releaseRequest.update({
    where: { id: existing.id },
    data: {
      status: 'APPROVED',
      approvedByUserId: req.user!.userId,
      approvedAt: new Date(),
      rejectionReason: null,
      rejectedByUserId: null,
      rejectedAt: null,
    },
    include: {
      patient: { include: { user: { select: { firstName: true, lastName: true } } } },
      template: { select: { id: true, templateName: true } },
    },
  });

  await writeAuditLog({
    actorId: req.user!.userId,
    organizationId: updated.organizationId ?? req.user!.organizationId,
    action: 'release.request_approved',
    resource: 'release_request',
    resourceId: updated.id,
    details: {
      note: req.body.note,
      outcome: 'APPROVED',
    },
  });

  res.json(serializeRequest(updated));
});

releaseRouter.post('/release-requests/:requestId/reject', allowRoles(['COMPANY_ADMIN', 'SUPER_ADMIN']), validateBody(releaseRequestRejectSchema), async (req, res) => {
  const existing = await prisma.releaseRequest.findUnique({
    where: { id: req.params.requestId },
    include: {
      patient: { include: { user: { select: { firstName: true, lastName: true } } } },
      template: { select: { id: true, templateName: true } },
    },
  });

  if (!existing) {
    throw notFound('Release request not found');
  }
  if (existing.status !== 'PENDING') {
    throw badRequest('Only pending release requests can be rejected');
  }

  const updated = await prisma.releaseRequest.update({
    where: { id: existing.id },
    data: {
      status: 'REJECTED',
      rejectedByUserId: req.user!.userId,
      rejectedAt: new Date(),
      rejectionReason: req.body.reason,
      approvedByUserId: null,
      approvedAt: null,
    },
    include: {
      patient: { include: { user: { select: { firstName: true, lastName: true } } } },
      template: { select: { id: true, templateName: true } },
    },
  });

  await writeAuditLog({
    actorId: req.user!.userId,
    organizationId: updated.organizationId ?? req.user!.organizationId,
    action: 'release.request_rejected',
    resource: 'release_request',
    resourceId: updated.id,
    details: {
      reason: req.body.reason,
      outcome: 'REJECTED',
    },
  });

  res.json(serializeRequest(updated));
});
