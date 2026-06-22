import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { HttpError } from '../lib/http';
import { getPrismaErrorCode, isDatabaseUnavailableError } from '../lib/prisma';

function buildReference(req: Request) {
  return req.requestId ?? 'support-ref-unavailable';
}

export function errorHandler(error: unknown, req: Request, res: Response, _next: NextFunction) {
  const supportReferenceId = buildReference(req);

  if (error instanceof HttpError) {
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
