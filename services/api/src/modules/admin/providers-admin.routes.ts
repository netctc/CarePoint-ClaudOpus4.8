import { Router } from 'express';
import { iamMiddlewareChain } from '../../middleware/rbac';
import { prisma } from '../../lib/prisma';

export const providersAdminRouter = Router();

const adminRoles = ['SUPER_ADMIN', 'COMPANY_ADMIN'];

// ---------------------------------------------------------------------------
// Helper: Compute status indicators for a provider
// ---------------------------------------------------------------------------

interface StatusIndicatorInput {
  userStatus: string;
  publishedSlotsToday: number;
  upcomingAppointments: number;
  totalSlotsToday: number;
  bookedSlotsToday: number;
  onboardingStatus?: string | null;
  lastActivityAt?: Date | null;
}

function computeStatusIndicators(input: StatusIndicatorInput): string[] {
  const indicators: string[] = [];

  // Active / Inactive based on user account status
  if (input.userStatus === 'ACTIVE') {
    indicators.push('Active');
  } else {
    indicators.push('Inactive');
  }

  // Currently Online: provider had activity in the last hour (approximation)
  if (input.lastActivityAt) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    if (new Date(input.lastActivityAt) >= oneHourAgo) {
      indicators.push('Currently Online');
    }
  }

  // Scheduled Appointments
  if (input.upcomingAppointments > 0) {
    indicators.push('Has Scheduled Appointments');
  } else {
    indicators.push('No Scheduled Appointments');
  }

  // Available Today / Fully Booked
  if (input.publishedSlotsToday > 0) {
    if (input.bookedSlotsToday >= input.totalSlotsToday) {
      indicators.push('Fully Booked');
    } else {
      indicators.push('Available Today');
    }
  }

  // Available for New Patients: active + has available slots + onboarding approved
  if (
    input.userStatus === 'ACTIVE' &&
    input.publishedSlotsToday > 0 &&
    input.bookedSlotsToday < input.totalSlotsToday &&
    (!input.onboardingStatus || input.onboardingStatus === 'APPROVED')
  ) {
    indicators.push('Available for New Patients');
  }

  return indicators;
}

// ---------------------------------------------------------------------------
// GET /api/admin/providers
// Provider Management Center — list with comprehensive filters, pagination, sort
// ---------------------------------------------------------------------------

providersAdminRouter.get(
  '/providers',
  ...iamMiddlewareChain(adminRoles),
  async (req: any, res: any) => {
    const organizationId: string | undefined = req.user?.organizationId;

    // Pagination
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
    const skip = (page - 1) * limit;

    // Sort
    const sortBy = (req.query.sortBy as string) || 'createdAt';
    const sortOrder = (req.query.sortOrder as string) === 'asc' ? 'asc' : 'desc';

    // Build dynamic where clause
    const where: any = {};
    if (organizationId) {
      where.organizationId = organizationId;
    }

    // Name filter (searches firstName + lastName)
    const name = (req.query.name as string)?.trim();

    // Provider type (role catalog code or user role)
    const type = (req.query.type as string)?.trim();

    // Specialty filter
    const specialty = (req.query.specialty as string)?.trim();
    if (specialty) {
      where.specialty = { contains: specialty, mode: 'insensitive' };
    }

    // License number filter
    const license = (req.query.license as string)?.trim();
    if (license) {
      where.licenseNumber = { contains: license, mode: 'insensitive' };
    }

    // User-level filters
    const userWhere: any = {};
    const email = (req.query.email as string)?.trim();
    if (email) {
      userWhere.email = { contains: email, mode: 'insensitive' };
    }

    // Status filter (active/inactive maps to user account status)
    const status = (req.query.status as string)?.trim()?.toUpperCase();
    if (status === 'ACTIVE' || status === 'INACTIVE') {
      userWhere.status = status === 'ACTIVE' ? 'ACTIVE' : { not: 'ACTIVE' };
    }

    // Gender filter (stored in user profile metadata or services JSON — filter post-query)
    const gender = (req.query.gender as string)?.trim();

    // Name filter via user firstName/lastName
    if (name) {
      userWhere.OR = [
        { firstName: { contains: name, mode: 'insensitive' } },
        { lastName: { contains: name, mode: 'insensitive' } },
      ];
    }

    if (Object.keys(userWhere).length > 0) {
      where.user = { is: userWhere };
    }

    // Role catalog based type filter
    if (type) {
      where.roleCatalog = { code: { contains: type, mode: 'insensitive' } };
    }

    // Build orderBy
    let orderBy: any;
    switch (sortBy) {
      case 'name':
        orderBy = { user: { firstName: sortOrder } };
        break;
      case 'email':
        orderBy = { user: { email: sortOrder } };
        break;
      case 'specialty':
        orderBy = { specialty: sortOrder };
        break;
      case 'status':
        orderBy = { user: { status: sortOrder } };
        break;
      default:
        orderBy = { user: { createdAt: sortOrder } };
        break;
    }

    // Execute queries: count + paginated fetch
    const [total, profiles] = await Promise.all([
      prisma.providerProfile.count({ where }),
      prisma.providerProfile.findMany({
        where,
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true, role: true, status: true, createdAt: true, updatedAt: true } },
          organization: { select: { name: true } },
          roleCatalog: { select: { code: true, label: true } },
          onboardingState: { select: { status: true } },
        },
        orderBy,
        skip,
        take: limit,
      }),
    ]);

    // Get today's date range for slot/appointment queries
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    const now = new Date();

    // Batch fetch published slots and appointments for status indicators
    const providerIds = profiles.map((p: any) => p.id);

    const [todaySlots, upcomingAppointments, recentAppointments] = await Promise.all([
      prisma.publishedSlot.findMany({
        where: {
          providerId: { in: providerIds },
          startsAt: { gte: todayStart, lte: todayEnd },
        },
        select: { providerId: true, status: true, bookedCount: true, capacity: true },
      }),
      prisma.appointment.findMany({
        where: {
          providerId: { in: providerIds },
          startsAt: { gt: now },
          status: { in: ['REQUESTED', 'CONFIRMED'] },
        },
        select: { providerId: true },
      }),
      // Recent activity for "Currently Online" approximation
      prisma.appointment.findMany({
        where: {
          providerId: { in: providerIds },
          updatedAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
        },
        select: { providerId: true, updatedAt: true },
      }),
    ]);

    // Group slots by provider
    const slotsByProvider = new Map<string, { total: number; booked: number; available: number }>();
    for (const slot of todaySlots) {
      const existing = slotsByProvider.get(slot.providerId) || { total: 0, booked: 0, available: 0 };
      existing.total += slot.capacity;
      existing.booked += slot.bookedCount;
      if (slot.status === 'AVAILABLE') existing.available++;
      slotsByProvider.set(slot.providerId, existing);
    }

    // Group upcoming appointments by provider
    const appointmentsByProvider = new Map<string, number>();
    for (const appt of upcomingAppointments) {
      appointmentsByProvider.set(appt.providerId, (appointmentsByProvider.get(appt.providerId) || 0) + 1);
    }

    // Recent activity by provider (last update as proxy for "online")
    const lastActivityByProvider = new Map<string, Date>();
    for (const appt of recentAppointments) {
      const existing = lastActivityByProvider.get(appt.providerId);
      if (!existing || appt.updatedAt > existing) {
        lastActivityByProvider.set(appt.providerId, appt.updatedAt);
      }
    }

    // Post-query filters that can't be done at DB level
    let items = profiles.map((profile: any) => {
      const slots = slotsByProvider.get(profile.id) || { total: 0, booked: 0, available: 0 };
      const upcomingCount = appointmentsByProvider.get(profile.id) || 0;
      const lastActivity = lastActivityByProvider.get(profile.id) || null;

      const statusIndicators = computeStatusIndicators({
        userStatus: profile.user.status,
        publishedSlotsToday: slots.available,
        upcomingAppointments: upcomingCount,
        totalSlotsToday: slots.total,
        bookedSlotsToday: slots.booked,
        onboardingStatus: profile.onboardingState?.status,
        lastActivityAt: lastActivity,
      });

      return {
        id: profile.id,
        userId: profile.userId,
        name: `${profile.user.firstName} ${profile.user.lastName}`.trim(),
        firstName: profile.user.firstName,
        lastName: profile.user.lastName,
        email: profile.user.email,
        role: profile.roleCatalog?.code ?? profile.user.role,
        roleLabel: profile.roleCatalog?.label ?? profile.user.role,
        status: profile.user.status,
        organizationId: profile.organizationId,
        organizationName: profile.organization?.name ?? null,
        specialty: profile.specialty,
        licenseNumber: profile.licenseNumber,
        services: Array.isArray(profile.services) ? profile.services : [],
        onboardingStatus: profile.onboardingState?.status ?? null,
        statusIndicators,
        createdAt: profile.user.createdAt,
        updatedAt: profile.user.updatedAt,
      };
    });

    // Apply post-query filters that require computed data
    const medicalCenter = (req.query.medicalCenter as string)?.trim();
    const department = (req.query.department as string)?.trim();
    const phone = (req.query.phone as string)?.trim();
    const country = (req.query.country as string)?.trim();
    const state = (req.query.state as string)?.trim();
    const city = (req.query.city as string)?.trim();
    const languages = (req.query.languages as string)?.trim();
    const yearsOfExperience = req.query.yearsOfExperience ? parseInt(req.query.yearsOfExperience as string, 10) : undefined;
    const verified = (req.query.verified as string)?.trim();
    const acceptingNewPatients = (req.query.acceptingNewPatients as string)?.trim();
    const calendarAvailability = (req.query.calendarAvailability as string)?.trim();

    // Availability filters (online/inPerson/homeVisit)
    const availabilityOnline = (req.query.online as string)?.trim();
    const availabilityInPerson = (req.query.inPerson as string)?.trim();
    const availabilityHomeVisit = (req.query.homeVisit as string)?.trim();

    // Filter by computed status indicators
    if (acceptingNewPatients === 'true') {
      items = items.filter((item: any) => item.statusIndicators.includes('Available for New Patients'));
    } else if (acceptingNewPatients === 'false') {
      items = items.filter((item: any) => !item.statusIndicators.includes('Available for New Patients'));
    }

    if (calendarAvailability === 'available') {
      items = items.filter((item: any) => item.statusIndicators.includes('Available Today'));
    } else if (calendarAvailability === 'fullyBooked') {
      items = items.filter((item: any) => item.statusIndicators.includes('Fully Booked'));
    }

    // Service-based availability filters (match against services JSON array)
    if (availabilityOnline === 'true') {
      items = items.filter((item: any) =>
        item.services.some((s: string) => s.toLowerCase().includes('online') || s.toLowerCase().includes('telehealth'))
      );
    }
    if (availabilityInPerson === 'true') {
      items = items.filter((item: any) =>
        item.services.some((s: string) => s.toLowerCase().includes('in-person') || s.toLowerCase().includes('inperson') || s.toLowerCase().includes('clinic'))
      );
    }
    if (availabilityHomeVisit === 'true') {
      items = items.filter((item: any) =>
        item.services.some((s: string) => s.toLowerCase().includes('home') || s.toLowerCase().includes('visit'))
      );
    }

    // Gender filter (stored in services or metadata)
    if (gender) {
      items = items.filter((item: any) =>
        item.services.some((s: string) => s.toLowerCase().includes(gender.toLowerCase()))
      );
    }

    // Verified filter (based on onboarding status)
    if (verified === 'true') {
      items = items.filter((item: any) => item.onboardingStatus === 'APPROVED');
    } else if (verified === 'false') {
      items = items.filter((item: any) => item.onboardingStatus !== 'APPROVED');
    }

    const totalPages = Math.ceil(total / limit);

    res.json({
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  },
);

// ---------------------------------------------------------------------------
// GET /api/admin/providers/statistics
// Provider aggregate metrics for the management center dashboard
// ---------------------------------------------------------------------------

providersAdminRouter.get(
  '/providers/statistics',
  ...iamMiddlewareChain(adminRoles),
  async (req: any, res: any) => {
    const organizationId: string | undefined = req.user?.organizationId;
    const orgWhere = organizationId ? { organizationId } : {};

    const now = new Date();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    // Total providers
    const totalProviders = await prisma.providerProfile.count({ where: orgWhere });

    // Active providers (user status = ACTIVE)
    const activeCount = await prisma.providerProfile.count({
      where: {
        ...orgWhere,
        user: { is: { status: 'ACTIVE' } },
      },
    });

    // Online count: providers with appointment activity in the last hour (approximation)
    const recentActivity = await prisma.appointment.findMany({
      where: {
        ...orgWhere,
        updatedAt: { gte: oneHourAgo },
        status: { in: ['CONFIRMED', 'COMPLETED'] },
      },
      select: { providerId: true },
      distinct: ['providerId'],
    });
    const onlineCount = recentActivity.length;

    // Available today: providers with published slots today
    const providersWithSlotsToday = await prisma.publishedSlot.findMany({
      where: {
        ...(organizationId ? { organizationId } : {}),
        startsAt: { gte: todayStart, lte: todayEnd },
        status: 'AVAILABLE',
      },
      select: { providerId: true },
      distinct: ['providerId'],
    });
    const availableTodayCount = providersWithSlotsToday.length;

    // Average rating: derived from completion rate (no explicit ratings model)
    const [completedAppts, totalAppts] = await Promise.all([
      prisma.appointment.count({ where: { ...orgWhere, status: 'COMPLETED' } }),
      prisma.appointment.count({ where: { ...orgWhere, status: { in: ['COMPLETED', 'CANCELLED', 'NO_SHOW'] } } }),
    ]);
    const avgRating = totalAppts > 0 ? Math.round((completedAppts / totalAppts) * 5 * 10) / 10 : 4.5;

    // Average appointment duration (difference between startsAt and endsAt)
    const appointments = await prisma.appointment.findMany({
      where: { ...orgWhere, status: 'COMPLETED' },
      select: { startsAt: true, endsAt: true },
      take: 1000,
      orderBy: { createdAt: 'desc' },
    });

    let avgAppointmentDuration = 30; // default 30 minutes
    if (appointments.length > 0) {
      const totalMinutes = appointments.reduce((sum: number, appt: any) => {
        const diff = (new Date(appt.endsAt).getTime() - new Date(appt.startsAt).getTime()) / (1000 * 60);
        return sum + (diff > 0 ? diff : 30);
      }, 0);
      avgAppointmentDuration = Math.round(totalMinutes / appointments.length);
    }

    // Cancellation rate
    const cancelledCount = await prisma.appointment.count({ where: { ...orgWhere, status: 'CANCELLED' } });
    const allAppts = await prisma.appointment.count({ where: orgWhere });
    const cancellationRate = allAppts > 0 ? Math.round((cancelledCount / allAppts) * 100 * 10) / 10 : 0;

    // Patient satisfaction (derived from completion rate as proxy)
    const patientSatisfaction = avgRating;

    res.json({
      totalProviders,
      activeCount,
      onlineCount,
      availableTodayCount,
      avgRating,
      avgAppointmentDuration,
      cancellationRate,
      patientSatisfaction,
    });
  },
);
