/**
 * Phase 32 integration example for services/api/src/modules/records/records.routes.ts
 *
 * 1. Add this import near the other records imports:
 *
 * import { listRefillOperationalEvents } from './refillOperationalEvents';
 *
 * 2. Replace the existing /refill-operational-events route body, or use this
 *    route if it does not already exist.
 */

router.get('/refill-operational-events', requireRoles(['ADMIN', 'PROVIDER']), async (req, res) => {
  const events = await listRefillOperationalEvents({
    prisma,
    limit: req.query.limit?.toString() ?? '12',
    organizationId: req.user?.organizationId ?? null,
    facilityId: req.query.facilityId?.toString() ?? req.user?.facilityId ?? null,
  });

  res.json({
    items: events,
    count: events.length,
  });
});
