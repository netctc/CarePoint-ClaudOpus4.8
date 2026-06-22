import { badRequest, forbidden, notFound } from './http';
import { prisma } from './prisma';
import { resolveHspAccessForProvider } from './hsp-access';

export async function getProviderContext(userId?: string, organizationId?: string) {
  if (!userId) throw forbidden('Authenticated provider user is required');

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      organization: true,
      providerProfile: true,
    },
  });

  if (!user) throw notFound('User not found');
  if (!user.providerProfile) throw forbidden('Provider profile is required');
  if (organizationId && user.organizationId && user.organizationId !== organizationId) {
    throw badRequest('Organization scope mismatch');
  }

  const resolvedOrganizationId = user.organizationId ?? organizationId ?? undefined;
  const organizationName = user.organization?.name ?? 'Organization';
  const hspAccess = await resolveHspAccessForProvider({
    providerProfileId: user.providerProfile.id,
    organizationId: resolvedOrganizationId,
    organizationName,
    role: user.role,
  });

  return {
    user,
    organizationId: resolvedOrganizationId,
    organizationName,
    providerProfileId: user.providerProfile.id,
    providerName: `${user.firstName} ${user.lastName}`.trim() || user.email,
    specialty: user.providerProfile.specialty ?? null,
    licenseNumber: user.providerProfile.licenseNumber ?? null,
    hspAccess,
  };
}

export function formatPersonName(person?: { firstName?: string | null; lastName?: string | null } | null) {
  if (!person) return null;
  return `${person.firstName ?? ''} ${person.lastName ?? ''}`.trim() || null;
}

export function toIsoString(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
