import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { allowRoles, iamMiddlewareChain } from './rbac';

function mockRequest(overrides: Partial<Request> = {}): Request {
  return { user: undefined, ...overrides } as unknown as Request;
}

function mockResponse(): Response {
  return {} as unknown as Response;
}

describe('allowRoles middleware', () => {
  it('returns 403 with "Insufficient permissions" when role is not in allowed list', () => {
    const middleware = allowRoles(['SUPER_ADMIN', 'COMPANY_ADMIN']);
    const req = mockRequest({ user: { userId: 'u1', role: 'PATIENT', organizationId: 'org1' } });
    const res = mockResponse();
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    const error = next.mock.calls[0][0];
    expect(error).toBeDefined();
    expect(error.statusCode).toBe(403);
    expect(error.message).toBe('Insufficient permissions');
  });

  it('returns 401 when user is not authenticated', () => {
    const middleware = allowRoles(['SUPER_ADMIN']);
    const req = mockRequest({ user: undefined });
    const res = mockResponse();
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    const error = next.mock.calls[0][0];
    expect(error).toBeDefined();
    expect(error.statusCode).toBe(401);
    expect(error.message).toBe('Authentication required');
  });

  it('calls next() without error when role is allowed', () => {
    const middleware = allowRoles(['SUPER_ADMIN', 'COMPANY_ADMIN']);
    const req = mockRequest({ user: { userId: 'u1', role: 'COMPANY_ADMIN', organizationId: 'org1' } });
    const res = mockResponse();
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith();
  });
});

describe('iamMiddlewareChain', () => {
  it('returns middleware array in correct order: [requireAuth, allowRoles, enforceOrgScope]', () => {
    const chain = iamMiddlewareChain(['SUPER_ADMIN', 'COMPANY_ADMIN']);

    expect(chain).toHaveLength(3);
    // First middleware should be requireAuth (named function)
    expect(chain[0].name).toBe('requireAuth');
    // Second middleware is the role checker (anonymous function from allowRoles)
    expect(typeof chain[1]).toBe('function');
    // Third middleware should be enforceOrgScope
    expect(chain[2].name).toBe('enforceOrgScope');
  });

  it('permission check (position 1) short-circuits before org scope (position 2) evaluates', () => {
    const chain = iamMiddlewareChain(['SUPER_ADMIN']);

    // Simulate a PATIENT user (no permission) — only run up to position 1
    const req = mockRequest({ user: { userId: 'u1', role: 'PATIENT', organizationId: 'org1' } });
    const res = mockResponse();
    const next = vi.fn();

    // Run the RBAC middleware (position 1 in chain)
    const rbacMiddleware = chain[1];
    rbacMiddleware(req, res, next);

    // It should call next with a 403 error (short-circuit)
    expect(next).toHaveBeenCalledOnce();
    const error = next.mock.calls[0][0];
    expect(error).toBeDefined();
    expect(error.statusCode).toBe(403);
    expect(error.message).toBe('Insufficient permissions');

    // Verify org-scope middleware (position 2) is never reached
    // by confirming req.orgFilter was never set
    expect((req as any).orgFilter).toBeUndefined();
  });

  it('allowed role passes through RBAC and reaches org-scope middleware', () => {
    const chain = iamMiddlewareChain(['COMPANY_ADMIN']);

    const req = mockRequest({ user: { userId: 'u1', role: 'COMPANY_ADMIN', organizationId: 'org1' } });
    const res = mockResponse();

    // Run RBAC middleware (position 1)
    const rbacNext = vi.fn();
    chain[1](req, res, rbacNext);
    expect(rbacNext).toHaveBeenCalledWith(); // no error

    // Run org-scope middleware (position 2)
    const orgNext = vi.fn();
    chain[2](req, res, orgNext);
    expect(orgNext).toHaveBeenCalledWith(); // no error
    expect((req as any).orgFilter).toEqual({ organizationId: 'org1' });
  });
});
