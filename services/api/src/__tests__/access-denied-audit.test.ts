import { afterAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { signAccessToken } from '../lib/jwt';
import { disconnectPrisma } from '../lib/prisma';

const app = createApp();

afterAll(async () => {
  await disconnectPrisma().catch(() => undefined);
});

// Mock the audit module to capture audit log calls without requiring a database
vi.mock('../lib/audit', () => ({
  writeAuditLog: vi.fn().mockResolvedValue({ id: 'mock-audit-id' }),
}));

import { writeAuditLog } from '../lib/audit';
const mockedWriteAuditLog = vi.mocked(writeAuditLog);

describe('Access-denied audit logging (Requirement 8.6)', () => {
  it('logs an audit entry when a 403 Forbidden is returned due to insufficient permissions', async () => {
    mockedWriteAuditLog.mockClear();

    // PATIENT role attempting to access admin users endpoint (requires SUPER_ADMIN/COMPANY_ADMIN)
    const patientToken = signAccessToken({
      sub: 'user-patient-denied',
      role: 'PATIENT',
      organizationId: 'org-denied-test',
    });

    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${patientToken}`);

    expect(res.status).toBe(403);

    // Verify audit log was called with the correct access.denied entry
    expect(mockedWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'user-patient-denied',
        organizationId: 'org-denied-test',
        action: 'access.denied',
        details: expect.objectContaining({
          method: 'GET',
          reason: expect.any(String),
          role: 'PATIENT',
        }),
      }),
    );
  });

  it('includes resource path and method in the audit details', async () => {
    mockedWriteAuditLog.mockClear();

    const token = signAccessToken({
      sub: 'user-nurse-denied',
      role: 'NURSE',
      organizationId: 'org-nurse-test',
    });

    const res = await request(app)
      .post('/api/iam/invitations')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'test@example.com', role: 'PROVIDER' });

    expect(res.status).toBe(403);

    expect(mockedWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'user-nurse-denied',
        action: 'access.denied',
        details: expect.objectContaining({
          method: 'POST',
          path: expect.stringContaining('/api/iam/invitations'),
          role: 'NURSE',
        }),
      }),
    );
  });

  it('does not log audit entry for non-403 errors (e.g., 401)', async () => {
    mockedWriteAuditLog.mockClear();

    // No auth token -> 401
    const res = await request(app).get('/api/admin/users');

    expect(res.status).toBe(401);
    expect(mockedWriteAuditLog).not.toHaveBeenCalled();
  });

  it('audit log failure does not affect the 403 response', async () => {
    mockedWriteAuditLog.mockClear();
    mockedWriteAuditLog.mockRejectedValueOnce(new Error('DB connection failed'));

    const token = signAccessToken({
      sub: 'user-failing-audit',
      role: 'PATIENT',
      organizationId: 'org-fail-test',
    });

    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${token}`);

    // The response should still be 403, not affected by audit failure
    expect(res.status).toBe(403);
    expect(res.body.error).toBeDefined();
  });
});
