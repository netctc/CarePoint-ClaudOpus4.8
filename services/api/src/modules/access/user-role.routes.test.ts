import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app';
import { signAccessToken } from '../../lib/jwt';

const app = createApp();

describe('PATCH /api/access/users/:id/role', () => {
  it('returns 401 when no auth token is provided', async () => {
    const res = await request(app)
      .patch('/api/access/users/some-user-id/role')
      .send({ role: 'PROVIDER', reason: 'Testing' });

    expect(res.status).toBe(401);
  });

  it('returns 403 when user role is not SUPER_ADMIN or COMPANY_ADMIN', async () => {
    const token = signAccessToken({
      sub: 'provider-user',
      role: 'PROVIDER',
      organizationId: 'org-1',
    });

    const res = await request(app)
      .patch('/api/access/users/some-user-id/role')
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'COMPANY_SUPPORT', reason: 'Testing role change' });

    expect(res.status).toBe(403);
  });

  it('returns 400 when request body is invalid (missing reason)', async () => {
    const token = signAccessToken({
      sub: 'admin-user',
      role: 'SUPER_ADMIN',
    });

    const res = await request(app)
      .patch('/api/access/users/some-user-id/role')
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'PROVIDER' });

    expect(res.status).toBe(400);
  });

  it('returns 400 when reason exceeds 500 characters', async () => {
    const token = signAccessToken({
      sub: 'admin-user',
      role: 'SUPER_ADMIN',
    });

    const res = await request(app)
      .patch('/api/access/users/some-user-id/role')
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'PROVIDER', reason: 'x'.repeat(501) });

    expect(res.status).toBe(400);
  });

  it('returns 400 when role is invalid', async () => {
    const token = signAccessToken({
      sub: 'admin-user',
      role: 'SUPER_ADMIN',
    });

    const res = await request(app)
      .patch('/api/access/users/some-user-id/role')
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'INVALID_ROLE', reason: 'Testing' });

    expect(res.status).toBe(400);
  });

  it('returns 401 when COMPANY_ADMIN has no organizationId', async () => {
    // COMPANY_ADMIN without org context should be rejected by org-scope middleware
    const token = signAccessToken({
      sub: 'admin-user',
      role: 'COMPANY_ADMIN',
    });

    const res = await request(app)
      .patch('/api/access/users/some-user-id/role')
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'PROVIDER', reason: 'Testing' });

    expect(res.status).toBe(401);
  });
});
