import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { normalizeLocaleCode, type LocaleCode } from '@care-center/contracts';

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      locale?: LocaleCode;
    }
  }
}

export function requestContext(req: Request, res: Response, next: NextFunction) {
  const requestId = typeof req.headers['x-request-id'] === 'string' && req.headers['x-request-id'].trim()
    ? req.headers['x-request-id'].trim()
    : randomUUID();

  req.requestId = requestId;
  req.locale = normalizeLocaleCode(req.headers['accept-language'] ?? req.query.locale ?? req.cookies?.locale);

  res.setHeader('x-request-id', requestId);
  res.locals.requestId = requestId;
  res.locals.locale = req.locale;
  next();
}
