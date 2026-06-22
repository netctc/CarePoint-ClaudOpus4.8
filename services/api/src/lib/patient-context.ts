import type { Request } from 'express';
import { badRequest, forbidden, notFound } from './http';
import { prisma } from './prisma';
import { getPatientWorkspaceItem } from './patient-workspace-store';

export async function getPatientContext(userId?: string, organizationId?: string, requestedSubjectProfileId?: string | null) {
  if (!userId) throw forbidden('Authenticated patient user is required');

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      organization: true,
      patientProfile: true,
    },
  });

  if (!user) throw notFound('User not found');
  if (!user.patientProfile) throw forbidden('Patient profile is required');
  if (organizationId && user.organizationId && user.organizationId !== organizationId) {
    throw badRequest('Organization scope mismatch');
  }

  const resolvedOrganizationId = user.organizationId ?? organizationId ?? undefined;
  const normalizedSubjectProfileId = String(requestedSubjectProfileId ?? '').trim();
  let subjectKind: 'self' | 'family' = 'self';
  let subjectProfileId = user.patientProfile.id;
  let subjectName = `${user.firstName} ${user.lastName}`.trim() || user.email;
  let subjectRelationship: string | null = 'Self';

  if (normalizedSubjectProfileId && normalizedSubjectProfileId !== user.patientProfile.id) {
    if (!resolvedOrganizationId) throw badRequest('Organization scope is required for dependent profile access');
    const dependent = await getPatientWorkspaceItem('family_profile', normalizedSubjectProfileId, resolvedOrganizationId, user.patientProfile.id);
    subjectKind = 'family';
    subjectProfileId = dependent.id;
    subjectName = String(dependent.profileName ?? dependent.title ?? 'Family member');
    subjectRelationship = dependent.relationship ? String(dependent.relationship) : null;
  }

  return {
    user,
    organizationId: resolvedOrganizationId,
    organizationName: user.organization?.name ?? 'Organization',
    patientProfileId: user.patientProfile.id,
    patientName: `${user.firstName} ${user.lastName}`.trim() || user.email,
    patientCode: user.patientProfile.patientCode ?? null,
    dateOfBirth: user.patientProfile.dateOfBirth ?? null,
    subjectKind,
    subjectProfileId,
    subjectName,
    subjectRelationship,
    isFamilySubject: subjectKind === 'family',
  };
}

export function getRequestedSubjectProfileId(req: Pick<Request, 'query' | 'body'>) {
  const fromQuery = typeof req.query?.subjectProfileId === 'string' ? req.query.subjectProfileId : '';
  const fromBody = req.body && typeof req.body.subjectProfileId === 'string' ? req.body.subjectProfileId : '';
  const value = String(fromQuery || fromBody || '').trim();
  return value || undefined;
}

export function formatPatientName(person?: { firstName?: string | null; lastName?: string | null } | null) {
  if (!person) return null;
  return `${person.firstName ?? ''} ${person.lastName ?? ''}`.trim() || null;
}

export function toIsoString(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
