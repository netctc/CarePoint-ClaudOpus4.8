import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { HttpError } from '../lib/http';
import { getPrismaErrorCode, isDatabaseUnavailableError } from '../lib/prisma';
import { writeAuditLog } from '../lib/audit';

function buildReference(req: Request) {
  return req.requestId ?? 'support-ref-unavailable';
}

/**
 * Non-blocking audit log for access-denied (403) events.
 * Fires immediately and does not block the error response.
 * Satisfies Requirement 8.6: log within 1 second of denial.
 */
function logAccessDenied(req: Request, reason: string) {
  writeAuditLog({
    actorId: req.user?.userId,
    organizationId: req.user?.organizationId ?? undefined,
    action: 'access.denied',
    resource: req.route?.path ?? req.path,
    resourceId: req.params?.id ?? undefined,
    details: {
      method: req.method,
      path: req.path,
      reason,
      role: req.user?.role ?? null,
    },
  }).catch(() => {
    // Non-blocking: audit write failure must not affect the primary response
  });
}

export function errorHandler(error: unknown, req: Request, res: Response, _next: NextFunction) {
  const supportReferenceId = buildReference(req);

  if (error instanceof HttpError) {
    // Log all 403 Forbidden responses as audit entries (Requirement 8.6)
    if (error.statusCode === StatusCodes.FORBIDDEN) {
      logAccessDenied(req, error.message);
    }

    const isServerSideHttpError = error.statusCode >= 500;
    return res.status(error.statusCode).json({
      error: isServerSideHttpError ? 'Request could not be completed' : error.message,
      details: isServerSideHttpError ? null : error.details ?? null,
      supportReferenceId,
      locale: req.locale ?? 'en',
    });
  }

  if (isDatabaseUnavailableError(error)) {
    return res.status(StatusCodes.SERVICE_UNAVAILABLE).json({
      error: 'Service temporarily unavailable',
      details: null,
      supportReferenceId,
      locale: req.locale ?? 'en',
    });
  }

  if (process.env.NODE_ENV !== 'production') {
    console.error(`[${supportReferenceId}]`, error);
  }

  return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
    error: 'Internal server error',
    details: null,
    supportReferenceId,
    locale: req.locale ?? 'en',
  });
}
