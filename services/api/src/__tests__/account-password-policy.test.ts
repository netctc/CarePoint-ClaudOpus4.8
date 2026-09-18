import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { signAccessToken } from '../lib/jwt';
import { validateTemporaryPassword } from '../lib/account-password-policy';

const app = createApp();
const adminToken = signAccessToken({ sub: 'password-policy-admin', role: 'SUPER_ADMIN' });

describe('temporary account password policy', () => {
  it('accepts an explicit long non-default temporary password', () => {
    expect(validateTemporaryPassword('X7!Release-Account-Seed-42', { required: true })).toBe('X7!Release-Account-Seed-42');
  });

  it('rejects a missing required temporary password', () => {
    expect(() => validateTemporaryPassword(undefined, { required: true })).toThrow(/explicit temporary password/i);
  });

  it('rejects short or obvious default-style values', () => {
    expect(() => validateTemporaryPassword('Short-Only-9!', { required: true })).toThrow(/between 16 and 128/i);
    expect(() => validateTemporaryPassword('CarePoint-Release-Account-42!', { required: true })).toThrow(/default or product-name/i);
  });
});

describe('admin account release password guard', () => {
  it('preserves authentication precedence', async () => {
    const res = await request(app)
      .post('/api/admin/users/patients')
      .send({ email: 'unauth@example.com', firstName: 'Una', lastName: 'Auth' });

    expect(res.status).toBe(401);
  });

  it('rejects patient creation without an explicit temporary password before persistence', async () => {
    const res = await request(app)
      .post('/api/admin/users/patients')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: 'missing-password@example.com', firstName: 'Missing', lastName: 'Password' });

    expect(res.status).toBe(400);
    expect(String(res.body?.message ?? res.body?.error ?? '')).toMatch(/temporary password/i);
  });

  it('rejects provider creation with a weak temporary password before persistence', async () => {
    const res = await request(app)
      .post('/api/admin/users/providers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: 'weak-password@example.com', firstName: 'Weak', lastName: 'Password', password: 'Too-Short-9!' });

    expect(res.status).toBe(400);
    expect(String(res.body?.message ?? res.body?.error ?? '')).toMatch(/temporary password/i);
  });

  it('rejects CSV import rows that omit an explicit temporary password before persistence', async () => {
    const res = await request(app)
      .post('/api/admin/users/import')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        type: 'PATIENT',
        dryRun: true,
        csv: 'organizationId,firstName,lastName,email,status,password\n,Sample,Patient,sample.patient@example.com,ACTIVE,',
      });

    expect(res.status).toBe(400);
    expect(String(res.body?.message ?? res.body?.error ?? '')).toMatch(/import row/i);
  });
});
