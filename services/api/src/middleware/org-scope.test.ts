import { describe, expect, it, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { enforceOrgScope } from './org-scope';
import { HttpError } from '../lib/http';

function mockRequest(user?: Partial<Express.Request['user']>): Request {
  return { user: user as Express.Request['user'] } as Request;
}

function mockResponse(): Response {
  return {} as Response;
}

describe('enforceOrgScope middleware', () => {
  it('rejects with 401 if req.user is not set', () => {
    const req = mockRequest(undefined);
    (req as any).user = undefined;
    const res = mockResponse();
    const next = vi.fn();

    enforceOrgScope(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = next.mock.calls[0][0] as HttpError;
    expect(error).toBeInstanceOf(HttpError);
    expect(error.statusCode).toBe(401);
    expect(error.message).toBe('Authentication required');
  });

  it('allows SUPER_ADMIN to bypass org scoping without orgFilter', () => {
    const req = mockRequest({ userId: 'u1', role: 'SUPER_ADMIN' });
    const res = mockResponse();
    const next = vi.fn();

    enforceOrgScope(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
    expect(req.orgFilter).toBeUndefined();
  });

  it('rejects non-SUPER_ADMIN without organizationId with 401', () => {
    const req = mockRequest({ userId: 'u2', role: 'COMPANY_ADMIN' });
    const res = mockResponse();
    const next = vi.fn();

    enforceOrgScope(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = next.mock.calls[0][0] as HttpError;
    expect(error).toBeInstanceOf(HttpError);
    expect(error.statusCode).toBe(401);
    expect(error.message).toBe('Missing organization context');
  });

  it('attaches orgFilter for COMPANY_ADMIN with organizationId', () => {
    const req = mockRequest({ userId: 'u3', role: 'COMPANY_ADMIN', organizationId: 'org-123' });
    const res = mockResponse();
    const next = vi.fn();

    enforceOrgScope(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
    expect(req.orgFilter).toEqual({ organizationId: 'org-123' });
  });

  it('attaches orgFilter for PROVIDER with organizationId', () => {
    const req = mockRequest({ userId: 'u4', role: 'PROVIDER', organizationId: 'org-456' });
    const res = mockResponse();
    const next = vi.fn();

    enforceOrgScope(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
    expect(req.orgFilter).toEqual({ organizationId: 'org-456' });
  });

  it('attaches orgFilter for NURSE with organizationId', () => {
    const req = mockRequest({ userId: 'u5', role: 'NURSE', organizationId: 'org-789' });
    const res = mockResponse();
    const next = vi.fn();

    enforceOrgScope(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
    expect(req.orgFilter).toEqual({ organizationId: 'org-789' });
  });

  it('rejects PROVIDER without organizationId with 401', () => {
    const req = mockRequest({ userId: 'u6', role: 'PROVIDER' });
    const res = mockResponse();
    const next = vi.fn();

    enforceOrgScope(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = next.mock.calls[0][0] as HttpError;
    expect(error).toBeInstanceOf(HttpError);
    expect(error.statusCode).toBe(401);
    expect(error.message).toBe('Missing organization context');
  });
});
