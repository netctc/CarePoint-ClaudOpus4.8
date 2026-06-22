/**
 * Phase 32 notes for /api/admin/users/* 503 and 30s+ latency.
 *
 * The current logs show these endpoints timing out or returning 503:
 * - /api/admin/users/patients
 * - /api/admin/users/providers
 * - /api/admin/users/organizations?limit=100
 * - /api/admin/users/provider-roles
 *
 * Recommended implementation pattern:
 *
 * 1. Never load all relation-heavy account data for the Admin page SSR path.
 * 2. Use explicit pagination defaults: limit 25, max 100.
 * 3. Use select instead of include for list endpoints.
 * 4. Use Promise.allSettled on dashboard aggregations so one slow query does not
 *    block the full page.
 * 5. Add a database timeout wrapper where supported by your query layer.
 * 6. Return a degraded response with `degraded: true` when non-critical widgets fail.
 */

export function normalizeAdminListLimit(value: unknown, fallback = 25, max = 100): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(max, Math.trunc(parsed)));
}

export function normalizeAdminListOffset(value: unknown): number {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.trunc(parsed));
}

export async function settledOrEmpty<T>(promise: Promise<T[]>): Promise<{ items: T[]; degraded: boolean }> {
  const result = await Promise.allSettled([promise]);
  const first = result[0];
  if (first.status === 'fulfilled') return { items: first.value, degraded: false };
  return { items: [], degraded: true };
}
