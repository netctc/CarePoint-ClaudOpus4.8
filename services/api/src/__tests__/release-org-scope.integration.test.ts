import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { signAccessToken } from '../lib/jwt';

const app = createApp();
const missingScopeAdmin = signAccessToken({ sub: 'scope-test-admin', role: 'COMPANY_ADMIN' });

describe('release-v1 organization scope boundary', () => {
  it('preserves 401 for unauthenticated provider-directory access', async () => {
    const res = await request(app).get('/api/providers');
    expect(res.status).toBe(401);
  });

  it.each([
    '/api/providers',
    '/api/bookings/summary',
    '/api/admin/users/organizations',
  ])('fails closed with 403 for a non-super-admin token missing organizationId: %s', async (path) => {
    const res = await request(app)
      .get(path)
      .set('Authorization', `Bearer ${missingScopeAdmin}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/Organization scope is required/i);
  });
});
