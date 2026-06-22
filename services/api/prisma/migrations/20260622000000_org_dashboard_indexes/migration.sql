-- Performance: index organizationId on high-volume operational tables used by
-- the admin organization summary (groupBy) and the dashboard queries.
-- IF NOT EXISTS keeps this safe on databases where the indexes were already
-- created via `prisma db push`.
CREATE INDEX IF NOT EXISTS "AuditLog_organizationId_createdAt_idx" ON "AuditLog"("organizationId", "createdAt");
CREATE INDEX IF NOT EXISTS "Appointment_organizationId_idx" ON "Appointment"("organizationId");
CREATE INDEX IF NOT EXISTS "MessageThread_organizationId_idx" ON "MessageThread"("organizationId");
